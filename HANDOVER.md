# BiteMap — Handover (living doc, keep under 150 lines)

_Last updated 2026-09-02. Owner: standing architect. Edit this, don't fork it. Supersedes `HANDOVER-auth-deploy-findings.md` (safe to delete)._

## Project

"Right-now KL food map" PWA. Influencer clips -> real places; Good/Bad votes; mobile web; KL only; 1000 DAU target.
**Phase: Wave 0 (foundation) of the Next.js rewrite. Backend live. `frontend/` demos are throwaway.**

## Locked decisions (all DECIDED)

| Layer | Choice |
|---|---|
| Framework | Next.js App Router + TypeScript, Tailwind (built, tokens from `design.md`), self-hosted fonts (Plus Jakarta Sans, Be Vietnam Pro, Anton for map only) |
| Map | MapLibre GL JS, nocturnal custom style, MapTiler free tier tiles (Protomaps later) |
| Data | **Thin hybrid.** 3 edge-cached read Route Handlers (`/api/nearby`, `/api/places/[id]`, `/api/places/[id]/posts`) via anon client. Auth, writes (ratings, saves, follows) and `/me` go direct from the app via `@supabase/ssr` under RLS. Never `service_role`. |
| Nearby | Plain-SQL haversine RPC `nearby_places(lat, lng, radius_km)`. No PostGIS. |
| Schema adds | `saved_places(user_id, place_id)` + `follows(user_id, creator_id)`, RLS owner-only. All 11 screens get real data. |
| Runtime deps | Exactly 6: `next, react, react-dom, @supabase/supabase-js, @supabase/ssr, maplibre-gl`. No UI kit, state lib, query lib, Zod, PWA plugin. |
| Sequence | Wave 0 foundation -> Wave 1 core 5 (login, location, home/map, place [absorbs rate], me) + manifest/SW = shippable PWA -> Wave 2 remaining (follow, saved, influencers, influencer) |
| Backend | Supabase. dev `ntujoeyymyeawjngyjld` (MCP, read-only) / prod `qqricrkfbdehzqxvzuhp` (CLI only, never seeded) |
| Hosting | Vercel (Preview -> dev, Production -> prod) |
| Auth | Google OAuth only, cookie session via `@supabase/ssr`. `session.js` localStorage mirror is NOT ported. |

MVP scope of record: `SPEC.md` section 8 "MVP cut". Data contract: `BACKEND_REQUIREMENTS.md` section 8. Design: `design.md`.

## Where we are

**Done**
- [x] Schema live on dev + prod: `users, creators, platform_accounts, places, posts, user_ratings`, `place_cards` view (security_invoker), RLS, `handle_new_user` trigger. 5 migrations in `supabase/migrations/`.
- [x] Seed on dev (27 places, 47 posts, 5 creators). Advisors clean.
- [x] `frontend/js/api.js` data layer proven against RLS (nearby/place/posts/rating/me/auth). Port its reshapers, not its session code.
- [x] Vercel deploy + security headers + env split.

**In flight: Wave 0** (task list below). Repo target: `web/` next to `frontend/`; `frontend/` deleted when Wave 1 reaches parity.

**Carried-over ops items (do not lose)**
- [ ] Delete `SUPABASE_DB_PASSWORD` from `~/.zshenv` (prod password in plaintext on disk).
- [ ] Restart Claude Code so `.mcp.json --read-only` takes effect.
- [ ] Prod deploy is stale (predates OAuth wiring) and `login.html` races the redirect. Resolved by Wave 1 shipping; do not patch the demos. After Wave 1: redeploy prod from latest `main`, re-test Google sign-in in a real browser (expect Google screen -> callback -> cookie session).

## Wave 0 — foundation tasks (delegate one per builder)

Each task: deliverable + done-check. All in `web/` unless noted. Builders read `design.md` and `BACKEND_REQUIREMENTS.md` section 8 first.

