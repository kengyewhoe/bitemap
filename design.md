# BiteMap Design System

> **Name:** Dual-layer — Flashy map / Clean touchpoints  
> **Sources:** [`archive/Flashydesign.md`](archive/Flashydesign.md) (Nocturnal Street Heat) + [`archive/Cleandesign.md`](archive/Cleandesign.md) (Vibrant Culinary Discovery)  
> **Rule:** If it’s **on the map**, it can glow. If it’s a **fact or a vote**, it looks like a quiet card.

---

## 1. Principle

BiteMap has two visual layers on the same screen. They must not blend.

| Layer | Personality | Used for |
|---|---|---|
| **Map** | Nocturnal, cinematic, interactive | Basemap, pins, heat, recenter, “live” pulse |
| **Touchpoints** | Expert friend, editorial, calm | Onboarding cards, list rows, place preview, ratings, buttons, embeds |

The map is the appetite. The sheet is the decision. Restaurant name, distance, hours, clips, and **Good / Bad** never use rubber stamps, Anton-on-chili, or neon fills.

---

## 2. Screen composition (core flow)

```
┌─────────────────────────┐
│                         │
│     FLASHY MAP          │  night tiles, glowing pins, pinch/pan
│                         │
├─────────────────────────┤
│  CLEAN SHEET            │  white/off-white
│  Place name             │  Plus Jakarta + Be Vietnam Pro
│  Area · km              │
│  [ Good ]  [ Bad ]      │  segmented control, not a stamp
└─────────────────────────┘
```

- **Home:** Full-bleed interactive map. Place data lives in a **bottom sheet**, not as loud map labels.
- **Peek:** Name, area, distance, one thumb, compact score.
- **Expand:** Category, hours, 1–3 contained embeds/thumbs, Directions, Good/Bad.
- **Onboarding:** Map still (or live map) *under* a clean white login/location card. Don’t put auth on a neon montage.

---

## 3. Tokens — Map (flashy)

From *Nocturnal Street Heat*. Use **only** on the map canvas and map chrome (pins, recenter, heat).

```yaml
name: Map / Nocturnal Street Heat
colors:
  background: '#0B0B0C'
  surface: '#161618'
  on-surface: '#e5e2e3'
  outline-map: '#28282A'
  chili: '#FF3B30'          # heat / urgent pin only — not Hype stamps on sheets
  mango: '#FFB020'          # selected pin, legit-heat
  lime: '#C8F542'           # open-now pulse, live ring
  primary-glow: '#ffb4aa'
typography:
  map-wordmark:
    fontFamily: Anton
    transform: uppercase
  map-pin-label:            # optional, tiny; prefer no labels — use the sheet
    fontFamily: DM Sans
    fontSize: 11px
rounded:
  pin-glow: 9999px
elevation:
  pin-glow: '0 0 16px 30% accent'
```

**Map behavior**

- Custom pins: accent core + pulsing ring at 50% opacity.
- Selected pin: mango + stronger glow; sheet snaps to that place.
- Heat = pin size / glow, not a chili banner in the sheet.
- Recenter: circular FAB, chili or mango, sits **above** the sheet.
- No traditional drop shadows — **luminescence** (accent at ~30% / 16–20px blur).
- Food stills may appear as pin clusters; they must not replace the clean sheet.

**Do not use on sheets:** Anton headlines, rubber stamps, 2px chili/gold card borders, solid chili primary buttons.

---

## 4. Tokens — Touchpoints (clean)

From *Vibrant Culinary Discovery*. Use on **every** restaurant/rating surface: sheet, list row, preview, rating, login card, Directions.

```yaml
name: Touchpoints / Vibrant Culinary Discovery
colors:
  background: '#F8FAFC'
  surface: '#FFFFFF'
  surface-container-low: '#f2f4f6'
  on-surface: '#191c1e'
  on-surface-muted: '#5a6570'
  outline: 'rgba(25, 28, 30, 0.08)'   # navy at ~5–8%
  primary: '#FF6B00'                  # zesty orange — primary actions only
  primary-pressed: '#a04100'
  on-primary: '#FFFFFF'
  secondary: '#006d43'                # mint/green — open now, positive lean
  secondary-container: '#56fbab'
  tertiary: '#233148'                 # deep navy — titles, icons
  error: '#ba1a1a'
typography:
  title:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: 600
  headline-sheet:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: 700
    lineHeight: 32px
  body:
    fontFamily: Be Vietnam Pro
    fontSize: 15px
    fontWeight: 400
    lineHeight: 22px
  meta:
    fontFamily: Be Vietnam Pro
    fontSize: 13px
    color: muted
  label-caps:
    fontFamily: Be Vietnam Pro
    fontSize: 11px
    fontWeight: 600
    letterSpacing: 0.08em
    transform: uppercase
rounded:
  badge: 8px
  button: 16px
  card: 16px
  sheet: 24px
  image: 16px
spacing:
  unit: 4px
  sheet-padding: 16px
  section-gap: 24px
  margin-mobile: 16px
elevation:
  sheet: 'Y 4 / blur 12 / navy 8%'
  card-border: '1px solid outline'
```

