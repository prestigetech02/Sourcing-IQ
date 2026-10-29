/* Small helpers shared by every page */
const full = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
const short = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", notation: "compact", maximumFractionDigits: 1 });

/** formatNaira(12806240) -> ₦12,806,240   formatNaira(12806240, {short:true}) -> ₦12.8M */
export const formatNaira = (n, { short: s = false } = {}) => (s ? short : full).format(n);

/** Escape data before putting it in HTML strings (prevents XSS). */
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);

export function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}