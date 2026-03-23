from datetime import date
from typing import List, Optional
import os

from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import HTMLResponse, Response # Import Response
from fastapi.templating import Jinja2Templates

from .models import AppState, Doctor, Shift, ShiftType # Added Shift
from .scheduler import generate_schedule
from .data_manager import load_app_state, save_app_state, DATA_FILE 
from .pdf_generator import generate_schedule_pdf # Import PDF generator

app = FastAPI()

templates = Jinja2Templates(directory="backend/templates")

app_state: AppState = load_app_state()

if not app_state.doctors:
    app_state.doctors = [
        Doctor(doctor_id="doc1", nome="Dott. Rossi", indisponibilita=[date(2026, 1, 5)], max_shifts=10, preferred_feriali=5, preferred_sabato_giorno=1, preferred_sabato_notte=1, preferred_domenica_giorno=1, preferred_domenica_notte=1, preferred_colleagues=[]),
        Doctor(doctor_id="doc2", nome="Dott. Bianchi", indisponibilita=[date(2026, 1, 10)], max_shifts=10, preferred_feriali=5, preferred_sabato_giorno=1, preferred_sabato_notte=1, preferred_domenica_giorno=1, preferred_domenica_notte=1, preferred_colleagues=[]),
        Doctor(doctor_id="doc3", nome="Dott. Verdi", indisponibilita=[date(2026, 1, 15)], max_shifts=10, preferred_feriali=5, preferred_sabato_giorno=1, preferred_sabato_notte=1, preferred_domenica_giorno=1, preferred_domenica_notte=1, preferred_colleagues=[]),
        Doctor(doctor_id="doc4", nome="Dott. Neri", indisponibilita=[date(2026, 1, 20)], max_shifts=10, preferred_feriali=5, preferred_sabato_giorno=1, preferred_sabato_notte=1, preferred_domenica_giorno=1, preferred_domenica_notte=1, preferred_colleagues=[]),
        Doctor(doctor_id="doc5", nome="Dott. Gialli", indisponibilita=[], max_shifts=10, preferred_feriali=5, preferred_sabato_giorno=1, preferred_sabato_notte=1, preferred_domenica_giorno=1, preferred_domenica_notte=1, preferred_colleagues=[]),
        Doctor(doctor_id="doc6", nome="Dott. Blu", indisponibilita=[], max_shifts=10, preferred_feriali=5, preferred_sabato_giorno=1, preferred_sabato_notte=1, preferred_domenica_giorno=1, preferred_domenica_notte=1, preferred_colleagues=[]),
    ]
    save_app_state(app_state) 

@app.on_event("shutdown")
async def shutdown_event():
    save_app_state(app_state)
    print("Application state saved on shutdown.")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "message": "Benvenuto nel sistema di gestione turni Guardiamedica!"})

@app.post("/generate-schedule", response_model=AppState)
async def generate_new_schedule(year: int, month: int):
    global app_state 
    
    # Check if a schedule for this month/year already exists
    existing_shifts_for_month = [
        s for s in app_state.shifts 
        if s.shift_date.year == year and s.shift_date.month == month
    ]
    
    if existing_shifts_for_month:
        # Return existing schedule for the month
        # For simplicity, filter the AppState to only return shifts for the requested month
        # In a real app, you might return the full state and let frontend filter
        filtered_app_state = AppState(
            doctors=app_state.doctors,
            shifts=existing_shifts_for_month,
            holidays=[h for h in app_state.holidays if h.year == year and h.month == month]
        )
        return filtered_app_state
        # Or, if returning full state is acceptable, just: return app_state

    # If no existing schedule, generate a new one
    new_app_state = generate_schedule(app_state.doctors[:], year, month)
    
    # Replace existing shifts for this month with the newly generated ones
    app_state.shifts = [s for s in app_state.shifts if not (s.shift_date.year == year and s.shift_date.month == month)]
    app_state.shifts.extend(new_app_state.shifts)
    app_state.holidays = sorted(list(set(app_state.holidays + new_app_state.holidays))) # Merge holidays
    
    save_app_state(app_state) 
    
    # Return the newly generated and updated part of the state
    return AppState(
        doctors=app_state.doctors,
        shifts=new_app_state.shifts,
        holidays=new_app_state.holidays
    )

