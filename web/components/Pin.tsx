export type PinHeat = "high" | "medium" | "low";

export type PinProps = {
  heat: PinHeat;
  selected?: boolean;
  label?: string;
};

// design.md §2/§5: map-only, flashy layer. Mango core (medium heat), chili
// for high heat/urgent, lime ring for low heat/open-now. Selected pin gets
// a stronger mango glow and the sheet syncs to it. Depth via luminescence
// (~30% opacity accent glow, 16-20px blur), not drop shadows. Ported color
// mapping from frontend/js/api.js `heatToPinClass` (bg-map-chili/mango/lime).
const HEAT_COLOR: Record<PinHeat, string> = {
  high: "bg-map-chili",
  medium: "bg-map-mango",
  low: "bg-map-lime",
};

const HEAT_GLOW: Record<PinHeat, string> = {
  high: "shadow-[0_0_16px_4px_rgba(255,59,48,0.35)]",
  medium: "shadow-[0_0_16px_4px_rgba(255,176,32,0.35)]",
  low: "shadow-[0_0_16px_4px_rgba(200,245,66,0.3)]",
};

const HEAT_GLOW_SELECTED: Record<PinHeat, string> = {
  high: "shadow-[0_0_24px_8px_rgba(255,59,48,0.55)]",
  medium: "shadow-[0_0_24px_8px_rgba(255,176,32,0.55)]",
  low: "shadow-[0_0_24px_8px_rgba(200,245,66,0.5)]",
};

export function Pin({ heat, selected = false, label }: PinProps) {
  const size = selected ? "h-5 w-5" : "h-4 w-4";
  const glow = selected ? HEAT_GLOW_SELECTED[heat] : HEAT_GLOW[heat];

  return (
    <div className="flex flex-col items-center gap-1" aria-label={label}>
      <span
        className={`rounded-full border border-map-outline ${size} ${HEAT_COLOR[heat]} ${glow} transition-all ${
          selected ? "ring-2 ring-map-mango ring-offset-2 ring-offset-map-background" : ""
        }`}
      />
      {label && (
        <span className="rounded bg-map-surface/90 px-1.5 py-0.5 font-map-pin text-map-pin text-map-on-surface">
          {label}
        </span>
      )}
    </div>
  );
}
