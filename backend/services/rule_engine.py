"""
rule_engine.py - Deterministic Telecommunications BOQ Quantity & Rules Engine

Evaluates canonical drawing Scope Graphs against structured price catalog items.
Zero hardcoded SOR codes, zero hardcoded project quantities.
"""

from typing import Dict, Any, List, Optional
import re

def evaluate_scope_graph(
    scope_graph: Dict[str, Any],
    price_items: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Deterministically computes BOQ line items by executing standard calculation
    handlers on the extracted Scope Graph according to the database metadata.
    """
    equipment_list = scope_graph.get("physical_equipment", [])
    site_scopes = scope_graph.get("site_scopes", {})
    unquoted_list = scope_graph.get("unquoted_items", [])

    mapped_results: List[Dict[str, Any]] = []

    for p in price_items:
        code = p.get("code") or ""
        name = p.get("name") or ""
        rate = float(p.get("rate") or 0.0)
        unit = p.get("unit") or "each"
        row_idx = p.get("id") or p.get("row_idx")

        calc_rule = (p.get("calc_rule") or "").strip().upper()
        eq_type = (p.get("equipment_type") or "").strip().upper()
        act_type = (p.get("action_type") or "").strip().upper()
        loc_type = (p.get("location_type") or "").strip().upper()
        agg_rule = (p.get("aggregation_rule") or "SUM").strip().upper()
        pricing_group = p.get("pricing_group") or ""

        if not calc_rule:
            continue

        qty = 0
        sources: List[Dict[str, Any]] = []
        comment = ""

        # -------------------------------------------------------------------------
        # Handler 1: PER_SECTOR (e.g. W13374 Blackbird First Carrier Testing)
        # -------------------------------------------------------------------------
        if calc_rule == "PER_SECTOR":
            sec_4g = int(site_scopes.get("proposed_4g_sectors", 0))
            sec_5g = int(site_scopes.get("proposed_5g_sectors", 0))
            qty = sec_4g + sec_5g
            if qty > 0:
                comment = f"{qty} technology sectors ({sec_4g}x 4G sectors, {sec_5g}x 5G sectors) first carrier testing"
                for eq in equipment_list:
                    if eq.get("action") == "INSTALL" and eq.get("equipment_type") in ["PANEL_ANTENNA", "5G_AAU"]:
                        sources.append({
                            "ant_id": eq.get("id", "-"),
                            "model": eq.get("model", ""),
                            "action": "INSTALL",
                            "source_table": eq.get("table", "Antenna Configuration Table"),
                            "source_sheet": eq.get("sheet", "Antenna Schedule"),
                            "page": eq.get("page", 1),
                            "quantity": 1
                        })

        # -------------------------------------------------------------------------
        # Handler 2: EXTRA_CARRIER (e.g. W13400 Blackbird Extra-Over Carriers)
        # -------------------------------------------------------------------------
        elif calc_rule == "EXTRA_CARRIER":
            ant_sources = []
            for eq in equipment_list:
                if eq.get("action") == "INSTALL" and eq.get("equipment_type") in ["PANEL_ANTENNA", "5G_AAU"]:
                    c_lines = int(eq.get("carrier_lines") or 1)
                    eo_count = max(0, c_lines - 1)
                    qty += eo_count
                    if eo_count > 0:
                        ant_sources.append({
                            "ant_id": eq.get("id", "-"),
                            "model": f"{eq.get('model', '')} ({c_lines} lines)",
                            "action": "INSTALL",
                            "source_table": eq.get("table", "Antenna Configuration Table"),
                            "source_sheet": eq.get("sheet", "Antenna Schedule"),
                            "page": eq.get("page", 1),
                            "quantity": eo_count
                        })
            sources = ant_sources
            if qty > 0:
                comment = f"{qty} extra-over carriers across {len(ant_sources)} antennas"

        # -------------------------------------------------------------------------
        # Handler 3: REUSED_CABLES (e.g. W13375 PIM / Sweep testing to reused feeders)
        # -------------------------------------------------------------------------
        elif calc_rule == "REUSED_CABLES":
            if site_scopes.get("feeder_pim_test_required", True):
                coax = int(site_scopes.get("reused_coaxial_cables", 0))
                hyb = int(site_scopes.get("reused_hybrid_cables", 0))
                qty = coax + hyb
                if qty > 0:
                    models = ", ".join(site_scopes.get("reused_feeder_models", []))
                    comment = f"Reuse {coax}x coaxial and {hyb}x hybrid cables ({models}). As per drawing notes, PIM test is required on existing feeders."
                    sources = [{
                        "ant_id": "FEEDER-REUSE",
                        "model": models or "Reused Feeder & Hybrid Cables",
                        "action": "REUSE",
                        "source_table": "Equipment Notes / Feeder Schedule",
                        "source_sheet": "Feeder Schedule",
                        "page": 4,
                        "quantity": qty
                    }]

        # -------------------------------------------------------------------------
        # Handler 4: SUM_TYPES (e.g. R12513 Tower Antenna, TMA, and Tower RRU Removals)
        # -------------------------------------------------------------------------
        elif calc_rule == "SUM_TYPES" and eq_type == "ANTENNA_TMD_RRU":
            for eq in equipment_list:
                if eq.get("action") != "REMOVE":
                    continue
                # Strictly evaluate tower-mounted outdoor scope
                is_tower = (eq.get("location") or "TOWER").upper() == "TOWER"
                if not is_tower:
                    continue
                
                cur_type = eq.get("equipment_type", "")
                if cur_type in ["PANEL_ANTENNA", "5G_AAU", "TMD", "RRU"]:
                    eq_qty = int(eq.get("quantity") or 1)
                    qty += eq_qty
                    sources.append({
                        "ant_id": eq.get("id", "-"),
                        "model": eq.get("model", ""),
                        "action": "REMOVE",
                        "source_table": eq.get("table", "Schedule"),
                        "source_sheet": eq.get("sheet", "Drawing Sheet"),
                        "page": eq.get("page", 1),
                        "quantity": eq_qty
                    })
            if qty > 0:
                n_ant = len([s for s in sources if any(k in s['model'].upper() for k in ['PANEL', 'AIR', 'DELTEC', 'ARGUS'])])
                n_tma = len([s for s in sources if 'TMA' in s['model'].upper() or 'FILTER' in s['model'].upper()])
                n_rru = len([s for s in sources if 'RRU' in s['model'].upper() or 'RADIO' in s['model'].upper()])
                comment = f"{qty} removals on tower ({n_ant} antennas, {n_tma} TMAs, {n_rru} RRUs)"

        # -------------------------------------------------------------------------
        # Handler 5: BASEBAND & RACK RECOVERY (e.g. R13701)
        # -------------------------------------------------------------------------
        elif eq_type == "BASEBAND_RACK" and act_type == "REMOVE":
            matching = [
                eq for eq in equipment_list
                if eq.get("action") == "REMOVE"
                and (eq.get("equipment_type") in ["BASEBAND", "TRAY"] or any(k in eq.get("model", "").upper() for k in ["BB6", "BB5", "BASEBAND", "DUW", "DUS", "R503", "FIBRE MANAGEMENT"]))
                and not any(k in eq.get("model", "").upper() for k in ["RADIO", "RRU", "FILTER", "BANDSTOP", "GPS"])
                and (eq.get("location") or "SHELTER").upper() == "SHELTER"
            ]
            qty = sum(int(m.get("quantity") or 1) for m in matching)
            sources = [{
                "ant_id": m.get("id", "-"),
                "model": m.get("model", ""),
                "action": "REMOVE",
                "source_table": m.get("table", "Equipment Notes"),
                "source_sheet": m.get("sheet", "Equipment Notes"),
                "page": m.get("page", 4),
                "quantity": int(m.get("quantity") or 1)
            } for m in matching]
            if qty > 0:
                comment = ", ".join(f"{s['quantity']}x {s['model']}" for s in sources)

        # -------------------------------------------------------------------------
        # Handler 6: ROUTER & SLIDEOUT TRAY RELOCATION (e.g. W13700)
        # -------------------------------------------------------------------------
        elif eq_type == "ROUTER_TRAY" and act_type == "RELOCATE":
            matching = [
                eq for eq in equipment_list
                if eq.get("action") == "RELOCATE"
                and eq.get("equipment_type") in ["ROUTER", "TRAY", "ROUTER_TRAY", "OTHER"]
            ]
            qty = sum(int(m.get("quantity") or 1) for m in matching)
            sources = [{
                "ant_id": m.get("id", "-"),
                "model": m.get("model", ""),
                "action": "RELOCATE",
                "source_table": m.get("table", "Equipment Notes"),
                "source_sheet": m.get("sheet", "Equipment Notes"),
                "page": m.get("page", 4),
                "quantity": int(m.get("quantity") or 1)
            } for m in matching]
            if qty > 0:
                comment = ", ".join(f"{s['quantity']}x {s['model']} relocated" for s in sources)

        # -------------------------------------------------------------------------
        # Handler 7: COMPOSITE_ONE (e.g. W12804 GPS System Swap)
        # -------------------------------------------------------------------------
        elif calc_rule == "COMPOSITE_ONE":
            matching = [
                eq for eq in equipment_list
                if eq.get("equipment_type") == eq_type or "GPS" in eq.get("model", "").upper()
            ]
            if matching:
                qty = 1
                sources = [{
                    "ant_id": m.get("id", "-"),
                    "model": m.get("model", ""),
                    "action": act_type or "INSTALL",
                    "source_table": m.get("table", "Equipment Notes"),
                    "source_sheet": m.get("sheet", "Equipment Notes"),
                    "page": m.get("page", 4),
                    "quantity": 1
                } for m in matching]
                comment = "Complete GPS system swap (antenna, receiver unit, cables)"

        # -------------------------------------------------------------------------
        # Handler 8: FIRST / EXTRA / ALL Standard Handlers
        # -------------------------------------------------------------------------
        elif calc_rule in ["FIRST", "EXTRA", "ALL"]:
            matching = []
            for eq in equipment_list:
                if eq_type and eq.get("equipment_type") != eq_type:
                    continue
                if act_type and eq.get("action") != act_type:
                    continue
                if loc_type and loc_type != "SITE":
                    item_loc = (eq.get("location") or "TOWER").upper()
                    if item_loc != loc_type:
                        continue
                matching.append(eq)

            total_matching_qty = sum(int(m.get("quantity") or 1) for m in matching)

            if calc_rule == "FIRST":
                qty = min(total_matching_qty, 1)
                if matching and qty > 0:
                    first_m = matching[0]
                    sources = [{
                        "ant_id": first_m.get("id", "-"),
                        "model": first_m.get("model", ""),
                        "action": act_type or "INSTALL",
                        "source_table": first_m.get("table", "Schedule"),
                        "source_sheet": first_m.get("sheet", "Drawing Sheet"),
                        "page": first_m.get("page", 1),
                        "quantity": 1
                    }]
            elif calc_rule == "EXTRA":
                qty = max(total_matching_qty - 1, 0)
                if len(matching) > 1 and qty > 0:
                    sources = [{
                        "ant_id": m.get("id", "-"),
                        "model": m.get("model", ""),
                        "action": act_type or "INSTALL",
                        "source_table": m.get("table", "Schedule"),
                        "source_sheet": m.get("sheet", "Drawing Sheet"),
                        "page": m.get("page", 1),
                        "quantity": int(m.get("quantity") or 1)
                    } for m in matching[1:]]
            elif calc_rule == "ALL":
                qty = total_matching_qty
                if qty > 0:
                    sources = [{
                        "ant_id": m.get("id", "-"),
                        "model": m.get("model", ""),
                        "action": act_type or "INSTALL",
                        "source_table": m.get("table", "Schedule"),
                        "source_sheet": m.get("sheet", "Drawing Sheet"),
                        "page": m.get("page", 1),
                        "quantity": int(m.get("quantity") or 1)
                    } for m in matching]
                    comment = ", ".join(f"{s['quantity']}x {s['model']}" for s in sources)

        # Append to mapped results if billable quantity exists
        if qty > 0:
            total_cost = qty * rate
            mapped_results.append({
                "row_idx": row_idx,
                "sor_code": code,
                "item_name": name,
                "quantity": qty,
                "unit": unit,
                "rate": rate,
                "total_cost": total_cost,
                "comment": comment,
                "action": act_type or "INSTALL",
                "sources": sources,
                "aggregation_rule": agg_rule,
                "similarity": 100.0,
                "confidence_score": 100.0,
                "confidence_level": "HIGH",
                "auto_matched": True,
                "matched_by_rule": f"Deterministic Engine ({calc_rule})"
            })

    # Append unquoted non-SOR items
    for u_idx, u in enumerate(unquoted_list):
        u_qty = float(u.get("quantity") or 1.0)
        u_desc = u.get("description") or "Unquoted Scope Item"
        mapped_results.append({
            "row_idx": None,
            "sor_code": "UNQUOTED",
            "item_name": u_desc,
            "quantity": u_qty,
            "unit": "each",
            "rate": 0.0,
            "total_cost": 0.0,
            "comment": f"Estimator need to fill: [{u_desc}]",
            "action": "INSTALL",
            "sources": [{
                "ant_id": "-",
                "model": u_desc,
                "action": "INSTALL",
                "source_table": "Unquoted Scope",
                "source_sheet": u.get("sheet", "Drawing Sheet"),
                "page": u.get("page", 1),
                "quantity": u_qty
            }],
            "aggregation_rule": "SUM",
            "similarity": 100.0,
            "confidence_score": 75.0,
            "confidence_level": "MEDIUM",
            "auto_matched": False,
            "matched_by_rule": "Unquoted Scope Detection"
        })

    return mapped_results
