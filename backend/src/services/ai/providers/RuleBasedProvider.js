import { AIProvider } from './AIProvider.js';
import { INTENT, EMPLOYMENT_TYPES } from '../intents.js';
import { isBlockedAction } from '../guard.js';

/**
 * Version 1's default AIProvider — no external API, no key, runs fully
 * offline. Intent detection is keyword/pattern matching (deliberately
 * simple and auditable: every rule below is a plain, readable check,
 * not a black box), and response formatting is fixed templates. This
 * is what "Read-only, natural-language, no external dependency" means
 * in practice for Version 1; a future LLMProvider (see ../providers/
 * LLMProvider.js) can replace this behind the same AIProvider contract
 * without ai.service.js or the frontend changing at all.
 */

const CURRENCY_SYMBOLS = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', AUD: 'A$', CAD: 'C$', SGD: 'S$',
};

function money(amount, currency) {
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency || ''} `;
  const value = Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${value}`;
}

/* ============================================================
   INTENT DETECTION
   ============================================================ */

const GREETING_RE = /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i;
const HELP_RE = /\b(help|what can you do|what do you do|how do (i|you) use)\b/i;

/** "Name them" / "list them" / "show all" / "yes" — refers back to the
    previous turn rather than asking anything new (Sprint 9 conversation
    context). Matched against the WHOLE trimmed question (not just a
    substring) so it only fires for short, unambiguous follow-ups, never
    as part of a longer new question. Checked well before the bare-name
    fallback below — "Name them" would otherwise look like a 2-word
    name candidate. */
const FOLLOW_UP_RE = /^(name them|list them|show them|who are they|show (the )?names|show (the )?full list|full list|show all|list all|show more|yes|yes please|go ahead|sure|show me( them| all)?)[.!?]*$/i;

/** Domain/stopword tokens that must never be mistaken for a bare
    employee-name query (see isLikelyBareName below) — every keyword
    the checks above/below this point actually test for, plus common
    connector words. Not exhaustive by design: this is the last-resort
    fallback, reached only when nothing else in classify() matched, so
    the risk of a false positive is already low; this list just covers
    the single-word cases most likely to reach here untouched (e.g. a
    bare "invoice" or "help" with no other qualifying word). */
const RESERVED_WORDS = new Set([
  'employee', 'employees', 'intern', 'interns', 'contract', 'contractor', 'contractors',
  'invoice', 'invoices', 'payroll', 'salary', 'salaries', 'payslip', 'payslips',
  'company', 'currency', 'drive', 'email', 'emails', 'department', 'departments',
  'help', 'hello', 'hi', 'hey', 'active', 'inactive', 'total', 'outstanding',
  'overdue', 'paid', 'unpaid', 'draft', 'drafts', 'sent', 'cancelled', 'recent',
  'latest', 'tax', 'prefix', 'month', 'joined', 'join', 'them', 'name', 'names',
  'yes', 'no', 'show', 'list', 'all', 'who', 'how', 'many', 'count',
]);

/** Last-resort fallback (Sprint 9, requirement 8 — fuzzy/partial
    employee lookup): a short, plain, alphabetic phrase with nothing
    else recognizable about it ("Pri", "Swar", "Deb", "Priya Sharma")
    is treated as a candidate employee name — employee.service.js's
    existing searchEmployees already does a case-insensitive substring
    match, so "Pri" already resolves to "Priya" etc. without any new
    fuzzy-matching library. 1-3 words, each starting with a letter, none
    of them a reserved/domain word. */
