import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  const round = await prisma.round.findFirst({ orderBy: { startedAt: "desc" }});
  if (!round) return NextResponse.json({ ok: true, round: null });
  return NextResponse.json({
    ok: true,
    round: {
      id: round.id,
      startedAt: round.startedAt,
      seed: round.seed,
      participants: JSON.parse(String(round.participants)),
      winner: round.winner,
      log: JSON.parse(String(round.log)),
    },
  });
}
