import { NextResponse } from "next/server";
import path from "node:path";
import fsp from "node:fs/promises";
import { getDb } from "@/lib/db";
import type { Factura } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // Next 16: params es asíncrono
  const db = getDb();
  const factura = db
    .prepare("SELECT * FROM facturas WHERE id = ?")
    .get(Number(id)) as Factura | undefined;

  if (!factura) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 }
    );
  }

  try {
    const abs = path.join(process.cwd(), factura.pdf_path);
    const bytes = await fsp.readFile(abs);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${factura.numero}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "El PDF no está en disco" },
      { status: 404 }
    );
  }
}
