# Supabase environments — dev and prod (both cloud)

Two separate Supabase **cloud** projects. No local Docker stack is required.

| Project        | Used by                                   |
| -------------- | ----------------------------------------- |
| `bitemap-dev`  | local `vite dev` **and** Vercel Preview   |
| `bitemap-prod` | Vercel Production only                    |

## Why this protects prod from test data

- The two projects have **different URLs and keys**. Test votes/ratings/seed
  data written against dev live in a different database entirely — there is no
  code path from dev to prod.
- `bitemap-prod`'s keys exist in **exactly one place**: Vercel's Production
  environment variables. They are never in a local `.env`, never in the repo,
  never in Preview. So `vite dev` and preview deployments cannot write to prod.
- **Seeding is always manual and per-project** (`supabase db push` never runs
  `seed.sql`). You seed dev on purpose; you never run the seed against prod.
- The CLI stays linked to **dev** as its default. Deploying to prod is a
  separate, deliberate step (below).

## One-time setup

1. Create both projects in the Supabase dashboard. Note each **project ref**,
   **Project URL**, and **anon/publishable key** (Settings → API). Never use the
   `service_role` key in the frontend or in Vercel.

2. Apply the schema to **dev**, then seed dev:
   ```bash
   npm run db:link -- <dev-ref>     # links the repo to dev (asks DB password)
   npm run db:push                  # applies all migrations to dev
   # seed dev (test data is fine here): paste supabase/seed.sql into the dev
   # project's SQL editor, or:
   psql "<dev connection string>" -f supabase/seed.sql
   ```

3. Apply the schema to **prod** (migrations only — NO seed):
   ```bash
   npm run db:link -- <prod-ref>    # temporarily links prod
   npm run db:push                  # applies migrations to prod
   npm run db:link -- <dev-ref>     # RELINK dev — leave dev as the default
   ```
   Seed prod only with real content, deliberately, once. Never `seed.sql`.

## Wiring the app to each environment

`frontend/js/api.js` reads `import.meta.env.VITE_SUPABASE_URL` +
`VITE_SUPABASE_PUBLISHABLE_KEY` (embedded at build time).

| Where                    | Point at        | How                                       |
| ------------------------ | --------------- | ----------------------------------------- |
| `frontend/.env` (local)  | **dev**         | `cp frontend/.env.example frontend/.env`  |
| Vercel **Preview**       | **dev**         | Vercel → Settings → Environment Variables |
| Vercel **Production**    | **prod**        | same, Production scope only               |

After changing Vercel env vars, redeploy — they are build-time embedded.

## Auth (each project: Authentication → URL Configuration + Providers)

Set per project so redirects only ever return to that environment's own origin:

- **dev**: Site URL `https://<dev-preview-domain>`; redirect
  `https://<dev-preview-domain>/location.html`. (Local also uses dev — add
  `http://localhost:5173/location.html` too.)
- **prod**: Site URL `https://<prod-domain>`; redirect
  `https://<prod-domain>/location.html`.
- **Google provider**: enable in each project. One Google OAuth client per
  project (Google Cloud Console), authorized redirect URI
  `https://<project-ref>.supabase.co/auth/v1/callback`.

## Footguns

- **Never** run `supabase db reset --linked` — it wipes the linked remote and
  reloads `seed.sql`. There is intentionally no npm script for it. `db reset`
  without `--linked` only touches a local stack.
- Keep the repo linked to **dev** between deploys, so a stray `db push` lands on
  dev, not prod.
- Only the **anon** key goes into `.env` / Vercel. The `service_role` key
  bypasses RLS — server-only, never shipped.
