import { aiSummary } from "@/lib/site";

export function GET() {
  return Response.json(aiSummary(), { headers: { "Cache-Control": "public, max-age=3600" } });
}
