/* Finance dashboard: approval queue, review panel and spend figures. Data comes from api.js. */
import { requireRole } from "../../shared/js/auth.js";
import { initTheme } from "../../shared/js/theme.js";
import { renderShell } from "../../shared/js/layout.js";
import { getDashboard, getPurchaseRequests, getPurchaseRequest, updateRequestStatus } from "../../shared/js/api.js";
import { statCard, statusBadge, requestBadge, dataTable, skeleton, errorState, emptyState } from "../../shared/js/components.js";
import { formatNaira, esc, $ } from "../../shared/js/utils.js";

initTheme();
const user = requireRole(["finance"]);

const HIGH_VALUE = 1_000_000;
let queue = [];       // requests waiting for finance (status "under_review")
let decided = [];     // recently approved or rejected
let counts = { approved: 0, rejected: 0 };
let dash = null;
let latest = 0;       // ignores a slow response if a newer request was made
let openId = null;    // request shown in the review panel
let opener = null;    // button to give focus back to when the panel closes
let busy = false;

if (user) {
  renderShell(user);
  $("#welcome").textContent = `Welcome Back, ${user.name.split(" ")[0]}`;
  wire();
  load();
}

/* ---------- loading ---------- */
async function load() {
  const run = ++latest;
  $("#fin-error").innerHTML = "";
  $("#fin-body").hidden = false;
  $("#cards").innerHTML = Array(4).fill('<div class="skeleton" style="height:92px"></div>').join("");
  for (const id of ["queue", "categories", "prices", "alerts", "decisions"]) $("#" + id).innerHTML = skeleton(3);

  try {
    const [list, d] = await Promise.all([getPurchaseRequests({ pageSize: 100 }), getDashboard("30d")]);
    if (run !== latest) return;
    queue = list.items.filter((r) => r.status === "under_review").sort((a, b) => b.amount - a.amount);
    decided = list.items.filter((r) => r.status === "approved" || r.status === "rejected");
    counts = list.counts;
    dash = d;
    render();
  } catch (err) {
    if (run !== latest) return;
    $("#fin-body").hidden = true;
    $("#fin-error").innerHTML = `<section class="card fin-panel">${errorState(err.message)}</section>`;
  }
}

/* ---------- rendering ---------- */
function render() {
  const value = queue.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const big = queue.filter((r) => r.amount >= HIGH_VALUE).length;
  const k = dash.kpis;
  const up = k.spendChange >= 0;

  $("#cards").innerHTML = [
    statCard({ label: "Awaiting Decision", value: queue.length, note: big ? `${big} above ${formatNaira(HIGH_VALUE, { short: true })}` : `None above ${formatNaira(HIGH_VALUE, { short: true })}`, tone: big ? "danger" : "", iconName: "clipboard" }),
    statCard({ label: "Value Awaiting Approval", value: formatNaira(value, { short: true }), note: queue.length ? `Across ${queue.length} request${queue.length === 1 ? "" : "s"}` : "Queue is clear", iconName: "doc" }),
    statCard({ label: "Total Spend", value: formatNaira(k.totalSpend, { short: true }), note: `${up ? "+" : ""}${k.spendChange}% vs previous month`, tone: up ? "danger" : "success", iconName: "trend" }),
    statCard({ label: "Approved", value: counts.approved, note: `${counts.rejected} rejected`, iconName: "check" }),
  ].join("");

  $("#queue").innerHTML = queue.length
    ? dataTable([
        { label: "Request", cell: (r) => `<strong>${esc(r.id)}</strong>` },
        { label: "Item", cell: (r) => `${esc(r.title)}<small class="fin-sub">${esc(r.department)}</small>` },
        { label: "Requested by", cell: (r) => esc(r.requester) },
        { label: "Supplier", cell: (r) => esc(r.vendor || "Not assigned") },
        { label: "Amount", cell: (r) => formatNaira(r.amount) },
        { label: "", cell: (r) => `<button class="btn" type="button" data-review="${esc(r.id)}">Review</button>` },
      ], queue)
    : emptyState("Nothing waiting for approval", "Requests appear here once procurement sends them for review.");

  $("#categories").innerHTML = categoryBars(dash.categories);
  $("#prices").innerHTML = dataTable([
    { label: "Product", cell: (x) => esc(x.product) },
    { label: "Change", cell: (x) => `${x.change > 0 ? "+" : ""}${esc(x.change)}%` },
    { label: "Status", cell: (x) => statusBadge(x.status) },
  ], dash.priceChanges);
  $("#alerts").innerHTML = alertList(dash.alerts);
  $("#decisions").innerHTML = decisionList(decided.slice(0, 6));
}

function categoryBars(list) {
  const max = Math.max(...list.map((c) => c.total), 1);
  return `<ul class="fin-bars">${list.map((c) => `
    <li><span>${esc(c.name)}</span>
      <span class="fin-bars__track"><span class="fin-bars__fill" style="width:${Math.round((c.total / max) * 100)}%"></span></span>
      <span>${formatNaira(c.total, { short: true })}</span></li>`).join("")}</ul>`;
}

