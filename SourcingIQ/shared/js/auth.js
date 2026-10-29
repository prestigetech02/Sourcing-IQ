/* ==========================================================
   auth.js: session helpers and role routing.

   NOTE: storing the user in web storage is for the MOCK only.
   With the real backend, the server sets a secure httpOnly cookie
   and this file only asks the API "who am I?". Front-end role checks
   hide screens for convenience; the backend must enforce permissions.
   ========================================================== */

const SESSION_KEY = "pif_session";

/** Where each role lands after signing in (resolved from this file's location). */
const DASHBOARD_BY_ROLE = {
  procurement: "../../dashboard/procurement/index.html",
  finance: "../../dashboard/finance/index.html",
  admin: "../../dashboard/admin/index.html",
  supplier: "../../dashboard/supplier/index.html",
};

const LOGIN_PAGE = "../../login-page/login.html"; // change to auth/login/index.html when the login page is moved

const resolve = (relativePath) => new URL(relativePath, import.meta.url).href;

/** Save the signed-in user. "remember" keeps them signed in after the tab closes. */
export function saveSession(user, remember = false) {
  clearSession();
  const store = remember ? localStorage : sessionStorage;
  store.setItem(SESSION_KEY, JSON.stringify(user));
}

/** Returns the signed-in user, or null. */
export function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

/** Full URL of the dashboard for a role. */
export function dashboardUrlFor(role) {
  const path = DASHBOARD_BY_ROLE[role];
  return path ? resolve(path) : resolve(LOGIN_PAGE);
}

/** Send a signed-in user to their dashboard. */
export function redirectToDashboard(user) {
  window.location.assign(dashboardUrlFor(user.role));
}

/** Log out and return to the sign-in page. */
export function logout() {
  clearSession();
  window.location.assign(resolve(LOGIN_PAGE));
}

/**
 * Call at the top of every protected page.
 * Not signed in -> sign-in page. Wrong role -> access denied page.
 */
export function requireRole(allowedRoles = []) {
  const user = getSession();
  if (!user) {
    window.location.replace(resolve(LOGIN_PAGE));
    return null;
  }
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    window.location.replace(resolve("../../errors/403/index.html"));
    return null;
  }
  return user;
}