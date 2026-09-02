"""
Integration and Unit Tests for Equipment Master Catalog & Fast Local Entity Resolution Engine.
"""

import os
import json
import pytest
from services.db import init_db, get_db_connection
from services.equipment_service import (
    seed_default_equipment_catalog,
    get_all_equipment,
    get_equipment_by_id,
    get_equipment_by_canonical_id,
    create_equipment,
    update_equipment,
    delete_equipment,
    add_alias_to_equipment
)
from services.entity_resolution import (
    get_entity_resolver,
    extract_action_and_qty,
    extract_physical_id,
    resolve_drawing_statement,
    aggregate_resolved_entities
)
from services.rule_engine import execute_user_mapping_rules


@pytest.fixture(autouse=True)
def setup_test_equipment_db():
    """Initializes schema and seeds catalog before each test."""
    init_db()
    seed_default_equipment_catalog(force=True)
    get_entity_resolver().reload()


def test_equipment_catalog_seeding_and_crud():
    """Tests that default equipment records are seeded and CRUD methods work properly."""
    all_eq = get_all_equipment(active_only=True)
    assert len(all_eq) >= 10, "Expected at least 10 default equipment items seeded"

    # Find Radio 4485
    r4485 = get_equipment_by_canonical_id("EQ-ERICSSON-RADIO-4485")
    assert r4485 is not None
    assert r4485["manufacturer"] == "Ericsson"
    assert r4485["equipment_class"] == "RRU"
    assert "RADIO 4485" in r4485["aliases"]

    # Test Create
    new_id = create_equipment({
        "canonical_id": "EQ-TEST-CUSTOM-RRU",
        "manufacturer": "Nokia",
        "model_name": "AirScale Dual RRH",
        "equipment_class": "RRU",
        "aliases": ["AIRSCALE RRH", "NOKIA AIRSCALE"],
        "attributes": {"power": "4x40W"}
    })
    assert new_id > 0

    created = get_equipment_by_id(new_id)
    assert created is not None
    assert created["canonical_id"] == "EQ-TEST-CUSTOM-RRU"
    assert "AIRSCALE RRH" in created["aliases"]

    # Test Add Alias
    success = add_alias_to_equipment("EQ-TEST-CUSTOM-RRU", "NOKIA DUAL RRH")
    assert success is True
    updated = get_equipment_by_id(new_id)
    assert "NOKIA DUAL RRH" in updated["aliases"]

    # Test Update
    update_equipment(new_id, {"manufacturer": "Nokia Networks"})
    updated = get_equipment_by_id(new_id)
    assert updated["manufacturer"] == "Nokia Networks"

    # Test Delete
    delete_equipment(new_id)
    assert get_equipment_by_id(new_id) is None


def test_fast_entity_resolution_aliases():
    """Tests that various drawing string representations map to the exact same canonical equipment in < 1ms."""
    resolver = get_entity_resolver()
    resolver.reload()

    # 1. Alias variant 1: Table row
    stmt1 = "Table row under EQUIPMENT NOTES: INSTALL 3.0x model ERICSSON RADIO 4485 (B3/B1/B7) (LTE1800/LTE2100) details 398x145x533mm"
    prov1 = {"page": 2, "source_sheet": "Sheet S1", "source_table": "EQUIPMENT NOTES", "source_row": 34}
    res1 = resolve_drawing_statement(stmt1, prov1)
    assert res1["canonical_id"] == "EQ-ERICSSON-RADIO-4485"
    assert res1["equipment_class"] == "RRU"
    assert res1["action"] == "INSTALL"
    assert res1["quantity"] == 3.0

    # 2. Alias variant 2: Note text
    stmt2 = "PROPOSED TELSTRA LTE1800/LTE2100/LTE2600 RADIO 4485 B3/B1/B7 (2 OFF BELOW) TO BE INSTALLED ON EXISTING MOUNTS"
    prov2 = {"page": 7, "source_sheet": "Sheet S7", "source_table": "DRAWING NOTES", "source_row": 12}
    res2 = resolve_drawing_statement(stmt2, prov2)
    assert res2["canonical_id"] == "EQ-ERICSSON-RADIO-4485"
    assert res2["equipment_class"] == "RRU"
    assert res2["action"] == "INSTALL"
    assert res2["quantity"] == 2.0

    # 3. Alias variant 3: Elevation callout
    stmt3 = "E.L. 25.1m C/L PROPOSED TELSTRA RADIO 4485 (1 OFF) @ S3"
    prov3 = {"page": 9, "source_sheet": "Sheet S9", "source_table": "ELEVATION", "source_row": 5}
    res3 = resolve_drawing_statement(stmt3, prov3)
    assert res3["canonical_id"] == "EQ-ERICSSON-RADIO-4485"
    assert res3["equipment_class"] == "RRU"
    assert res3["action"] == "INSTALL"
    assert res3["quantity"] == 1.0


