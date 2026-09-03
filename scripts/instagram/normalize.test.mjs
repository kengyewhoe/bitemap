// node --test scripts/instagram/normalize.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalize } from "./normalize.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const payload = JSON.parse(
  readFileSync(join(here, "fixtures/web_profile_info.sample.json"), "utf8"),
);

test("profile: pulls handle, name, bio, HD avatar, followers", () => {
  const { profile } = normalize(payload);
  assert.equal(profile.handle, "mingchuun");
  assert.equal(profile.displayName, "Ming Chun");
  assert.equal(profile.bio, "KL food. DM for collabs.");
  assert.equal(profile.avatarSourceUrl, "https://scontent.cdninstagram.com/pic_hd.jpg?oe=ABC");
  assert.equal(profile.followerCount, 127000);
});

test("profile: falls back to username when full_name empty", () => {
  const p = structuredClone(payload);
  p.data.user.full_name = "";
  assert.equal(normalize(p).profile.displayName, "mingchuun");
});

test("posts: video node -> reel, correct url + media_kind", () => {
  const { posts } = normalize(payload);
  const reel = posts[0];
  assert.equal(reel.shortcode, "Cxyz123");
  assert.equal(reel.mediaKind, "reel");
  assert.equal(reel.postUrl, "https://www.instagram.com/reel/Cxyz123/");
  assert.equal(reel.thumbnailSourceUrl, "https://scontent.cdninstagram.com/reel_thumb.jpg?oe=DEF");
  assert.equal(reel.contentSummary, "Best nasi lemak in Bangsar 🔥");
  assert.equal(reel.locationTag, "Village Park Restaurant");
  assert.equal(reel.postedAt, new Date(1756944000 * 1000).toISOString());
});

test("posts: image node -> post, null caption/location", () => {
  const post = normalize(payload).posts[1];
  assert.equal(post.mediaKind, "post");
  assert.equal(post.postUrl, "https://www.instagram.com/p/Cabc789/");
  assert.equal(post.contentSummary, null);
  assert.equal(post.locationTag, null);
});

test("caption truncated to 500 chars", () => {
  const p = structuredClone(payload);
  p.data.user.edge_owner_to_timeline_media.edges[1].node.edge_media_to_caption.edges = [
    { node: { text: "x".repeat(900) } },
  ];
  assert.equal(normalize(p).posts[1].contentSummary.length, 500);
});

test("throws on malformed payload", () => {
  assert.throws(() => normalize({}), /missing data.user.username/);
});
