// node --test scripts/instagram/store.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeStore } from "./store.mjs";

const URL = "https://proj.supabase.co";
const KEY = "svc";
const SRC = "https://scontent.cdninstagram.com/pic.jpg?oe=ABC";

// Minimal fake Response.
const ok = (body = {}) => ({
  ok: true,
  status: 200,
  headers: { get: () => "image/jpeg" },
  arrayBuffer: async () => new ArrayBuffer(8),
  json: async () => body,
  text: async () => "",
});
const fail = (status = 500) => ({
  ok: false,
  status,
  headers: { get: () => null },
  text: async () => `HTTP ${status}`,
});

const isUpload = (u, o) => o?.method === "POST" && String(u).includes("/storage/v1/object/");

test("uploadImageOrSource: success -> public url, rehosted true", async () => {
  const store = makeStore({
    url: URL,
    serviceKey: KEY,
    fetchImpl: async (u, o) => (isUpload(u, o) ? ok() : ok()),
  });
  const res = await store.uploadImageOrSource("avatars", "c1.jpg", SRC);
  assert.equal(res.rehosted, true);
  assert.equal(res.url, `${URL}/storage/v1/object/public/avatars/c1.jpg`);
});

test("uploadImageOrSource: upload fails -> falls back to IG source url", async () => {
  const store = makeStore({
    url: URL,
    serviceKey: KEY,
    fetchImpl: async (u, o) => (isUpload(u, o) ? fail(500) : ok()),
  });
  const res = await store.uploadImageOrSource("avatars", "c1.jpg", SRC);
  assert.equal(res.rehosted, false);
  assert.equal(res.url, SRC); // data still lands
});

test("uploadImageOrSource: image download fails -> falls back to source", async () => {
  const store = makeStore({
    url: URL,
    serviceKey: KEY,
    fetchImpl: async () => fail(404), // download itself 404s
  });
  const res = await store.uploadImageOrSource("thumbnails", "sc.jpg", SRC);
  assert.equal(res.rehosted, false);
  assert.equal(res.url, SRC);
});
