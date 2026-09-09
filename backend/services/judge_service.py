"""
judge_service.py - LLM-Judge Evaluation Service

Invokes Gemini LLM API (with robust retries and model fallback) to evaluate:
- Takeoff item profile
- Shortlisted candidates (from constraint gate)
- Historical RAG precedents (from retriever service)

Outputs a structured MatchDecision dictionary.
"""

import os
import json
import time
import urllib.request
import urllib.error
from typing import List, Dict, Any

MODELS_TO_TRY = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest"]

def call_llm_judge(prompt: str, api_key: str) -> str:
    """Calls Gemini API with retries and fallback."""
    if not api_key:
        return ""

    for model_name in MODELS_TO_TRY:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.0
            }
        }
        data = json.dumps(payload).encode("utf-8")

        for attempt in range(2):
            try:
                req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
                with urllib.request.urlopen(req, timeout=45) as resp:
                    res_json = json.loads(resp.read().decode("utf-8"))
                    return res_json["candidates"][0]["content"]["parts"][0]["text"]
            except Exception:
                time.sleep(1)

    return ""

def evaluate_takeoff_match(
    takeoff_item: Dict[str, Any],
    candidates: List[Dict[str, Any]],
    precedents: List[Dict[str, Any]],
    api_key: str = ""
) -> Dict[str, Any]:
    """
    Executes LLM-Judge reasoning over candidates and RAG precedents.
    """
    item_id = takeoff_item.get("id") or takeoff_item.get("item_id") or "item-unknown"
    desc = takeoff_item.get("model") or takeoff_item.get("raw_text") or takeoff_item.get("raw_description") or ""

    if not candidates:
        return {
            "takeoff_item_id": item_id,
            "chosen_code": None,
            "confidence": 0.0,
            "reasoning": "Constraint gate eliminated all candidates. Item is a non-SOR unpriced scope.",
            "alternative_candidates": [],
            "outcome": "NO_MATCH",
            "retrieved_precedents_used": []
        }

    # Format precedents
    precedent_text = []
    for p in precedents:
        t_snap = p.get("takeoff_item", {})
        precedent_text.append(
            f"- Precedent ID: {p.get('id')} | Description: '{t_snap.get('raw_description')}' | Correct Code: '{p.get('corrected_code')}' | Reason: '{p.get('correction_reason')}'"
        )
    formatted_precedents = "\n".join(precedent_text) if precedent_text else "No historical precedents retrieved."

    # Format candidates
    formatted_candidates = []
    for c in candidates:
        rule_desc = str(c.get('mapping_rule') or c.get('description') or '').strip()
        formatted_candidates.append(
            f"- Code: {c.get('code')} | Name: '{c.get('name') or c.get('description')}' | Unit: {c.get('unit')}{f' | Prompt Rule: {rule_desc}' if rule_desc else ''}"
        )
    candidate_str = "\n".join(formatted_candidates)

    prompt = f"""You are an expert commercial construction and telecom estimator judge.
Evaluate the drawing Takeoff Item against shortlisted SOR candidates and historical precedents.

TAKEOFF ITEM:
- ID: {item_id}
- Description: "{desc}"
- Class: {takeoff_item.get('equipment_type') or takeoff_item.get('semantic_class')}
- Action: {takeoff_item.get('action') or takeoff_item.get('commercial_action')}
- Quantity: {takeoff_item.get('quantity', 1)}
- Unit: {takeoff_item.get('unit', 'EACH')}

HISTORICAL PRECEDENTS:
{formatted_precedents}

SHORTLISTED CANDIDATES:
{candidate_str}

JUDGING RULES:
1. Select the single correct SOR code or choose null if item is unpriced non-SOR.
2. FEEDER CABLE RULES:
   - Cable Diameter Identification: Match cable model codes to nominal diameters: LCF12 / LDF4 = ½”, LCF78 / LDF5 = ⅞”, LCF114 / LDF6 = 1¼”, LCF158 / LDF7 = 1⅝”.
   - Multiplicity: Single cable run = x 1 (single), 2 cable runs = x 2 (one pair), 6 cable runs = x 6 (three pair).
   - Length / Extra Over: Route lengths exceeding base threshold (50m for ½” & ⅞”, 100m for 1¼” & 1⅝”) map to corresponding Extra Over per Lm item.
   - Authority & Cross-Verification: Equipment Notes / Cable Schedule is primary authority; cross-check layout pages and preserve table quantity.
3. If two candidates score equally close, set outcome = "AMBIGUOUS" with confidence <= 0.60.
4. Return ONLY valid JSON matching this schema:
{{
  "takeoff_item_id": "{item_id}",
  "chosen_code": "string or null",
  "confidence": 0.95,
  "reasoning": "step-by-step justification",
  "outcome": "MATCHED",
  "retrieved_precedents_used": ["id1"]
}}"""

    raw = call_llm_judge(prompt, api_key)
    if raw:
        try:
            res = json.loads(raw.strip())
            res["takeoff_item_id"] = item_id
            return res
        except Exception:
            pass

    # Deterministic fallback judge if API call fails
    return fallback_judge(takeoff_item, candidates, precedents)

def fallback_judge(
    takeoff_item: Dict[str, Any],
    candidates: List[Dict[str, Any]],
    precedents: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Deterministic fallback judge evaluating precedence and heuristic rank."""
    item_id = takeoff_item.get("id") or takeoff_item.get("item_id") or "item-unknown"
    desc_upper = (takeoff_item.get("model") or takeoff_item.get("raw_text") or takeoff_item.get("raw_description") or "").upper()

    # Precedent match check
    for p in precedents:
        p_desc = (p.get("takeoff_item", {}).get("raw_description") or "").upper()
        p_code = p.get("corrected_code")
        if p_code and p_desc and any(tok in desc_upper for tok in p_desc.split() if len(tok) > 3):
            return {
                "takeoff_item_id": item_id,
                "chosen_code": p_code if p_code != "UNQUOTED" else None,
                "confidence": 0.92,
                "reasoning": f"Matched code '{p_code}' based on retrieved precedent record [{p.get('id')}].",
                "outcome": "MATCHED" if p_code != "UNQUOTED" else "NO_MATCH",
                "retrieved_precedents_used": [p.get("id")]
            }

    if not candidates:
        return {
            "takeoff_item_id": item_id,
            "chosen_code": None,
            "confidence": 0.0,
            "reasoning": "No candidates available.",
            "outcome": "NO_MATCH",
            "retrieved_precedents_used": []
        }

    top_cand = candidates[0]
    return {
        "takeoff_item_id": item_id,
        "chosen_code": top_cand.get("code"),
        "confidence": 0.85,
        "reasoning": f"Matched candidate '{top_cand.get('code')}' based on attribute rank.",
        "outcome": "MATCHED",
        "retrieved_precedents_used": []
    }
