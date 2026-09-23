import { describe, expect, it } from "vitest";
import { FAQS, SITE_NAME, faqJsonLd, llmsTxt, softwareJsonLd, websiteJsonLd } from "./site";

describe("site facts for AI crawlers", () => {
  it("names HomeLedger in schema and llms.txt", () => {
    expect(softwareJsonLd().name).toBe(SITE_NAME);
    expect(websiteJsonLd()["@type"]).toBe("WebSite");
    expect(faqJsonLd().mainEntity).toHaveLength(FAQS.length);
    expect(llmsTxt().startsWith(`# ${SITE_NAME}`)).toBe(true);
    expect(llmsTxt()).toContain(`> `);
    expect(llmsTxt()).toContain("https://house-exp.vercel.app");
    expect(llmsTxt()).toMatch(/\[About\]/);
  });
});
