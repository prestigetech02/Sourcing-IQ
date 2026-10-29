/* Purchase request details: read one request, show what the user's role can do next. */
import { requireRole } from "../../../../shared/js/auth.js";
import { initTheme } from "../../../../shared/js/theme.js";
import { renderShell } from "../../../../shared/js/layout.js";
import { getPurchaseRequest, updateRequestStatus } from "../../../../shared/js/api.js";
import { requestBadge, dataTable, skeleton, errorState } from "../../../../shared/js/components.js";
import { actionsFor, REQUEST_REJECT_REASONS } from "../../../../shared/js/statuses.js";
import { formatNaira, esc, $ } from "../../../../shared/js/utils.js";

// Actions whose screens exist so far. Others (Edit, Create RFQ, ...) appear when those pages are built.
const READY = new Set(["submit", "withdraw", "cancel", "start_review", "approve", "reject", "start_sourcing", "request_changes"]);
const CONFIRM = {
  cancel: "Cancel this request?",
  withdraw: "Withdraw this request and return it to Draft?",
  request_changes: "Send this request back to Draft? Finance will need to approve it again.",
};
const NEXT_TEXT = {
  draft: "Complete the details and submit this request for review.",
  submitted: "Waiting for Finance to start the review.",
  under_review: "Finance is reviewing this request. Approve or reject it.",
  approved: "Review the request and begin supplier sourcing.",
  sourcing: "Collect quotes and compare them.",
  ordered: "Waiting for delivery from the supplier.",
  partially_fulfilled: "Part of the order has arrived. Waiting for the rest.",
  fulfilled: "This request is complete.",
  rejected: "This request was rejected.",
  cancelled: "This request was cancelled.",
};
const STEPS = [["submitted", "Submitted"], ["under_review", "Under Review"], ["approved", "Approved"], ["sourcing", "Sourcing"], ["ordered", "Ordered"], ["fulfilled", "Fulfilled"]];
const PENDING = { submitted: "Not submitted yet", under_review: "Finance review pending", approved: "Awaiting approval", sourcing: "Supplier sourcing not started", ordered: "Purchase order not created", fulfilled: "Awaiting completion" };
const LEVEL = { draft: -1, submitted: 0, under_review: 1, approved: 2, sourcing: 3, ordered: 4, partially_fulfilled: 4, fulfilled: 5 };

initTheme();
const user = requireRole(["procurement", "finance"]);
const id = new URLSearchParams(location.search).get("id");
let current = null;

if (user) {
  renderShell(user);
  $("#reject-reason").innerHTML = '<option value="">Select a reason</option>' + REQUEST_REJECT_REASONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (btn) act(btn.dataset.action);
    if (e.target.closest("[data-retry]")) load();
  });
  setupRejectDialog();
  load();
}

async function load() {
  $("#grid").hidden = false;
  $("#head").innerHTML = skeleton(1);
  for (const k of ["summary", "items", "notes", "activity", "next", "timeline"]) $("#" + k).innerHTML = skeleton(3);
  try {
    if (!id) throw new Error("No request was selected.");
    render(await getPurchaseRequest(id));
  } catch (err) {
    $("#grid").hidden = true;
    $("#head").innerHTML = errorState(err.message);
  }
}

