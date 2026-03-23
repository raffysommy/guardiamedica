from datetime import date, timedelta
from typing import List, Dict, Set, Optional
from collections import defaultdict
import random

from .models import Doctor, Shift, ShiftType, AppState # Removed DoctorAffinity

def get_italian_holidays_and_prefestivi(year: int) -> (List[date], List[date]):
    """
    Returns a list of Italian holidays and prefestivi for the given year.
    """
    holidays = [
        date(year, 1, 1), date(year, 1, 6), date(year, 4, 25), date(year, 5, 1),
        date(year, 6, 2), date(year, 8, 15), date(year, 11, 1), date(year, 12, 8),
        date(year, 12, 25), date(year, 12, 26)
    ]
    # Easter calculation
    a = year % 19; b = year % 4; c = year % 7; k = year // 100; p = (13 + 8 * k) // 25
    q = k // 4; M = (15 - p + k - q) % 30; N = (4 + k - q) % 7
    d = (19 * a + M) % 30; e = (2 * b + 4 * c + 6 * d + N) % 7
    easter_day = 22 + d + e
    easter_month = 3
    if easter_day > 31:
        easter_day -= 31
        easter_month = 4
    
    easter = date(year, easter_month, easter_day)
    holidays.append(easter)
    holidays.append(easter + timedelta(days=1)) # Pasquetta
    holidays = sorted(list(set(holidays)))

    prefestivi = []
    for holiday in holidays:
        prefestivo = holiday - timedelta(days=1)
        # A prefestivo cannot be a holiday itself or a Sunday (weekday() == 6)
        if prefestivo not in holidays and prefestivo.weekday() != 6:
            prefestivi.append(prefestivo)
            
    return holidays, sorted(list(set(prefestivi)))

def generate_shifts_for_month(year: int, month: int, holidays: List[date], prefestivi: List[date]) -> List[Shift]:
    """
    Generates all shifts for a month based on the corrected rules:
    - Feriale: Only one SERALE shift.
    - Sabato/Domenica/Festivi/Prefestivi: GIORNO and NOTTE shifts.
    All shifts require 2 doctors.
    """
    shifts: List[Shift] = []
    current_date = date(year, month, 1)
    
    while current_date.month == month:
        day_of_week = current_date.weekday() # Monday is 0, Sunday is 6
        is_holiday = current_date in holidays
        is_prefestivo = current_date in prefestivi

        # Weekend, Holiday, or day before a holiday
        if is_holiday or is_prefestivo or day_of_week in [5, 6]:
            if day_of_week == 5 or is_prefestivo: # Sabato or Prefestivo
                shifts.append(Shift(shift_id=f"{current_date.isoformat()}_giorno", shift_date=current_date, shift_type=ShiftType.SABATO_GIORNO, max_doctors=2))
                shifts.append(Shift(shift_id=f"{current_date.isoformat()}_notte", shift_date=current_date, shift_type=ShiftType.SABATO_NOTTE, max_doctors=2))
            else: # Domenica or Festivo
                shifts.append(Shift(shift_id=f"{current_date.isoformat()}_giorno", shift_date=current_date, shift_type=ShiftType.DOMENICA_GIORNO, max_doctors=2))
                shifts.append(Shift(shift_id=f"{current_date.isoformat()}_notte", shift_date=current_date, shift_type=ShiftType.DOMENICA_NOTTE, max_doctors=2))
        else: # Feriale
            shifts.append(Shift(shift_id=f"{current_date.isoformat()}_feriale_serale", shift_date=current_date, shift_type=ShiftType.FERIALE_SERALE, max_doctors=2))

        current_date += timedelta(days=1)
    return shifts

def is_evening_shift(shift_type: ShiftType) -> bool:
    """Checks if a shift is in the evening/night."""
    return shift_type.name.endswith('_NOTTE') or shift_type == ShiftType.FERIALE_SERALE

