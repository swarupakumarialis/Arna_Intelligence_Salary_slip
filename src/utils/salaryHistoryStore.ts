import { SalaryHistoryRecord } from '../types';

const STORAGE_KEY = 'arna_salary_history_v1';

export function loadSalaryHistory(): SalaryHistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SalaryHistoryRecord[];
  } catch {
    /* ignore */
  }
  return [];
}

export function saveSalaryHistory(records: SalaryHistoryRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* ignore */
  }
}

export function addSalaryHistoryRecord(record: SalaryHistoryRecord): SalaryHistoryRecord[] {
  const next = [record, ...loadSalaryHistory()];
  saveSalaryHistory(next);
  return next;
}

export function deleteSalaryHistoryRecord(id: string): SalaryHistoryRecord[] {
  const next = loadSalaryHistory().filter(r => r.id !== id);
  saveSalaryHistory(next);
  return next;
}
