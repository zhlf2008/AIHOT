import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import worker from "../src/index.ts";
import { collect, sources } from "../src/collect.ts";
import type { Env } from "../src/types.ts";

test("D1 public outlets, search, filters, RSS, missing routes and collection valves", async () => {
  const mf = new Miniflare({
    workers: [
      {
        config: {
          name: "test",
          compatibilityDate: "2026-10-16",
          manifest: {
            mainModule: "index.js",
            modules: {
              "index.js": {
                type: "esm",
                contents: 'export default {fetch(){return new Response("ok")}}',
              },
            },
          },
          env: { DB: { type: "d1", id: "test-knithot" } },
        },
      },
    ],
  });
  try {
    const db = await mf.getD1Database("DB");
    const schema = await readFile(
      new URL("../d1-migrations/0001_initial.sql", import.meta.url),
      "utf8",
    );
    for (const statement of schema
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(statement).run();
    const now = new Date().toISOString();
    const sourceId = sources[0].id;
    await db
      .prepare("INSERT INTO articles VALUES(?,?,?,?,?,?,?,?,?,?)")
      .bind(
        "a",
        sourceId,
        "https://example.com/wool",
        "Recycled wool yarn",
        "Test <b>summary</b>",
        "sustainability",
        now,
        now,
        3,
        "published",
      )
      .run();
    await db
      .prepare("INSERT INTO articles VALUES(?,?,?,?,?,?,?,?,?,?)")
      .bind(
        "b",
        sourceId,
        "https://example.com/loom",
        "Machine & structure",
        "A 20% change",
        "technology",
        null,
        now,
        1,
        "discovered",
      )
      .run();
    const env = {
      DB: db,
      ASSETS: { fetch: async () => new Response("asset") },
      COLLECT_ENABLED: "false",
    } as unknown as Env;
    const get = (path: string) =>
      worker.fetch(new Request(`https://knithot.test${path}`), env);
    let response = await get("/api/health");
    assert.equal(response.status, 200);
    assert.equal(((await response.json()) as any).database, "connected");
    response = await get("/api/articles?q=wool");
    let data = (await response.json()) as any;
    assert.equal(data.total, 1);
    assert.equal(data.items[0].source_id, sourceId);
    data = (await (
      await get("/api/articles?category=technology")
    ).json()) as any;
    assert.equal(data.total, 1);
    assert.equal(data.items[0].published_at, null);
    data = (await (
      await get("/api/articles?limit=NaN&offset=Infinity")
    ).json()) as any;
    assert.equal(data.limit, 24);
    assert.equal(data.offset, 0);
    data = (await (await get("/api/articles?q=%25")).json()) as any;
    assert.equal(data.total, 1);
    data = (await (
      await get("/api/articles?q=%27%20OR%201%3D1%20--")
    ).json()) as any;
    assert.equal(data.total, 0);
    const rss = await (await get("/feed.xml")).text();
    assert.match(rss, /Machine &amp; structure/);
    assert.match(rss, /Test &lt;b&gt;summary&lt;\/b&gt;/);
    assert.equal((rss.match(/<pubDate>/g) || []).length, 1);
    assert.equal((await get("/api/missing")).status, 404);
    response = await worker.fetch(
      new Request("https://knithot.test/api/articles", { method: "POST" }),
      env,
    );
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("Allow"), "GET, HEAD");
    assert.match(
      response.headers.get("Content-Security-Policy") || "",
      /frame-ancestors 'none'/,
    );
    await collect(env);
    assert.equal(
      (
        (await db
          .prepare("SELECT COUNT(*) AS n FROM source_runs")
          .first()) as any
      ).n,
      0,
    );

    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      return new Response("<html>not a feed</html>");
    };
    try {
      // Every network response is a local fixture; no external collection in tests.
      await collect({ ...env, COLLECT_ENABLED: "true" });
      assert.ok(fetchCount > 0);
      assert.ok(
        (
          (await db
            .prepare(
              "SELECT COUNT(*) AS n FROM source_runs WHERE status='error'",
            )
            .first()) as any
        ).n > 0,
      );
      assert.equal(
        (
          (await db
            .prepare("SELECT COUNT(*) AS n FROM collection_lock")
            .first()) as any
        ).n,
        0,
      );
      const publisher = sources.find((s) => s.collection === "rss")!;
      const link = new URL("/news/test-knitted-yarn", publisher.url).href;
      globalThis.fetch = async (input) =>
        new Response(
          String(input) === publisher.feedUrl
            ? `<rss><channel><item><title>New knitted wool yarn collection</title><link>${link}</link><description>Merino wool fabric</description><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`
            : "<html>fixture</html>",
        );
      await collect({ ...env, COLLECT_ENABLED: "true" });
      const first = await db
        .prepare("SELECT id,collected_at FROM articles WHERE url=?")
        .bind(link)
        .first();
      assert.ok(first);
      assert.equal(
        (
          (await db
            .prepare("SELECT status FROM source_runs WHERE source_id=?")
            .bind(publisher.id)
            .first()) as any
        ).status,
        "ok",
      );
      await collect({ ...env, COLLECT_ENABLED: "true" });
      assert.deepEqual(
        await db
          .prepare("SELECT id,collected_at FROM articles WHERE url=?")
          .bind(link)
          .first(),
        first,
      );
      assert.equal(
        (
          (await db
            .prepare("SELECT COUNT(*) AS n FROM articles")
            .first()) as any
        ).n,
        3,
      );
      await db
        .prepare("INSERT INTO collection_lock VALUES(1,?)")
        .bind(Date.now() + 600000)
        .run();
      let overlapped = false;
      globalThis.fetch = async () => {
        overlapped = true;
        throw new Error("overlapping collector");
      };
      await collect({ ...env, COLLECT_ENABLED: "true" });
      assert.equal(overlapped, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  } finally {
    await mf.dispose();
  }
});
