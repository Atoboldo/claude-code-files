import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // Next 16: params asíncrono
  const db = getDb();

  const existe = db
    .prepare("SELECT id FROM movimientos WHERE id = ?")
    .get(Number(id));
  if (!existe) {
    return NextResponse.json(
      { error: "Movimiento no encontrado" },
      { status: 404 }
    );
  }

  const hasta = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare("UPDATE movimientos SET posponer_hasta = ? WHERE id = ?").run(
    hasta,
    Number(id)
  );

  return NextResponse.json({ ok: true, posponer_hasta: hasta });
}
