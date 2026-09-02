import json
import pytest
import os
import sqlite3
from services.db import init_db, get_db_connection
from services.rule_engine import execute_user_mapping_rules

@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Reset mapping_rules and price_items tables
    cursor.execute("DELETE FROM mapping_rules")
    cursor.execute("DELETE FROM price_items")
    conn.commit()
    conn.close()

def test_db_migrations_exist():
    """Verify that migrations successfully created target columns."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check price_items
    cursor.execute("PRAGMA table_info(price_items)")
    price_cols = [r["name"] for r in cursor.fetchall()]
    assert "attributes_json" in price_cols
    
    # Check mapping_rules
    cursor.execute("PRAGMA table_info(mapping_rules)")
    rule_cols = [r["name"] for r in cursor.fetchall()]
    assert "rule_text" in rule_cols
    conn.close()

def test_generic_pipeline_execution():
    """Verify full generic Facts -> Rules Constraints -> Catalog Matcher -> Trace pipeline."""
    # Seed active pricing catalog items
    price_list = [
        {
            "row_idx": 1,
            "code": "R12513",
            "name": "Remove Panel Antenna",
            "category": "Antennas",
            "rate": 292.5,
            "unit": "each",
            "attributes_json": '{"type": "antenna", "action": "remove"}'
        },
        {
            "row_idx": 2,
            "code": "W7520",
            "name": "Install Panel Antenna",
            "category": "Antennas",
            "rate": 675.0,
            "unit": "each",
            "attributes_json": '{"type": "antenna", "action": "install"}'
        }
    ]

    # Seed natural-language business rules
    rules = [
        {
            "rule_id": "R-100",
            "rule_name": "Recovered items are removals",
            "rule_text": "When an existing item is to be recovered, treat the action as REMOVE. Do not select installation price items.",
            "enabled": 1,
            "priority": 100
        }
    ]

    # Test complete drawing note statement:
    # "EXISTING PANEL ANTENNAS (3 OFF A1, A5 & A9) TO BE RECOVERED."
    elements = [
        {
            "page": 3,
            "sheet_name": "S1",
            "content": "EXISTING PANEL ANTENNAS (3 OFF A1, A5 & A9) TO BE RECOVERED.",
            "type": "unstructured"
        }
    ]

    mapped_items, rem_tables, rem_elems = execute_user_mapping_rules([], elements, price_list, rules)

    assert len(mapped_items) == 1
    item = mapped_items[0]
    
    # Assert matched commercial SKU is the REMOVE item R12513, not the INSTALL item
    assert item["sor_code"] == "R12513"
    assert item["quantity"] == 3.0
    assert item["total_cost"] == 292.5 * 3.0
    
    # Verify trace explanation exists
    assert "evidence" in item
    trace = item["evidence"]
    assert "original_statement" in trace
    assert "ai_understanding" in trace
    assert "applied_rules" in trace
    assert "reason_for_selection" in trace

def test_rules_based_deduplication():
    """Verify deduplication prioritizes structured tables over notes when physical ID overlaps."""
    price_list = [
        {
            "row_idx": 1,
            "code": "R12513",
            "name": "Remove Panel Antenna",
            "category": "Antennas",
            "rate": 292.5,
            "unit": "each"
        }
    ]

    rules = [
        {
            "rule_id": "R-200",
            "rule_name": "Prioritize SITE LAYOUT table source",
            "rule_text": "When the same physical item appears in multiple tables or notes, use the SITE LAYOUT table as the primary source.",
            "enabled": 1,
            "priority": 100
        }
    ]

    # Table removal statement representing antenna A1
    extracted_tables = [
        {
            "table_title": "SITE LAYOUT",
            "page": 2,
            "sheet_name": "S1",
            "headers": ["ANTENNA NO", "ANTENNA TYPE", "ACTION"],
            "rows": [
                {"ANTENNA NO": "A1", "ANTENNA TYPE": "ARGUS PANEL", "ACTION": "REMOVE"}
            ]
        }
    ]

    # Note statement representing same antenna A1
    elements = [
        {
            "page": 2,
            "sheet_name": "S1",
            "content": "EXISTING PANEL ANTENNA A1 TO BE RECOVERED.",
            "type": "unstructured"
        }
    ]

    mapped_items, rem_tables, rem_elems = execute_user_mapping_rules(extracted_tables, elements, price_list, rules)

    # Should consolidate down to exactly 1 takeoff item, rather than duplicating
    assert len(mapped_items) == 1
    assert mapped_items[0]["source_sheet"] == "S1"
    
    # Verify that the mapped row comes from the structured table SITE LAYOUT, not the unstructured note
    assert mapped_items[0]["evidence"]["original_statement"].startswith("Table row under SITE LAYOUT")
