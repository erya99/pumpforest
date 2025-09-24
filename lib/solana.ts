import {
  Connection,
  PublicKey,
  ParsedAccountData,
} from "@solana/web3.js";

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

/**
 * Mint'e ait token hesaplarını RPC üzerinden çeker.
 * - Yalnızca state=initialized olanları alır.
 * - Bakiyesi 0 olanları filtreler.
 * - Tekilleştirilmiş owner adresleri döner.
 */
export async function getHoldersByRPC(mint: string): Promise<string[]> {
  const mintKey = new PublicKey(mint);
  const TOKEN_PROGRAM_ID = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
  );

  const accounts = await connection.getParsedProgramAccounts(
    TOKEN_PROGRAM_ID,
    {
      filters: [
        { dataSize: 165 }, // SPL Token Account boyutu
        { memcmp: { offset: 0, bytes: mintKey.toBase58() } }, // mint filtresi
      ],
    }
  );

  const owners = new Set<string>();

  for (const acc of accounts) {
    const data = acc.account.data as ParsedAccountData;
    if (!data || data.program !== "spl-token") continue;
    const info = (data.parsed as any)?.info;
    if (!info) continue;

    // yalnızca aktif hesaplar
    if (info.state !== "initialized") continue;

    // bakiyeyi kontrol et
    const amountStr: string | undefined = info?.tokenAmount?.amount;
    if (!amountStr) continue;

    let isZero = false;
    try {
      const amt = String(amountStr).trim();
      if (amt === "0" || /^0+$/.test(amt)) {
        isZero = true;
      } else if (typeof BigInt !== "undefined") {
        if (BigInt(amt) === BigInt(0)) isZero = true;
      }
    } catch {
      isZero = true;
    }
    if (isZero) continue;

    const owner: string | undefined = info.owner;
    if (typeof owner === "string" && owner.length > 0) {
      owners.add(owner);
    }
  }

  return Array.from(owners);
}

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

export async function getProgramAccounts(programId: string) {
  const pid = new PublicKey(programId);
  const accounts = await connection.getParsedProgramAccounts(pid);
  return accounts;
}

export async function getLatestBlockHash() {
  return connection.getLatestBlockhash("finalized");
}
