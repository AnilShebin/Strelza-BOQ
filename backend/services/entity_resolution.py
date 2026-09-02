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


def extract_action_and_qty(raw_text: str, default_action: str = "INSTALL") -> Tuple[str, float]:
    """
    Deterministically parses action (INSTALL, REMOVE, RELOCATE, REPLACE) and quantity from statement text.
    """
    text_upper = raw_text.upper()
    
    # 1. Action determination
    action = default_action
    if any(w in text_upper for w in ["RECOVER AND REPLACE", "REPLACE", "REPLACED WITH"]):
        action = "REPLACE"
    elif any(w in text_upper for w in ["REMOVE", "REMOVAL", "RECOVER", "DECOMMISSION", "DISMANTLE", "DE-RIG"]):
        action = "REMOVE"
    elif any(w in text_upper for w in ["RELOCATE", "RELOCATION", "MOVE", "RE-LOCATE"]):
        action = "RELOCATE"
    elif any(w in text_upper for w in ["INSTALL", "PROPOSED", "NEW", "ADD", "SUPPLY AND INSTALL"]):
        action = "INSTALL"
    elif any(w in text_upper for w in ["EXISTING", "TO REMAIN", "RETAIN"]):
        action = "RETAIN"

    # 2. Quantity extraction
    qty = 1.0
    # Match patterns like "3 OFF", "3x", "3 NO.", "QTY: 3", "(3 OFF)"
    qty_match = re.search(r'\(?(\d+(?:\.\d+)?)\s*(?:OFF|X|QTY|NOS|NO\.)\b', text_upper)
    if qty_match:
        try:
            qty = float(qty_match.group(1))
        except ValueError:
            qty = 1.0
    else:
        # Match standalone number before equipment (e.g. "INSTALL 3 ERICSSON...")
        lead_match = re.search(r'\b(?:INSTALL|REMOVE|RECOVER)\s+(\d+(?:\.\d+)?)\s+', text_upper)
        if lead_match:
            try:
                qty = float(lead_match.group(1))
            except ValueError:
                qty = 1.0

    return action, qty


def extract_physical_id(text: str) -> str:
    """Extracts physical identifiers like Antenna IDs (A1, A5, A15), Sector (S1, S2), or Row IDs (16, 34)."""
    # Match Antenna IDs like A1, A5, A9, A15
    ant_match = re.search(r'\b(A\d+)\b', text, re.IGNORECASE)
    if ant_match:
        return ant_match.group(1).upper()
        
    # Match "with ID 16" or "ITEM 34"
    id_match = re.search(r'\b(?:ID|ITEM|NO\.)\s*[:#]?\s*(\w+)\b', text, re.IGNORECASE)
    if id_match:
        return id_match.group(1).upper()
        
    return ""


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
    - Quantities are summed accurately.
    - Sources and provenances are merged into a comprehensive audit trail.
    """
    grouped: Dict[str, Dict[str, Any]] = {}
    
    for item in entities:
        # Ignore existing/retain items from BOQ pricing
        if item["action"] == "RETAIN":
            continue
            
        canonical_id = item["canonical_id"]
        action = item["action"]
        physical_id = item.get("physical_id", "")
        
        # If item has a specific physical ID (e.g. A1, A5, ID 34), group by that ID to deduplicate notes vs tables
        if physical_id:
            group_key = f"PHY_{physical_id}|{action}"
        else:
            # Otherwise, distinguish by unique row provenance
            prov = item.get("provenance", {})
            group_key = f"{canonical_id}|{action}|{prov.get('source_sheet', '')}|{prov.get('source_row', '')}"
            
        if group_key not in grouped:
            grouped[group_key] = {
                "canonical_id": canonical_id,
                "model_name": item["model_name"],
                "equipment_class": item["equipment_class"],
                "category": item["category"],
                "action": action,
                "quantity": float(item["quantity"]),
                "physical_id": physical_id,
                "attributes": item["attributes"],
                "is_known_equipment": item["is_known_equipment"],
                "original_statement": item["original_statement"],
                "sources": [item]
            }
        else:
            # Merge duplicate occurrence
            existing = grouped[group_key]
            existing["sources"].append(item)
            
            # If incoming item has a known specific canonical ID, upgrade existing record
            if item["is_known_equipment"] and not existing["is_known_equipment"]:
                existing["canonical_id"] = item["canonical_id"]
                existing["model_name"] = item["model_name"]
                existing["equipment_class"] = item["equipment_class"]
                existing["category"] = item["category"]
                existing["attributes"] = item["attributes"]
                existing["is_known_equipment"] = True
            
            # If the duplicate is a note that merely references the table, do not double-count quantity
            # Table items take precedence
            is_table_existing = any(s.get("provenance", {}).get("source_table") != "DRAWING NOTES" for s in existing["sources"][:-1])
            is_note_incoming = item.get("provenance", {}).get("source_table") == "DRAWING NOTES"
            
            if not (is_table_existing and is_note_incoming):
                # Distinct physical occurrence: add quantity
                existing["quantity"] += float(item["quantity"])

    return list(grouped.values())
