"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MovimientoConFactura } from "@/lib/types";
import { requiereFactura } from "@/lib/reglas";

const EUR = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export default function MovimientosList({
  movimientos,
}: {
  movimientos: MovimientoConFactura[];
}) {
  return (
    <ul className="flex flex-col gap-2">
      {movimientos.map((m) => (
        <Fila key={m.id} mov={m} />
      ))}
    </ul>
  );
}

function Fila({ mov }: { mov: MovimientoConFactura }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [posponiendo, setPosponiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esGasto = mov.tipo === "gasto";
  const requiere = requiereFactura(mov);
  const pospuesto = mov.posponer_hasta
    ? new Date(mov.posponer_hasta) > new Date()
    : false;
  const hastaTxt = mov.posponer_hasta
    ? new Date(mov.posponer_hasta).toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  async function posponer() {
    setPosponiendo(true);
    setError(null);
    try {
      const res = await fetch(`/api/movimientos/${mov.id}/posponer`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("No se pudo posponer");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al posponer");
    } finally {
      setPosponiendo(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("movimientoId", String(mov.id));
      fd.append("imagen", file);
      const res = await fetch("/api/facturas", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al subir");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {mov.concepto}
          </span>
          <span
            className={`shrink-0 text-sm font-semibold tabular-nums ${
              esGasto ? "text-zinc-900 dark:text-zinc-100" : "text-green-600"
            }`}
          >
            {EUR.format(mov.importe)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
          <span>{mov.fecha}</span>
          {mov.factura ? (
            <a
              href={`/api/facturas/${mov.factura.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300"
            >
              🧾 {mov.factura.numero}
            </a>
          ) : pospuesto ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              ⏰ Pospuesto · {hastaTxt}
            </span>
          ) : requiere ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              ⚠️ {esGasto ? "Falta factura" : "Falta factura emitida"}
            </span>
          ) : (
            <span className="text-zinc-400">Ingreso</span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>

      {!mov.factura && (
        <div className="flex shrink-0 flex-col gap-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={onFile}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={subiendo || posponiendo}
            className={`rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
              requiere && !pospuesto
                ? "bg-red-600 hover:bg-red-700"
                : "bg-zinc-500 hover:bg-zinc-600"
            }`}
          >
            {subiendo
              ? "Subiendo…"
              : esGasto
                ? "📎 Foto o PDF"
                : "📤 Factura emitida"}
          </button>
          {requiere && !pospuesto && (
            <button
              onClick={posponer}
              disabled={subiendo || posponiendo}
              className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {posponiendo ? "…" : "⏰ +24h"}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
