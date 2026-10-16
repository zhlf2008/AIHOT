/** Workers has no OS lookup(); resolve through Cloudflare DNS before the engine's public-IP guard. */
export async function resolvePublicAddresses(host: string): Promise<string[]> {
  const records = await Promise.all(["A", "AAAA"].map(async type => {
    const url = new URL("https://cloudflare-dns.com/dns-query");
    url.searchParams.set("name", host);
    url.searchParams.set("type", type);
    const response = await fetch(url, { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error("Public DNS lookup failed");
    const data = await response.json() as { Status?: number; Answer?: Array<{ type: number; data: string }> };
    if (data.Status !== 0) throw new Error("Public DNS lookup failed");
    return (data.Answer ?? []).filter(row => row.type === 1 || row.type === 28).map(row => row.data);
  }));
  return records.flat();
}
