import { NextResponse } from "next/server";
import { iniciarAuth, hayConfig } from "@/lib/enablebanking";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hayConfig()) {
    return NextResponse.json(
      { error: "Falta configurar Enable Banking (.env.local + clave en secrets/)" },
      { status: 400 }
    );
  }
  try {
    const origin = new URL(request.url).origin;
    const redirect = `${origin}/api/banco/callback`;
    const state = `vp-${Date.now()}`;
    const { url } = await iniciarAuth(redirect, state);
    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
