"""
agent_tools.py - Tool Registry & Execution Dispatcher for Gemini Agent

Provides executable domain tools to the Gemini 3.8 Flash Agentic Estimator:
1. tool_lookup_price_book: Query SQLite price_items and 3-line rules.
2. tool_resolve_feeder_cable: Deterministic feeder diameter, multiplicity & extra-over logic.
3. tool_resolve_antenna: Height & tech classification (4G Panel vs 5G AAU).
4. tool_verify_commercial_basis: Mandatory self-check gate for FIRST vs EXTRA_OVER.
5. tool_verify_layout_callout: Cross-checks table counts against layout clouds/notes.
6. tool_get_estimator_precedents: Vector/token similarity query over human correction logs.
"""

import os
import re
import json
import sqlite3
from typing import Dict, Any, List, Optional

def get_db_path() -> str:
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "price_list.db")

def get_db_connection():
    db_path = get_db_path()
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

# -------------------------------------------------------------------------
# Tool 1: Lookup Price Book
# -------------------------------------------------------------------------
def tool_lookup_price_book(query: str = "", category: str = "", action: str = "") -> Dict[str, Any]:
    """Queries the SQLite Price Book for SOR items matching query words or category."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        sql = "SELECT id, code, name, unit, rate, category, mapping_rule FROM price_items WHERE 1=1"
        params = []
        
        if category and category.lower() != "all":
            sql += " AND (category LIKE ? OR category = '')"
            params.append(f"%{category}%")
            
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        conn.close()
        
        matches = []
        q_tokens = [t.lower() for t in query.split() if len(t) > 2] if query else []
        
        for r in rows:
            name_lower = (r["name"] or "").lower()
            code_lower = (r["code"] or "").lower()
            rule_lower = (r["mapping_rule"] or "").lower()
            
            score = 0
            if query:
                if query.lower() in code_lower:
                    score += 10
                if query.lower() in name_lower:
                    score += 5
                for tok in q_tokens:
                    if tok in code_lower:
                        score += 4
                    if tok in name_lower:
                        score += 2
                    if tok in rule_lower:
                        score += 1
            else:
                score = 1
                
            if score > 0 or not query:
                matches.append({
                    "score": score,
                    "id": r["id"],
                    "code": r["code"],
                    "name": r["name"],
                    "unit": r["unit"],
                    "rate": r["rate"],
                    "category": r["category"],
                    "mapping_rule": r["mapping_rule"]
                })
                
        matches.sort(key=lambda x: x["score"], reverse=True)
        top_matches = matches[:10]
        
        return {
            "status": "success",
            "count": len(top_matches),
            "items": [
                {
                    "row_idx": m["id"],
                    "code": m["code"],
                    "name": m["name"],
                    "unit": m["unit"],
                    "rate": m["rate"],
                    "rule": m["mapping_rule"]
                }
                for m in top_matches
            ]
        }
    except Exception as e:
        return {"status": "error", "message": f"Database query failed: {str(e)}"}

# -------------------------------------------------------------------------
# Tool 2: Resolve Feeder Cable Logic
# -------------------------------------------------------------------------
def tool_resolve_feeder_cable(model: str, runs: float = 1.0, route_length_m: Optional[float] = None) -> Dict[str, Any]:
    """
    Deterministically decodes feeder diameter, multiplicity (single, pair, three-pair),
    and extra over per lineal metre according to Telstra SOR specifications.
    """
    m_upper = str(model).upper()
    runs = int(round(runs)) if runs > 0 else 1
    
    # 1. Identify diameter
    diameter = None
    if any(k in m_upper for k in ["LCF12", "LDF4", "1/2", "½"]):
        diameter = "1/2"
        base_threshold = 50.0
        single_code = "W12814"
        pair_code = "W12815"
        three_pair_code = "W12816"
        extra_lm_code = "W12826"
    elif any(k in m_upper for k in ["LCF78", "LDF5", "7/8", "⅞"]):
        diameter = "7/8"
        base_threshold = 50.0
        single_code = "W12817"
        pair_code = "W12818"
        three_pair_code = "W12819"
        extra_lm_code = "W12827"
    elif any(k in m_upper for k in ["LCF114", "LDF6", "1-1/4", "1 1/4", "1¼"]):
        diameter = "1-1/4"
        base_threshold = 100.0
        single_code = "W12820"
        pair_code = "W12821"
        three_pair_code = "W12822"
        extra_lm_code = "W12828"
    elif any(k in m_upper for k in ["LCF158", "LDF7", "1-5/8", "1 5/8", "1⅝"]):
        diameter = "1-5/8"
        base_threshold = 100.0
        single_code = "W12823"
        pair_code = "W12824"
        three_pair_code = "W12825"
        extra_lm_code = "W12829"
    else:
        return {
            "status": "ambiguous",
            "message": f"Could not determine feeder cable diameter from model '{model}'."
        }

    # 2. Derive route length from text if not provided
    if route_length_m is None:
        lm_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:M|METRE|METRES|METER)\b', m_upper)
        if lm_match:
            route_length_m = float(lm_match.group(1))

    # 3. Derive multiplicity combinations
    allocations = []
    rem_runs = runs
    
    # Check three-pair (groups of 6)
    if rem_runs >= 6:
        six_groups = rem_runs // 6
        allocations.append({
            "sor_code": three_pair_code,
            "description": f"{diameter}\" Feeder Cable x 6 (three pair)",
            "quantity": six_groups,
            "unit": "Each",
            "commercial_basis": "THREE_PAIR"
        })
        rem_runs %= 6
        
    # Check pair (groups of 2)
    if rem_runs >= 2:
        two_groups = rem_runs // 2
        allocations.append({
            "sor_code": pair_code,
            "description": f"{diameter}\" Feeder Cable x 2 (one pair)",
            "quantity": two_groups,
            "unit": "Each",
            "commercial_basis": "PAIR"
        })
        rem_runs %= 2
        
    # Check single remaining
    if rem_runs == 1:
        allocations.append({
            "sor_code": single_code,
            "description": f"{diameter}\" Feeder Cable x 1 (single)",
            "quantity": 1,
            "unit": "Each",
            "commercial_basis": "SINGLE"
        })

    # 4. Compute Extra-Over Lineal Metres
    extra_lm_items = []
    if route_length_m and route_length_m > base_threshold:
        excess_m_per_run = route_length_m - base_threshold
        total_extra_lm = excess_m_per_run * runs
        extra_lm_items.append({
            "sor_code": extra_lm_code,
            "description": f"{diameter}\" Feeder Cable - Extra Over for additional increment per lineal metre",
            "quantity": total_extra_lm,
            "unit": "Per Lm / feeder",
            "commercial_basis": "EXTRA_OVER_LM",
            "excess_per_run": excess_m_per_run,
            "base_threshold": base_threshold
        })

    return {
        "status": "success",
        "diameter": diameter,
        "runs": runs,
        "route_length_m": route_length_m,
        "base_threshold_m": base_threshold,
        "allocations": allocations,
        "extra_lm": extra_lm_items
    }

# -------------------------------------------------------------------------
# Tool 3: Resolve Antenna Classification
# -------------------------------------------------------------------------
def tool_resolve_antenna(model: str, height_mm: Optional[float] = None, is_first: bool = True, technology: str = "") -> Dict[str, Any]:
    """
    Classifies 4G Panel vs 5G Active Antenna Unit (AAU) and maps to base or extra-over SOR code.
    """
    m_upper = str(model).upper()
    tech_upper = str(technology).upper()

    # Determine 5G AAU vs 4G Passive Panel
    is_aau = False
    if "AIR" in m_upper or "AAU" in m_upper or "MASSIVE MIMO" in m_upper or "NR3600" in tech_upper:
        is_aau = True
    elif height_mm and height_mm < 1200:
        is_aau = True

    if is_aau:
        chosen_code = "W13358" if is_first else "W13359"
        basis = "FIRST" if is_first else "EXTRA"
        name = "One 5G AAU Installation - first" if is_first else "One 5G AAU Installation - extra over"
    else:
        chosen_code = "W7520" if is_first else "W13360"
        basis = "FIRST" if is_first else "EXTRA"
        name = "One panel Antenna installation" if is_first else "One panel Antenna installation- extra over"

    return {
        "status": "success",
        "antenna_type": "5G_AAU" if is_aau else "PANEL_ANTENNA",
        "is_first": is_first,
        "chosen_code": chosen_code,
        "item_name": name,
        "commercial_basis": basis
    }

# -------------------------------------------------------------------------
# Tool 4: Mandatory Commercial Basis Self-Verification Gate
# -------------------------------------------------------------------------
def tool_verify_commercial_basis(chosen_code: str, item_ordinal: int = 1, total_proposed: int = 1, sector: Optional[str] = None) -> Dict[str, Any]:
    """
    MANDATORY SELF-CHECK GATE:
    Verifies that the chosen SOR code's pricing group and commercial basis
    matches the item's ordinal position (e.g. 1st vs 2nd/extra) on the mount/sector.
    Directly prevents misclassifying extra-over items as primary base items.
    """
    chosen = str(chosen_code).strip().upper()
    
    # 4G Panel Antenna group
    if chosen in ["W7520", "W13360"]:
        if item_ordinal == 1:
            if chosen != "W7520":
                return {
                    "valid": False,
                    "recommended_code": "W7520",
                    "reason": f"Item ordinal is 1 (first primary antenna on site/sector), but extra-over code '{chosen}' was chosen. Must use primary code W7520."
                }
        elif item_ordinal > 1:
            if chosen != "W13360":
                return {
                    "valid": False,
                    "recommended_code": "W13360",
                    "reason": f"Item ordinal is {item_ordinal} (exceeds first unit on site/sector), but primary code '{chosen}' was chosen. Must use extra-over code W13360."
                }

    # 5G AAU group
    if chosen in ["W13358", "W13359"]:
        if item_ordinal == 1:
            if chosen != "W13358":
                return {
                    "valid": False,
                    "recommended_code": "W13358",
                    "reason": f"Item ordinal is 1 (first 5G AAU unit on site), but extra-over code '{chosen}' was chosen. Must use primary 5G AAU code W13358."
                }
        elif item_ordinal > 1:
            if chosen != "W13359":
                return {
                    "valid": False,
                    "recommended_code": "W13359",
                    "reason": f"Item ordinal is {item_ordinal} (subsequent 5G AAU unit on site), but primary code '{chosen}' was chosen. Must use extra-over 5G AAU code W13359."
                }

    # Feeder cable single vs pair check
    pair_codes = {"W12815", "W12818", "W12821", "W12824"}
    single_codes = {"W12814", "W12817", "W12820", "W12823"}
    three_pair_codes = {"W12816", "W12819", "W12822", "W12825"}

    if chosen in single_codes and total_proposed in [2, 4, 6]:
        matching_pair = {
            "W12814": "W12815", "W12817": "W12818", "W12820": "W12821", "W12823": "W12824"
        }.get(chosen)
        return {
            "valid": False,
            "recommended_code": matching_pair,
            "reason": f"Total proposed cable runs is {total_proposed} (even number of runs). Feeder must be mapped as pair(s) using {matching_pair}, not single run {chosen}."
        }

    return {
        "valid": True,
        "chosen_code": chosen,
        "message": f"Code '{chosen}' successfully verified against ordinal {item_ordinal} and total proposed {total_proposed}."
    }

# -------------------------------------------------------------------------
# Tool 5: Cross-check Layout Callouts
# -------------------------------------------------------------------------
def tool_verify_layout_callout(equipment_name: str, table_quantity: float, layout_notes: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Cross-checks table quantity against layout callouts and revision clouds.
    Returns status: MATCH, DISCREPANCY, or NO_CALLOUT.
    """
    if not layout_notes:
        return {"status": "NO_CALLOUT", "authoritative_quantity": table_quantity, "comment": ""}

    eq_tokens = [t.lower() for t in re.findall(r'[A-Za-z0-9]+', str(equipment_name)) if len(t) > 2]
    matching_callouts = []
    
    for note in layout_notes:
        txt = str(note.get("text") or note.get("content") or "").lower()
        if any(tok in txt for tok in eq_tokens):
            matching_callouts.append(note)

    if not matching_callouts:
        return {
            "status": "TABLE_AUTHORITATIVE",
            "authoritative_quantity": table_quantity,
            "comment": ""
        }

    # Extract quantities in callouts (e.g. "3 OFF", "2 OFF", "(4 OFF)")
    found_qtys = []
    for c in matching_callouts:
        c_txt = str(c.get("text") or c.get("content") or "").upper()
        m = re.findall(r'(\d+)\s*(?:OFF|NOS|NO|PCS)\b', c_txt)
        for val in m:
            found_qtys.append(float(val))

    if found_qtys:
        callout_qty = max(found_qtys)
        if abs(callout_qty - table_quantity) < 0.01:
            return {
                "status": "VERIFIED_IN_LAYOUT",
                "authoritative_quantity": table_quantity,
                "comment": "",
                "matching_notes_count": len(matching_callouts)
            }
        else:
            return {
                "status": "DISCREPANCY",
                "authoritative_quantity": table_quantity,
                "callout_quantity": callout_qty,
                "comment": "Data not matching with antenna layout",
                "matching_notes_count": len(matching_callouts)
            }

    return {
        "status": "TABLE_AUTHORITATIVE",
        "authoritative_quantity": table_quantity,
        "comment": ""
    }

