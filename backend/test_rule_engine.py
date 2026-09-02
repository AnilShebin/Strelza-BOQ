import pytest
import os
from services.db import (
    init_db,
    get_db_connection,
    get_all_mapping_rules,
    create_mapping_rule,
    update_mapping_rule,
    delete_mapping_rule,
    toggle_mapping_rule,
    export_mapping_rules_to_excel,
    import_mapping_rules_from_excel,
    reset_default_mapping_rules
)
from services.rule_engine import (
    parse_numeric_dimension,
    extract_location,
    extract_action_and_qty,
    execute_user_mapping_rules
)


@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()
    reset_default_mapping_rules()
    from processors.parser_rules import EQUIPMENT_KEYWORDS
    EQUIPMENT_KEYWORDS["GPS"] = ["GPS"]


def test_mapping_rules_seeded_in_db():
    """Verify DEFAULT_MAPPING_RULES are seeded into mapping_rules SQLite table."""
    rules = get_all_mapping_rules()
    assert len(rules) >= 12
    
    rule_names = [r["rule_name"] for r in rules]
    assert any("GPS system" in name for name in rule_names)
    assert any("One panel Antenna" in name for name in rule_names)
    assert any("One 5G AAU - first" in name for name in rule_names)
    assert any("Remote Radio Unit (RRU) Removal" in name for name in rule_names)
    assert any("Remote Radio Unit (RRU)" in name for name in rule_names)
    assert any("Tower Mounted Device Removal" in name for name in rule_names)


def test_location_and_spare_filtering():
    """Verify location extraction (Tower vs Shelter) and action extraction."""
    row_tower = {
        "ITEM": 31,
        "EQUIPMENT": "ERICSSON RRUS 32 B3 (LTE1800)",
        "EQUIPMENT DETAILS": "431 x 182 x 500mm",
        "EXISTING": 3,
        "PROPOSED": -3,
        "REFERENCE DWG": "SHEETS S1-1, S3"
    }
    assert extract_location(row_tower, "Sheet 9", "RRUS 32") == "TOWER"
    act_tower, qty_tower = extract_action_and_qty(row_tower, "RRUS 32")
    assert act_tower == "REMOVE"
    assert qty_tower == 3.0

    row_shelter = {
        "ITEM": 33,
        "EQUIPMENT": "ERICSSON RADIO 4480",
        "EQUIPMENT DETAILS": "400 x 145 x 550mm",
        "EXISTING": 3,
        "PROPOSED": -3,
        "REFERENCE DWG": "SHEET E5"
    }
    assert extract_location(row_shelter, "Sheet 9", "RADIO 4480") == "SHELTER"
    act_shelter, qty_shelter = extract_action_and_qty(row_shelter, "RADIO 4480")
    assert act_shelter == "REMOVE"
    assert qty_shelter == 3.0


def test_compound_gps_replacement_action():
    """Verify compound 'Recover and Replace' action is recognized as REPLACE with qty 1."""
    text = "EXISTING TELSTRA LTE700 GPS ANTENNA (1 OFF A15) TO BE RECOVERED AND REPLACED WITH PROPOSED TELSTRA KA-7005-1110 GPS ANTENNA (1 OFF A15) TO BE INSTALLED USING STANDARD MOUNT"
    action, qty = extract_action_and_qty({}, text)
    assert action == "REPLACE"
    assert qty == 1.0


