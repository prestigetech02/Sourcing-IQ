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