# -------------------------------------------------------------------------
# Tool 6: Precedent Retrieval
# -------------------------------------------------------------------------
def tool_get_estimator_precedents(description: str, limit: int = 3) -> Dict[str, Any]:
    """Retrieves high-fidelity human estimator precedents from correction logs."""
    try:
        from services.retriever_service import retrieve_precedents
        precedents = retrieve_precedents({"raw_description": description}, k=limit)
        return {
            "status": "success",
            "count": len(precedents),
            "precedents": precedents
        }
    except Exception as e:
        # Graceful fallback to SQLite correction_log
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT original_description, corrected_code, corrected_name, corrected_rate FROM correction_log ORDER BY id DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            conn.close()
            return {
                "status": "success",
                "count": len(rows),
                "precedents": [dict(r) for r in rows]
            }
        except Exception:
            return {"status": "success", "count": 0, "precedents": []}

# -------------------------------------------------------------------------
# Gemini Function Declarations (Tool Definitions)
# -------------------------------------------------------------------------
GEMINI_TOOL_DECLARATIONS = [
    {
        "name": "tool_lookup_price_book",
        "description": "Searches the active Price Book for Schedule of Rates (SOR) items and their commercial prompt rules.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {"type": "STRING", "description": "Search query terms, e.g. 'panel antenna', 'LCF78', 'TMA', 'GPS'"},
                "category": {"type": "STRING", "description": "Optional category filter, e.g. 'Feeder Cables', 'Antennas'"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "tool_resolve_feeder_cable",
        "description": "Deterministically resolves feeder cable model to diameter (1/2, 7/8, 1-1/4, 1-5/8), multiplicity (single, pair, three-pair), and extra-over per lineal metre.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "model": {"type": "STRING", "description": "Cable model name, e.g. 'RFS LCF78-50JA', 'ANDREW LDF5-50', 'LCF114-50J'"},
                "runs": {"type": "NUMBER", "description": "Total number of proposed cable runs (e.g. 2, 4, 6)"},
                "route_length_m": {"type": "NUMBER", "description": "Route length in metres (e.g. 30, 70, 110)"}
            },
            "required": ["model"]
        }
    },
    {
        "name": "tool_resolve_antenna",
        "description": "Determines whether an antenna is a 4G passive panel (>1.5m) or 5G AAU (<1.0m/active beamforming), and returns primary vs extra-over code.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "model": {"type": "STRING", "description": "Antenna model name, e.g. 'Kaelus F6RHEU01', 'Ericsson AIR3258'"},
                "height_mm": {"type": "NUMBER", "description": "Height or length in millimetres"},
                "is_first": {"type": "BOOLEAN", "description": "True if this is the first primary unit on the site/sector; False for extra-over units"},
                "technology": {"type": "STRING", "description": "Band/technology string, e.g. 'LTE700/NR850', 'NR3600'"}
            },
            "required": ["model", "is_first"]
        }
    },
    {
        "name": "tool_verify_commercial_basis",
        "description": "MANDATORY SELF-CHECK GATE: Validates chosen SOR code against ordinal position (first vs extra-over) before committing.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "chosen_code": {"type": "STRING", "description": "The proposed SOR code, e.g. 'W7520', 'W13360', 'W13358', 'W13359', 'W12818'"},
                "item_ordinal": {"type": "INTEGER", "description": "1-based ordinal position of this equipment unit (1 for 1st unit, 2 for 2nd unit)"},
                "total_proposed": {"type": "INTEGER", "description": "Total proposed units on site/sector"},
                "sector": {"type": "STRING", "description": "Optional sector identifier, e.g. 'S1', 'S2', 'S3'"}
            },
            "required": ["chosen_code", "item_ordinal"]
        }
    },
    {
        "name": "tool_verify_layout_callout",
        "description": "Checks whether table quantity matches layout annotations and revision clouds, flagging discrepancies.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "equipment_name": {"type": "STRING", "description": "Equipment description or model"},
                "table_quantity": {"type": "NUMBER", "description": "Authoritative quantity from table"}
            },
            "required": ["equipment_name", "table_quantity"]
        }
    },
    {
        "name": "tool_get_estimator_precedents",
        "description": "Retrieves historical human estimator correction records for similar equipment scopes.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "description": {"type": "STRING", "description": "Raw equipment or scope description"}
            },
            "required": ["description"]
        }
    }
]

