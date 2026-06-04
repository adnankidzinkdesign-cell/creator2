This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Database Migrations

Migrations live in `supabase/migrations/` and are named with a timestamp prefix so they apply in order:

```text
supabase/migrations/YYYYMMDDHHMMSS_description.sql
```

For example: `20260508120000_initial_schema.sql`.

**Applying migrations (manual, for now):**

1. Open the [Supabase dashboard](https://supabase.com/dashboard) for your project.
2. Go to **SQL Editor** in the left sidebar.
3. Click **New query**.
4. Open the next un-applied migration file from `supabase/migrations/` and paste its contents.
5. Click **Run** and confirm it succeeds.
6. Apply migrations strictly in timestamp order. Don't skip ahead.

We may switch to the [Supabase CLI](https://supabase.com/docs/guides/cli) later for automated migrations against linked environments — until then, applying by hand keeps the workflow simple.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
