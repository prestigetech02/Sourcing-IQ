/* Procurement dashboard: figures, spend chart, categories, price changes, alerts and activity. Data comes from api.js. */
import { requireRole } from "../../shared/js/auth.js";
import { initTheme } from "../../shared/js/theme.js";
import { renderShell } from "../../shared/js/layout.js";
import { getDashboard } from "../../shared/js/api.js";
import { statCard, statusBadge, dataTable, skeleton, errorState } from "../../shared/js/components.js";
import { formatNaira, esc, $ } from "../../shared/js/utils.js";

initTheme();
const user = requireRole(["procurement", "finance"]);

let data = null;
let latest = 0; // ignores a slow response if a newer request was made

if (user) {
  renderShell(user);
  $("#welcome").textContent = `Welcome Back, ${user.name.split(" ")[0]}`;

  $("#range").addEventListener("change", () => load());
  $("#export").addEventListener("click", () => data && exportCsv(data));
  document.addEventListener("click", (e) => { if (e.target.closest("[data-retry]")) load(); });
  load();
}

async function load() {
  const run = ++latest;
  $("#dash-error").innerHTML = "";
  $("#dash-body").hidden = false;
  $("#export").disabled = true;
  $("#cards").innerHTML = Array(4).fill('<div class="skeleton" style="height:92px"></div>').join("");
  for (const id of ["spend", "categories", "prices", "alerts", "activity"]) $("#" + id).innerHTML = skeleton(3);
  $("#legend").innerHTML = "";

  try {
    const d = await getDashboard($("#range").value);
    if (run !== latest) return;
    data = d;
    render(d);
    $("#export").disabled = false;
  } catch (err) {
    if (run !== latest) return;
    $("#dash-body").hidden = true;
    $("#dash-error").innerHTML = `<section class="card panel">${errorState(err.message)}</section>`;
  }
}

function render(d) {
  const k = d.kpis;
  const up = k.spendChange >= 0;
  $("#cards").innerHTML = [
    statCard({ label: "Total Spend", value: formatNaira(k.totalSpend, { short: true }), note: `${up ? "+" : ""}${k.spendChange}% vs previous month`, tone: up ? "success" : "danger", iconName: "trend" }),
    statCard({ label: "Open Requests", value: k.openRequests, note: `${k.needAttention} require attention`, tone: "danger", iconName: "doc" }),
    statCard({ label: "Pending Approvals", value: k.pendingApprovals, note: `+${k.awaitingFinance} awaiting finance`, iconName: "clipboard" }),
    statCard({ label: "Awaiting Delivery", value: k.awaitingDelivery, note: `${k.dueThisWeek} due this week`, tone: "danger", iconName: "truck" }),
  ].join("");

  $("#legend").innerHTML = `
    <span class="legend__item"><small><i class="legend__dot"></i>Total Spend</small><strong>${formatNaira(d.spend.total)}</strong></span>
    <span class="legend__item"><small><i class="legend__dash"></i>Average monthly</small><strong>${formatNaira(d.spend.averageMonthly)}</strong></span>`;
  $("#spend").innerHTML = spendChart(d.spend);
  $("#categories").innerHTML = categoryBars(d.categories);
  $("#prices").innerHTML = priceTable(d.priceChanges);
  $("#alerts").innerHTML = alertList(d.alerts);
  $("#activity").innerHTML = activityFeed(d.activity);
}

