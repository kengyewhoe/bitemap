// Saved-places screen (frontend/saved.html target layout): the signed-in
// user's saved_places joined to place_cards, newest-saved first. Guarded by
// middleware (/saved is in GUARDED_PREFIXES), so `user` is always present.
//
// saved_places.place_id references places(id), not the place_cards view, so
// PostgREST can't embed the join directly — fetch the saved id set, then
// fetch those rows from place_cards (RLS-public, security_invoker) in one
// follow-up query.
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Card } from "@/components/Card";
import { createClient } from "@/lib/supabase/server";
import { halalBadge, priceBandLabel, goodPctLabel } from "@/lib/format";
import { computeGoodPct, type PlaceCardRow } from "@/lib/reshape";

const CARD_COLS =
  "id, name, area, category, halal_status, price_band, good_count, bad_count, photo_url";

type SavedRow = Pick<
  PlaceCardRow,
  "id" | "name" | "area" | "category" | "halal_status" | "price_band" | "good_count" | "bad_count" | "photo_url"
>;

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: savedRows } = user
    ? await supabase
        .from("saved_places")
        .select("place_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] as { place_id: string; created_at: string }[] };

  const placeIds = (savedRows ?? []).map((r) => r.place_id);

  const { data: placeRows } = placeIds.length
    ? await supabase.from("place_cards").select(CARD_COLS).in("id", placeIds)
    : { data: [] as SavedRow[] };

  // Re-order to match the saved (most-recent-first) order — the `in()`
  // query above doesn't preserve it.
  const byId = new Map((placeRows ?? []).map((p) => [p.id, p as SavedRow]));
  const places = placeIds
    .map((id) => byId.get(id))
    .filter((p): p is SavedRow => Boolean(p));

  return (
    <main className="flex flex-1 flex-col gap-4 bg-sheet-background px-gutter pb-28 pt-6 text-sheet-on-surface">
      <h1 className="font-headline-sheet text-headline-sheet">Saved</h1>

      {places.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="font-title-md text-title-md">No saved places yet</p>
          <p className="font-body-md text-body-md text-sheet-on-surface-muted">
            Bookmark a place from the map to see it here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-gutter">
          {places.map((place) => {
            const badge = halalBadge(place.halal_status);
            const chips = [place.category, place.area].filter(
              (v): v is string => Boolean(v)
            );
            return (
              <Link key={place.id} href={`/place/${place.id}`}>
                <Card className="flex gap-4">
                  {place.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={place.photo_url}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg bg-sheet-surface-low" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-title-md text-[16px] text-sheet-on-surface">
                      {place.name}
                    </h3>
                    <p className="mt-0.5 truncate text-[13px] text-sheet-on-surface-muted">
                      {chips.join(" · ")}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 font-label-caps text-[10px] font-semibold uppercase ${
                          badge.tone === "good"
                            ? "bg-secondary-container/40 text-secondary"
                            : badge.tone === "bad"
                              ? "bg-error-container text-on-error-container"
                              : "bg-sheet-surface-low text-sheet-on-surface-muted"
                        }`}
                      >
                        {badge.label}
                      </span>
                      {priceBandLabel(place.price_band) && (
                        <span className="rounded bg-sheet-surface-low px-1.5 py-0.5 font-label-caps text-[10px] font-semibold text-sheet-on-surface-muted">
                          {priceBandLabel(place.price_band)}
                        </span>
                      )}
                      <span className="font-label-caps text-[10px] text-sheet-on-surface-muted">
                        {goodPctLabel(computeGoodPct(place.good_count, place.bad_count))}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Nav active="saved" />
    </main>
  );
}
