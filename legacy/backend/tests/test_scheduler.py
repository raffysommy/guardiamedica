import pytest
from datetime import date
from backend.models import Doctor, Shift, ShiftType
from backend.scheduler import (
    generate_schedule,
    is_contiguous,
)
from collections import Counter

# --- Test Helper Functions ---

def test_is_contiguous():
    """Test the contiguity logic between shifts."""
    # Same day, non-contiguous
    shift1 = Shift(shift_id="1", shift_date=date(2024, 1, 1), shift_type=ShiftType.FERIALE_SERALE)
    shift2 = Shift(shift_id="2", shift_date=date(2024, 1, 1), shift_type=ShiftType.FERIALE_SERALE)
    assert not is_contiguous(shift1, shift2)

    # Same day, contiguous
    shift_giorno = Shift(shift_id="g", shift_date=date(2024, 1, 1), shift_type=ShiftType.SABATO_GIORNO)
    shift_notte = Shift(shift_id="n", shift_date=date(2024, 1, 1), shift_type=ShiftType.SABATO_NOTTE)
    assert is_contiguous(shift_giorno, shift_notte)

    # Consecutive days, contiguous
    shift_notte_prev = Shift(shift_id="n_prev", shift_date=date(2024, 1, 1), shift_type=ShiftType.SABATO_NOTTE)
    shift_giorno_next = Shift(shift_id="g_next", shift_date=date(2024, 1, 2), shift_type=ShiftType.DOMENICA_GIORNO)
    assert is_contiguous(shift_notte_prev, shift_giorno_next)
    
    # Consecutive days, non-contiguous
    shift_giorno_prev = Shift(shift_id="g_prev", shift_date=date(2024, 1, 1), shift_type=ShiftType.SABATO_GIORNO)
    shift_giorno_next = Shift(shift_id="g_next", shift_date=date(2024, 1, 2), shift_type=ShiftType.DOMENICA_GIORNO)
    assert not is_contiguous(shift_giorno_prev, shift_giorno_next)

# --- Test Main generate_schedule Function ---

def test_generate_schedule_basic(sample_doctors):
    """Test basic schedule generation for a full month."""
    year, month = 2024, 1 # January 2024 has 31 days
    app_state = generate_schedule(sample_doctors, year, month)

    assert len(app_state.shifts) > 0
    # Check that all shifts have the required number of doctors if possible
    unassigned_shifts = [s for s in app_state.shifts if len(s.assigned_doctor_ids) < s.max_doctors]
    # This might have some unassigned shifts if constraints are tight, so we check it's not all of them
    assert len(unassigned_shifts) < len(app_state.shifts)

    # Check shift counts for each doctor
    all_assignments = [doc_id for s in app_state.shifts for doc_id in s.assigned_doctor_ids]
    counts = Counter(all_assignments)
    
    for doc in app_state.doctors:
        assert counts[doc.doctor_id] <= doc.max_shifts

def test_generate_schedule_no_doctors():
    """Test schedule generation with no doctors provided."""
    app_state = generate_schedule([], 2024, 1)
    assert len(app_state.shifts) > 0
    # All shifts should be unassigned
    assert all(not s.assigned_doctor_ids for s in app_state.shifts)

def test_doctor_unavailability(sample_doctors):
    """Test that an unavailable doctor is not assigned to shifts on their day off."""
    year, month = 2024, 1
    # Dr. Gamma (id '3') is unavailable on 2024-01-15 in the fixture
    unavailable_date = date(2024, 1, 15)
    doctor_gamma_id = "3"
    
    app_state = generate_schedule(sample_doctors, year, month)
    
    for shift in app_state.shifts:
        if shift.shift_date == unavailable_date:
            assert doctor_gamma_id not in shift.assigned_doctor_ids

