// The edge equivalent of apps/web/server.ts pageResponse: one deadline for HTML and navigation.
const BROWSER_MAX_SECONDS = 300;
export function normalizePageRequest(request: Request): Request {
  const url = new URL(request.url);
  const pathname = decodeURIComponent(url.pathname).replace(/\.data$/, "");
  const publicRead = ["GET", "HEAD"].includes(request.method) && !/^\/admin(?:\/|$)/i.test(pathname);
  if (!publicRead || !url.pathname.endsWith(".data") || !url.searchParams.has("_routes")) return request;
  url.searchParams.delete("_routes");
  return new Request(url, request);
}

export function pageResponse(request: Request, response: Response, now = Date.now()): Response {
  const url = new URL(request.url);
  const pathname = decodeURIComponent(url.pathname).replace(/\.data$/, "");
  const publicRead = ["GET", "HEAD"].includes(request.method) && !/^\/admin(?:\/|$)/i.test(pathname);
  const headers = new Headers(response.headers);
  if (url.pathname.endsWith(".data") && headers.get("Content-Type") === "text/x-script") headers.set("Content-Type", "text/plain; charset=utf-8");
  const cc = headers.get("Cache-Control") ?? "";
  if (!publicRead || response.status !== 200 || headers.has("Set-Cookie") || !cc || /(?:private|no-store)/i.test(cc)) {
    headers.delete("Expires");
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Accel-Expires", "0");
  } else {
    const second = Math.floor(now / 1000);
    const shared = Number(cc.match(/(?:^|,)\s*s-maxage=(\d+)/i)?.[1] ?? 0);
    const expires = headers.get("X-Accel-Expires") ?? `@${second + shared}`;
    const seconds = /(?:^|,)\s*no-cache(?:,|$)/i.test(cc) || expires === "0" ? 0 : Math.max(0, Math.min(shared, Number(expires.slice(1)) - second));
    headers.set("Date", new Date(now).toUTCString());
    headers.set("X-Accel-Expires", seconds > 0 ? expires : "0");
    headers.set("Cache-Control", seconds > 0 ? `public, max-age=${Math.min(seconds, BROWSER_MAX_SECONDS)}, s-maxage=${seconds}, must-revalidate` : "no-cache");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
