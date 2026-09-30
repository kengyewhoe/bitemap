import { test } from "node:test";
import assert from "node:assert/strict";

import { embedUrlFor, isEmbeddablePlatform } from "../embed";

test("isEmbeddablePlatform: tiktok and instagram only", () => {
  assert.equal(isEmbeddablePlatform("tiktok"), true);
  assert.equal(isEmbeddablePlatform("instagram"), true);
  assert.equal(isEmbeddablePlatform("youtube"), false);
  assert.equal(isEmbeddablePlatform("facebook"), false);
});

test("embedUrlFor: tiktok video URL becomes a player/v1 URL with the numeric id", () => {
  const url = embedUrlFor("tiktok", "https://www.tiktok.com/@jajabinx97/video/7649005965991283989");
  assert.match(url ?? "", /^https:\/\/www\.tiktok\.com\/player\/v1\/7649005965991283989\?/);
  assert.match(url ?? "", /autoplay=1/);
  assert.match(url ?? "", /closed_caption=1/);
});

test("embedUrlFor: tiktok URL with no /video/<id> segment is not embeddable", () => {
  assert.equal(embedUrlFor("tiktok", "https://www.tiktok.com/@jajabinx97"), null);
});

test("embedUrlFor: instagram reel URL becomes a /reel/<code>/embed/ URL", () => {
  assert.equal(
    embedUrlFor("instagram", "https://www.instagram.com/reel/Dcije7Xh5Mm/"),
    "https://www.instagram.com/reel/Dcije7Xh5Mm/embed/"
  );
});

test("embedUrlFor: instagram post URL becomes a /p/<code>/embed/ URL", () => {
  assert.equal(
    embedUrlFor("instagram", "https://www.instagram.com/p/Dcije7Xh5Mm/"),
    "https://www.instagram.com/p/Dcije7Xh5Mm/embed/"
  );
});

test("embedUrlFor: instagram URL with no shortcode segment is not embeddable", () => {
  assert.equal(embedUrlFor("instagram", "https://www.instagram.com/"), null);
});

test("embedUrlFor: unsupported platform is never embeddable", () => {
  assert.equal(embedUrlFor("youtube", "https://youtu.be/abc123"), null);
  assert.equal(embedUrlFor("facebook", "https://facebook.com/x/videos/1"), null);
});
