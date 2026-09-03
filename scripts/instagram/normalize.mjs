// Pure transform: Instagram `web_profile_info` payload -> typed rows our DB
// understands. No IO here — this is the fragile parsing surface, so it stays
// pure and is exercised by normalize.test.mjs against a saved fixture.
//
// Payload shape (logged-out web_profile_info): data.user with
// profile_pic_url_hd + edge_owner_to_timeline_media.edges[].node.

/** @param {any} payload */
export function normalize(payload) {
  const user = payload?.data?.user;
  if (!user || !user.username) {
    throw new Error("normalize: payload missing data.user.username");
  }

  const profile = {
    handle: user.username,
    displayName: user.full_name || user.username,
    bio: user.biography || null,
    avatarSourceUrl: user.profile_pic_url_hd || user.profile_pic_url || null,
    followerCount: user.edge_followed_by?.count ?? null,
  };

  const edges = user.edge_owner_to_timeline_media?.edges ?? [];
  const posts = edges
    .map((e) => e?.node)
    .filter(Boolean)
    .filter((n) => n.shortcode)
    .map((n) => normalizePost(n));

  return { profile, posts };
}

/** @param {any} n a single timeline media node */
function normalizePost(n) {
  const isVideo =
    Boolean(n.is_video) ||
    n.__typename === "GraphVideo" ||
    n.product_type === "clips";
  const shortcode = n.shortcode;
  const postUrl = isVideo
    ? `https://www.instagram.com/reel/${shortcode}/`
    : `https://www.instagram.com/p/${shortcode}/`;

  const caption = n.edge_media_to_caption?.edges?.[0]?.node?.text ?? null;

  return {
    shortcode,
    postUrl,
    mediaKind: isVideo ? "reel" : "post", // post_media_kind enum
    isVideo,
    thumbnailSourceUrl: n.display_url || null,
    contentSummary: caption ? caption.slice(0, 500) : null,
    // taken_at_timestamp is unix seconds.
    postedAt: n.taken_at_timestamp
      ? new Date(n.taken_at_timestamp * 1000).toISOString()
      : null,
    locationTag: n.location?.name || null,
  };
}
