"""
Parser Rules.
Loads and defines keyword configurations, thresholds, and categories for identifying
telecom items and actions (Install, Remove, Relocate, etc.).
"""
import json
import os
import re
from typing import Dict, List, Any

# Rules File resolution
RULES_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "mapping_rules.json")

# Default Global Fallbacks
INSTALL_KEYWORDS = ["PROPOSED", "TO BE INSTALLED", "INSTALL", "INSTALLED", "NEW", "ADDITIONAL"]
REMOVE_KEYWORDS = ["TO BE RECOVERED", "TO BE RECOVERD", "TO BE REMOVED", "RECOVERED", "REMOVE", "REMOVED", "RECOVER", "DECOMMISSION", "DISMANTLED"]
REPLACE_KEYWORDS = ["TO BE REPLACED", "REPLACED", "REPLACE"]
RELOCATE_KEYWORDS = ["TO BE RELOCATED", "RELOCATED", "RELOCATE", "TO BE MODIFIED", "MODIFIED", "MODIFY", "TO BE MOVED", "MOVED", "MOVE", "TO BE RAISED", "RAISED", "RAISE"]
EXISTING_KEYWORDS = ["EXISTING", "TO REMAIN"]

ANTENNA_THRESHOLDS = {
    "5g_max_height_mm": 1000,
    "4g_min_height_mm": 1500,
    "5g_model_indicators": ["AIR", "AAU"]
}

EQUIPMENT_KEYWORDS = {
    "4G Panel Antenna": ["PANEL ANTENNA", "PANEL ANTENNAS", "ANTENNA", "ANTENNAS", "PANEL", "OMNI", "ACTIVE", "AIR"],
    "5G AAU": ["5G AAU", "AAU"],
    "REMOTE RADIO UNIT": ["RADIO", "RRU", "RRUS", "RUS", "REMOTE RADIO UNIT"],
    "TOWER MOUNTED AMPLIFIER": ["TMA", "TMAS", "TMA'S", "TOWER MOUNTED AMPLIFIER", "TOWER MOUNTED DEVICE"],
    "FILTER_COMBINER": ["FILTER", "COMBINER", "MHA", "MHAS"],
    "JUNCTION BOX": ["JUNCTION BOX", "JUNCTION BOXES", "JBOX", "JMC", "INTERFACE JUNCTION BOX", "W&B", "SAMSUNG W&B"],
    "FEEDERS": ["FEEDER", "FEEDERS", "COAX", "COAXIAL"],
    "HYBRID_CABLE": ["HYBRID", "HYBRID CABLE", "HYBRID CABLES", "TRUNK CABLE", "TRUCK CABLE"]
}

VALID_TELECOM_KEYWORDS: List[str] = []
CUSTOM_KEYWORDS: List[str] = []
DRAWING_STAMPS_TO_IGNORE: List[str] = []
MODEL_PATTERNS: List[str] = []

