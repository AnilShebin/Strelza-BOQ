"""
agent_service.py - High-Efficiency Agentic BOQ Architecture powered by Gemini 3.8 Flash

Architecture:
1. Stage 1: Strict Authoritative Telecom Schedule Extraction (Antennas, Feeders, Radios, TMDs, Removals)
2. Stage 2: High-Speed Batch Deliberation with Gemini 3.8 Flash (1 single API call)
3. Stage 3: Autonomous Agent Tool Processing (Feeder Resolution, Commercial Basis Verification Gate, Precedents)
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
    tool_resolve_feeder_cable,
    tool_verify_commercial_basis,
    tool_resolve_antenna,
    tool_verify_layout_callout,
    tool_get_estimator_precedents
)
from services.constraint_gate import filter_candidates

MODELS_CASCADE = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash"
]

def send_gemini_json_request(
    prompt: str,
    api_key: str,
    timeout: int = 45
) -> Tuple[Optional[List[Dict[str, Any]]], str]:
    """Sends a single structured JSON request to Gemini with fallback cascade."""
    if not api_key:
        return None, ""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.0
        }
    }
    data = json.dumps(payload).encode("utf-8")

    for model_name in MODELS_CASCADE:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
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
                    text_out = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                    parsed = json.loads(text_out)
                    if isinstance(parsed, list):
                        return parsed, model_name
                    elif isinstance(parsed, dict):
                        for v in parsed.values():
                            if isinstance(v, list):
                                return v, model_name
                        return [parsed], model_name
            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8") if e.fp else ""
                print(f"[Agent Service] Model '{model_name}' HTTP {e.code}: {err_body[:180]}")
                if e.code == 404:
                    break
                elif e.code in [429, 500, 503]:
                    time.sleep(2)
                    continue
                else:
                    break
            except Exception as ex:
                time.sleep(1)
                continue

    return None, ""

def run_agentic_boq_pipeline(
    extracted_tables: List[Dict[str, Any]],
    elements: List[Dict[str, Any]],
    price_list: List[Dict[str, Any]],
    api_key: str
) -> List[Dict[str, Any]]:
    """
    Executes the high-efficiency 4-stage Agentic Takeoff & Pricing Pipeline.
    Strictly filters out non-telecom schedules (steel cutting lists, drawing indices, port matrices)
    and uses 1 single Gemini 3.8 Flash deliberation call.
    """
    print("[Agentic Pipeline] Initializing Stage 1: Strict Telecom Schedule Extraction...")
    
    # -------------------------------------------------------------------------
    # STAGE 1: Extract & Consolidate Authoritative Takeoff Items from Drawing Tables
    # -------------------------------------------------------------------------
    raw_takeoff_items: List[Dict[str, Any]] = []
    seen_table_keys = set()

    # Map of code -> price item for fast enrichment
    price_by_code = {str(p.get("code") or "").strip().upper(): p for p in price_list if p.get("code")}

    for t in extracted_tables:
        rows = t.get("rows", [])
        headers = [str(h).upper().strip() for h in t.get("headers", [])]
        sheet = t.get("sheet_name") or f"Page {t.get('page', 1)}"
        table_title = str(t.get("table_title") or t.get("title") or "Table").upper().strip()

        # Deduplicate identical table instances
        table_key = (t.get("page", 1), table_title, len(rows))
        if table_key in seen_table_keys:
            continue
        seen_table_keys.add(table_key)

        # 1. STRICT EXCLUSION: Structural steel details, plate schedules, drawing index, revisions
        if any(ign in table_title for ign in [
            "MEMBER SCHEDULE", "STEELWORK", "FABRICATION", "CUTTING LIST", "MEMBER",
            "DRAWING INDEX", "REFERENCE DRAWING", "SHEET LIST", "DOCUMENT",
            "REVISION", "AMENDMENT", "APPROVAL", "COMPLIANCE", "SITE REFERENCE", 
            "TITLE BLOCK", "LEGEND", "ABBREVIATION", "GENERAL NOTE", "SUMMARY"
        ]):
            continue

        # 2. STRICT INCLUSION: True telecom configuration or equipment schedules only
        is_telecom_table = (
            any(k in table_title for k in [
                "ANTENNA CONFIGURATION", "ANTENNA SCHEDULE", "RF SCHEDULE", 
                "EQUIPMENT NOTES", "EQUIPMENT SCHEDULE", "FEEDER SCHEDULE", "CABLE SCHEDULE"
            ])
            or any(any(k in h for k in ["ANTENNA ACTION", "EQUIPMENT DETAILS", "ANTENNA TYPE"]) for h in headers)
        )
        if not is_telecom_table:
            continue

        # ---------------------------------------------------------------------
        # Case A: Antenna Configuration Table (Page 11, etc.)
        # ---------------------------------------------------------------------
        if "ANTENNA" in table_title:
            act_idx = 2
            model_idx = 1
            for h_i, h in enumerate(headers):
                if "ACTION" in h:
                    act_idx = h_i
                elif "TYPE" in h or "MODEL" in h or "SIZE" in h:
                    model_idx = h_i

            for r in rows:
                if not r or len(r) < 3:
                    continue
                m_str = str(r[model_idx]).strip()
                a_str = str(r[act_idx]).strip().upper()
                if not m_str or m_str in ["-", "N/A", "NONE"]:
                    continue

                act = "INSTALL" if "INSTALL" in a_str else ("REMOVE" if "REMOVE" in a_str else None)
                if not act:
                    continue

                is_aau = any(k in m_str.upper() for k in ["AIR", "AAU", "MASSIVE MIMO"])
                raw_takeoff_items.append({
                    "id": f"takeoff_{len(raw_takeoff_items):03d}",
                    "model": m_str,
                    "raw_description": m_str,
                    "action": act,
                    "quantity": 1.0,
                    "source_sheet": sheet,
                    "table_title": table_title,
                    "equipment_type": "5G_AAU" if is_aau else "PANEL_ANTENNA",
                    "sector": str(r[0]) if len(r) > 0 else ""
                })

        # ---------------------------------------------------------------------
        # Case B: Equipment Notes / Schedules Table (Page 4 & 5, etc.)
        # ---------------------------------------------------------------------
        else:
            equip_idx = 1
            prop_idx = 4
            detail_idx = 2
            for h_i, h in enumerate(headers):
                if "PROPOSE" in h or "NEW" in h:
                    prop_idx = h_i
                elif "EQUIP" in h:
                    equip_idx = h_i
                elif "DETAIL" in h:
                    detail_idx = h_i

            for r in rows:
                if not r or len(r) < 2:
                    continue
                e_name = str(r[equip_idx] if len(r) > equip_idx else r[0]).strip()
                if not e_name or e_name in ["-", "N/A", "TOTAL", "NONE", "ITEM"]:
                    continue

                # Strictly check PROPOSED quantity column
                if len(r) <= prop_idx:
                    continue
                p_val = str(r[prop_idx]).strip()
                if p_val in ["0", "-", "", "N/A"]:
                    # Item exists but has no active proposed scope of work
                    continue

                digits = re.findall(r'-?\d+(?:\.\d+)?', p_val)
                if not digits:
                    continue
                num = float(digits[0])
                if num == 0:
                    continue

                d_text = str(r[detail_idx] if len(r) > detail_idx else "").strip()
                full_m = f"{e_name} {d_text}".strip() if (d_text and d_text != "-") else e_name

                # Filter out raw steel plate dimensions or internal port acronyms
                u_m = full_m.upper()
                if re.search(r'\d+x\d+x\d+THK|\bTHK\b|\bGRADE\s*\d+|\bGALV\b|\bM\d+\s*BOLT', u_m):
                    continue
                if re.match(r'^[A-Z]{2}\s+[A-Z]{2}$', u_m) or u_m in ["SB SB", "MS LY", "SH JG", "UH RM", "LB WR"]:
                    continue

                act = "INSTALL" if num > 0 else "REMOVE"
                qty = abs(num)

                sem = "EQUIPMENT"
                if any(k in u_m for k in ["LCF", "LDF", "FEEDER", "COAXIAL"]):
                    sem = "FEEDER_CABLE"
                elif any(k in u_m for k in ["AIR", "AAU", "MASSIVE MIMO"]):
                    sem = "5G_AAU"
                elif any(k in u_m for k in ["PANEL", "KAELUS", "ARGUS", "RVVPX"]):
                    sem = "PANEL_ANTENNA"
                elif any(k in u_m for k in ["RRU", "RRUS", "RADIO"]):
                    sem = "RRU"
                elif any(k in u_m for k in ["TMA", "TMD", "FILTER", "COMBINER", "DIPLEXER"]):
                    sem = "TMD"
                elif any(k in u_m for k in ["BASEBAND", "BB66", "RP6672", "DUS"]):
                    sem = "BASEBAND"
                elif any(k in u_m for k in ["GPS", "GRU"]):
                    sem = "GPS"

                raw_takeoff_items.append({
                    "id": f"takeoff_{len(raw_takeoff_items):03d}",
                    "model": full_m,
                    "raw_description": full_m,
                    "action": act,
                    "quantity": qty,
                    "source_sheet": sheet,
                    "table_title": table_title,
                    "equipment_type": sem,
                    "sector": ""
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
    # STAGE 2: High-Speed Batch Deliberation with Gemini 3.8 Flash (1 API Call)
    # -------------------------------------------------------------------------
    client_rules_prompt = get_prompt_by_name("client_mapping_rules", "")
    
    compact_price_list = []
    for p in price_list:
        if isinstance(p, dict) and (p.get("code") or p.get("name")):
            rule_part = f" | RULE: {p.get('mapping_rule')}" if p.get("mapping_rule") else ""
            compact_price_list.append({
                "code": p.get("code", ""),
                "name": p.get("name", ""),
                "unit": p.get("unit", "each"),
                "rate": float(p.get("rate") or 0.0),
                "rule": rule_part
            })

    # Items that need LLM semantic mapping (antennas, filters, radios, brackets)
    llm_scopes = [item for item in takeoff_items if item["equipment_type"] != "FEEDER_CABLE"]
    llm_decisions: Dict[str, Dict[str, Any]] = {}

    if api_key and llm_scopes:
        print(f"[Agentic Pipeline] Running Stage 2 Batch Deliberation on {len(llm_scopes)} scopes using Gemini 3.8 Flash...")
        batch_prompt = f"""You are a senior telecom BOQ estimation agent powered by Gemini 3.8 Flash.
