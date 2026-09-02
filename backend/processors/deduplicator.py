"""
Deduplicator Module.
Provides cross-sheet note deduplication and item consolidation to avoid double-counting
equipment listed across layout diagrams, tables, and elevations.
"""
import re
from typing import List, Dict, Any, Set
from rapidfuzz import fuzz

def extract_antenna_identifiers(text: str) -> Set[str]:
    """Matches antenna labels like A1, A2, A1 (OLD), A3 (OLD), etc."""
    if not text:
        return set()
    return set(re.findall(r'\b[A-Z]\d+(?:\s*\(OLD\))?\b', text.upper()))

def are_items_similar(item1: Dict[str, Any], item2: Dict[str, Any], threshold: float = 85.0) -> bool:
    """Checks if two equipment items match by comparing their models or raw descriptions."""
    if item1["equipment_type"] != item2["equipment_type"]:
        return False
        
    m1 = item1["model"] or ""
    m2 = item2["model"] or ""
    if not m1 and not m2:
        return fuzz.token_sort_ratio(item1["raw_text"], item2["raw_text"]) >= threshold
        
    return fuzz.token_sort_ratio(m1.upper(), m2.upper()) >= threshold

def consolidate_items(parsed_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Groups similar items and sums/consolidates quantities based on sector overrides."""
    consolidated = []
    
    for item in parsed_items:
        matched = False
        for cons_item in consolidated:
            if item["action"] != cons_item["action"]:
                continue
                
            if are_items_similar(item, cons_item):
                # Combine source sheets
                sheets = [s.strip() for s in cons_item["source_sheet"].split(",")]
                if item["source_sheet"] not in sheets:
                    sheets.append(item["source_sheet"])
                cons_item["source_sheet"] = ", ".join(sorted(sheets))
                
                # Combine sectors list
                combined_sectors = list(set(cons_item["sectors"] + item["sectors"]))
                cons_item["sectors"] = sorted(combined_sectors)
                
                ant1 = extract_antenna_identifiers(cons_item["raw_text"])
                ant2 = extract_antenna_identifiers(item["raw_text"])

                # Check if items are from different source sheets
                sheets_cons = set(s.strip().upper() for s in cons_item["source_sheet"].split(","))
                sheets_item = set(s.strip().upper() for s in item["source_sheet"].split(","))
                has_sheet_overlap = bool(sheets_cons.intersection(sheets_item))

                if not has_sheet_overlap:
                    # Distinct sheets -> Sum quantities
                    cons_item["quantity"] += item["quantity"]
                elif ant1 and ant2 and not ant1.intersection(ant2):
                    cons_item["quantity"] += item["quantity"]
                elif len(cons_item["sectors"]) > 0 and len(item["sectors"]) > 0:
                    intersection = set(cons_item["sectors"]).intersection(set(item["sectors"]))
                    if intersection:
                        cons_item["quantity"] = max(cons_item["quantity"], item["quantity"])
                    else:
                        cons_item["quantity"] += item["quantity"]
                else:
                    cons_item["quantity"] = max(cons_item["quantity"], item["quantity"])
                    
                if item["raw_text"] not in cons_item["raw_text"]:
                    cons_item["raw_text"] += " || " + item["raw_text"]
                    
                matched = True
                break
                
        if not matched:
            consolidated.append(dict(item))
            
    return consolidated
