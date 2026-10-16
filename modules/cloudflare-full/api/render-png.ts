import { mediaService } from "./media-context.ts";

/** The original OG/poster templates render through a private WASM service instead of native Sharp. */
export async function renderPng(tree: unknown, size: { width: number; height: number }): Promise<Buffer> {
  const response = await mediaService().fetch(new Request("https://media.internal/render", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tree, ...size }),
  }));
  if (!response.ok || !response.headers.get("Content-Type")?.startsWith("image/png")) throw new Error("Share image renderer failed");
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > 10 * 1024 * 1024 || !body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error("Invalid share image representation");
  return body;
}
