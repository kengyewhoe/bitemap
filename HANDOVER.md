# BiteMap — Handover (living doc, keep under 150 lines)

_Last updated 2026-09-02. Owner: standing architect. Edit this, don't fork it. Supersedes `HANDOVER-auth-deploy-findings.md` (safe to delete)._

## Project

"Right-now KL food map" PWA. Influencer clips -> real places; Good/Bad votes; mobile web; KL only; 1000 DAU target.
**Phase: Wave 1 (core 5 screens -> shippable PWA). Wave 0 complete on `feat/production-pwa` @ `363f2e7`.**

## Locked decisions (all DECIDED)

| Layer | Choice |
|---|---|
| Framework | Next.js App Router + TypeScript, Tailwind (built, tokens from `design.md`), self-hosted fonts |
| Map | MapLibre GL JS, nocturnal custom style, MapTiler free tier tiles (Protomaps later) |
| Data | **Thin hybrid.** 3 edge-cached anon read Route Handlers (`/api/nearby`, `/api/places/[id]`, `/api/places/[id]/posts`). Auth, writes (ratings/saves/follows) and `/me` direct via `@supabase/ssr` under RLS. `my_vote` never in cached responses. Never `service_role`. |
| Nearby | Plain-SQL haversine RPC `nearby_places(lat, lng, radius_km)`. No PostGIS. |
| Schema | Core 6 tables + `place_cards` view + `saved_places`, `follows` (owner-only RLS). |
| Runtime deps | Max 6: `next, react, react-dom, @supabase/supabase-js, @supabase/ssr, maplibre-gl` (5 now; maplibre lands in W1-1). Icons = inline SVG in `components/icons.tsx`, extend it, never add an icon lib. |
| Sequence | Wave 0 foundation (done) -> Wave 1 core 5 (login, location, home/map, place [absorbs rate], me) + follow onboarding = shippable PWA -> Wave 2 (saved, influencers, influencer) |
| Backend | Supabase. dev `ntujoeyymyeawjngyjld` (MCP, read-only) / prod `qqricrkfbdehzqxvzuhp` (CLI only, never seeded) |
| Hosting | Vercel (Preview -> dev, Production -> prod) |
| Auth | Google OAuth only, cookie session via `@supabase/ssr`. No localStorage session. |

Scope of record: `SPEC.md` section 8 "MVP cut". Contract: `BACKEND_REQUIREMENTS.md` section 8. Design: `design.md`.

## Where we are

**Wave 0 COMPLETE** — `feat/production-pwa` @ `363f2e7`. Verified by coordinator: `npm run build` clean (routes `/`, `/api/nearby`, `/api/places/[id]`, `/api/places/[id]/posts`, `/auth/callback`, `/login`, `/manifest.webmanifest`, `/offline`, `/dev/components`, middleware), 18/18 unit tests, `tsc --noEmit` clean, zero localStorage, 5 runtime deps.
- [x] `web/` scaffold, Tailwind tokens, self-hosted fonts, `vercel.json` -> `web/`
- [x] `@supabase/ssr` auth: login, callback code-exchange, middleware guards `/me /saved /follow`, sign-out, no OAuth race
- [x] 3 anon edge-cached read handlers (`my_vote` kept out)
- [x] Migrations applied to dev: `nearby_places` RPC, `saved_places`, `follows`
- [x] PWA manifest, hand-rolled SW (network-first `/api`, cache-first capped tiles), `/offline`, placeholder icons
- [x] Components `Nav BottomSheet Button Card Pin GoodBad icons` + `/dev/components`; tightened CSP
- [ ] **Security review #1: in progress** (findings to be folded in here)

**Earlier done:** schema + RLS + `place_cards` on dev and prod; dev seed (5 creators, 27 places, 47 posts); Vercel headers/env split. `frontend/` demos are throwaway, delete after Wave 1 parity.

## Open items (nothing here may be lost)

