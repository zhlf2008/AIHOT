import { AsyncLocalStorage } from "node:async_hooks";
type MediaService = { fetch(request: Request): Promise<Response> };
const current = new AsyncLocalStorage<MediaService | undefined>();
export function withMediaService<T>(service: MediaService | undefined, fn: () => Promise<T>) { return current.run(service, fn); }
export function mediaService() {
  const service = current.getStore();
  if (!service) throw new Error("Media service is not configured");
  return service;
}
