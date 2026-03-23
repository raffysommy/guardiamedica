import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Doctor, Shift, History } from './lib/models';
import { loadAppData, saveAppData, scheduleKey } from './lib/storage';
import { generateSchedule, isContiguous as checkContiguous, isEveningShift } from './lib/scheduler';
import { exportSchedulePdf } from './lib/pdfExport';
import { v4 as uuidv4 } from 'uuid';

export type { Doctor, Shift };

/* ---------- Validation helpers ---------- */

function validateShiftAssignment(
  doctorId: string,
  dest: Shift,
  allShifts: Shift[],
  doctors: Doctor[],
  currentAssigned: string[],
  isAddingFromPool: boolean
): string | null {
  const doctor = doctors.find((d) => d.doctor_id === doctorId);
  if (!doctor) return 'Medico non trovato.';

  if (isAddingFromPool) {
    const total = allShifts.filter((s) => s.assigned_doctor_ids.includes(doctorId)).length;
    if (total >= doctor.max_shifts) {
      return `${doctor.nome} ha già raggiunto il numero massimo di turni (${doctor.max_shifts}).`;
    }
  }

  if (doctor.indisponibilita.includes(dest.shift_date)) {
    return `${doctor.nome} non è disponibile in questa data.`;
  }

  if (currentAssigned.includes(doctorId)) {
    return `${doctor.nome} è già assegnato a questo turno.`;
  }

  const otherShifts = allShifts.filter(
    (s) => s.assigned_doctor_ids.includes(doctorId) && s.shift_id !== dest.shift_id
  );
  for (const os of otherShifts) {
    if (checkContiguous(os, dest)) {
      return `${doctor.nome} non può fare due turni contigui.`;
    }
  }

  // Check consecutive nights
  if (isEveningShift(dest.shift_type)) {
    const nightDates = new Set<string>();
    for (const s of otherShifts) {
      if (isEveningShift(s.shift_type)) nightDates.add(s.shift_date);
    }
    nightDates.add(dest.shift_date);

    const cand = new Date(dest.shift_date);
    let count = 1;
    let d = new Date(cand);
    d.setDate(d.getDate() - 1);
    while (nightDates.has(d.toISOString().slice(0, 10))) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    d = new Date(cand);
    d.setDate(d.getDate() + 1);
    while (nightDates.has(d.toISOString().slice(0, 10))) {
      count++;
      d.setDate(d.getDate() + 1);
    }
    if (count >= 3) {
      return `${doctor.nome} non può fare 3 o più notti consecutive.`;
    }
  }

  return null;
}

/* ---------- Store ---------- */

interface AppState {
  doctors: Doctor[];
  shifts: History<Shift[]>;
  holidays: string[];
  year: number;
  month: number;
  loading: boolean;
  error: string | null;
  isScheduleDirty: boolean;
  actions: {
    setYear: (year: number) => void;
    setMonth: (month: number) => void;
    loadSchedule: (year: number, month: number) => void;
    generateScheduleAction: () => void;
    saveSchedule: () => void;
    clearSchedule: () => void;
    addDoctor: (doctor: Omit<Doctor, 'indisponibilita' | 'preferred_colleagues'>) => void;
    updateDoctor: (id: string, doctor: Doctor) => void;
    deleteDoctor: (id: string) => void;
    updateShiftAssignment: (doctorId: string, sourceShiftId: string | null, destShiftId: string) => void;
    unassignDoctorFromShift: (doctorId: string, shiftId: string) => void;
    undo: () => void;
    redo: () => void;
    exportPdf: () => void;
  };
}

const emptyHistory: History<Shift[]> = { past: [], present: [], future: [] };

