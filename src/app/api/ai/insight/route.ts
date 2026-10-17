import { NextResponse } from "next/server";
import { bodyTooLarge, requireAiUser } from "@/lib/ai-auth";
import { googleAiKey, insightWithGemini, toInsightInput } from "@/lib/gemini";

export const maxDuration = 20;

export async function POST(request: Request) {
  if (!(await requireAiUser())) {
    return NextResponse.json({ error: "Sign in to use AI." }, { status: 401 });
  }
  if (!googleAiKey()) return NextResponse.json({ text: null });
  if (bodyTooLarge(request, 16_000)) {
    return NextResponse.json({ error: "That request is too large." }, { status: 413 });
  }

  const input = toInsightInput(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ text: null });

  try {
    return NextResponse.json({ text: await insightWithGemini(input) });
  } catch {
    return NextResponse.json({ text: null, error: "AI is not available right now." }, { status: 502 });
  }
}
