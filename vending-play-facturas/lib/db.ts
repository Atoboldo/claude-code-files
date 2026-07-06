import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// Guardamos la base de datos en data/vending.db (fuera de app/ para que no
// interfiera con el bundler de Next).
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "vending.db");

// Singleton: Next puede recargar módulos en dev, así que cacheamos en globalThis.
const globalForDb = globalThis as unknown as { __vpDb?: DatabaseSync };

function createDb(): DatabaseSync {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS facturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL UNIQUE,
      anio INTEGER NOT NULL,
      mes INTEGER NOT NULL,
      movimiento_id INTEGER,
      proveedor TEXT,
      base REAL,
      iva REAL,
      total REAL,
      pdf_path TEXT NOT NULL,
      creada TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      concepto TEXT NOT NULL,
      importe REAL NOT NULL,
      tipo TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'seed',
      factura_id INTEGER REFERENCES facturas(id),
      posponer_hasta TEXT,
      banco_tx_id TEXT
    );

    CREATE TABLE IF NOT EXISTS banco_conexion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id TEXT NOT NULL,
      requisition_id TEXT NOT NULL,
      account_id TEXT,
      estado TEXT NOT NULL,
      creada TEXT NOT NULL
    );
  `);

  migrar(db);
  seedIfEmpty(db);
  return db;
}

// Migraciones para bases de datos ya existentes (creadas antes de añadir campos).
function migrar(db: DatabaseSync) {
  const cols = db
    .prepare("PRAGMA table_info(movimientos)")
    .all() as unknown as { name: string }[];
  if (!cols.some((c) => c.name === "posponer_hasta")) {
    db.exec("ALTER TABLE movimientos ADD COLUMN posponer_hasta TEXT");
  }
  if (!cols.some((c) => c.name === "banco_tx_id")) {
    db.exec("ALTER TABLE movimientos ADD COLUMN banco_tx_id TEXT");
  }
}

export function getDb(): DatabaseSync {
  if (!globalForDb.__vpDb) globalForDb.__vpDb = createDb();
  return globalForDb.__vpDb;
}

// ---------------------------------------------------------------------------
// Datos de ejemplo (julio 2026) para poder tocar la app desde el minuto uno.
// Movimientos típicos de un negocio de vending: compras de producto, gastos
// fijos e ingresos de recaudación. Algunos ya llevan factura, otros no.
// ---------------------------------------------------------------------------
function seedIfEmpty(db: DatabaseSync) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM movimientos").get() as {
    n: number;
  };
  if (count.n > 0) return;

  const movs: Array<[string, string, number, string]> = [
    // fecha, concepto, importe, tipo
    ["2026-07-02", "Recaudación máquinas semana 26", 1240.6, "ingreso"],
    ["2026-07-03", "MAHOU S.A. - Pedido bebidas", -340.5, "gasto"],
    ["2026-07-04", "FRIT RAVICH - Snacks y frutos secos", -512.75, "gasto"],
    ["2026-07-05", "Alquiler almacén Pol. Industrial", -600.0, "gasto"],
    ["2026-07-07", "COCA-COLA EUROPACIFIC - Refrescos", -428.9, "gasto"],
    ["2026-07-09", "Recaudación máquinas semana 27", 1105.2, "ingreso"],
    ["2026-07-10", "IBERDROLA - Luz almacén junio", -87.34, "gasto"],
    ["2026-07-12", "Reparación máquina Necta - técnico", -145.0, "gasto"],
    ["2026-07-15", "MOVISTAR - Datáfonos telemetría", -59.9, "gasto"],
    ["2026-07-16", "Recaudación máquinas semana 28", 980.45, "ingreso"],
    ["2026-07-18", "Gasolina furgoneta reparto", -72.6, "gasto"],
    ["2026-07-21", "NESTLÉ - Café y cápsulas", -298.15, "gasto"],
  ];

  const insert = db.prepare(
    "INSERT INTO movimientos (fecha, concepto, importe, tipo, source) VALUES (?, ?, ?, ?, 'seed')"
  );
  for (const [fecha, concepto, importe, tipo] of movs) {
    insert.run(fecha, concepto, importe, tipo);
  }
}
