// localStorage persistence helpers

import type { AppData } from './models';

const STORAGE_KEY = 'guardiamedica_data';

const defaultData: AppData = {
  doctors: [],
  schedules: {},
  holidays: [],
};

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultData };
    return JSON.parse(raw) as AppData;
  } catch {
    return { ...defaultData };
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function scheduleKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
