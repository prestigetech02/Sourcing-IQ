/* Purchase Requests list: filters + pagination live in the URL, data comes from api.js. */
import { requireRole } from "../../../shared/js/auth.js";
import { initTheme } from "../../../shared/js/theme.js";
import { renderShell } from "../../../shared/js/layout.js";
import { getPurchaseRequests } from "../../../shared/js/api.js";
import { statCard, requestBadge, dataTable, pagination, skeleton, errorState } from "../../../shared/js/components.js";
import { STATUSES } from "../../../shared/js/statuses.js";
import { formatNaira, formatDate, esc, $ } from "../../../shared/js/utils.js";

const PAGE_SIZE = 10;
const DEPARTMENTS = ["Operations", "IT", "Marketing", "Admin", "Kitchen"];

initTheme();
const user = requireRole(["procurement", "finance"]);

if (user) {
  renderShell(user);
  if (user.role === "procurement") $("#create-btn").hidden = false; // only Procurement creates requests

  $("#status").insertAdjacentHTML("beforeend", Object.entries(STATUSES).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join(""));
  $("#department").insertAdjacentHTML("beforeend", DEPARTMENTS.map((d) => `<option>${d}</option>`).join(""));

  // state comes from the URL so the back button and shared links work
  const q = new URLSearchParams(location.search);
  const state = { page: Number(q.get("page")) || 1, search: q.get("search") || "", status: q.get("status") || "", department: q.get("department") || "" };
  $("#search").value = state.search; $("#status").value = state.status; $("#department").value = state.department;

  let timer;
  $("#search").addEventListener("input", (e) => { clearTimeout(timer); timer = setTimeout(() => change({ search: e.target.value }), 300); });
  $("#status").addEventListener("change", (e) => change({ status: e.target.value }));
  $("#department").addEventListener("change", (e) => change({ department: e.target.value }));
  document.addEventListener("click", (e) => {
    const pageBtn = e.target.closest("[data-page]");
    if (pageBtn && !pageBtn.disabled) { state.page = Number(pageBtn.dataset.page); sync(); load(); }
    if (e.target.closest("[data-retry]")) load();
    if (e.target.closest("[data-clear]")) {
      Object.assign(state, { page: 1, search: "", status: "", department: "" });
      $("#search").value = ""; $("#status").value = ""; $("#department").value = ""; sync(); load();
    }
  });

  // clicking anywhere on a row opens the request (links and the menu keep their own behaviour)
  $("#list").addEventListener("click", (e) => {
    if (e.target.closest("a, details, button")) return;
    const link = e.target.closest("tr")?.querySelector("a");
    if (link) location.assign(link.href);
  });

  const change = (patch) => { Object.assign(state, patch, { page: 1 }); sync(); load(); };
  const sync = () => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) if (v && !(k === "page" && v === 1)) p.set(k, v);
    history.replaceState(null, "", p.toString() ? "?" + p : location.pathname);
  };

  async function load() {
    $("#cards").innerHTML = Array(4).fill('<div class="skeleton" style="height:92px"></div>').join("");
    $("#list").innerHTML = skeleton(6);
    $("#pager").innerHTML = "";
    try {
      const r = await getPurchaseRequests({ ...state, pageSize: PAGE_SIZE });
      state.page = r.page;
      renderCards(r.counts);
      renderList(r);
    } catch (err) {
      $("#cards").innerHTML = "";
      $("#list").innerHTML = errorState(err.message);
    }
  }

  function renderCards(c) {
    $("#cards").innerHTML = [
      statCard({ label: "Total Requests", value: c.total, note: "All requests", iconName: "doc" }),
      statCard({ label: "Pending Review", value: c.pending, note: "Awaiting attention", iconName: "clipboard" }),
      statCard({ label: "Approved", value: c.approved, note: "Successfully approved", iconName: "check" }),
      statCard({ label: "Rejected", value: c.rejected, note: "Requests rejected", iconName: "shield" }),
    ].join("");
  }

  function renderList(r) {
    if (!r.items.length) {
      const filtered = state.search || state.status || state.department;
      $("#list").innerHTML = filtered
        ? '<div class="state"><strong>No matching requests</strong><p>Try a different search or filter.</p><button class="btn" type="button" data-clear>Clear filters</button></div>'
        : `<div class="state"><strong>No purchase requests</strong><p>You haven't created any purchase request yet.</p>${user.role === "procurement" ? '<a class="btn btn--primary" href="./new/index.html">+ Create request</a>' : ""}</div>`;
      return;
    }
    const detail = (id) => `./detail/index.html?id=${encodeURIComponent(id)}`;
    $("#list").innerHTML = dataTable([
      { label: "Request", cell: (x) => `<a href="${detail(x.id)}">${esc(x.id)}</a>` },
      { label: "Requester", cell: (x) => esc(x.requester) },
      { label: "Department", cell: (x) => esc(x.department) },
      { label: "Vendor", cell: (x) => (x.vendor ? esc(x.vendor) : '<span class="muted">Not chosen</span>') },
      { label: "Amount", cell: (x) => formatNaira(x.amount) },
      { label: "Status", cell: (x) => requestBadge(x.status) },
      { label: "Date", cell: (x) => formatDate(x.date) },
      { label: "Action", cell: (x) => `<details class="row-menu"><summary aria-label="Actions for ${esc(x.id)}">&middot;&middot;&middot;</summary>
          <div class="row-menu__list"><a href="${detail(x.id)}">View</a></div></details>` },
    ], r.items);
    $("#pager").innerHTML = pagination({ page: r.page, pageSize: r.pageSize, total: r.total, noun: "requests" });
  }

  load();
}