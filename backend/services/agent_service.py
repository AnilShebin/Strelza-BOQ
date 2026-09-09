"""
agent_service.py - Multi-Stage Agentic Architecture powered by Gemini 3.8 Flash

Implements real agentic execution:
1. Stage 1: Table-First Authoritative Takeoff Extraction & Consolidation
2. Stage 2: Deterministic Constraint Gating
3. Stage 3: Gemini 3.8 Flash Multi-Turn Tool Deliberation (with mandatory commercial basis verification)
4. Stage 4: Zero-Loss Scope Reconciliation & Multiplicity Aggregation
"""

import os
import re
import json
import time
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional, Tuple

from services.ai_service import wait_for_rate_limit, load_env_file, get_prompt_by_name
from services.agent_tools import (
    GEMINI_TOOL_DECLARATIONS,
    execute_agent_tool,
    tool_resolve_feeder_cable,
    tool_verify_commercial_basis,
    tool_resolve_antenna
)
from services.constraint_gate import filter_candidates

# Model cascade prioritizes Gemini 3.8 Flash with verified supported fallbacks
MODELS_CASCADE = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash"
]

def send_agent_turn(
    messages: List[Dict[str, Any]],
    api_key: str,
    tools: Optional[List[Dict[str, Any]]] = None,
    timeout: int = 40
) -> Tuple[Optional[str], Optional[List[Dict[str, Any]]], Optional[Dict[str, Any]], str]:
    """
    Executes a single model turn against Google Generative Language API.
    Returns: (text_content, tool_calls_list, raw_content, model_used)
    """
    if not api_key:
        return None, None, None, ""

    for model_name in MODELS_CASCADE:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        
        payload = {
            "contents": messages,
            "generationConfig": {
                "temperature": 0.0
            }
        }
        if tools:
            payload["tools"] = [{"functionDeclarations": tools}]

        data = json.dumps(payload).encode("utf-8")
        
        for attempt in range(2):
            try:
                wait_for_rate_limit()
                req = urllib.request.Request(
                    url,
                    data=data,
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    res_json = json.loads(resp.read().decode("utf-8"))
                    candidates = res_json.get("candidates", [])
                    if not candidates:
                        continue
                    raw_content = candidates[0].get("content", {})
                    parts = raw_content.get("parts", [])
                    
                    text_parts = [p["text"] for p in parts if "text" in p and p["text"]]
                    tool_calls = [p["functionCall"] for p in parts if "functionCall" in p]
                    
                    full_text = "\n".join(text_parts) if text_parts else None
                    return full_text, (tool_calls if tool_calls else None), raw_content, model_name
            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8") if e.fp else ""
                print(f"[Agent Service] Model '{model_name}' HTTP {e.code}: {err_body[:180]}")
                if e.code == 404:
                    print(f"[Agent Service] Model '{model_name}' endpoint returned 404, trying next in cascade...")
                    break
                elif e.code in [429, 500, 503]:
                    time.sleep(2)
                    continue
                else:
                    break
            except Exception as ex:
                time.sleep(1)
                continue

    return None, None, None, ""

def run_agentic_boq_pipeline(
    extracted_tables: List[Dict[str, Any]],
    elements: List[Dict[str, Any]],
    price_list: List[Dict[str, Any]],
    api_key: str
) -> List[Dict[str, Any]]:
    """
    Executes the 4-stage Agentic Takeoff & Pricing Pipeline powered by Gemini 3.8 Flash.
    """
    print("[Agentic Pipeline] Initializing Stage 1: Table-First Takeoff Extraction...")
    
    # -------------------------------------------------------------------------
    # STAGE 1: Extract & Consolidate Authoritative Takeoff Items from Drawing Tables
    # -------------------------------------------------------------------------
    raw_takeoff_items: List[Dict[str, Any]] = []
    layout_notes = [
        {"text": str(el.get("content") or el.get("text") or ""), "page": el.get("page", 1)}
        for el in elements if el.get("type") == "unstructured" and len(str(el.get("content") or "")) > 10
    ]

    # Map of code -> price item for fast enrichment
    price_by_code = {str(p.get("code") or "").strip().upper(): p for p in price_list if p.get("code")}

    for t in extracted_tables:
        rows = t.get("rows", [])
        headers = [str(h).upper().strip() for h in t.get("headers", [])]
        sheet = t.get("sheet_name") or f"Page {t.get('page', 1)}"
        table_title = str(t.get("table_title", "Table")).upper()

        # Filter out non-equipment tables (revisions, drawing indices, title blocks, legends)
        if any(ign in table_title for ign in [
            "REVISION", "DRAWING LIST", "TITLE BLOCK", "DOCUMENT HISTORY",
            "SITE DETAILS", "INDEX", "LEGEND", "ABBREVIATION", "GENERAL NOTE", "SITE SUMMARY"
        ]):
            continue

        # Identify column indices
        prop_idx = -1
        exist_idx = -1
        equip_idx = 1
        sec_idx = -1
        action_idx = -1

        for h_i, h in enumerate(headers):
            if "PROPOSE" in h or "NEW" in h:
                prop_idx = h_i
            elif "EXIST" in h:
                exist_idx = h_i
            elif "ACTION" in h:
                action_idx = h_i
            elif "SECTOR" in h:
                sec_idx = h_i
            elif any(k in h for k in ["MODEL", "TYPE", "EQUIPMENT", "DESCRIPTION"]):
                equip_idx = h_i

        for r_i, row in enumerate(rows):
            if not row or not isinstance(row, list) or len(row) < 2:
                continue

            # Skip header repeats
            if any(cell in ["ITEM", "EQUIPMENT", "DRAWING DESCRIPTION", "ORDER"] for cell in row):
                continue

            desc_str = str(row[equip_idx] if len(row) > equip_idx else row[0]).strip()
            if not desc_str or desc_str in ["-", "N/A", "NONE", "TOTAL"]:
                continue

            details_str = str(row[2] if len(row) > 2 else "").strip()
            full_desc = f"{desc_str} {details_str}".strip()

            # Determine action and quantity
            act = "INSTALL"
            qty = 1.0
            
            if action_idx != -1 and len(row) > action_idx:
                raw_act = str(row[action_idx]).upper().strip()
                if "REM" in raw_act or "REC" in raw_act:
                    act = "REMOVE"
                elif "RELOC" in raw_act:
                    act = "RELOCATE"
                elif "EXIST" in raw_act:
                    act = "EXISTING"

            if prop_idx != -1 and len(row) > prop_idx:
                prop_val_str = str(row[prop_idx]).strip()
                match_digits = re.findall(r'-?\d+(?:\.\d+)?', prop_val_str)
                if match_digits:
                    num_val = float(match_digits[0])
                    if num_val < 0:
                        act = "REMOVE"
                        qty = abs(num_val)
                    elif num_val > 0:
                        act = "INSTALL"
                        qty = num_val
                    else:
                        continue  # 0 proposed, skip non-action item
                else:
                    continue
            else:
                # Search whole row for remove / recover keywords
                row_text = " ".join(str(c) for c in row).upper()
                if any(k in row_text for k in ["REMOVE", "RECOVER"]):
                    act = "REMOVE"
                elif "EXISTING" in row_text and not any(k in row_text for k in ["INSTALL", "PROPOSED", "NEW"]):
                    continue

            # Classify equipment category
            sem_class = "EQUIPMENT"
            f_upper = full_desc.upper()
            if any(k in f_upper for k in ["LCF", "LDF", "FEEDER", "COAXIAL"]):
                sem_class = "FEEDER_CABLE"
            elif any(k in f_upper for k in ["AIR", "AAU", "MASSIVE MIMO"]):
                sem_class = "5G_AAU"
            elif any(k in f_upper for k in ["PANEL", "KAELUS", "ARGUS", "RVVPX"]):
                sem_class = "PANEL_ANTENNA"
            elif any(k in f_upper for k in ["TMA", "TMD", "FILTER", "COMBINER", "DIPLEXER"]):
                sem_class = "TMD"
            elif any(k in f_upper for k in ["RADIO", "RRU", "RRUS"]):
                sem_class = "RRU"
            elif any(k in f_upper for k in ["BASEBAND", "BB66", "RP6672", "DUS"]):
                sem_class = "BASEBAND"
            elif any(k in f_upper for k in ["ROUTER", "CSR", "R6675"]):
                sem_class = "ROUTER"
            elif any(k in f_upper for k in ["GPS", "GRU"]):
                sem_class = "GPS"

            sector_str = str(row[sec_idx]) if (sec_idx != -1 and len(row) > sec_idx) else ""

            raw_takeoff_items.append({
                "id": f"takeoff_{len(raw_takeoff_items):03d}",
                "model": full_desc,
                "raw_description": full_desc,
                "action": act,
                "quantity": qty,
                "source_sheet": sheet,
                "table_title": table_title,
                "equipment_type": sem_class,
                "sector": sector_str
            })

    # Consolidate takeoff items by unique scope (model, action, equipment_type) across sectors
    scope_groups: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    for item in raw_takeoff_items:
        key = (item["model"].strip().upper(), item["action"].upper(), item["equipment_type"])
        if key in scope_groups:
            scope_groups[key]["quantity"] += item["quantity"]
            if item.get("sector") and item["sector"] not in scope_groups[key]["sectors"]:
                scope_groups[key]["sectors"].append(item["sector"])
        else:
            scope_groups[key] = {
                "id": item["id"],
                "model": item["model"],
                "raw_description": item["raw_description"],
                "action": item["action"],
                "quantity": item["quantity"],
                "source_sheet": item["source_sheet"],
                "table_title": item["table_title"],
                "equipment_type": item["equipment_type"],
                "sectors": [item["sector"]] if item.get("sector") else []
            }
    takeoff_items = list(scope_groups.values())
    print(f"[Agentic Pipeline] Stage 1 Consolidator produced {len(takeoff_items)} distinct equipment scopes from {len(raw_takeoff_items)} raw table rows.")

    # -------------------------------------------------------------------------
    # STAGE 2, 3 & 4: Constraint Filtering, Tool Deliberation, and Reconciling
    # -------------------------------------------------------------------------
    client_rules_prompt = get_prompt_by_name("client_mapping_rules", "")
    mapped_boq_items: List[Dict[str, Any]] = []

    # Track site-wide ordinals per equipment category for base vs extra-over splitting
    category_ordinals: Dict[str, int] = {}

    for t_item in takeoff_items:
        t_model = t_item["model"]
        t_act = t_item["action"]
        t_qty = t_item["quantity"]
        t_class = t_item["equipment_type"]
        t_sheet = t_item["source_sheet"]

        # Fast deterministic path for feeder cables (encodes exact Telstra specifications)
        if t_class == "FEEDER_CABLE" and t_act == "INSTALL":
            runs_val = int(t_qty)
            route_len = 35.0  # standard route length baseline unless extracted from notes
            m_len = re.search(r'(\d+)\s*(?:M|METRE|METER)', t_model, re.IGNORECASE)
            if m_len:
                route_len = float(m_len.group(1))

            feeder_res = tool_resolve_feeder_cable(t_model, runs=runs_val, route_length_m=route_len)
            if feeder_res.get("status") == "success":
                for alloc in feeder_res.get("allocations", []):
                    s_code = alloc["sor_code"]
                    s_qty = alloc["quantity"]
                    p_info = price_by_code.get(s_code, {})
                    rate = float(p_info.get("rate") or 0.0)
                    mapped_boq_items.append({
                        "sor_code": s_code,
                        "item_name": p_info.get("name") or alloc["description"],
                        "quantity": s_qty,
                        "unit": alloc["unit"],
                        "rate": rate,
                        "total_cost": s_qty * rate,
                        "action": "INSTALL",
                        "model": t_model,
                        "equipment_type": "FEEDER_CABLE",
                        "source_sheet": t_sheet,
                        "row_idx": p_info.get("row_idx") or p_info.get("id"),
                        "comment": f"Deterministic Feeder Engine: {alloc['commercial_basis']} ({feeder_res['runs']} runs)",
                        "aggregation_rule": "SUM"
                    })
                # Add Extra Over Lineal Metres if route exceeds base threshold
                for x_lm in feeder_res.get("extra_lm", []):
                    x_code = x_lm["sor_code"]
                    x_qty = x_lm["quantity"]
                    p_x = price_by_code.get(x_code, {})
                    x_rate = float(p_x.get("rate") or 0.0)
                    mapped_boq_items.append({
                        "sor_code": x_code,
                        "item_name": p_x.get("name") or x_lm["description"],
                        "quantity": x_qty,
                        "unit": x_lm["unit"],
                        "rate": x_rate,
                        "total_cost": x_qty * x_rate,
                        "action": "INSTALL",
                        "model": t_model,
                        "equipment_type": "FEEDER_CABLE",
                        "source_sheet": t_sheet,
                        "row_idx": p_x.get("row_idx") or p_x.get("id"),
                        "comment": f"Extra over base route ({x_lm['excess_per_run']}m excess per run)",
                        "aggregation_rule": "SUM"
                    })
                continue

        # Fast deterministic path for tower removals (R12513 sum of tower items)
        if t_act == "REMOVE" and t_class in ["PANEL_ANTENNA", "5G_AAU", "TMD", "RRU"]:
            p_r12 = price_by_code.get("R12513", {})
            rate = float(p_r12.get("rate") or 285.0)
            mapped_boq_items.append({
                "sor_code": "R12513",
                "item_name": p_r12.get("name") or "Remove Panel Antenna or tower mounted device",
                "quantity": t_qty,
                "unit": "each",
                "rate": rate,
                "total_cost": t_qty * rate,
                "action": "REMOVE",
                "model": t_model,
                "equipment_type": t_class,
                "source_sheet": t_sheet,
                "row_idx": p_r12.get("row_idx") or p_r12.get("id"),
                "comment": "Tower Equipment Removal Scope",
                "aggregation_rule": "MAX"
            })
            continue

        # Compute ordinal position for first vs extra-over tracking
        pricing_group = t_class
        curr_ordinal = category_ordinals.get(pricing_group, 0) + 1
        category_ordinals[pricing_group] = curr_ordinal + int(t_qty - 1)

        # Stage 2: Deterministic Candidate Gating
        candidates = filter_candidates(t_item, price_list)

        # Stage 3: Gemini 3.8 Flash Agent Loop with Tools
        chosen_code = None
        comment_str = ""
        verification_passed = False

        if api_key and candidates:
            # Build agent message context
            sys_msg = f"""You are a senior telecom BOQ estimation agent powered by Gemini 3.8 Flash.
Evaluate the following takeoff item and map it to the single correct Schedule of Rates (SOR) code.

TAKEOFF SCOPE:
- Item: "{t_model}"
- Action: {t_act}
- Quantity: {t_qty}
- Class: {t_class}
- Sheet: {t_sheet}
- Current Ordinal Position: {curr_ordinal} (Total proposed: {t_qty})

SHORTLISTED CANDIDATES:
{json.dumps([{'code': c.get('code'), 'name': c.get('name'), 'unit': c.get('unit'), 'rule': c.get('mapping_rule')} for c in candidates[:8]], indent=2)}

CLIENT RULES:
{client_rules_prompt[:500]}

MANDATORY DIRECTIVE:
You have executable tools available. Before outputting your final decision, you MUST call 'tool_verify_commercial_basis' with your proposed SOR code and item_ordinal={curr_ordinal} to ensure primary vs extra-over rules are strictly satisfied.
Once verified, output your final decision in JSON format:
{{"chosen_code": "SOR_CODE_OR_UNQUOTED", "reasoning": "rationale"}}"""

            messages = [{"role": "user", "parts": [{"text": sys_msg}]}]
            
            # Agent multi-turn loop (max 4 turns)
            for turn in range(4):
                text_resp, tool_calls, raw_content, used_model = send_agent_turn(
                    messages, api_key, tools=GEMINI_TOOL_DECLARATIONS
                )

                if tool_calls and raw_content:
                    # Append exact raw model response preserving thoughtSignature and call IDs
                    messages.append(raw_content)

                    # Execute tools and return functionResponse parts with role="user"
                    tool_response_parts = []
                    for tc in tool_calls:
                        fn_name = tc.get("name", "")
                        fn_args = tc.get("args", {})
                        tool_out = execute_agent_tool(fn_name, fn_args, layout_notes_context=layout_notes)
                        
                        if fn_name == "tool_verify_commercial_basis" and tool_out.get("valid"):
                            verification_passed = True

                        tool_response_parts.append({
                            "functionResponse": {
                                "name": fn_name,
                                "response": tool_out
                            }
                        })
                    messages.append({"role": "user", "parts": tool_response_parts})
                else:
                    # Final response reached
                    if text_resp:
                        try:
                            clean_json = re.search(r'\{.*\}', text_resp, re.DOTALL)
                            if clean_json:
                                parsed = json.loads(clean_json.group(0))
                                chosen_code = parsed.get("chosen_code")
                                comment_str = parsed.get("reasoning", "")
                        except Exception:
                            pass
                    break

        # If agent didn't finish or pick code, use deterministic fallback
        if not chosen_code or chosen_code == "UNQUOTED":
            if t_class in ["PANEL_ANTENNA", "5G_AAU"]:
                ant_res = tool_resolve_antenna(t_model, is_first=(curr_ordinal == 1))
                chosen_code = ant_res["chosen_code"]
                comment_str = f"Mapped via Antenna Rule: {ant_res['item_name']}"
            elif candidates:
                chosen_code = candidates[0].get("code")
                comment_str = "Matched based on constraint gate shortlist"

        # Commercial basis self-check
        if chosen_code and not verification_passed:
            v_check = tool_verify_commercial_basis(chosen_code, item_ordinal=curr_ordinal, total_proposed=int(t_qty))
            if not v_check.get("valid") and v_check.get("recommended_code"):
                chosen_code = v_check["recommended_code"]
                comment_str += f" | {v_check.get('reason')}"

        # Commercial allocation: split 1st unit (base) from subsequent units (extra-over)
        if chosen_code in ["W7520", "W13358"] and t_qty > 1 and curr_ordinal == 1:
            # 1. Base unit (Quantity = 1)
            p_base = price_by_code.get(chosen_code, {})
            b_rate = float(p_base.get("rate") or 0.0)
            mapped_boq_items.append({
                "sor_code": chosen_code,
                "item_name": p_base.get("name"),
                "quantity": 1.0,
                "unit": p_base.get("unit", "each"),
                "rate": b_rate,
                "total_cost": b_rate,
                "action": t_act,
                "model": t_model,
                "equipment_type": t_class,
                "source_sheet": t_sheet,
                "row_idx": p_base.get("row_idx") or p_base.get("id"),
                "comment": f"{comment_str} (First unit on site)",
                "aggregation_rule": "MAX"
            })

            # 2. Extra-over units (Quantity = t_qty - 1)
            extra_code = "W13360" if chosen_code == "W7520" else "W13359"
            extra_qty = float(t_qty - 1)
            p_extra = price_by_code.get(extra_code, {})
            x_rate = float(p_extra.get("rate") or 0.0)
            mapped_boq_items.append({
                "sor_code": extra_code,
                "item_name": p_extra.get("name"),
                "quantity": extra_qty,
                "unit": p_extra.get("unit", "each"),
                "rate": x_rate,
                "total_cost": extra_qty * x_rate,
                "action": t_act,
                "model": t_model,
                "equipment_type": t_class,
                "source_sheet": t_sheet,
                "row_idx": p_extra.get("row_idx") or p_extra.get("id"),
                "comment": f"Extra over subsequent units ({int(extra_qty)} off)",
                "aggregation_rule": "SUM"
            })
            continue

        # Standard item allocation
        p_match = price_by_code.get(str(chosen_code).upper()) if chosen_code else None
        if p_match:
            rate = float(p_match.get("rate") or 0.0)
            mapped_boq_items.append({
                "sor_code": p_match.get("code"),
                "item_name": p_match.get("name"),
                "quantity": t_qty,
                "unit": p_match.get("unit", "each"),
                "rate": rate,
                "total_cost": t_qty * rate,
                "action": t_act,
                "model": t_model,
                "equipment_type": t_class,
                "source_sheet": t_sheet,
                "row_idx": p_match.get("row_idx") or p_match.get("id"),
                "comment": comment_str,
                "aggregation_rule": "MAX" if chosen_code in ["W7520", "W13358", "W13375", "R12513"] else "SUM"
            })
        else:
            mapped_boq_items.append({
                "sor_code": "UNQUOTED",
                "item_name": t_model,
                "quantity": t_qty,
                "unit": "each",
                "rate": 0.0,
                "total_cost": 0.0,
                "action": t_act,
                "model": t_model,
                "equipment_type": t_class,
                "source_sheet": t_sheet,
                "row_idx": None,
                "comment": f"Estimator need to fill: {t_model} ({t_sheet})",
                "aggregation_rule": "SUM"
            })

    print(f"[Agentic Pipeline] Successfully produced {len(mapped_boq_items)} priced & unquoted BOQ scopes.")
    return mapped_boq_items
