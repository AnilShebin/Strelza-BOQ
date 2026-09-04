"""
Fast Local Entity Resolution & Aggregation Engine.
Resolves drawing statements to canonical Equipment Master records in milliseconds,
performs deterministic deduplication across sheets, and matches to commercial price book items.
"""

import re
import json
from typing import Dict, Any, List, Optional, Tuple
from services.equipment_service import get_all_equipment, seed_default_equipment_catalog


class EntityResolver:
    """
    In-memory indexed entity resolver.
    Loads canonical equipment and aliases, then resolves statements via high-speed string and pattern matching.
    """
    def __init__(self):
        self._equipment_items: List[Dict[str, Any]] = []
        self._alias_map: List[Tuple[re.Pattern, Dict[str, Any]]] = []
        self.reload()

    def reload(self):
        """Reloads equipment catalog from SQLite and rebuilds the regex alias index."""
        # Ensure default seed exists
        seed_default_equipment_catalog(force=False)
        self._equipment_items = get_all_equipment(active_only=True)
        
        # Build patterns sorted by length descending so longer/more specific aliases match first
        alias_entries = []
        for eq in self._equipment_items:
            # Model name itself is an alias
            aliases = [eq["model_name"]] + eq.get("aliases", [])
            for alias in aliases:
                clean_alias = str(alias).strip()
                if not clean_alias:
                    continue
                # Create word-boundary pattern for exact/partial matching
                escaped = re.escape(clean_alias.upper())
                # Allow flexible whitespace and hyphens
                escaped = escaped.replace(r"\ ", r"\s+").replace(r"\-", r"[\-\s]?")
                pattern = re.compile(rf"\b{escaped}\b", re.IGNORECASE)
                alias_entries.append((len(clean_alias), pattern, eq))
                
        # Sort by longest alias first to guarantee most specific match
        alias_entries.sort(key=lambda x: x[0], reverse=True)
        self._alias_map = [(entry[1], entry[2]) for entry in alias_entries]

    def resolve_text(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Resolves raw statement or note text to a canonical equipment record in < 1ms.
        Returns the matched canonical equipment dict or None.
        """
        if not text:
            return None
            
        upper_text = text.upper()
        for pattern, eq in self._alias_map:
            if pattern.search(upper_text):
                return eq
        return None


# Global Singleton Resolver instance
_GLOBAL_RESOLVER = EntityResolver()

def get_entity_resolver() -> EntityResolver:
    return _GLOBAL_RESOLVER


from services.action_classifier import classify_commercial_action


def extract_action_and_qty(raw_text: str, default_action: str = "INSTALL") -> Tuple[str, float]:
    """
    Deterministically parses action (INSTALL, REMOVE, RELOCATE, REPLACE, RETAIN, PASSIVE_CONTEXT)
    and quantity from statement text using the Terminal Operative Verb Principle.
    """
    action, is_billable, reason = classify_commercial_action(raw_text, default_action=default_action)
    text_upper = raw_text.upper()

    # Quantity extraction
    qty = 1.0
    # Match patterns like "(3 OFF A1, A2 & A3)", "3 OFF", "3x", "3 NO.", "QTY: 3", "(3 OFF)"
    qty_match = re.search(r'\(?(\d+(?:\.\d+)?)\s*(?:OFF|X|QTY|NOS|NO\.)\b', text_upper)
    if qty_match:
        try:
            qty = float(qty_match.group(1))
        except ValueError:
            qty = 1.0
    else:
        # Match standalone number before equipment (e.g. "INSTALL 3 ERICSSON...")
        lead_match = re.search(r'\b(?:INSTALL|REMOVE|RECOVER|PROPOSED)\s+(\d+(?:\.\d+)?)\s+', text_upper)
        if lead_match:
            try:
                qty = float(lead_match.group(1))
            except ValueError:
                qty = 1.0

    return action, qty


def extract_all_physical_ids(text: str) -> List[str]:
    """
    Extracts all physical equipment tags from text, e.g.:
    '(3 OFF A1, A2 & A3)' -> ['A1', 'A2', 'A3']
    'A4 & A6' -> ['A4', 'A6']
    """
    if not text:
        return []

    # Find all antenna tags like A1, A2, A15, A1 (OLD), RRU-1, etc.
    matches = re.findall(r'\b(A\d+)\b', text, re.IGNORECASE)
    cleaned = []
    for m in matches:
        tag = m.upper()
        if tag not in cleaned:
            cleaned.append(tag)
            
    # Also check generic IDs like ID 16, ITEM 34
    if not cleaned:
        id_matches = re.findall(r'\b(?:ID|ITEM|NO\.)\s*[:#]?\s*(\w+)\b', text, re.IGNORECASE)
        for m in id_matches:
            tag = m.upper()
            if tag not in cleaned:
                cleaned.append(tag)

    return cleaned


def extract_physical_id(text: str) -> str:
    """Extracts primary physical identifier like Antenna ID (A1, A5) or Item ID."""
    all_ids = extract_all_physical_ids(text)
    return all_ids[0] if all_ids else ""



def resolve_drawing_statement(
    statement_text: str,
    provenance: Dict[str, Any],
    fallback_qty: float = 1.0,
    fallback_action: str = "INSTALL"
) -> Dict[str, Any]:
    """
    Resolves an extracted statement into a structured Canonical Resolved Entity.
    """
    resolver = get_entity_resolver()
    matched_eq = resolver.resolve_text(statement_text)
    
    parsed_action, parsed_qty = extract_action_and_qty(statement_text, default_action=fallback_action)
    qty = fallback_qty if fallback_qty > 1.0 and parsed_qty == 1.0 else parsed_qty
    physical_id = extract_physical_id(statement_text)
    
    if matched_eq:
        canonical_id = matched_eq["canonical_id"]
        model_name = matched_eq["model_name"]
        equipment_class = matched_eq["equipment_class"]
        category = matched_eq.get("category", "")
        attributes = matched_eq.get("attributes", {})
        is_known = True
    else:
        canonical_id = "EQ-UNKNOWN"
        model_name = statement_text[:60]
        equipment_class = "EQUIPMENT"
        category = "General"
        attributes = {}
        is_known = False

    return {
        "canonical_id": canonical_id,
        "model_name": model_name,
        "equipment_class": equipment_class,
        "category": category,
        "action": parsed_action,
        "quantity": qty,
        "physical_id": physical_id,
        "attributes": attributes,
        "original_statement": statement_text,
        "is_known_equipment": is_known,
        "provenance": provenance
    }


def aggregate_resolved_entities(entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Performs deterministic multi-source deduplication and aggregation:
    - Items with the same (canonical_id, action, physical_id) across different sheets are consolidated.
    - Passive context and non-billable items are excluded.
    - Configuration Table items establish canonical count; layout/elevation references attach as evidence.
    """
    grouped: Dict[str, Dict[str, Any]] = {}
    registered_tags: Dict[str, str] = {}  # tag -> canonical group key

    for item in entities:
        action = item.get("action", "INSTALL")
        # Ignore passive context and retain/existing items from BOQ pricing
        if action in ["RETAIN", "PASSIVE_CONTEXT"]:
            continue

        canonical_id = item.get("canonical_id", "EQ-UNKNOWN")
        physical_id = item.get("physical_id", "")
        all_tags = extract_all_physical_ids(item.get("original_statement", ""))
        prov = item.get("provenance", {})
        is_table = prov.get("source_table") != "DRAWING NOTES"

        # Check if this item references tags that are ALREADY accounted for by a table
        if not is_table and all_tags:
            already_registered = [t for t in all_tags if f"{t}|{action}" in registered_tags]
            if len(already_registered) == len(all_tags):
                # All referenced tags are already accounted for in the schedule table!
                # Attach this layout note as supporting evidence to each referenced entity
                for t in already_registered:
                    key = registered_tags[f"{t}|{action}"]
                    if key in grouped:
                        grouped[key]["sources"].append(item)
                continue

        # Build group key
        if physical_id:
            group_key = f"PHY_{physical_id}|{action}"
            registered_tags[f"{physical_id}|{action}"] = group_key
        else:
            group_key = f"{canonical_id}|{action}|{prov.get('source_sheet', '')}|{prov.get('source_row', '')}"

        if group_key not in grouped:
            grouped[group_key] = {
                "canonical_id": canonical_id,
                "model_name": item.get("model_name", ""),
                "equipment_class": item.get("equipment_class", "EQUIPMENT"),
                "category": item.get("category", "General"),
                "action": action,
                "quantity": float(item.get("quantity", 1.0)),
                "physical_id": physical_id,
                "attributes": item.get("attributes", {}),
                "is_known_equipment": item.get("is_known_equipment", False),
                "original_statement": item.get("original_statement", ""),
                "sources": [item]
            }
        else:
            existing = grouped[group_key]
            existing["sources"].append(item)

            if item.get("is_known_equipment") and not existing.get("is_known_equipment"):
                existing["canonical_id"] = canonical_id
                existing["model_name"] = item.get("model_name")
                existing["equipment_class"] = item.get("equipment_class")
                existing["category"] = item.get("category")
                existing["attributes"] = item.get("attributes")
                existing["is_known_equipment"] = True

            # If existing item is from a table and incoming is a drawing note, do not double count
            is_table_existing = any(s.get("provenance", {}).get("source_table") != "DRAWING NOTES" for s in existing["sources"][:-1])
            is_note_incoming = not is_table

            if not (is_table_existing and is_note_incoming):
                existing["quantity"] += float(item.get("quantity", 1.0))

    return list(grouped.values())
