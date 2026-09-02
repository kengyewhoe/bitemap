// GET /api/places/:id/posts — BACKEND_REQUIREMENTS.md §8.4.
//
// Reproduces frontend/js/api.js's getPlacePosts query: creators!inner and
// platform_accounts!inner joins, filtered to renderable, non-self-interest
// posts (is_self_interest = false, ingest_status in ready/matched — the same
// filter the place_cards view uses for mention_count), newest first.
// Edge-cached, anon-only.
import { NextResponse } from "next/server";
import type { Creator, Post } from "@/lib/types";
import { anonClient, errorBody, PLACE_NOT_FOUND, READ_CACHE_CONTROL } from "@/app/api/_supabase";

interface PostRow {
  id: string;
  platform: string;
  post_url: string;
  thumbnail_url: string | null;
  media_kind: string;
  posted_at: string;
  is_sponsored: boolean;
  content_summary: string | null;
  creators: { id: string | null; display_name: string | null; avatar_url: string | null } | null;
  platform_accounts: { handle: string | null } | null;
}

function withAt(handle: string | null | undefined): string | null {
  if (!handle) return handle ?? null;
  return handle.startsWith("@") ? handle : `@${handle}`;
}

function postDto(p: PostRow): Post {
  const creator: Creator = {
    id: p.creators?.id ?? null,
    handle: withAt(p.platform_accounts?.handle),
    display_name: p.creators?.display_name ?? null,
    avatar_url: p.creators?.avatar_url ?? null,
  };
  return {
    id: p.id,
    platform: p.platform,
    post_url: p.post_url,
    thumbnail_url: p.thumbnail_url,
    media_kind: p.media_kind,
    posted_at: p.posted_at,
    is_sponsored: p.is_sponsored,
    content_summary: p.content_summary,
    creator,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = anonClient();

  const { data: place, error: placeErr } = await supabase
    .from("place_cards")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (placeErr) {
    console.error("GET /api/places/[id]/posts: place_cards query failed", placeErr);
    return NextResponse.json(
      errorBody("DB_ERROR", "Something went wrong."),
      { status: 500 }
    );
  }
  if (!place) {
    return NextResponse.json(PLACE_NOT_FOUND, { status: 404 });
  }

  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, platform, post_url, thumbnail_url, media_kind, posted_at, is_sponsored, " +
        "content_summary, creators!inner(id, display_name, avatar_url), " +
        "platform_accounts!inner(handle)"
    )
    .eq("place_id", id)
    .eq("is_self_interest", false)
    .in("ingest_status", ["ready", "matched"])
    .order("posted_at", { ascending: false });

  if (error) {
    console.error("GET /api/places/[id]/posts: posts query failed", error);
    return NextResponse.json(
      errorBody("DB_ERROR", "Something went wrong."),
      { status: 500 }
    );
  }

  const items = ((data ?? []) as unknown as PostRow[]).map(postDto);

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": READ_CACHE_CONTROL } }
  );
}
