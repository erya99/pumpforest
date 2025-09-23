// app/api/writeWinner/route.ts
import { NextResponse } from "next/server";
import { promises as fsp } from "fs";
import path from "path";

export const runtime = "nodejs";         // fs için gerekli
export const dynamic = "force-dynamic";  // cache olmasın

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const { winner, roundId = "-", seed = "" } = body || {};

    if (!winner || typeof winner !== "string") {
      return NextResponse.json({ ok: false, error: "missing winner" }, { status: 400 });
    }

    const logDir = path.join(process.cwd(), "logs");
    const filePath = path.join(logDir, "winners.txt");
    const line = `${new Date().toISOString()} | Round ${roundId} | SimWinner: ${winner} | seed=${seed}\n`;

    await fsp.mkdir(logDir, { recursive: true });
    await fsp.appendFile(filePath, line, "utf-8");

    console.log("[writeWinner] ->", filePath, line.trim());
    return NextResponse.json({ ok: true, file: filePath });
  } catch (e: any) {
    console.error("[writeWinner:error]", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "write_failed" }, { status: 500 });
  }
}
