import { NextResponse } from "next/server";
import { parseBbvaCsv } from "@/lib/csv";
import { importarMovimientosCsv } from "@/lib/banco";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const archivo = form.get("archivo");
    if (!(archivo instanceof File)) {
      return NextResponse.json(
        { error: "Falta el archivo CSV" },
        { status: 400 }
      );
    }

    const buf = new Uint8Array(await archivo.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ error: "Archivo vacío" }, { status: 400 });
    }

    // ¿Es un Excel? (.xlsx empieza por 'PK', .xls por D0 CF) → avisar.
    const esZip = buf[0] === 0x50 && buf[1] === 0x4b;
    const esXls = buf[0] === 0xd0 && buf[1] === 0xcf;
    if (esZip || esXls) {
      return NextResponse.json(
        {
          error:
            "Parece un Excel. En BBVA elige exportar a 'CSV', o dime y añado soporte .xlsx",
        },
        { status: 400 }
      );
    }

    // BBVA suele exportar en UTF-8, pero a veces en ISO-8859-1 (acentos).
    let texto = new TextDecoder("utf-8").decode(buf);
    if (texto.includes("�")) {
      texto = new TextDecoder("iso-8859-1").decode(buf);
    }

    const filas = parseBbvaCsv(texto);
    const importados = importarMovimientosCsv(filas);

    return NextResponse.json({ ok: true, importados, total: filas.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al importar";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
