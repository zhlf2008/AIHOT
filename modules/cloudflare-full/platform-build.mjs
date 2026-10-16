import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const backendDb = path.join(root, "packages/backend/src/db.ts");
export const workerBuildOptions = {
  bundle: true, format: "esm", platform: "neutral", target: "es2022", conditions: ["workerd", "worker", "browser"],
  mainFields: ["browser", "module", "main"],
  banner: { js: 'import { createRequire as __nodeCreateRequire } from "node:module"; const require = __nodeCreateRequire("/bundle/worker.js");' },
  external: ["node:*", "cloudflare:*", ...builtinModules],
};
function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error(`Worker adapter target changed: ${before.slice(0, 70)}`);
  return source.replace(before, after);
}
export function platformPlugin({ readOnlyApi = false, edgeFetch = false, edgeQueues = false, edgeAdmin = false, edgeOg = false, edgeImages = false } = {}) {
  return { name: "knithot-worker-platform", setup(b) {
    if (edgeImages) b.onResolve({ filter: /images(?:\.ts)?$/ }, args => {
      const original = path.join(root, "packages/backend/src/media/images.ts");
      if (args.path === "@aihot/backend/media/images" || (args.path.startsWith(".") && path.resolve(path.dirname(args.importer), args.path) === original)) return { path: path.join(here, "api/images.ts") };
    });
    b.onResolve({ filter: /^(?:@aihot\/backend\/db|\.\.?\/.*db\.ts)$/ }, args => {
      if (args.path === "@aihot/backend/db" || path.resolve(path.dirname(args.importer), args.path) === backendDb) return { path: path.join(here, "api/db.ts") };
    });
    b.onLoad({ filter: /packages[\\/]backend[\\/]src[\\/]config\.ts$/ }, async args => ({
      contents: replaceOnce(await readFile(args.path, "utf8"), 'path.resolve(import.meta.dirname, "../../..")', '"/tmp/knithot"'), loader: "ts",
    }));
    if (readOnlyApi) b.onLoad({ filter: /apps[\\/]api[\\/]src[\\/]routes[\\/]site\.ts$/ }, async args => ({
      contents: replaceOnce(replaceOnce(await readFile(args.path, "utf8"), 'import { registerFeedback } from "./feedback.ts";', ""), "registerFeedback(app);", ""), loader: "ts",
    }));
    if (edgeAdmin) b.onLoad({ filter: /packages[\\/]backend[\\/]src[\\/]admin[\\/]settings\.ts$/ }, async args => {
      const source = replaceOnce(await readFile(args.path, "utf8"), 'import sharp from "sharp";', "");
      const storage = replaceOnce(source, 'import { mkdir, writeFile } from "node:fs/promises";', `import { mkdir, writeFile } from ${JSON.stringify(path.join(here, "api/storage-files.ts"))};\nimport { imageMetadata } from ${JSON.stringify(path.join(here, "api/images.ts"))};`);
      return { contents: replaceOnce(storage, '  const meta = await sharp(input.data).metadata().catch(() => null);',
        '  const meta = await imageMetadata(input.data).catch(() => null);'), loader: "ts" };
    });
    if (edgeOg) b.onLoad({ filter: /packages[\\/]backend[\\/]src[\\/]media[\\/]og\.ts$/ }, async args => {
      let source = replaceOnce(await readFile(args.path, "utf8"), 'import satori from "satori";', "");
      source = replaceOnce(source, 'import sharp from "sharp";', `import { renderPng as renderRemotePng } from ${JSON.stringify(path.join(here, "api/render-png.ts"))};`);
      source = replaceOnce(source, '  const svg = await satori(await tree() as never, { ...size, fonts: await fonts() });', "");
      return { contents: replaceOnce(source, '  const png = await sharp(Buffer.from(svg)).png(OG_PNG).toBuffer();', '  const png = await renderRemotePng(await tree(), size);'), loader: "ts" };
    });
    if (edgeFetch) b.onLoad({ filter: /packages[\\/]backend[\\/]src[\\/]lib[\\/]http-fetch\.ts$/ }, async args => {
      const source = await readFile(args.path, "utf8");
      const start = source.indexOf("import net from");
      const end = source.indexOf("export interface GuardedFetchOptions");
      if (start < 0 || end <= start) throw new Error("Worker outbound transport boundaries changed");
      const prefix = `import { addAbortListener } from "node:events";
import { config } from "../config.ts";
import { assertPublicUrl } from "./url.ts";
import { SITE } from "@aihot/site";
import { resolvePublicAddresses } from ${JSON.stringify(path.join(here, "jobs/dns.ts"))};
export type EgressRoute = "egress" | "direct";
const undiciFetch = globalThis.fetch;
function dispatcherFor(_proxy: boolean) { return undefined; }
function proxied(_url: URL, _route: EgressRoute) { return false; }
`;
      const contents = replaceOnce(prefix + source.slice(end), "proxied(new URL(target), route) ? egressResolver() : undefined", "resolvePublicAddresses");
      return { contents, loader: "ts" };
    });
    if (edgeFetch) b.onLoad({ filter: /packages[\\/]backend[\\/]src[\\/]editorial[\\/]input\.ts$/ }, async args => {
      // Text-only editorial must not initialize a native image library. Image processing is a later adapter phase.
      const source = replaceOnce(await readFile(args.path, "utf8"), 'import { produceImage, rasterImage, SVG_PASSTHROUGH_MAX_BYTES } from "../media/images.ts";', "");
      return { contents: replaceOnce(source, '    let { body, type } = await produceImage(String(image.url), "thumb");',
        '    const { produceImage, rasterImage, SVG_PASSTHROUGH_MAX_BYTES } = await import("../media/images.ts");\n    let { body, type } = await produceImage(String(image.url), "thumb");'), loader: "ts" };
    });
    if (edgeQueues) b.onLoad({ filter: /packages[\\/]backend[\\/]src[\\/]jobs[\\/]queue\.ts$/ }, async args => {
      let source = (await readFile(args.path, "utf8")).replaceAll("\r\n", "\n");
      source = replaceOnce(source, "let boss: PgBoss | null = null;\nlet starting: Promise<PgBoss> | null = null;", `import { taskQueueState } from ${JSON.stringify(path.join(here, "jobs/queue-context.ts"))};`);
      const replaceFunction = (text, start, end, replacement) => {
        const left = text.indexOf(start), right = text.indexOf(end, left);
        if (left < 0 || right < left || text.indexOf(start, left + 1) >= 0) throw new Error(`Queue adapter target changed: ${start}`);
        return text.slice(0, left) + replacement + text.slice(right);
      };
      source = replaceFunction(source, "export async function getBoss(): Promise<PgBoss> {", "/** The longest single paid call", "export async function getBoss(): Promise<PgBoss> { return taskQueueState().boss; }\n\n");
      source = replaceFunction(source, "export async function stopBoss(): Promise<void> {", "export async function ensureQueue", "export async function stopBoss(): Promise<void> {}\n\n");
      source = replaceOnce(source, "const ensured = new Set<string>();", "const ensured = { has: (name: string) => taskQueueState().ensured.has(name), add: (name: string) => taskQueueState().ensured.add(name) };");
      source = replaceOnce(source, "  return b.send(name, data, tx ? { ...options, db: queueDb(tx) } : options);",
        '  if (name === QUEUES.group) options = { ...options, group: { id: "knithot-event-identity" } };\n  return b.send(name, data, tx ? { ...options, db: queueDb(tx) } : options);');
      return { contents: source, loader: "ts" };
    });
  } };
}
