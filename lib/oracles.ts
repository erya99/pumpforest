// lib/oracles.ts
import { getAllTokenHoldersPaged, HolderLite } from "./solscan";
import { getHoldersByRPC } from "./solana";

// Sunucuya holder listesi döndür: önce Solscan, olmazsa RPC
export type OracleHolder = { owner: string; tokenAmount: number };

export async function getAllHolders(mint: string): Promise<OracleHolder[]> {
  // 1) Solscan (daha stabil ve hızlı)
  try {
    const list: HolderLite[] = await getAllTokenHoldersPaged(
      mint,
      Number(process.env.SOLSCAN_PAGE_LIMIT ?? 200),
      Number(process.env.SOLSCAN_MAX_PAGES ?? 50)
    );
    if (list.length > 0) {
      // addr/balance -> owner/tokenAmount’a dönüştür
      return list.map((h) => ({ owner: h.addr, tokenAmount: h.balance }));
    }
  } catch {
    // yut ve RPC’ye düş
  }

  // 2) RPC fallback (sadece adres; bakiye 0)
  try {
    const addrs = await getHoldersByRPC(mint);
    if (addrs.length > 0) {
      return addrs.map((addr) => ({ owner: addr, tokenAmount: 0 }));
    }
  } catch {
    // yut
  }

  return [];
}