/* ---------- spend line chart (inline SVG, no library) ---------- */
function spendChart({ points, averageMonthly }) {
  const W = 640, H = 240, L = 54, R = 16, T = 12, B = 30;
  const max = Math.max(...points.map((p) => p.total), averageMonthly, 1);
  const top = Math.ceil(max / 1e6) * 1e6 || 1e6;
  const x = (i) => (points.length > 1 ? L + (i * (W - L - R)) / (points.length - 1) : (L + W - R) / 2);
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const xy = points.map((p, i) => [x(i), y(p.total)]);

  // smooth curve: horizontal tangents at each point, so it never overshoots the data
  const line = xy.map(([px, py], i) => {
    if (!i) return `M${px},${py}`;
    const [qx, qy] = xy[i - 1], mid = (qx + px) / 2;
    return `C${mid},${qy} ${mid},${py} ${px},${py}`;
  }).join(" ");
  const base = y(0);
  const area = `${line} L${xy.at(-1)[0]},${base} L${xy[0][0]},${base} Z`;

  const grid = [0, 1, 2, 3, 4].map((i) => {
    const v = (top / 4) * i, gy = y(v);
    return `<line class="chart__grid" x1="${L}" x2="${W - R}" y1="${gy}" y2="${gy}"/>
      <text class="chart__label" x="${L - 8}" y="${gy + 4}" text-anchor="end">${formatNaira(v, { short: true })}</text>`;
  }).join("");
  const months = points.map((p, i) => `<text class="chart__label" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(p.label)}</text>`).join("");
  const dots = points.map((p, i) => `<circle class="chart__dot" cx="${xy[i][0]}" cy="${xy[i][1]}" r="4"><title>${esc(p.label)}: ${formatNaira(p.total)}</title></circle>`).join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly purchasing spend, ${esc(points[0].label)} to ${esc(points.at(-1).label)}">
    <defs><linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="currentColor" stop-opacity=".35"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <line class="chart__avg" x1="${L}" x2="${W - R}" y1="${y(averageMonthly)}" y2="${y(averageMonthly)}"/>
    <path d="${area}" fill="url(#spend-fill)"/>
    <path class="chart__line" d="${line}"/>
    ${dots}${months}
  </svg>`;
}

/* ---------- spend by category ---------- */
function categoryBars(list) {
  const max = Math.max(...list.map((c) => c.total), 1);
  return `<ul class="bars">${list.map((c) => `
    <li><span class="bars__name">${esc(c.name)}</span>
      <span class="bars__track"><span class="bars__fill" style="width:${Math.round((c.total / max) * 100)}%"></span></span>
      <span class="bars__value">${formatNaira(c.total, { short: true })}</span></li>`).join("")}</ul>`;
}

/* ---------- price changes ---------- */
function priceTable(list) {
  return dataTable([
    { label: "Product", cell: (x) => esc(x.product) },
    { label: "Supplier", cell: (x) => esc(x.supplier) },
    { label: "Change", cell: (x) => `${x.change > 0 ? "+" : ""}${esc(x.change)}%` },
    { label: "Status", cell: (x) => statusBadge(x.status) },
  ], list);
}

/* ---------- performance alerts ---------- */
function alertList(list) {
  return `<ul class="alerts">${list.map((a) => `
    <li class="alerts__item alerts__item--${esc(a.tone)}"><strong class="alerts__type">${esc(a.type)}</strong>
      <span class="alerts__title">${esc(a.title)}</span><small>${esc(a.text)}</small></li>`).join("")}</ul>`;
}

/* ---------- activity ---------- */
function activityFeed(groups) {
  return groups.map((g) => `<p class="feed__day">${esc(g.day)}</p><ul class="feed">${g.items.map((i) => `
    <li><span class="feed__dot" aria-hidden="true"></span><div><strong>${esc(i.title)}</strong><small>${esc(i.text)}</small></div><time>${esc(i.time)}</time></li>`).join("")}</ul>`).join("");
}

/* ---------- export ---------- */
function exportCsv(d) {
  const rows = [
    ["Section", "Label", "Value"],
    ...d.spend.points.map((p) => ["Monthly spend", p.label, p.total]),
    ...d.categories.map((c) => ["Spend by category", c.name, c.total]),
    ...d.priceChanges.map((p) => ["Price change", `${p.product} (${p.supplier})`, `${p.change}%`]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "dashboard-summary.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}