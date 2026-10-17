import { createHash } from "node:crypto";
import { guardedFetch } from "@aihot/backend/lib/http-fetch";
import { upstreamAllowed, recordUpstream } from "@aihot/backend/media/upstream";
import { mediaService } from "./media-context.ts";

export const SVG_PASSTHROUGH_MAX_BYTES = 128 * 1024;
export class ImageBudgetExceeded extends Error {}
type PreparedImage = { body: Buffer; type: string };
async function prepared(response: Response): Promise<PreparedImage> {
  if (!response.ok) throw new Error(`Image service ${response.status}`);
  return { body: Buffer.from(await response.arrayBuffer()), type: response.headers.get("Content-Type") ?? "application/octet-stream" };
}
export async function produceImage(url: string, mode: string): Promise<PreparedImage> {
  const key = createHash("sha256").update(`${mode}|${url}`).digest("hex");
  const service = mediaService();
  const cached = await service.fetch(new Request(`https://media.internal/image-cache/${key}`));
  if (cached.ok) return prepared(cached);
  if (cached.status !== 404) throw new Error("Image cache is unavailable");
  const allowed = upstreamAllowed();
  if (!allowed.ok) throw new ImageBudgetExceeded(allowed.reason);
  const original = await guardedFetch(url, { timeoutMs: 20_000, maxBytes: 15 * 1024 * 1024, headers: { accept: "image/avif,image/webp,image/*,*/*;q=0.8" } });
  recordUpstream(original.body.length);
  if (original.status !== 200) throw new Error(`upstream ${original.status}`);
  return prepared(await service.fetch(new Request(`https://media.internal/resize?mode=${encodeURIComponent(mode)}`, {
    method: "POST", headers: { "X-Rendition-Key": key, "Content-Type": original.headers.get("content-type") ?? "application/octet-stream" }, body: Uint8Array.from(original.body),
  })));
}
export async function resizeImage(body: Buffer, _type: string, mode: string): Promise<PreparedImage> {
  return prepared(await mediaService().fetch(new Request(`https://media.internal/resize?mode=${encodeURIComponent(mode)}`, { method: "POST", body: Uint8Array.from(body) })));
}
export async function rasterImage(body: Buffer, _type: string, mode: string): Promise<PreparedImage> {
  return prepared(await mediaService().fetch(new Request(`https://media.internal/resize?mode=${encodeURIComponent(mode)}&vectors=false`, { method: "POST", body: Uint8Array.from(body) })));
}
/** Edge keeps original animated bytes, including frame timing and transparency. */
export async function convertAnimated(_url: string, _mode: string) { return 0; }
export async function imageMetadata(body: Buffer): Promise<{ format: string; width: number; height: number }> {
  const response = await mediaService().fetch(new Request("https://media.internal/metadata", { method: "POST", body: Uint8Array.from(body) }));
  if (!response.ok) throw new Error("Invalid image metadata");
  return await response.json() as { format: string; width: number; height: number };
}