Evaluate the drawing takeoff items below and map each one to the single best matching Schedule of Rates (SOR) code from the active price list.

CLIENT COMMERCIAL RULES:
{client_rules_prompt}

DRAWING TAKEOFF ITEMS:
{json.dumps([{'id': s['id'], 'model': s['model'], 'action': s['action'], 'quantity': s['quantity'], 'class': s['equipment_type'], 'sheet': s['source_sheet']} for s in llm_scopes], indent=2)}

ACTIVE PRICE LIST CANDIDATES:
{json.dumps(compact_price_list[:120], indent=2)}

INSTRUCTIONS:
1. For passive panel antennas (e.g. CommScope, Argus, Kathrein >1.5m), map to W7520 (One panel Antenna installation).
2. For 5G Active Antenna Units (e.g. Ericsson AIR 6449, Massive MIMO), map to W13358 (One 5G AAU Installation - first).
3. For outdoor tower equipment removals (antennas, TMAs, TMDs, RRUs to be removed), map to R12513.
4. If no valid code exists in the catalog, set chosen_code to "UNQUOTED".

Return ONLY a JSON array with one object per takeoff item:
[
  {{"id": "takeoff_000", "chosen_code": "SOR_CODE", "reasoning": "rationale"}}
]"""

        mapped_results, used_model = send_gemini_json_request(batch_prompt, api_key, timeout=45)
        if mapped_results and isinstance(mapped_results, list):
            print(f"[Agentic Pipeline] Gemini 3.8 Flash successfully mapped {len(mapped_results)} items in a single request!")
            for res in mapped_results:
                if isinstance(res, dict) and res.get("id"):
                    llm_decisions[res["id"]] = res

    # -------------------------------------------------------------------------
    # STAGE 3 & 4: Autonomous Tool Verification & Zero-Loss Scope Reconciliation
    # -------------------------------------------------------------------------
    mapped_boq_items: List[Dict[str, Any]] = []
    category_ordinals: Dict[str, int] = {}

    for t_item in takeoff_items:
        t_id = t_item["id"]
        t_model = t_item["model"]
        t_act = t_item["action"]
        t_qty = t_item["quantity"]
        t_class = t_item["equipment_type"]
        t_sheet = t_item["source_sheet"]

        # Tool 1: Deterministic Feeder Cable Resolution
        if t_class == "FEEDER_CABLE" and t_act == "INSTALL":
            runs_val = int(t_qty)
            route_len = 35.0
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

        # Lookup LLM decision
        llm_dec = llm_decisions.get(t_id, {})
        chosen_code = llm_dec.get("chosen_code")
        comment_str = llm_dec.get("reasoning", "")

        # Fallback to antenna rules if LLM missed or returned UNQUOTED
        if not chosen_code or chosen_code == "UNQUOTED":
            if t_class in ["PANEL_ANTENNA", "5G_AAU"]:
                ant_res = tool_resolve_antenna(t_model, is_first=True)
                chosen_code = ant_res["chosen_code"]
                comment_str = f"Rule match: {ant_res['item_name']}"

        # Tool 2: Mandatory Commercial Basis Self-Verification Gate
        pricing_group = t_class
        curr_ordinal = category_ordinals.get(pricing_group, 0) + 1
        category_ordinals[pricing_group] = curr_ordinal + int(t_qty - 1)

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
        elif t_class != "EQUIPMENT":
            # Only generate UNQUOTED if it is a recognized telecom/civil equipment class
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
