// Supabase writes for the scraper, via the REST + Storage HTTP APIs with the
// dev service-role key (plain fetch, zero deps). Idempotent: avatars/posts
// upsert; existing posts keep their human-set ingest_status/place_id.

/** @param {{ url: string, serviceKey: string, fetchImpl?: typeof fetch }} cfg */
export function makeStore({ url, serviceKey, fetchImpl }) {
  const fetch = fetchImpl ?? globalThis.fetch;
  const rest = `${url}/rest/v1`;
  const storage = `${url}/storage/v1`;
  const h = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  async function ensureBucket(name) {
    const res = await fetch(`${storage}/bucket`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ id: name, name, public: true }),
    });
    if (res.ok) return;
    const body = await res.text();
    // Already-exists is fine; anything else is a real error.
    if (res.status === 409 || /already exists|Duplicate/i.test(body)) return;
    throw new Error(`ensureBucket(${name}): HTTP ${res.status} ${body}`);
  }

  // Download bytes from a (signed, expiring) IG CDN url and re-host in Storage.
  async function uploadImage(bucket, path, sourceUrl) {
    const img = await fetch(sourceUrl);
    if (!img.ok) throw new Error(`download image ${sourceUrl}: HTTP ${img.status}`);
    const bytes = Buffer.from(await img.arrayBuffer());
    const contentType = img.headers.get("content-type") || "image/jpeg";

    const res = await fetch(`${storage}/object/${bucket}/${path}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!res.ok) {
      throw new Error(`upload ${bucket}/${path}: HTTP ${res.status} ${await res.text()}`);
    }
    return `${url}/storage/v1/object/public/${bucket}/${path}`;
  }

  // Re-host to Storage, but never fail a row over an image: if download/upload
  // breaks, fall back to the (signed, expiring) IG CDN url so the data still
  // lands. A later run re-attempts the upload and overwrites with the durable
  // public url. Returns { url, rehosted }.
  async function uploadImageOrSource(bucket, path, sourceUrl) {
    try {
      const url = await uploadImage(bucket, path, sourceUrl);
      return { url, rehosted: true };
    } catch (err) {
      console.warn(`  ! re-host ${bucket}/${path} failed (${err.message}); using IG url`);
      return { url: sourceUrl, rehosted: false };
    }
  }

  // Resolve an existing creator+account from an IG handle. Returns null if the
  // handle isn't onboarded yet (V1 targets existing creators).
  async function lookupAccount(handle) {
    const res = await fetch(
      `${rest}/platform_accounts?platform=eq.instagram&handle=eq.${encodeURIComponent(handle)}&select=id,creator_id`,
      { headers: h },
    );
    if (!res.ok) throw new Error(`lookupAccount(${handle}): HTTP ${res.status}`);
    const rows = await res.json();
    if (!rows.length) return null;
    return { platformAccountId: rows[0].id, creatorId: rows[0].creator_id };
  }

  // PATCH keeps existing NOT NULL columns (display_name, content_type) intact.
  async function updateCreatorAvatar(creatorId, avatarUrl, avatarSourceUrl) {
    const res = await fetch(`${rest}/creators?id=eq.${encodeURIComponent(creatorId)}`, {
      method: "PATCH",
      headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify({
        avatar_url: avatarUrl,
        avatar_source_url: avatarSourceUrl,
        avatar_fetched_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) throw new Error(`updateCreatorAvatar(${creatorId}): HTTP ${res.status} ${await res.text()}`);
  }

  async function existingPostUrls(postUrls) {
    if (!postUrls.length) return new Set();
    const list = postUrls.map((u) => `"${u}"`).join(",");
    const res = await fetch(`${rest}/posts?post_url=in.(${encodeURIComponent(list)})&select=post_url`, {
      headers: h,
    });
    if (!res.ok) throw new Error(`existingPostUrls: HTTP ${res.status}`);
    return new Set((await res.json()).map((r) => r.post_url));
  }

  async function insertPosts(rows) {
    if (!rows.length) return;
    const res = await fetch(`${rest}/posts`, {
      method: "POST",
      headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`insertPosts: HTTP ${res.status} ${await res.text()}`);
  }

  // Refresh only media fields on an existing post; never touch ingest_status,
  // place_id, or exclusion — a human may have curated those.
  async function refreshPost(postUrl, patch) {
    const res = await fetch(`${rest}/posts?post_url=eq.${encodeURIComponent(postUrl)}`, {
      method: "PATCH",
      headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`refreshPost(${postUrl}): HTTP ${res.status} ${await res.text()}`);
  }

  return {
    ensureBucket,
    uploadImage,
    uploadImageOrSource,
    lookupAccount,
    updateCreatorAvatar,
    existingPostUrls,
    insertPosts,
    refreshPost,
  };
}
