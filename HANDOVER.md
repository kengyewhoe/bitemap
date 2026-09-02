# BiteMap — Handover (single source of truth, keep under 150 lines)

_Last updated 2026-09-02. Owner: standing architect. Edit this, don't fork it. `HANDOVER-auth-deploy-findings.md` is fully folded in — delete it._

## Project

"Right-now KL food map" PWA. Influencer clips -> real places; Good/Bad votes; mobile web; KL only; 1000 DAU target.
**Phase: SHIP. All build waves complete on `feat/production-pwa` @ `b4d413e`. Waiting on the user-only ship checklist below.**

## Locked decisions (all DECIDED)

| Layer | Choice |
|---|---|
| Framework | Next.js App Router + TypeScript, Tailwind (built, tokens from `design.md`), self-hosted fonts |
| Map | MapLibre GL JS. Nocturnal vector style on MapTiler when `NEXT_PUBLIC_MAPTILER_KEY` set; keyless CARTO dark fallback otherwise (works, ships fine) |
| Data | **Thin hybrid.** 3 edge-cached anon read Route Handlers (`/api/nearby`, `/api/places/[id]`, `/api/places/[id]/posts`). Auth, writes (ratings/saves/follows) and `/me` direct via `@supabase/ssr` under RLS. `my_vote` never in cached responses. Never `service_role`. |
| Nearby | Plain-SQL haversine RPC `nearby_places(lat, lng, radius_km)`, radius clamped 50 km. No PostGIS. |
| Schema | Core 6 tables + `place_cards` view + `saved_places`, `follows` (owner-only RLS), least-privilege grants, FK indexes. |
| Runtime deps | Exactly 6: `next, react, react-dom, @supabase/supabase-js, @supabase/ssr, maplibre-gl`. Icons = inline SVG in `components/icons.tsx`; never an icon lib. |
| Auth | Google OAuth only, cookie session via `@supabase/ssr`. `next` param relative-only (`safeNext`). No localStorage session. |
| Security | Per-request CSP nonce in `middleware.ts` (no `script-src 'unsafe-inline'`), Postgres errors masked in handlers, lat/lng validated. |
| Backend | Supabase. dev `ntujoeyymyeawjngyjld` (MCP, read-only) / prod `qqricrkfbdehzqxvzuhp` (CLI only; seed via table editor, never `seed.sql`) |
| Hosting | Vercel (Preview -> dev, Production -> prod). Root `vercel.json` -> `web/`. |

Scope of record: `SPEC.md` section 8 "MVP cut". Contract: `BACKEND_REQUIREMENTS.md` section 8. Design: `design.md`.

## Where we are — all waves COMPLETE

Branch `feat/production-pwa`, 9 commits on top of `main`:

| Commit | What |
|---|---|
| `363f2e7` | Wave 0: scaffold, tokens, fonts, ssr auth, 3 handlers, migrations, PWA shell, components |
| `0f73b73` | Security review #1 fast-follow: grant lockdown, error masking, radius clamp, seed geocoded + published |
| `ce102b3` | Wave 1: `/` map, `/place/[id]`, `/location`, `/follow`, `/me`, middleware guards |
| `f880cb0` | A4: usable keyless map + paint-on-load (from browser smoke) |
| `20164bb` | A1+A2: per-request CSP nonce, FK index migration |
| `d8e6f33` | A6: real `/saved`, `/influencers`, `/influencer/[id]` |
| `031a420` | eslint hygiene |
| `b4d413e` | **MapLibre worker fix** (map was blank black: worker 404 under Turbopack) + a11y 100 |

Verified by coordinator at `b4d413e`: all 11 screens real; build / tsc / eslint clean; 18/18 tests; exactly 6 deps; security review #1 clean (no HIGH/CRITICAL); RLS live-verified; real-browser smoke passes (guards, place page, nearby data, OAuth handoff, map renders real vector tiles).

**MapLibre worker: build dependency.** `web/package.json` `prebuild` runs `scripts/sync-maplibre-worker.mjs`, which copies the worker into `web/public/maplibre-gl/`; the map calls `setWorkerUrl` to that path. **Any build must go through `npm run build`** (Vercel does; a bare `next build` skips prebuild and ships a blank map). Do not commit `public/maplibre-gl/` output if it is gitignored — the prebuild regenerates it.

**Lighthouse mobile (throttled sim)**

| Route | Perf | A11y | Best practices | PWA |
|---|---|---|---|---|
| `/login` | 96 | 100 | 96 | installable |
| `/place/[id]` | 90 | 100 | 96 | installable |
| `/` (map) | **51** (was 45) | 100 | 96 | installable |

