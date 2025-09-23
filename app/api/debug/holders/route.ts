import { NextResponse } from "next/server";

export async function GET() {
  // burada kendi mock/örnek holder dizini döndürüyorsun ya da db’den çekiyorsun
  return NextResponse.json({ ids: [] }); // en azından boş GET desteklensin
}
