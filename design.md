---
name: BiteMap
colors:
  surface: '#fff8f6'
  surface-dim: '#efd5ca'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1eb'
  surface-container: '#ffeae1'
  surface-container-high: '#fee3d8'
  surface-container-highest: '#f8ddd2'
  on-surface: '#261812'
  on-surface-variant: '#5a4136'
  inverse-surface: '#3d2d26'
  inverse-on-surface: '#ffede6'
  outline: '#8e7164'
  outline-variant: '#e2bfb0'
  surface-tint: '#a04100'
  primary: '#a04100'
  on-primary: '#ffffff'
  primary-container: '#ff6b00'
  on-primary-container: '#572000'
  inverse-primary: '#ffb693'
  secondary: '#006d43'
  on-secondary: '#ffffff'
  secondary-container: '#99f2bd'
  on-secondary-container: '#0a7147'
  tertiary: '#0062a1'
  on-tertiary: '#ffffff'
  tertiary-container: '#059eff'
  on-tertiary-container: '#003357'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb693'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7a3000'
  secondary-fixed: '#9cf5c0'
  secondary-fixed-dim: '#80d8a5'
  on-secondary-fixed: '#002111'
  on-secondary-fixed-variant: '#005231'
  tertiary-fixed: '#d0e4ff'
  tertiary-fixed-dim: '#9ccaff'
  on-tertiary-fixed: '#001d35'
  on-tertiary-fixed-variant: '#00497b'
  background: '#fff8f6'
  on-background: '#261812'
  surface-variant: '#f8ddd2'
  map-background: '#0B0B0C'
  map-surface: '#161618'
  map-on-surface: '#E5E2E3'
  map-outline: '#28282A'
  map-chili: '#FF3B30'
  map-mango: '#FFB020'
  map-lime: '#C8F542'
  map-glow: '#FFB4AA'
  sheet-background: '#F8FAFC'
  sheet-surface: '#FFFFFF'
  sheet-surface-low: '#F2F4F6'
  sheet-on-surface: '#191C1E'
  sheet-on-surface-muted: '#5A6570'
  sheet-outline: rgba(25, 28, 30, 0.08)
  tertiary-dark: '#233148'
typography:
  display-map:
    fontFamily: Anton
    fontSize: 48px
    fontWeight: '400'
    lineHeight: '1.1'
  headline-sheet:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  label-caps:
    fontFamily: Be Vietnam Pro
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
  map-pin:
    fontFamily: DM Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 12px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  sheet-padding: 24px
---

# BiteMap Design System

> **Name:** Dual-layer — Flashy map / Clean touchpoints  
> **Rule:** If it’s **on the map**, it can glow. If it’s a **fact or a vote**, it looks like a quiet card.

**Name:** BiteMap  
**Logo:** Map pin with a bite taken out of it. Draw the mark in **map-mango** (`#FFB020`) on the nocturnal map; on sheets, mango fill or line-art with a mango bite.

---

## 1. Principle

BiteMap has two visual layers on the same screen. They must not blend.

| Layer | Personality | Used for |
|---|---|---|
| **Map** | Nocturnal, cinematic, interactive | Basemap, pins, heat, recenter, “live” pulse |
| **Touchpoints** | Expert friend, editorial, calm | Onboarding cards, list rows, place preview, ratings, buttons, embeds |

The map is the appetite. The sheet is the decision. Restaurant name, distance, hours, clips, and **Good / Bad** never use rubber stamps, Anton-on-chili, or neon fills.

---

## 2. Tokens — Map (flashy)

Use only on the map canvas and map chrome (pins, recenter, heat).

**Colors**

- background: `#0B0B0C` (`map-background`)
- surface: `#161618` (`map-surface`)
- on-surface: `#E5E2E3` (`map-on-surface`)
- outline-map: `#28282A` (`map-outline`)
- chili: `#FF3B30` (`map-chili`) — heat / urgent pin only
- mango: `#FFB020` (`map-mango`) — logo, selected pin, primary map accent
- lime: `#C8F542` (`map-lime`) — open-now / live pulse
- primary-glow: `#FFB4AA` (`map-glow`)

**Typography**

