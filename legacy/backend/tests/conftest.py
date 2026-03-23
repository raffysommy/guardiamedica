
import pytest
from fastapi.testclient import TestClient
import json
from datetime import date
import os
import sys

# Add the project root to the path to allow absolute imports from 'backend'
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.main import app
from backend.models import AppState, Doctor, Shift
from backend.data_manager import save_app_state

@pytest.fixture
def sample_doctors_data() -> list[dict]:
    return [
        {"doctor_id": "1", "nome": "Dr. Alpha", "max_shifts": 5, "indisponibilita": [], "preferred_feriali": 1, "preferred_sabato_giorno": 1, "preferred_sabato_notte": 1, "preferred_domenica_giorno": 1, "preferred_domenica_notte": 1, "preferred_colleagues": ["2"]},
        {"doctor_id": "2", "nome": "Dr. Beta", "max_shifts": 5, "indisponibilita": [], "preferred_feriali": 1, "preferred_sabato_giorno": 1, "preferred_sabato_notte": 1, "preferred_domenica_giorno": 1, "preferred_domenica_notte": 1, "preferred_colleagues": ["1"]},
        {"doctor_id": "3", "nome": "Dr. Gamma", "max_shifts": 5, "indisponibilita": [date(2024, 1, 15)], "preferred_feriali": 1, "preferred_sabato_giorno": 1, "preferred_sabato_notte": 1, "preferred_domenica_giorno": 1, "preferred_domenica_notte": 1, "preferred_colleagues": []}
    ]

@pytest.fixture
def sample_app_state(sample_doctors_data) -> AppState:
    """Provides a clean AppState instance for each test."""
    return AppState(
        doctors=[Doctor.model_validate(d) for d in sample_doctors_data],
        shifts=[],
        holidays=[]
    )

@pytest.fixture
def client(monkeypatch, sample_app_state) -> TestClient:
    """
    Test client fixture that patches the global app_state and the save function
    for the duration of a test.
    """
    # Patch the global app_state in the main module
    monkeypatch.setattr("backend.main.app_state", sample_app_state)
    
    # Patch the save function to prevent writing to the actual data.json
    monkeypatch.setattr("backend.main.save_app_state", lambda state: None)
    monkeypatch.setattr("backend.data_manager.save_app_state", lambda state: None) # Also patch in data_manager if needed

    with TestClient(app) as test_client:
        yield test_client

# Fixture for scheduler tests
@pytest.fixture
def sample_doctors(sample_doctors_data) -> list[Doctor]:
    """Fixture for a list of Doctor objects for testing the scheduler."""
    return [Doctor.model_validate(d) for d in sample_doctors_data]

