import { Connection, PublicKey } from "@solana/web3.js";

// Basit JSON tipi, RPC response parse için
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

// RPC endpoint ve bağlantı
const endpoint =
  process.env.SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

export const connection = new Connection(endpoint, "confirmed");

/**
 * Token hesabı çözümleme
 */
export async function getParsedAccount(pubkey: string) {
  try {
    const key = new PublicKey(pubkey);
    const acc = await connection.getParsedAccountInfo(key);
    return acc.value;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    throw new Error(`getParsedAccount failed: ${msg}`);
  }
}

/**
 * RPC yanıtını decode etme (any → unknown + Json)
 */
export function decodeResponse(resp: unknown) {
  if (typeof resp !== "object" || resp === null) return null;
  if (!("result" in resp)) return null;
  const result = (resp as { result: Json }).result;
  return result;
}

/**
 * Program accounts parse etme
 */
export async function getProgramAccounts(programId: string) {
  try {
    const pid = new PublicKey(programId);
    const accounts = await connection.getParsedProgramAccounts(pid);
    return accounts;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    throw new Error(`getProgramAccounts failed: ${msg}`);
  }
}

/**
 * Holder'ları doğrudan RPC'den çekmek için fonksiyon
 */
export async function getHoldersByRPC(mint: string): Promise<string[]> {
  try {
    const mintKey = new PublicKey(mint);
    const accounts = await connection.getParsedProgramAccounts(mintKey);
    return accounts.map((acc) => acc.pubkey.toBase58());
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    throw new Error(`getHoldersByRPC failed: ${msg}`);
  }
}

/**
 * En son blok hash’i almak için fonksiyon
 */
export async function getLatestBlockHash() {
  try {
    return await connection.getLatestBlockhash("finalized");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    throw new Error(`getLatestBlockHash failed: ${msg}`);
  }
}