- map-wordmark / `display-map`: Anton, 48px, uppercase, line-height 1.1
- map-pin-label / `map-pin`: DM Sans, 11px, 500

**Map behavior**

- Bite-pin in mango; selected pin = stronger mango glow; sheet snaps to that place.
- Heat = pin size / chili or mango glow — not a chili banner in the sheet.
- Recenter FAB sits above the sheet (mango or chili).
- Depth via luminescence (accent ~30% / 16–20px blur), not heavy drop shadows.

---

## 3. Tokens — Touchpoints (clean)

Use on every restaurant/rating surface: sheet, list row, preview, rating, login card, Directions.

**Colors**

- background: `#F8FAFC` (`sheet-background`)
- surface: `#FFFFFF` (`sheet-surface`)
- surface-container-low: `#F2F4F6` (`sheet-surface-low`)
- on-surface: `#191C1E` (`sheet-on-surface`)
- on-surface-muted: `#5A6570` (`sheet-on-surface-muted`)
- outline: `rgba(25, 28, 30, 0.08)` (`sheet-outline`)
- primary: `#FF6B00` (`primary-container`) — sheet CTAs
- primary-pressed: `#A04100` (`primary`)
- secondary: `#006D43` — mint text; container `#99F2BD` — Legit / Good %
- tertiary: `#233148` (`tertiary-dark`) — titles / icons

App-level warm canvas (off-map chrome, if needed): `background` `#FFF8F6`, `on-surface` `#261812`.

**Typography**

- title / `title-md`: Plus Jakarta Sans, 18px, 600
- headline-sheet: Plus Jakarta Sans, 24px, 700, 32px line-height
- body / `body-md`: Be Vietnam Pro, 15px, 400, 22px line-height
- label-caps: Be Vietnam Pro, 11px, 600, 0.08em tracking, uppercase

**Shape**

- button: 16px (`rounded.lg`)
- card: 16px
- sheet: 24px (`rounded.xl`)
- image: 16px

**Spacing**

- unit: 4px
- gutter / margin-mobile: 16px
- sheet-padding: 24px

---

## 4. Screen composition (core flow)

```
┌─────────────────────────┐
│                         │
│     FLASHY MAP          │  #0B0B0C, mango bite-pins, pinch/pan
│                         │
├─────────────────────────┤
│  CLEAN SHEET            │  #FFFFFF / #F8FAFC
│  Place name             │  Plus Jakarta Sans
│  Area · km              │  Be Vietnam Pro
│  [ Good ]  [ Bad ]      │  segmented control, not a stamp
└─────────────────────────┘
```

- **Home:** Full-bleed interactive map. Place data lives in a **bottom sheet**.
- **Peek:** Name, area, distance, one thumb, compact score.
- **Expand:** Category, hours, 1–3 contained embeds/thumbs, Directions, Good/Bad.
- **Onboarding:** Dimmed map under a clean white login/location card.

---

## 5. Components

### Logo / bite-pin

- Map pin with a bite taken out. Fill `map-mango` on the nocturnal map.

### Map pin

- Mango core; chili for high heat; lime ring if open now.
- Tap → sheet peek. Do not put hours/rating on the pin.

### Bottom sheet

- White, 24px top radius, 24px padding, grabber.
- Border: `sheet-outline`. Syncs with selected mango pin.

### Rating

- Segmented **Good | Bad**. After vote: percent in Be Vietnam Pro, mint (`secondary` / `secondary-container`).
- No Anton stamps, no chili HYPE slap.

### Buttons

- Primary: solid `#FF6B00`, white text, 16px radius — Directions, Log in, Use my location.
- Secondary: transparent, 2px `#233148` border — Browse KL.

### Embeds

- Rounded 16px, contained in the sheet, not edge-to-edge on the map.

---

## 6. Do / don’t

**Do**

- Map stays `#0B0B0C` and glowing. Facts stay on white.
- One sheet CTA in `#FF6B00`. Trust / Legit in mint (`#006D43` / `#99F2BD`).
- Anton only for cinematic map headlines. Plus Jakarta + Be Vietnam Pro on sheets.

**Don’t**

- Rubber stamps or Anton place names on the preview.
- Full-bleed viral cards as restaurant UI.
- Light tiles for the basemap.
