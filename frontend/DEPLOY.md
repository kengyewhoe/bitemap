# Deploying the BiteMap frontend to Vercel

Static multi-page Vite app. Each `*.html` is a real page (no SPA router), so no
rewrite rules — Vercel serves the built files directly. `index.html` is a
client-side redirect gateway into `login`/`location`/`home`.

## One-time project setup (Vercel dashboard)

1. **Import** the repo. Set **Root Directory** to `frontend` — the app and
   `vercel.json` live in that subdirectory, not the repo root.
2. Framework preset auto-detects as **Vite** (also pinned in `vercel.json`:
   build `npm run build`, output `dist`).
3. **Environment Variables** — add both, for Production + Preview. These are
   read at build time via `import.meta.env` (see `.env.example`) and embedded
   into the bundle, so a redeploy is required after changing them:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

   (Publishable/anon key only — never the service_role key; the bundle is
   public. RLS is what protects the data.)

## Supabase side

Add the Vercel origins to Supabase Auth → URL Configuration so Google OAuth can
redirect back:

- Site URL / Redirect URLs: the production domain and the `*.vercel.app`
  preview domains, each pointing at `…/location.html` (the `redirectTo` used by
  `signIn()` in `js/api.js`).

## Local

```
cp .env.example .env      # fill both VITE_SUPABASE_* values
npm install
npm run dev               # http://localhost:5173
npm run build             # -> dist/
```