def is_contiguous(shift1: Shift, shift2: Shift) -> bool:
    """
    Determines if two shifts are contiguous.
    - Same day: day shift and evening shift are contiguous.
    - Consecutive days: evening shift and next day's day shift are contiguous.
    """
    # Ensure shift1 is before shift2 for easier comparison
    if shift1.shift_date > shift2.shift_date:
        shift1, shift2 = shift2, shift1
        
    shift1_is_evening = is_evening_shift(shift1.shift_type)
    shift2_is_evening = is_evening_shift(shift2.shift_type)

    # Case 1: Same day. Contiguous if one is evening and the other is not.
    if shift1.shift_date == shift2.shift_date:
        return shift1_is_evening != shift2_is_evening

    # Case 2: Consecutive days. Contiguous if the first is evening and the second is day.
    if (shift1.shift_date + timedelta(days=1)) == shift2.shift_date:
        return shift1_is_evening and not shift2_is_evening
        
    return False

def count_consecutive_nights(doctor_id: str, candidate_shift: Shift, assignments: Dict[str, List[Shift]]) -> int:
    """
    Count how many consecutive night shifts this assignment would create.
    Returns the length of the consecutive-night run including the candidate.
    """
    if not is_evening_shift(candidate_shift.shift_type):
        return 0

    night_dates: Set[date] = set()
    for s in assignments[doctor_id]:
        if is_evening_shift(s.shift_type):
            night_dates.add(s.shift_date)

    candidate_date = candidate_shift.shift_date
    night_dates.add(candidate_date)

    # Walk backwards and forwards to measure the full consecutive run
    count = 1
    d = candidate_date - timedelta(days=1)
    while d in night_dates:
        count += 1
        d -= timedelta(days=1)
    d = candidate_date + timedelta(days=1)
    while d in night_dates:
        count += 1
        d += timedelta(days=1)

    return count

