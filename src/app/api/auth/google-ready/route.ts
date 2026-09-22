import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return NextResponse.json({ ready: false });

  const authorize = new URL("/auth/v1/authorize", url);
  authorize.searchParams.set("provider", "google");
  authorize.searchParams.set("redirect_to", "http://127.0.0.1/auth/callback");

  const res = await fetch(authorize, { redirect: "manual" });
  const text = await res.text();
  return NextResponse.json({
    ready: !/not enabled|unsupported provider/i.test(text),
  });
}
