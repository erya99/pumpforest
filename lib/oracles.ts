import { getHoldersByRPC } from "./solana";
import { getAllTokenHoldersPaged, HolderLite } from "./solscan";

export type OracleHolder = { owner: string; tokenAmount: number };

/**
 * Holder listesini getir:
 * 1) RPC (gerçek zamanlı ve sıfır bakiyeleri filtrelenmiş)
 * 2) Solscan fallback (rate-limit olabilir)
 */
export async function getAllHolders(mint: string): Promise<OracleHolder[]> {
  // 1) RPC — tercih edilen kaynak
  try {
    const addrs = await getHoldersByRPC(mint);
    if (addrs.length > 0) {
      return addrs.map((addr) => ({ owner: addr, tokenAmount: 0 }));
    }
  } catch {
    // sessizce Solscan'e düş
  }

  // 2) Solscan fallback
  try {
    const list: HolderLite[] = await getAllTokenHoldersPaged(
      mint,
      Number(process.env.SOLSCAN_PAGE_LIMIT ?? 200),
      Number(process.env.SOLSCAN_MAX_PAGES ?? 20)
    );
    if (list.length > 0) {
      return list.map((h) => ({ owner: h.addr, tokenAmount: h.balance }));
    }
  } catch {
    // sessizce boş dön
  }

  return [];
}
