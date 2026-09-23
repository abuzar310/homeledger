import { aiFaq } from "@/lib/site";

export function GET() {
  return Response.json(aiFaq(), { headers: { "Cache-Control": "public, max-age=3600" } });
}
