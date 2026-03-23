import pytest
import json
from datetime import date
from pathlib import Path

from backend.models import AppState
from backend.data_manager import load_app_state, save_app_state, DateEncoder, date_hook

@pytest.fixture
def temp_data_file(tmp_path: Path) -> Path:
    """Fixture to create a temporary data file path."""
    return tmp_path / "test_data.json"

def test_load_app_state_file_not_found(monkeypatch, temp_data_file: Path):
    """
    Test that loading from a non-existent file returns a default AppState.
    """
    monkeypatch.setattr("backend.data_manager.DATA_FILE", temp_data_file)
    state = load_app_state()
    assert state == AppState()

def test_save_and_load_app_state(monkeypatch, temp_data_file: Path):
    """
    Test saving an AppState and loading it back to ensure data integrity.
    """
    monkeypatch.setattr("backend.data_manager.DATA_FILE", temp_data_file)
    
    # Create a complex state to save
    state_to_save = AppState(
        doctors=[{"doctor_id": "d1", "nome": "Test Doc", "max_shifts": 1}],
        shifts=[{"shift_id": "s1", "shift_date": date(2024, 5, 1), "shift_type": "sabato_giorno", "max_doctors": 1}],
        holidays=[date(2024, 5, 1)]
    )
    
    # Save and load
    save_app_state(state_to_save)
    loaded_state = load_app_state()
    
    # Assertions
    assert loaded_state is not None
    assert len(loaded_state.doctors) == 1
    assert loaded_state.doctors[0].nome == "Test Doc"
    assert len(loaded_state.shifts) == 1
    assert loaded_state.shifts[0].shift_date == date(2024, 5, 1)
    assert date(2024, 5, 1) in loaded_state.holidays

def test_load_data_invalid_json(monkeypatch, temp_data_file: Path):
    """
    Test that loading a file with invalid JSON returns a default AppState.
    """
    monkeypatch.setattr("backend.data_manager.DATA_FILE", temp_data_file)
    temp_data_file.write_text("{'invalid': 'json'}")
    
    state = load_app_state()
    assert state == AppState()

def test_date_encoder_and_hook():
    """
    Test the custom date encoder and decoder hook.
    """
    data = {"my_date": date(2024, 1, 1), "other": "value"}
    
    # Encode
    encoded_data = json.dumps(data, cls=DateEncoder)
    assert '"my_date": "2024-01-01"' in encoded_data
    
    # Decode
    decoded_data = json.loads(encoded_data, object_hook=date_hook)
    assert isinstance(decoded_data["my_date"], date)
    assert decoded_data["my_date"] == date(2024, 1, 1)