import { ServerRouter, type EntryContext } from "react-router";
import { renderToReadableStream } from "react-dom/server.edge";
import { isbot } from "isbot";
import { handleError } from "@aihot/web/lib/errors.server.ts";

export { handleError };
// Keep the transport context in the same Vite bundle as the loaders that consume it.
export { runWithCloudflareRuntime } from "./request-context.ts";
export const streamTimeout = 5_000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
): Promise<Response> {
  if (request.method.toUpperCase() === "HEAD") return new Response(null, { status: responseStatusCode, headers: responseHeaders });
  let shellRendered = false;
  const abortController = new AbortController();
  const abort = () => abortController.abort(request.signal.reason);
  if (request.signal.aborted) abort();
  else request.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => abortController.abort(new Error("SSR stream timeout")), streamTimeout);
  const onError = (error: unknown) => {
    responseStatusCode = 500;
    if (shellRendered) handleError(error, { request });
  };
  try {
    const stream = await renderToReadableStream(<ServerRouter context={routerContext} url={request.url} />, { onError, signal: abortController.signal });
    const userAgent = request.headers.get("user-agent");
    if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) await stream.allReady;
    shellRendered = true;
    responseHeaders.set("Content-Type", "text/html");
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        reader = stream.getReader();
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            controller.enqueue(chunk.value);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        } finally {
          clearTimeout(timer);
          request.signal.removeEventListener("abort", abort);
        }
      },
      async cancel(reason) {
        clearTimeout(timer);
        request.signal.removeEventListener("abort", abort);
        await reader?.cancel(reason);
      },
    });
    return new Response(body, { status: responseStatusCode, headers: responseHeaders });
  } catch (error) {
    handleError(error, { request });
    throw error;
  } finally {
    if (!shellRendered) {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", abort);
    }
  }
}
