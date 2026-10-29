/* Dark / light theme: one attribute on <html>, choice saved in the browser. */
const KEY = "pif_theme";

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  document.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

export function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  apply(saved || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
}

export const getTheme = () => document.documentElement.dataset.theme;

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch {}
  apply(theme);
}