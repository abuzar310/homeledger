import { NextResponse } from "next/server";
import { requireAiUser } from "@/lib/ai-auth";
import { googleAiKey, insightWithGemini, type InsightInput } from "@/lib/gemini";

export const maxDuration = 20;

export async function POST(request: Request) {
  if (!(await requireAiUser())) {
    return NextResponse.json({ error: "Sign in to use AI." }, { status: 401 });
  }
  if (!googleAiKey()) return NextResponse.json({ text: null });

  const body = (await request.json().catch(() => null)) as InsightInput | null;
  if (!body || typeof body.total !== "number" || !body.month) {
    return NextResponse.json({ text: null });
  }

  const text = await insightWithGemini({
    month: body.month,
    total: body.total,
    previous: Number(body.previous) || 0,
    count: Number(body.count) || 0,
    top: Array.isArray(body.top)
      ? body.top.slice(0, 4).map((row) => ({
          name: String(row?.name ?? "").slice(0, 40),
          total: Number(row?.total) || 0,
        }))
      : [],
  });
  return NextResponse.json({ text });
}