def test_equipment_table_rule_mapping_camperdown():
    """Verify Equipment Notes rows map to Tower RRU removal vs Shelter RRU recovery vs Shelter Filter removal."""
    price_list = [
        {"row_idx": 10, "code": "R12513", "name": "Remote Radio Unit (RRU) Removal", "rate": 292.5, "unit": "each"},
        {"row_idx": 30, "code": "W12252", "name": "Remote Radio Unit (RRU)", "rate": 812.5, "unit": "each"},
        {"row_idx": 40, "code": "R12513", "name": "Tower Mounted Device Removal", "rate": 49.4, "unit": "each"},
        {"row_idx": 50, "code": "", "name": "Recover GPS system", "rate": 460.0, "unit": "each"},
    ]

    extracted_tables = [
        {
            "table_type": "EQUIPMENT NOTES",
            "sheet_name": "Sheet 9",
            "rows": [
                {"ITEM": 31, "EQUIPMENT": "ERICSSON RRUS 32 B3 (LTE1800)", "EQUIPMENT DETAILS": "431 x 182 x 500mm", "EXISTING": 3, "PROPOSED": -3, "REFERENCE DWG": "SHEETS S1-1, S3"},
                {"ITEM": 32, "EQUIPMENT": "ERICSSON RRUS 32 B7 (NR/LTE2600)", "EQUIPMENT DETAILS": "431 x 182 x 500mm", "EXISTING": 3, "PROPOSED": -3, "REFERENCE DWG": "SHEETS S1-1, S3"},
                {"ITEM": 33, "EQUIPMENT": "ERICSSON RADIO 4480 (B5/B28)", "EQUIPMENT DETAILS": "400 x 145 x 550mm", "EXISTING": 3, "PROPOSED": -3, "REFERENCE DWG": "SHEET E5"},
                {"ITEM": 34, "EQUIPMENT": "ERICSSON RADIO 4485", "EQUIPMENT DETAILS": "398 x 145 x 533mm", "EXISTING": 0, "PROPOSED": 3, "REFERENCE DWG": "SHEETS S1-1, S3"},
                {"ITEM": 36, "EQUIPMENT": "ERICSSON DUAL DUPLEX FILTER", "EQUIPMENT DETAILS": "KRF 102 268/1", "EXISTING": "3 (SPARE)", "PROPOSED": 0, "REFERENCE DWG": "SHEET E5"},
                {"ITEM": 38, "EQUIPMENT": "KAELUS TWIN BANDSTOP FILTER", "EQUIPMENT DETAILS": "BSF0020F1V2", "EXISTING": 6, "PROPOSED": -6, "REFERENCE DWG": "SHEET E5"},
            ]
        }
    ]

    elements = [
        {
            "type": "unstructured",
            "content": "EXISTING TELSTRA LTE700 GPS ANTENNA (1 OFF A15) TO BE RECOVERED AND REPLACED WITH PROPOSED TELSTRA KA-7005-1110 GPS ANTENNA (1 OFF A15) TO BE INSTALLED USING STANDARD MOUNT",
            "sheet_name": "Sheet 9"
        }
    ]

    rules = get_all_mapping_rules()
    import json
    gps_replace_rule = {
        "rule_name": "GPS replacement",
        "internal_id": "GPS_REPLACE_MOCK",
        "category": "Recover GPS system",
        "equipment_type": "GPS",
        "action_filter": "REPLACE",
        "target_sor_code": "",
        "target_sor_name": "Recover GPS system",
        "qty_formula": "table_qty",
        "priority": 100,
        "enabled": 1,
        "conditions_json": json.dumps({
            "all": [
                {"name": "category", "operator": "equal_to", "value": "ANTENNA"},
                {"name": "action", "operator": "equal_to", "value": "REPLACE"},
                {"name": "model", "operator": "contains", "value": "GPS"}
            ]
        }),
        "actions_json": json.dumps([
            {
                "name": "assign_price_item",
                "params": {
                    "internal_id": "GPS_REPLACE_MOCK",
                    "sor_code": "",
                    "target_name": "Recover GPS system"
                }
            }
        ])
    }
    rules.append(gps_replace_rule)
    mapped_items, rem_tables, unmapped = execute_user_mapping_rules(extracted_tables, elements, price_list, rules)

    # Item 36 (Spare) should be ignored
    assert len(mapped_items) == 6  # 31, 32, 33, 34, 38 + GPS replacement

    names = [m["item_name"] for m in mapped_items]
    assert names.count("Remote Radio Unit (RRU) Removal") == 3
    assert names.count("Remote Radio Unit (RRU)") == 1
    assert names.count("Tower Mounted Device Removal") == 1
    assert names.count("Recover GPS system") == 1


