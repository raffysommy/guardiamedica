import pytest
from fastapi.testclient import TestClient
from datetime import date

# Note: No direct imports from the app are needed here, 
# as the 'client' fixture handles the app and its state.

# --- Test Doctor Endpoints ---

def test_get_all_doctors(client: TestClient):
    response = client.get("/doctors")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert data[0]["nome"] == "Dr. Alpha"

def test_add_doctor(client: TestClient):
    new_doctor_payload = {
        "doctor_id": "doc4",
        "nome": "Dr. Epsilon",
        "max_shifts": 12,
        "indisponibilita": [],
        "preferred_feriali": 1,
        "preferred_sabato_giorno": 1,
        "preferred_sabato_notte": 1,
        "preferred_domenica_giorno": 1,
        "preferred_domenica_notte": 1,
        "preferred_colleagues": []
    }
    response = client.post("/doctors", json=new_doctor_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["nome"] == "Dr. Epsilon"
    assert data["doctor_id"] == "doc4"

    # Verify the doctor was actually added
    response = client.get("/doctors")
    assert len(response.json()) == 4

def test_add_doctor_with_existing_id(client: TestClient):
    existing_doctor_payload = {
        "doctor_id": "1", # This ID already exists in the sample data
        "nome": "Dr. Duplicate",
        "max_shifts": 10,
        "indisponibilita": [],
        "preferred_feriali": 1, "preferred_sabato_giorno": 1, "preferred_sabato_notte": 1,
        "preferred_domenica_giorno": 1, "preferred_domenica_notte": 1, "preferred_colleagues": []
    }
    response = client.post("/doctors", json=existing_doctor_payload)
    assert response.status_code == 400

def test_update_doctor(client: TestClient):
    update_payload = {
        "doctor_id": "3", # Must match the path
        "nome": "Dr. Gamma Updated",
        "max_shifts": 9,
        "indisponibilita": ["2024-01-20"],
        "preferred_feriali": 1, "preferred_sabato_giorno": 1, "preferred_sabato_notte": 1,
        "preferred_domenica_giorno": 1, "preferred_domenica_notte": 1,
        "preferred_colleagues": ["1", "2"]
    }
    response = client.put("/doctors/3", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["nome"] == "Dr. Gamma Updated"
    assert data["indisponibilita"] == ["2024-01-20"]

def test_update_non_existent_doctor(client: TestClient):
    response = client.put("/doctors/999", json={"doctor_id": "999", "nome": "Ghost", "max_shifts": 1})
    assert response.status_code == 404

def test_delete_doctor(client: TestClient):
    response = client.delete("/doctors/1")
    assert response.status_code == 200
    assert response.json()["message"] == "Doctor deleted successfully."

    # Verify it's gone by trying to get all doctors
    response = client.get("/doctors")
    assert response.status_code == 200
    all_doctors = response.json()
    assert len(all_doctors) == 2
    assert "1" not in [d["doctor_id"] for d in all_doctors]

def test_delete_non_existent_doctor(client: TestClient):
    response = client.delete("/doctors/999")
    assert response.status_code == 404

# --- Test Schedule Endpoints ---

def test_get_schedule_empty(client: TestClient):
    # The initial state has no shifts, so this should return an empty list of shifts
    response = client.get("/schedule?year=2024&month=1")
    assert response.status_code == 200
    data = response.json()
    assert data["shifts"] == []
    assert data["holidays"] == []

def test_update_and_get_schedule(client: TestClient):
    year, month = 2024, 3
    shifts_payload = [
        {"shift_id": "s1", "shift_date": f"{year}-0{month}-01", "shift_type": "sabato_giorno", "assigned_doctor_ids": ["1"], "max_doctors": 1}
    ]
    response = client.put(f"/schedule?year={year}&month={month}", json=shifts_payload)
    assert response.status_code == 200

    # Retrieve it
    response = client.get(f"/schedule?year={year}&month={month}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["shifts"]) == 1
    assert data["shifts"][0]["assigned_doctor_ids"] == ["1"]

def test_clear_schedule(client: TestClient):
    year, month = 2024, 4
    # First, add a schedule to delete
    shifts_payload = [{"shift_id": "s2", "shift_date": f"{year}-0{month}-10", "shift_type": "notte", "assigned_doctor_ids": [], "max_doctors": 1}]
    client.put(f"/schedule?year={year}&month={month}", json=shifts_payload)

    # Now, delete it
    response = client.delete(f"/schedule?year={year}&month={month}")
    assert response.status_code == 200
    assert response.json()["message"] == f"Schedule for {month}/{year} cleared successfully."

    # Verify it's gone
    response = client.get(f"/schedule?year={year}&month={month}")
    assert response.status_code == 200
    assert response.json()["shifts"] == []

# --- Test Generation & State Endpoints ---

def test_generate_schedule_endpoint(client: TestClient):
    year, month = 2024, 5
    response = client.post(f"/generate-schedule?year={year}&month={month}")
    assert response.status_code == 200
    data = response.json()
    assert "shifts" in data
    assert "doctors" in data
    assert len(data["shifts"]) > 0  # Check that some shifts were generated
    
    # Check that the generated schedule is now stored in the main state
    response = client.get(f"/schedule?year={year}&month={month}")
    assert response.status_code == 200
    assert len(response.json()["shifts"]) > 0

def test_get_full_app_state(client: TestClient):
    response = client.get("/state")
    assert response.status_code == 200
    data = response.json()
    assert len(data["doctors"]) == 3
    assert data["shifts"] == []

# --- Test PDF Export Endpoint ---

def test_export_pdf_endpoint(client: TestClient):
    year, month = 2024, 7
    # Generate a schedule first so there is something to export
    client.post(f"/generate-schedule?year={year}&month={month}")
    
    response = client.get(f"/export-pdf/{year}/{month}")
    
    assert response.status_code == 200
    assert response.headers['content-type'] == 'application/pdf'
    assert response.headers['content-disposition'].startswith('attachment; filename=')
    assert len(response.content) > 100 # Basic check for some content

def test_export_pdf_for_empty_schedule(client: TestClient):
    # Should generate an empty PDF without errors
    response = client.get("/export-pdf/2025/12")
    assert response.status_code == 200
    assert response.headers['content-type'] == 'application/pdf'