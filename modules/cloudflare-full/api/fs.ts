import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ReadonlyAsset { path: string; base64: string }
export interface ReadonlyAssetManifest { version: number; assets: ReadonlyAsset[] }

/** Materialize the build-time allowlist into the Worker node:fs virtual /tmp volume. */
export async function mountReadonlyAssets(manifest: ReadonlyAssetManifest, root = "/tmp/knithot") {
  if (manifest.version !== 1) throw new Error("unsupported asset manifest version");
  for (const asset of manifest.assets) {
    const relative = asset.path.replaceAll("\\", "/");
    const target = path.resolve(root, relative);
    if (!relative || target === path.resolve(root) || !target.startsWith(path.resolve(root) + path.sep)) throw new Error(`invalid asset path: ${asset.path}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(asset.base64, "base64"), { flag: "w" });
  }
  return root;
}
