/* Create purchase request: validate, save as draft or submit, then open the details page. */
import { requireRole } from "../../../../shared/js/auth.js";
import { initTheme } from "../../../../shared/js/theme.js";
import { renderShell } from "../../../../shared/js/layout.js";
import { createPurchaseRequest } from "../../../../shared/js/api.js";
import { DEPARTMENTS, COST_CENTRES, UNITS } from "../../../../shared/js/statuses.js";
import { esc, $ } from "../../../../shared/js/utils.js";

const MAX_BYTES = 5 * 1024 * 1024;
const OK_TYPES = ["pdf", "png", "jpg", "jpeg", "doc", "docx", "xls", "xlsx"];

initTheme();
const user = requireRole(["procurement"]); // MVP: only Procurement creates requests

if (user) {
  renderShell(user);
  const form = $("#pr-form");
  const options = (list, first) => (first ? `<option value="">${first}</option>` : "") + list.map((v) => `<option>${v}</option>`).join("");
  $("#unit").innerHTML = options(UNITS);
  $("#department").innerHTML = options(DEPARTMENTS, "Select department");
  $("#costCentre").innerHTML = options(COST_CENTRES, "Select cost centre");
  $("#requiredBy").min = new Date().toISOString().slice(0, 10);

  /* ---------- field errors ---------- */
  const errEl = (input) => document.getElementById(input.getAttribute("aria-describedby"));
  const setError = (input, msg) => { input.setAttribute("aria-invalid", "true"); errEl(input).textContent = msg; errEl(input).hidden = false; };
  const clearError = (input) => { input.removeAttribute("aria-invalid"); const e = errEl(input); if (e) { e.textContent = ""; e.hidden = true; } };
  form.querySelectorAll(".input[aria-describedby]").forEach((i) => i.addEventListener("input", () => clearError(i)));

  /** Draft needs only the item. Submit needs everything required. */
  function validate(strict) {
    const checks = [[$("#item"), (v) => (v.trim() ? "" : "Item or product is required")]];
    if (strict) {
      checks.push(
        [$("#quantity"), (v) => (Number.isInteger(Number(v)) && Number(v) >= 1 ? "" : "Enter a whole quantity of 1 or more")],
        [$("#requiredBy"), (v) => (!v ? "Choose the date you need it by" : v < $("#requiredBy").min ? "The date can't be in the past" : "")],
        [$("#department"), (v) => (v ? "" : "Select a department")],
      );
    }
    checks.push([$("#budget"), (v) => (v !== "" && Number(v) < 0 ? "Budget can't be negative" : "")]);
    let first = null;
    for (const [input, rule] of checks) {
      const msg = rule(input.value);
      if (msg) { setError(input, msg); first ??= input; } else clearError(input);
    }
    first?.focus();
    return !first;
  }

  /* ---------- attachments (names only in the mock; the backend receives the real files) ---------- */
  let files = [];
  const fileError = $("#file-error");
  function addFiles(list) {
    fileError.hidden = true;
    const problems = [];
    for (const f of list) {
      const ext = f.name.split(".").pop().toLowerCase();
      if (!OK_TYPES.includes(ext)) problems.push(`${f.name}: this file type isn't allowed`);
      else if (f.size > MAX_BYTES) problems.push(`${f.name}: larger than 5 MB`);
      else if (!files.some((x) => x.name === f.name && x.size === f.size)) files.push(f);
    }
    if (problems.length) { fileError.textContent = problems.join(". "); fileError.hidden = false; }
    renderFiles();
  }
  function renderFiles() {
    $("#file-list").innerHTML = files.map((f, i) =>
      `<li><span>${esc(f.name)} <small>(${Math.max(1, Math.round(f.size / 1024))} KB)</small></span>
       <button type="button" data-remove="${i}" aria-label="Remove ${esc(f.name)}">&times;</button></li>`).join("");
  }
  $("#files").addEventListener("change", (e) => { addFiles([...e.target.files]); e.target.value = ""; });
  $("#file-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    if (b) { files.splice(Number(b.dataset.remove), 1); renderFiles(); }
  });
  const zone = $("#dropzone");
  ["dragenter", "dragover"].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.remove("is-over"); }));
  zone.addEventListener("drop", (e) => addFiles([...e.dataTransfer.files]));

  /* ---------- submit ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = e.submitter;
    const submit = button?.value === "submit";
    $("#form-error").hidden = true;
    if (!validate(submit)) return;

    const buttons = form.querySelectorAll('button[type="submit"]');
    const label = button.textContent;
    buttons.forEach((b) => (b.disabled = true));
    button.textContent = submit ? "Submitting..." : "Saving...";
    try {
      const data = { ...Object.fromEntries(new FormData(form)), attachments: files.map((f) => ({ name: f.name, size: f.size })), submit };
      const rec = await createPurchaseRequest(data, user);
      location.assign(`../detail/index.html?id=${encodeURIComponent(rec.id)}`); // go to the details page
    } catch {
      $("#form-error").textContent = "We couldn't save your request. Check your connection and try again.";
      $("#form-error").hidden = false;
      buttons.forEach((b) => (b.disabled = false));
      button.textContent = label;
    }
  });
}