// lib/oracles.ts
import { getHoldersByRPC, getLatestBlockHash as _getLatestBlockHash } from "./solana";

/** Tüm holder’ları RPC’den (parsed) getirir — USD filtresi YOK, Solscan YOK */
export async function getAllHolders(mint: string) {
  const raw = await getHoldersByRPC(mint);

  // tekilleştir (aynı owner'ın birden çok token hesabı olabilir → en büyük bakiyeyi tut)
  const byAddr = new Map<string, number>();
  for (const h of raw) {
    const prev = byAddr.get(h.owner) || 0;
    if (h.tokenAmount > prev) byAddr.set(h.owner, h.tokenAmount);
  }

  return Array.from(byAddr.entries()).map(([addr, balance]) => ({ addr, balance }));
}

export const getLatestBlockHash = _getLatestBlockHash;
