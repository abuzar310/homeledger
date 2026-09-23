import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const ALLOW = [
  "/",
  "/about",
  "/login",
  "/llms.txt",
  "/llms-full.txt",
  "/sitemap.xml",
  "/feed.xml",
  "/ai/",
  "/.well-known/",
];
const DISALLOW = ["/home", "/transactions", "/add", "/reports", "/more", "/api/", "/auth/"];

/** 27 AI/search bots scored by Auriti-Labs/geo-optimizer-skill */
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Googlebot",
  "Google-Extended",
  "Google-CloudVertexBot",
  "Bingbot",
  "Applebot",
  "Applebot-Extended",
  "cohere-ai",
  "DuckAssistBot",
  "Bytespider",
  "meta-externalagent",
  "Meta-ExternalFetcher",
  "facebookexternalhit",
  "Amazonbot",
  "AI2Bot",
  "AI2Bot-Dolma",
  "xAI-Bot",
  "PetalBot",
  "YouBot",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ALLOW, disallow: DISALLOW },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
