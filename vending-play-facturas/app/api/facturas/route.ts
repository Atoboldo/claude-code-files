import { NextResponse } from "next/server";
import { crearFactura } from "@/lib/facturas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();

    const movimientoId = Number(form.get("movimientoId"));
    if (!movimientoId) {
      return NextResponse.json(
        { error: "Falta movimientoId" },
        { status: 400 }
      );
    }

    const imagen = form.get("imagen");
    if (!(imagen instanceof File)) {
      return NextResponse.json(
        { error: "Falta la imagen de la factura" },
        { status: 400 }
      );
    }

    const bytes = new Uint8Array(await imagen.arrayBuffer());
    if (bytes.length === 0) {
      return NextResponse.json({ error: "Imagen vacía" }, { status: 400 });
    }

    const numStr = (key: string): number | null => {
      const v = form.get(key);
      if (v == null || v === "") return null;
      const n = Number(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };

    const proveedor = (form.get("proveedor") as string) || null;

    const factura = await crearFactura(
      movimientoId,
      bytes,
      imagen.type || "image/jpeg",
      {
        proveedor,
        base: numStr("base"),
        iva: numStr("iva"),
        total: numStr("total"),
      }
    );

    return NextResponse.json({ ok: true, factura });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
