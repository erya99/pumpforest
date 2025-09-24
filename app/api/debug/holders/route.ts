import { NextResponse } from "next/server";
import { getAllHolders } from "../../../../lib/oracles";

// normalize helper
function toIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  if (input.length === 0) return [];
  const f = input[0];

  if (typeof f === "string") return (input as string[]).filter(Boolean);
  if (typeof f === "object" && f && "owner" in (f as any))
    return (input as Array<{ owner: string }>).map((x) => x.owner).filter(Boolean);
  if (typeof f === "object" && f && "addr" in (f as any))
    return (input as Array<{ addr: string }>).map((x) => x.addr).filter(Boolean);
  return [];
}

export async function GET() {
  const mint = process.env.TOKEN_MINT!;
  try {
    const raw = await getAllHolders(mint);
    const ids = Array.from(new Set(toIds(raw))); // uniq
    return NextResponse.json({
      ok: true,
      count: ids.length,
      sample: ids.slice(0, 5),
      ids,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
