import { NextResponse } from "next/server";
import { transacciones } from "@/lib/enablebanking";
import { conexionActual, importarTransaccionesEb } from "@/lib/banco";

export const runtime = "nodejs";

export async function POST() {
  const conexion = conexionActual();
  if (!conexion || !conexion.account_id) {
    return NextResponse.json(
      { error: "No hay ninguna cuenta conectada" },
      { status: 400 }
    );
  }
  try {
    const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const txs = await transacciones(conexion.account_id, desde);
    const importados = importarTransaccionesEb(txs);
    return NextResponse.json({ ok: true, importados });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
