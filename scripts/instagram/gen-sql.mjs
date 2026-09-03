// Build idempotent INSERT SQL from captured posts (.captured/<handle>.txt,
// lines: shortcode|unixts|reel|post|caption). Joins platform_accounts by handle
// so creator_id/platform_account_id aren't hardcoded. Run: node gen-sql.mjs > out.sql
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), ".captured");
const files = readdirSync(dir).filter((f) => f.endsWith(".txt"));
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const rows = [];
for (const f of files) {
  const handle = f.replace(/\.txt$/, "");
  for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const [sc, ts, kind, ...rest] = line.split("|");
    const caption = rest.join("|").trim();
    const mk = kind === "reel" ? "reel" : "post";
    const urlkind = kind === "reel" ? "reel" : "p";
    rows.push(
      `  (${q(handle)}, ${q(sc)}, ${Number(ts)}, ${q(mk)}, ${q(urlkind)}, ${caption ? q(caption) : "NULL"})`,
    );
  }
}

if (!rows.length) {
  console.error("no captured rows");
  process.exit(1);
}

console.log(`-- ${rows.length} posts from ${files.length} creators
INSERT INTO posts (id, creator_id, platform_account_id, platform, post_url, media_kind, content_summary, posted_at, ingest_status)
SELECT 'ig-'||v.sc, pa.creator_id, pa.id, 'instagram'::platform_kind,
       'https://www.instagram.com/'||v.urlkind||'/'||v.sc||'/',
       v.mk::post_media_kind, v.summary, to_timestamp(v.ts), 'needs_match'::post_ingest_status
FROM (VALUES
${rows.join(",\n")}
) AS v(handle, sc, ts, mk, urlkind, summary)
JOIN platform_accounts pa ON pa.platform = 'instagram'::platform_kind AND pa.handle = v.handle
ON CONFLICT (post_url) DO NOTHING;`);
