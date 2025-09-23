import type { Json } from "./solana";

const SOLSCAN_API =
  process.env.SOLSCAN_API ?? "https://public-api.solscan.io";
const SOLSCAN_KEY = process.env.SOLSCAN_KEY ?? "";

/** Basit GET isteği (JSON parse + unknown daraltma) */
async function getJson<T = Json>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const url = new URL(path, SOLSCAN_API);

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }

  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      ...(SOLSCAN_KEY ? { token: SOLSCAN_KEY } : {}),
    },
    // Solscan bazen agresif rate-limit uyguluyor; küçük timeout iyi olur
    // @ts-expect-error: Node fetch'te olabilir; tarayıcıda yok
    timeout: Number(process.env.SOLSCAN_TIMEOUT_MS ?? 8000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `solscan ${res.status} ${res.statusText} ${url.toString()} ${body}`
    );
  }

  const data: unknown = await res.json();
  return data as T;
}

/** Dışarıya döndüğümüz normalize tip */
export type HolderLite = { addr: string; balance: number };

/**
 * Solscan: Bir mint için holder listesi
 * public endpoint ör: /token/holders?tokenAddress=<mint>&limit=20&offset=0
 * Bazı yanıtlar { data: [...] } sarmalında gelebilir; her iki şekli de destekliyoruz.
 */
export async function getTokenHoldersByMint(
  mint: string,
  limit = 50,
  offset = 0
): Promise<HolderLite[]> {
  const raw = await getJson<Json | { data?: Json }>(
    "/token/holders",
    { tokenAddress: mint, limit, offset }
  );

  // Yanıtı diziye indirgeme (bazı sürümlerde {data:[]} sarmalı gelebilir)
  const list: unknown = Array.isArray(raw)
    ? raw
    : (typeof raw === "object" &&
       raw !== null &&
       "data" in raw &&
       Array.isArray((raw as { data?: unknown }).data))
      ? (raw as { data: unknown[] }).data
      : [];

  if (!Array.isArray(list)) return [];

  // Beklenen alanlar: address / owner / amount vb. Farklı adlar için esnek eşleme.
  const holders: HolderLite[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;

    const obj = item as Record<string, unknown>;
    const address =
      typeof obj.address === "string"
        ? obj.address
        : typeof obj.owner === "string"
        ? obj.owner
        : typeof obj.wallet === "string"
        ? obj.wallet
        : null;

    const amountRaw =
      typeof obj.amount === "number"
        ? obj.amount
        : typeof obj.balance === "number"
        ? obj.balance
        : typeof obj.uiAmount === "number"
        ? obj.uiAmount
        : typeof obj.tokenAmount === "object" &&
          obj.tokenAmount !== null &&
          typeof (obj.tokenAmount as Record<string, unknown>).uiAmount ===
            "number"
        ? ((obj.tokenAmount as Record<string, unknown>).uiAmount as number)
        : null;

    if (!address || amountRaw === null) continue;

    holders.push({
      addr: address,
      balance: Number.isFinite(amountRaw) ? (amountRaw as number) : 0,
    });
  }

  return holders;
}

/**
 * Sayfalamayı otomatik yapıp tüm holder’ları toplamak istersen:
 * (rate-limit’e dikkat; limit/offset ile kontrollü kullan)
 */
export async function getAllTokenHoldersPaged(
  mint: string,
  pageLimit = 100,
  maxPages = 50
): Promise<HolderLite[]> {
  const out: HolderLite[] = [];
  for (let i = 0; i < maxPages; i++) {
    const offset = i * pageLimit;
    const batch = await getTokenHoldersByMint(mint, pageLimit, offset);
    out.push(...batch);
    if (batch.length < pageLimit) break; // son sayfa
  }
  // uniq by addr
  const uniq = new Map<string, HolderLite>();
  for (const h of out) {
    // aynı addr varsa en büyük balance’ı tut (isteğe bağlı)
    const prev = uniq.get(h.addr);
    if (!prev || h.balance > prev.balance) uniq.set(h.addr, h);
  }
  return Array.from(uniq.values());
}
