// Display helpers ported from frontend/js/api.js (view layer, KL conventions —
// km and RM). Not part of the wire contract; they translate contract enums
// into UI strings/classes.

import type { HalalStatus, Heat, PriceBand } from "./types";

// API heat → existing pin CSS classes (BACKEND.md:40-48).
const HEAT_PIN_CLASS: Record<Heat, string> = {
  high: "bg-map-chili shadow-map-chili",
  medium: "bg-map-mango shadow-map-mango",
  low: "bg-map-lime",
};
export function heatToPinClass(heat: Heat | null | undefined): string {
  return (heat && HEAT_PIN_CLASS[heat]) || HEAT_PIN_CLASS.medium;
}

// price_band enum → RM display labels (never "$").
const PRICE_BAND_LABELS: Record<PriceBand, string> = {
  under_rm10: "Under RM10",
  rm10_25: "RM10–25",
  rm25_50: "RM25–50",
  rm50_plus: "RM50+",
};
export function priceBandLabel(band: PriceBand | null | undefined): string | null {
  return band ? PRICE_BAND_LABELS[band] || null : null;
}

interface HalalBadge {
  label: string;
  tone: "good" | "bad" | "neutral";
}

// halal_status 5-value enum. "unknown" renders plainly, never as "Non-halal".
export const HALAL_FRIENDLY: ReadonlySet<HalalStatus> = new Set([
  "jakim_certified",
  "muslim_owned",
  "pork_free",
]);
const HALAL_BADGES: Record<HalalStatus, HalalBadge> = {
  jakim_certified: { label: "Halal (JAKIM)", tone: "good" },
  muslim_owned: { label: "Muslim-owned", tone: "good" },
  pork_free: { label: "Pork-free", tone: "good" },
  non_halal: { label: "Non-halal", tone: "bad" },
  unknown: { label: "Halal: not confirmed", tone: "neutral" },
};
export function halalBadge(status: HalalStatus | null | undefined): HalalBadge {
  return (status && HALAL_BADGES[status]) || HALAL_BADGES.unknown;
}

// good_pct can be null (< 5 ratings) — never render "null% Good".
export function goodPctLabel(good_pct: number | null): string {
  return good_pct == null ? "Baru — not enough ratings yet" : `${good_pct}% Good`;
}
export function goodPctShort(good_pct: number | null): string {
  return good_pct == null ? "New" : `${good_pct}% Good`;
}

// null when distance is unknown (e.g. search results with no origin) —
// never render "null km".
export function formatKm(distance_km: number | null): string | null {
  return distance_km == null ? null : `${distance_km} km`;
}

// Display dates as DD/MM/YYYY (wire format stays ISO 8601).
export function formatDateDMY(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
