import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  appDirectory: "../../../apps/web/app",
  buildDirectory: ".build",
  routeDiscovery: { mode: "initial" },
  splitRouteModules: false,
} satisfies Config;
