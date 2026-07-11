import { Employee } from '../types';

/* Deliberately company-agnostic — this module knows nothing about ARNA
   or any other tenant. It only ever deals in Employee[]. */
const STORAGE_KEY = 'employee_directory_v1';

export function loadEmployees(): Employee[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Employee[];
  } catch {
    /* ignore */
  }
  return [];
}

export function saveEmployees(employees: Employee[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
  } catch {
    /* ignore */
  }
}

/**
 * Bootstraps the employee directory from a seed list on first launch
 * only. If any employees already exist — seeded or user-entered — this
 * is a no-op, so it can safely run on every app start without ever
 * overwriting real data.
 *
 * Generic by design: it takes the seed as a plain argument, so a
 * different company's roster can be passed in without touching this
 * function. See src/data/arnaTeamSeed.ts for the current seed source
 * and how a future company would supply its own.
 */
export function seedEmployeesIfEmpty(seed: Employee[]): Employee[] {
  const existing = loadEmployees();
  if (existing.length > 0) return existing;
  saveEmployees(seed);
  return seed;
}

/**
 * One-time, idempotent field enrichment for employees that already
 * exist in the directory (e.g. from a previous seed run that predates
 * newer data). Unlike seedEmployeesIfEmpty, this does not care whether
 * the directory is empty — it patches matching records in place, once,
 * gated by `flagKey` in localStorage so it never re-runs and never
 * clobbers subsequent manual edits made by HR.
 *
 * Generic by design: patches are keyed by employeeId and merged
 * shallowly onto the matching record. Records with no matching patch,
 * and any employeeId not present in `patches`, are left untouched.
 */
export function applyEmployeeEnrichment(
  current: Employee[],
  patches: Record<string, Partial<Employee>>,
  flagKey: string
): Employee[] {
  let alreadyApplied = false;
  try {
    alreadyApplied = localStorage.getItem(flagKey) === '1';
  } catch {
    /* ignore */
  }
  if (alreadyApplied) return current;

  const enriched = current.map((emp) => {
    const patch = patches[emp.employeeId];
    return patch ? { ...emp, ...patch } : emp;
  });

  saveEmployees(enriched);
  try {
    localStorage.setItem(flagKey, '1');
  } catch {
    /* ignore */
  }
  return enriched;
}
