import type { Movimiento } from "./types";

// Módulo "puro" (sin dependencias de Node) para poder usarlo tanto en el
// servidor como en componentes cliente.

/** ¿El concepto parece una recaudación de máquinas? (no necesita factura) */
export function esRecaudacion(concepto: string): boolean {
  return /recaudaci[oó]n/i.test(concepto);
}

/**
 * ¿Este movimiento necesita una factura?
 * - Gastos: siempre (factura recibida).
 * - Ingresos: solo si NO es recaudación (p. ej. un servicio facturado a un
 *   cliente como un hotel → factura emitida).
 */
export function requiereFactura(
  mov: Pick<Movimiento, "tipo" | "concepto">
): boolean {
  if (mov.tipo === "gasto") return true;
  return !esRecaudacion(mov.concepto);
}

/** ¿Está pospuesto el aviso ahora mismo? */
export function estaPospuesto(posponer_hasta: string | null): boolean {
  return posponer_hasta ? new Date(posponer_hasta).getTime() > Date.now() : false;
}