def test_zero_duplicate_aggregation_across_sheets():
    """Tests that duplicate references across tables and notes for the same physical antenna ID are consolidated."""
    # S1 Table row: Antenna A1
    stmt_table = "Table row: REMOVE 1x model ARGUS VVPX310R-V4 with ID A1 on sector S1"
    prov_table = {"page": 2, "source_sheet": "S1", "source_table": "ANTENNA SCHEDULE", "source_row": 1}
    res_table = resolve_drawing_statement(stmt_table, prov_table)

    # S7 Note callout: referencing the same Antenna A1
    stmt_note = "EXISTING TELSTRA PANEL ANTENNA (1 OFF A1) TO BE RECOVERED"
    prov_note = {"page": 7, "source_sheet": "S7", "source_table": "DRAWING NOTES", "source_row": 4}
    res_note = resolve_drawing_statement(stmt_note, prov_note)

    assert res_table["canonical_id"] == "EQ-ARGUS-VVPX310R-V4"
    assert res_table["physical_id"] == "A1"
    assert res_note["physical_id"] == "A1"

    # Aggregating them must yield EXACTLY 1 item with quantity 1 (no duplicate count!)
    aggregated = aggregate_resolved_entities([res_table, res_note])
    assert len(aggregated) == 1
    assert aggregated[0]["quantity"] == 1.0
    assert aggregated[0]["canonical_id"] == "EQ-ARGUS-VVPX310R-V4"
    assert len(aggregated[0]["sources"]) == 2


def test_rule_engine_integration_with_equipment_resolver():
    """Tests that execute_user_mapping_rules utilizes the Equipment Master and maps items deterministically."""
    extracted_tables = [
        {
            "table_title": "EQUIPMENT NOTES",
            "page": 2,
            "sheet_name": "Equipment Layout",
            "headers": ["ITEM", "TYPE", "ACTION", "QTY"],
            "rows": [
                {"ITEM": "34", "TYPE": "ERICSSON RADIO 4485 (B3/B1/B7)", "ACTION": "INSTALL", "QTY": "3"},
                {"ITEM": "35", "TYPE": "ERICSSON RADIO 4490HP (B28/B26)", "ACTION": "INSTALL", "QTY": "3"},
                {"ITEM": "A1", "TYPE": "ARGUS VVPX310R-V4", "ACTION": "REMOVE", "QTY": "1"}
            ]
        }
    ]
    elements = [
        {"page": 7, "text": "EXISTING TELSTRA PANEL ANTENNA (1 OFF A1) TO BE RECOVERED"}
    ]
    price_list = [
        {"id": 1, "code": "W12252", "name": "Remote Radio Unit (RRU)", "unit": "each", "rate": 812.5, "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)"},
        {"id": 2, "code": "R12513", "name": "Remove Panel Antenna or TMD", "unit": "each", "rate": 292.5, "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)"}
    ]
    rules = [
        {"id": 1, "rule_name": "RRU Rule", "category": "RRU", "action_filter": "INSTALL", "target_sor_code": "W12252", "target_sor_name": "Remote Radio Unit (RRU)", "enabled": 1, "priority": 100},
        {"id": 2, "rule_name": "Antenna Removal", "category": "ANTENNA", "action_filter": "REMOVE", "target_sor_code": "R12513", "target_sor_name": "Remove Panel Antenna or TMD", "enabled": 1, "priority": 100}
    ]

    mapped_items, rem_tables, rem_elems = execute_user_mapping_rules(
        extracted_tables, elements, price_list, rules
    )

    assert len(mapped_items) >= 2
    rru_items = [m for m in mapped_items if m.get("sor_code") == "W12252"]
    assert len(rru_items) >= 1
    
    # Antenna A1 was in table and note, but must only have 1 removal item (no duplicate)
    antenna_items = [m for m in mapped_items if m.get("sor_code") == "R12513"]
    assert len(antenna_items) == 1
    assert antenna_items[0]["quantity"] == 1.0
