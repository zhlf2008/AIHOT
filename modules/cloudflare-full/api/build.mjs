import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { buildAssetManifest } from "./assets.mjs";
import { findMyWayJitPlugin } from "./router-build.mjs";
import { workerBuildOptions, platformPlugin } from "../platform-build.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
await mkdir(path.join(here, ".build"), { recursive: true });
await writeFile(path.join(here, ".build/asset-files.json"), JSON.stringify(await buildAssetManifest()));
await build({
  entryPoints: [path.join(here, "worker.ts")], outfile: path.join(here, ".build/worker.js"),
  ...workerBuildOptions,
  plugins: [findMyWayJitPlugin(), platformPlugin({ readOnlyApi: true, edgeFetch: true, edgeQueues: true, edgeAdmin: true, edgeOg: true, edgeImages: true })],
});
console.log("Built original publication API for Cloudflare read-only preview");
