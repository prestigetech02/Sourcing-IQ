import { STATUSES, actionsFor } from "./statuses.js";
/* ==========================================================
   api.js: the ONLY place pages talk to data.

   Right now it returns mock data. When the backend is ready,
   replace the body of each function with a fetch() call and
   keep the same inputs and outputs, so no page needs to change.
   ========================================================== */

/** Error with a machine-readable code the UI can react to. */
export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

/* ---------- Mock data (demo accounts only, no real credentials) ---------- */

const MOCK_USERS = [
  { id: "u1", name: "Sandra Bell",   email: "sandra@freshbite.com",   password: "Password123", role: "procurement", status: "active" },
  { id: "u2", name: "Daniel Okafor", email: "daniel@freshbite.com",   password: "Password123", role: "finance",     status: "active" },
  { id: "u3", name: "Chinedu Eze",   email: "chinedu@freshbite.com",  password: "Password123", role: "admin",       status: "active" },
  { id: "u4", name: "Tunde Bakare",  email: "tunde@primepacking.com", password: "Password123", role: "supplier",    status: "active" },
  { id: "u5", name: "Ada Obi",       email: "pending@freshbite.com",  password: "Password123", role: "procurement", status: "pending" },
  { id: "u6", name: "Kemi Ade",      email: "disabled@freshbite.com", password: "Password123", role: "procurement", status: "disabled" },
];

/** Simulates network delay so loading states are visible while building. */
const wait = (ms = 900) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------- Auth ---------- */

/**
 * Sign in.
 * Resolves with { id, name, email, role }.
 * Rejects with ApiError: INVALID_CREDENTIALS | ACCOUNT_PENDING | ACCOUNT_DISABLED
 *
 * BACKEND: POST /auth/login  { email, password }
 * The server must verify the password, check the account status, and
 * return the role. It must also set the session (httpOnly cookie or token).
 */
export async function login({ email, password }) {
  await wait();

  const user = MOCK_USERS.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );

  if (!user || user.password !== password) {
    throw new ApiError("INVALID_CREDENTIALS", "Incorrect email or password.");
  }
  if (user.status === "pending") {
    throw new ApiError(
      "ACCOUNT_PENDING",
      "Your account is awaiting approval. You'll be able to sign in once it's approved."
    );
  }
  if (user.status === "disabled") {
    throw new ApiError(
      "ACCOUNT_DISABLED",
      "This account has been disabled. Contact your administrator."
    );
  }

  const { password: _omit, status: _status, ...safeUser } = user;
  return safeUser;
}

/**
 * Create an account.
 * Resolves with { email, accountType }.
 * Rejects with ApiError: EMAIL_TAKEN
 *
 * BACKEND: POST /auth/register  { accountType, fullName, companyName, email, password }
 * The server must hash the password, reject duplicate emails, create the
 * account as "pending" (verification/approval) and never return the password.
 */
export async function register({ accountType, fullName, companyName, email, password }) {
  await wait();

  const taken = MOCK_USERS.some(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (taken) {
    throw new ApiError("EMAIL_TAKEN", "An account with this email already exists.");
  }

  MOCK_USERS.push({
    id: `u${MOCK_USERS.length + 1}`,
    name: fullName.trim(),
    email: email.trim(),
    password, // mock only; the real backend stores a hash
    role: accountType === "supplier" ? "supplier" : "procurement",
    status: "pending",
    company: companyName.trim(),
  });

  return { email: email.trim(), accountType };
}

/* ---------- Dashboard ---------- */

/**
 * Procurement dashboard numbers.
 * BACKEND: GET /dashboard/procurement?range=30d
 * The server must calculate every figure (spend, counts, price changes,
 * alerts, activity) from the database, scoped to the user's organisation.
 */
export async function getDashboard(range = "30d") {
  await wait(700);
  const res = await fetch(new URL("../../data/dashboard.json", import.meta.url));
  if (!res.ok) throw new ApiError("LOAD_FAILED", "Could not load dashboard data.");
  return res.json(); // mock ignores `range`
}

/* ---------- Switch between mock data and the real backend ---------- */

export const USE_MOCK = true;                       // set to false when the backend is ready
export const BASE_URL = "http://127.0.0.1:8000/api"; // agree the real URL with the backend

/** One place for real HTTP calls. credentials: "include" sends the session cookie. */
async function request(path, options = {}) {
  const res = await fetch(BASE_URL + path, {
    credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new ApiError("HTTP_" + res.status, `Request failed (${res.status}).`);
  return res.json();
}

/* ---------- Purchase requests ---------- */

/**
 * One page of purchase requests plus card counts.
 * Resolves with { items, total, page, pageSize, counts: { total, pending, approved, rejected } }
 * BACKEND: GET /purchase-requests/?page=&page_size=&search=&status=&department=
 * If their field names differ, rename them in toRequestList() below, not in the pages.
 */
export async function getPurchaseRequests({ page = 1, pageSize = 10, search = "", status = "", department = "" } = {}) {
  if (!USE_MOCK) {
    const qs = new URLSearchParams({ page, page_size: pageSize, search, status, department });
    return toRequestList(await request(`/purchase-requests/?${qs}`));
  }
  await wait(600);
  let all = await loadAllRequests();
  if (new URLSearchParams(location.search).has("empty")) all = []; // mock only: add ?empty=1 to preview the empty state

  // The mock filters and pages like a real server would.
  const term = search.trim().toLowerCase();
  const rows = all.filter((r) =>
    (!status || r.status === status) && (!department || r.department === department) &&
    (!term || [r.id, r.title, r.requester, r.vendor].join(" ").toLowerCase().includes(term)));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  const n = (list) => all.filter((r) => list.includes(r.status)).length;
  return {
    items: rows.slice((p - 1) * pageSize, p * pageSize), total: rows.length, page: p, pageSize,
    counts: { total: all.length, pending: n(["submitted", "under_review"]),
      approved: n(["approved", "sourcing", "ordered", "partially_fulfilled", "fulfilled"]), rejected: n(["rejected"]) },
  };
}

/** Adapter: turns the backend's response into the shape the pages use (currently identical). */
const toRequestList = (raw) => raw;

/* ---------- Purchase request detail, create, status changes ---------- */

// MOCK STORE: requests you create or change are kept in this browser so the demo flow works end to end.
// The real backend keeps them in the database, so all of this goes away.
const STORE_KEY = "pip_mock_requests";
const readStore = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } };
const writeStore = (v) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch {} };

