/* App shell: builds the sidebar and top bar on every page. */
import { icon } from "./components.js";
import { logout } from "./auth.js";
import { getTheme, setTheme } from "./theme.js";
import { esc, $ } from "./utils.js";
import { LOGO } from "./logo.js";

const url = (p) => new URL("../../" + p, import.meta.url).href;
const norm = (s) => s.replace(/index\.html$/, "");
const pathOf = (p) => norm(new URL(url(p)).pathname);
// a link is active when the page URL starts with its path; the longest matching link wins
const isActive = (p) => {
  const cur = norm(location.pathname), mine = pathOf(p);
  return cur.startsWith(mine) && !ALL_PATHS.some((o) => o.length > mine.length && cur.startsWith(o));
};

const bars = (d) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="${d}"/></svg>`;
const BARS = { menu: bars("M4 6h16M4 12h16M4 18h16"), close: bars("M6 6l12 12M18 6 6 18") };

const ROLE_LABEL = { procurement: "Procurement Officer", finance: "Finance Officer", admin: "Administrator", supplier: "Supplier" };

// Paths for pages that aren't built yet will 404 until we create them.
const NAV = [
  { label: "Dashboard", href: "dashboard/procurement/", icon: "grid" },
  { label: "Procurement", icon: "clipboard", children: [
    ["Purchase Request", "dashboard/procurement/purchase-requests/"], ["RFQs", "dashboard/procurement/rfqs/"], ["Quote", "dashboard/procurement/quotes/"], ["Compare", "dashboard/procurement/compare/"] ] },
  { label: "Suppliers", href: "suppliers/", icon: "users" },
  { label: "Catalogue", icon: "layers", children: [["Products", "catalogue/products/"], ["Categories", "catalogue/categories/"]] },
  { label: "Operations", icon: "truck", children: [
    ["Purchase Orders", "orders/purchase-orders/"], ["Deliveries", "orders/deliveries/"], ["Goods Receipt", "orders/goods-receipt/"] ] },
  { label: "Insight", icon: "chart", children: [["Analytics", "insight/analytics/"], ["Reports", "insight/reports/"]] },
  { label: "Admin", icon: "shield", roles: ["admin"], children: [["Users", "admin/users/"], ["Organization", "admin/organization/"], ["Audit Log", "admin/audit-log/"]] },
];

const ALL_PATHS = NAV.flatMap((i) => (i.children ? i.children.map(([, p]) => pathOf(p)) : [pathOf(i.href)]));

function navItem(i) {
  if (!i.children) {
    return `<a class="nav__link ${isActive(i.href) ? "is-active" : ""}" href="${url(i.href)}">${icon(i.icon)}<span>${i.label}</span></a>`;
  }
  const open = i.children.some(([, p]) => isActive(p));
  return `<details class="nav__group" ${open ? "open" : ""}>
    <summary class="nav__link">${icon(i.icon)}<span>${i.label}</span><span class="nav__chev">${icon("chevron", 14)}</span></summary>
    ${i.children.map(([l, p]) => `<a class="nav__sub ${isActive(p) ? "is-active" : ""}" href="${url(p)}">${l}</a>`).join("")}
  </details>`;
}

export function renderShell(user) {
  const initials = user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const dark = getTheme() === "dark";

  $("#sidebar").innerHTML = `
    <div class="sb-head">
      <a class="sb-brand" href="${url("dashboard/procurement/")}" aria-label="SourcingIQ home">${LOGO}</a>
      <button class="icon-btn sb-close" type="button" aria-label="Close menu">${BARS.close}</button>
    </div>
    <nav class="nav" aria-label="Main">${NAV.filter((i) => !i.roles || i.roles.includes(user.role)).map(navItem).join("")}</nav>
    <div class="sb-bottom">
      <a class="nav__link" href="#">${icon("bell")}<span>Notifications</span></a>
      <a class="nav__link" href="#">${icon("gear")}<span>Settings</span></a>
      <div class="theme-row"><span id="theme-label">Dark Mode</span>
        <button class="switch" id="theme-switch" type="button" role="switch" aria-labelledby="theme-label" aria-checked="${dark}"></button></div>
    </div>`;

  $("#topbar").innerHTML = `
    <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">${BARS.menu}</button>
    <span class="topbar__title">${esc(document.body.dataset.title || "")}</span>
    <label class="search">${icon("search", 16)}<span class="sr-only">Search</span>
      <input type="search" placeholder="Search supplier, products, requests..." /></label>
    <button class="icon-btn" type="button" aria-label="Notifications">${icon("bell")}</button>
    <details class="user"><summary><span class="avatar">${esc(initials)}</span>
      <span class="user__meta"><strong>${esc(user.name)}</strong><small>${esc(ROLE_LABEL[user.role] || user.role)}</small></span></summary>
      <div class="user__menu"><button type="button" data-logout>Sign out</button></div></details>`;

  $("#theme-switch").addEventListener("click", (e) => {
    const next = getTheme() === "dark" ? "light" : "dark";
    setTheme(next);
    e.currentTarget.setAttribute("aria-checked", String(next === "dark"));
  });
  $("[data-logout]").addEventListener("click", logout);
  setupMobileMenu();
}

/* Hamburger drawer (only visible below 900px, see layout.css) */
function setupMobileMenu() {
  document.body.insertAdjacentHTML("beforeend", '<div class="backdrop" id="backdrop"></div>');
  const button = $("#menu-btn");
  const setOpen = (open) => {
    document.body.classList.toggle("nav-open", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  button.addEventListener("click", () => setOpen(!document.body.classList.contains("nav-open")));
  $("#backdrop").addEventListener("click", () => setOpen(false));
  $(".sb-close").addEventListener("click", () => { setOpen(false); button.focus(); });
  $("#sidebar").addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  // widening the window past 900px closes the drawer
  matchMedia("(min-width: 901px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });
}