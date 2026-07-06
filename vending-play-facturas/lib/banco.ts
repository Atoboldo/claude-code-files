import { getDb } from "./db";
import type { FilaMovimiento } from "./csv";
import type { EbTx } from "./enablebanking";

// ---------------------------------------------------------------------------
// Conexión bancaria (Enable Banking): guardamos la cuenta enlazada.
// ---------------------------------------------------------------------------

export interface Conexion {
  id: number;
  institution_id: string;
  requisition_id: string; // aquí: session_id de Enable Banking
  account_id: string | null; // uid de la cuenta
  estado: string;
  creada: string;
}

export function guardarConexion(
  institution_id: string,
  sessionId: string,
  accountId: string
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO banco_conexion (institution_id, requisition_id, account_id, estado, creada)
     VALUES (?, ?, ?, 'conectada', ?)`
  ).run(institution_id, sessionId, accountId, new Date().toISOString());
}

export function conexionActual(): Conexion | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM banco_conexion ORDER BY id DESC LIMIT 1")
    .get() as unknown as Conexion | undefined;
  return row ? { ...row } : null;
}

// ---------------------------------------------------------------------------
// Importación de movimientos (dedup por banco_tx_id). Compartida por CSV y banco.
// ---------------------------------------------------------------------------

export function importarMovimientos(
  filas: FilaMovimiento[],
  source: "csv" | "bank"
): number {
  const db = getDb();
  const existe = db.prepare("SELECT 1 FROM movimientos WHERE banco_tx_id = ?");
  const insert = db.prepare(
    `INSERT INTO movimientos (fecha, concepto, importe, tipo, source, banco_tx_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  let nuevos = 0;
  for (const f of filas) {
    if (existe.get(f.clave)) continue;
    const tipo = f.importe < 0 ? "gasto" : "ingreso";
    insert.run(f.fecha, f.concepto, f.importe, tipo, source, f.clave);
    nuevos++;
  }
  return nuevos;
}

/** Importa desde un extracto CSV de BBVA. */
export function importarMovimientosCsv(filas: FilaMovimiento[]): number {
  return importarMovimientos(filas, "csv");
}

/** Convierte e importa las transacciones de Enable Banking. */
export function importarTransaccionesEb(txs: EbTx[]): number {
  const filas: FilaMovimiento[] = [];
  for (const tx of txs) {
    const bruto = parseFloat(tx.transaction_amount?.amount ?? "");
    if (!Number.isFinite(bruto)) continue;
    const importe = tx.credit_debit_indicator === "DBIT" ? -bruto : bruto;

    const concepto = (
      tx.remittance_information?.join(" ") ||
      tx.creditor?.name ||
      tx.debtor?.name ||
      "Movimiento bancario"
    ).trim();

    const fecha =
      tx.booking_date ?? tx.value_date ?? new Date().toISOString().slice(0, 10);

    const clave =
      "eb:" +
      (tx.entry_reference ?? `${fecha}|${importe}|${concepto}`);

    filas.push({ fecha, concepto, importe, clave });
  }
  return importarMovimientos(filas, "bank");
}
