/* Reusable UI pieces. Each returns an HTML string. Always escape data with esc(). */
import { esc } from "./utils.js";
import { STATUSES } from "./statuses.js";

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4 2 4 5"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  truck: '<path d="M2 6h11v10H2zM13 9h5l3 3v4h-8"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-5M13 16V7M18 16v-8"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/>',
  bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4l2-2ZM10 21h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',
  doc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  logo: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
};

export const icon = (name, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

/** KPI card. tone: "success" | "danger" | "" */
export const statCard = ({ label, value, note, tone = "", iconName = "" }) =>
  `<article class="card stat"><div class="stat__top"><span>${esc(label)}</span>${iconName ? icon(iconName, 16) : ""}</div>
   <strong class="stat__value">${esc(value)}</strong><small class="stat__note ${tone}">${esc(note)}</small></article>`;

const TONES = { approved: "success", monitor: "success", pending: "info", review: "info", normal: "info", rejected: "danger" };

/** One place decides what each status looks like. */
export const statusBadge = (status) =>
  `<span class="badge badge--${TONES[String(status).toLowerCase()] || "info"}">${esc(status)}</span>`;

export const skeleton = (rows = 3) => Array.from({ length: rows }, () => '<div class="skeleton"></div>').join("");

export const emptyState = (title, text = "") =>
  `<div class="state"><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;

export const errorState = (message) =>
  `<div class="state state--error"><strong>Something went wrong</strong><p>${esc(message)}</p>
   <button class="btn" type="button" data-retry>Try again</button></div>`;

/** Badge for a purchase request status key, e.g. requestBadge("under_review"). */
export const requestBadge = (key) => {
  const s = STATUSES[key] || { label: key, tone: "neutral" };
  return `<span class="badge badge--${s.tone}">${esc(s.label)}</span>`;
};

/** columns: [{ label, cell: (row) => html }]. cell() must escape any data it prints. */
export const dataTable = (columns, rows) =>
  `<div class="table-wrap"><table class="table"><thead><tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead>
   <tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td>${c.cell(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

/** Buttons carry data-page; the page listens for clicks. */
export function pagination({ page, pageSize, total, noun = "results" }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = [];
  for (let n = start; n <= Math.min(pages, start + 4); n++) {
    nums.push(`<button type="button" data-page="${n}" ${n === page ? 'aria-current="page"' : ""}>${n}</button>`);
  }
  return `<div class="pager"><span>Showing ${from} to ${to} of ${total} ${esc(noun)}</span>
    <nav aria-label="Pagination"><button type="button" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Previous</button>${nums.join("")}
    <button type="button" data-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Next</button></nav></div>`;
}