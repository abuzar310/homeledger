import type { MetadataRoute } from "next";
import { SITE_UPDATED, absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), lastModified: SITE_UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/about"), lastModified: SITE_UPDATED, changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/login"), lastModified: SITE_UPDATED, changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/llms.txt"), lastModified: SITE_UPDATED, changeFrequency: "monthly", priority: 0.3 },
  ];
}
