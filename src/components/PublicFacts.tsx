import Link from "next/link";
import { FAQS, SITE_GITHUB, SITE_NAME, SITE_TAGLINE, SITE_UPDATED, faqJsonLd, howToJsonLd, organizationJsonLd, softwareJsonLd, websiteJsonLd } from "@/lib/site";
import { JsonLd } from "./JsonLd";

export function PublicFacts({
  title = SITE_TAGLINE,
}: {
  title?: string;
}) {
  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={softwareJsonLd()} />
      <JsonLd data={faqJsonLd()} />
      <JsonLd data={howToJsonLd()} />

      <p className="text-[13px] font-medium text-muted">Household expense app</p>
      <h1 className="mt-1 text-[28px] font-semibold tracking-tight">{SITE_NAME}</h1>
      <p className="mt-2 text-[15px] text-muted">{title}</p>
      <div className="ledger-rule mt-4" aria-hidden />

      <section className="mt-6 space-y-3">
        <h2 className="text-[18px] font-semibold">What is HomeLedger?</h2>
        <p className="text-[16px] leading-7">
          HomeLedger is a household expense app for families. Add a spend such as milk for ₹54 or rent, and the app
          files it for your home. Each household stays private. It is a web app built for phones about 390–430px wide,
          not a bank and not a social feed.
        </p>
        <p className="text-[16px] leading-7">
          Sign in with Google or email. Asha’s home and Rohan’s home stay separate. Friends do not see each other’s
          expenses. Updated{" "}
          <time dateTime={SITE_UPDATED}>{SITE_UPDATED}</time>.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-[18px] font-semibold">How do I add an expense?</h2>
        <ol className="list-decimal space-y-2 pl-5 text-[16px] leading-7">
          <li>Tap Add.</li>
          <li>Type what you bought.</li>
          <li>Enter the amount in rupees and save.</li>
        </ol>
        <p className="text-[16px] leading-7 text-muted">
          HomeLedger organises the category. Open the expense if you need to change it. Home shows this month’s
          total. Reports show where the money went.
        </p>
      </section>

      <Link
        href="/login"
        className="press mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-[16px] font-semibold text-on-primary"
      >
        Sign in or create a household
      </Link>

      <section className="mt-10 space-y-5">
        <h2 className="text-[18px] font-semibold">Questions people ask</h2>
        {FAQS.map((item) => (
          <article key={item.q}>
            <h3 className="text-[16px] font-semibold">{item.q}</h3>
            <p className="mt-1 text-[15px] leading-7 text-muted">{item.a}</p>
          </article>
        ))}
      </section>

      <p className="mt-10 text-center text-[13px] text-muted">
        <Link href="/about" className="font-semibold text-primary">
          About HomeLedger
        </Link>
        {" · "}
        <Link href="/llms.txt" className="font-semibold text-primary">
          llms.txt
        </Link>
        {" · "}
        <a href={SITE_GITHUB} className="font-semibold text-primary">
          GitHub
        </a>
      </p>
    </main>
  );
}
