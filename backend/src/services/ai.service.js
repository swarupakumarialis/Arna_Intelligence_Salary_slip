import * as employeeService from './employee.service.js';
import * as invoiceService from './invoice.service.js';
import * as salaryHistoryService from './salaryHistory.service.js';
import * as storageService from './storage/storageService.js';
import { verifyEmailTransporter } from './email.service.js';
import { getAIProvider } from './ai/providerFactory.js';
import { INTENT, UNPAID_INVOICE_STATUSES, LIST_CAPABLE_INTENTS } from './ai/intents.js';

/** Hard ceiling on how many records a "show all"/"name them" follow-up
    (INTENT.FOLLOW_UP_LIST) can return in one reply — "full list" still
    means something bounded, not literally every row in a very large
    collection dumped into one chat bubble. */
const FULL_LIST_CAP = 200;

/**
 * ARNA AI Assistant orchestrator (Sprint 8, Version 1 — read-only).
 *
 * This is the ONE place that turns an intent into an actual database
 * read: User Question → (provider) Intent Detection → (this file)
 * Backend Service → MongoDB → structured JSON → (provider) AI formats
 * response. Every case in resolveData() below calls an existing,
 * already-reviewed read function on employee.service.js/
 * invoice.service.js/salaryHistory.service.js/storageService/
 * email.service.js — never a raw Mongoose query written here, and
 * never create/update/delete on any of them. That's what makes "must
 * NEVER modify data" a structural guarantee rather than a matter of
 * the active AIProvider behaving itself: even if a future LLMProvider
 * (see ./ai/providers/LLMProvider.js) mis-classifies a question, the
 * switch below simply has no case that can mutate anything — the
 * worst it can do is return the wrong read.
 *
 * Employee lookups are the one place this file actively narrows the
 * data it hands to the provider: only the public fields listed in the
 * spec (name, ID, department, designation, employment type, status,
 * joining date, work email, phone) are ever put on the `data` object a
 * provider's formatResponse() sees — PAN/Aadhaar/bank details/salary/
 * UAN never leave employee.service.js's result here, regardless of
 * which provider is asking.
 */

const BLOCKED_MESSAGE = 'Version 1 of ARNA AI Assistant is read-only and cannot perform actions.';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM' — used for the dateOfJoining prefix match in
    employee.service.js's getEmployeesJoinedInMonth. */
