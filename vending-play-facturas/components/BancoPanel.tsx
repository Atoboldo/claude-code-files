"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function BancoPanel({
  ebConfig,
  ebConectado,
}: {
  ebConfig: boolean;
  ebConectado: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function conectar() {
    setCargando(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/banco/conectar", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al conectar");
      window.location.href = data.url; // al banco a autorizar
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar");
      setCargando(false);
    }
  }

  async function sincronizar() {
    setCargando(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/banco/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al sincronizar");
      setMsg(
        data.importados > 0
          ? `✅ ${data.importados} movimiento(s) nuevo(s)`
          : "Todo al día, sin movimientos nuevos"
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setCargando(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    setMsg(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("archivo", file);
      const res = await fetch("/api/banco/importar-csv", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al importar");
      setMsg(
        data.importados > 0
          ? `✅ ${data.importados} de ${data.total} importado(s)`
          : `Todo al día (${data.total} ya estaban)`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setCargando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const subtitulo = !ebConfig
    ? "Coloca la clave en secrets/ para conectar automáticamente"
    : ebConectado
      ? "Conectado · sincroniza para traer movimientos"
      : "Conecta tu banco para bajar los movimientos solos";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
            🏦 BBVA
          </p>
          <p className="text-xs text-zinc-500">{subtitulo}</p>
        </div>

        {ebConfig && !ebConectado && (
          <button
            onClick={conectar}
            disabled={cargando}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {cargando ? "…" : "🔗 Conectar"}
          </button>
        )}

        {ebConfig && ebConectado && (
          <button
            onClick={sincronizar}
            disabled={cargando}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {cargando ? "Sincronizando…" : "🔄 Sincronizar"}
          </button>
        )}
      </div>

      {/* Alternativa: importar CSV manualmente */}
      <div className="mt-2 flex items-center gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <span className="text-xs text-zinc-400">o manual:</span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onFile}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={cargando}
          className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
        >
          📥 Importar extracto CSV
        </button>
      </div>

      {msg && (
        <p className="mt-2 text-xs text-green-700 dark:text-green-400">{msg}</p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
