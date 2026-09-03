# Browser capture (no credentials)

The credential-free path that actually works when IG throttles the private API
(`web_profile_info` → 429) and no service-role key is available. Uses the
operator's own logged-in Chrome via Claude-in-Chrome. Harvests IG's *organic*
`graphql` timeline responses (which load 200) instead of making new API calls.

## Per creator
1. Open `https://www.instagram.com/<handle>/` in the operator's session.
2. Inject the capture hook, then scroll to trigger "load more":

```js
window.__caps = [];
const O = XMLHttpRequest.prototype.open, S = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; return O.apply(this, arguments); };
XMLHttpRequest.prototype.send = function () {
  this.addEventListener('load', () => { try { if (String(this.__u).includes('graphql')) window.__caps.push(this.responseText); } catch (e) {} });
  return S.apply(this, arguments);
};
// scroll to load the timeline batch (organic call, 200 — not the 429 API)
for (let i = 0; i < 6; i++) { window.scrollTo(0, document.body.scrollHeight); await new Promise(r => setTimeout(r, 1500)); }
```

3. Extract CLEAN fields only (no image URLs — the browser tool redacts signed
   URLs, which blanks the whole payload). Write `shortcode|unixts|reel|post|caption`
   lines to `scripts/instagram/.captured/<handle>.txt`:

```js
const clean = s => (s||'').replace(/\S*https?:\/\/\S*/g,'').replace(/\S*\?\S*=\S*/g,'').replace(/\|/g,' ').replace(/\s+/g,' ').trim().slice(0,160);
let found=[];
(function walk(o,d){ if(!o||d>50||typeof o!=='object')return; if(Array.isArray(o)){for(const x of o)walk(x,d+1);return;}
  const code=o.code||o.shortcode, ts=o.taken_at||o.taken_at_timestamp;
  if(code&&typeof ts==='number'){ const cap=o.caption?.text||o.edge_media_to_caption?.edges?.[0]?.node?.text||null;
    found.push(`${code}|${ts}|${(o.is_video||o.video_versions||o.product_type==='clips'||o.media_type===2)?'reel':'post'}|${clean(cap)}`); }
  for(const k in o) walk(o[k],d+1);
})(window.__caps.map(t=>{try{return JSON.parse(t)}catch(e){return null}}),0);
[...new Set(found)];
```

## Then write to the DB
```
node scripts/instagram/gen-sql.mjs > scripts/instagram/.captured/insert.sql
pbcopy < scripts/instagram/.captured/insert.sql
```
Open the Supabase **Studio SQL editor** in the operator's session, ⌘A → ⌘V → Run.
The SQL is idempotent (`ON CONFLICT (post_url) DO NOTHING`) and joins
`platform_accounts` by handle, so re-runs are safe and add only new posts.

## Limits
- Captures the "load more" batch (posts ~13+); the newest ~12 load before the
  hook installs. Re-navigate with the hook pre-armed if you need the very newest.
- Avatars/thumbnails NOT covered — image URLs are redacted; use the node+key
  pipeline (`run.mjs`) for durable, re-hosted images.
