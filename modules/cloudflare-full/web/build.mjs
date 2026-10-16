import { fileURLToPath } from "node:url";
import { access, readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const cli = fileURLToPath(new URL("../../../node_modules/@react-router/dev/bin.cjs", import.meta.url));
await run(process.execPath, [cli, "build", "--config", "modules/cloudflare-full/web/vite.config.ts"], { cwd: root });
const target = fileURLToPath(new URL("./.build", import.meta.url));
const moduleRoot = fileURLToPath(new URL("..", import.meta.url));
if (!target.startsWith(moduleRoot)) throw new Error(`refusing build output outside module: ${target}`);
await access(`${target}/server/index.js`);
await access(`${target}/client`);
// A successful SSR build can still omit app utilities when its project root moves.
const assetDirectory = `${target}/client/assets`;
const styles = (await readdir(assetDirectory)).filter(name => name.endsWith(".css"));
const css = (await Promise.all(styles.map(name => readFile(`${assetDirectory}/${name}`, "utf8")))).join("\n");
for (const rule of [".flex{display:flex}", ".hidden{display:none}", ".lg\\:flex{display:flex}", ".lg\\:hidden{display:none}"]) {
  if (!css.includes(rule)) throw new Error(`Cloudflare app styles are missing a required layout rule: ${rule}`);
}
console.log(`Cloudflare web build ready at ${target}`);
