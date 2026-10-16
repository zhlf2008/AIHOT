import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePageRequest, pageResponse } from "../web/page-policy.ts";

test("public navigation cannot request a cacheable partial set of loaders", () => {
  const req = new Request("https://knit.example/all.data?category=industry&_routes=root");
  assert.equal(normalizePageRequest(req).url, "https://knit.example/all.data?category=industry");
  const admin = new Request("https://knit.example/admin.data?_routes=root");
  assert.equal(normalizePageRequest(admin), admin);
});

test("HTML and navigation spend the same upstream deadline without stale reuse", async () => {
  const now = 1_800_000_000_000;
  for (const path of ["/all", "/all.data"]) {
    const response = pageResponse(new Request(`https://knit.example${path}`), new Response("body", { headers: {
      "Cache-Control": "public, s-maxage=600", "X-Accel-Expires": "@1800000010", "Content-Type": "text/x-script",
    } }), now);
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=10, s-maxage=10, must-revalidate");
    assert.equal(response.headers.get("X-Accel-Expires"), "@1800000010");
    if (path.endsWith(".data")) assert.equal(response.headers.get("Content-Type"), "text/plain; charset=utf-8");
    assert.equal(await response.text(), "body");
  }
});

test("errors, actions, admin pages and cookies never inherit a public cache policy", () => {
  const cases: Array<[string, RequestInit, ResponseInit]> = [
    ["/all", {}, { status: 503 }], ["/all", { method: "POST" }, {}], ["/admin", {}, {}],
    ["/all", {}, { headers: { "Set-Cookie": "session=fixture" } }],
  ];
  for (const [path, request, init] of cases) {
    const response = pageResponse(new Request(`https://knit.example${path}`, request), new Response("body", {
      ...init, headers: { "Cache-Control": "public, s-maxage=600", "Expires": "tomorrow", ...init.headers },
    }));
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("X-Accel-Expires"), "0");
    assert.equal(response.headers.has("Expires"), false);
  }
});
