// Cliente de Enable Banking (Open Banking / Account Information).
// Docs: https://enablebanking.com/docs/api/quick-start/
//
// Config en .env.local:
//   ENABLEBANKING_APP_ID=<uuid de la aplicación>
//   ENABLEBANKING_KEY_PATH=secrets/enablebanking.pem   (clave privada RSA)
//   ENABLEBANKING_COUNTRY=ES
//   ENABLEBANKING_PSU_TYPE=personal | business
//   ENABLEBANKING_ASPSP=<nombre banco>  (opcional, p. ej. sandbox)

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const BASE = "https://api.enablebanking.com";

export function hayConfig(): boolean {
  const appId = process.env.ENABLEBANKING_APP_ID;
  const keyPath = process.env.ENABLEBANKING_KEY_PATH;
  if (!appId || !keyPath) return false;
  return fs.existsSync(path.join(process.cwd(), keyPath));
}

function config() {
  const appId = process.env.ENABLEBANKING_APP_ID;
  const keyPath = process.env.ENABLEBANKING_KEY_PATH;
  if (!appId || !keyPath) {
    throw new Error("Falta ENABLEBANKING_APP_ID / ENABLEBANKING_KEY_PATH en .env.local");
  }
  const abs = path.join(process.cwd(), keyPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`No encuentro la clave privada en ${keyPath} (guárdala ahí)`);
  }
  let pem = fs.readFileSync(abs, "utf8").trim();
  if (!pem.includes("BEGIN")) {
    // Clave sin cabeceras PEM: la envolvemos como PKCS#8.
    pem = `-----BEGIN PRIVATE KEY-----\n${pem}\n-----END PRIVATE KEY-----`;
  }
  return { appId, pem };
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function jwt(): string {
  const { appId, pem } = config();
  const header = { typ: "JWT", alg: "RS256", kid: appId };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(
    JSON.stringify(payload)
  )}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), pem);
  return `${signingInput}.${b64url(signature)}`;
}

async function api<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Enable Banking ${pathname} → ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export interface Aspsp {
  name: string;
  country: string;
}

export async function listarBancos(country: string): Promise<Aspsp[]> {
  const data = await api<{ aspsps: Aspsp[] }>(`/aspsps?country=${country}`);
  return data.aspsps ?? [];
}

/** El banco objetivo: BBVA, o el override del .env (útil en sandbox). */
export async function bancoObjetivo(): Promise<Aspsp> {
  const country = process.env.ENABLEBANKING_COUNTRY ?? "ES";
  const override = process.env.ENABLEBANKING_ASPSP;
  const bancos = await listarBancos(country);
  if (override) {
    const f = bancos.find((b) => b.name === override);
    if (f) return f;
  }
  const bbva = bancos.find((b) => /bbva/i.test(b.name));
  if (bbva) return bbva;
  if (bancos.length > 0) return bancos[0]; // sandbox: primer banco de prueba
  throw new Error(`No hay bancos disponibles para el país ${country}`);
}

/** Inicia la autorización. Devuelve la URL a la que mandar al usuario. */
export async function iniciarAuth(
  redirect: string,
  state: string
): Promise<{ url: string }> {
  const banco = await bancoObjetivo();
  const validUntil = new Date(
    Date.now() + 89 * 24 * 60 * 60 * 1000
  ).toISOString();
  const body = {
    access: { valid_until: validUntil },
    aspsp: { name: banco.name, country: banco.country },
    redirect_url: redirect,
    state,
    psu_type: process.env.ENABLEBANKING_PSU_TYPE ?? "personal",
  };
  return api<{ url: string }>(`/auth`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function crearSesion(
  code: string
): Promise<{ session_id: string; accounts: Array<string | { uid: string }> }> {
  return api(`/sessions`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export interface EbTx {
  entry_reference?: string;
  booking_date?: string;
  value_date?: string;
  transaction_amount: { amount: string; currency: string };
  credit_debit_indicator: "CRDT" | "DBIT";
  remittance_information?: string[];
  creditor?: { name?: string };
  debtor?: { name?: string };
}

export async function transacciones(
  accountUid: string,
  dateFrom?: string
): Promise<EbTx[]> {
  const q = dateFrom ? `?date_from=${dateFrom}` : "";
  const data = await api<{ transactions: EbTx[] }>(
    `/accounts/${accountUid}/transactions${q}`
  );
  return data.transactions ?? [];
}
