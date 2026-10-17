import { NextResponse } from "next/server";
import { bodyTooLarge, requireAiUser } from "@/lib/ai-auth";
import { categorizeWithGemini, googleAiKey, toCategorizeInput } from "@/lib/gemini";

export const maxDuration = 20;

export async function POST(request: Request) {
  if (!(await requireAiUser())) {
    return NextResponse.json({ error: "Sign in to use AI." }, { status: 401 });
  }
  if (!googleAiKey()) return NextResponse.json({ result: null });
  if (bodyTooLarge(request, 16_000)) {
    return NextResponse.json({ error: "That expense is too long to categorise." }, { status: 413 });
  }

  const input = toCategorizeInput(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ result: null });

  try {
    return NextResponse.json({ result: await categorizeWithGemini(input) });
  } catch {
    return NextResponse.json({ result: null, error: "AI is not available right now." }, { status: 502 });
  }
}