def assign_shifts(doctors: List[Doctor], shifts: List[Shift]) -> List[Shift]:
    doctor_assignments: Dict[str, List[Shift]] = defaultdict(list)
    doctors_by_id: Dict[str, Doctor] = {d.doctor_id: d for d in doctors}

    # --- Cost Function ---
    def get_assignment_cost(doctor: Doctor, shift: Shift, assignments: Dict[str, List[Shift]]) -> float:
        # --- Hard Constraints (Infinite Cost) ---
        if len(assignments[doctor.doctor_id]) >= doctor.max_shifts:
            return float('inf')
        if shift.shift_date in doctor.indisponibilita:
            return float('inf')
        if any(is_contiguous(s, shift) for s in assignments[doctor.doctor_id]):
            return float('inf')

        # Hard block: never allow 3+ consecutive nights
        consec = count_consecutive_nights(doctor.doctor_id, shift, assignments)
        if consec >= 3:
            return float('inf')

        cost = 100.0  # Base cost for any assignment

        # --- Soft Constraints (Cost Modifiers) ---

        # 1. Consecutive nights penalty: 2 consecutive nights is heavily penalised
        if consec == 2:
            cost += 60

        # 2. Shift Type Distribution
        doc_shifts = assignments[doctor.doctor_id]
        num_feriale = sum(1 for s in doc_shifts if s.shift_type == ShiftType.FERIALE_SERALE)
        num_sabato_g = sum(1 for s in doc_shifts if s.shift_type == ShiftType.SABATO_GIORNO)
        num_sabato_n = sum(1 for s in doc_shifts if s.shift_type == ShiftType.SABATO_NOTTE)
        num_domenica_g = sum(1 for s in doc_shifts if s.shift_type == ShiftType.DOMENICA_GIORNO)
        num_domenica_n = sum(1 for s in doc_shifts if s.shift_type == ShiftType.DOMENICA_NOTTE)

        # Add cost for exceeding preferred counts, bonus for meeting them
        if shift.shift_type == ShiftType.FERIALE_SERALE:
            if num_feriale < doctor.preferred_feriali: cost -= 20 # Bonus
            else: cost += (num_feriale - doctor.preferred_feriali + 1) * 10 # Penalty
        elif shift.shift_type == ShiftType.SABATO_GIORNO:
            if num_sabato_g < doctor.preferred_sabato_giorno: cost -= 30
            else: cost += (num_sabato_g - doctor.preferred_sabato_giorno + 1) * 20
        elif shift.shift_type == ShiftType.SABATO_NOTTE:
            if num_sabato_n < doctor.preferred_sabato_notte: cost -= 30
            else: cost += (num_sabato_n - doctor.preferred_sabato_notte + 1) * 20
        elif shift.shift_type == ShiftType.DOMENICA_GIORNO:
            if num_domenica_g < doctor.preferred_domenica_giorno: cost -= 30
            else: cost += (num_domenica_g - doctor.preferred_domenica_giorno + 1) * 20
        elif shift.shift_type == ShiftType.DOMENICA_NOTTE:
            if num_domenica_n < doctor.preferred_domenica_notte: cost -= 30
            else: cost += (num_domenica_n - doctor.preferred_domenica_notte + 1) * 20

        # 3. Affinity bonus (bidirectional, strong weight)
        if len(shift.assigned_doctor_ids) > 0:
            first_doctor_id = shift.assigned_doctor_ids[0]
            first_doctor_obj = doctors_by_id.get(first_doctor_id)

            # First doctor prefers this candidate
            if first_doctor_obj and doctor.doctor_id in first_doctor_obj.preferred_colleagues:
                rank = first_doctor_obj.preferred_colleagues.index(doctor.doctor_id)
                max_rank = len(first_doctor_obj.preferred_colleagues)
                cost -= 50 * (max_rank - rank) / max_rank

            # This candidate prefers the first doctor (bidirectional)
            if first_doctor_id in doctor.preferred_colleagues:
                rank = doctor.preferred_colleagues.index(first_doctor_id)
                max_rank = len(doctor.preferred_colleagues)
                cost -= 50 * (max_rank - rank) / max_rank

        # 4. Add a small random factor to break ties
        cost += random.uniform(0, 0.9)
        return cost

    # --- Main Assignment Loop ---
    # Loop until all shifts are filled or no more assignments are possible
    while True:
        unfilled_slots = []
        for s in shifts:
            for _ in range(s.max_doctors - len(s.assigned_doctor_ids)):
                unfilled_slots.append(s)
        
        if not unfilled_slots:
            break # All shifts are full

        best_assignment = None
        min_cost = float('inf')

        # Find the single best (lowest cost) assignment across all possibilities
        for shift_to_fill in unfilled_slots:
            eligible_doctors = [d for d in doctors if d.doctor_id not in shift_to_fill.assigned_doctor_ids]
            for doctor in eligible_doctors:
                cost = get_assignment_cost(doctor, shift_to_fill, doctor_assignments)
                if cost < min_cost:
                    min_cost = cost
                    best_assignment = (doctor, shift_to_fill)

        # If no valid assignment was found in the entire pass, break
        if min_cost == float('inf') or best_assignment is None:
            break
            
        # Make the best assignment found
        best_doctor, best_shift = best_assignment
        best_shift.assigned_doctor_ids.append(best_doctor.doctor_id)
        doctor_assignments[best_doctor.doctor_id].append(best_shift)

    # Final check for warnings
    for shift in shifts:
        if len(shift.assigned_doctor_ids) < shift.max_doctors:
            print(f"Warning: Could not find any eligible doctor for a remaining slot in shift {shift.shift_id}. The slot remains unfilled.")
            
    return shifts

def generate_schedule(doctors: List[Doctor], year: int, month: int) -> AppState: # Removed affinities
    holidays, prefestivi = get_italian_holidays_and_prefestivi(year)
    all_shifts = generate_shifts_for_month(year, month, holidays, prefestivi)
    
    assigned_shifts = assign_shifts(doctors, all_shifts) # Removed affinities
    
    return AppState(
        doctors=doctors,
        shifts=assigned_shifts,
        holidays=holidays
        # Removed affinities
    )