## OPEN DECISION for the user — home perf 51 vs target 80

Cause: the `maplibre-gl` bundle (~950 kB, ~52 % unused) parsing on the main thread. Not a bug; the map works. Coordinator will not swap the map library (locked decision).
- **(a) Accept 51 for MVP launch.** Recommended by architect: map is the product, other routes are 90+, real devices beat the throttled sim, and no user-visible defect exists.
- **(b) Fast-follow perf work post-launch:** defer GL load until after first paint of the sheet, or code-split the map route, or a raster-only style. Estimated one wave. Reopen only if real-device RUM (Vercel Speed Insights) shows LCP > 2.5 s.

Default if the user says nothing: (a), then reassess with RUM after launch.

## SHIP CHECKLIST — user-only, execute top to bottom

Coordinator pauses here. Order matters: **3 must finish before 5** (prod without the 4 migrations means `/api/nearby` 500s on launch).

| # | Step | How | Done-check |
|---|---|---|---|
| 1 | MapTiler key (**optional** — keyless fallback works) | Create key at maptiler.com, restrict to `localhost`, `*.vercel.app`, prod domain; set `NEXT_PUBLIC_MAPTILER_KEY` on Vercel Preview + Production and in `web/.env.local` | `/` shows the nocturnal vector style, not CARTO |
| 2 | OAuth redirect URLs on BOTH Supabase projects | Auth > URL Configuration: add `http://localhost:3000/auth/callback`, `https://*.vercel.app/auth/callback`, `https://<prod>/auth/callback`. Google Cloud console authorised redirect = each project's `https://<ref>.supabase.co/auth/v1/callback` | login completes with `sb-*` cookies from localhost, preview and prod |
| 3 | Push migrations + data to prod | `supabase link --project-ref qqricrkfbdehzqxvzuhp && supabase db push` (applies `nearby_places`, `user_state_tables`, `grant_lockdown`, `fk_indexes`), then `supabase link --project-ref ntujoeyymyeawjngyjld`. Seed prod places via table editor or a one-off reviewed SQL with lat/lng + `status='published'`; **never `seed.sql`** | prod `list_migrations` shows all 9; `select count(*) from nearby_places(3.139,101.687,5)` > 0 on prod; advisors clean |
| 4 | Delete legacy `frontend/` | `git rm -r frontend/ && git commit` on `feat/production-pwa` (irreversible by intent) | `npm run build` in `web/` still clean; repo has one app |
| 5 | Merge + prod deploy | Merge `feat/production-pwa` -> `main`, push. In Vercel, ensure the Production deployment builds **latest `main`** with build cache OFF (old prod build predates all of this) | Vercel deployment commit = `main` HEAD |
| 6 | Real-browser smoke on prod | Google login -> `/location` -> map shows pins -> `/place/[id]` vote, second vote locked -> airplane mode reload shows offline shell -> sign-out clears session | all six pass; note the date here |
| 7 | Remove prod password from disk | Delete the `SUPABASE_DB_PASSWORD` line from `~/.zshenv`, restart shell | `grep SUPABASE_DB_PASSWORD ~/.zshenv` empty |

## Open items (post-launch)

| Pri | Item |
|---|---|
| Med | Home perf decision above. |
| Med | Placeholder PWA icons: need real bite-pin artwork (192/512 + maskable). Design task. |
| Low | Next 16 deprecation: `middleware.ts` -> `proxy.ts` (warning only). Single commit; it owns the CSP nonce code, so re-run the browser CSP check after. |
| Low | MapTiler free tier 100k tile loads/month; SW tile cache mitigates. Watch after launch. |
| Low | Restart Claude Code if `.mcp.json --read-only` has not taken effect. |

## How to run / deploy

```bash
cd web && npm i && cp .env.example .env.local     # dev keys (+ MapTiler key optional)
npm run dev                                       # http://localhost:3000
npm run build && npx tsc --noEmit && npm test     # build runs prebuild worker sync

supabase link --project-ref ntujoeyymyeawjngyjld  # dev (default)
supabase db push                                  # migrations to linked project
supabase db reset --linked                        # dev only: re-run seed (NEVER on prod)

git push origin feat/production-pwa               # Vercel preview -> dev
```

Guardrails: MCP = dev, read-only. No `service_role` in app code. Prod reachable only by deliberate CLI link. Never `seed.sql` on prod. Always `npm run build`, never bare `next build`.