function render(r) {
  current = r;
  document.title = `${r.id} | SourcingIQ`;
  $("#head").innerHTML = `<div class="detail-head"><div class="title-row"><h1>${esc(r.id)}</h1>${requestBadge(r.status)}</div><p>Purchase request</p></div>`;

  const longDate = (d) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  const pairs = [["Request title", r.title], ["Requester", r.requester], ["Department", r.department], ["Vendor", r.vendor || "Not chosen yet"],
    ["Total (estimate)", formatNaira(r.amount)], ["Required by", longDate(r.requiredBy)], ["Priority", r.priority], ["Cost centre", r.costCentre || "Not set"]];
  $("#summary").innerHTML = `<dl class="summary">${pairs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;

  $("#items").innerHTML = dataTable([
    { label: "Product", cell: (x) => esc(x.product) }, { label: "Specification", cell: (x) => esc(x.specification) },
    { label: "Quantity", cell: (x) => esc(x.quantity) }, { label: "Units", cell: (x) => esc(x.unit) },
  ], r.items);

  const attachments = r.attachments?.length ? `<ul class="chips">${r.attachments.map((a) => `<li>${esc(a.name)}</li>`).join("")}</ul>` : "";
  const text = [r.specifications, r.notes].filter(Boolean).join("\n\n");
  $("#notes").innerHTML = (text ? `<p class="notes-text">${esc(text)}</p>` : '<p class="notes-text">No specifications or notes added.</p>') + attachments;

  renderActivity(r.activity);
  renderNext(r);
  renderTimeline(r);
}

function renderActivity(list) {
  const label = (at) => {
    const diff = Math.round((new Date(new Date().toDateString()) - new Date(new Date(at).toDateString())) / 864e5);
    return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : new Date(at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  };
  const time = (at) => (at.includes("T") ? " \u00b7 " + new Date(at).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" }) : "");
  const groups = new Map();
  [...list].sort((a, b) => b.at.localeCompare(a.at)).forEach((a) => groups.set(label(a.at), [...(groups.get(label(a.at)) || []), a]));
  $("#activity").innerHTML = [...groups].map(([day, items]) => `<p class="day">${esc(day)}</p><ul class="act">${items.map((a) =>
    `<li><strong>${esc(a.title)}</strong><small>${esc(a.text)}${time(a.at)}</small></li>`).join("")}</ul>`).join("");
}

function renderNext(r) {
  const actions = actionsFor(r.status, user.role).filter((a) => READY.has(a.id));
  const why = r.status === "rejected" && r.rejection ? ` Reason: ${r.rejection.reason}${r.rejection.note ? ` (${r.rejection.note})` : ""}.` : "";
  $("#next").innerHTML = `<p class="next-text">${esc(NEXT_TEXT[r.status] + why)}</p>` + (actions.length
    ? `<div class="next-actions">${actions.map((a, i) => `<button class="btn btn--block ${i === 0 ? "btn--primary" : ""}" type="button" data-action="${a.id}">${esc(a.label)}</button>`).join("")}</div>`
    : '<p class="next-text">Nothing for you to do right now.</p>');
}

function renderTimeline(r) {
  let steps;
  if (r.status === "rejected") {
    steps = [["done", "Submitted", "Completed"], ["done", "Under Review", "Completed"], ["danger", "Rejected", r.rejection?.reason || "Rejected by Finance"]];
  } else if (r.status === "cancelled") {
    steps = [["danger", "Cancelled", "This request was cancelled"]];
  } else {
    const lvl = LEVEL[r.status] ?? -1;
    steps = STEPS.map(([key, label], i) => {
      const state = r.status === "fulfilled" || i < lvl ? "done" : i === lvl ? "current" : "todo";
      const note = state === "todo" ? (key === "fulfilled" && r.status === "partially_fulfilled" ? "Partly received" : PENDING[key]) : state === "current" ? "Current stage" : "Completed";
      return [state, label, note];
    });
  }
  $("#timeline").innerHTML = `<ol class="timeline">${steps.map(([s, l, n]) => `<li class="${s}"><strong>${esc(l)}</strong><small>${esc(n)}</small></li>`).join("")}</ol>`;
}

/* ---------- actions ---------- */
async function act(action) {
  if (action === "reject") return $("#reject-dialog").showModal();
  if (CONFIRM[action] && !confirm(CONFIRM[action])) return; // simple placeholder until a custom confirm dialog is designed
  await run(action);
}

async function run(action, extra = {}) {
  const buttons = document.querySelectorAll("[data-action]");
  buttons.forEach((b) => (b.disabled = true));
  $("#action-error").hidden = true;
  try {
    render(await updateRequestStatus(id, action, { user, ...extra }));
  } catch (err) {
    buttons.forEach((b) => (b.disabled = false));
    $("#action-error").textContent = err.message;
    $("#action-error").hidden = false;
  }
}

function setupRejectDialog() {
  const dialog = $("#reject-dialog"), form = $("#reject-form"), reason = $("#reject-reason"), note = $("#reject-note");
  const fail = (input, msg) => { input.setAttribute("aria-invalid", "true"); const e = $("#" + input.getAttribute("aria-describedby")); e.textContent = msg; e.hidden = false; };
  const clear = () => [reason, note].forEach((i) => { i.removeAttribute("aria-invalid"); const e = $("#" + i.getAttribute("aria-describedby")); e.hidden = true; });
  reason.addEventListener("change", () => { $("#note-req").hidden = reason.value !== "other"; clear(); });
  $("#reject-cancel").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { form.reset(); clear(); $("#note-req").hidden = true; });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clear();
    if (!reason.value) return fail(reason, "Select a reason");
    if (reason.value === "other" && !note.value.trim()) return fail(note, "Add a note when the reason is Other");
    const label = reason.options[reason.selectedIndex].text;
    const extra = { reasonCode: reason.value, reason: label, note: note.value.trim() };
    dialog.close();
    await run("reject", extra);
  });
}