def test_max_shifts_constraint(sample_doctors):
    """Test that no doctor is assigned more than their max_shifts."""
    # Lower max_shifts to make it easier to hit the limit
    for doc in sample_doctors:
        doc.max_shifts = 2
        
    year, month = 2024, 2 # A month with enough shifts
    app_state = generate_schedule(sample_doctors, year, month)

    all_assignments = [doc_id for s in app_state.shifts for doc_id in s.assigned_doctor_ids]
    counts = Counter(all_assignments)

    for doc_id, num_shifts in counts.items():
        doctor = next(d for d in app_state.doctors if d.doctor_id == doc_id)
        assert num_shifts <= doctor.max_shifts

def test_contiguity_constraint(sample_doctors):
    """Test that no doctor is assigned to contiguous shifts."""
    year, month = 2024, 1
    app_state = generate_schedule(sample_doctors, year, month)

    # Create a map of doctor_id -> list of assigned shift objects
    doc_assignments: Dict[str, List[Shift]] = {doc.doctor_id: [] for doc in sample_doctors}
    for shift in app_state.shifts:
        for doc_id in shift.assigned_doctor_ids:
            doc_assignments[doc_id].append(shift)

    # Check for contiguity violations for each doctor
    for doc_id, assigned_shifts in doc_assignments.items():
        assigned_shifts.sort(key=lambda s: (s.shift_date, s.shift_type.value))
        for i in range(len(assigned_shifts) - 1):
            assert not is_contiguous(assigned_shifts[i], assigned_shifts[i+1])

def test_preferred_colleagues_logic(sample_doctors):
    """
    Test that the scoring boosts assignments for preferred colleagues.
    This is a soft check, as the assignment is heuristic. We check if they are
    ever paired together.
    """
    year, month = 2024, 3
    # Dr. Alpha ("1") and Dr. Beta ("2") prefer each other.
    dr_a_id = "1"
    dr_b_id = "2"
    
    # Make them have more capacity to increase pairing chance
    sample_doctors[0].max_shifts = 15
    sample_doctors[1].max_shifts = 15

    app_state = generate_schedule(sample_doctors, year, month)

    paired_together = False
    for shift in app_state.shifts:
        if dr_a_id in shift.assigned_doctor_ids and dr_b_id in shift.assigned_doctor_ids:
            paired_together = True
            break
            
    assert paired_together, "Preferred colleagues Dr. Alpha and Dr. Beta were never paired."

def test_shift_distribution_fairness():
    """
    Check if shifts are distributed somewhat evenly, not perfectly.
    This test is to prevent a very skewed distribution.
    """
    # Use a clean set of doctors for this test
    doctors = [
        Doctor(doctor_id="1", nome="Dr. A", max_shifts=10, indisponibilita=[], preferred_feriali=5, preferred_sabato_giorno=1, preferred_sabato_notte=1, preferred_domenica_giorno=1, preferred_domenica_notte=1, preferred_colleagues=[]),
        Doctor(doctor_id="2", nome="Dr. B", max_shifts=10, indisponibilita=[], preferred_feriali=5, preferred_sabato_giorno=1, preferred_sabato_notte=1, preferred_domenica_giorno=1, preferred_domenica_notte=1, preferred_colleagues=[]),
        Doctor(doctor_id="3", nome="Dr. C", max_shifts=10, indisponibilita=[], preferred_feriali=5, preferred_sabato_giorno=1, preferred_sabato_notte=1, preferred_domenica_giorno=1, preferred_domenica_notte=1, preferred_colleagues=[]),
    ]
    year, month = 2024, 4
    app_state = generate_schedule(doctors, year, month)

    all_assignments = [doc_id for s in app_state.shifts for doc_id in s.assigned_doctor_ids]
    counts = Counter(all_assignments)

    if not counts:
        pytest.fail("No shifts were assigned.")
        
    min_shifts = min(counts.values())
    max_shifts = max(counts.values())

    # The difference between the most and least worked doctor should not be excessively large.
    assert (max_shifts - min_shifts) <= 5, "Shift distribution seems highly uneven."

