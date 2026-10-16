// Preserve the original admin loader's session forwarding and error contract over a service binding.
import { data, redirect } from "react-router";
import { API_BASE_URL } from "./api.server.ts";
import { currentCloudflareRuntime } from "./request-context.ts";

export async function adminGet<T>(request: Request, path: string): Promise<T> {
  const runtime = currentCloudflareRuntime();
  const upstream = new Request(`${runtime?.apiOrigin ?? API_BASE_URL}${path}`, {
    headers: { accept: "application/json", cookie: request.headers.get("cookie") ?? "", "user-agent": request.headers.get("user-agent") ?? "" },
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
  });
  const res = await (runtime ? runtime.apiFetch(upstream) : fetch(upstream));
  if (res.status === 401) {
    const url = new URL(request.url);
    throw redirect(`/api/auth/login?${new URLSearchParams({ return: url.pathname + url.search })}`);
  }
  if (res.status === 404) throw data({ message: "not_found" }, { status: 404 });
  if (!res.ok) {
    let detail = `api ${res.status}`;
    try { detail = ((await res.json()) as { detail?: string }).detail ?? detail; } catch { /* Non-JSON failures keep the status. */ }
    throw data({ message: detail }, { status: res.status >= 500 ? 503 : res.status });
  }
  return await res.json() as T;
}
