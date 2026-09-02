"""
Parser Module.
Provides sentence splitting, action extraction, quantity matching,
and mapping of raw text notes to structured items.
"""
import re
from typing import List, Dict, Any, Optional
from processors.parser_rules import (
    INSTALL_KEYWORDS, REMOVE_KEYWORDS, REPLACE_KEYWORDS, RELOCATE_KEYWORDS,
    EXISTING_KEYWORDS, ANTENNA_THRESHOLDS, EQUIPMENT_KEYWORDS, is_valid_telecom_item,
    MODEL_PATTERNS
)

def clean_text(text: str) -> str:
    """Collapses duplicate whitespace from a text block."""
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def split_sentences_with_multiple_items(text: str) -> List[str]:
    """Splits a text clause containing multiple distinct quantity indicators (e.g. '&')."""
    text = clean_text(text)
    off_markers = list(re.finditer(r'\(\s*\d+\s*OFF[^\)]*\)', text, re.IGNORECASE))
    if len(off_markers) <= 1:
        return [text]
        
    parts = []
    last_idx = 0
    for i in range(len(off_markers) - 1):
        start_curr = off_markers[i].end()
        start_next = off_markers[i+1].start()
        gap = text[start_curr:start_next]
        conj_match = re.search(r'\s+(&|and|AND)\s+', gap)
        if conj_match:
            split_point = start_curr + conj_match.start()
            parts.append(text[last_idx:split_point].strip())
            last_idx = start_curr + conj_match.end()
            
    parts.append(text[last_idx:].strip())
    
    # Prepend prefix or append trailing context to split clauses
    reconstructed_parts = []
    last_part = parts[-1]
    verb_phrases = ["TO BE INSTALLED", "TO BE RECOVERED", "TO BE RELOCATED", "ON EXISTING MOUNTS", "ON EXISTING RELOCATED MOUNTS"]
    
    found_verb = None
    for vp in verb_phrases:
        if vp in last_part.upper():
            idx = last_part.upper().find(vp)
            found_verb = last_part[idx:]
            break
            
    first_part = parts[0]
    leading_prefixes = ["PROPOSED", "EXISTING", "NEW", "REMOVE", "REPLACE", "RELOCATE"]
    found_prefix = None
    for lp in leading_prefixes:
        if first_part.upper().startswith(lp):
            found_prefix = lp
            break
            
    for idx, p in enumerate(parts):
        reconstructed = p
        if idx > 0 and found_prefix and not p.upper().startswith(found_prefix):
            reconstructed = found_prefix + " " + reconstructed
        if idx < len(parts) - 1 and found_verb and not any(vp in p.upper() for vp in verb_phrases):
            reconstructed = reconstructed + " " + found_verb
        reconstructed_parts.append(reconstructed)
        
    return reconstructed_parts

def parse_action(text: str) -> str:
    """Extracts activity action (INSTALL, REMOVE, REPLACE, RELOCATE, EXISTING)."""
    upper_text = text.upper()
    if any(k in upper_text for k in REPLACE_KEYWORDS):
        return "REPLACE"
    if any(k in upper_text for k in REMOVE_KEYWORDS):
        return "REMOVE"
    if any(k in upper_text for k in RELOCATE_KEYWORDS):
        return "RELOCATE"
        
    # Check for proposed testing/work keywords to prevent them from being classified as EXISTING
    PROPOSED_WORK_KEYWORDS = ["TEST", "TESTING", "PIM", "SWEEP", "SLAB", "AUDIT", "SURVEY", "UPGRADE", "STRENGTHEN"]
    if any(k in upper_text for k in PROPOSED_WORK_KEYWORDS):
        return "INSTALL"
        
    if any(k in upper_text for k in INSTALL_KEYWORDS):
        return "INSTALL"
    if any(k in upper_text for k in EXISTING_KEYWORDS):
        return "EXISTING"
    return "INSTALL" if "PROPOSED" in upper_text else "EXISTING"

def parse_sectors(text: str) -> List[str]:
    """Matches sector labels (e.g. A1, A2, A3)."""
    matches = re.findall(r'\b([A-Z]\d+)\b', text)
    seen = set()
    return [m for m in matches if not (m in seen or seen.add(m))]

def parse_quantity(text: str) -> int:
    """Parses unit quantity, falling back to sector count or 1."""
    qty_match = re.search(r'\(?\s*(\d+)\s*(?:OFF|PCS|QTY|OFF\s+ABOVE|OFF\s+BELOW|OFF\s+A\d+)\s*\)?', text, re.IGNORECASE)
    if qty_match:
        return int(qty_match.group(1))
    x_match = re.search(r'\b(\d+)\s*[xX]\b', text)
    if x_match:
        return int(x_match.group(1))
    sectors = parse_sectors(text)
    if sectors:
        return len(sectors)
    return 1

def parse_antenna_height_mm(text: str) -> Optional[float]:
    """Extracts antenna height or length dimension in mm."""
    match = re.search(r'(\d+(?:\.\d+)?)\s*(?:MM|M)?\s*[xX]', text.upper())
    if match:
        val = float(match.group(1))
        return val * 1000.0 if val < 10.0 else val
    match_mm = re.search(r'\b(\d{3,4})\s*MM\b', text, re.IGNORECASE)
    return float(match_mm.group(1)) if match_mm else None