// Load initial state from localStorage
const initialData = loadAppData();
const now = new Date();
const initYear = now.getFullYear();
const initMonth = now.getMonth() + 1;
const initKey = scheduleKey(initYear, initMonth);

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      doctors: initialData.doctors,
      shifts: {
        past: [],
        present: initialData.schedules[initKey] ?? [],
        future: [],
      },
      holidays: initialData.holidays,
      year: initYear,
      month: initMonth,
      loading: false,
      error: null,
      isScheduleDirty: false,

      actions: {
        setYear: (year) => {
          set({ year });
          get().actions.loadSchedule(year, get().month);
        },
        setMonth: (month) => {
          set({ month });
          get().actions.loadSchedule(get().year, month);
        },

        loadSchedule: (year, month) => {
          const data = loadAppData();
          const key = scheduleKey(year, month);
          set({
            doctors: data.doctors,
            shifts: { past: [], present: data.schedules[key] ?? [], future: [] },
            holidays: data.holidays,
            isScheduleDirty: false,
            error: null,
          });
        },

        generateScheduleAction: () => {
          const { doctors, year, month } = get();
          set({ loading: true, error: null });
          try {
            const result = generateSchedule(doctors, year, month);
            const data = loadAppData();
            const key = scheduleKey(year, month);
            data.schedules[key] = result.shifts;
            // Merge holidays
            const allH = new Set([...data.holidays, ...result.holidays]);
            data.holidays = [...allH].sort();
            saveAppData(data);

            set({
              shifts: { past: [], present: result.shifts, future: [] },
              holidays: data.holidays,
              loading: false,
              isScheduleDirty: false,
            });
          } catch (e: any) {
            set({ error: e.message, loading: false });
          }
        },

        saveSchedule: () => {
          const { shifts, year, month, holidays } = get();
          const data = loadAppData();
          const key = scheduleKey(year, month);
          data.schedules[key] = shifts.present;
          data.holidays = holidays;
          data.doctors = get().doctors;
          saveAppData(data);
          set({ isScheduleDirty: false });
        },

        clearSchedule: () => {
          const { year, month } = get();
          const data = loadAppData();
          const key = scheduleKey(year, month);
          delete data.schedules[key];
          saveAppData(data);
          set({
            shifts: { ...emptyHistory },
            isScheduleDirty: false,
          });
        },

        addDoctor: (doctorData) => {
          const newDoc: Doctor = {
            ...doctorData,
            doctor_id: doctorData.doctor_id || uuidv4(),
            indisponibilita: [],
            preferred_colleagues: [],
          };
          set((state) => {
            const doctors = [...state.doctors, newDoc];
            const data = loadAppData();
            data.doctors = doctors;
            saveAppData(data);
            return { doctors };
          });
        },

        updateDoctor: (id, doctorData) => {
          set((state) => {
            const doctors = state.doctors.map((d) =>
              d.doctor_id === id ? { ...doctorData } : d
            );
            const data = loadAppData();
            data.doctors = doctors;
            saveAppData(data);
            return { doctors };
          });
        },

        deleteDoctor: (id) => {
          set((state) => {
            const doctors = state.doctors.filter((d) => d.doctor_id !== id);
            const data = loadAppData();
            data.doctors = doctors;
            saveAppData(data);
            return { doctors };
          });
        },

        updateShiftAssignment: (doctorId, sourceShiftId, destShiftId) => {
          set((state) => {
            const { past, present } = state.shifts;
            const isAdding = sourceShiftId === null;

            const destShift = present.find((s) => s.shift_id === destShiftId);
            if (!destShift) return { error: 'Turno di destinazione non trovato.' };

            const err = validateShiftAssignment(
              doctorId,
              destShift,
              present,
              state.doctors,
              destShift.assigned_doctor_ids,
              isAdding
            );
            if (err) return { error: err };

            let newPresent = [...present];
            let swappedOut: string | null = null;

            // Remove from source
            if (sourceShiftId) {
              newPresent = newPresent.map((s) =>
                s.shift_id === sourceShiftId
                  ? { ...s, assigned_doctor_ids: s.assigned_doctor_ids.filter((x) => x !== doctorId) }
                  : s
              );
            }

            // Add to destination
            let newDest = [...destShift.assigned_doctor_ids];
            if (newDest.length < destShift.max_doctors) {
              newDest.push(doctorId);
            } else {
              swappedOut = newDest[0];
              newDest[0] = doctorId;
            }

            newPresent = newPresent.map((s) =>
              s.shift_id === destShiftId ? { ...s, assigned_doctor_ids: newDest } : s
            );

            // Put swapped-out doctor back in source
            if (swappedOut && sourceShiftId) {
              newPresent = newPresent.map((s) =>
                s.shift_id === sourceShiftId
                  ? { ...s, assigned_doctor_ids: [...s.assigned_doctor_ids, swappedOut!] }
                  : s
              );
            }

            return {
              shifts: { past: [...past, present], present: newPresent, future: [] },
              isScheduleDirty: true,
              error: null,
            };
          });
        },

        unassignDoctorFromShift: (doctorId, shiftId) => {
          set((state) => {
            const { past, present } = state.shifts;
            const newPresent = present.map((s) =>
              s.shift_id === shiftId
                ? { ...s, assigned_doctor_ids: s.assigned_doctor_ids.filter((x) => x !== doctorId) }
                : s
            );
            return {
              shifts: { past: [...past, present], present: newPresent, future: [] },
              isScheduleDirty: true,
            };
          });
        },

        undo: () => {
          set((state) => {
            const { past, present, future } = state.shifts;
            if (past.length === 0) return {};
            return {
              shifts: {
                past: past.slice(0, -1),
                present: past[past.length - 1],
                future: [present, ...future],
              },
              isScheduleDirty: true,
            };
          });
        },

        redo: () => {
          set((state) => {
            const { past, present, future } = state.shifts;
            if (future.length === 0) return {};
            return {
              shifts: {
                past: [...past, present],
                present: future[0],
                future: future.slice(1),
              },
              isScheduleDirty: true,
            };
          });
        },

        exportPdf: () => {
          const { doctors, shifts, year, month, holidays } = get();
          exportSchedulePdf(doctors, shifts.present, year, month, holidays);
        },
      },
    }),
    { name: 'GuardiaMedicaStore' }
  )
);
