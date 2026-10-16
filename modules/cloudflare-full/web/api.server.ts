import { data, redirect, type HeadersArgs } from "react-router";
import { logError } from "@aihot/web/lib/errors.server.ts";
import { currentCloudflareRuntime } from "./request-context.ts";

export const API_BASE_URL = "http://127.0.0.1:3001";

class ApiError extends Error {
  readonly status: number;
  readonly mergedInto: string | null;
  readonly requestId: string | null;
  constructor(status: number, mergedInto: string | null, requestId: string | null) {
    super(`api ${status}`);
    this.status = status;
    this.mergedInto = mergedInto;
    this.requestId = requestId;
  }
}

export async function apiGet<T>(path: string, init?: { signal?: AbortSignal; headers?: Record<string, string>; responseHeaders?: Headers }): Promise<T> {
  const runtime = currentCloudflareRuntime();
  const base = runtime?.apiOrigin ?? API_BASE_URL;
  try {
    const signal = init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000);
    const request = new Request(`${base}${path}`, {
      headers: { accept: "application/json", "x-aihot-ssr": "1", ...init?.headers },
      redirect: "manual",
      signal,
    });
    const res = await (runtime ? runtime.apiFetch(request) : fetch(request));
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { mergedInto?: string } | null;
      throw new ApiError(res.status, res.status === 308 ? (body?.mergedInto ?? null) : null, res.headers.get("X-Request-Id"));
    }
    res.headers.forEach((value, name) => init?.responseHeaders?.set(name, value));
    return (await res.json()) as T;
  } catch (error) {
    if (!init?.signal?.aborted && (!(error instanceof ApiError) || error.status >= 500)) {
      logError(error, { msg: "ssr api request failed", method: "GET", path,
        ...(error instanceof ApiError ? { status: error.status, upstreamRequestId: error.requestId } : {}),
      });
    }
    throw error;
  }
}

export async function loadOr404<T>(path: string, opts: { busyRedirect?: string; merged?: (id: string) => string; responseHeaders?: Headers; signal?: AbortSignal } = {}): Promise<T> {
  try {
    return await apiGet<T>(path, { responseHeaders: opts.responseHeaders, signal: opts.signal });
  } catch (error) {
    if (opts.signal?.aborted) throw error;
    if (error instanceof ApiError) {
      if (error.status === 404) throw data({ message: "not_found" }, { status: 404 });
      if (error.mergedInto && opts.merged) throw redirect(opts.merged(error.mergedInto), 308);
      if (error.status === 503 && opts.busyRedirect) throw redirect(opts.busyRedirect);
      if (error.status === 400) throw data({ message: "bad_request" }, { status: 400 });
    }
    throw data({ message: "unavailable" }, { status: 503 });
  }
}

export const BROWSER_MAX_SECONDS = 300;
export function edgeTtl(seconds: number): Record<string, string> { return { "Cache-Control": `public, s-maxage=${seconds}` }; }
export function cachedPage<T extends object>(seconds: number, value: T, upstream?: Headers) {
  const now = Date.now(); const second = Math.floor(now / 1000); let deadline = second + seconds;
  const sourceDeadline = upstream?.get("X-Accel-Expires");
  if (sourceDeadline?.startsWith("@")) deadline = Math.min(deadline, Number(sourceDeadline.slice(1)));
  if (sourceDeadline === "0" || /(?:no-cache|no-store)/i.test(upstream?.get("Cache-Control") ?? "")) deadline = second;
  const left = (until: number) => Math.floor(until - now / 1000); const browserDeadline = Math.min(deadline, second + BROWSER_MAX_SECONDS);
  return data({ ...value, expiresAt: left(browserDeadline) > 0 ? browserDeadline * 1000 : 0 }, { headers: left(deadline) > 0 ? { ...edgeTtl(left(deadline)), "X-Accel-Expires": `@${deadline}` } : { "Cache-Control": "no-cache", "X-Accel-Expires": "0" } });
}
export function pageHeaders({ loaderHeaders }: HeadersArgs) { return loaderHeaders; }
