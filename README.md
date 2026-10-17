# HomeLedger

Simple spending. A better home.

Live: https://homeledger-olive.vercel.app
GitHub: https://github.com/abuzar310/homeledger

A mobile-first household expense app. Add Milk and ₹54 in a few seconds. The app organises the rest.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase Auth, Postgres, Storage, and Row Level Security

## Local setup

1. Copy `.env.example` to `.env.local` and add your Supabase URL and anon key.
2. In the Supabase SQL editor, run `supabase/migrations/0001_init.sql` through `0004_prod_ready.sql` in order.
3. Email sign-in works immediately when confirmation is off (autoconfirm).
4. Google: create a Web OAuth client in Google Cloud. Authorized JavaScript origins are your app URL and `http://localhost:3000`. Authorized redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`. Put the client ID and secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and run `node scripts/enable-google-auth.mjs`.
5. Optional Gemini: create a Google AI Studio key and set `GOOGLE_API_KEY` in `.env.local` and Vercel. Never prefix it with `NEXT_PUBLIC_`. The app still works without it.
6. Install and start:

```bash
npm install
npm run dev
```

Open the app on a phone-width viewport (390–430px).

## Scripts

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Optional demo expenses, after you have created an account:

```bash
SEED_EMAIL=you@example.com node scripts/seed-demo.mjs
```

This needs `SUPABASE_SERVICE_ROLE_KEY` in the environment. Never put that key in frontend code.

## Product

- Quick add and detailed add
- Automatic category, merchant, and channel from local rules
- Optional Gemini (`GOOGLE_API_KEY`) on Add (unknown names + receipt fill), Home, and Reports
- Purchases with optional line items and receipt photos
- Home, transactions, reports, export (CSV / Excel / PDF)
- Google or email login, profile, and one isolated household per account