def parse_equipment_type(text: str, force_antenna: bool = False) -> str:
    """Maps equipment to its matching categories dynamically using config keywords."""
    upper_text = text.upper()
    for category, keywords in EQUIPMENT_KEYWORDS.items():
        if any(k in upper_text for k in keywords):
            canonical_mapping = {
                "4G Panel Antenna": "ANTENNA",
                "5G AAU": "ANTENNA",
                "REMOTE RADIO UNIT": "RRU",
                "TOWER MOUNTED AMPLIFIER": "TMA_FILTER",
                "FILTER_COMBINER": "TMA_FILTER",
                "JUNCTION BOX": "EQUIPMENT",
                "FEEDERS": "EQUIPMENT",
                "HYBRID_CABLE": "EQUIPMENT"
            }
            return canonical_mapping.get(category, category)
    return "OTHER"

def parse_equipment_model(text: str) -> str:
    """Extracts manufacturer details and product models from code using rules-configured patterns."""
    found_models = []
    for pattern in MODEL_PATTERNS:
        try:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                found_models.extend(matches)
        except Exception:
            pass
            
    if found_models:
        return ", ".join(found_models).upper()
        
    # Generic alphanumeric model fallback:
    # Extracts code-like tokens (e.g. RBS6102, AIR3258, LCF78-50JA)
    # excluding generic verbs, quantity indicators, or sector references.
    generic_codes = re.findall(r'\b(?:[A-Z]+[0-9]+[A-Z0-9-]*|[0-9]+[A-Z]+[A-Z0-9-]*)\b', text)
    filtered_codes = []
    ignored_codes = ["INSTALL", "REMOVE", "REPLACE", "RELOCATE", "EXISTING", "PROPOSED", "REUSE", "RECOVER"]
    for code in generic_codes:
        if code.upper() not in ignored_codes and not re.match(r'^[A-Z]\d+$', code): # skip sectors like A1, B2
            filtered_codes.append(code.upper())
            
    if filtered_codes:
        return ", ".join(filtered_codes)
        
    cleaned = text
    all_keywords = RELOCATE_KEYWORDS + REMOVE_KEYWORDS + INSTALL_KEYWORDS + EXISTING_KEYWORDS
    for kw in all_keywords:
        cleaned = re.sub(re.escape(kw), '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\(\s*\d+\s*OFF[^\)]*\)', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\b\d+\s*OFF\b', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\(\s*[A-Z]\d+.*?\)', '', cleaned)
    return clean_text(cleaned)

def parse_line_to_item(text: str, page_num: int = 1, bbox: Optional[List[float]] = None, split_items: bool = True) -> List[Dict[str, Any]]:
    """Transforms a single text block into structured dictionary records."""
    if not is_valid_telecom_item(text):
        return []
    clauses = split_sentences_with_multiple_items(text) if split_items else [text]
    items = []
    for cl in clauses:
        items.append({
            "raw_text": cl,
            "clean_text": cl,
            "source_sheet": f"Sheet {page_num}",
            "action": parse_action(cl),
            "quantity": parse_quantity(cl),
            "sectors": parse_sectors(cl),
            "equipment_type": parse_equipment_type(cl),
            "model": parse_equipment_model(cl),
            "bbox": bbox,
            "page": page_num
        })
    return items

def extract_raw_items_from_elements(elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Converts extracted visual layout elements (structured/unstructured) into raw equipment items."""
    raw_items = []
    
    for el in elements:
        el_type = el.get("type", "")
        page_num = el.get("page", 1)
        bbox = el.get("bbox")
        
        if el_type == "unstructured":
            # For unstructured elements, the content is a plain string
            content = el.get("content", "")
            if isinstance(content, str) and content.strip():
                parsed = parse_line_to_item(content, page_num=page_num, bbox=bbox)
                for item in parsed:
                    item["raw_text"] = f"Drawing Note: {item['raw_text']}"
                    raw_items.append(item)
                    
        elif el_type == "structured":
            # For structured elements, content can be key-value fields or tables (headers + rows)
            content = el.get("content", {})
            if isinstance(content, dict):
                # Scenario A: Key-value fields
                if "fields" in content and isinstance(content["fields"], dict):
                    for key, val in content["fields"].items():
                        if key and val:
                            pair_str = f"{key}: {val}"
                            parsed = parse_line_to_item(pair_str, page_num=page_num, bbox=bbox)
                            for item in parsed:
                                item["raw_text"] = f"Table Key-Value: {item['raw_text']}"
                                raw_items.append(item)
                
                # Scenario B: Table grid (headers + rows)
                if "rows" in content and isinstance(content["rows"], list):
                    headers = content.get("headers", [])
                    # Join rows
                    for row in content["rows"]:
                        if isinstance(row, list):
                            row_str = " | ".join([str(cell) for cell in row if cell])
                            if not row_str:
                                continue
                            # Skip if it is a header repeated row
                            if any(h and h.upper() in row_str.upper() for h in headers if h and len(h) > 2) and "PROPOSED" in row_str.upper() and "EXISTING" in row_str.upper():
                                continue
                            parsed = parse_line_to_item(row_str, page_num=page_num, bbox=bbox)
                            for item in parsed:
                                item["raw_text"] = f"Table Row: {item['raw_text']}"
                                raw_items.append(item)
                                
    return raw_items
