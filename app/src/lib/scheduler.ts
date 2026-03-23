// Scheduler — ported from Python backend with improved constraints

import { ShiftType, type Doctor, type Shift } from './models';

/* ---------- Italian Holidays & Prefestivi ---------- */

function computeEaster(year: number): Date {
  const a = year % 19;
  const b = year % 4;
  const c = year % 7;
  const k = Math.floor(year / 100);
  const p = Math.floor((13 + 8 * k) / 25);
  const q = Math.floor(k / 4);
  const M = (15 - p + k - q) % 30;
  const N = (4 + k - q) % 7;
  const d = (19 * a + M) % 30;
  const e = (2 * b + 4 * c + 6 * d + N) % 7;
  let easterDay = 22 + d + e;
  let easterMonth = 2; // 0-indexed March
  if (easterDay > 31) {
    easterDay -= 31;
    easterMonth = 3; // April
  }
  return new Date(year, easterMonth, easterDay);
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function getItalianHolidaysAndPrefestivi(year: number): {
  holidays: string[];
  prefestivi: string[];
} {
  const holidayDates: Date[] = [
    new Date(year, 0, 1),
    new Date(year, 0, 6),
    new Date(year, 3, 25),
    new Date(year, 4, 1),
    new Date(year, 5, 2),
    new Date(year, 7, 15),
    new Date(year, 10, 1),
    new Date(year, 11, 8),
    new Date(year, 11, 25),
    new Date(year, 11, 26),
  ];

  const easter = computeEaster(year);
  holidayDates.push(easter);
  holidayDates.push(addDays(easter, 1)); // Pasquetta

  const holidaySet = new Set(holidayDates.map(toISO));
  const holidays = Array.from(holidaySet).sort();

  const prefestivi: string[] = [];
  for (const h of holidayDates) {
    const pf = addDays(h, -1);
    const pfISO = toISO(pf);
    if (!holidaySet.has(pfISO) && pf.getDay() !== 0) {
      // Not a holiday itself and not a Sunday
      prefestivi.push(pfISO);
    }
  }
  return { holidays, prefestivi: [...new Set(prefestivi)].sort() };
}

/* ---------- Shift Generation ---------- */

export function generateShiftsForMonth(
  year: number,
  month: number, // 1-based
  holidays: string[],
  prefestivi: string[]
): Shift[] {
  const shifts: Shift[] = [];
  const holidaySet = new Set(holidays);
  const prefestivoSet = new Set(prefestivi);

  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const iso = toISO(d);
    const dow = d.getDay(); // 0=Sun, 6=Sat
    const isHoliday = holidaySet.has(iso);
    const isPrefestivo = prefestivoSet.has(iso);

    if (isHoliday || isPrefestivo || dow === 0 || dow === 6) {
      if (dow === 6 || isPrefestivo) {
        shifts.push({
          shift_id: `${iso}_giorno`,
          shift_date: iso,
          shift_type: ShiftType.SABATO_GIORNO,
          assigned_doctor_ids: [],
          max_doctors: 2,
        });
        shifts.push({
          shift_id: `${iso}_notte`,
          shift_date: iso,
          shift_type: ShiftType.SABATO_NOTTE,
          assigned_doctor_ids: [],
          max_doctors: 2,
        });
      } else {
        shifts.push({
          shift_id: `${iso}_giorno`,
          shift_date: iso,
          shift_type: ShiftType.DOMENICA_GIORNO,
          assigned_doctor_ids: [],
          max_doctors: 2,
        });
        shifts.push({
          shift_id: `${iso}_notte`,
          shift_date: iso,
          shift_type: ShiftType.DOMENICA_NOTTE,
          assigned_doctor_ids: [],
          max_doctors: 2,
        });
      }
    } else {
      shifts.push({
        shift_id: `${iso}_feriale_serale`,
        shift_date: iso,
        shift_type: ShiftType.FERIALE_SERALE,
        assigned_doctor_ids: [],
        max_doctors: 2,
      });
    }
  }
  return shifts;
}

