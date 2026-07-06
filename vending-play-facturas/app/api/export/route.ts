import { NextResponse } from "next/server";
import path from "node:path";
import fsp from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { movimientosDelMes, facturasDelMes, MESES } from "@/lib/facturas";

export const runtime = "nodejs";

const EUR = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mes = searchParams.get("mes"); // YYYY-MM
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json(
      { error: "Parámetro 'mes' inválido (usa YYYY-MM)" },
      { status: 400 }
    );
  }

  const anio = Number(mes.slice(0, 4));
  const numMes = Number(mes.slice(5, 7));
  const movs = movimientosDelMes(mes);
  const facturas = facturasDelMes(anio, numMes);

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold);

  // ---- Portada resumen ----
  const page = out.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 40;
  let y = height - margin;

  page.drawText("VENDING PLAY", { x: margin, y, size: 20, font: fontBold });
  y -= 26;
  page.drawText(`Resumen de ${MESES[numMes - 1]} ${anio}`, {
    x: margin,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 30;

  let ingresos = 0;
  let gastosConFactura = 0;
  let gastosSinFactura = 0;

  page.drawText("Nº Factura", { x: margin, y, size: 9, font: fontBold });
  page.drawText("Fecha", { x: margin + 110, y, size: 9, font: fontBold });
  page.drawText("Concepto", { x: margin + 170, y, size: 9, font: fontBold });
  page.drawText("Importe", { x: width - margin - 70, y, size: 9, font: fontBold });
  y -= 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 14;

  for (const m of movs) {
    if (m.tipo === "ingreso") ingresos += m.importe;
    else if (m.factura) gastosConFactura += Math.abs(m.importe);
    else gastosSinFactura += Math.abs(m.importe);

    const etiqueta = m.factura
      ? m.factura.numero
      : m.tipo === "ingreso"
        ? "(ingreso)"
        : "SIN FACTURA";
    const color = !m.factura && m.tipo === "gasto" ? rgb(0.85, 0.15, 0.15) : rgb(0, 0, 0);

    page.drawText(etiqueta, { x: margin, y, size: 8, font, color });
    page.drawText(m.fecha.slice(5), { x: margin + 110, y, size: 8, font });
    page.drawText(recorta(m.concepto, 46), { x: margin + 170, y, size: 8, font });
    page.drawText(EUR.format(m.importe), {
      x: width - margin - 70,
      y,
      size: 8,
      font,
    });
    y -= 13;
    if (y < margin + 80) break; // una página de resumen basta para el MVP
  }

  y -= 10;
  page.drawLine({
    start: { x: margin, y: y + 4 },
    end: { x: width - margin, y: y + 4 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 8;
  const totales = [
    `Ingresos: ${EUR.format(ingresos)}`,
    `Gastos con factura: ${EUR.format(gastosConFactura)}`,
    `Gastos SIN factura: ${EUR.format(gastosSinFactura)}`,
    `Facturas adjuntas: ${facturas.length}`,
  ];
  for (const t of totales) {
    page.drawText(t, { x: margin, y, size: 10, font: fontBold });
    y -= 15;
  }

  // ---- Adjuntar cada PDF de factura ----
  for (const f of facturas) {
    try {
      const abs = path.join(process.cwd(), f.pdf_path);
      const bytes = await fsp.readFile(abs);
      const src = await PDFDocument.load(bytes);
      const paginas = await out.copyPages(src, src.getPageIndices());
      paginas.forEach((p) => out.addPage(p));
    } catch {
      // Si falta algún PDF en disco, lo saltamos sin romper la exportación.
    }
  }

  const pdfBytes = await out.save();
  const ab = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(ab).set(pdfBytes);
  return new NextResponse(ab, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="VendingPlay-${mes}.pdf"`,
    },
  });
}

function recorta(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
