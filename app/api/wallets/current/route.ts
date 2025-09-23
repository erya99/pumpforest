import { NextResponse } from "next/server";
import { getAllHolders } from "../../../../lib/oracles";

// ---- Basit in-memory cache & single-flight ----
type Cache = {
  ids: string[];
  updatedAt: number; // ms
  stale?: boolean;
};
let cache: Cache | null = null;
let inFlight: Promise<string[]> | null = null;

// ---- Ayarlar (ENV ile override edilebilir) ----
const TTL_MS = Number(process.env.WALLETS_TTL_MS ?? 30_000);
const RPC_TIMEOUT_MS = Number(process.env.RPC_TIMEOUT_MS ?? 8_000);

// Basit JSON tipi (unknown daraltmalarında yardımcı)
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("rpc-timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

// getAllHolders bazen string[] bazen {addr, balance}[] dönebilir → normalize et
function normalizeToIds(input: unknown): string[] {
  if (!Array.isArray(input) || input.length === 0) return [];
  const first = input[0];

  if (typeof first === "string") {
    return (input as string[]).filter(Boolean);
  }
  if (typeof first === "object" && first !== null && "addr" in (first as Record<string, unknown>)) {
    return (input as Array<{ addr: string }>).map((h) => h.addr).filter(Boolean);
  }
  return [];
}

async function fetchHoldersOnce(): Promise<string[]> {
  const mint = process.env.TOKEN_MINT!;
  const raw = await withTimeout(getAllHolders(mint), RPC_TIMEOUT_MS);
  const ids = normalizeToIds(raw);
  return Array.from(new Set(ids)); // uniq
}

export async function GET() {
  try {
    const now = Date.now();

    // 1) Taze cache varsa doğrudan dön
    if (cache && now - cache.updatedAt < TTL_MS) {
      return NextResponse.json({
        ok: true,
        ids: cache.ids,
        stale: !!cache.stale,
        cached: true,
        ttlMs: Math.max(0, TTL_MS - (now - cache.updatedAt)),
      });
    }

    // 2) Hâlihazırda RPC uçuşu varsa ona eklemlen
    if (inFlight) {
      try {
        const ids = await inFlight;
        cache = { ids, updatedAt: Date.now(), stale: false };
        return NextResponse.json({ ok: true, ids, stale: false, joined: true });
      } catch {
        // aşağıda stale kontrolü yapılacak
      }
    }

    // 3) Yeni single-flight RPC çağrısını başlat
    inFlight = (async () => {
      try {
        const ids = await fetchHoldersOnce();
        return ids;
      } finally {
        setTimeout(() => { inFlight = null; }, 0);
      }
    })();

    try {
      const ids = await inFlight;
      cache = { ids, updatedAt: Date.now(), stale: false };
      return NextResponse.json({ ok: true, ids, stale: false });
    } catch (e: unknown) {
      // RPC patladı → stale varsa onunla dön, yoksa 503
      if (cache && cache.ids?.length) {
        cache.stale = true;
        return NextResponse.json({ ok: true, ids: cache.ids, stale: true }, { status: 200 });
      }
      const msg = e instanceof Error ? e.message : "rpc-failed";
      return NextResponse.json({ ok: false, error: msg }, { status: 503 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "internal";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
