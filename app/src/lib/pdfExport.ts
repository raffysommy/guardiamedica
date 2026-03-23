// PDF export — using jsPDF + jspdf-autotable

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Shift, Doctor } from './models';

const ITALIAN_DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const ITALIAN_MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

export function exportSchedulePdf(
  doctors: Doctor[],
  shifts: Shift[],
  year: number,
  month: number,
  holidays: string[]
): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const doctorMap = new Map(doctors.map((d) => [d.doctor_id, d.nome]));
  const holidaySet = new Set(holidays);
  const monthName = ITALIAN_MONTHS[month - 1];

  doc.setFontSize(16);
  doc.text(`Turni Guardia ${monthName} ${year}`, 105, 15, { align: 'center' });

  // Group shifts by date
  const byDate = new Map<string, { giorno: string[]; notte: string[]; feriale: string[] }>();
  for (const s of shifts) {
    if (!byDate.has(s.shift_date)) {
      byDate.set(s.shift_date, { giorno: [], notte: [], feriale: [] });
    }
    const entry = byDate.get(s.shift_date)!;
    const names = s.assigned_doctor_ids.map((id) => doctorMap.get(id) ?? id);
    const st = s.shift_type;
    if (st.endsWith('_giorno')) entry.giorno.push(...names);
    else if (st.endsWith('_notte')) entry.notte.push(...names);
    else entry.feriale.push(...names);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const rows: (string | { content: string; styles: Record<string, unknown> })[][] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = d.getDay();
    const dayName = ITALIAN_DAYS[dow];
    const entry = byDate.get(iso);

    const isHoliday = holidaySet.has(iso) || dow === 0;
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextISO = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    const isPreHoliday = holidaySet.has(nextISO) || dow === 6;

    let fillColor: [number, number, number] | undefined;
    if (isHoliday) fillColor = [255, 255, 224];
    else if (isPreHoliday) fillColor = [224, 255, 224];

    const cellStyle = fillColor ? { fillColor } : {};

    rows.push([
      { content: `${dayName} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`, styles: cellStyle },
      { content: entry?.giorno.join(', ') ?? '', styles: cellStyle },
      { content: entry?.notte.join(', ') ?? '', styles: cellStyle },
      { content: entry?.feriale.join(', ') ?? '', styles: cellStyle },
    ]);
  }

  autoTable(doc, {
    startY: 22,
    head: [['Giorno', 'Giorno Festivo', 'Notte Festivo', 'Serale Feriale']],
    body: rows as any,
    theme: 'grid',
    headStyles: { fillColor: [100, 149, 237], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 50 },
      2: { cellWidth: 50 },
      3: { cellWidth: 50 },
    },
  });

  doc.save(`Turni_Guardia_${monthName}_${year}.pdf`);
}
