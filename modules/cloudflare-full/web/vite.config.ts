import path from "node:path";
import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";

const root = path.resolve(import.meta.dirname);
const app = path.resolve(root, "../../../apps/web/app");
const edgeEntry = path.resolve(import.meta.dirname, "entry.server.tsx");
const edgeApi = path.resolve(import.meta.dirname, "api.server.ts");
export default defineConfig({
  root,
  plugins: [{
    name: "cloudflare-root-and-entry",
    enforce: "pre",
    config: () => ({ root }),
    resolveId(source, importer, options) {
      if (!options?.ssr) return;
      if (/admin\.server(?:\.ts)?$/.test(source)) return path.resolve(root, "admin.server.ts");
      if (source.endsWith("/app/entry.server.tsx") || source.endsWith("\\app\\entry.server.tsx") || source.endsWith("/app/entry.server") || source.endsWith("\\app\\entry.server")) return edgeEntry;
      if (source.endsWith("/app/lib/api.server.ts") || source.endsWith("\\app\\lib\\api.server.ts") || source.endsWith("/app/lib/api.server") || source.endsWith("\\app\\lib\\api.server")) return edgeApi;
      if (importer && /[\\/]apps[\\/]web[\\/]app[\\/]/.test(importer) && (source === "../lib/api.server" || source === "./lib/api.server" || source === "./api.server.ts" || source === "./api.server")) return edgeApi;
      if (source === "@aihot/web/lib/errors.server.ts") return path.resolve(app, "lib/errors.server.ts");
    },
  }, tailwindcss(), reactRouter()],
  resolve: { alias: {
    [path.join(app, "entry.server.tsx")]: path.resolve(import.meta.dirname, "entry.server.tsx"),
    [path.join(app, "lib/api.server.ts")]: path.resolve(import.meta.dirname, "api.server.ts"),
    "@aihot/web/": `${app}${path.sep}`,
  } },
  build: { outDir: path.resolve(import.meta.dirname, ".build"), emptyOutDir: true },
});
