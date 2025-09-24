import { NextResponse } from "next/server";
import { getAllHolders } from "../../../../lib/oracles";

// ---------------- In-memory cache & single-flight ----------------
type Cache = {
  ids: string[];
  updatedAt: number; // ms since epoch
  stale?: boolean;
};
let cache: Cache | null = null;
let inFlight: Promise<string[]> | null = null;

// ---------------- Tunables (ENV ile override edilebilir) --------
const TTL_MS = Number(process.env.WALLETS_TTL_MS ?? 30_000);      // 30s
const RPC_TIMEOUT_MS = Number(process.env.RPC_TIMEOUT_MS ?? 8_000); // 8s

// ---------------- Utils -----------------------------------------
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("rpc-timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

// getAllHolders genelde { owner, tokenAmount }[] döner; ama esneklik için normalize edelim
function normalizeToIds(input: unknown): string[] {
  if (!Array.isArray(input) || input.length === 0) return [];
  const first = input[0];

  // string[]
  if (typeof first === "string") {
    return (input as string[]).filter(Boolean);
  }
  // { owner: string }[]
  if (typeof first === "object" && first !== null && "owner" in (first as Record<string, unknown>)) {
    return (input as Array<{ owner: string }>).map((h) => h.owner).filter(Boolean);
  }
  // { addr: string }[] (her ihtimale karşı)
  if (typeof first === "object" && first !== null && "addr" in (first as Record<string, unknown>)) {
    return (input as Array<{ addr: string }>).map((h) => h.addr).filter(Boolean);
  }
  return [];
}

async function fetchHoldersOnce(): Promise<string[]> {
  const mint = process.env.TOKEN_MINT!;
  const raw = await withTimeout(getAllHolders(mint), RPC_TIMEOUT_MS);
  const ids = normalizeToIds(raw);
  // uniq
  return Array.from(new Set(ids));
}

// ---------------- Route -----------------------------------------
export async function GET() {
  try {
    const now = Date.now();

    // 1) Taze cache varsa ve boş değilse doğrudan dön
    if (cache && now - cache.updatedAt < TTL_MS && cache.ids.length > 0) {
      return NextResponse.json({
        ok: true,
        ids: cache.ids,
        stale: !!cache.stale,
        cached: true,
        ttlMs: Math.max(0, TTL_MS - (now - cache.updatedAt)),
      });
    }

    // 2) Single-flight: aynı anda tek upstream çağrı
    if (!inFlight) {
      inFlight = (async () => {
        try {
          const ids = await fetchHoldersOnce();
          // 🔑 Boş sonucu cache'leme (geçici boşluk/limit durumlarında sayacı gereksiz sıfırlamamak için)
          if (ids.length > 0) {
            cache = { ids, updatedAt: Date.now(), stale: false };
          }
          return ids;
        } finally {
          // uçuş tamamlanınca slotu boşalt
          setTimeout(() => { inFlight = null; }, 0);
        }
      })();
    }

    try {
      const ids = await inFlight;

      if (ids.length > 0) {
        // cache üstte set edildi
        return NextResponse.json({ ok: true, ids, stale: false });
      }

      // Upstream boş döndü → daha önce iyi cache varsa onu stale ver
      if (cache && cache.ids.length > 0) {
        cache.stale = true;
        return NextResponse.json({ ok: true, ids: cache.ids, stale: true }, { status: 200 });
      }

      // Hiç veri yok
      return NextResponse.json({ ok: true, ids: [], stale: false }, { status: 200 });
    } catch (e: unknown) {
      // RPC hatası → varsa son iyi cache'i kullan
      if (cache && cache.ids.length > 0) {
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