async function loadAllRequests() {
  const res = await fetch(new URL("../../data/purchase-requests.json", import.meta.url));
  if (!res.ok) throw new ApiError("LOAD_FAILED", "Could not load purchase requests.");
  const byId = new Map((await res.json()).map((r) => [r.id, r]));
  for (const [id, r] of Object.entries(readStore())) byId.set(id, r);
  return [...byId.values()].sort((a, b) => b.id.localeCompare(a.id));
}

/** Fills in the detail fields the list data doesn't carry. */
const withDetails = (r) => ({
  priority: "Normal", costCentre: "", specifications: "", notes: "", attachments: [], rejection: null,
  requiredBy: new Date(new Date(r.date).getTime() + 14 * 864e5).toISOString().slice(0, 10),
  items: [{ product: r.title, specification: r.specifications || "Not specified", quantity: r.quantity ?? 100, unit: r.unit ?? "Units" }],
  activity: [{ title: "Request", text: `${r.requester} created this request`, at: r.date }],
  ...r,
});

/**
 * One purchase request with its items, activity and rejection reason.
 * BACKEND: GET /purchase-requests/{id}/
 */
export async function getPurchaseRequest(id) {
  if (!USE_MOCK) return request(`/purchase-requests/${encodeURIComponent(id)}/`);
  await wait(400);
  const rec = (await loadAllRequests()).find((r) => r.id === id);
  if (!rec) throw new ApiError("NOT_FOUND", "This purchase request doesn't exist.");
  return withDetails(rec);
}

/**
 * Create a request (draft or submitted).
 * BACKEND: POST /purchase-requests/  (multipart if files are attached). The server sets the id, the requester
 * and the status, and must validate everything again.
 */
export async function createPurchaseRequest(data, user) {
  if (!USE_MOCK) return request("/purchase-requests/", { method: "POST", body: JSON.stringify(data) });
  await wait(700);
  const all = await loadAllRequests();
  const n = Math.max(...all.map((r) => Number(r.id.slice(3)))) + 1;
  const now = new Date().toISOString();
  const rec = {
    id: `PR-${String(n).padStart(5, "0")}`, title: data.item.trim(), requester: user?.name || "Unknown",
    department: data.department, vendor: null, amount: Number(data.budget) || 0, status: data.submit ? "submitted" : "draft",
    date: now.slice(0, 10), priority: data.priority, quantity: Number(data.quantity) || 0, unit: data.unit,
    requiredBy: data.requiredBy, costCentre: data.costCentre, specifications: data.specifications.trim(), notes: data.notes.trim(),
    attachments: data.attachments, rejection: null,
    activity: [{ title: "Request", text: `${user?.name || "Someone"} ${data.submit ? "submitted this request" : "saved this request as a draft"}`, at: now }],
  };
  const store = readStore(); store[rec.id] = rec; writeStore(store);
  return rec;
}

const MOVES = {
  submit: { from: ["draft"], to: "submitted" }, withdraw: { from: ["submitted"], to: "draft" },
  cancel: { from: ["draft", "approved"], to: "cancelled" }, start_review: { from: ["submitted"], to: "under_review" },
  approve: { from: ["under_review"], to: "approved" }, reject: { from: ["under_review"], to: "rejected" },
  start_sourcing: { from: ["approved"], to: "sourcing" }, request_changes: { from: ["approved"], to: "draft" },
};

/**
 * Move a request to its next status.
 * BACKEND: POST /purchase-requests/{id}/actions/  { action, reason_code, note }
 * The SERVER must check the user's role and the current status (like actionsFor does here).
 */
export async function updateRequestStatus(id, action, { user, reason = "", reasonCode = "", note = "" } = {}) {
  if (!USE_MOCK) return request(`/purchase-requests/${encodeURIComponent(id)}/actions/`, { method: "POST", body: JSON.stringify({ action, reason_code: reasonCode, note }) });
  await wait(500);
  const rec = (await loadAllRequests()).find((r) => r.id === id);
  if (!rec) throw new ApiError("NOT_FOUND", "This purchase request doesn't exist.");
  const move = MOVES[action];
  if (!move || !move.from.includes(rec.status) || !actionsFor(rec.status, user?.role).some((a) => a.id === action)) {
    throw new ApiError("NOT_ALLOWED", "That action isn't allowed for this request.");
  }
  const next = withDetails(rec);
  next.status = move.to;
  next.rejection = action === "reject" ? { code: reasonCode, reason, note } : null;
  next.activity = [...next.activity, { title: "Status", text: `${user.name} changed the status to ${STATUSES[move.to].label}${reason ? ` (${reason})` : ""}`, at: new Date().toISOString() }];
  const store = readStore(); store[id] = next; writeStore(store);
  return next;
}