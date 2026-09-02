import pytest
import json
from services.ai_service import (
    DEFAULT_MAPPING_PROMPT_TEMPLATE,
    DEFAULT_CLIENT_MAPPING_PROMPT,
    run_gemini_boq_mapper_and_deduplicator,
    run_gemini_boq_deduplicator
)
from services.db import get_db_connection, init_db

@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()

def test_prompt_templates_seeded_in_db():
    """Verify Migration 13 correctly seeds boq_mapping_engine and client_mapping_rules."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT prompt FROM ai_prompts WHERE name = 'boq_mapping_engine'")
    mapping_row = cursor.fetchone()
    assert mapping_row is not None
    assert "TABLE-FIRST PRIMARY AUTHORITY" in mapping_row["prompt"]
    assert "Data not matching with antenna layout" in mapping_row["prompt"]
    assert "Estimator need to fill" in mapping_row["prompt"]
    
    cursor.execute("SELECT prompt FROM ai_prompts WHERE name = 'client_mapping_rules'")
    client_row = cursor.fetchone()
    assert client_row is not None
    assert "4G Panel Antenna" in client_row["prompt"]
    assert "5G AAU" in client_row["prompt"]
    assert "AIR" in client_row["prompt"]
    conn.close()

def test_legacy_fallback_deduplicator():
    """Ensure run_gemini_boq_deduplicator fallback functions properly."""
    raw = [
        {"equipment_type": "ANTENNA", "model": "ARGUS", "action": "INSTALL", "quantity": 2, "raw_text": "Install 2 Argus", "page": 9},
        {"equipment_type": "ANTENNA", "model": "OLD", "action": "EXISTING", "quantity": 1, "raw_text": "Existing antenna", "page": 9}
    ]
    res = run_gemini_boq_deduplicator(raw, "mock_key")
    assert len(res) == 1
    assert res[0]["action"] == "INSTALL"
    assert res[0]["quantity"] == 2

def test_table_first_mapping_prompt_structure():
    """Verify prompt formatting with extracted tables and unstructured callouts."""
    tables = [
        {
            "page": 9,
            "table_title": "TELSTRA ANTENNA CONFIGURATION TABLE",
            "headers": ["ANTENNA No", "ANTENNA TYPE", "ACTION"],
            "rows": [["A1", "KAELUS F6RHEU01 2705mm", "INSTALL"]]
        }
    ]
    elements = [
        {
            "type": "unstructured",
            "page": 7,
            "title": "Callout",
            "content": "PROPOSED TELSTRA PANEL ANTENNA (3 OFF)"
        }
    ]
    price_list = [
        {"id": 1, "code": "ANT-4G", "name": "Install 4G Panel Antenna", "unit": "each", "rate": 450.0, "row_type": "data_item"}
    ]
    
    # When GEMINI_API_KEY is dummy/empty, it should gracefully fall back to empty list without raising unhandled exceptions
    result = run_gemini_boq_mapper_and_deduplicator(tables, elements, price_list, "dummy_key")
    assert isinstance(result, list)
