"use client";

import { useEffect, useState } from "react";

/**
 * Botón para activar los avisos del navegador. Cuando hay gastos pendientes
 * (sin factura y no pospuestos) lanza una notificación recordándolo.
 *
 * Nota: esto funciona mientras la app está o ha estado abierta. Para recibir
 * avisos con la app cerrada hace falta Web Push (service worker + servidor),
 * que se añadirá al desplegar la app (Fase 2).
 */
export default function Avisos({ pendientes }: { pendientes: number }) {
  const [permiso, setPermiso] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    // Leemos el permiso real del navegador tras montar (API imperativa).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermiso(Notification.permission);
    // Si ya está concedido y hay pendientes, recordamos al abrir.
    if (Notification.permission === "granted" && pendientes > 0) {
      lanzar(pendientes);
    }
  }, [pendientes]);

  if (typeof window !== "undefined" && typeof Notification === "undefined") {
    return null; // navegador sin soporte
  }

  async function activar() {
    const p = await Notification.requestPermission();
    setPermiso(p);
    if (p === "granted") lanzar(pendientes);
  }

  if (permiso === "granted") {
    return (
      <span className="rounded-lg bg-green-100 px-3 py-2 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
        🔔 Avisos activados
      </span>
    );
  }

  return (
    <button
      onClick={activar}
      className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      🔔 Activar avisos
    </button>
  );
}

function lanzar(pendientes: number) {
  if (pendientes <= 0) return;
  new Notification("Vending Play · Facturas", {
    body: `Tienes ${pendientes} gasto(s) sin factura. Sube la foto o el archivo 📸`,
    icon: "/favicon.ico",
  });
}
