declare module "*asset-files.json" {
  const manifest: { version: number; assets: Array<{ path: string; base64: string }> };
  export default manifest;
}
