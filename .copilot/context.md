# Guardia Medica Scheduler — Project Context

## What This Is
A **static frontend-only SPA** (React + TypeScript + Vite) for scheduling medical guard duty shifts (guardia medica) in Italy. Deployable to GitHub Pages. All data is stored in the browser's `localStorage`.

## Architecture

```
app/                         ← The active frontend-only app (deploy this)
├── src/
│   ├── lib/
│   │   ├── models.ts        ← Data types: Doctor, Shift, ShiftType, AppData
│   │   ├── scheduler.ts     ← Scheduling algorithm (greedy cost-based)
│   │   ├── storage.ts       ← localStorage persistence helpers
│   │   └── pdfExport.ts     ← PDF generation with jsPDF + autotable
│   ├── store.ts             ← Zustand store (state management, no API calls)
│   ├── components/
│   │   ├── Controls.tsx     ← Year/month picker, generate/save/undo/redo/export
│   │   ├── ScheduleView.tsx ← Calendar table with drag-and-drop (@dnd-kit)
│   │   ├── DoctorManagement.tsx ← Doctor CRUD + affinity drag-drop
│   │   └── UnavailabilityManagement.tsx ← Date picker for doctor unavailability
│   ├── App.tsx              ← HashRouter SPA, 3 routes (/, /medici, /indisponibilita)
│   └── main.tsx             ← Entry point
├── index.html
├── vite.config.ts           ← base: './' for GitHub Pages
└── package.json             ← Build: tsc + vite build + 404.html copy

backend/                     ← Original Python backend (LEGACY, kept for reference)
frontend/                    ← Original React frontend (LEGACY, kept for reference)
```

## Key Business Rules (Scheduling Algorithm)

### Hard Constraints (infinite cost — never violated)
1. Doctor cannot exceed `max_shifts` per month
2. Doctor is not assigned on unavailable dates (`indisponibilita`)
3. No contiguous shifts (same day giorno+notte, or night→next day giorno)
4. **Max 2 consecutive nights** (3+ is blocked)

### Soft Constraints (cost penalties)
1. **2 consecutive nights**: +60 penalty (strongly discouraged)
2. **Weekly spread**: >3 shifts in any 7-day window adds +25 per excess shift
3. **Shift type distribution**: Penalizes deviation from preferred counts per type
4. **Bidirectional affinity bonus**: Up to -100 cost when two doctors mutually prefer each other (50 pts per direction, rank-weighted)
5. **Random tie-breaker**: +0–0.9 to prevent deterministic bias

### Shift Types
- **Feriale Serale** (weekday evening) — 1 shift per weekday, 2 doctors
- **Sabato/Prefestivo Giorno + Notte** — 2 shifts, 2 doctors each
- **Domenica/Festivo Giorno + Notte** — 2 shifts, 2 doctors each

### Italian Holidays
Computed automatically: Jan 1, Jan 6, Easter + Pasquetta, Apr 25, May 1, Jun 2, Aug 15, Nov 1, Dec 8, Dec 25, Dec 26. Prefestivi = day before each holiday (unless Sunday or holiday itself).

## Data Model

### Doctor
```typescript
{
  doctor_id: string;         // UUID
  nome: string;              // Display name
  indisponibilita: string[]; // ISO dates (YYYY-MM-DD)
  max_shifts: number;        // Default 10
  preferred_feriali: number; // Target weekday shifts (default 5)
  preferred_sabato_giorno/notte: number; // Default 1 each
  preferred_domenica_giorno/notte: number; // Default 1 each
  preferred_colleagues: string[]; // Ordered list of doctor_ids (most preferred first)
}
```

### Shift
```typescript
{
  shift_id: string;             // "YYYY-MM-DD_type"
  shift_date: string;           // ISO date
  shift_type: ShiftType;        // feriale_serale, sabato_giorno, etc.
  assigned_doctor_ids: string[]; // 0–2 doctor IDs
  max_doctors: number;          // Always 2
}
```

### Persistence
- localStorage key: `guardiamedica_data`
- Structure: `{ doctors: Doctor[], schedules: Record<"YYYY-MM", Shift[]>, holidays: string[] }`

## UI Design Decisions
- **Target users**: Non-tech-savvy Italian doctors
- **Language**: All Italian labels
- **Style**: Warm, clean — white cards with shadows, rounded corners, emoji icons
- **Navigation**: 3 pages — Calendario, Medici, Indisponibilità
- **Router**: HashRouter (required for GitHub Pages static hosting)
- **Colors**: Yellow rows = holidays/Sundays, green rows = prefestivi/Saturdays

## Deployment
- GitHub Actions workflow at `.github/workflows/deploy.yml`
- Auto-builds on push to `main`
- Deploys `app/dist/` to GitHub Pages
- `404.html` = copy of `index.html` (SPA fallback)

## Development
```bash
cd app
npm install
npm run dev    # Dev server at localhost:5173
npm run build  # Production build → dist/
```

## History / Decisions Made
- **2026-03-23**: Migrated from Python backend + React frontend to frontend-only SPA
- Original backend used FastAPI + JSON file persistence
- Scheduler was ported from Python to TypeScript with improvements:
  - Added hard block on 3+ consecutive nights
  - Added weekly spread penalty (>3 shifts in 7 days)
  - Increased affinity bonus from ~1-3 pts to up to 100 pts (bidirectional)
  - Added `countShiftsInWeek()` helper for spread constraint
- UI restyled from dark/techie Bootstrap to warm, doctor-friendly design
- PDF export switched from Python fpdf2 to jsPDF + jspdf-autotable
