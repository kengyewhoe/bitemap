import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { Nav } from "@/components/Nav";
import { Card } from "@/components/Card";
import { ThemeToggle } from "@/components/ThemeToggle";

type UserRow = {
  display_name: string | null;
  last_city: string;
  role: string;
  created_at: string;
};

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatJoined(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Server component — /me is in the middleware guard list, so an
// unauthenticated request never reaches here. The redirect below is a
// defensive fallback only (e.g. session expired between middleware and
// render).
export default async function MePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: userRow }, ratingsCount, savedCount, followsCount] =
    await Promise.all([
      supabase
        .from("users")
        .select("display_name, last_city, role, created_at")
        .eq("id", user.id)
        .single<UserRow>(),
      supabase
        .from("user_ratings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("saved_places")
        .select("place_id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("follows")
        .select("creator_id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

  const displayName = userRow?.display_name ?? "BiteMap user";
  const lastCity = userRow?.last_city ?? "KL";
  const role = userRow?.role ?? "user";
  const joined = userRow?.created_at ? formatJoined(userRow.created_at) : null;

  return (
    <main className="flex flex-1 flex-col bg-sheet-background px-gutter pb-28 pt-6 text-sheet-on-surface">
      <section className="mb-10 flex flex-col items-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-sheet-surface bg-primary-container/15 font-headline-sheet text-headline-sheet text-tertiary-dark shadow-sm">
          {initials(userRow?.display_name ?? null)}
        </div>
        <h2 className="mt-4 font-headline-sheet text-headline-sheet">
          {displayName}
        </h2>
        <p className="text-sheet-on-surface-muted">{user.email ?? ""}</p>
        <p className="mt-1 text-body-md text-sheet-on-surface-muted">
          {lastCity}
          {joined ? ` · joined ${joined}` : ""}
          {role !== "user" ? ` · ${role}` : ""}
        </p>
        <p className="mt-3 text-body-md text-sheet-on-surface-muted">
          {ratingsCount.count ?? 0} ratings · {savedCount.count ?? 0} saved ·{" "}
          {followsCount.count ?? 0} following
        </p>
      </section>

      <nav aria-label="Account links" className="mb-6 flex flex-col gap-2">
        <a
          href="/saved"
          className="rounded-lg border border-sheet-outline bg-sheet-surface px-4 py-3 font-title-md text-title-md"
        >
          Saved places
        </a>
        <a
          href="/influencers"
          className="rounded-lg border border-sheet-outline bg-sheet-surface px-4 py-3 font-title-md text-title-md"
        >
          Influencers I follow
        </a>
      </nav>

      <Card className="mb-6">
        <h3 className="mb-2 font-label-caps text-label-caps uppercase text-sheet-on-surface-muted">
          Account
        </h3>
        <p className="text-body-md text-sheet-on-surface-muted">
          Signed in with Google. Linked accounts are backend-owned.
        </p>
      </Card>

      <div className="mb-6">
        <ThemeToggle />
      </div>

      <form action={signOut}>
        <button
          type="submit"
          className="w-full rounded-lg border border-error-container bg-sheet-surface py-4 font-title-md text-title-md text-error"
        >
          Sign out
        </button>
      </form>

      <Nav active="me" />
    </main>
  );
}
