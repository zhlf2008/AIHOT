// Private media service: bounded HTTP work, durable rendering in a Workflow, no public endpoint.
import { CustomFont, render } from "@cf-wasm/og/workerd";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { createHash, randomUUID } from "node:crypto";
import { metadata, transform } from "./transform.ts";

type Binding = { fetch(request: Request): Promise<Response> };
type Instance = { status(): Promise<{ status: string; output?: { body?: string; type: string; key: string }; error?: unknown }> };
interface Env {
  ASSETS: Binding;
  MEDIA_CACHE: {
    get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
    getWithMetadata<T>(key: string, type: "arrayBuffer"): Promise<{ value: ArrayBuffer | null; metadata: T | null }>;
    put(key: string, value: ArrayBuffer, options?: { expirationTtl?: number; metadata?: { type: string } }): Promise<void>;
  };
  RENDER: { create(options: { id: string; params: Params }): Promise<Instance>; get(id: string): Promise<Instance> };
}
interface Params {
  kind: "og" | "image"; key: string; tree?: Parameters<typeof render>[0]; width?: number; height?: number;
  inputKey?: string; input?: string; mode?: string; vectors?: boolean;
}
const bufferOf = (body: Uint8Array) => Uint8Array.from(body).buffer;
const response = (body: ConstructorParameters<typeof Response>[0], type: string) => new Response(body, { headers: { "Content-Type": type, "Cache-Control": "private, no-store" } });
let fonts: Promise<CustomFont[]> | undefined;
async function loadFonts(env: Env) {
  fonts ??= Promise.all(([400, 700] as const).map(async weight => {
    const found = await env.ASSETS.fetch(new Request(`https://assets.internal/noto-sans-sc-${weight}.ttf`));
    if (!found.ok) throw new Error("Bundled CJK font is missing");
    return new CustomFont("Noto Sans SC", await found.arrayBuffer(), { weight, style: "normal" });
  })).catch(error => { fonts = undefined; throw error; });
  return fonts;
}
export class MediaWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    return step.do("render-and-store", { retries: { limit: 2, delay: "10 seconds" }, timeout: "2 minutes" }, async () => {
      const p = event.payload;
      let bytes: Uint8Array, type: string;
      if (p.kind === "og") {
        const result = await render(p.tree!, { width: p.width, height: p.height, fonts: await loadFonts(this.env), loadAdditionalAsset: () => [] }).asPng();
        bytes = result.image; type = "image/png";
      } else {
        const input = p.input ? Buffer.from(p.input, "base64") : await this.env.MEDIA_CACHE.get(p.inputKey!, "arrayBuffer");
        if (!input) throw new Error("Image input is not visible yet");
        const result = transform(new Uint8Array(input), p.mode!, p.vectors);
        bytes = result.body; type = result.type;
      }
      await this.env.MEDIA_CACHE.put(p.key, bufferOf(bytes), { expirationTtl: 7 * 86400, metadata: { type } });
      // Small outputs avoid KV's cross-location propagation delay. Keep the durable result below 1 MiB.
      return { key: p.key, type, ...(bytes.length <= 700_000 ? { body: Buffer.from(bytes).toString("base64") } : {}) };
    });
  }
}
async function renderDurably(env: Env, params: Params) {
  const id = `media-${params.key.replace(/[^a-z0-9]/g, "-")}`;
  let instance: Instance;
  try { instance = await env.RENDER.create({ id, params }); }
  catch (error) {
    if (!(error instanceof Error) || !/already exists/i.test(error.message)) throw error;
    instance = await env.RENDER.get(id);
  }
  for (let i = 0; i < 50; i++) {
    const state = await instance.status();
    if (state.status === "complete" && state.output) {
      if (state.output.body) return response(Buffer.from(state.output.body, "base64"), state.output.type);
      const cached = await env.MEDIA_CACHE.get(state.output.key, "arrayBuffer");
      if (cached) return response(cached, state.output.type);
    }
    if (["errored", "terminated"].includes(state.status)) throw new Error("Media workflow failed");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return new Response("Image is preparing", { status: 503, headers: { "Retry-After": "15", "Cache-Control": "no-store" } });
}
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const imageKey = /^\/image-cache\/([a-f0-9]{64})$/.exec(url.pathname)?.[1];
    const upload = /^\/uploads\/(qr-(?:wechat|feishu)-[a-f0-9]{8}\.(?:png|jpg|jpeg|webp))$/.exec(url.pathname)?.[1];
    if (request.method === "GET" && (imageKey || upload)) {
      const found = await env.MEDIA_CACHE.getWithMetadata<{ type: string }>(imageKey ? `image-v1:${imageKey}` : `upload:${upload}`, "arrayBuffer");
      return found.value ? response(found.value, found.metadata?.type ?? "application/octet-stream") : new Response("Not found", { status: 404 });
    }
    if ((url.pathname === "/resize" || url.pathname === "/metadata" || upload) && request.method === "POST") {
      const body = new Uint8Array(await request.arrayBuffer());
      if (body.length > (upload ? 2 : 15) * 1024 * 1024) return new Response("Too large", { status: 413 });
      if (url.pathname === "/metadata") return Response.json(metadata(body));
      if (upload) {
        const info = metadata(body);
        if (!["png", "jpeg", "webp"].includes(info.format ?? "") || info.width < 120 || info.height < 120) return new Response("Invalid image", { status: 400 });
        await env.MEDIA_CACHE.put(`upload:${upload}`, bufferOf(body), { metadata: { type: info.mediaType } });
        return new Response(null, { status: 204 });
      }
      const key = request.headers.get("X-Rendition-Key") ?? randomUUID().replaceAll("-", "");
      if (!/^[a-f0-9]{32,64}$/.test(key)) return new Response("Invalid key", { status: 400 });
      const params: Params = { kind: "image", key: `image-v1:${key}`, mode: url.searchParams.get("mode") ?? "thumb", vectors: url.searchParams.get("vectors") !== "false" };
      if (body.length <= 700_000) params.input = Buffer.from(body).toString("base64");
      else { params.inputKey = `input:${randomUUID()}`; await env.MEDIA_CACHE.put(params.inputKey, bufferOf(body), { expirationTtl: 3600 }); }
      return renderDurably(env, params);
    }
    if (url.pathname !== "/render" || request.method !== "POST") return new Response("Not found", { status: 404 });
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 512 * 1024) return new Response("Too large", { status: 413 });
    const input = JSON.parse(text) as Pick<Params, "tree" | "width" | "height">;
    if (!((input.width === 1200 && input.height === 630) || (input.width === 1080 && input.height === 1440))) return new Response("Invalid size", { status: 400 });
    const key = `og-v2:${createHash("sha256").update(text).digest("hex")}`;
    const hit = await env.MEDIA_CACHE.get(key, "arrayBuffer");
    return hit ? response(hit, "image/png") : renderDurably(env, { ...input, kind: "og", key });
  },
};
