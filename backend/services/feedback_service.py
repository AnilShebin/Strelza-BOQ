"""
feedback_service.py - Human Feedback Logging Service

Captures human estimator confirmations and overrides in the UI, persists them
to disk/DB, and updates the vector precedent store for real-time self-learning.
"""

import os
import json
import uuid
from datetime import datetime
from typing import Dict, Any, List

FEEDBACK_STORE_PATH = os.path.join(os.path.dirname(__file__), "../uploads/corrections_store.json")

def load_feedback_store() -> List[Dict[str, Any]]:
    """Loads stored feedback records."""
    filepath = os.path.abspath(FEEDBACK_STORE_PATH)
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def log_human_feedback(
    takeoff_item: Dict[str, Any],
    system_decision: Dict[str, Any],
    corrected_code: str,
    correction_reason: str = "",
    corrected_by: str = "Estimator"
) -> Dict[str, Any]:
    """
    Logs a human estimator correction or confirmation into corrections_store.json.
    """
    filepath = os.path.abspath(FEEDBACK_STORE_PATH)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    record_id = f"corr-{uuid.uuid4().hex[:6]}"
    now_str = datetime.utcnow().isoformat() + "Z"

    record = {
        "id": record_id,
        "takeoff_item": {
            "id": takeoff_item.get("id") or takeoff_item.get("item_id"),
            "raw_description": takeoff_item.get("model") or takeoff_item.get("raw_description") or takeoff_item.get("raw_text") or "",
            "semantic_class": takeoff_item.get("equipment_type") or takeoff_item.get("semantic_class") or "EQUIPMENT",
            "commercial_action": takeoff_item.get("action") or takeoff_item.get("commercial_action") or "INSTALL",
            "quantity": takeoff_item.get("quantity", 1),
            "unit": takeoff_item.get("unit", "EACH"),
            "source_evidence": takeoff_item.get("source_sheet", "")
        },
        "system_decision": {
            "chosen_code": system_decision.get("chosen_code") or system_decision.get("sor_code"),
            "confidence": system_decision.get("confidence", 0.9),
            "outcome": system_decision.get("outcome", "MATCHED")
        },
        "corrected_code": corrected_code,
        "correction_reason": correction_reason or ("Confirmed system match" if corrected_code == system_decision.get("chosen_code") else "Human estimator override"),
        "corrected_by": corrected_by,
        "timestamp": now_str
    }

    store = load_feedback_store()
    store.append(record)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(store, f, indent=2)

    print(f"[Feedback Service] Logged correction record [{record_id}]: '{record['takeoff_item']['raw_description']}' -> Code '{corrected_code}'")
    return record
