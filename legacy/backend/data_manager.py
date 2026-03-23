import json
from datetime import date
from pathlib import Path
from typing import Any

from .models import AppState, Doctor, Shift, ShiftType

DATA_FILE = Path("data.json")

class DateEncoder(json.JSONEncoder):
    """Custom JSON encoder for handling date objects."""
    def default(self, obj: Any) -> Any:
        if isinstance(obj, date):
            return obj.isoformat()
        return super().default(obj)

def date_hook(json_dict: dict) -> dict:
    """Custom JSON object hook for deserializing date strings back to date objects."""
    for k, v in json_dict.items():
        if isinstance(v, str):
            try:
                # Attempt to parse as date. We only use date objects in models.
                json_dict[k] = date.fromisoformat(v)
            except ValueError:
                pass # Not a date string
    return json_dict

def load_app_state() -> AppState:
    """Loads the application state from the DATA_FILE."""
    if not DATA_FILE.exists():
        print(f"Data file not found at {DATA_FILE}, initializing empty state.")
        return AppState()
    
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f, object_hook=date_hook)
            # Pydantic's model_validate handles conversion of nested data structures
            return AppState.model_validate(data)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from {DATA_FILE}: {e}")
        return AppState()
    except Exception as e:
        print(f"An unexpected error occurred while loading state: {e}")
        return AppState()

def save_app_state(state: AppState) -> None:
    """Saves the application state to the DATA_FILE."""
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            # Use model_dump to get a dictionary representation suitable for JSON
            # The custom DateEncoder handles date objects within the dictionary
            json.dump(state.model_dump(), f, indent=4, cls=DateEncoder, ensure_ascii=False)
        print(f"Application state saved to {DATA_FILE}")
    except Exception as e:
        print(f"An error occurred while saving state: {e}")

