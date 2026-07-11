import { ActivityLogEntry, ActivityType } from '../types';

const STORAGE_KEY = 'arna_activity_log_v1';
/** Keep the log from growing unbounded in localStorage. */
const MAX_ENTRIES = 200;

export function loadActivityLog(): ActivityLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ActivityLogEntry[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveActivityLog(entries: ActivityLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

export function logActivity(type: ActivityType, employeeName: string, detail?: string): ActivityLogEntry[] {
  const entry: ActivityLogEntry = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    employeeName,
    detail,
    timestamp: new Date().toISOString(),
  };
  const next = [entry, ...loadActivityLog()].slice(0, MAX_ENTRIES);
  saveActivityLog(next);
  return next;
}

export function deleteActivityEntry(id: string): ActivityLogEntry[] {
  const next = loadActivityLog().filter(e => e.id !== id);
  saveActivityLog(next);
  return next;
}
