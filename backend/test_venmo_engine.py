import pytest
from models.telecom_entity import TelecomTakeoffEntity, TelecomAttributes, TakeoffProvenance
from services.venmo_engine import evaluate_venmo_rules_for_entity, get_venmo_schema
from services.price_list_differ import calculate_price_list_diff
from services.db import DEFAULT_MAPPING_RULES


SAMPLE_PRICE_LIST = [
    {"id": 1, "code": "W7520", "name": "One panel Antenna", "rate": 675.0, "unit": "each", "category": "Antennas"},
    {"id": 2, "code": "W13360", "name": "One panel Antenna- extra over", "rate": 340.0, "unit": "each", "category": "Antennas"},
    {"id": 3, "code": "W13358", "name": "One 5G AAU", "rate": 812.5, "unit": "each", "category": "Antennas"},
    {"id": 4, "code": "R12513", "name": "Remove Panel Antenna", "rate": 260.0, "unit": "each", "category": "Antennas"},
    {"id": 5, "code": "W12804", "name": "GPS system", "rate": 460.0, "unit": "each", "category": "Antennas"},
    {"id": 6, "code": "W12252", "name": "Remote Radio Unit (RRU)", "rate": 550.0, "unit": "each", "category": "Radios & TMD"},
    {"id": 8, "code": "W7893", "name": "Tower Mounted Device (TMA, COM, FILTER)", "rate": 344.5, "unit": "each", "category": "Radios & TMD"},
]


def test_primary_panel_antenna_venmo_rule():
    entity = TelecomTakeoffEntity(
        entity_id="ent_001",
        category="ANTENNA",
        action="INSTALL",
        model="ARGUS RVVPX310.11B-T2H",
        attributes=TelecomAttributes(
            location="TOWER",
            height_mm=2705.0,
            sector_index=1,
            is_active=False
        )
    )
    res, rule = evaluate_venmo_rules_for_entity(entity, DEFAULT_MAPPING_RULES, SAMPLE_PRICE_LIST)
    assert res is not None
    assert res["sor_code"] == "W7520"
    assert res["rate"] == 675.0
    assert rule["internal_id"] == "R001"


def test_extra_over_panel_antenna_venmo_rule():
    entity = TelecomTakeoffEntity(
        entity_id="ent_002",
        category="ANTENNA",
        action="INSTALL",
        model="ARGUS RVVPX310.11B-T2H",
        attributes=TelecomAttributes(
            location="TOWER",
            height_mm=2705.0,
            sector_index=2,
            is_active=False
        )
    )
    res, rule = evaluate_venmo_rules_for_entity(entity, DEFAULT_MAPPING_RULES, SAMPLE_PRICE_LIST)
    assert res is not None
    assert res["sor_code"] == "W13360"
    assert res["rate"] == 340.0
    assert rule["internal_id"] == "R002"


def test_5g_active_aau_venmo_rule():
    entity = TelecomTakeoffEntity(
        entity_id="ent_003",
        category="ANTENNA",
        action="INSTALL",
        model="AIR 6488 B78",
        attributes=TelecomAttributes(
            location="TOWER",
            height_mm=800.0,
            sector_index=1,
            is_active=True
        )
    )
    res, rule = evaluate_venmo_rules_for_entity(entity, DEFAULT_MAPPING_RULES, SAMPLE_PRICE_LIST)
    assert res is not None
    assert res["sor_code"] == "W13358"
    assert res["rate"] == 812.5
    assert rule["internal_id"] == "R003"


def test_tower_gps_replacement_venmo_rule():
    entity = TelecomTakeoffEntity(
        entity_id="ent_004",
        category="GPS",
        action="INSTALL",
        model="KA-7005-1110 GPS ANTENNA",
        attributes=TelecomAttributes(
            location="TOWER",
            height_mm=0.0
        )
    )
    res, rule = evaluate_venmo_rules_for_entity(entity, DEFAULT_MAPPING_RULES, SAMPLE_PRICE_LIST)
    assert res is not None
    assert res["sor_code"] == "W12804"
    assert res["rate"] == 460.0
    assert rule["internal_id"] == "R007"


def test_shelter_rru_recovery_venmo_rule():
    entity = TelecomTakeoffEntity(
        entity_id="ent_005",
        category="RRU",
        action="REMOVE",
        model="ERICSSON RADIO 4480",
        attributes=TelecomAttributes(
            location="SHELTER",
            height_mm=0.0
        )
    )
    res, rule = evaluate_venmo_rules_for_entity(entity, DEFAULT_MAPPING_RULES, SAMPLE_PRICE_LIST)
    assert res is not None
    assert res["sor_code"] == "R12513"
    assert res["rate"] == 260.0
    assert rule["internal_id"] == "R014"


def test_dcdu_installation_venmo_rule():
    entity = TelecomTakeoffEntity(
        entity_id="ent_006",
        category="RRU",
        action="INSTALL",
        model="ERICSSON RADIO 4485",
        attributes=TelecomAttributes(
            location="TOWER",
            height_mm=0.0,
            sector_index=1
        )
    )
    res, rule = evaluate_venmo_rules_for_entity(entity, DEFAULT_MAPPING_RULES, SAMPLE_PRICE_LIST)
    assert res is not None
    assert res["sor_code"] == "W12252"
    assert res["rate"] == 550.0
    assert rule["internal_id"] == "R012"


def test_price_list_differ_engine():
    old_list = [
        {"id": 1, "code": "W7520", "name": "One panel Antenna", "rate": 675.0},
        {"id": 2, "code": "W13360", "name": "extra-over", "rate": 340.0},
        {"id": 3, "code": "OLD_ITEM", "name": "Discontinued", "rate": 100.0}
    ]
    new_list = [
        {"id": 1, "code": "W7520", "name": "One panel Antenna", "rate": 690.0},
        {"id": 2, "code": "W13360", "name": "extra-over", "rate": 340.0},
        {"id": 4, "code": "NEW_ITEM", "name": "Brand New 5G Antenna", "rate": 950.0}
    ]
    rules = [
        {"rule_name": "Old Rule", "target_sor_code": "OLD_ITEM"}
    ]

    report = calculate_price_list_diff(old_list, new_list, rules)
    assert report.unchanged_count == 1
    assert report.modified_count == 1
    assert report.removed_count == 1
    assert report.new_count == 1
    assert "Old Rule" in report.orphaned_rules


def test_business_rules_schema_export():
    schema = get_venmo_schema()
    assert "variables" in schema
    assert "actions" in schema
    var_names = [v["name"] for v in schema["variables"]]
    assert "category" in var_names
    assert "height_mm" in var_names
    assert "is_active" in var_names
    act_names = [a["name"] for a in schema["actions"]]
    assert "assign_price_item" in act_names

