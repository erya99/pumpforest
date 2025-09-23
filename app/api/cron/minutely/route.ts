import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getAllHolders, getLatestBlockHash } from "../../../../lib/oracles";
import { simulateBattle } from "../../../../lib/sim";
import fs from "fs";
import path from "path";

let running = false;

export async function POST() {
  if (running) return NextResponse.json({ ok: false, msg: "busy" }, { status: 429 });
  running = true;
  try {
    const MINT = process.env.TOKEN_MINT!;
    const holders = await getAllHolders(MINT);
    const participants = holders.map((h) => h.addr);
    const seed = await getLatestBlockHash();

    if (participants.length < 2) {
      const r = await prisma.round.create({
        data: {
          seed,
          participants: JSON.stringify(participants),
          winner: null,
          log: JSON.stringify(["Not enough participants"]),
        },
      });
      return NextResponse.json({ ok: true, roundId: r.id, participants: participants.length });
    }

    const { winner, log } = simulateBattle(participants, seed);

    const saved = await prisma.round.create({
      data: {
        seed,
        participants: JSON.stringify(participants),
        winner,
        log: JSON.stringify(log),
      },
    });
    return NextResponse.json({ ok: true, roundId: saved.id, winner, count: participants.length });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  } finally {
    running = false;
  }
}