**Touchpoint behavior**

- Generous space between places — one choice at a time.
- Photography is framed (16:9 or 4:5, rounded), not full-bleed under Anton type.
- oEmbed sits in a **contained** player inside the sheet, not edge-to-edge on the map.
- Search (if any): 56px height, 16px radius, soft shadow, placeholder like “Search nearby…”

---

## 5. Typography pairing (when both layers show)

| Role | Face | Layer |
|---|---|---|
| App wordmark on map (optional) | Anton, uppercase | Map only |
| Place name in sheet | Plus Jakarta Sans, navy | Touchpoint |
| Body, address, hours, captions | Be Vietnam Pro | Touchpoint |
| Map debug / tiny pin text | DM Sans | Map only |

Never set a restaurant title in Anton on the sheet.

---

## 6. Components

### Map pin (flashy)

- SVG: mango or chili core, lime ring if open now.
- Pulse on selected. Size by recent mention heat.
- Tap → sheet peek. Do not dump hours/rating onto the pin.

### Bottom sheet (clean)

- White, 24px top radius, grabber, 16px padding.
- Level 1: white + 1px navy 5% border. Level 2 (drag): soft navy shadow.
- Syncs with selected pin (mango pin ↔ this place).

### List row (clean, optional peek list)

- Thumb 64–72px, rounded 12px.
- Title navy, meta muted, distance right-aligned.
- Optional mint pill: “Open” — not a LEGIT stamp.

### Rating (clean)

- Segmented control: **Good | Bad** (or the same two labels you lock in SPEC).
- After vote: `74% Good · 128 ratings` in Be Vietnam Pro, 13px.
- Mint lean for Good %, navy/muted for count.
- **No** tilted Anton stamps, no chili “HYPE” slap.

### Buttons (clean)

- Primary: solid `#FF6B00`, white text, 16px radius — **Directions**, **Log in**, **Use my location**.
- Secondary: transparent, 2px navy border — **Browse KL**, dismiss.
- Do not use chili + Anton for sheet CTAs.

### Credibility / score (clean)

- Small horizontal mint bar or percent — density of Good votes.
- Not a dual chili/gold meter.

### Embeds / thumbs (clean)

- Rounded 16px, 16:9 crop, caption + @handle in muted 13px.
- Fallback: thumb + “Open original” text link.

### Onboarding card (clean)

- Centered white card over dimmed map.
- One headline (Jakarta 24/700), one sub (Vietnam 15), two buttons as above.

---

## 7. Layout

- Mobile-first, 390-wide. 4-column, **16px** side margin on sheets (clean). Map is edge-to-edge (no margin).
- 4px baseline. Sheet internals: 16px pad, 24px between sections.
- Map chrome (search chip, recenter) floats; must not collide with the sheet peek (~38% of viewport).

---

## 8. Motion

| Layer | Motion |
|---|---|
| Map | Pan/zoom, pin pop-in, pulse ring, heat glow |
| Sheet | Snap peek ↔ expand, spring 200–280ms |
| Rating | Segment slide; light haptic optional. No stamp slam |

---

## 9. Do / don’t

**Do**

- Keep map dark and alive; keep facts on white.
- One accent on the map at a time (selected pin).
- One primary orange button per sheet.

**Don’t**

- Chili/mango stamps on ratings.
- Anton place names in the preview.
- Full-bleed viral cards as the restaurant UI.
- Clean light tiles for the basemap (map stays nocturnal).

---

## 10. Core-flow mapping

| Flow | Map layer | Touchpoint layer |
|---|---|---|
| Login + location | Dimmed night map | White auth/permission card |
| Nearby + preview | Interactive map + pins | Peek/expand sheet |
| Good / Bad | Pin can tick after vote (subtle) | Segmented control + % |

---

## 11. Token conflict (resolved)

| Token | Flashy file | Clean file | Live rule |
|---|---|---|---|
| App background | `#0B0B0C` | `#F8FAFC` | Map = flashy; sheet = clean |
| Primary CTA | Chili `#FF3B30` | Orange `#FF6B00` | **Orange on sheets**; chili only on map heat/recenter |
| Display type | Anton | Plus Jakarta | Anton = map wordmark only |
| Body type | DM Sans | Be Vietnam Pro | **Be Vietnam Pro** on all info |
| Rating | Rubber stamp | Mint meter | **Segmented Good/Bad + mint %** |
