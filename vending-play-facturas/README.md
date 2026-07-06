# Vending Play · Facturas 🧾

Cazador de facturas para el negocio de vending. La idea: mirar los movimientos
del banco y, cuando aparece un gasto **sin factura**, avisarte para que le hagas
la foto. Cada factura se guarda como **PDF numerado** para poder cotejarla con el
extracto y llevársela al asesor cada mes.

## Cómo funciona

- **Lista de movimientos** del mes (ingresos y gastos).
- Cada gasto sin factura sale con **⚠️ Falta factura** y un botón **📸 Foto**.
- Al hacer la foto (cámara del móvil), la app:
  1. Convierte la imagen a **PDF**.
  2. Le asigna un **número correlativo mensual**: `VP-2026-07-001`.
  3. Estampa ese número dentro del PDF y lo enlaza al movimiento.
  4. Guarda el archivo con ese nombre: `facturas/2026/07-julio/VP-2026-07-001.pdf`.
- **Cerrar mes** genera un único PDF con una portada-resumen + todas las
  facturas del mes, listo para enviar al asesor.

## Número de cotejo

El nombre del archivo **es** el número de cotejo, así que con solo mirar el
extracto y la carpeta ya cuadras cada gasto con su factura. El número se
reinicia cada mes (`VP-AAAA-MM-NNN`).

## Puesta en marcha

```bash
npm install
npm run dev
```

Abre http://localhost:3000. Para usarlo en el móvil (y que funcione la cámara),
abre la IP de red que muestra Next (`http://192.168.x.x:3000`) desde el mismo WiFi.

## Stack

- **Next.js 16** (App Router) + React 19 + Tailwind 4
- **SQLite** integrado de Node (`node:sqlite`) — sin dependencias nativas
- **pdf-lib** para generar los PDFs

Los datos locales (base de datos y PDFs) se guardan en `data/` y `facturas/`,
ambos ignorados por git.

## Movimientos del banco

Se importan desde el **extracto CSV que descargas de la banca online de BBVA**
(botón "Importar extracto"). El parser (`lib/csv.ts`) tolera las filas de
metadatos, detecta el delimitador y entiende fechas e importes en formato
español. No se duplican movimientos al reimportar (dedup por línea).

> Se descartó GoCardless/Nordigen: cerraron los registros nuevos de Bank Account
> Data en 2025. La automatización total (Open Banking, p. ej. Enable Banking)
> queda para cuando la app se despliegue en un servidor.

## Estado

- **Fase 1** ✅ — Lista, foto/PDF → PDF numerado, cotejo, cierre de mes, avisos,
  posponer 24h, facturas emitidas en ingresos.
- **Fase 2** ✅ — Importación del extracto CSV de BBVA (con dedup y clasificación
  automática gasto/ingreso/recaudación).
- **Fase 3** ⏳ — Resumen del trimestral (IVA / IRPF) a partir de los meses
  cerrados.

## Estructura

```
app/
  page.tsx                    # pantalla principal
  api/facturas/route.ts       # POST: foto -> PDF numerado + enlace al movimiento
  api/facturas/[id]/pdf/      # GET: ver/descargar el PDF de una factura
  api/export/route.ts         # GET: PDF del mes (resumen + facturas)
components/
  MovimientosList.tsx         # lista + captura de cámara (client component)
lib/
  db.ts                       # SQLite + datos de ejemplo
  facturas.ts                 # numeración, generación de PDF, consultas
  types.ts
```
