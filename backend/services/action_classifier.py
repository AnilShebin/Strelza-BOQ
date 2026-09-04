"""
Action Classifier Service.
Implements the Terminal Operative Verb principle for engineering drawings.
Distinguishes billable actions (such as 'EXISTING ... TO BE RECOVERED') from passive site context (such as 'EXISTING SIGN SECURED TO BARRIER').
"""

import re
from typing import Tuple, Optional


# Terminal operative phrases that define actual commercial scope
REMOVAL_PATTERNS = [
    r'\bTO\s+BE\s+RECOVERED\b',
    r'\bTO\s+BE\s+REMOVED\b',
    r'\bTO\s+BE\s+DECOMMISSIONED\b',
    r'\bTO\s+BE\s+DISMANTLED\b',
    r'\bTO\s+BE\s+DEMOLISHED\b',
    r'\bTO\s+BE\s+SCRAPPED\b',
    r'\bTO\s+BE\s+DE-RIGGED\b',
    r'\bTO\s+BE\s+STRIPPED\b',
    r'\bRECOVER\s+AND\s+SCRAP\b',
    r'\bREMOVAL\s+OF\b',
    r'\bDECOMMISSION(?:ING)?\b',
    r'\bDISMANTLE\b',
    r'\bDEMOLISH\b',
    r'\bRECOVER\b',
    r'\bREMOVE\b',
]

RELOCATE_PATTERNS = [
    r'\bTO\s+BE\s+(?:REUSED\s+AND\s+)?RELOCATED\b',
    r'\bRELOCAT(?:ED|E|ION)\b',
    r'\bRE-LOCAT(?:ED|E|ION)\b',
    r'\bTO\s+BE\s+SHIFTED\b',
    r'\bTO\s+BE\s+MOVED\b',
    r'\bRELOCATION\s+OF\b',
    r'\bSHIFT\b',
]

REPLACE_PATTERNS = [
    r'\bTO\s+BE\s+REPLACED\b',
    r'\bRECOVER\s+AND\s+REPLACE\b',
    r'\bREPLACE\s+WITH\b',
    r'\bREPLACE\b',
    r'\bSWAP\b',
    r'\bCHANGE\s+OUT\b',
]

INSTALL_PATTERNS = [
    r'\bTO\s+BE\s+INSTALLED\b',
    r'\bTO\s+BE\s+ERECTED\b',
    r'\bTO\s+BE\s+MOUNTED\b',
    r'\bTO\s+BE\s+COMMISSIONED\b',
    r'\bTO\s+BE\s+RUN\b',
    r'\bSUPPLY\s+AND\s+INSTALL\b',
    r'\bPROPOSED\b',
    r'\bNEW\b',
    r'\bINSTALL(?:ATION)?\b',
    r'\bADD\b',
    r'\bFIT\b',
]

RETAIN_PATTERNS = [
    r'\bTO\s+BE\s+REUSED\b',
    r'\bTO\s+BE\s+RETAINED\b',
    r'\bTO\s+REMAIN\b',
    r'\bEXISTING\s+TO\s+REMAIN\b',
    r'\bREMAIN\s+IN\s+PLACE\b',
    r'\bREUSE\b',
    r'\bRETAIN\b',
]

PASSIVE_CONTEXT_KEYWORDS = [
    r'\bEXISTING\b',
    r'\bEXISTNG\b',
    r'\bLEASE\s+AREA\b',
    r'\bSURROUNDING\b',
    r'\bROOF\s+LEVEL\b',
    r'\bMETAL\s+SHEETING\b',
    r'\bCONCRETE\b',
    r'\bSAFETY\s+CHAIN\b',
    r'\bBARRIER\b',
    r'\bDRAIN\b',
    r'\bBOLLARD\b',
    r'\bLADDER\b',
    r'\bHANDRAIL\b',
    r'\bWARNING\s+SIGN\b',
    r'\bSIGN\s+SECURED\b',
    r'\bACCESS\s+DOOR\b',
    r'\bPLANT\s+ROOM\b',
    r'\bENCLOSURE\b',
    r'\bTYP\b',
    r'\bTYPICAL\b',
]


def classify_commercial_action(raw_text: str, default_action: str = "INSTALL") -> Tuple[str, bool, str]:
    """
    Classifies the commercial intent of a statement or table row using the
    Terminal Operative Verb Principle.

    Returns:
        Tuple[action, is_billable, reason]
        action: 'INSTALL', 'REMOVE', 'RELOCATE', 'REPLACE', 'RETAIN', 'PASSIVE_CONTEXT'
        is_billable: True for INSTALL, REMOVE, RELOCATE, REPLACE. False for RETAIN, PASSIVE_CONTEXT.
        reason: Explanation of the matched pattern.
    """
    if not raw_text:
        return default_action, default_action in ["INSTALL", "REMOVE", "RELOCATE", "REPLACE"], "default"

    text = raw_text.strip().upper()

    # Priority 1: Check for explicit terminal operative actions.
    # Terminal actions (like 'TO BE RECOVERED' or 'TO BE INSTALLED') OVERRIDE any 'EXISTING' prefix.
    
    # 1A. Replacement (e.g. "REPLACE", "RECOVER AND REPLACE")
    for pat in REPLACE_PATTERNS:
        m = re.search(pat, text)
        if m:
            return "REPLACE", True, f"Matched replacement operative: '{m.group(0)}'"

    # 1B. Removal / Recovery (e.g. "EXISTING ... TO BE RECOVERED")
    for pat in REMOVAL_PATTERNS:
        m = re.search(pat, text)
        if m:
            return "REMOVE", True, f"Matched removal operative: '{m.group(0)}'"

    # 1C. Relocation (e.g. "EXISTING ... TO BE RELOCATED")
    for pat in RELOCATE_PATTERNS:
        m = re.search(pat, text)
        if m:
            return "RELOCATE", True, f"Matched relocation operative: '{m.group(0)}'"

    # 1D. Installation (e.g. "PROPOSED ... TO BE INSTALLED")
    for pat in INSTALL_PATTERNS:
        m = re.search(pat, text)
        if m:
            return "INSTALL", True, f"Matched installation operative: '{m.group(0)}'"

    # 1E. Retain / Reuse (e.g. "TO BE REUSED", "EXISTING TO REMAIN")
    for pat in RETAIN_PATTERNS:
        m = re.search(pat, text)
        if m:
            return "RETAIN", False, f"Matched retention operative: '{m.group(0)}'"

    # Priority 2: If NO operative verb was found, check if it is purely passive site context
    # (e.g. "EXISTING SIGN SECURED TO SAFETY CHAIN BARRIER USING STAINLESS STEEL STRAPS")
    for pat in PASSIVE_CONTEXT_KEYWORDS:
        if re.search(pat, text):
            return "PASSIVE_CONTEXT", False, "Passive site infrastructure with no operative action"

    # Default fallback
    is_billable = default_action in ["INSTALL", "REMOVE", "RELOCATE", "REPLACE"]
    return default_action, is_billable, "Default fallback"