| Pri | Item |
|---|---|
| **BLOCKER** | **Seed is invisible.** All 27 dev places are `status='draft'` with no lat/lng, so `nearby_places` returns `[]` and the map is empty. Fix = W1-0 below, before the map screen means anything. |
| High | Migrations `nearby_places`/`saved_places`/`follows` applied to dev only. Push to prod before Wave 1 prod deploy. |
| High | Redeploy prod from latest `main` after Wave 1 merge; re-test Google login in a real browser (Google screen -> callback -> `sb-*` cookies). Old prod build is stale and the demo `login.html` races the redirect; do not patch demos. |
| High | Delete `SUPABASE_DB_PASSWORD` from `~/.zshenv` (prod password in plaintext). |
| Med | CSP `script-src`/`style-src` use `'unsafe-inline'`; security review #1 to assess a nonce path. |
| Med | Icons: Wave 1 needs search, tune, my_location, directions, external-link, etc. Extend `components/icons.tsx` inline SVG. No icon library. |
| Low | Next 16 deprecation: `middleware.ts` -> `proxy.ts` (warning only). Do it in one commit when Next stabilizes the API. |
| Low | Unindexed FKs `follows.creator_id`, `saved_places.place_id`: one cheap index migration. |
| Low | Restart Claude Code so `.mcp.json --read-only` takes effect (if not already). |
| Low | Placeholder PWA icons need the real bite-pin artwork before public launch. |

## Wave 1 — tasks (deliverable + done-check)

Builders read `design.md` sections 4-5 and `BACKEND_REQUIREMENTS.md` section 8 first. All in `web/` unless noted. Shared-file rule: only the named owner edits `components/icons.tsx`, `components/Nav.tsx`, `middleware.ts`, `lib/types.ts`; others request additions via the coordinator.

| # | Task | Deliverable | Done-check |
|---|---|---|---|
| W1-0 | **Seed publish + geocode** (unblocks everything) | New `supabase/seed.sql` revision: each of the 27 places gets real `lat`/`lng` (hand-geocode from name+area; KL bbox 2.95-3.30 / 101.55-101.85), `status='published'`, `area` filled. Keep it idempotent (`on conflict do update`). Re-run on dev only. Add `supabase/ENVIRONMENTS.md` note: prod gets seed via table editor, never `seed.sql`. | `select count(*) from nearby_places(3.139,101.687,5)` > 0 on dev; `curl /api/nearby` returns items with `distance_km`; no place published without lat/lng (check constraint already enforces). |
| W1-1 | **Home map `/`** (adds `maplibre-gl`, the 6th and last dep) | `components/Map.tsx` (client, dynamic import, `ssr:false`), nocturnal style JSON in `lib/mapStyle.ts` on MapTiler vector tiles via `NEXT_PUBLIC_MAPTILER_KEY`, bite-pin markers from `Pin` sized/coloured by heat, recenter + "live" pulse per `design.md` section 2, map centre from `?lat&lng` search params else KL. `app/page.tsx` fetches `/api/nearby` server-side, renders map + `BottomSheet` peek list (name, area, km, score short); tapping a pin opens peek for that place; peek tap -> `/place/[id]`. Owner of `icons.tsx` additions (my_location, search, tune). CSP: add MapTiler `connect-src`/`img-src`/`worker-src blob:`. | Lighthouse mobile perf >= 80; pins render for W1-0 data; `npm ls --prod --depth=0` = 6 deps; no map code runs on server (build has no `window` errors). |
| W1-2 | **Place page `/place/[id]`** | `app/place/[id]/page.tsx` (server: `/api/places/[id]` + `/api/places/[id]/posts`, 404 -> `notFound()`); hero photo w/ credit, name/area/category/halal badge/price band/hours, mention count + `goodPctLabel`, Directions link (Google Maps URL from lat/lng), posts list with **tap-to-load** IG embed (`components/Embed.tsx`, iframe only on tap, CSP `frame-src` for instagram.com/tiktok.com). `components/VotePanel.tsx` (client): on mount if signed in, direct `user_ratings` select for `my_vote`; `GoodBad` locked if voted; vote = direct insert, `23505` -> locked state + toast, unauthenticated -> `/login?next=/place/[id]`; after vote `router.refresh()`. Save button (direct `saved_places` upsert/delete, owner RLS). | Vote round-trip on dev: second vote shows locked; signed-out vote redirects to login and returns; `curl` place 404 shape unchanged; no `my_vote` in any `/api` response. |
| W1-3 | **Onboarding `/location` + `/follow`** | `app/location/page.tsx`: "Use my location" (`navigator.geolocation`, then `router.push('/?lat=&lng=')`) vs "Browse KL" (`/`); dimmed map still under clean card per `design.md` section 4 (static dark bg is fine, no maplibre here). `app/follow/page.tsx`: creators list (direct `creators` select where `is_active`), follow toggle = direct `follows` insert/delete, "Skip" -> `/`. `/auth/callback` `next` param support: login -> callback -> `/location` first time (no `users.last_city` set) else `/`. Owner of `middleware.ts` edits (add `/place/*` vote redirect is NOT middleware; keep guard list `/me /saved /follow`). | Fresh Google login lands on `/location`; geolocation grant recentres map; follow toggles persist across reload (RLS: other user sees none). |
| W1-4 | **Me `/me`** | `app/me/page.tsx` (server, guarded): avatar/name/email from `auth.getUser()`, `users` row (`last_city`, `created_at` as DD/MM/YYYY), counts of my ratings / saves / follows (three direct selects, `count: 'exact', head: true`), sign-out button (existing server action), links to `/saved` and `/follow`. `Nav` active state for Me. | Signed-out `/me` -> `/login`; counts match dev DB for the test user; sign-out lands on `/login` with cookies cleared. |
| W1-5 | **Ship gate** (coordinator, after W1-1..4 merge) | Push 3 migrations to prod; set `NEXT_PUBLIC_MAPTILER_KEY` on Vercel (both envs) + MapTiler key domain restriction; merge to `main`; delete `frontend/` and `/dev/components` route stays; redeploy; real-browser Google login on prod; Lighthouse PWA installable. Update this doc. | Prod URL: login works, map shows pins (prod places seeded via table editor), vote locks, offline shell loads. |

