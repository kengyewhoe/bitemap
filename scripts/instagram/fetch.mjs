// Fetch Instagram's logged-out `web_profile_info` for one handle. Requires a
// real browser session cookie (IG_SESSIONID) — IG returns `require_login`
// otherwise, especially from non-residential IPs. Run locally.

const APP_ID = "936619743392459"; // public web app id IG's own site sends
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export class IgBlockedError extends Error {}

/**
 * @param {string} handle
 * @param {{ sessionId: string }} opts
 * @returns {Promise<any>} raw web_profile_info payload
 */
export async function fetchProfile(handle, { sessionId }) {
  const url =
    "https://www.instagram.com/api/v1/users/web_profile_info/?username=" +
    encodeURIComponent(handle);

  const res = await fetch(url, {
    headers: {
      "x-ig-app-id": APP_ID,
      "User-Agent": UA,
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": `https://www.instagram.com/${handle}/`,
      ...(sessionId ? { Cookie: `sessionid=${sessionId}` } : {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new IgBlockedError(
      `IG requires login for @${handle} (HTTP ${res.status}). Refresh IG_SESSIONID.`,
    );
  }
  if (res.status === 429) {
    throw new IgBlockedError(
      `IG rate-limited @${handle} (HTTP 429). Wait, then retry with fewer handles.`,
    );
  }
  if (!res.ok) {
    throw new Error(`IG fetch @${handle} failed: HTTP ${res.status}`);
  }

  const body = await res.json();
  if (body?.require_login || body?.status === "fail") {
    throw new IgBlockedError(
      `IG blocked @${handle}: "${body?.message ?? "fail"}". Refresh IG_SESSIONID.`,
    );
  }
  return body;
}
