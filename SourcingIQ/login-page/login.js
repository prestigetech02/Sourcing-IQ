/* ==========================================================
   auth/login: tabs, validation, sign in, create account
   ========================================================== */

import { login, register, ApiError } from "../shared/js/api.js";
import { saveSession, getSession, redirectToDashboard } from "../shared/js/auth.js";

/* Already signed in? Skip this page. */
const existingUser = getSession();
if (existingUser) {
  redirectToDashboard(existingUser);
}

/* ---------- Elements ---------- */

const tabButtons = document.querySelectorAll('[role="tab"]');
const tabTriggers = document.querySelectorAll("[data-tab]"); // tabs + inline links
const panels = {
  signin: document.getElementById("panel-signin"),
  register: document.getElementById("panel-register"),
};

const signinForm = document.getElementById("signin-form");
const registerForm = document.getElementById("register-form");
const signinAlert = document.getElementById("signin-alert");
const registerAlert = document.getElementById("register-alert");

const TITLES = {
  signin: "Sign in | SourcingIQ",
  register: "Create account | SourcingIQ",
};

const ICON_FOR_ALERT = {
  error: "icon-alert",
  warning: "icon-alert",
  success: "icon-check-circle",
};

/* ==========================================================
   Tabs
   ========================================================== */

function switchTab(name, { focusTab = false } = {}) {
  Object.entries(panels).forEach(([key, panel]) => {
    panel.hidden = key !== name;
  });

  tabButtons.forEach((tab) => {
    const selected = tab.dataset.tab === name;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focusTab) tab.focus();
  });

  document.title = TITLES[name];
}

tabTriggers.forEach((el) => {
  el.addEventListener("click", () => switchTab(el.dataset.tab));
});

// Arrow keys move between tabs (standard tab pattern)
document.querySelector('[role="tablist"]').addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const next = document.querySelector('[role="tab"][aria-selected="false"]');
  if (next) switchTab(next.dataset.tab, { focusTab: true });
});

// Open on the right tab if linked as ?tab=register
switchTab(new URLSearchParams(window.location.search).get("tab") === "register" ? "register" : "signin");

/* ==========================================================
   Show / hide password
   ========================================================== */

document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.togglePassword);
    const show = input.type === "password";

    input.type = show ? "text" : "password";
    button.setAttribute("aria-pressed", String(show));
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    button.querySelector("use").setAttribute("href", show ? "#icon-eye-off" : "#icon-eye");
  });
});

/* ==========================================================
   Field errors
   ========================================================== */

function errorElFor(input) {
  return document.getElementById(input.getAttribute("aria-describedby"));
}

