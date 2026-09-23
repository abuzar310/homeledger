import { aiService } from "@/lib/site";

export function GET() {
  return Response.json(aiService(), { headers: { "Cache-Control": "public, max-age=3600" } });
}
