> **Archived.** Superseded by [`../design.md`](../design.md) (merged 2026-08-30). Kept for history. Map tokens only — do not apply this system to restaurant sheets or ratings.

---
name: Nocturnal Street Heat
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#3a393a'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e5e2e3'
  on-surface-variant: '#e7bdb7'
  inverse-surface: '#e5e2e3'
  inverse-on-surface: '#313031'
  outline: '#ad8883'
  outline-variant: '#5d3f3b'
  surface-tint: '#ffb4aa'
  primary: '#ffb4aa'
  on-primary: '#690003'
  primary-container: '#ff5545'
  on-primary-container: '#5c0002'
  inverse-primary: '#c0000a'
  secondary: '#ffbd58'
  on-secondary: '#442b00'
  secondary-container: '#ea9f00'
  on-secondary-container: '#5b3b00'
  tertiary: '#abd61f'
  on-tertiary: '#283500'
  tertiary-container: '#7b9c00'
  on-tertiary-container: '#222e00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad5'
  primary-fixed-dim: '#ffb4aa'
  on-primary-fixed: '#410001'
  on-primary-fixed-variant: '#930005'
  secondary-fixed: '#ffddb1'
  secondary-fixed-dim: '#ffba4b'
  on-secondary-fixed: '#291800'
  on-secondary-fixed-variant: '#624000'
  tertiary-fixed: '#c6f340'
  tertiary-fixed-dim: '#abd61f'
  on-tertiary-fixed: '#161f00'
  on-tertiary-fixed-variant: '#3b4d00'
  background: '#131314'
  on-background: '#e5e2e3'
  surface-variant: '#353436'
typography:
  display-hero:
    fontFamily: Anton
    fontSize: 80px
    fontWeight: '400'
    lineHeight: 80px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Anton
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 48px
  headline-lg-mobile:
    fontFamily: Anton
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 36px
  headline-md:
    fontFamily: Anton
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 28px
  stamp-label:
    fontFamily: Anton
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.05em
  body-lg:
    fontFamily: DM Sans
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
  body-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.02em
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
  margin-mobile: 20px
  margin-desktop: 40px
  card-gap: 12px
---

## Brand & Style

The design system is engineered for "The Midnight Cravings"—a high-energy, nocturnal aesthetic that captures the raw, neon-lit essence of Kuala Lumpur’s street food scene. It moves away from the sterile, polite interfaces of traditional delivery apps in favor of a **Cinematic Brutalism** style. 

The UI functions as a dark canvas that pushes high-saturation food photography to the forefront. It leverages high-contrast typography, rubber-stamp motifs, and glowing indicators to create a "viral" atmosphere. The aesthetic is loud, "sticky," and optimized for social media screengrabs, echoing the fast-paced, high-impact energy of TikTok and Instagram Reels.

## Colors

The palette is strictly nocturnal, utilizing a deep near-black base to eliminate interface distraction.

*   **Primary (Chili Red - #FF3B30):** Represents "HYPE" and heat. Used for urgent calls to action, trending spots, and high-intensity notifications.
*   **Secondary (Mango Gold - #FFB020):** Represents "LEGIT" status. Used for influencer-verified spots, rewards, and premium highlights.
*   **Tertiary (Lime - #C8F542):** Represents "LIVE" energy. Used for "Open Now" status, real-time heat maps, and active community pulses.
*   **Neutral/Surface:** The background is `#0B0B0C`, while interactive cards use `#161618` to provide subtle depth without breaking the dark immersion.

## Typography

This design system uses a high-contrast pairing to balance impact with readability.

*   **Display & Headlines:** Anton is used for all major headers and "stamps." It must always be uppercase. For maximum "TikTok energy," use tight line heights and slight negative letter spacing on larger sizes.
*   **Body & Utility:** DM Sans provides a clean, neutral counterpoint. It ensures that address details, reviews, and functional labels remain legible against dark, complex backgrounds.
*   **Hierarchy:** Use the `display-hero` sparingly for location names or high-impact editorial titles.

## Layout & Spacing

The layout follows a **Fluid Grid** model with an aggressive, tight rhythm.

*   **Mobile:** 4-column grid with 20px side margins. Content should feel "packed" and energetic.
*   **Desktop/Tablet:** 12-column grid, but centered with a max-width of 1200px to maintain the intimacy of the mobile experience.
*   **Rhythm:** Uses a 4px base unit. Gaps between related elements (like food tags and titles) should be tight (4px-8px) to create a "sticky" visual clusters.

## Elevation & Depth

This system rejects traditional shadows in favor of **Tonal Layering** and **Luminescence**.

*   **Surfaces:** Depth is created by placing `#161618` (Surface) over `#0B0B0C` (Background). 
*   **Borders:** Instead of shadows, use 2px solid borders for cards to define shape. Use `#28282A` for standard cards and the Accent colors (Red/Gold/Lime) for high-priority items.
*   **Glow:** Use "Neon Diffusions" for active states. This is a subtle outer glow (drop-shadow with 15px-20px blur) using the accent color's hex at 30% opacity to simulate street lights on asphalt.

## Shapes

The shape language is "Boldly Rounded." Elements use a consistent 24px radius (`rounded-xl` context) for cards to create a modern, high-end feel that contrasts with the aggressive typography.

*   **Cards:** 24px corner radius.
*   **Buttons/Inputs:** 12px corner radius.
*   **Stamps:** 4px radius with a slight (2-degree) rotation to mimic a physical rubber stamp.

## Components

*   **Rubber STAMP UI:** These are the primary badges for "LEGIT" or "HYPE." They use the Anton font, thick 3px borders, and are tilted 2-3 degrees. They should look like they were slapped onto the food photography.
*   **Glowing Map Pins:** Custom SVGs with a central dot in the accent color and a pulsing 50% opacity outer ring.
*   **Cards:** Photography-first. Text overlays should use a heavy bottom-to-top black gradient (0% to 80% opacity) to ensure the white/accent type pops.
*   **Buttons:** Primary buttons are solid Chili Red with black Anton text. Secondary buttons are outlined with Mango Gold.
*   **Input Fields:** Ghost style. Dark background, 2px charcoal border, turning Tertiary Lime when focused.
*   **Heat Bar:** A thin, horizontal progress bar used on cards to show "Live Crowd" levels using the Lime accent color.