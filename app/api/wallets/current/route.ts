import { NextResponse } from "next/server";
import { getAllHolders } from "../../../../lib/oracles"; // mevcut fonksiyonun

// ---------------- In-memory Cache & Single-Flight ----------------
type Cache = {
  ids: string[];
  updatedAt: number; // ms
  stale?: boolean;
};
let cache: Cache | null = null;
let inFlight: Promise<string[]> | null = null;

// ---------------- Tunables (ENV ile override edilebilir) --------
const TTL_MS = Number(process.env.WALLETS_TTL_MS ?? 30_000);      // 30s
const RPC_TIMEOUT_MS = Number(process.env.RPC_TIMEOUT_MS ?? 8_000); // 8s

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("rpc-timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

// getAllHolders bazı ortamlarda string[],
// bazılarında {addr:string; balance:number}[] dönebiliyor.
// Burada normalize ediyoruz:
function normalizeToIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  if (input.length === 0) return [];
  const first = input[0];

  // string[] yolu
  if (typeof first === "string") {
    return (input as string[]).filter(Boolean);
  }

  // {addr:string}[] yolu
  if (typeof first === "object" && first && "addr" in (first as any)) {
    return (input as Array<{ addr: string }>).map((h) => h.addr).filter(Boolean);
  }

  // bilinmeyen şekil
  return [];
}

async function fetchHoldersOnce(): Promise<string[]> {
  const mint = process.env.TOKEN_MINT!;
  const raw = await withTimeout(getAllHolders(mint), RPC_TIMEOUT_MS);
  const ids = normalizeToIds(raw);
  // tekrar edenleri temizle
  return Array.from(new Set(ids));
}

export async function GET() {
  try {
    const now = Date.now();

    // 1) Cache taze ise doğrudan dön
    if (cache && now - cache.updatedAt < TTL_MS) {
      return NextResponse.json({
        ok: true,
        ids: cache.ids,
        stale: !!cache.stale,
        cached: true,
        ttlMs: TTL_MS - (now - cache.updatedAt),
      });
    }

    // 2) Hâlihazırda bir RPC çağrısı varsa ona eklemlen
    if (inFlight) {
      try {
        const ids = await inFlight;
        cache = { ids, updatedAt: Date.now(), stale: false };
        return NextResponse.json({ ok: true, ids, stale: false, joined: true });
      } catch {
        // inFlight patlarsa stale kontrolüne düşeceğiz
      }
    }

    // 3) Yeni RPC çağrısını başlat (single-flight)
    inFlight = (async () => {
      try {
        const ids = await fetchHoldersOnce();
        return ids;
      } finally {
        // iş bittiğinde single-flight slotunu serbest bırak
        setTimeout(() => { inFlight = null; }, 0);
      }
    })();

    try {
      const ids = await inFlight;
      cache = { ids, updatedAt: Date.now(), stale: false };
      return NextResponse.json({ ok: true, ids, stale: false });
    } catch (e: any) {
      // RPC başarısız → stale varsa onu 200 ile döndür
      if (cache && cache.ids?.length) {
        cache.stale = true;
        return NextResponse.json({ ok: true, ids: cache.ids, stale: true }, { status: 200 });
      }
      return NextResponse.json({ ok: false, error: e?.message ?? "rpc-failed" }, { status: 503 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "internal" }, { status: 500 });
  }
}
