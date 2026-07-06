// Parser del extracto de BBVA en CSV. Tolerante: detecta el delimitador,
// se salta las filas de metadatos que BBVA pone arriba, localiza la cabecera
// por nombre de columna y entiende fechas e importes en formato español.

export interface FilaMovimiento {
  fecha: string; // YYYY-MM-DD
  concepto: string;
  importe: number; // negativo = gasto, positivo = ingreso
  clave: string; // clave anti-duplicados (línea completa)
}

function detectarDelimitador(lineas: string[]): string {
  const muestra = lineas.slice(0, 20).join("\n");
  const puntoComa = (muestra.match(/;/g) ?? []).length;
  const comas = (muestra.match(/,/g) ?? []).length;
  const tabs = (muestra.match(/\t/g) ?? []).length;
  if (tabs > puntoComa && tabs > comas) return "\t";
  return puntoComa >= comas ? ";" : ",";
}

function parseLinea(linea: string, delim: string): string[] {
  const celdas: string[] = [];
  let actual = "";
  let enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (enComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        enComillas = !enComillas;
      }
    } else if (c === delim && !enComillas) {
      celdas.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  celdas.push(actual);
  return celdas.map((c) => c.trim());
}

function parseImporte(s: string): number {
  let t = s.replace(/[^\d.,-]/g, ""); // quita € y espacios
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", "."); // formato ES
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}

function parseFecha(s: string): string {
  const t = s.trim();
  const m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, yRaw] = m;
    const y = yRaw.length === 2 ? "20" + yRaw : yRaw;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t;
}

export function parseBbvaCsv(texto: string): FilaMovimiento[] {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lineas.length === 0) throw new Error("El archivo está vacío");

  const delim = detectarDelimitador(lineas);
  const filas = lineas.map((l) => parseLinea(l, delim));

  const idxCab = filas.findIndex(
    (f) => f.some((c) => /fecha/i.test(c)) && f.some((c) => /importe/i.test(c))
  );
  if (idxCab === -1) {
    throw new Error(
      "No encuentro la cabecera con columnas 'Fecha' e 'Importe'. ¿Es el extracto de BBVA en CSV?"
    );
  }

  const cab = filas[idxCab].map((c) => c.toLowerCase());
  const iImporte = cab.findIndex((c) => /importe/i.test(c));
  let iFecha = cab.findIndex((c) => /fecha/i.test(c) && !/valor/i.test(c));
  if (iFecha === -1) iFecha = cab.findIndex((c) => /fecha/i.test(c));
  let iConcepto = cab.findIndex((c) => /concepto|descrip|movimiento/i.test(c));
  if (iConcepto === -1) {
    iConcepto = cab.findIndex(
      (c, idx) =>
        idx !== iFecha &&
        idx !== iImporte &&
        !/saldo|divisa|valor|disponible/i.test(c)
    );
  }

  const resultado: FilaMovimiento[] = [];
  for (let r = idxCab + 1; r < filas.length; r++) {
    const f = filas[r];
    if (f.length <= Math.max(iImporte, iFecha)) continue;

    const importe = parseImporte(f[iImporte] ?? "");
    const fecha = parseFecha(f[iFecha] ?? "");
    const concepto = (iConcepto >= 0 ? f[iConcepto] : "").trim() || "Movimiento";

    if (!Number.isFinite(importe)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;

    resultado.push({ fecha, concepto, importe, clave: "csv:" + f.join("|") });
  }

  if (resultado.length === 0) {
    throw new Error(
      "Encontré la cabecera pero ninguna fila de movimiento válida"
    );
  }
  return resultado;
}