def test_antenna_configuration_table_camperdown_13_removals():
    """Verify Antenna Configuration tables in Camperdown map to 3x 4G panels, 3x 5G AAUs, and exactly 13 removed antennas."""
    price_list = [
        {"row_idx": 102, "code": "R12513", "name": "Remove Panel Antenna", "category": "Antennas", "rate": 292.5, "unit": "each"},
        {"row_idx": 103, "code": "W7520", "name": "One panel Antenna", "category": "Antennas", "rate": 675.0, "unit": "each"},
        {"row_idx": 106, "code": "W13358", "name": "One 5G AAU", "category": "Antennas", "rate": 812.5, "unit": "each"},
    ]

    # Proposed Antenna Table (Table 14)
    table_proposed = {
        "table_type": "TELSTRA MOBILES ANTENNA CONFIGURATION TABLE",
        "headers": ["ANTENNA No", "ANTENNA TYPE & SIZE H x W x D (mm)", "ANTENNA ACTION REQUIRED", "SECTOR NO. & TECHNOLOGY"],
        "rows": [
            ["A1", "KAELUS F6RHEU01 PANEL 2705 x 470 x 178 (mm)", "INSTALL", "S1: LTE700"],
            ["A4", "ERICSSON AIR3258 PANEL 717 x 408 x 189 (mm)", "INSTALL", "S1: NR3600"],
            ["A5", "KAELUS F6RHEU01 PANEL 2705 x 470 x 178 (mm)", "INSTALL", "S3: LTE700"],
            ["A8", "ERICSSON AIR3258 PANEL 717 x 408 x 189 (mm)", "INSTALL", "S3: NR3600"],
            ["A9", "KAELUS F6RHEU01 PANEL 2705 x 470 x 178 (mm)", "INSTALL", "S2: LTE700"],
            ["A14", "ERICSSON AIR3258 PANEL 717 x 408 x 189 (mm)", "INSTALL", "S2: NR3600"],
        ]
    }

    # Removed Panels Table (Table 15: 9 panels)
    table_removed = {
        "table_type": "TELSTRA MOBILES ANTENNA CONFIGURATION TABLE",
        "headers": ["ANTENNA No", "ANTENNA TYPE & SIZE H x W x D (mm)", "ANTENNA ACTION REQUIRED", "SECTOR NO. & TECHNOLOGY"],
        "rows": [
            ["A1 (OLD)", "ARGUS RVVPX310.11B-T2H PANEL", "REMOVE", "-"],
            ["A3", "ARGUS RVVPX310B2 PANEL", "REMOVE", "-"],
            ["A4 (OLD)", "ERICSSON AIR6488 PANEL", "REMOVE", "-"],
            ["A5 (OLD)", "ARGUS RVVPX310.11B-T2H PANEL", "REMOVE", "-"],
            ["A7", "ARGUS RVVPX310B2 PANEL", "REMOVE", "-"],
            ["A8 (OLD)", "ERICSSON AIR6488 PANEL", "REMOVE", "-"],
            ["A9 (OLD)", "ARGUS RVVPX310.11B-T2H PANEL", "REMOVE", "-"],
            ["A11", "ARGUS RVVPX310B2 PANEL", "REMOVE", "-"],
            ["A14 (OLD)", "ERICSSON AIR6488 PANEL", "REMOVE", "-"],
        ]
    }

    # Removed Spare Panels Table (Table 16: 4 spare panels)
    table_spares_removed = {
        "table_type": "TELSTRA MOBILES ANTENNA CONFIGURATION TABLE",
        "headers": ["ANTENNA No", "ANTENNA TYPE & SIZE H x W x D (mm)", "ANTENNA ACTION REQUIRED", "SECTOR NO. & TECHNOLOGY"],
        "rows": [
            ["A2", "DELTEC MTPA890-V8-RM (SPARE)", "REMOVE", "-"],
            ["A6", "DELTEC MTPA890-V8-RM (SPARE)", "REMOVE", "-"],
            ["A10", "DELTEC MTPA890-V8-RM (SPARE)", "REMOVE", "-"],
            ["A12", "DELTEC MTPA890-V8-RM (SPARE)", "REMOVE", "-"],
        ]
    }

    rules = get_all_mapping_rules()
    mapped_items, rem_tables, unmapped = execute_user_mapping_rules(
        [table_proposed, table_removed, table_spares_removed], [], price_list, rules
    )

    w7520_qty = sum(m["quantity"] for m in mapped_items if m["sor_code"] == "W7520")
    r12513_qty = sum(m["quantity"] for m in mapped_items if m["sor_code"] == "R12513" and m["item_name"] == "Remove Panel Antenna")

    assert w7520_qty == 6.0
    assert r12513_qty == 13.0