function alertList(list) {
  return `<ul class="fin-alerts">${list.map((a) => `
    <li class="is-${esc(a.tone)}"><strong>${esc(a.title)}</strong><small>${esc(a.type)}: ${esc(a.text)}</small></li>`).join("")}</ul>`;
}

function decisionList(list) {
  if (!list.length) return emptyState("No decisions yet", "Approved and rejected requests show up here.");
  return `<ul class="fin-list">${list.map((r) => `
    <li><div><strong>${esc(r.id)}</strong> ${requestBadge(r.status)}<small class="fin-sub">${esc(r.title)}, ${formatNaira(r.amount)}</small></div></li>`).join("")}</ul>`;
}

/* ---------- review panel ---------- */
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "Not set");

function detailHTML(r) {
  const facts = [
    ["Requested by", r.requester], ["Department", r.department], ["Cost centre", r.costCentre || "Not set"],
    ["Priority", r.priority], ["Date raised", fmtDate(r.date)], ["Required by", fmtDate(r.requiredBy)],
  ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");

  const items = dataTable([
    { label: "Product", cell: (i) => esc(i.product) },
    { label: "Specification", cell: (i) => esc(i.specification) },
    { label: "Quantity", cell: (i) => `${esc(i.quantity)} ${esc(i.unit)}` },
  ], r.items || []);

  const log = (r.activity || []).map((a) =>
    `<li><strong>${esc(a.title)}</strong> ${esc(a.text)}<small class="fin-sub">${esc(fmtDate(a.at))}</small></li>`).join("");

  return `
    <div>
      <h3 class="fin-title">${esc(r.title)}</h3>
      <p class="fin-amount">${formatNaira(r.amount)}</p>
      <p class="fin-sub">${r.vendor ? `Payable to ${esc(r.vendor)}` : "No supplier selected yet"}</p>
    </div>
    <dl class="fin-facts">${facts}</dl>
    <section><h3 class="fin-h">Items</h3>${items}</section>
    ${r.notes ? `<section><h3 class="fin-h">Notes from procurement</h3><p>${esc(r.notes)}</p></section>` : ""}
    <section><h3 class="fin-h">History</h3><ul class="fin-log">${log}</ul></section>`;
}

function setActions(disabled) {
  $("#fin-approve").disabled = disabled;
  $("#fin-reject").disabled = disabled;
}

async function openReview(id, trigger) {
  openId = id;
  opener = trigger || null;
  $("#fin-ref").textContent = id;
  $("#fin-detail").innerHTML = skeleton(4);
  $("#fin-reason").value = "";
  clearReasonError();
  setActions(true);
  $("#fin-overlay").hidden = false;
  $("#fin-drawer").hidden = false;
  $("#fin-close").focus();

  try {
    const r = await getPurchaseRequest(id);
    if (openId !== id) return;
    $("#fin-detail").innerHTML = detailHTML(r);
    setActions(false);
  } catch (err) {
    if (openId !== id) return;
    $("#fin-detail").innerHTML = `<div class="state state--error"><strong>Couldn't load this request</strong><p>${esc(err.message)}</p></div>`;
  }
}

function closeReview() {
  if (busy) return;
  openId = null;
  $("#fin-overlay").hidden = true;
  $("#fin-drawer").hidden = true;
  opener?.focus();
}

function clearReasonError() {
  $("#fin-reason").removeAttribute("aria-invalid");
  $("#fin-reason-error").hidden = true;
}

function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `fin-toast fin-toast--${type}`;
  el.textContent = message; // textContent, never innerHTML
  $("#fin-toasts").append(el);
  setTimeout(() => el.remove(), 3500);
}

async function decide(action) {
  if (busy || !openId) return;
  const reason = $("#fin-reason").value.trim();

  if (action === "reject" && !reason) {
    $("#fin-reason").setAttribute("aria-invalid", "true");
    $("#fin-reason-error").textContent = "Add a reason before rejecting.";
    $("#fin-reason-error").hidden = false;
    $("#fin-reason").focus();
    return;
  }

  const id = openId;
  busy = true;
  setActions(true);
  try {
    await updateRequestStatus(id, action, { user, reason, reasonCode: action === "reject" ? "finance_review" : "" });
    busy = false;
    closeReview();
    toast(action === "approve" ? `${id} approved. Procurement can move it to sourcing.` : `${id} rejected and sent back to procurement.`, action === "approve" ? "success" : "error");
    load();
  } catch (err) {
    busy = false;
    setActions(false);
    toast(err.message || "Something went wrong. Try again.", "error");
  }
}

/* ---------- events ---------- */
function wire() {
  document.addEventListener("click", (e) => {
    const review = e.target.closest("[data-review]");
    if (review) return openReview(review.dataset.review, review);
    if (e.target.closest("[data-retry]")) load();
  });
  $("#fin-close").addEventListener("click", closeReview);
  $("#fin-overlay").addEventListener("click", closeReview);
  $("#fin-approve").addEventListener("click", () => decide("approve"));
  $("#fin-reject").addEventListener("click", () => decide("reject"));
  $("#fin-reason").addEventListener("input", clearReasonError);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openId) closeReview(); });
}