import { NextResponse } from "next/server";
import { requireAiUser } from "@/lib/ai-auth";
import { categorizeWithGemini, googleAiKey } from "@/lib/gemini";
import type { CategorizeInput } from "@/lib/categorization/types";

export const maxDuration = 20;

export async function POST(request: Request) {
  if (!(await requireAiUser())) {
    return NextResponse.json({ error: "Sign in to use AI." }, { status: 401 });
  }
  if (!googleAiKey()) return NextResponse.json({ result: null });

  const body = (await request.json().catch(() => null)) as CategorizeInput | null;
  if (!body?.name?.trim()) return NextResponse.json({ result: null });

  const result = await categorizeWithGemini({
    name: body.name,
    notes: body.notes,
    merchantName: body.merchantName,
  });
  return NextResponse.json({ result });
}