def test_5stage_pipeline_facts_and_evidence():
    """Verify Stage 2 Canonical Fact extraction, Stage 5 Explainability evidence, and confidence scoring."""
    price_list = [
        {"row_idx": 102, "code": "R12513", "name": "Remove Panel Antenna", "category": "Antennas", "rate": 292.5, "unit": "each"},
        {"row_idx": 103, "code": "W7520", "name": "One panel Antenna", "category": "Antennas", "rate": 675.0, "unit": "each"},
    ]

    table_removals = {
        "table_type": "TELSTRA MOBILES ANTENNA CONFIGURATION TABLE",
        "headers": ["ANTENNA No", "ANTENNA TYPE & SIZE H x W x D (mm)", "ANTENNA ACTION REQUIRED", "SECTOR NO. & TECHNOLOGY"],
        "rows": [
            ["A1 (OLD)", "ARGUS VVPX310R-V4 PANEL 1277 x 290 x 103mm", "REMOVE", "-"],
            ["A5 (OLD)", "ARGUS VVPX310R-V4 PANEL 1277 x 290 x 103mm", "REMOVE", "-"],
            ["A9 (OLD)", "ARGUS VVPX310R-V4 PANEL 1277 x 290 x 103mm", "REMOVE", "-"],
        ]
    }

    # Discrepancy element: Stating 4 OFF for A1, A5 & A9 (when table has 3)
    elements = [
        {
            "content": "EXISTING TELSTRA LTE1800 PANEL ANTENNAS (4 OFF A1, A5 & A9) TO BE RECOVERED.",
            "page": 7
        }
    ]

    rules = get_all_mapping_rules()
    mapped_items, rem_tables, rem_elements = execute_user_mapping_rules(
        [table_removals], elements, price_list, rules
    )

    assert len(mapped_items) == 3
    for item in mapped_items:
        assert item["confidence_level"] == "HIGH"
        assert item["confidence_score"] == 100.0
        assert "evidence" in item
        assert item["evidence"]["target_sor"] == "R12513"