| # | Task | Deliverable | Done-check |
|---|---|---|---|
| W0-1 | Scaffold + tokens + fonts | `web/` Next.js App Router TS, Tailwind config with `design.md` tokens (map + touchpoint palettes, radii, shadows), fonts self-hosted via `next/font/local` in `web/fonts/`, `app/layout.tsx` with viewport/theme-color meta, `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_MAPTILER_KEY`), root `vercel.json` repointed to `web/`. `package.json` has exactly the 6 runtime deps. | `npm run build` clean; `/` renders a token swatch page; `npm ls --prod --depth=0` shows 6 deps. |
| W0-2 | Migrations: `nearby_places` RPC | `supabase/migrations/<ts>_nearby_places.sql`: `security invoker` SQL function over `place_cards` returning card columns + `distance_km` (haversine, rounded 1dp), ordered by distance, `limit 200`; grant execute to `anon, authenticated`. | Applied on dev via CLI; `select * from nearby_places(3.139,101.687,5)` returns rows with `distance_km`; advisors clean. |
| W0-3 | Migrations: `saved_places` + `follows` | `<ts>_saved_places_follows.sql`: both tables, PK `(user_id, x_id)`, FK cascade, `created_at`, RLS enabled, policies select/insert/delete `auth.uid() = user_id` only, grants to `authenticated`. | Applied on dev; as anon `select` returns 0 rows / insert fails; advisors clean. |
| W0-4 | Supabase clients + auth | `lib/supabase/{browser,server,middleware}.ts` per `@supabase/ssr` docs; `middleware.ts` refreshes session and redirects unauthenticated `/me`, `/saved`, `/follow` to `/login`; `app/auth/callback/route.ts` exchanges code, redirects to `/location`; `app/login/page.tsx` with Google button (`signInWithOAuth`, redirectTo = callback, NO manual navigation after); sign-out server action. No localStorage session anywhere. | Manual: login -> Google -> back with `sb-*` cookies; `/me` guarded; sign-out clears. `grep -r localStorage web/` finds nothing auth-related. |
| W0-5 | Types + reshapers | `lib/types.ts` (DTOs from contract section 8: NearbyItem, PlaceDetail, Post, Me, ApiError), `lib/reshape.ts` porting `nearbyDto/detailDto/latestMention/withAt/computeGoodPct` from `frontend/js/api.js`, `lib/format.ts` porting display helpers (`priceBandLabel`, `halalBadge`, `goodPctLabel`, `formatKm`, `formatDateDMY`). Drop client haversine (RPC supplies distance). | Unit tests (`node --test` or vitest, dev dep only) cover good_pct null <5, `@` handling, null latest_mention. `tsc --noEmit` clean. |
| W0-6 | 3 read Route Handlers | `app/api/nearby/route.ts` (calls `nearby_places` RPC; KL fallback when no lat/lng; kl_trending fallback when empty), `app/api/places/[id]/route.ts` (404 `PLACE_NOT_FOUND`), `app/api/places/[id]/posts/route.ts`. Anon client, `export const runtime='edge'`, `Cache-Control: s-maxage=60, stale-while-revalidate=300`. Error body `{code,message}` per contract. `my_vote` is NOT here (client fetches own rating direct). | `curl` each against dev returns contract-shaped JSON; 404 shape correct; response has cache header. |
| W0-7 | PWA manifest + SW | `app/manifest.ts`, icons (192/512 + maskable) from bite-pin logo, `public/sw.js` (~30 lines: precache shell, network-first for `/api/*`, cache-first for MapTiler tiles capped at ~200 entries), registration in layout client component. Vercel headers file carries CSP updated for MapTiler + Supabase. | Lighthouse PWA installable on preview; offline reload shows app shell. |
| W0-8 | Shared components | `components/{Nav,BottomSheet,Button,Card,Pin,GoodBad}.tsx`. BottomSheet: peek/expand, drag via pointer events, no lib. GoodBad: segmented control, locked state, per `design.md` section 5. Pin: heat -> mango/chili/lime. Nav: bottom tab bar (Map, Saved, Creators, Me). | `/dev/components` demo route renders all states; matches `design.md` do/don't; no new deps. |

Order: W0-1 first (everything depends on it). W0-2/3/5/7 parallel after. W0-4 and W0-6 after W0-5. W0-8 after W0-1, parallel with the rest.

## Wave 1 / 2 (after Wave 0 ratified)

Wave 1: `/login`, `/location`, `/` (map + sheet), `/place/[id]` (posts embeds tap-to-load, Good/Bad direct insert, 23505 -> locked), `/me`. Ship to prod, verify login. Delete `frontend/`.
Wave 2: `/saved`, `/follow`, `/influencers`, `/influencer/[id]` on the new tables.

## Risks (architect watch-list)

- Edge Route Handlers + `@supabase/ssr` middleware: keep handlers anon-only so no cookie logic runs at the edge.
- MapTiler free tier: 100k tile loads/month; SW tile cache is the mitigation. Add key domain restriction.
- SW caching `/api/*` can serve stale vote counts; network-first mitigates, never cache-first.
- `place_cards` full scan in RPC is fine at hundreds of rows; add an index note when >5k.

## How to run / deploy

```bash
# New app (Wave 0+)
cd web && npm i && cp .env.example .env.local     # dev project keys + MapTiler key
npm run dev                                       # http://localhost:3000
npm run build && npx tsc --noEmit

# Supabase
supabase link --project-ref ntujoeyymyeawjngyjld  # dev (default)
supabase db push                                  # migrations to linked project
# prod: link qqricrkfbdehzqxvzuhp, db push, relink to dev. NEVER seed prod.

# Deploy: git push origin main -> Vercel (root vercel.json points at web/ after W0-1)
```

Guardrails: MCP = dev, read-only. No `service_role` in app code. Prod reachable only by deliberate CLI link.