**Parallelism.** W1-0 first (small, ~1 hour). Then W1-1, W1-2, W1-3, W1-4 in parallel — they touch disjoint routes. Shared-file owners: `icons.tsx` -> W1-1; `middleware.ts`, `auth/callback` -> W1-3; `Nav.tsx` -> W1-4; `lib/types.ts` -> nobody (request via coordinator). CSP (`next.config`/`vercel.json` headers) is touched by W1-1 (MapTiler) and W1-2 (frame-src): W1-1 owns it, W1-2 hands its two directives to the coordinator to merge.

## Wave 2 (after Wave 1 ships)

`/saved` (saved_places join place_cards), `/influencers` (creators + follower counts), `/influencer/[id]` (creator + their posts + follow toggle). Index migration for the two FKs lands here.

## Risks (architect watch-list)

- Seed geocoding by hand is error-prone: W1-0 must spot-check 5 places on a map before marking done.
- `maplibre-gl` bundle (~250 kB gz) must be `dynamic(..., {ssr:false})` and only on `/`; do not import it in `layout`.
- SW cache-first on tiles + a changed style JSON = stale style; version the SW cache name on every style change.
- Edge handlers stay anon-only; cookie logic only in middleware / server components.
- MapTiler free tier 100k tile loads/month; watch after launch.

## How to run / deploy

```bash
cd web && npm i && cp .env.example .env.local     # dev keys + MapTiler key
npm run dev                                       # http://localhost:3000
npm run build && npx tsc --noEmit && npm test

supabase link --project-ref ntujoeyymyeawjngyjld  # dev (default)
supabase db push                                  # migrations to linked project
supabase db reset --linked                        # dev only: re-run seed (NEVER on prod)
# prod: link qqricrkfbdehzqxvzuhp, db push, relink to dev.

git push origin feat/production-pwa               # Vercel preview -> dev
```

Guardrails: MCP = dev, read-only. No `service_role` in app code. Prod reachable only by deliberate CLI link.
