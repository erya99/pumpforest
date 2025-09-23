// lib/solscan.ts
export type SolscanHolder = { owner: string; tokenAmount: number };
const BASE = process.env.SOLSCAN_API_BASE || "https://public-api.solscan.io";

export async function getHoldersFromSolscan(mint: string, cap = 2000) {
  const holders: SolscanHolder[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const url = `${BASE}/token/holders?tokenAddress=${mint}&offset=${offset}&limit=${pageSize}`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) break;
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : data?.data || [];
    if (!items.length) break;

    for (const it of items) {
      const owner = String(it.owner ?? it.address ?? it.holder ?? "").toLowerCase();
      const ta = it.tokenAmount;
      let ui = Number(
        (ta && (ta.uiAmount ?? ta.uiAmountString)) ??
        it.amount ?? it.balance ?? 0
      );
      if (!ui && ta?.amount && ta?.decimals != null) {
        ui = Number(ta.amount) / 10 ** Number(ta.decimals);
      }
      if (owner && ui) holders.push({ owner, tokenAmount: ui });
    }
    if (items.length < pageSize || holders.length >= cap) break;
  }
  return holders;
}
