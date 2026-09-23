import { rssXml } from "@/lib/site";

export function GET() {
  return new Response(rssXml(), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
