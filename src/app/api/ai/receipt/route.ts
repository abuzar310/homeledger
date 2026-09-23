import { NextResponse } from "next/server";
import { requireAiUser } from "@/lib/ai-auth";
import { googleAiKey, parseReceiptWithGemini } from "@/lib/gemini";

export const maxDuration = 30;

export async function POST(request: Request) {
  if (!(await requireAiUser())) {
    return NextResponse.json({ error: "Sign in to use AI." }, { status: 401 });
  }
  if (!googleAiKey()) return NextResponse.json({ result: null });

  const body = (await request.json().catch(() => null)) as { mime?: string; data?: string } | null;
  const mime = body?.mime?.startsWith("image/") ? body.mime : "image/jpeg";
  const data = body?.data?.trim();
  if (!data || data.length > 5_000_000) return NextResponse.json({ result: null });

  const result = await parseReceiptWithGemini(mime, data);
  return NextResponse.json({ result });
}
