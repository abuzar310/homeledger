import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !secret) {
    return NextResponse.json({ error: "Google sign-in is not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim();
  if (!code) return NextResponse.json({ error: "Missing Google code." }, { status: 400 });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: secret,
      redirect_uri: "postmessage",
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await tokenRes.json()) as { id_token?: string; error?: string };
  if (!tokenRes.ok || !tokens.id_token) {
    return NextResponse.json({ error: tokens.error || "Google did not return an ID token." }, { status: 400 });
  }
  return NextResponse.json({ id_token: tokens.id_token });
}
