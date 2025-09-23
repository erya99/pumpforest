// lib/solana.ts
import { Connection, PublicKey } from "@solana/web3.js";

// Public RPC ile de çalışır ama 429 riskine karşı max 2-3 çağrı yapıyoruz.
const RPC_URL = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
export const conn = new Connection(RPC_URL, { commitment: "finalized" });

// basit 429 backoff
async function retry<T>(fn: () => Promise<T>, label: string, max = 4) {
  let delay = 800;
  for (let i = 0; i < max; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("429") || msg.toLowerCase().includes("too many")) {
        console.warn(`${label} 429 aldı, ${delay}ms bekleniyor...`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw e;
    }
  }
  throw new Error(`retry(${label}) ${max} denemede başarısız`);
}

export async function getLatestBlockHash(): Promise<string> {
  const lh = await retry(() => conn.getLatestBlockhash("finalized"), "getLatestBlockhash");
  return lh.blockhash;
}

/**
 * Mint'e ait holder'ları PARSED olarak getirir.
 * Tek RPC çağrısı: getParsedProgramAccounts + memcmp(mint)
 * Dönen veri: owner (cüzdan), tokenAmount.uiAmount (bakiyenin UI karşılığı)
 * Büyük mintlerde çok hesap dönebilir; cap ile sınırlandır.
 */
export async function getHoldersByRPC(mint: string, cap = 800) {
  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"); // SPL Token Program
  const mintPk = new PublicKey(mint);

  const accounts = await retry(
    () =>
      conn.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
        filters: [
          { dataSize: 165 }, // SPL Token Account boyutu
          { memcmp: { offset: 0, bytes: mintPk.toBase58() } }, // 0-32: mint
        ],
      }),
    "getParsedProgramAccounts(mint)"
  );

  const out: { owner: string; tokenAmount: number }[] = [];
  for (const acc of accounts) {
    try {
      const parsed: any = (acc.account as any).data?.parsed?.info;
      const owner = parsed?.owner;
      const ui = parsed?.tokenAmount?.uiAmount;
      if (owner && typeof ui === "number" && ui > 0) {
        out.push({ owner: owner.toLowerCase(), tokenAmount: ui });
      }
    } catch {}
  }

  // Çok büyük listelerde performans için sınır koy
  return out.slice(0, cap);
}
