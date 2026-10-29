/* Single source of truth for purchase request statuses, who can act, and reject reasons.
   Badges, filters, cards and action buttons all read from here.
   BACKEND: the status keys below must match what the API returns. */

export const STATUSES = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "info" },
  under_review: { label: "Under review", tone: "info" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  sourcing: { label: "Sourcing", tone: "info" },
  ordered: { label: "Ordered", tone: "info" },
  partially_fulfilled: { label: "Partially fulfilled", tone: "warning" },
  fulfilled: { label: "Fulfilled", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** Which statuses count towards each card on the Purchase Requests page. */
export const CARD_GROUPS = {
  pending: ["submitted", "under_review"],
  approved: ["approved", "sourcing", "ordered", "partially_fulfilled", "fulfilled"],
  rejected: ["rejected"],
};

/** Who can do what, per status. The backend must enforce the same rules. */
const ACTIONS = {
  procurement: {
    draft: ["edit", "submit", "cancel"],
    submitted: ["withdraw"],
    approved: ["start_sourcing", "request_changes", "cancel"], // only after Finance's first approval
    sourcing: ["create_rfq", "compare_quotes"],
    ordered: ["record_receipt"],
    partially_fulfilled: ["record_receipt"],
  },
  finance: {
    submitted: ["start_review"],
    under_review: ["approve", "reject"],
    sourcing: ["approve_quote"], // only once Procurement has selected a quote
  },
};

const ACTION_LABELS = {
  edit: "Edit", submit: "Submit request", cancel: "Cancel request", withdraw: "Withdraw",
  start_sourcing: "Start sourcing", request_changes: "Request changes", create_rfq: "Create RFQ",
  compare_quotes: "Compare quotes", record_receipt: "Record receipt", start_review: "Start review",
  approve: "Approve", reject: "Reject", approve_quote: "Approve selected quote",
};

export const actionsFor = (status, role) =>
  (ACTIONS[role]?.[status] || []).map((id) => ({ id, label: ACTION_LABELS[id] }));

/** Reasons Finance picks from when rejecting. [value, label] */
export const REQUEST_REJECT_REASONS = [
  ["over_budget", "Over budget"], ["no_longer_needed", "Product no longer needed"],
  ["duplicate", "Duplicate request"], ["insufficient_info", "Not enough information"],
  ["policy", "Not in line with policy"], ["other", "Other (add a note)"],
];
export const QUOTE_REJECT_REASONS = [
  ["price_too_high", "Price too high"], ["supplier_not_trusted", "Supplier not trusted"],
  ["delivery_terms", "Delivery terms unacceptable"], ["better_quote", "Better quote available"],
  ["other", "Other (add a note)"],
];

/* Options used by forms and filters */
export const DEPARTMENTS = ["Operations", "IT", "Marketing", "Admin", "Kitchen"];
export const COST_CENTRES = ["Restaurant 1", "Restaurant 2", "Restaurant 3", "Head office"];
export const UNITS = ["Units", "Boxes", "Packs", "Kg", "Litres"];