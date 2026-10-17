import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { sql, withDatabase } from "../api/db.ts";
import { mountReadonlyAssets } from "../api/fs.ts";
import manifest from "./.build/asset-files.json" with { type: "json" };
import { withTaskQueues } from "./queue-context.ts";
import { withMediaService } from "../api/media-context.ts";

interface Env {
  HYPERDRIVE: { connectionString: string };
  EDITORIAL: { create(options: { id: string; params: Params }): Promise<unknown> };
  MEDIA?: { fetch(request: Request): Promise<Response> };
}
interface Params { sourceId?: string; itemIndex?: number; mode?: "validation" | "batch"; maxJobs?: number }
async function runtime<T>(env: Env, fn: () => Promise<T>) {
  await mountReadonlyAssets(manifest);
  return withDatabase(env.HYPERDRIVE.connectionString, () => withMediaService(env.MEDIA, () => withTaskQueues(fn)));
}

/** A single bounded real-source validation. Invocation is through the authenticated Workflow API. */
export class EditorialWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    if (process.env.MODEL_CALLS_ENABLED !== "true" || process.env.COLLECT_ENABLED !== "true") return { disabled: true };
    if (event.schedule || event.payload.mode === "batch") {
      const limit = event.payload.maxJobs ?? 12;
      if (!Number.isInteger(limit) || limit < 1 || limit > 12) throw new Error("Batch size must be between 1 and 12");
      await step.do("schedule-and-recover-original-queues", { retries: { limit: 1, delay: "10 seconds" }, timeout: "3 minutes" }, () => runtime(this.env, async () => (await import("./batch.ts")).prepareBatch()));
      // Finish selected reading before new editorial work consumes the shared budget.
      const translation = await step.do("translate-one-selected-full-text-item", { retries: { limit: 0, delay: "10 seconds" }, timeout: "30 minutes" }, () => runtime(this.env, async () => (await import("./batch.ts")).translatePendingContent()));
      const jobs = [];
      for (let index = 0; index < limit; index++) {
        const job = await step.do(`original-queue-job-${index}`, { retries: { limit: 0, delay: "10 seconds" }, timeout: "10 minutes" }, () => runtime(this.env, async () => (await import("./batch.ts")).processNextJob(index)));
        if (!job) break;
        jobs.push(job);
      }
      const publication = await step.do("refresh-events-and-due-reports", { retries: { limit: 1, delay: "10 seconds" }, timeout: "10 minutes" }, () => runtime(this.env, async () => (await import("./batch.ts")).refreshPublications()));
      return { jobs, publication, translation };
    }
    const articleId = await step.do("collect-one-real-item", { retries: { limit: 0, delay: "10 seconds" }, timeout: "2 minutes" }, () => runtime(this.env, async () => {
      const sourceId = event.payload.sourceId ?? "rss-knitting-industry";
      const [source] = await sql`SELECT * FROM sources WHERE id=${sourceId} AND kind IN ('rss','web_list') AND enabled=true`;
      if (!source) throw new Error("Enabled RSS or web source not found");
      const { fetchRss } = await import("@aihot/backend/sources/rss");
      const { fetchWebList, fetchDetail } = await import("@aihot/backend/sources/web-list");
      const { admitListing } = await import("@aihot/backend/sources/filters");
      const { upsertMaterial } = await import("@aihot/backend/content/materials");
      const candidates = admitListing(source.kind === "rss" ? (await fetchRss(source as never)).candidates : await fetchWebList(source as never), source as never);
      const index = event.payload.itemIndex ?? 0;
      if (!Number.isInteger(index) || index < 0 || index > 7 || !candidates[index]) throw new Error("Source item index is outside the validation batch");
      const candidate = candidates[index]!;
      if (source.kind === "web_list") {
        const detail = await fetchDetail(candidate.url, source as never, { date: !candidate.publishedAt, title: false, summary: true, body: true });
        candidate.publishedAt ??= detail.publishedAt;
        if (detail.body) Object.assign(candidate, { bodyHtml: detail.body.html, bodyText: detail.body.text, bodyStatus: "ok" });
      }
      const material = await upsertMaterial({ ...candidate, sourceId, via: "import", backfill: "Cloudflare editorial validation" });
      console.log(JSON.stringify({ msg: "workflow real source item", articleId: material.articleId, sourceId, title: candidate.title }));
      return material.articleId;
    }));
    const editorial = await step.do("original-double-score-and-chinese-copy", { retries: { limit: 0, delay: "10 seconds" }, timeout: "10 minutes" }, () => runtime(this.env, async () => {
      const { analyzeArticle } = await import("@aihot/backend/editorial/analyze");
      const result = await analyzeArticle(articleId);
      if (!result?.output || result.needsBody) throw new Error("Source content needs body extraction before editorial validation");
      return { relevance: result.output.relevance, score: result.output.score, selected: result.output.selected };
    }));
    await step.do("original-event-grouping", { retries: { limit: 0, delay: "10 seconds" }, timeout: "10 minutes" }, () => runtime(this.env, async () => (await import("@aihot/backend/events/group")).groupArticle(articleId)));
    await step.do("publish-through-original-projection", { retries: { limit: 1, delay: "10 seconds" }, timeout: "1 minute" }, () => runtime(this.env, async () => {
      const { publishArticle } = await import("@aihot/backend/publication/publish");
      await publishArticle(articleId);
      return { articleId };
    }));
    const translation = await step.do("translate-if-selected-and-licensed", { retries: { limit: 0, delay: "10 seconds" }, timeout: "30 minutes" }, () => runtime(this.env, async () => (await import("@aihot/backend/editorial/translate")).translateArticle(articleId)));
    return { articleId, ...editorial, translation };
  }
}

export default {
  async scheduled(event: { scheduledTime: number }, env: Env) {
    if (process.env.MODEL_CALLS_ENABLED !== "true" || process.env.COLLECT_ENABLED !== "true") return;
    // Deterministic IDs make duplicate Cron deliveries converge on the same durable instance.
    try { await env.EDITORIAL.create({ id: `scheduled-${event.scheduledTime}`, params: { mode: "batch", maxJobs: 12 } }); }
    catch (error) {
      // The API's already_exists is the only expected duplicate; outages must remain visible.
      if (!(error instanceof Error) || !/instance.*already exists/i.test(error.message)) throw error;
    }
  },
  async fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname !== "/api/health" || !["GET", "HEAD"].includes(request.method)) return new Response("Not found", { status: 404 });
    return runtime(env, async () => { await sql`SELECT 1`; return Response.json({ ok: true, phase: "editorial-validation" }); });
  },
};
