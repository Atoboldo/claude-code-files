import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDb } from "./db";
import type { Factura, Movimiento, MovimientoConFactura } from "./types";

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const FACTURAS_DIR = path.join(process.cwd(), "facturas");

/** Carpeta de un mes concreto: facturas/2026/07-julio */
export function carpetaMes(anio: number, mes: number): string {
  const nombreMes = `${String(mes).padStart(2, "0")}-${MESES[mes - 1]}`;
  return path.join(FACTURAS_DIR, String(anio), nombreMes);
}

/** Siguiente número correlativo del mes: VP-2026-07-001 */
export function siguienteNumero(anio: number, mes: number): string {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM facturas WHERE anio = ? AND mes = ?")
    .get(anio, mes) as { n: number };
  const secuencia = String(row.n + 1).padStart(3, "0");
  return `VP-${anio}-${String(mes).padStart(2, "0")}-${secuencia}`;
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Movimientos de un mes (YYYY-MM) con su factura asociada si la tienen. */
export function movimientosDelMes(mes: string): MovimientoConFactura[] {
  const db = getDb();
  const movs = db
    .prepare(
      "SELECT * FROM movimientos WHERE substr(fecha, 1, 7) = ? ORDER BY fecha ASC, id ASC"
    )
    .all(mes) as unknown as Movimiento[];

  return movs.map((m) => {
    let factura: Factura | null = null;
    if (m.factura_id) {
      const row = db
        .prepare("SELECT * FROM facturas WHERE id = ?")
        .get(m.factura_id) as unknown as Factura | undefined;
      // node:sqlite devuelve objetos con prototipo null; el spread los convierte
      // en objetos planos para poder pasarlos a un Client Component.
      factura = row ? { ...row } : null;
    }
    return { ...m, factura };
  });
}

export function facturasDelMes(anio: number, mes: number): Factura[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM facturas WHERE anio = ? AND mes = ? ORDER BY numero ASC"
    )
    .all(anio, mes) as unknown as Factura[];
}

/** Lista de meses (YYYY-MM) que tienen movimientos, más reciente primero. */
export function mesesDisponibles(): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT DISTINCT substr(fecha, 1, 7) AS mes FROM movimientos ORDER BY mes DESC"
    )
    .all() as { mes: string }[];
  return rows.map((r) => r.mes);
}

// ---------------------------------------------------------------------------
// Crear factura: imagen -> PDF numerado + registro en BD + enlace al movimiento
// ---------------------------------------------------------------------------

interface DatosFactura {
  proveedor?: string | null;
  base?: number | null;
  iva?: number | null;
  total?: number | null;
}

export async function crearFactura(
  movimientoId: number,
  imagen: Uint8Array,
  mimeType: string,
  datos: DatosFactura = {}
): Promise<Factura> {
  const db = getDb();

  const mov = db
    .prepare("SELECT * FROM movimientos WHERE id = ?")
    .get(movimientoId) as Movimiento | undefined;
  if (!mov) throw new Error(`Movimiento ${movimientoId} no encontrado`);

  const anio = Number(mov.fecha.slice(0, 4));
  const mes = Number(mov.fecha.slice(5, 7));
  const numero = siguienteNumero(anio, mes);

  // Generar el PDF con la foto embebida + el número estampado.
  const pdfBytes = await generarPdf(numero, mov, imagen, mimeType, datos);

  // Guardar en disco: facturas/2026/07-julio/VP-2026-07-001.pdf
  const dir = carpetaMes(anio, mes);
  await fsp.mkdir(dir, { recursive: true });
  const rutaAbs = path.join(dir, `${numero}.pdf`);
  await fsp.writeFile(rutaAbs, pdfBytes);
  const rutaRel = path.relative(process.cwd(), rutaAbs).replace(/\\/g, "/");

  const total = datos.total ?? Math.abs(mov.importe);
  const creada = new Date().toISOString();

  const res = db
    .prepare(
      `INSERT INTO facturas (numero, anio, mes, movimiento_id, proveedor, base, iva, total, pdf_path, creada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      numero,
      anio,
      mes,
      movimientoId,
      datos.proveedor ?? mov.concepto,
      datos.base ?? null,
      datos.iva ?? null,
      total,
      rutaRel,
      creada
    );

  const facturaId = Number(res.lastInsertRowid);
  db.prepare("UPDATE movimientos SET factura_id = ? WHERE id = ?").run(
    facturaId,
    movimientoId
  );

  return db
    .prepare("SELECT * FROM facturas WHERE id = ?")
    .get(facturaId) as unknown as Factura;
}

const EUR = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

function esPdf(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType.includes("pdf")) return true;
  // Firma "%PDF" por si el mimeType no viene fiable.
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

async function generarPdf(
  numero: string,
  mov: Movimiento,
  imagen: Uint8Array,
  mimeType: string,
  datos: DatosFactura
): Promise<Uint8Array> {
  // Si ya suben un PDF, no lo metemos dentro de otro: solo le estampamos el
  // número de cotejo en la esquina de la primera página.
  if (esPdf(imagen, mimeType)) {
    const doc = await PDFDocument.load(imagen);
    const first = doc.getPage(0);
    const { height } = first.getSize();
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    // Recuadro blanco de fondo para que el número se lea sobre cualquier factura.
    first.drawRectangle({
      x: 24,
      y: height - 40,
      width: 150,
      height: 22,
      color: rgb(1, 1, 1),
      opacity: 0.85,
    });
    first.drawText(numero, {
      x: 30,
      y: height - 35,
      size: 13,
      font: bold,
      color: rgb(0.85, 0.15, 0.15),
    });
    return doc.save();
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4 en puntos
  const { width, height } = page.getSize();
  const margin = 40;

  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  // Cabecera con el número de cotejo (bien visible).
  page.drawText("VENDING PLAY", {
    x: margin,
    y: height - margin - 6,
    size: 18,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText(numero, {
    x: margin,
    y: height - margin - 30,
    size: 22,
    font: fontBold,
    color: rgb(0.85, 0.15, 0.15),
  });

  // Datos del movimiento asociado.
  const lineas = [
    `Fecha: ${mov.fecha}`,
    `Concepto: ${mov.concepto}`,
    `Importe: ${EUR.format(Math.abs(mov.importe))}`,
  ];
  if (datos.base != null) lineas.push(`Base imponible: ${EUR.format(datos.base)}`);
  if (datos.iva != null) lineas.push(`IVA: ${EUR.format(datos.iva)}`);

  let cursorY = height - margin - 60;
  for (const linea of lineas) {
    page.drawText(linea, { x: margin, y: cursorY, size: 11, font });
    cursorY -= 16;
  }

  // Embeber la foto de la factura, escalada para caber bajo el texto.
  let img;
  if (mimeType.includes("png")) {
    img = await pdf.embedPng(imagen);
  } else {
    img = await pdf.embedJpg(imagen);
  }
  const maxW = width - margin * 2;
  const maxH = cursorY - margin - 10;
  const escala = Math.min(maxW / img.width, maxH / img.height, 1);
  const imgW = img.width * escala;
  const imgH = img.height * escala;
  page.drawImage(img, {
    x: margin,
    y: cursorY - 10 - imgH,
    width: imgW,
    height: imgH,
  });

  return pdf.save();
}

/** ¿Existe físicamente el PDF de esta factura? */
export function pdfExiste(factura: Factura): boolean {
  return fs.existsSync(path.join(process.cwd(), factura.pdf_path));
}
