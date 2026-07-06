export type TipoMovimiento = "gasto" | "ingreso";

export interface Movimiento {
  id: number;
  fecha: string; // YYYY-MM-DD
  concepto: string;
  importe: number; // negativo = gasto, positivo = ingreso
  tipo: TipoMovimiento;
  source: string; // 'seed' | 'bank'
  factura_id: number | null;
  posponer_hasta: string | null; // ISO datetime; si es futuro, el aviso está pospuesto
}

export interface Factura {
  id: number;
  numero: string; // VP-2026-07-001
  anio: number;
  mes: number;
  movimiento_id: number | null;
  proveedor: string | null;
  base: number | null;
  iva: number | null;
  total: number | null;
  pdf_path: string;
  creada: string; // ISO datetime
}

/** Movimiento con su factura asociada (si la tiene) para pintar en la lista. */
export interface MovimientoConFactura extends Movimiento {
  factura: Factura | null;
}
