/**
 * ARNA AI Assistant (Sprint 8, Version 1 — read-only) — the fixed
 * vocabulary of intents every AIProvider implementation (RuleBasedProvider
 * today, a future LLMProvider later) must classify a question into.
 * ai.service.js is the only place that maps an intent to an actual
 * backend service call; providers never touch MongoDB or any service
 * directly — they only ever return one of these intent names (plus
 * extracted entities) or format an already-fetched data object into text.
 * Keeping this list in one shared file (rather than each provider
 * inventing its own strings) is what lets ai.service.js's read-only
 * guard and data-dispatch switch stay identical no matter which
 * provider is active.
 */

export const INTENT = Object.freeze({
  // Meta
  GREETING: 'greeting',
  HELP: 'help',
  /** Anything that reads as an attempt to create/update/delete/send/
      upload — never dispatched to any service; ai.service.js replies
      with the fixed Version 1 read-only refusal instead. */
  BLOCKED_ACTION: 'blocked_action',
  /** Recognized as a question but not matched to anything specific — a
      "try a suggested question" nudge, not an error. */
  UNKNOWN: 'unknown',
  /** "Name them" / "show all" / "list them" / "yes" — refers back to
      the previous turn's result rather than asking anything new.
      ai.service.js resolves this using the `previous` turn the
      frontend echoes back (see LIST_CAPABLE_INTENTS below), never a
      server-side session store (Sprint 9 requirement: session state on
      the client only, nothing conversation-related in MongoDB). */
  FOLLOW_UP_LIST: 'follow_up_list',

  // Employees — EMPLOYEE_COUNT covers both "how many" and "show/list"
  // phrasings: the answer shape is identical either way (a total, plus
  // names when there are few enough to be useful — see
  // LIST_CAPABLE_INTENTS/formatCountWithList in RuleBasedProvider.js),
  // so there's no reason for two separate intents that'd need two
  // near-identical formatters.
  EMPLOYEE_LOOKUP: 'employee_lookup',
  EMPLOYEE_COUNT: 'employee_count',
  EMPLOYEE_JOINED_THIS_MONTH: 'employee_joined_this_month',
  /** "Recent employees?" — most recently joined, fixed-size (5), not
      list-follow-up-capable (there's no meaningful "show all" for a
      "recent" question — see INVOICE_RECENT for the same shape). */
  EMPLOYEE_RECENT: 'employee_recent',

  // Invoices
  INVOICE_COUNT: 'invoice_count',
  /** Also answers "unpaid"/"outstanding"/"pending" — a full Paid/
      Unpaid/Overdue/Outstanding-Amount breakdown, not just a single
      status count (see RuleBasedProvider.js's formatInvoiceOutstanding). */
  INVOICE_OUTSTANDING: 'invoice_outstanding',
  INVOICE_LARGEST: 'invoice_largest',
  INVOICE_RECENT: 'invoice_recent',
  INVOICE_THIS_MONTH: 'invoice_this_month',

  // Payroll (Salary History)
  PAYROLL_THIS_MONTH: 'payroll_this_month',
  PAYROLL_EMAILS_SENT: 'payroll_emails_sent',
  PAYROLL_EMAILS_PENDING: 'payroll_emails_pending',
  PAYROLL_EMPLOYEE_COUNT: 'payroll_employee_count',
  PAYROLL_DEPARTMENT_COUNT: 'payroll_department_count',
  PAYROLL_TOTAL_AMOUNT: 'payroll_total_amount',

  // Company (Company Settings / Invoice Settings — frontend-only
  // localStorage today, see ai.service.js's handling of `context`)
  COMPANY_NAME: 'company_name',
  COMPANY_CURRENCY: 'company_currency',
  COMPANY_DRIVE_STATUS: 'company_drive_status',
  COMPANY_EMAIL_STATUS: 'company_email_status',
  COMPANY_INVOICE_PREFIX: 'company_invoice_prefix',
  COMPANY_DEFAULT_TAX: 'company_default_tax',

  /** "System health" / "health check" — a single glance across Mongo
      (implicit: this backend can't run at all without it, so reaching
      here means it's up), Google Drive, Email, plus a couple of
      at-a-glance operational flags (overdue invoices, employees
      missing a phone number, payroll generated this month). Read-only,
      same as everything else — just fans out to several existing
      read services instead of one. */
  SYSTEM_HEALTH: 'system_health',
});

/** Invoice.status (backend/src/models/Invoice.js) has no literal
    "Unpaid" value — the model's enum is Draft/Sent/Paid/Partially Paid/
    Overdue/Cancelled. "Unpaid" (as the suggested questions and spec use
    it) is defined here, once, as "issued but not fully settled": Sent,
    Overdue, or Partially Paid — excludes Draft (not yet issued) and
    Cancelled (void). Every intent that needs this definition imports
    it from here rather than re-deciding it, and the response text
    always spells out which statuses were counted so the definition is
    never a hidden assumption. */
export const UNPAID_INVOICE_STATUSES = Object.freeze(['Sent', 'Overdue', 'Partially Paid']);

export const INVOICE_STATUSES = Object.freeze(['Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled']);

export const EMPLOYMENT_TYPES = Object.freeze(['Full-time', 'Part-time', 'Contract', 'Intern']);

/** Every intent whose resolveData() result carries a `items`/`total`
    pair that a bare "name them" / "show all" follow-up (INTENT.FOLLOW_UP_LIST)
    can re-fetch at full detail. ai.service.js checks the frontend-
    echoed `previous.intent` against this set before honoring a
    follow-up — anything else (a scalar answer like "total payroll" or
    "is Drive connected") has nothing to list, so the assistant says so
    instead of guessing. */
export const LIST_CAPABLE_INTENTS = Object.freeze([
  INTENT.EMPLOYEE_COUNT,
  INTENT.EMPLOYEE_JOINED_THIS_MONTH,
  INTENT.INVOICE_COUNT,
  INTENT.INVOICE_OUTSTANDING,
]);