function isLikelyBareName(question) {
  const tokens = question.trim().split(/\s+/);
  if (!tokens.length || tokens.length > 3) return false;
  return tokens.every((t) => /^[A-Za-z][A-Za-z'.-]*$/.test(t) && !RESERVED_WORDS.has(t.toLowerCase()));
}

/** "Tell me about X" / "Who is X" / "Show X's details|profile|info" /
    "X's details" — in that priority order, since "show" alone is far
    too generic (also matches "Show active interns", "Show overdue
    invoices" etc., which are NOT name lookups) and must never win here. */
function extractEmployeeNameLookup(question) {
  let m = question.match(/\b(?:tell me about|who is|who's)\s+(.+?)[.?!]*$/i);
  if (m) return m[1].trim();
  m = question.match(/\bshow(?: me)?\s+(.+?)'s\s+(?:details|profile|info|information)\b/i);
  if (m) return m[1].trim();
  m = question.match(/(.+?)'s\s+(?:details|profile|info|information)\b/i);
  if (m) return m[1].trim();
  // "Employee John" / "Search John" / "Search for John" / "Find John" —
  // only treated as a name lookup when what follows actually looks
  // like a bare name (see isLikelyBareName below), so "Employee count"
  // or "Search overdue invoices" still fall through to their normal
  // handling instead of being misread as a name.
  m = question.match(/^(?:employee|search(?:\s+for)?|find)\s+(.+?)[.?!]*$/i);
  if (m && isLikelyBareName(m[1].trim())) return m[1].trim();
  return null;
}

function extractStatusKeyword(question) {
  if (/\bactive\b/i.test(question) && !/\binactive\b/i.test(question)) return 'Active';
  if (/\binactive\b/i.test(question)) return 'Inactive';
  return null;
}

function extractEmploymentType(question) {
  const q = question.toLowerCase();
  if (/\bintern(s)?\b/.test(q)) return 'Intern';
  if (/\bcontract(or|ors)?\b|\bcontract employees?\b/.test(q)) return 'Contract';
  if (/\bpart[\s-]?time\b/.test(q)) return 'Part-time';
  if (/\bfull[\s-]?time\b/.test(q)) return 'Full-time';
  return null;
}

/** "How many employees are in Tech?" / "employees in Engineering
    department" — everything after a trailing "in ", up to an optional
    "department" word or the end of the sentence. Deliberately narrow
    (only fires when "in" is followed by what looks like a short
    proper-noun-ish phrase) so it doesn't misfire on "employees in the
    company" or similar generic phrasing. */
function extractDepartment(question) {
  const m = question.match(/\bin\s+([A-Za-z][A-Za-z&\-. ]{1,30}?)(?:\s+department)?[.?!]*$/i);
  if (!m) return null;
  const dept = m[1].trim();
  if (/^(the|our|this|that|company|company's|active|all)$/i.test(dept)) return null;
  return dept;
}

/** "unpaid" is a synthetic multi-status group (see UNPAID_INVOICE_STATUSES
    in intents.js) — "outstanding" and "pending" are plain-English
    synonyms for exactly the same group (Sent + Overdue + Partially
    Paid), so they resolve to the same 'unpaid' marker rather than each
    needing their own case everywhere downstream. Checked before the
    single-status checks below so "Overdue invoices" still resolves to
    the specific 'Overdue' status (not folded into the group) while
    "outstanding"/"pending"/"unpaid" always mean the group. */
function extractInvoiceStatus(question) {
  const q = question.toLowerCase();
  if (/\bunpaid\b|\boutstanding\b|\bpending\b/.test(q)) return 'unpaid';
  if (/\boverdue\b/.test(q)) return 'Overdue';
  if (/\bpartially paid\b/.test(q)) return 'Partially Paid';
  if (/\bpaid\b/.test(q)) return 'Paid';
  if (/\bdraft(s)?\b/.test(q)) return 'Draft';
  if (/\bsent\b/.test(q)) return 'Sent';
  if (/\bcancel+ed\b|\bcancel+ed invoices\b/.test(q)) return 'Cancelled';
  return null;
}

/**
 * @param {string} rawQuestion
 * @param {object} [context] - see AIProvider.js — unused by classify()
 *   itself today (the follow-up phrase check below fires regardless of
 *   whether a previous turn actually exists; ai.service.js is the one
 *   that validates `context.previous` and decides whether the follow-up
 *   can actually be resolved). Accepted here so the AIProvider contract
 *   stays uniform and a future LLMProvider — or a smarter RuleBasedProvider
 *   — can use it directly without a signature change.
 * @returns {{ intent: string, entities: Record<string, unknown> }}
 */
function classify(rawQuestion, context) { // eslint-disable-line no-unused-vars
  const q = rawQuestion.trim();
  const lower = q.toLowerCase();

  if (isBlockedAction(q)) {
    return { intent: INTENT.BLOCKED_ACTION, entities: {} };
  }

  if (GREETING_RE.test(q)) return { intent: INTENT.GREETING, entities: {} };
  if (HELP_RE.test(lower)) return { intent: INTENT.HELP, entities: {} };

  // ── Conversation follow-up (Sprint 9) ───────────────────
  // Checked early and only against the WHOLE question, so a longer,
  // self-contained new question is never mistaken for a follow-up just
  // because it happens to contain "show all" as a phrase. Whether
  // there's actually anything to follow up on is ai.service.js's call
  // (see its FOLLOW_UP_LIST branch) — if not, it replies gracefully
  // rather than this function silently falling through to UNKNOWN.
  if (FOLLOW_UP_RE.test(q)) {
    return { intent: INTENT.FOLLOW_UP_LIST, entities: {} };
  }

  // ── Employees ──────────────────────────────────────────
  const name = extractEmployeeNameLookup(q);
  if (name) return { intent: INTENT.EMPLOYEE_LOOKUP, entities: { name } };

  if (/\bjoin(ed)?\b/.test(lower) && /\bmonth\b/.test(lower)) {
    return { intent: INTENT.EMPLOYEE_JOINED_THIS_MONTH, entities: {} };
  }

  if (/\bemployee(s)?\b/.test(lower) && /\brecent\b|\blatest\b/.test(lower)) {
    return { intent: INTENT.EMPLOYEE_RECENT, entities: {} };
  }

  if (/\bemployee(s)?\b|\bintern(s)?\b|\bcontract(or|ors)?\b/.test(lower)) {
    const status = extractStatusKeyword(lower);
    const employmentType = extractEmploymentType(lower);
    const department = extractDepartment(q);
    const entities = { status, employmentType, department };
    if (/\bhow many\b|\bcount\b|\bnumber of\b|\bshow\b|\blist\b|\ball\b|\bwho\b/.test(lower)) {
      return { intent: INTENT.EMPLOYEE_COUNT, entities };
    }
  }

  // ── Invoices ───────────────────────────────────────────
  // Entry condition deliberately broadened beyond "contains the word
  // 'invoice'" (Sprint 10, requirement 1): "How many are paid?" or
  // "Pending invoices" have no other section to match, so a bare
  // status word alone (paid/unpaid/outstanding/pending/overdue/draft/
  // sent/cancelled — see extractInvoiceStatus) is enough to enter this
  // block on its own, same as the literal word "invoice(s)".
  const invoiceStatusHit = extractInvoiceStatus(lower);
  if (/\binvoice(s)?\b/.test(lower) || invoiceStatusHit) {
    if (/\bgenerated\b.*\bmonth\b|\bmonth\b.*\binvoice/.test(lower) || (/\bthis month\b/.test(lower) && /\binvoice/.test(lower))) {
      return { intent: INTENT.INVOICE_THIS_MONTH, entities: {} };
    }
    // "unpaid"/"outstanding"/"pending" (the synthetic group) or a bare
    // "invoice summary" always get the full Paid/Unpaid/Overdue/
    // Outstanding-Amount breakdown (requirement 4) rather than a plain
    // count of one status.
    if (invoiceStatusHit === 'unpaid' || /\bsummary\b/.test(lower)) {
      return { intent: INTENT.INVOICE_OUTSTANDING, entities: {} };
    }
    if (/\b(highest|largest|biggest|top)\b/.test(lower)) {
      return { intent: INTENT.INVOICE_LARGEST, entities: { status: invoiceStatusHit } };
    }
    if (/\brecent\b|\blatest\b/.test(lower)) {
      return { intent: INTENT.INVOICE_RECENT, entities: {} };
    }
    // A specific status word (paid/draft/sent/overdue/cancelled) is
    // enough on its own — "how many"/"show"/"list" is a bonus signal,
    // not a requirement, so "Paid invoices" and "Draft invoices" work
    // exactly like "How many paid invoices?" did before.
    if (invoiceStatusHit || /\bhow many\b|\bcount\b|\bnumber of\b|\bshow\b|\blist\b|\ball\b/.test(lower)) {
      return { intent: INTENT.INVOICE_COUNT, entities: { status: invoiceStatusHit } };
    }
  }

  // ── Payroll ────────────────────────────────────────────
  if (/\bpayroll\b|\bsalary\b|\bsalaries\b|\bpayslip(s)?\b/.test(lower)) {
    if (/\bemail(s)?\b.*\b(sent|pending)\b|\b(sent|pending)\b.*\bemail(s)?\b/.test(lower)) {
      return /\bpending\b/.test(lower)
        ? { intent: INTENT.PAYROLL_EMAILS_PENDING, entities: {} }
        : { intent: INTENT.PAYROLL_EMAILS_SENT, entities: {} };
    }
    if (/\btotal\b/.test(lower)) {
      return { intent: INTENT.PAYROLL_TOTAL_AMOUNT, entities: {} };
    }
    if (/\bdepartment\b.*\bcount\b|\bhow many\b.*\bdepartment/.test(lower)) {
      return { intent: INTENT.PAYROLL_DEPARTMENT_COUNT, entities: {} };
    }
    if (/\bemployee\b.*\bcount\b|\bhow many\b.*\bemployee/.test(lower)) {
      return { intent: INTENT.PAYROLL_EMPLOYEE_COUNT, entities: {} };
    }
    if (/\bgenerated\b|\bthis month\b/.test(lower)) {
      return { intent: INTENT.PAYROLL_THIS_MONTH, entities: {} };
    }
  }
  if (/\bdepartment(s)?\b.*\bhow many\b|\bhow many\b.*\bdepartment(s)?\b/.test(lower)) {
    return { intent: INTENT.PAYROLL_DEPARTMENT_COUNT, entities: {} };
  }

  // ── Company ────────────────────────────────────────────
  if (/\bcompany name\b|\bname of the company\b|\bour company\b.*\bname\b/.test(lower)) {
    return { intent: INTENT.COMPANY_NAME, entities: {} };
  }
  if (/\b(default|current)\s+currency\b|\bwhat currency\b/.test(lower)) {
    return { intent: INTENT.COMPANY_CURRENCY, entities: {} };
  }
  if (/\bgoogle drive\b|\bdrive\b.*\bconnect/.test(lower)) {
    return { intent: INTENT.COMPANY_DRIVE_STATUS, entities: {} };
  }
  if (/\bemail\b.*\bconfigur/.test(lower)) {
    return { intent: INTENT.COMPANY_EMAIL_STATUS, entities: {} };
  }
  if (/\binvoice prefix\b/.test(lower)) {
    return { intent: INTENT.COMPANY_INVOICE_PREFIX, entities: {} };
  }
  if (/\bdefault tax\b/.test(lower)) {
    return { intent: INTENT.COMPANY_DEFAULT_TAX, entities: {} };
  }

  // ── System health ──────────────────────────────────────
  if (/\bsystem health\b|\bhealth check\b|\bstatus check\b/.test(lower)) {
    return { intent: INTENT.SYSTEM_HEALTH, entities: {} };
  }

  // ── Bare name, last resort (Sprint 9, requirement 8) ────
  if (isLikelyBareName(q)) {
    return { intent: INTENT.EMPLOYEE_LOOKUP, entities: { name: q } };
  }

  return { intent: INTENT.UNKNOWN, entities: {} };
}

/* ============================================================
   RESPONSE FORMATTING
   ============================================================ */

function formatEmployeeLookup(data) {
  if (!data || !data.employee) {
    return `I couldn't find an employee matching "${data?.searchedFor || ''}". Double-check the spelling, or try their employee ID.`;
  }
  const e = data.employee;
  const lines = [
    `**${e.fullName}**`,
    `- Employee ID: ${e.employeeId || '—'}`,
    `- Department: ${e.department || '—'}`,
    `- Designation: ${e.designation || '—'}`,
    `- Employment Type: ${e.employmentType || '—'}`,
    `- Status: ${e.status || '—'}`,
    `- Joining Date: ${e.dateOfJoining || '—'}`,
    `- Work Email: ${e.email || '—'}`,
    `- Phone: ${e.phone || '—'}`,
  ];
  if (data.moreMatches > 0) {
    lines.push('', `(${data.moreMatches} other employee${data.moreMatches === 1 ? '' : 's'} also matched "${data.searchedFor}" — showing the closest match.)`);
  }
  return lines.join('\n');
}

function describeEmployeeFilters({ status, employmentType, department }) {
  const parts = [];
  if (status) parts.push(status.toLowerCase());
  if (employmentType) parts.push(employmentType.toLowerCase());
  if (department) parts.push(`in ${department}`);
  return parts.length ? ` ${parts.join(' ')}` : '';
}

/** Shared by every "count of records" intent (Sprint 9, requirement 9):
    10 or fewer → list them automatically; more than 10 → state the
    total and offer the full list rather than dumping it. `full` comes
    from ai.service.js's resolveData — set when this call is itself the
    answer to a "name them"/"show all" follow-up (INTENT.FOLLOW_UP_LIST),
    in which case the list is always shown regardless of size (still
    capped server-side at a sane maximum — see ai.service.js). */
function formatCountWithList({ headline, items, total, full, formatItem, offerHint }) {
  const shouldList = full || total <= 10;
  if (!shouldList) {
    return `${headline}\n\nWould you like the full list? Just ask "${offerHint || 'show all'}".`;
  }
  if (!items || !items.length) return headline;
  return [headline, ...items.map((item, i) => formatItem(item, i))].join('\n');
}

/** "1. John\n   HR Executive" — numbered, with role on its own indented
    line underneath (requirement 2, "much more professional" than a
    flat name-only bullet). Falls back to department, then em-dash, if
    designation isn't on file. */
function formatEmployeeListItem(e, i) {
  return `${i + 1}. ${e.fullName}\n   ${e.designation || e.department || '—'}`;
}

/** Appended to an UNFILTERED employee-count answer only (requirement
    8, "make it feel intelligent") — a filtered answer (e.g. "active
    interns") already told the user what they asked for, so the hint
    would just be noise there. */
const EMPLOYEE_COUNT_HINT = `Need more details? Try asking about:\n- Active\n- Inactive\n- Interns\n- Contractors`;

function formatEmployeeCount(data) {
  const desc = describeEmployeeFilters(data.filters || {});
  const headline = `There ${data.count === 1 ? 'is' : 'are'} **${data.count}**${desc} employee${data.count === 1 ? '' : 's'}.`;
  if (!data.count) return headline;
  const body = formatCountWithList({
    headline,
    items: data.items || [],
    total: data.count,
    full: !!data.full,
    formatItem: formatEmployeeListItem,
  });
  const { status, employmentType, department } = data.filters || {};
  const unfiltered = !status && !employmentType && !department;
  return unfiltered && !data.full ? `${body}\n\n${EMPLOYEE_COUNT_HINT}` : body;
}

function formatEmployeeJoinedThisMonth(data) {
  if (!data.total) {
    const base = `No employees joined in ${data.monthLabel}.`;
    if (!data.latestJoined) return base;
    return `${base}\n\nThe latest employee joined on ${data.latestJoined.dateOfJoining} (${data.latestJoined.fullName}).`;
  }
  const headline = `**${data.total}** employee${data.total === 1 ? '' : 's'} joined in ${data.monthLabel}.`;
  return formatCountWithList({
    headline,
    items: data.items || [],
    total: data.total,
    full: !!data.full,
    formatItem: formatEmployeeListItem,
  });
}

function formatEmployeeRecent(data) {
  if (!data.items.length) return `There are no employees on file yet.`;
  return [`Most recently joined employees:`, ...data.items.map(formatEmployeeListItem)].join('\n');
}

function invoiceStatusLabel(status) {
  if (!status) return 'total';
  if (status === 'unpaid') return 'unpaid (Sent, Overdue, or Partially Paid)';
  return status.toLowerCase();
}

function formatInvoiceItem(inv) {
  return `- ${inv.invoiceNumber} — ${inv.customer || 'Unknown'} — ${money(inv.grandTotal, inv.currency)} (${inv.status})`;
}

function formatInvoiceCount(data) {
  const headline = `There ${data.count === 1 ? 'is' : 'are'} **${data.count}** ${invoiceStatusLabel(data.status)} invoice${data.count === 1 ? '' : 's'}.`;
  if (!data.count) return headline;
  return formatCountWithList({
    headline,
    items: data.items || [],
    total: data.count,
    full: !!data.full,
    formatItem: formatInvoiceItem,
  });
}

/** Requirement 4 — "unpaid"/"outstanding"/"pending"/"invoice summary"
    all get this full breakdown rather than a single-status count:
    Paid / Unpaid (the Sent+Overdue+Partially Paid group) / Overdue /
    Outstanding Amount. Still list-capable — a "show all"/"name them"
    follow-up lists the actual unpaid invoices (data.items), same as
    before. */
function formatInvoiceOutstanding(data) {
  const amountLines = Object.entries(data.amountsByCurrency || {}).map(([currency, amount]) => `Outstanding Amount: ${money(amount, currency)}`);
  const headline = [
    `**Invoice Summary**`,
    ``,
    `Paid: ${data.paidCount || 0}`,
    `Unpaid: ${data.count || 0}`,
    `Overdue: ${data.overdueCount || 0}`,
    ...(amountLines.length ? amountLines : ['Outstanding Amount: —']),
  ].join('\n');
  if (!data.count) return headline;
  return formatCountWithList({
    headline,
    items: data.items || [],
    total: data.count,
    full: !!data.full,
    formatItem: formatInvoiceItem,
    offerHint: 'show all',
  });
}

function formatInvoiceLargest(data) {
  if (!data.invoice) return `I couldn't find any ${invoiceStatusLabel(data.status)} invoices.`;
  const inv = data.invoice;
  return `The largest ${invoiceStatusLabel(data.status)} invoice is **${inv.invoiceNumber}** — ${inv.customer || 'Unknown customer'}, ${money(inv.grandTotal, inv.currency)} (${inv.status}).`;
}

function formatInvoiceRecent(data) {
  if (!data.items.length) return `There are no invoices yet.`;
  return [`Most recent invoices:`, ...data.items.map(formatInvoiceItem)].join('\n');
}

function formatInvoiceThisMonth(data) {
  return `**${data.count}** invoice${data.count === 1 ? ' was' : 's were'} generated in ${data.monthLabel}.`;
}

function formatPayrollThisMonth(data) {
  return `Payroll has been generated for **${data.count}** employee${data.count === 1 ? '' : 's'} in ${data.monthLabel}.`;
}

function formatPayrollEmailsSent(data) {
  return `**${data.count}** salary email${data.count === 1 ? ' has' : 's have'} been sent for ${data.monthLabel}.`;
}

function formatPayrollEmailsPending(data) {
  if (!data.count) return `No salary emails are pending for ${data.monthLabel} — all generated slips have been emailed.`;
  return `**${data.count}** salary email${data.count === 1 ? ' is' : 's are'} still pending for ${data.monthLabel}.`;
}

function formatPayrollEmployeeCount(data) {
  return [
    `**${data.total}** total employees:`,
    `- Active: ${data.active}`,
    `- Inactive: ${data.inactive}`,
  ].join('\n');
}

function formatPayrollDepartmentCount(data) {
  return `There ${data.count === 1 ? 'is' : 'are'} **${data.count}** department${data.count === 1 ? '' : 's'}.`;
}

function formatPayrollTotalAmount(data) {
  return `Total payroll for ${data.monthLabel}: **${money(data.totalNetSalary, data.currency)}** across ${data.count} payslip${data.count === 1 ? '' : 's'}.`;
}

function formatCompanyValue(label, value) {
  if (value === undefined || value === null || value === '') {
    return `I don't have that on file — make sure Company Settings has loaded, then ask again.`;
  }
  return `${label}: **${value}**.`;
}

function formatDriveStatus(data) {
  if (!data.connected) return `Google Drive is **not connected**.`;
  return `Google Drive is **connected**${data.email ? ` (account: ${data.email})` : ''}.`;
}

function formatEmailStatus(data) {
  if (data.configured) return `Email sending is **configured**.`;
  return `Email sending is **not fully configured** — check the RESEND_API_KEY and EMAIL_FROM environment variables.`;
}

/** "System Health" — a status-light summary across every subsystem
    this AI Assistant itself can read (requirement 12). 🟢/🟡/🔴 are
    plain text, not an interactive widget — same fixed-template
    approach as every other formatter here. MongoDB has no explicit
    line: this function only runs at all because a Mongo-backed query
    already succeeded upstream in ai.service.js, so "connected" is
    implicit rather than re-checked. */
function formatSystemHealth(data) {
  const lines = [`**System Health**`, ``, `🟢 MongoDB Connected`];
  lines.push(data.driveConnected ? `🟢 Google Drive Connected` : `🟡 Google Drive Not Connected`);
  lines.push(data.emailConfigured ? `🟢 Email Configured` : `🟡 Email Not Configured`);
  lines.push(data.overdueInvoices > 0
    ? `🟡 ${data.overdueInvoices} invoice${data.overdueInvoices === 1 ? '' : 's'} overdue`
    : `🟢 No overdue invoices`);
  lines.push(data.missingPhone > 0
    ? `🟡 ${data.missingPhone} employee${data.missingPhone === 1 ? '' : 's'} missing phone number`
    : `🟢 All employees have a phone number on file`);
  lines.push(data.payrollGeneratedCount > 0
    ? `🟢 Payroll generated for ${data.monthLabel} (${data.payrollGeneratedCount})`
    : `🟡 Payroll not yet generated for ${data.monthLabel}`);
  return lines.join('\n');
}

const ASSISTANT_NAME = 'Arna Intelligence IntelliPayRoll AI Assistant';
const GREETING_CAPABILITIES = [`I can help you with:`, `- Employees`, `- Payroll`, `- Invoices`, `- Company Settings`, ``, `Try asking:`, `"Who joined this month?"`, `"Show unpaid invoices."`, `"Tell me about Priya."`].join('\n');

/** Server-clock time-of-day greeting — reasonable for a single-tenant
    deployment where the server and its users share a timezone; there's
    no per-user identity in this app to greet by name (see
    ai.service.js's file comment on "no per-user auth"), so this greets
    generically rather than guessing a name. */
function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const FORMATTERS = {
  [INTENT.GREETING]: () =>
    `${timeOfDayGreeting()}! I'm the ${ASSISTANT_NAME}.\n\n${GREETING_CAPABILITIES}`,
  [INTENT.HELP]: () =>
    [
      `I can answer questions like:`,
      `- Employees — "How many active employees?", "Tell me about <name>", "Show active interns", "Recent employees?"`,
      `- Invoices — "Paid invoices", "Outstanding invoices", "Invoice summary", "Highest unpaid invoice"`,
      `- Payroll — "Payroll generated this month", "Total payroll this month"`,
      `- Company — "What is the company name?", "System health"`,
      ``,
      `I'm read-only — I can't create, edit, delete, email, or upload anything.`,
    ].join('\n'),
  [INTENT.UNKNOWN]: () =>
    `I'm not sure how to answer that yet. Try rephrasing, or tap one of the suggested questions above.`,
  /** Only ever invoked by ai.service.js for the "nothing to follow up
      on" case — when there IS a valid previous list to reuse, ai.service.js
      calls this provider's ORIGINAL-intent formatter directly (with
      `full: true` data) instead, so the reply reads like a normal
      answer rather than a generic "here's your follow-up" wrapper. */
  [INTENT.FOLLOW_UP_LIST]: () =>
    `I don't have a previous list to show — try asking a specific question first, like "How many active employees?".`,
  [INTENT.EMPLOYEE_LOOKUP]: formatEmployeeLookup,
  [INTENT.EMPLOYEE_COUNT]: formatEmployeeCount,
  [INTENT.EMPLOYEE_JOINED_THIS_MONTH]: formatEmployeeJoinedThisMonth,
  [INTENT.EMPLOYEE_RECENT]: formatEmployeeRecent,
  [INTENT.INVOICE_COUNT]: formatInvoiceCount,
  [INTENT.INVOICE_OUTSTANDING]: formatInvoiceOutstanding,
  [INTENT.INVOICE_LARGEST]: formatInvoiceLargest,
  [INTENT.INVOICE_RECENT]: formatInvoiceRecent,
  [INTENT.INVOICE_THIS_MONTH]: formatInvoiceThisMonth,
  [INTENT.PAYROLL_THIS_MONTH]: formatPayrollThisMonth,
  [INTENT.PAYROLL_EMAILS_SENT]: formatPayrollEmailsSent,
  [INTENT.PAYROLL_EMAILS_PENDING]: formatPayrollEmailsPending,
  [INTENT.PAYROLL_EMPLOYEE_COUNT]: formatPayrollEmployeeCount,
  [INTENT.PAYROLL_DEPARTMENT_COUNT]: formatPayrollDepartmentCount,
  [INTENT.PAYROLL_TOTAL_AMOUNT]: formatPayrollTotalAmount,
  [INTENT.COMPANY_NAME]: (data) => formatCompanyValue('Company name', data?.value),
  [INTENT.COMPANY_CURRENCY]: (data) => formatCompanyValue('Default currency', data?.value),
  [INTENT.COMPANY_INVOICE_PREFIX]: (data) => formatCompanyValue('Invoice prefix', data?.value),
  [INTENT.COMPANY_DEFAULT_TAX]: (data) => formatCompanyValue('Default tax', data?.value !== undefined ? `${data.value}%` : undefined),
  [INTENT.COMPANY_DRIVE_STATUS]: formatDriveStatus,
  [INTENT.COMPANY_EMAIL_STATUS]: formatEmailStatus,
  [INTENT.SYSTEM_HEALTH]: formatSystemHealth,
};

export class RuleBasedProvider extends AIProvider {
  async detectIntent(question, context) {
    return classify(String(question || ''), context);
  }

  async formatResponse(intent, data) {
    const formatter = FORMATTERS[intent];
    if (!formatter) {
      return `I'm not sure how to answer that yet. Try rephrasing, or tap one of the suggested questions above.`;
    }
    return formatter(data);
  }
}

// Exported for ai.service.js's entity-driven follow-up lookups (e.g.
// validating an extracted employmentType against the real enum) and
// for tests — not part of the AIProvider contract itself.
export const KNOWN_EMPLOYMENT_TYPES = EMPLOYMENT_TYPES;
