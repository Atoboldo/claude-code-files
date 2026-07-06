import Link from "next/link";
import MovimientosList from "@/components/MovimientosList";
import Avisos from "@/components/Avisos";
import BancoPanel from "@/components/BancoPanel";
import { movimientosDelMes, mesesDisponibles, MESES } from "@/lib/facturas";
import { requiereFactura, estaPospuesto } from "@/lib/reglas";
import { hayConfig } from "@/lib/enablebanking";
import { conexionActual } from "@/lib/banco";

const EUR = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

function nombreMes(mes: string): string {
  const [anio, m] = mes.split("-");
  return `${MESES[Number(m) - 1]} ${anio}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: mesParam } = await searchParams; // Next 16: searchParams asíncrono
  const meses = mesesDisponibles();
  const mes = mesParam && meses.includes(mesParam) ? mesParam : (meses[0] ?? "2026-07");

  const movimientos = movimientosDelMes(mes);

  const conexion = conexionActual();
  const ebConectado = conexion?.estado === "conectada" && !!conexion.account_id;

  const ingresos = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((s, m) => s + m.importe, 0);
  const gastos = movimientos
    .filter((m) => m.tipo === "gasto")
    .reduce((s, m) => s + Math.abs(m.importe), 0);
  const sinFactura = movimientos.filter(
    (m) => m.tipo === "gasto" && !m.factura
  ).length;
  // Pendientes "activos": movimientos que necesitan factura, no la tienen y no
  // están pospuestos (gastos + ingresos de servicio como el del hotel).
  const pendientesActivos = movimientos.filter(
    (m) =>
      requiereFactura(m) && !m.factura && !estaPospuesto(m.posponer_hasta)
  ).length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Vending Play · Facturas
          </h1>
          <p className="text-sm text-zinc-500">{nombreMes(mes)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Avisos pendientes={pendientesActivos} />
          <a
            href={`/api/export?mes=${mes}`}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            ⬇️ Cerrar mes (PDF)
          </a>
        </div>
      </header>

      {/* Selector de mes */}
      {meses.length > 1 && (
        <nav className="flex flex-wrap gap-2">
          {meses.map((m) => (
            <Link
              key={m}
              href={`/?mes=${m}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                m === mes
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {nombreMes(m)}
            </Link>
          ))}
        </nav>
      )}

      {/* Resumen */}
      <section className="grid grid-cols-3 gap-2">
        <Tarjeta titulo="Ingresos" valor={EUR.format(ingresos)} color="green" />
        <Tarjeta titulo="Gastos" valor={EUR.format(gastos)} color="zinc" />
        <Tarjeta
          titulo="Gastos sin factura"
          valor={String(sinFactura)}
          color={sinFactura > 0 ? "red" : "green"}
        />
      </section>

      <BancoPanel ebConfig={hayConfig()} ebConectado={ebConectado} />

      {pendientesActivos > 0 && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          Tienes <strong>{pendientesActivos}</strong> movimiento(s) pendientes
          de subir factura antes de cerrar el mes 📸
        </p>
      )}

      <MovimientosList movimientos={movimientos} />

      <footer className="mt-auto pt-4 text-center text-xs text-zinc-400">
        Importa el extracto CSV de BBVA · sube facturas · cierra el mes
      </footer>
    </div>
  );
}

function Tarjeta({
  titulo,
  valor,
  color,
}: {
  titulo: string;
  valor: string;
  color: "green" | "red" | "zinc";
}) {
  const colores = {
    green: "text-green-600",
    red: "text-red-600",
    zinc: "text-zinc-900 dark:text-zinc-100",
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{titulo}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${colores[color]}`}>
        {valor}
      </p>
    </div>
  );
}