def load_rules_config() -> None:
    """Loads configuration overrides from mapping_rules.json file."""
    global INSTALL_KEYWORDS, REMOVE_KEYWORDS, REPLACE_KEYWORDS, RELOCATE_KEYWORDS, EXISTING_KEYWORDS
    global ANTENNA_THRESHOLDS, EQUIPMENT_KEYWORDS, VALID_TELECOM_KEYWORDS
    global CUSTOM_KEYWORDS, DRAWING_STAMPS_TO_IGNORE, MODEL_PATTERNS
    
    custom_kws_fallback = ["ERICSSON", "TELSTRA", "ELTEK", "VERTIV", "EATON", "PATHFINDER", "RGL-091", "DECON", "SAMSUNG", "OPTUS", "VODAFONE", "KAELUS", "ARGUS", "KATHREIN", "COMMSCOPE", "RFS"]
    stamps_fallback = ["AS BUILT STRUCTURAL & EME COMPLIANCE", "AS BUILT STRUCTURAL AND EME COMPLIANCE", "DESIGN ALTERATIONS", "ALTERATIONS IN RED", "COMPLIANCE BOX", "DO NOT SCALE"]
    model_patterns_fallback = [
        r'\b(?:AIR\d{4}|RBS\d{4}|BB\d{4}|RP\d{4})\b',
        r'\b(?:RADIO\s+\d{4}(?:\s+[A-Z0-9/]+)?)\b',
        r'\b(?:FP2\s+HE|FP2)\b',
        r'\b(?:VERTIV\s+DC-DC|DC-DC\s+CONVERTERS)\b',
        r'\b(?:C48/48-\w+)\b',
        r'\b\d+RU\b'
    ]
    
    if os.path.exists(RULES_FILE):
        try:
            with open(RULES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            actions = data.get("actions", {})
            INSTALL_KEYWORDS = actions.get("INSTALL", INSTALL_KEYWORDS)
            REMOVE_KEYWORDS = actions.get("REMOVE", REMOVE_KEYWORDS)
            REPLACE_KEYWORDS = actions.get("REPLACE", REPLACE_KEYWORDS)
            RELOCATE_KEYWORDS = actions.get("RELOCATE", RELOCATE_KEYWORDS)
            EXISTING_KEYWORDS = actions.get("EXISTING", EXISTING_KEYWORDS)
            
            ANTENNA_THRESHOLDS = data.get("antenna_thresholds", ANTENNA_THRESHOLDS)
            EQUIPMENT_KEYWORDS = data.get("categories", EQUIPMENT_KEYWORDS)
            
            CUSTOM_KEYWORDS = data.get("custom_keywords", custom_kws_fallback)
            DRAWING_STAMPS_TO_IGNORE = data.get("drawing_stamps_to_ignore", stamps_fallback)
            MODEL_PATTERNS = data.get("model_patterns", model_patterns_fallback)
        except Exception as e:
            print(f"[Parser Rules] Error loading mapping_rules.json: {e}")
            CUSTOM_KEYWORDS = custom_kws_fallback
            DRAWING_STAMPS_TO_IGNORE = stamps_fallback
            MODEL_PATTERNS = model_patterns_fallback
    else:
        CUSTOM_KEYWORDS = custom_kws_fallback
        DRAWING_STAMPS_TO_IGNORE = stamps_fallback
        MODEL_PATTERNS = model_patterns_fallback
            
    keywords_set = set()
    for cat, kws in EQUIPMENT_KEYWORDS.items():
        for kw in kws:
            words = kw.split()
            if words:
                keywords_set.add(words[0].upper())
                
    additional_terms = [
        "DRWN", "CHKD", "AMENDMENT", "EXAM", "APPD", "DATE", "INSTALLED", "RECOVERED", "RELOCATED",
        "DECOMMISSIONED", "RECOVER", "REMOVE", "FIBRE", "OPTIC", "PIT", "CONDUIT", "COAX", "COAXIAL",
        "SIGN", "SIGNS", "BEAM", "STEEL", "AIRCON", "SHELTER", "SHELTERS", "GRILLAGE", "PLATFORM",
        "STAIRS", "LADDER", "LADDERS", "WALKWAY", "WALKWAYS", "LOCK", "BARRIER", "FENCE", "SUPPORT",
        "MOUNT", "MOUNTS", "BRACKET", "BRACKETS", "POLE", "POLES", "CABLE", "CABLES", "TRAY", "TRAYS",
        "JUMPER", "JUMPERS", "EARTH", "METER", "RACK", "RACKS", "SPD", "GPS", "BATTERY", "BATTERIES",
        "POWER", "SYSTEM", "RF", "FEEDER", "FEEDERS"
    ]
    for term in additional_terms:
        keywords_set.add(term)
        
    for kw in CUSTOM_KEYWORDS:
        keywords_set.add(kw.upper())
        
    # Add action keywords to validation list, excluding short helper words like "TO"
    for act_name, kws in [
        ("INSTALL", INSTALL_KEYWORDS),
        ("REMOVE", REMOVE_KEYWORDS),
        ("REPLACE", REPLACE_KEYWORDS),
        ("RELOCATE", RELOCATE_KEYWORDS),
        ("EXISTING", EXISTING_KEYWORDS)
    ]:
        for kw in kws:
            words = kw.split()
            for w in words:
                w_upper = w.upper()
                if len(w_upper) >= 4 and w_upper not in ["BEND", "WITH"]:
                    keywords_set.add(w_upper)
        
    VALID_TELECOM_KEYWORDS = list(keywords_set)

# Load configuration on module import
load_rules_config()

def is_valid_telecom_item(text: str) -> bool:
    """Filters out background text noise (dates, drawing indexes, compliance scales)."""
    if not text:
        return False
    cleaned = re.sub(r'\s+', ' ', text).strip().upper()
    
    if len(cleaned) < 5:
        return False
    if re.match(r'^\d+$', cleaned):
        return False
    if re.match(r'^\d{2}/\d{2}/\d{2}$', cleaned) or re.match(r'^\d{2}/\d{2}/\d{4}$', cleaned):
        return False
        
    for stamp in DRAWING_STAMPS_TO_IGNORE:
        if stamp.upper() in cleaned:
            return False
            
    return any(kw in cleaned for kw in VALID_TELECOM_KEYWORDS)
