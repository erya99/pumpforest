import { getHoldersByRPC } from "./solana";
import { getAllTokenHoldersPaged, HolderLite } from "./solscan";

export type OracleHolder = { owner: string; tokenAmount: number };

export async function getAllHolders(mint: string): Promise<OracleHolder[]> {
  // 1) RPC (doğru ve limitle daha sağlam)
  try {
    const addrs = await getHoldersByRPC(mint);
    if (addrs.length > 0) {
      return addrs.map((addr) => ({ owner: addr, tokenAmount: 0 }));
    }
  } catch (e) {
    // console.error("RPC holders failed", e);
  }

  // 2) Solscan fallback (rate-limit olabilir)
  try {
    const list: HolderLite[] = await getAllTokenHoldersPaged(
      mint,
      Number(process.env.SOLSCAN_PAGE_LIMIT ?? 200),
      Number(process.env.SOLSCAN_MAX_PAGES ?? 20)
    );
    if (list.length > 0) {
      return list.map((h) => ({ owner: h.addr, tokenAmount: h.balance }));
    }
  } catch (e) {
    // console.error("Solscan holders failed", e);
  }

  return [];
}
