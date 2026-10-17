import { registerContentJobs } from "@aihot/backend/jobs/content";
import { registerSourceJobs } from "@aihot/backend/jobs/sources";
import { registerEventJobs } from "@aihot/backend/jobs/events";
import { registerPublicationJobs } from "@aihot/backend/jobs/publication";
import { registerNotifyJobs } from "@aihot/backend/jobs/notify";
import { getBoss, recordRun } from "@aihot/backend/jobs/queue";
import { scheduleDueSources } from "@aihot/backend/sources/collect";
import { sweepUnprocessed } from "@aihot/backend/jobs/content";
import { translatePending } from "@aihot/backend/editorial/translate";
import { recoverStaleWork } from "@aihot/backend/operations/recover";
import { computeHotRanking, snapshotHeat } from "@aihot/backend/events/hot";
import { linkRelatedStories } from "@aihot/backend/events/consolidate";
import { composeDueReports, dueDaily } from "@aihot/backend/reports/compose";
import { beijingAt } from "@aihot/contracts/time";
import { EDITION_TIMES } from "@aihot/site";
import { sql } from "../api/db.ts";
import { runOneQueuedJob } from "./queue-context.ts";

export async function registerBatchHandlers() {
  const boss = await getBoss();
  await registerSourceJobs(boss);
  await registerContentJobs(boss);
  await registerEventJobs(boss);
  await registerPublicationJobs(boss);
  await registerNotifyJobs(boss);
  return boss;
}

export async function prepareBatch() {
  const boss = await registerBatchHandlers();
  await boss.supervise();
  await recordRun("ops.recover", recoverStaleWork);
  await recordRun("sources.schedule", scheduleDueSources);
  await recordRun("content.sweep", sweepUnprocessed);
  return { ready: true };
}

export async function processNextJob(cursor = 0) {
  await registerBatchHandlers();
  return runOneQueuedJob(cursor);
}

/** Reuse the engine's selection, licence, revision and receipt gates for one item per batch. */
export async function translatePendingContent() {
  return recordRun("content.translate", () => translatePending({ limit: 1, budgetMs: 4 * 60_000 }));
}

export async function refreshPublications() {
  await recordRun("hot.rank", computeHotRanking);
  await recordRun("hot.snapshot", snapshotHeat);
  await recordRun("stories.links", linkRelatedStories);
  const reports = await recordRun("reports.compose", async () => {
    const [first] = await sql<{ at: Date | null }[]>`SELECT min(created_at) AS at FROM articles`;
    // The first due window may end before this new site existed. Wait; never manufacture a quiet issue.
    if (!first.at || first.at >= beijingAt(dueDaily(), EDITION_TIMES.daily)) return { state: "waiting_first_edition" };
    return composeDueReports();
  });
  return { refreshed: true, reports };
}
