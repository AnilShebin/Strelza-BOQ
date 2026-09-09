"""
retriever_service.py - Vector Precedent Search Service

Performs vector similarity search over historical CorrectionRecord entries to supply
few-shot estimator precedents for the LLM Judge.
"""

import os
import json
import math
import re
from typing import List, Dict, Any

FEEDBACK_STORE_PATH = os.path.join(os.path.dirname(__file__), "../uploads/corrections_store.json")

def tokenize(text: str) -> List[str]:
    """Tokenizes text into uppercase word tokens."""
    return [w.upper() for w in re.findall(r'\b\w+\b', text or "")]

def compute_tf_vector(text: str) -> Dict[str, float]:
    """Computes Term Frequency vector for text."""
    tokens = tokenize(text)
    if not tokens:
        return {}
    tf = {}
    for t in tokens:
        tf[t] = tf.get(t, 0) + 1.0
    n = float(len(tokens))
    for t in tf:
        tf[t] = tf[t] / n
    return tf

def cosine_similarity(v1: Dict[str, float], v2: Dict[str, float]) -> float:
    """Computes cosine similarity between two term-frequency dicts."""
    common = set(v1.keys()).intersection(set(v2.keys()))
    dot = sum(v1[k] * v2[k] for k in common)
    mag1 = math.sqrt(sum(val ** 2 for val in v1.values()))
    mag2 = math.sqrt(sum(val ** 2 for val in v2.values()))
    if mag1 == 0 or mag2 == 0:
        return 0.0
    return dot / (mag1 * mag2)

def load_corrections_store() -> List[Dict[str, Any]]:
    """Loads correction records from disk storage."""
    filepath = os.path.abspath(FEEDBACK_STORE_PATH)
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Retriever Service] Error reading feedback store: {e}")
            return []
    return []

def retrieve_precedents(
    takeoff_item: Dict[str, Any],
    k: int = 3
) -> List[Dict[str, Any]]:
    """
    Retrieves top-k most similar historical CorrectionRecord precedents for a takeoff item.
    """
    store = load_corrections_store()
    if not store:
        return []

    t_desc = takeoff_item.get("model") or takeoff_item.get("raw_text") or takeoff_item.get("raw_description") or ""
    t_sem = takeoff_item.get("equipment_type") or takeoff_item.get("semantic_class") or ""
    t_act = takeoff_item.get("action") or takeoff_item.get("commercial_action") or ""

    query_text = f"{t_desc} {t_sem} {t_act}"
    q_vec = compute_tf_vector(query_text)

    scored_precedents = []
    for record in store:
        item_snapshot = record.get("takeoff_item", {})
        r_desc = item_snapshot.get("raw_description") or item_snapshot.get("model") or ""
        r_sem = item_snapshot.get("semantic_class") or item_snapshot.get("equipment_type") or ""
        r_act = item_snapshot.get("commercial_action") or item_snapshot.get("action") or ""

        doc_text = f"{r_desc} {r_sem} {r_act}"
        d_vec = compute_tf_vector(doc_text)

        score = cosine_similarity(q_vec, d_vec)
        if r_sem and r_sem == t_sem:
            score += 0.2
        if r_act and r_act == t_act:
            score += 0.1

        scored_precedents.append({
            "record": record,
            "similarity_score": round(score, 4)
        })

    scored_precedents.sort(key=lambda x: x["similarity_score"], reverse=True)
    return [p["record"] for p in scored_precedents[:k]]