function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** { dateFrom, dateTo } as 'YYYY-MM-DD' strings spanning the current
    calendar month — used for Invoice's dateFrom/dateTo range filter
    (invoiceDate is a lexicographically-sortable 'YYYY-MM-DD' string,
    see invoice.service.js's buildQuery). */
function currentMonthDateRange() {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  const lastDay = new Date(year, month + 1, 0).getDate();
  const mm = pad2(month + 1);
  return { dateFrom: `${year}-${mm}-01`, dateTo: `${year}-${mm}-${pad2(lastDay)}` };
}

/** { month, year } as the plain strings SalaryHistory stores them in
    (e.g. { month: 'August', year: '2026' }) — must match
    getCurrentMonthName()/getCurrentYear() in src/utils/date.ts exactly,
    since that's what the Salary Generator itself stamps onto every
    record it creates. */
function currentSalaryMonthYear() {
  const d = new Date();
  return {
    month: d.toLocaleDateString('en-IN', { month: 'long' }),
    year: String(d.getFullYear()),
  };
}

/** Human-readable label for response text, e.g. "August 2026". */
function currentMonthLabel() {
  return new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/** The exact, spec-mandated public field allowlist for a single
    employee lookup — see the file-level comment above. Never add a
    field here without checking it against the spec's "Do NOT display"
    list first. */
function pickPublicEmployeeFields(e) {
  return {
    fullName: e.fullName,
    employeeId: e.employeeId,
    department: e.department || '',
    designation: e.designation || '',
    employmentType: e.employmentType || '',
    status: e.status,
    dateOfJoining: e.dateOfJoining || '',
    email: e.email || '',
    phone: e.phone || '',
  };
}

function pickListEmployeeFields(e) {
  return {
    fullName: e.fullName,
    employeeId: e.employeeId,
    department: e.department || '',
    designation: e.designation || '',
    dateOfJoining: e.dateOfJoining || '',
  };
}

function pickInvoiceFields(inv) {
  if (!inv) return null;
  return {
    invoiceNumber: inv.invoiceNumber,
    customer: inv.customer,
    grandTotal: inv.grandTotal,
    currency: inv.currency,
    status: inv.status,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
  };
}

/** Employee-side entities (status/employmentType/department) came from
    free-text pattern matching in RuleBasedProvider — resolved against
    the real enum values here (case-insensitive) so a near-miss like
    "interns" already normalized to 'Intern' by the provider still
    matches exactly, and anything that doesn't resolve is dropped
    rather than silently querying with a value the schema can never
    match. */
function normalizeEmploymentType(value) {
  if (!value) return undefined;
  const known = ['Full-time', 'Part-time', 'Contract', 'Intern'];
  return known.find((t) => t.toLowerCase() === String(value).toLowerCase());
}

/** Maps an entities.status value from an invoice-related intent to
    what invoice.service.js's getInvoiceSummary/getAllInvoices expects:
    the synthetic 'unpaid' group becomes the shared UNPAID_INVOICE_STATUSES
    array (see ./ai/intents.js), a real status string passes through
    unchanged, and no status means no filter (i.e. every invoice). */
function resolveInvoiceStatusFilter(status) {
  if (!status) return undefined;
  if (status === 'unpaid') return UNPAID_INVOICE_STATUSES;
  return status;
}

async function resolveData(intent, entities, context, options = {}) {
  const full = !!options.full;
  switch (intent) {
    case INTENT.EMPLOYEE_LOOKUP: {
      const name = entities.name || '';
      const result = await employeeService.searchEmployees({ q: name, limit: 5 });
      if (!result.items.length) return { employee: null, searchedFor: name };
      return {
        employee: pickPublicEmployeeFields(result.items[0]),
        searchedFor: name,
        moreMatches: Math.max(0, result.total - 1),
      };
    }

    // Covers both "how many X" and "show/list X" phrasings — see
    // intents.js's comment on why these were merged. Fetches up to 10
    // (or, for a "name them"/"show all" follow-up, FULL_LIST_CAP) records
    // so formatCountWithList (RuleBasedProvider.js) can list names
    // automatically when the total is small, without a second round-trip.
    case INTENT.EMPLOYEE_COUNT: {
      const filters = {
        status: entities.status,
        employmentType: normalizeEmploymentType(entities.employmentType),
        department: entities.department,
      };
      const result = await employeeService.queryEmployees({ ...filters, limit: full ? FULL_LIST_CAP : 10 });
      return { count: result.total, items: result.items.map(pickListEmployeeFields), filters, full };
    }

    case INTENT.EMPLOYEE_JOINED_THIS_MONTH: {
      const result = await employeeService.getEmployeesJoinedInMonth(currentYearMonth());
      let latestJoined = null;
      if (!result.total) {
        const latest = await employeeService.getMostRecentlyJoinedEmployee();
        latestJoined = latest ? pickListEmployeeFields(latest) : null;
      }
      return {
        items: result.items.slice(0, FULL_LIST_CAP).map(pickListEmployeeFields),
        total: result.total,
        monthLabel: currentMonthLabel(),
        latestJoined,
        full,
      };
    }

    case INTENT.EMPLOYEE_RECENT: {
      const result = await employeeService.getRecentEmployees(5);
      return { items: result.items.map(pickListEmployeeFields) };
    }

    case INTENT.INVOICE_COUNT: {
      const status = resolveInvoiceStatusFilter(entities.status);
      const result = await invoiceService.getInvoiceSummary({ status });
      return {
        count: result.count,
        status: entities.status || null,
        items: result.items.slice(0, FULL_LIST_CAP).map(pickInvoiceFields),
        full,
      };
    }

    case INTENT.INVOICE_OUTSTANDING: {
      // Two reads, not one: getInvoiceSummary(unpaid) gives the unpaid
      // group's count/items/outstanding amount (also what a "show all"
      // follow-up re-fetches), while getInvoiceStatusBreakdown gives
      // the Paid/Overdue counts the "Invoice Summary" formatter also
      // shows (requirement 4) — a breakdown across ALL statuses, which
      // a single status-filtered query can't produce.
      const [unpaid, breakdown] = await Promise.all([
        invoiceService.getInvoiceSummary({ status: UNPAID_INVOICE_STATUSES }),
        invoiceService.getInvoiceStatusBreakdown(),
      ]);
      return {
        count: unpaid.count,
        amountsByCurrency: unpaid.amountsByCurrency,
        items: unpaid.items.slice(0, FULL_LIST_CAP).map(pickInvoiceFields),
        paidCount: breakdown.byStatus.Paid || 0,
        overdueCount: breakdown.byStatus.Overdue || 0,
        full,
      };
    }

    case INTENT.INVOICE_LARGEST: {
      const status = resolveInvoiceStatusFilter(entities.status);
      const result = await invoiceService.getInvoiceSummary({ status });
      return { invoice: pickInvoiceFields(result.largest), status: entities.status || null };
    }

    case INTENT.INVOICE_RECENT: {
      const result = await invoiceService.getAllInvoices({ sort: 'newest', limit: 5 });
      return { items: result.items.map(pickInvoiceFields), total: result.total };
    }

    case INTENT.INVOICE_THIS_MONTH: {
      const { dateFrom, dateTo } = currentMonthDateRange();
      const result = await invoiceService.getAllInvoices({ dateFrom, dateTo, limit: 1 });
      return { count: result.total, monthLabel: currentMonthLabel() };
    }

    case INTENT.PAYROLL_THIS_MONTH: {
      const { month, year } = currentSalaryMonthYear();
      const result = await salaryHistoryService.getSalaryHistorySummary({ month, year });
      return { count: result.count, monthLabel: currentMonthLabel() };
    }

    case INTENT.PAYROLL_EMAILS_SENT: {
      const { month, year } = currentSalaryMonthYear();
      const result = await salaryHistoryService.getSalaryHistorySummary({ month, year });
      return { count: result.emailsSent, monthLabel: currentMonthLabel() };
    }

    case INTENT.PAYROLL_EMAILS_PENDING: {
      const { month, year } = currentSalaryMonthYear();
      const result = await salaryHistoryService.getSalaryHistorySummary({ month, year });
      return { count: result.emailsPending, monthLabel: currentMonthLabel() };
    }

    case INTENT.PAYROLL_EMPLOYEE_COUNT: {
      return employeeService.getEmployeeStatusCounts();
    }

    case INTENT.PAYROLL_DEPARTMENT_COUNT: {
      const count = await employeeService.getDepartmentCount();
      return { count };
    }

    case INTENT.PAYROLL_TOTAL_AMOUNT: {
      const { month, year } = currentSalaryMonthYear();
      const result = await salaryHistoryService.getSalaryHistorySummary({ month, year });
      return {
        totalNetSalary: result.totalNetSalary,
        count: result.count,
        monthLabel: currentMonthLabel(),
        currency: context?.baseCurrency || 'INR',
      };
    }

    case INTENT.COMPANY_NAME:
      return { value: context?.companyName };
    case INTENT.COMPANY_CURRENCY:
      return { value: context?.defaultCurrency };
    case INTENT.COMPANY_INVOICE_PREFIX:
      return { value: context?.invoicePrefix };
    case INTENT.COMPANY_DEFAULT_TAX:
      return { value: context?.defaultTaxPercent };

    case INTENT.COMPANY_DRIVE_STATUS: {
      const status = await storageService.getStatus();
      return { connected: !!status.connected, email: status.email || null, rootFolderName: status.rootFolderName || null };
    }

    case INTENT.COMPANY_EMAIL_STATUS: {
      const configured = await verifyEmailTransporter();
      return { configured };
    }

    case INTENT.SYSTEM_HEALTH: {
      const { month, year } = currentSalaryMonthYear();
      const [driveStatus, emailConfigured, breakdown, missingPhone, payrollSummary] = await Promise.all([
        storageService.getStatus().catch(() => ({ connected: false })),
        verifyEmailTransporter().catch(() => false),
        invoiceService.getInvoiceStatusBreakdown(),
        employeeService.getMissingPhoneCount(),
        salaryHistoryService.getSalaryHistorySummary({ month, year }),
      ]);
      return {
        driveConnected: !!driveStatus.connected,
        emailConfigured: !!emailConfigured,
        overdueInvoices: breakdown.byStatus.Overdue || 0,
        missingPhone,
        payrollGeneratedCount: payrollSummary.count,
        monthLabel: currentMonthLabel(),
      };
    }

    // GREETING / HELP / UNKNOWN (and anything not explicitly listed
    // above) need no data — their formatters are static text. This is
    // also the read-only safety net: an intent this switch doesn't
    // recognize simply never reaches a service call.
    default:
      return null;
  }
}

/**
 * @param {string} question - the user's raw natural-language question
 * @param {object} [context] - optional frontend-supplied context (the
 *   current Company/Invoice Settings snapshot — see companySettingsStore.ts/
 *   invoiceSettingsStore.ts — since that data is browser localStorage,
 *   not MongoDB, and the backend has nothing else to read it from)
 * @param {{ intent: string, entities: object }} [previous] - the last
 *   assistant turn, echoed back by the frontend (Sprint 9 conversation
 *   context). This backend keeps no session of its own — see
 *   AiAssistantWidget.tsx's sessionStorage-only history — so a
 *   follow-up like "name them" only works because the client sends
 *   back exactly what it was told last time, not because anything
 *   here remembers it.
 * @returns {Promise<{ intent: string, entities: object, data: object|null, message: string }>}
 */
export async function ask(question, context = {}, previous) {
  const trimmed = String(question || '').trim();
  const provider = getAIProvider();

  if (!trimmed) {
    return { intent: INTENT.UNKNOWN, entities: {}, data: null, message: 'Please ask a question — try one of the suggestions above.' };
  }

  const { intent, entities } = await provider.detectIntent(trimmed, { previous });

  if (intent === INTENT.BLOCKED_ACTION) {
    return { intent, entities: {}, data: null, message: BLOCKED_MESSAGE };
  }

  if (intent === INTENT.FOLLOW_UP_LIST) {
    if (previous && LIST_CAPABLE_INTENTS.includes(previous.intent)) {
      const data = await resolveData(previous.intent, previous.entities || {}, context, { full: true });
      const message = await provider.formatResponse(previous.intent, data, trimmed);
      // Returned as the ORIGINAL intent (not follow_up_list) so a
      // second follow-up in a row ("name them" → "show all") still has
      // a valid, list-capable `previous` to chain from.
      return { intent: previous.intent, entities: previous.entities || {}, data, message };
    }
    const message = await provider.formatResponse(INTENT.FOLLOW_UP_LIST, null, trimmed);
    return { intent, entities: {}, data: null, message };
  }

  const data = await resolveData(intent, entities || {}, context, {});
  const message = await provider.formatResponse(intent, data, trimmed);
  return { intent, entities: entities || {}, data, message };
}
