import path from "node:path";
import { mkdir as mkdirLocal, writeFile as writeLocal } from "node:fs/promises";
import { mediaService } from "./media-context.ts";

function uploadName(file: string) {
  const prefix = "/tmp/knithot/data/uploads/";
  if (!file.startsWith(prefix)) throw new Error("Persistent write is outside the upload root");
  const name = file.slice(prefix.length);
  if (!/^qr-(?:wechat|feishu)-[a-f0-9]{8}\.(png|jpg|jpeg|webp)$/.test(name)) throw new Error("Invalid upload filename");
  return name;
}
export async function mkdir(_file: string, _options?: unknown) { /* Object storage needs no directories. */ }
export async function writeFile(file: string, body: Uint8Array) {
  const response = await mediaService().fetch(new Request(`https://media.internal/uploads/${uploadName(file)}`, { method: "POST", body: Uint8Array.from(body) }));
  if (!response.ok) throw new Error("Persistent image upload failed");
}
export async function hydrateUpload(name: string) {
  const file = `/tmp/knithot/data/uploads/${name}`;
  uploadName(file);
  const response = await mediaService().fetch(new Request(`https://media.internal/uploads/${name}`));
  if (response.status === 404) return;
  if (!response.ok) throw new Error("Persistent image read failed");
  await mkdirLocal(path.dirname(file), { recursive: true });
  await writeLocal(file, Buffer.from(await response.arrayBuffer()));
}
