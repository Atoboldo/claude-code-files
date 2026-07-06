import { NextResponse } from "next/server";
import { crearSesion, transacciones, bancoObjetivo } from "@/lib/enablebanking";
import { guardarConexion, importarTransaccionesEb } from "@/lib/banco";

export const runtime = "nodejs";

// Enable Banking redirige aquí tras autorizar, con ?code=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (!code) {
      return NextResponse.redirect(new URL("/?banco=error", request.url));
    }

    const sesion = await crearSesion(code);
    const primera = sesion.accounts?.[0];
    const uid = typeof primera === "string" ? primera : primera?.uid;
    if (!uid) {
      return NextResponse.redirect(new URL("/?banco=sin-cuentas", request.url));
    }

    let banco = "banco";
    try {
      banco = (await bancoObjetivo()).name;
    } catch {
      // si falla el nombre, seguimos igualmente
    }
    guardarConexion(banco, sesion.session_id, uid);

    // Importación inicial: últimos 90 días.
    const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const txs = await transacciones(uid, desde);
    const nuevos = importarTransaccionesEb(txs);

    return NextResponse.redirect(
      new URL(`/?banco=conectado&nuevos=${nuevos}`, request.url)
    );
  } catch {
    return NextResponse.redirect(new URL("/?banco=error", request.url));
  }
}
