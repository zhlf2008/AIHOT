import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const OUT = path.join(HERE, ".build", "asset-files.json");
const MAX_BYTES = 512 * 1024;

const rules = [
  ["industry/topics.json", false],
  ["industry/prompts", true],
  ["site/changelog.json", false],
  ["site/pages", true],
  ["site/public", true],
  ["site/brand", true],
];
const textExt = new Set([".json", ".md", ".txt", ".svg", ".tsx", ".webmanifest"]);
const skip = (relative) => relative.split("/").some((part) => part === ".data" || part === ".env" || part.startsWith(".env.")) || relative.includes("/fonts/") || relative.endsWith(".woff") || relative.endsWith(".woff2") || relative.endsWith(".ttf");

async function filesUnder(relative, recursive) {
  const absolute = path.join(ROOT, relative);
  const info = await stat(absolute);
  if (info.isFile()) return [relative];
  const out = [];
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    const child = path.posix.join(relative.replaceAll(path.sep, "/"), entry.name);
    if (entry.isDirectory() && recursive) out.push(...await filesUnder(child, true));
    else if (entry.isFile()) out.push(child);
  }
  return out;
}

export async function buildAssetManifest() {
  const names = (await Promise.all(rules.map(([name, recursive]) => filesUnder(name, recursive)))).flat().sort();
  const assets = [];
  for (const relative of names) {
    if (skip(relative)) continue;
    const extension = path.extname(relative).toLowerCase();
    if (!textExt.has(extension) && !relative.startsWith("site/brand/")) continue;
    const data = await readFile(path.join(ROOT, relative));
    if (data.byteLength > MAX_BYTES) continue;
    assets.push({ path: relative, base64: data.toString("base64") });
  }
  return { version: 1, generatedAt: new Date().toISOString(), assets };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(await buildAssetManifest(), null, 2)}\n`);
  console.log(`wrote ${OUT}`);
}
