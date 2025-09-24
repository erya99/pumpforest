import { getHoldersByRPC } from "./solana";
import { getAllTokenHoldersPaged, HolderLite } from "./solscan";

type OracleHolder = { owner: string; tokenAmount: number };

/**
 * Tüm holder’ları çek (RPC veya Solscan)
 */
export async function getAllHolders(mint: string): Promise<OracleHolder[]> {
  try {
    // Solscan kullanmak istersen:
    const holders: HolderLite[] = await getAllTokenHoldersPaged(mint, 100, 50);

    return holders.map((h) => ({
      owner: h.addr,
      tokenAmount: h.balance,
    }));
  } catch (e) {
    // RPC fallback
    const rpcHolders: string[] = await getHoldersByRPC(mint);
    return rpcHolders.map((addr) => ({
      owner: addr,
      tokenAmount: 0, // RPC ile balance gelmiyorsa 0 bırak
    }));
  }
}
