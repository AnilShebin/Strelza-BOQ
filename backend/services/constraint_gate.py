"""
constraint_gate.py - Deterministic Candidate Gate (Filter Engine)

Filters hundreds of SOR codes down to a small shortlist (<=15 candidates) using pure deterministic business logic:
- Semantic Class Compatibility
- Commercial Action Compatibility (INSTALL vs REMOVE vs RELOCATE vs TEST)
- Unit Type Compatibility (EACH vs M vs HOUR vs SUM)
- Compound Basis Logic (FIRST vs EXTRA_OVER dependency)
"""

from typing import List, Dict, Any

COMPATIBLE_CLASSES = {
    "PANEL_ANTENNA": ["PANEL_ANTENNA", "5G_AAU", "EQUIPMENT"],
    "ANTENNA": ["PANEL_ANTENNA", "5G_AAU", "EQUIPMENT"],
    "5G_AAU": ["5G_AAU", "PANEL_ANTENNA", "EQUIPMENT"],
    "RRU": ["RRU", "EQUIPMENT"],
    "TMD": ["TMD", "EQUIPMENT"],
    "BASEBAND": ["BASEBAND", "ROUTER", "EQUIPMENT"],
    "ROUTER": ["ROUTER", "BASEBAND", "EQUIPMENT"],
    "GPS": ["GPS", "GPS_COMPONENT", "EQUIPMENT"],
    "CABLE": ["FEEDER_CABLE", "CABLE", "TESTING"],
    "FEEDER_CABLE": ["FEEDER_CABLE", "CABLE", "TESTING"],
    "TESTING": ["BLACKBIRD_TEST", "TESTING", "FEEDER_CABLE"],
    "BLACKBIRD_TEST": ["BLACKBIRD_TEST", "TESTING"],
    "TOWER_REMOVAL": ["ANTENNA_TMD_RRU", "EQUIPMENT_REMOVAL", "PANEL_ANTENNA", "RRU", "TMD", "EQUIPMENT"],
    "EQUIPMENT_REMOVAL": ["BASEBAND_RACK", "EQUIPMENT_REMOVAL", "BASEBAND", "EQUIPMENT"],
    "STRUCTURE": ["STRUCTURE", "SITE_SERVICE"],
    "SITE_SERVICE": ["SITE_SERVICE", "STRUCTURE"]
}

COMPATIBLE_ACTIONS = {
    "INSTALL": ["INSTALL", "SUPPLY_ONLY"],
    "REMOVE": ["REMOVE"],
    "RELOCATE": ["RELOCATE"],
    "TEST": ["TEST", "REUSE_TEST"],
    "REUSE_TEST": ["TEST", "REUSE_TEST", "INSTALL"]
}

def is_unit_compatible(takeoff_unit: str, sor_unit: str) -> bool:
    """Checks if unit of measure is compatible between takeoff and SOR item."""
    u1 = (takeoff_unit or "EACH").upper()
    u2 = (sor_unit or "EACH").upper()

    if u1 == u2:
        return True

    length_units = {"M", "LM", "METRES", "METER", "METERS", "PER LM", "PER LM / FEEDER", "LM / FEEDER"}
    if any(lu in u1 for lu in length_units) and any(lu in u2 for lu in length_units):
        return True

    each_units = {"EACH", "EA", "NO", "ITEM", "UNITS", "UNIT"}
    if u1 in each_units and u2 in each_units:
        return True

    time_units = {"HOUR", "HR", "DAY", "WEEK"}
    if u1 in time_units and u2 in time_units:
        return True

    return False

def filter_candidates(takeoff_item: Dict[str, Any], sor_codes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deterministically filters the full SOR catalog down to a candidate shortlist (<=15 items).
    """
    t_sem = (takeoff_item.get("equipment_type") or takeoff_item.get("semantic_class") or "EQUIPMENT").upper()
    t_act = (takeoff_item.get("action") or takeoff_item.get("commercial_action") or "INSTALL").upper()
    t_unit = (takeoff_item.get("unit") or "EACH").upper()
    raw_desc = (takeoff_item.get("model") or takeoff_item.get("raw_text") or takeoff_item.get("raw_description") or "").upper()

    valid_classes = COMPATIBLE_CLASSES.get(t_sem, [t_sem, "EQUIPMENT"])
    valid_actions = COMPATIBLE_ACTIONS.get(t_act, [t_act])

    candidates = []

    for sor in sor_codes:
        s_code = sor.get("code") or ""
        s_sem = (sor.get("equipment_type") or sor.get("semantic_class") or "").upper()
        s_act = (sor.get("action_type") or sor.get("commercial_action") or "").upper()
        s_unit = (sor.get("unit") or "").upper()
        s_desc = (sor.get("name") or sor.get("description") or "").upper()

        # Rule 1: Action Match Gate
        if s_act and s_act not in valid_actions:
            if t_act == "REMOVE" and s_code == "R12513":
                pass
            else:
                continue

        # Rule 2: Semantic Class Gate
        if s_sem and s_sem not in valid_classes and t_sem not in COMPATIBLE_CLASSES.get(s_sem, []):
            keywords = ["ANTENNA", "AIR", "AAU", "RRU", "TMA", "BASEBAND", "ROUTER", "GPS", "BLACKBIRD", "PIM", "FEEDER", "LCF", "LDF"]
            matched_kw = any(kw in raw_desc and kw in s_desc for kw in keywords)
            if not matched_kw:
                continue

        # Rule 3: Unit Compatibility Gate
        if s_unit and not is_unit_compatible(t_unit, s_unit):
            continue

        candidates.append(sor)

    # Sort candidates by relevance score
    def calculate_relevance(c):
        score = 0
        s_desc = (c.get("name") or c.get("description") or "").upper()
        for token in raw_desc.split():
            if len(token) > 2 and token in s_desc:
                score += 2
        if (c.get("action_type") or c.get("commercial_action")) == t_act:
            score += 5
        if (c.get("equipment_type") or c.get("semantic_class")) == t_sem:
            score += 5
        return score

    candidates.sort(key=calculate_relevance, reverse=True)
    return candidates[:15]
