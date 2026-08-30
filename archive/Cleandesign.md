> **Archived.** Superseded by [`../design.md`](../design.md) (merged 2026-08-30). Kept for history. Touchpoint tokens only — do not apply this system to the basemap.

---
name: Vibrant Culinary Discovery
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#5a4136'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
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
  secondary-container: '#56fbab'
  on-secondary-container: '#007146'
  tertiary: '#515f78'
  on-tertiary: '#ffffff'
  tertiary-container: '#8b99b5'
  on-tertiary-container: '#233148'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb693'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7a3000'
  secondary-fixed: '#59fead'
  secondary-fixed-dim: '#31e193'
  on-secondary-fixed: '#002111'
  on-secondary-fixed-variant: '#005231'
  tertiary-fixed: '#d6e3ff'
  tertiary-fixed-dim: '#b9c7e4'
  on-tertiary-fixed: '#0d1c32'
  on-tertiary-fixed-variant: '#39475f'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-bold:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-caps:
    fontFamily: Be Vietnam Pro
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The design system for this app centers on the tension between culinary excitement and logistical reliability. The personality is "The Expert Friend"—someone who knows the best hidden gems but is organized enough to get you there without a hitch. 

The visual style is a hybrid of **Modern Minimalism** and **Tactile Card Design**. It uses high-energy color accents against a clean, structured backdrop to ensure that while the app feels vibrant, the information remains legible and authoritative. The interface must evoke an immediate emotional response of hunger and curiosity, tempered by the calm of a well-organized map.

- **Primary Motif:** Rounded containment. Every piece of content is housed in a defined container to reduce visual noise.
- **Tone:** Optimistic, efficient, and appetizing.
- **Visual Priority:** High-quality food photography is the hero; UI elements act as the frame.

## Colors

The palette is designed to stimulate the appetite while maintaining professional accessibility. 

- **Primary (Zesty Orange):** Used for primary actions, price indicators, and "Hot Now" markers. It triggers urgency and appetite.
- **Secondary (Fresh Mint):** Reserved for "Credibility Indicators" such as verified reviews, dietary matches (Vegan/GF), and "Open Now" status. It represents freshness and safety.
- **Tertiary (Deep Navy):** The anchor. Used for all primary text, borders, and iconography to provide a grounded, trustworthy contrast to the vibrant accents.
- **Backgrounds:** A soft off-white (`#F8FAFC`) prevents the screen from feeling clinical while allowing the cards to pop via subtle elevation.

## Typography

Typography is clean, modern, and friendly. We use **Plus Jakarta Sans** for headings to take advantage of its soft, geometric curves which feel approachable. For body text and metadata, **Be Vietnam Pro** provides exceptional legibility at small sizes, which is critical for map labels and restaurant details.

- **Headlines:** Use Deep Navy exclusively to maintain authority.
- **Emphasis:** Use Orange for key words within headlines sparingly to draw attention to discovery elements.
- **Hierarchy:** Strict adherence to the `label-caps` for category headers (e.g., "CUISINE TYPE") to ensure users can scan lists quickly without decision fatigue.

## Layout & Spacing

This design system utilizes a **Fluid Grid** with fixed-width margins. The layout is optimized for quick thumb-navigation and scanning.

- **Mobile:** 4-column grid with 16px margins. Content cards generally span the full width to maximize imagery.
- **Desktop/Tablet:** 12-column grid. Discovery feeds reflow into a multi-column masonry or grid layout to show more options at once.
- **Spacing Logic:** Based on a 4px baseline. Components use 16px (`md`) padding for internal content and 24px (`lg`) for vertical section separation.
- **Decision Fatigue Reduction:** Use generous whitespace between different restaurant entities to ensure the eye focuses on one "choice" at a time.

## Elevation & Depth

To emphasize clarity, the system uses **Tonal Layers** combined with **Ambient Shadows**.

1. **Level 0 (Background):** `#F8FAFC` - The canvas.
2. **Level 1 (Cards/Sheet):** White `#FFFFFF` with a 1px border of Deep Navy at 5% opacity. This creates a crisp edge without being heavy.
3. **Level 2 (Active/Hover):** A soft, diffused shadow (`Y: 4, Blur: 12, Opacity: 0.08, Color: Deep Navy`) to indicate interactable elements.

Floating Action Buttons (FABs) like "Map View" use a higher elevation with a slight tint of the Primary Orange in the shadow to make them vibrate against the neutral background.

## Shapes

The shape language is consistently **Rounded** (Level 2). This mimics the friendly, approachable nature of the brand.

- **Small Components (Tags/Badges):** 0.5rem (8px).
- **Standard Components (Buttons/Inputs/Cards):** 1rem (16px).
- **Large Components (Modals/Image Containers):** 1.5rem (24px).

Images should always carry the `rounded-lg` or `rounded-xl` property. Sharp corners are strictly avoided as they feel too clinical/corporate for a food app.

## Components

### Buttons
- **Primary:** Solid Zesty Orange with White text. Bold weight.
- **Secondary:** Transparent with a 2px Deep Navy border.
- **Credibility Badge:** A small Fresh Mint pill with a checkmark icon, used to denote "Top Rated" or "Verified Kitchen."

### Cards
- Restaurant cards feature a 16:9 image top-crop.
- The bottom section contains the title in Deep Navy, a "Distance" label in soft grey, and a prominent "Fresh Mint" rating tag.
- Cards should have a subtle border to separate them from the background on high-brightness screens.

### Inputs
- Search bars are oversized (56px height) with 1rem roundedness and a soft shadow. 
- Use "Search by craving..." as the default placeholder to encourage exploration.

### Credibility Indicators
- A custom "Trust Meter" component—a small horizontal progress bar in Mint Green—appears on restaurant profiles to show the density of positive recent reviews.

### Lists
- Use horizontal scrolling "chips" for categories (e.g., "Pizza," "Late Night," "Outdoor Seating") at the top of the view to keep the main vertical space clear for discovery cards.