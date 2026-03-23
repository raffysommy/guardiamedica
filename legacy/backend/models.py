from datetime import date, datetime
from typing import List, Optional
from enum import Enum

from pydantic import BaseModel, Field

# Enumeration for different shift types
class ShiftType(str, Enum):
    FERIALE_SERALE = "feriale_serale"
    SABATO_GIORNO = "sabato_giorno"
    SABATO_NOTTE = "sabato_notte"
    DOMENICA_GIORNO = "domenica_giorno"
    DOMENICA_NOTTE = "domenica_notte"
    FESTIVO_GIORNO = "festivo_giorno"
    FESTIVO_NOTTE = "festivo_notte"

# Model for a Doctor
class Doctor(BaseModel):
    doctor_id: str = Field(..., description="Unique identifier for the doctor")
    nome: str = Field(..., description="Name of the doctor")
    # List of dates when the doctor is unavailable
    indisponibilita: List[date] = Field(default_factory=list, description="List of dates the doctor is unavailable")
    max_shifts: int = Field(default=10, description="Maximum number of shifts a doctor can perform")
    # Preferred shift distribution: 5 feriali, 1 sabato giorno, 1 sabato notte, 1 domenica giorno, 1 domenica notte
    # This is a preference, not a strict rule, and can be adjusted by the algorithm.
    preferred_feriali: int = Field(default=5)
    preferred_sabato_giorno: int = Field(default=1)
    preferred_sabato_notte: int = Field(default=1)
    preferred_domenica_giorno: int = Field(default=1)
    preferred_domenica_notte: int = Field(default=1)
    # New: Ordered list of preferred colleagues (most preferred first)
    preferred_colleagues: List[str] = Field(default_factory=list, description="Ordered list of preferred colleagues (doctor_id)")

# Model for a specific shift instance on a given date
class Shift(BaseModel):
    shift_id: str = Field(..., description="Unique identifier for the shift instance (e.g., 'YYYY-MM-DD_TYPE')")
    shift_date: date = Field(..., description="Date of the shift")
    shift_type: ShiftType = Field(..., description="Type of shift (e.g., feriale_serale, sabato_giorno)")
    assigned_doctor_ids: List[str] = Field(default_factory=list, description="List of doctor IDs assigned to this shift")
    max_doctors: int = Field(default=2, description="Maximum number of doctors for this shift")

# Main data model to store all application state
class AppState(BaseModel):
    doctors: List[Doctor] = Field(default_factory=list, description="List of all registered doctors")
    shifts: List[Shift] = Field(default_factory=list, description="List of all generated shifts")
    holidays: List[date] = Field(default_factory=list, description="List of Italian holidays for the year")