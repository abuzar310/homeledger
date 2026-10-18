import { NextResponse } from "next/server";
import { AI_LIMIT_MESSAGE, bodyTooLarge, requireAiUser, withinAiQuota } from "@/lib/ai-auth";
import { AI_INPUT_LIMITS, googleAiKey, parseReceiptWithGemini, toReceiptInput } from "@/lib/gemini";

export const maxDuration = 30;

const TOO_LARGE = "That photo is too large to read. Try a smaller or cropped photo of the receipt.";

export async function POST(request: Request) {
  if (!(await requireAiUser())) {
    return NextResponse.json({ error: "Sign in to use AI." }, { status: 401 });
  }
  if (!googleAiKey()) return NextResponse.json({ result: null });
  if (bodyTooLarge(request, AI_INPUT_LIMITS.receiptBase64 + 64_000)) {
    return NextResponse.json({ result: null, error: TOO_LARGE }, { status: 413 });
  }

  const input = toReceiptInput(await request.json().catch(() => null));
  if (input === "too_large") return NextResponse.json({ result: null, error: TOO_LARGE }, { status: 413 });
  if (!input) return NextResponse.json({ result: null });

  // Counted only for requests that will really reach the model.
  if (!(await withinAiQuota("receipt"))) {
    return NextResponse.json({ result: null, error: AI_LIMIT_MESSAGE }, { status: 429 });
  }

  try {
    return NextResponse.json({ result: await parseReceiptWithGemini(input.mime, input.data) });
  } catch {
    return NextResponse.json({ result: null, error: "Could not read the receipt right now." }, { status: 502 });
  }
}