/* ---------- Helpers ---------- */

export function isEveningShift(st: ShiftType): boolean {
  return st.endsWith('_notte') || st === ShiftType.FERIALE_SERALE;
}

export function isContiguous(s1: Shift, s2: Shift): boolean {
  let a = s1,
    b = s2;
  if (a.shift_date > b.shift_date) {
    [a, b] = [b, a];
  }

  const aEvening = isEveningShift(a.shift_type);
  const bEvening = isEveningShift(b.shift_type);

  // Same day: contiguous if one is day and one is evening
  if (a.shift_date === b.shift_date) {
    return aEvening !== bEvening;
  }

  // Consecutive days: evening → next day's day shift
  const aDate = new Date(a.shift_date);
  const bDate = new Date(b.shift_date);
  const diffMs = bDate.getTime() - aDate.getTime();
  if (Math.round(diffMs / 86400000) === 1) {
    return aEvening && !bEvening;
  }

  return false;
}

function countConsecutiveNights(
  doctorId: string,
  candidateShift: Shift,
  assignments: Map<string, Shift[]>
): number {
  if (!isEveningShift(candidateShift.shift_type)) return 0;

  const nightDates = new Set<string>();
  for (const s of assignments.get(doctorId) ?? []) {
    if (isEveningShift(s.shift_type)) nightDates.add(s.shift_date);
  }
  nightDates.add(candidateShift.shift_date);

  const cand = new Date(candidateShift.shift_date);
  let count = 1;
  let d = addDays(cand, -1);
  while (nightDates.has(toISO(d))) {
    count++;
    d = addDays(d, -1);
  }
  d = addDays(cand, 1);
  while (nightDates.has(toISO(d))) {
    count++;
    d = addDays(d, 1);
  }
  return count;
}

function countShiftsInWeek(
  doctorId: string,
  candidateShift: Shift,
  assignments: Map<string, Shift[]>
): number {
  const candDate = new Date(candidateShift.shift_date);
  const windowStart = addDays(candDate, -3);
  const windowEnd = addDays(candDate, 3);
  const startISO = toISO(windowStart);
  const endISO = toISO(windowEnd);

  let count = 1; // counting the candidate itself
  for (const s of assignments.get(doctorId) ?? []) {
    if (s.shift_date >= startISO && s.shift_date <= endISO) {
      count++;
    }
  }
  return count;
}

/* ---------- Assignment Algorithm ---------- */

