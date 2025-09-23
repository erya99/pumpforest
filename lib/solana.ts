import { Connection, PublicKey } from "@solana/web3.js";

// Basit JSON tipi, RPC response parse için
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

const endpoint =
  process.env.SOLANA_RPC ??
  "https://api.mainnet-beta.solana.com";

export const connection = new Connection(endpoint, "confirmed");

/**
 * RPC çağrısı örneği: generic fetch
 */
async function fetchJson<T = Json>(url: string): Promise<T> {
  const resp: unknown = await fetch(url).then((r) => r.json());
  return resp as T;
}

/**
 * Token hesabı çözümleme örneği
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
 * RPC response decode (önce any idi)
 */
export function decodeResponse(resp: unknown) {
  if (typeof resp !== "object" || resp === null) return null;
  if (!("result" in resp)) return null;
  const result = (resp as { result: Json }).result;
  return result;
}

/**
 * Örnek: Program accounts parse
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