@app.get("/doctors", response_model=List[Doctor])
async def get_doctors():
    return app_state.doctors

@app.post("/doctors", response_model=Doctor)
async def add_doctor(doctor: Doctor):
    if any(d.doctor_id == doctor.doctor_id for d in app_state.doctors):
        raise HTTPException(status_code=400, detail="Doctor with this ID already exists.")
    app_state.doctors.append(doctor)
    save_app_state(app_state)
    return doctor

@app.put("/doctors/{doctor_id}", response_model=Doctor)
async def update_doctor(doctor_id: str, updated_doctor: Doctor):
    for i, doctor in enumerate(app_state.doctors):
        if doctor.doctor_id == doctor_id:
            app_state.doctors[i] = updated_doctor
            save_app_state(app_state)
            return updated_doctor
    raise HTTPException(status_code=404, detail="Doctor not found.")

@app.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str):
    initial_count = len(app_state.doctors)
    app_state.doctors = [d for d in app_state.doctors if d.doctor_id != doctor_id]
    if len(app_state.doctors) == initial_count:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    save_app_state(app_state)
    return {"message": "Doctor deleted successfully."}

# --- Schedule Management Endpoints ---
@app.get("/schedule", response_model=AppState)
async def get_schedule(year: int, month: int):
    # Filter shifts for the requested month/year
    shifts_for_month = [
        s for s in app_state.shifts 
        if s.shift_date.year == year and s.shift_date.month == month
    ]
    # Filter holidays for the requested month/year
    holidays_for_month = [
        h for h in app_state.holidays 
        if h.year == year and h.month == month
    ]
    
    # Return a partial AppState containing only relevant data for the month
    return AppState(
        doctors=app_state.doctors, # Doctors are always returned
        shifts=shifts_for_month,
        holidays=holidays_for_month
    )

@app.put("/schedule", response_model=AppState)
async def update_schedule(updated_shifts: List[Shift], year: int, month: int):
    global app_state

    # Remove existing shifts for this month
    app_state.shifts = [s for s in app_state.shifts if not (s.shift_date.year == year and s.shift_date.month == month)]
    # Add the updated shifts
    app_state.shifts.extend(updated_shifts)
    
    save_app_state(app_state)
    
    # Return the updated shifts for the specific month
    return AppState(
        doctors=app_state.doctors,
        shifts=updated_shifts,
        holidays=[h for h in app_state.holidays if h.year == year and h.month == month]
    )

@app.delete("/schedule")
async def clear_schedule(year: int, month: int):
    global app_state
    
    # Filter out shifts for the specified month/year
    app_state.shifts = [s for s in app_state.shifts if not (s.shift_date.year == year and s.shift_date.month == month)]
    app_state.holidays = [h for h in app_state.holidays if not (h.year == year and h.month == month)] # Remove associated holidays

    save_app_state(app_state)
    return {"message": f"Schedule for {month}/{year} cleared successfully."}


@app.get("/state", response_model=AppState)
async def get_app_state_full():
    return app_state

@app.get("/export-pdf/{year}/{month}", response_class=Response)
async def export_schedule_to_pdf(year: int, month: int):
    global app_state
    
    # Filter shifts for the requested month/year
    shifts_for_month_dicts = [
        s.model_dump() for s in app_state.shifts 
        if s.shift_date.year == year and s.shift_date.month == month
    ]
    
    # Doctors data for the PDF generator
    doctors_dicts = [d.model_dump() for d in app_state.doctors]

    pdf_bytes = generate_schedule_pdf(doctors_dicts, shifts_for_month_dicts, year, month, holidays=app_state.holidays)
    
    month_name = date(year, month, 1).strftime('%B').capitalize()
    filename = f"Turni_Guardia_{month_name}_{year}.pdf"

    return Response(
        content=pdf_bytes, 
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
