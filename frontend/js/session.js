const KEY = "bitemap.session";

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function setSession(partial) {
  const next = { ...getSession(), ...partial };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function requireAuth(loginHref = "./login.html") {
  if (!getSession()?.userId) {
    window.location.href = loginHref;
    return false;
  }
  return true;
}
