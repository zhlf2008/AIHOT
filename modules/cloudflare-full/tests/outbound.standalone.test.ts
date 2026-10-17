import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";
import { platformPlugin, workerBuildOptions } from "../platform-build.mjs";

test("Worker transport retains redirect, private-network and response-size guards with native fetch", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "knithot-egress-"));
  const output = path.join(temp, "transport.mjs");
  const requests: string[] = [];
  const originalFetch = globalThis.fetch;
  let privateAddress = false;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url.toString());
    if (url.hostname === "cloudflare-dns.com") return Response.json({ Status: 0, Answer: url.searchParams.get("type") === "A" ? [{ type: 1, data: privateAddress ? "127.0.0.1" : "93.184.216.34" }] : [] });
    if (url.pathname === "/redirect") return new Response(null, { status: 302, headers: { location: "https://other.example.org/feed" } });
    if (url.pathname === "/private") return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secrets" } });
    return new Response("public feed text", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }) as typeof fetch;
  try {
    await build({ ...workerBuildOptions, platform: "node", entryPoints: [path.resolve("packages/backend/src/lib/http-fetch.ts")], outfile: output, plugins: [platformPlugin({ edgeFetch: true })] });
    const { guardedFetch } = await import(pathToFileURL(output).href);
    const response = await guardedFetch("https://news.example.org/redirect");
    assert.equal(response.url, "https://other.example.org/feed");
    assert.equal(response.text(), "public feed text");
    assert.equal(requests.filter(url => url.includes("cloudflare-dns.com")).length, 4, "resolve both address families for every redirect hop");
    await assert.rejects(guardedFetch("https://news.example.org/redirect", { headers: { authorization: "fixture" } }), /cross-origin redirect/);
    await assert.rejects(guardedFetch("https://news.example.org/private"), /Blocked/);
    await assert.rejects(guardedFetch("https://news.example.org/feed", { maxBytes: 3 }), /Response too large/);
    privateAddress = true;
    const before = requests.filter(url => !url.includes("cloudflare-dns.com")).length;
    await assert.rejects(guardedFetch("https://rebound.example.org/feed"), /Blocked/);
    assert.equal(requests.filter(url => !url.includes("cloudflare-dns.com")).length, before);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(temp, { recursive: true, force: true });
  }
});
