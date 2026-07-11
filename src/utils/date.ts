/**
 * Real, live "Month Year" label (e.g. "March 2026") — always derived
 * from `new Date()` at call time, never stored or hardcoded. Used only
 * by presentational chrome (top nav period pill, dashboard welcome
 * banner); it intentionally has no connection to SalaryData.salary,
 * which remains the user-editable pay period that actually drives
 * payslip generation and calculations.
 */
export function getCurrentPeriodLabel(): string {
  return new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/** Current month name (e.g. "July") — matches the month names used by
    the Salary Generator's Month <select>, so it can seed a fresh
    payslip's default period without any hardcoded month string. */
export function getCurrentMonthName(): string {
  return new Date().toLocaleDateString('en-IN', { month: 'long' });
}

/** Current calendar year as a string (e.g. "2026"). */
export function getCurrentYear(): string {
  return String(new Date().getFullYear());
}
