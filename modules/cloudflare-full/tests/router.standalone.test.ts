import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";
import { transformFindMyWaySource, findMyWayJitPlugin } from "../api/router-build.mjs";

const packageRoot = path.resolve(import.meta.dirname, "../../../node_modules/find-my-way");
function customTenant() { const values = new Map<string, any>(); return { name: "tenant", mustMatchWhenDerived: true, storage: () => ({ get: (v: string) => values.get(v) ?? null, set: (v: string, h: any) => values.set(v, h), del: (v: string) => values.delete(v), empty: () => values.clear() }), deriveConstraint: (req: any) => req.headers.tenant }; }
function configure(Router: any) {
  const r = Router({ constraints: { tenant: customTenant() }, defaultRoute: () => "missing" }); const mark = (x: string) => () => x;
  r.on("GET", "/knit/:name/:color", mark("params")); r.on("GET", "/prefix/static", mark("static")); r.on("GET", "/files/*", mark("wildcard"));
  r.on("POST", "/method", mark("post")); r.on("GET", "/", { constraints: { host: "knit.example" } }, mark("host"));
  r.on("GET", "/version", { constraints: { version: "1.0.0" } }, mark("version")); r.on("GET", "/tenant", { constraints: { tenant: "blue" } }, mark("tenant")); return r;
}
function observe(r: any, method: string, url: string, headers: Record<string, string> = {}) { const derived = r.constrainer.deriveConstraints({ headers }, {}); const f = r.find(method, url, derived); return f ? { value: f.handler(null, null, f.params), params: f.params, proto: Object.getPrototypeOf(f.params) } : null; }

test("each JIT site is replaced once and transformed source is valid", async () => {
  for (const name of ["node", "handler-storage", "constrainer"]) { const id = path.join(packageRoot, "lib", `${name}.js`); const out = transformFindMyWaySource(await readFile(id, "utf8"), id); assert.equal((out.match(/new Function/g) ?? []).length, 0, name); assert.doesNotThrow(() => new Function(out), name); }
});

test("original and transformed routers have identical route results", async () => {
  const originalModule = await import("find-my-way"); const temp = await mkdtemp(path.join(os.tmpdir(), "knithot-router-")); const out = path.join(temp, "router.mjs");
  await build({ entryPoints: [path.join(packageRoot, "index.js")], outfile: out, bundle: true, format: "esm", platform: "node", external: ["node:*"], banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }, plugins: [findMyWayJitPlugin()] });
  const transformedModule = await import(`${pathToFileURL(out).href}?${Date.now()}`); const Original = (originalModule as any).default ?? originalModule; const Transformed = (transformedModule as any).default ?? transformedModule;
  const cases: Array<[string, string, Record<string, string>, string | null]> = [["GET", "/knit/yarn/%E7%BA%A2", {}, "params"], ["GET", "/prefix/static", {}, "static"], ["GET", "/files/a/b", {}, "wildcard"], ["POST", "/method", {}, "post"], ["GET", "/method", {}, null], ["GET", "/", { host: "knit.example" }, "host"], ["GET", "/", { host: "other.example" }, null], ["GET", "/version", { "accept-version": "1.0.0" }, "version"], ["GET", "/version", { "accept-version": "2.0.0" }, null], ["GET", "/tenant", { tenant: "blue" }, "tenant"], ["GET", "/tenant", { tenant: "red" }, null]];
  const left = configure(Original); const right = configure(Transformed);
  for (const [method, url, headers, expected] of cases) { const a = observe(left, method, url, headers); const b = observe(right, method, url, headers); assert.equal(a?.value ?? null, expected, `original ${method} ${url}`); assert.equal(b?.value ?? null, expected, `transformed ${method} ${url}`); assert.deepEqual(b?.params ? { ...b.params } : null, a?.params ? { ...a.params } : null, `${method} ${url} params`); assert.equal(b?.proto === null, a?.proto === null, `${method} ${url} NullObject`); }
  await rm(temp, { recursive: true, force: true });
});
