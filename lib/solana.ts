import {
  Connection,
  PublicKey,
  ParsedAccountData,
} from "@solana/web3.js";

// Basit JSON tipi (gerekirse)
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

const endpoint =
  process.env.SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

export const connection = new Connection(endpoint, "confirmed");

// ----------------- Yardımcılar -----------------
export async function getParsedAccount(pubkey: string) {
  const key = new PublicKey(pubkey);
  const acc = await connection.getParsedAccountInfo(key);
  return acc.value;
}

export function decodeResponse(resp: unknown) {
  if (typeof resp !== "object" || resp === null) return null;
  if (!("result" in resp)) return null;
  const result = (resp as { result: Json }).result;
  return result;
}

// ----------------- DOĞRU HOLDER SORGUSU -----------------
/**
 * Mint'e ait token hesaplarını Token Program üzerinde filtreleyip,
 * parsed info içinden "owner" (cüzdan) adreslerini çıkarır.
 */
export async function getHoldersByRPC(mint: string): Promise<string[]> {
  const mintKey = new PublicKey(mint);
  // SPL Token Program ID
  const TOKEN_PROGRAM_ID = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
  );

  // Token account layout: mint offset'i 0, data size 165
  const accounts = await connection.getParsedProgramAccounts(
    TOKEN_PROGRAM_ID,
    {
      filters: [
        { dataSize: 165 },
        { memcmp: { offset: 0, bytes: mintKey.toBase58() } },
      ],
    }
  );

  const owners: string[] = [];
  for (const acc of accounts) {
    const data = acc.account.data as ParsedAccountData;
    if (
      data?.program === "spl-token" &&
      data?.parsed?.info &&
      typeof data.parsed.info.owner === "string"
    ) {
      owners.push(data.parsed.info.owner);
    }
  }

  // Tekilleştir
  return Array.from(new Set(owners));
}

export async function getProgramAccounts(programId: string) {
  const pid = new PublicKey(programId);
  const accounts = await connection.getParsedProgramAccounts(pid);
  return accounts;
}

export async function getLatestBlockHash() {
  return connection.getLatestBlockhash("finalized");
}
