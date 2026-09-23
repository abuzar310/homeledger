import { SITE_GITHUB, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

export function GET() {
  const body = `# ${SITE_NAME}
# AI crawler brief
contact: ${SITE_GITHUB}
llms-txt: ${absoluteUrl("/llms.txt")}
llms-full-txt: ${absoluteUrl("/llms-full.txt")}
sitemap: ${absoluteUrl("/sitemap.xml")}
canonical: ${SITE_URL}
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