function setFieldError(input, message) {
  const errorEl = errorElFor(input);
  input.setAttribute("aria-invalid", "true");
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearFieldError(input) {
  const errorEl = errorElFor(input);
  input.removeAttribute("aria-invalid");
  errorEl.textContent = "";
  errorEl.hidden = true;
}

/* Clear a field's error as soon as the user starts fixing it */
document.querySelectorAll(".input").forEach((input) => {
  input.addEventListener("input", () => {
    if (input.getAttribute("aria-invalid") === "true") clearFieldError(input);
  });
});

/* ==========================================================
   Form-level alerts
   ========================================================== */

function showAlert(el, type, message) {
  el.className = `alert alert--${type}`;
  el.setAttribute("role", type === "success" ? "status" : "alert");
  el.replaceChildren();

  const NS = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(NS, "svg");
  icon.setAttribute("width", "16");
  icon.setAttribute("height", "16");
  icon.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", `#${ICON_FOR_ALERT[type]}`);
  icon.appendChild(use);

  const text = document.createElement("span");
  text.textContent = message; // textContent, never innerHTML

  el.append(icon, text);
  el.hidden = false;
}

function hideAlert(el) {
  el.hidden = true;
  el.replaceChildren();
}

/* ==========================================================
   Loading state for submit buttons
   ========================================================== */

function setLoading(button, isLoading, loadingText) {
  const label = button.querySelector(".btn__label");

  if (isLoading) {
    button.dataset.label = label.textContent;
    label.textContent = loadingText;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");

    const spinner = document.createElement("span");
    spinner.className = "spinner";
    spinner.setAttribute("aria-hidden", "true");
    button.prepend(spinner);
  } else {
    label.textContent = button.dataset.label;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.querySelector(".spinner")?.remove();
  }
}

/* ==========================================================
   Validation rules
   ========================================================== */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const rules = {
  email: (value) => (EMAIL_PATTERN.test(value.trim()) ? "" : "Enter a valid email address"),
  signinPassword: (value) => (value ? "" : "Password is required"),
  newPassword: (value) => {
    if (!value) return "Password is required";
    if (value.length < 8) return "Password must be at least 8 characters";
    return "";
  },
  required: (label) => (value) => (value.trim() ? "" : `${label} is required`),
};

/** Runs [input, rule] pairs, shows errors, focuses the first bad field. Returns true if all valid. */
function validate(pairs) {
  let firstInvalid = null;

  pairs.forEach(([input, rule]) => {
    const message = rule(input.value);
    if (message) {
      setFieldError(input, message);
      firstInvalid ??= input;
    } else {
      clearFieldError(input);
    }
  });

  firstInvalid?.focus();
  return !firstInvalid;
}

/* ==========================================================
   Sign in
   ========================================================== */

const signinEmail = document.getElementById("signin-email");
const signinPassword = document.getElementById("signin-password");
const signinSubmit = document.getElementById("signin-submit");

signinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideAlert(signinAlert);

  const valid = validate([
    [signinEmail, rules.email],
    [signinPassword, rules.signinPassword],
  ]);
  if (!valid) return;

  setLoading(signinSubmit, true, "Signing in...");

  try {
    const user = await login({
      email: signinEmail.value,
      password: signinPassword.value,
    });
    const remember = signinForm.elements.remember.checked;
    saveSession(user, remember);
    redirectToDashboard(user);
  } catch (error) {
    setLoading(signinSubmit, false);

    if (error instanceof ApiError) {
      const type = error.code === "ACCOUNT_PENDING" ? "warning" : "error";
      showAlert(signinAlert, type, error.message);
    } else {
      showAlert(signinAlert, "error", "We couldn't reach the server. Check your connection and try again.");
    }
  }
});

/* ==========================================================
   Create account
   ========================================================== */

const regName = document.getElementById("reg-name");
const regCompany = document.getElementById("reg-company");
const regEmail = document.getElementById("reg-email");
const regPassword = document.getElementById("reg-password");
const registerSubmit = document.getElementById("register-submit");

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideAlert(registerAlert);

  const valid = validate([
    [regName, rules.required("Full name")],
    [regCompany, rules.required("Company name")],
    [regEmail, rules.email],
    [regPassword, rules.newPassword],
  ]);
  if (!valid) return;

  setLoading(registerSubmit, true, "Creating account...");

  try {
    await register({
      accountType: registerForm.elements.accountType.value,
      fullName: regName.value,
      companyName: regCompany.value,
      email: regEmail.value,
      password: regPassword.value,
    });

    // Send them to sign in with their email filled in
    const email = regEmail.value.trim();
    registerForm.reset();
    setLoading(registerSubmit, false);

    switchTab("signin", { focusTab: true });
    signinEmail.value = email;
    showAlert(signinAlert, "success", "Your account has been created and is awaiting approval. You can sign in once it's approved.");
  } catch (error) {
    setLoading(registerSubmit, false);

    if (error instanceof ApiError && error.code === "EMAIL_TAKEN") {
      setFieldError(regEmail, error.message);
      regEmail.focus();
    } else {
      showAlert(registerAlert, "error", "We couldn't create your account. Check your connection and try again.");
    }
  }
});