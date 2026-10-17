import type { BuildOptions, Plugin } from "esbuild";
export const workerBuildOptions: BuildOptions;
export function platformPlugin(options?: { readOnlyApi?: boolean; edgeFetch?: boolean; edgeQueues?: boolean; edgeAdmin?: boolean; edgeOg?: boolean; edgeImages?: boolean }): Plugin;
