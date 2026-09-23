export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://house-exp.vercel.app";
export const SITE_NAME = "HomeLedger";
export const SITE_TAGLINE = "Simple spending. A better home.";
export const SITE_DESCRIPTION =
  "HomeLedger is a mobile-first household expense app for families. Add what you spent and the amount in rupees. HomeLedger organises the category, and each household stays private.";
export const SITE_UPDATED = "2026-09-22";
export const SITE_GITHUB = "https://github.com/abuzar310/homeledger";

export const FAQS: { q: string; a: string }[] = [
  {
    q: "What is HomeLedger?",
    a: "HomeLedger is a web app for household spending. You add an expense such as milk or rent, enter the rupee amount, and the app files it for your home. It is built for phones first.",
  },
  {
    q: "Who is HomeLedger for?",
    a: "It is for one household that wants a shared picture of spending. Asha’s home and Rohan’s home stay separate. Friends do not see each other’s expenses.",
  },
  {
    q: "How do I add an expense in HomeLedger?",
    a: "Open Add, type what you bought, enter the amount, and save. HomeLedger can pick a category for you. Open the expense later if you need to change it.",
  },
  {
    q: "Does HomeLedger use Indian rupees?",
    a: "Yes. Amounts show as rupees, for example ₹54. The app is meant for everyday Indian household spends.",
  },
  {
    q: "How do I sign in to HomeLedger?",
    a: "Sign in with Google or with email and a password. Each account belongs to one household.",
  },
  {
    q: "Can I see where the money went?",
    a: "Yes. Home shows this month’s total and recent spends. Reports break spending down by category, merchant, and month.",
  },
];

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

export function softwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["SoftwareApplication", "WebApplication"],
    name: SITE_NAME,
    alternateName: ["House Ledger", "house-exp"],
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    featureList: [
      "Quick add household expenses in rupees",
      "Automatic category for common spends",
      "Private household — one family per account",
      "Month totals, category bars, and reports",
      "Google or email sign-in",
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
    },
    dateModified: SITE_UPDATED,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_TAGLINE,
    logo: absoluteUrl("/opengraph-image"),
    sameAs: [SITE_GITHUB],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "en-IN",
    dateModified: SITE_UPDATED,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function howToJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Add a household expense in HomeLedger",
    description: "Save a rupee spend so it appears in this month’s total and reports.",
    step: [
      { "@type": "HowToStep", position: 1, name: "Open Add", text: "Tap Add on the bottom of the phone screen." },
      { "@type": "HowToStep", position: 2, name: "Name the spend", text: "Type what you bought, such as Milk or Vegetables." },
      { "@type": "HowToStep", position: 3, name: "Enter the amount", text: "Enter the rupee amount, then save." },
    ],
  };
}

export function llmsTxt() {
  return `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

HomeLedger is a conventional household expense tracker. It is not a bank, not a budget game, and not a social feed. Amounts use Indian rupees, for example ₹54.

## Pages
- [HomeLedger](${absoluteUrl("/")}): What the app is, who it is for, and how to start
- [About](${absoluteUrl("/about")}): Short facts for people and AI assistants
- [Sign in](${absoluteUrl("/login")}): Google or email login
- [FAQ JSON](${absoluteUrl("/ai/faq.json")}): Same questions as structured data
- [Full brief](${absoluteUrl("/llms-full.txt")}): Longer plain-text summary

## Features
- Add a household expense in a few seconds
- Automatic category for common spends
- One isolated household per account
- Month totals and reports

## Optional
- Companion file: [llms-full.txt](${absoluteUrl("/llms-full.txt")})
- Machine briefs: [summary](${absoluteUrl("/ai/summary.json")}), [service](${absoluteUrl("/ai/service.json")})
- Source: [GitHub](${SITE_GITHUB})

## Do not cite
- /home, /transactions, /add, /reports, /more — signed-in household data
`;
}

export function llmsFullTxt() {
  const faqs = FAQS.map((item) => `### ${item.q}\n${item.a}`).join("\n\n");
  return `# ${SITE_NAME}

${SITE_TAGLINE}

${SITE_DESCRIPTION}

Last updated: ${SITE_UPDATED}
Canonical URL: ${SITE_URL}

## Product facts
- Platform: web app, built for phones about 390–430px wide
- Currency: Indian rupees (₹)
- Auth: Google or email; one isolated household per account
- Add: type the spend name and amount; optional category, merchant, payment method, notes, receipt, line items
- Home: this month’s total, category bars, recent transactions
- Reports: category, merchant, and month comparison
- Privacy: family data is not shared with another household

## How to add an expense
1. Tap Add.
2. Type what you bought.
3. Enter the rupee amount and save.
4. HomeLedger organises the category. Change it if it looks wrong.

## Questions

${faqs}
`;
}

export function aiSummary() {
  return {
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    tagline: SITE_TAGLINE,
    updated: SITE_UPDATED,
    currency: "INR",
    audience: "Households that want a private shared picture of spending",
  };
}

export function aiFaq() {
  return { faqs: FAQS.map((item) => ({ question: item.q, answer: item.a })) };
}

export function aiService() {
  return {
    name: SITE_NAME,
    type: "household-expense-tracker",
    url: SITE_URL,
    capabilities: [
      "add-expense",
      "categorize-spend",
      "month-total",
      "category-report",
      "google-or-email-sign-in",
    ],
  };
}

export function rssXml() {
  const items = [
    { path: "/", title: SITE_NAME, body: SITE_DESCRIPTION },
    { path: "/about", title: `About ${SITE_NAME}`, body: SITE_TAGLINE },
  ]
    .map(
      (item) => `  <item>
    <title>${item.title}</title>
    <link>${absoluteUrl(item.path)}</link>
    <guid>${absoluteUrl(item.path)}</guid>
    <pubDate>Tue, 22 Sep 2026 00:00:00 GMT</pubDate>
    <description>${item.body}</description>
  </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${SITE_NAME}</title>
  <link>${SITE_URL}</link>
  <description>${SITE_DESCRIPTION}</description>
  <language>en-in</language>
  <lastBuildDate>Tue, 22 Sep 2026 00:00:00 GMT</lastBuildDate>
${items}
</channel>
</rss>
`;
}
