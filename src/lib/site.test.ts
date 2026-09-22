import { describe, expect, it } from "vitest";
import { FAQS, SITE_NAME, faqJsonLd, llmsTxt, softwareJsonLd } from "./site";

describe("site facts for AI crawlers", () => {
  it("names HomeLedger in schema and llms.txt", () => {
    expect(softwareJsonLd().name).toBe(SITE_NAME);
    expect(faqJsonLd().mainEntity).toHaveLength(FAQS.length);
    expect(llmsTxt()).toContain(SITE_NAME);
    expect(llmsTxt()).toContain("https://house-exp.vercel.app");
  });
});
