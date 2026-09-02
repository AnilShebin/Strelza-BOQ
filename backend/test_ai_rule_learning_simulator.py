import json
import pytest
from services.db import get_db_connection, init_db, create_mapping_rule
from services.rule_engine import execute_user_mapping_rules
from services.ai_service import (
    retrieve_sor_candidates,
    validate_proposed_rule_schema,
    run_proposed_rule_simulation
)

@pytest.fixture(autouse=True)
def setup_test_db():
    """Ensures test database is initialized before each test."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    # Clean rules and logs for clean test run
    cursor.execute("DELETE FROM mapping_rules")
    cursor.execute("DELETE FROM correction_log")
    cursor.execute("DELETE FROM price_items")
    conn.commit()
    conn.close()

def test_tma_note_extraction_and_duplicate_skip():
    """Verify TMAs in callout notes are extracted as distinct items and not linked to antennas as duplicates."""
    extracted_tables = [
        {
            "table_title": "Antenna Configuration Table",
            "table_type": "antenna",
            "page": 2,
            "headers": ["Antenna No.", "Action", "Description"],
            "rows": [
                ["A1", "REMOVE", "Existing Panel Antenna"]
            ]
        }
    ]
    
    # Mock elements: a TMA removal note (which mentions antenna A1)
    elements = [
        {
            "page": 2,
            "sheet_name": "S1",
            "content": "RECOVER EXISTING TMA A1",
            "type": "unstructured"
        }
    ]
    
    price_list = [
        {"row_idx": 1, "code": "R12513", "name": "Recover antenna", "unit": "each", "rate": 150.0, "row_type": "data_item"},
        {"row_idx": 2, "code": "R13169", "name": "Recover internal Filter or TMA", "unit": "each", "rate": 80.0, "row_type": "data_item"}
    ]
    
    rules = [
        {
            "id": 1,
            "rule_name": "Antenna Removal",
            "category": "Antennas",
            "equipment_type": "PANEL ANTENNA",
            "status": "ACTIVE",
            "enabled": 1,
            "priority": 100,
            "match_keywords": "ANTENNA",
            "conditions_json": json.dumps({
                "all": [
                    {"name": "category", "operator": "equal_to", "value": "ANTENNA"},
                    {"name": "action", "operator": "equal_to", "value": "REMOVE"}
                ]
            }),
            "actions_json": json.dumps([{
                "name": "assign_price_item",
                "params": {"sor_code": "R12513", "target_name": "Recover antenna"}
            }])
        },
        {
            "id": 2,
            "rule_name": "TMA Removal",
            "category": "TOWER MOUNTED AMPLIFIER",
            "equipment_type": "TOWER MOUNTED AMPLIFIER",
            "status": "ACTIVE",
            "enabled": 1,
            "priority": 100,
            "match_keywords": "TMA",
            "conditions_json": json.dumps({
                "all": [
                    {"name": "category", "operator": "equal_to", "value": "TOWER MOUNTED AMPLIFIER"},
                    {"name": "action", "operator": "equal_to", "value": "REMOVE"}
                ]
            }),
            "actions_json": json.dumps([{
                "name": "assign_price_item",
                "params": {"sor_code": "R13169", "target_name": "Recover internal Filter or TMA"}
            }])
        }
    ]
    
    mapped_boq, remaining_tables, remaining_elements = execute_user_mapping_rules(
        extracted_tables, elements, price_list, rules
    )
    
    # Assertions
    assert len(mapped_boq) >= 2
    
    antenna_removal = next((item for item in mapped_boq if item["sor_code"] == "R12513"), None)
    tma_removal = next((item for item in mapped_boq if item["sor_code"] == "R13169"), None)
    
    assert antenna_removal is not None
    assert tma_removal is not None
    
    # Verify the TMA removal was NOT linked as a duplicate inside additional_sources of the antenna removal
    assert not any("TMA" in str(src.get("model", "")) for src in antenna_removal.get("additional_sources", []))

def test_candidate_retrieval():
    """Verify retrieve_sor_candidates finds and ranks candidates properly."""
    item = {"equipment_type": "PANEL ANTENNA", "model": "Argus RVVPX", "raw_text": "Argus antenna"}
    price_list = [
        {"code": "W7520", "name": "Install Argus Panel Antenna", "unit": "each", "rate": 600.0, "row_type": "data_item"},
        {"code": "W12252", "name": "Install Remote Radio Unit (RRU)", "unit": "each", "rate": 450.0, "row_type": "data_item"},
        {"code": "W13358", "name": "Install 5G AAU", "unit": "each", "rate": 700.0, "row_type": "data_item"}
    ]
    
    candidates = retrieve_sor_candidates(item, price_list, limit=2)
    assert len(candidates) <= 2
    # First candidate should be the Argus panel antenna due to name token overlap
    assert candidates[0]["code"] == "W7520"

def test_proposed_rule_schema_validation():
    """Verify only valid rule structures pass the strict schema guard."""
    valid_rule = {
        "operation": "CREATE",
        "rule_name": "Argus rule",
        "category": "Antennas",
        "equipment_type": "PANEL ANTENNA",
        "conditions_json": {
            "all": [
                {"name": "category", "operator": "equal_to", "value": "ANTENNA"},
                {"name": "model", "operator": "contains", "value": "ARGUS"}
            ]
        },
        "actions_json": [
            {
                "name": "assign_price_item",
                "params": {
                    "sor_code": "W7520",
                    "target_name": "Install Panel Antenna",
                    "comment": "Rule triggers"
                }
            }
        ],
        "priority": 110,
        "logic_explanation": "Test explanation"
    }
    
    invalid_rule = dict(valid_rule)
    invalid_rule["malicious_code"] = "import sys; sys.exit(0)" # Injection check
    
    invalid_rule_2 = dict(valid_rule)
    invalid_rule_2["actions_json"] = [{"name": "eval_code", "params": {"code": "print('inject')"}}] # Unknown action check
    
    assert validate_proposed_rule_schema(valid_rule) is True
    assert validate_proposed_rule_schema(invalid_rule) is False
    assert validate_proposed_rule_schema(invalid_rule_2) is False

def test_proposed_rule_simulation_and_conflict_detection():
    """Verify proposed rules are simulated correctly against logs and conflicts are flagged."""
    # 1. Log a correction
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO correction_log (pdf_name, original_description, corrected_code, corrected_name) VALUES (?, ?, ?, ?)",
        ("drawing.pdf", "ARGUS RVVPX ANTENNA", "W7520", "Install Panel Antenna")
    )
    conn.commit()
    conn.close()
    
    # Seed active rules for conflict detection using database helper to satisfy non-null constraints
    create_mapping_rule({
        "rule_name": "Conflicting Antenna Rule",
        "match_keywords": "ANTENNA",
        "conditions_json": json.dumps({"all": [{"name": "category", "operator": "equal_to", "value": "ANTENNA"}]}),
        "actions_json": json.dumps([{"name": "assign_price_item", "params": {"sor_code": "W12345"}}]),
        "target_sor_code": "W12345",
        "status": "ACTIVE",
        "enabled": 1
    })
    
    # 2. Simulate proposed rule targeting W7520
    c_json = {
        "all": [
            {"name": "category", "operator": "equal_to", "value": "ANTENNA"},
            {"name": "model", "operator": "contains", "value": "ARGUS"}
        ]
    }
    a_json = [{
        "name": "assign_price_item",
        "params": {
            "sor_code": "W7520",
            "target_name": "Install Panel Antenna"
        }
    }]
    
    stats = run_proposed_rule_simulation(c_json, a_json, "W7520", "Install Panel Antenna")
    
    # Assert simulator stats
    assert stats["tested_count"] >= 1
    assert stats["true_positives"] >= 1
    assert stats["precision"] == 100.0
    
    # Verify conflict detector flagged the active rule
    assert len(stats["conflicts"]) >= 1
    assert stats["conflicts"][0]["target_sor_code"] == "W12345"

def test_fastapi_rules_lifecycle_endpoints():
    """Verify pending rules, approval, rejection, and simulation functions directly."""
    from main import get_pending_rules, approve_rule, reject_rule, simulate_rule_endpoint, get_rules_history
    
    # 1. Seed a pending rule
    rule_id = create_mapping_rule({
        "rule_name": "Pending Test Rule",
        "conditions_json": json.dumps({"all": [{"name": "category", "operator": "equal_to", "value": "ANTENNA"}]}),
        "actions_json": json.dumps([{"name": "assign_price_item", "params": {"sor_code": "W7520"}}]),
        "status": "PENDING_REVIEW",
        "source": "AI_PROPOSED"
    })
    
    # 2. Retrieve pending rules
    pending_list = get_pending_rules()
    assert any(r["id"] == rule_id for r in pending_list)
    
    # 3. Simulate rule endpoint
    res = simulate_rule_endpoint(rule_id)
    assert "simulation_stats" in res
    
    # 4. Approve pending rule
    res = approve_rule(rule_id, approved_by="TestUser")
    assert res["status"] == "success"
    
    # Verify status is ACTIVE in history
    history = get_rules_history()
    activated_rule = next((r for r in history if r["id"] == rule_id), None)
    assert activated_rule is not None
    assert activated_rule["status"] == "ACTIVE"
    assert activated_rule["approved_by"] == "TestUser"
    
    # 5. Seed another rule and reject it
    pending_id_2 = create_mapping_rule({
        "rule_name": "Pending Test Rule 2",
        "conditions_json": json.dumps({"all": [{"name": "category", "operator": "equal_to", "value": "ANTENNA"}]}),
        "actions_json": json.dumps([{"name": "assign_price_item", "params": {"sor_code": "W7520"}}]),
        "status": "PENDING_REVIEW",
        "source": "AI_PROPOSED"
    })
    
    res = reject_rule(pending_id_2, rejected_by="TestUser")
    assert res["status"] == "success"
    
    # Verify status is REJECTED in history
    history = get_rules_history()
    rejected_rule = next((r for r in history if r["id"] == pending_id_2), None)
    assert rejected_rule is not None
    assert rejected_rule["status"] == "REJECTED"
    assert rejected_rule["rejected_by"] == "TestUser"