export function assignShifts(doctors: Doctor[], shifts: Shift[]): Shift[] {
  const assignments = new Map<string, Shift[]>();
  for (const d of doctors) assignments.set(d.doctor_id, []);

  const doctorsById = new Map(doctors.map((d) => [d.doctor_id, d]));

  function getCost(doctor: Doctor, shift: Shift): number {
    const docShifts = assignments.get(doctor.doctor_id) ?? [];

    // --- Hard constraints ---
    if (docShifts.length >= doctor.max_shifts) return Infinity;
    if (doctor.indisponibilita.includes(shift.shift_date)) return Infinity;
    if (docShifts.some((s) => isContiguous(s, shift))) return Infinity;

    const consec = countConsecutiveNights(doctor.doctor_id, shift, assignments);
    if (consec >= 3) return Infinity;

    let cost = 100;

    // --- Soft: 2 consecutive nights penalty ---
    if (consec === 2) cost += 60;

    // --- Soft: weekly spread — penalise clustering ---
    const weekCount = countShiftsInWeek(doctor.doctor_id, shift, assignments);
    if (weekCount > 3) cost += (weekCount - 3) * 25;

    // --- Soft: shift type distribution ---
    const counts = {
      feriale: 0,
      sabato_g: 0,
      sabato_n: 0,
      domenica_g: 0,
      domenica_n: 0,
    };
    for (const s of docShifts) {
      if (s.shift_type === ShiftType.FERIALE_SERALE) counts.feriale++;
      else if (s.shift_type === ShiftType.SABATO_GIORNO) counts.sabato_g++;
      else if (s.shift_type === ShiftType.SABATO_NOTTE) counts.sabato_n++;
      else if (s.shift_type === ShiftType.DOMENICA_GIORNO) counts.domenica_g++;
      else if (s.shift_type === ShiftType.DOMENICA_NOTTE) counts.domenica_n++;
    }

    if (shift.shift_type === ShiftType.FERIALE_SERALE) {
      cost += counts.feriale < doctor.preferred_feriali ? -20 : (counts.feriale - doctor.preferred_feriali + 1) * 10;
    } else if (shift.shift_type === ShiftType.SABATO_GIORNO) {
      cost += counts.sabato_g < doctor.preferred_sabato_giorno ? -30 : (counts.sabato_g - doctor.preferred_sabato_giorno + 1) * 20;
    } else if (shift.shift_type === ShiftType.SABATO_NOTTE) {
      cost += counts.sabato_n < doctor.preferred_sabato_notte ? -30 : (counts.sabato_n - doctor.preferred_sabato_notte + 1) * 20;
    } else if (shift.shift_type === ShiftType.DOMENICA_GIORNO) {
      cost += counts.domenica_g < doctor.preferred_domenica_giorno ? -30 : (counts.domenica_g - doctor.preferred_domenica_giorno + 1) * 20;
    } else if (shift.shift_type === ShiftType.DOMENICA_NOTTE) {
      cost += counts.domenica_n < doctor.preferred_domenica_notte ? -30 : (counts.domenica_n - doctor.preferred_domenica_notte + 1) * 20;
    }

    // --- Soft: bidirectional affinity bonus (strong weight) ---
    if (shift.assigned_doctor_ids.length > 0) {
      const firstId = shift.assigned_doctor_ids[0];
      const firstDoc = doctorsById.get(firstId);

      if (firstDoc && firstDoc.preferred_colleagues.includes(doctor.doctor_id)) {
        const rank = firstDoc.preferred_colleagues.indexOf(doctor.doctor_id);
        const max = firstDoc.preferred_colleagues.length;
        cost -= 50 * ((max - rank) / max);
      }
      if (doctor.preferred_colleagues.includes(firstId)) {
        const rank = doctor.preferred_colleagues.indexOf(firstId);
        const max = doctor.preferred_colleagues.length;
        cost -= 50 * ((max - rank) / max);
      }
    }

    // Tie-breaker
    cost += Math.random() * 0.9;
    return cost;
  }

  // Greedy loop
  while (true) {
    const unfilled: Shift[] = [];
    for (const s of shifts) {
      for (let i = s.assigned_doctor_ids.length; i < s.max_doctors; i++) {
        unfilled.push(s);
      }
    }
    if (unfilled.length === 0) break;

    let bestCost = Infinity;
    let bestPair: [Doctor, Shift] | null = null;

    for (const shift of unfilled) {
      for (const doc of doctors) {
        if (shift.assigned_doctor_ids.includes(doc.doctor_id)) continue;
        const c = getCost(doc, shift);
        if (c < bestCost) {
          bestCost = c;
          bestPair = [doc, shift];
        }
      }
    }

    if (!bestPair || bestCost === Infinity) break;

    const [bestDoc, bestShift] = bestPair;
    bestShift.assigned_doctor_ids.push(bestDoc.doctor_id);
    assignments.get(bestDoc.doctor_id)!.push(bestShift);
  }

  return shifts;
}

/* ---------- Top-level schedule generation ---------- */

export function generateSchedule(
  doctors: Doctor[],
  year: number,
  month: number
): { shifts: Shift[]; holidays: string[] } {
  const { holidays, prefestivi } = getItalianHolidaysAndPrefestivi(year);
  const shifts = generateShiftsForMonth(year, month, holidays, prefestivi);
  assignShifts(doctors, shifts);
  return { shifts, holidays };
}
