import { AsyncLocalStorage } from "node:async_hooks";

export type CloudflareRequestRuntime = {
  apiOrigin: string;
  apiFetch: (request: Request) => Promise<Response>;
};

const storage = new AsyncLocalStorage<CloudflareRequestRuntime>();

export function runWithCloudflareRuntime<T>(runtime: CloudflareRequestRuntime, fn: () => T): T {
  return storage.run(runtime, fn);
}

export function currentCloudflareRuntime(): CloudflareRequestRuntime | undefined {
  return storage.getStore();
}