def test_rule_engine_source_and_page_gates():
    """Verify that ignore_pages, primary_source, and preferred_source_type gates correctly filter rule execution."""
    import json
    from models.telecom_entity import TelecomTakeoffEntity, TelecomAttributes, TakeoffProvenance
    from services.venmo_engine import evaluate_venmo_rules_for_entity

    price_list = [
        {"row_idx": 1, "code": "W7520", "name": "One panel Antenna", "rate": 675.0, "unit": "each"},
    ]

    rules = [
        {
            "id": 1,
            "rule_name": "Antenna Gate Test Rule",
            "category": "Antennas",
            "equipment_type": "PANEL ANTENNA",
            "match_keywords": "",
            "exclude_keywords": "",
            "action_filter": "INSTALL",
            "target_sor_code": "W7520",
            "qty_formula": "table_qty",
            "priority": 100,
            "enabled": 1,
            "conditions_json": json.dumps({
                "all": [
                    {"name": "category", "operator": "equal_to", "value": "ANTENNA"},
                    {"name": "action", "operator": "equal_to", "value": "INSTALL"}
                ]
            }),
            "actions_json": json.dumps([
                {
                    "name": "assign_price_item",
                    "params": {
                        "sor_code": "W7520",
                        "target_name": "One panel Antenna"
                    }
                }
            ]),
            "primary_source": "Antenna Configuration Table",
            "preferred_source_type": "TABLE",
            "ignore_pages": "Drawing Index; Document Control"
        }
    ]

    # Test Case 1: Matching entity (passes all gates)
    entity_pass = TelecomTakeoffEntity(
        entity_id="e_pass",
        category="ANTENNA",
        action="INSTALL",
        model="Kaelus Panel",
        attributes=TelecomAttributes(location="TOWER", height_mm=2500, sector="-", sector_index=1, is_active=False),
        provenance=TakeoffProvenance(
            page=3,
            source_sheet="Antenna Layout Sheet",
            source_table="Antenna Configuration Table",
            source_row=1,
            raw_text="INSTALL Kaelus"
        )
    )
    entity_pass.provenance.source_type = "TABLE"  # Explicitly set

    res, matched = evaluate_venmo_rules_for_entity(entity_pass, rules, price_list)
    assert res is not None
    assert matched["id"] == 1

    # Test Case 2: Ignored page gate triggered
    entity_ignored_page = TelecomTakeoffEntity(
        entity_id="e_ignore",
        category="ANTENNA",
        action="INSTALL",
        model="Kaelus Panel",
        attributes=TelecomAttributes(location="TOWER", height_mm=2500, sector="-", sector_index=1, is_active=False),
        provenance=TakeoffProvenance(
            page=1,
            source_sheet="Drawing Index Page",
            source_table="Antenna Configuration Table",
            source_row=1,
            raw_text="INSTALL Kaelus"
        )
    )
    entity_ignored_page.provenance.source_type = "TABLE"

    res, matched = evaluate_venmo_rules_for_entity(entity_ignored_page, rules, price_list)
    assert res is None  # Should fail ignore_pages gate

    # Test Case 3: Primary Source gate mismatch
    entity_wrong_source = TelecomTakeoffEntity(
        entity_id="e_wrong_src",
        category="ANTENNA",
        action="INSTALL",
        model="Kaelus Panel",
        attributes=TelecomAttributes(location="TOWER", height_mm=2500, sector="-", sector_index=1, is_active=False),
        provenance=TakeoffProvenance(
            page=3,
            source_sheet="Antenna Layout Sheet",
            source_table="Wrong Table Title",
            source_row=1,
            raw_text="INSTALL Kaelus"
        )
    )
    entity_wrong_source.provenance.source_type = "TABLE"

    res, matched = evaluate_venmo_rules_for_entity(entity_wrong_source, rules, price_list)
    assert res is None  # Should fail primary_source gate

    # Test Case 4: Preferred Source Type gate mismatch (wants TABLE, got NOTE)
    entity_wrong_type = TelecomTakeoffEntity(
        entity_id="e_wrong_type",
        category="ANTENNA",
        action="INSTALL",
        model="Kaelus Panel",
        attributes=TelecomAttributes(location="TOWER", height_mm=2500, sector="-", sector_index=1, is_active=False),
        provenance=TakeoffProvenance(
            page=3,
            source_sheet="Antenna Layout Sheet",
            source_table="Antenna Configuration Table",
            source_row=1,
            raw_text="INSTALL Kaelus"
        )
    )
    entity_wrong_type.provenance.source_type = "NOTE"

    res, matched = evaluate_venmo_rules_for_entity(entity_wrong_type, rules, price_list)
    assert res is None  # Should fail preferred_source_type gate