# -------------------------------------------------------------------------
# Tool Dispatcher
# -------------------------------------------------------------------------
def execute_agent_tool(tool_name: str, tool_args: Dict[str, Any], layout_notes_context: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """Executes a tool call safely, catching exceptions and returning structured error responses."""
    try:
        if tool_name == "tool_lookup_price_book":
            return tool_lookup_price_book(
                query=tool_args.get("query", ""),
                category=tool_args.get("category", "")
            )
        elif tool_name == "tool_resolve_feeder_cable":
            return tool_resolve_feeder_cable(
                model=tool_args.get("model", ""),
                runs=float(tool_args.get("runs", 1.0)),
                route_length_m=tool_args.get("route_length_m")
            )
        elif tool_name == "tool_resolve_antenna":
            return tool_resolve_antenna(
                model=tool_args.get("model", ""),
                height_mm=tool_args.get("height_mm"),
                is_first=bool(tool_args.get("is_first", True)),
                technology=tool_args.get("technology", "")
            )
        elif tool_name == "tool_verify_commercial_basis":
            return tool_verify_commercial_basis(
                chosen_code=tool_args.get("chosen_code", ""),
                item_ordinal=int(tool_args.get("item_ordinal", 1)),
                total_proposed=int(tool_args.get("total_proposed", 1)),
                sector=tool_args.get("sector")
            )
        elif tool_name == "tool_verify_layout_callout":
            return tool_verify_layout_callout(
                equipment_name=tool_args.get("equipment_name", ""),
                table_quantity=float(tool_args.get("table_quantity", 1.0)),
                layout_notes=layout_notes_context
            )
        elif tool_name == "tool_get_estimator_precedents":
            return tool_get_estimator_precedents(
                description=tool_args.get("description", "")
            )
        else:
            return {"status": "error", "message": f"Unknown tool name '{tool_name}'"}
    except Exception as e:
        return {"status": "error", "message": f"Tool execution failed: {str(e)}"}
