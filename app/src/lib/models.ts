// Data models — ported from Python backend

export const ShiftType = {
  FERIALE_SERALE: 'feriale_serale',
  SABATO_GIORNO: 'sabato_giorno',
  SABATO_NOTTE: 'sabato_notte',
  DOMENICA_GIORNO: 'domenica_giorno',
  DOMENICA_NOTTE: 'domenica_notte',
} as const;

export type ShiftType = (typeof ShiftType)[keyof typeof ShiftType];

export interface Doctor {
  doctor_id: string;
  nome: string;
  indisponibilita: string[]; // ISO date strings
  max_shifts: number;
  preferred_feriali: number;
  preferred_sabato_giorno: number;
  preferred_sabato_notte: number;
  preferred_domenica_giorno: number;
  preferred_domenica_notte: number;
  preferred_colleagues: string[];
}

export interface Shift {
  shift_id: string;
  shift_date: string; // ISO date string YYYY-MM-DD
  shift_type: ShiftType;
  assigned_doctor_ids: string[];
  max_doctors: number;
}

export interface AppData {
  doctors: Doctor[];
  schedules: Record<string, Shift[]>; // keyed by "YYYY-MM"
  holidays: string[]; // ISO date strings
}

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}
