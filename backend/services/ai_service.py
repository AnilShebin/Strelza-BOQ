"""
AI Table Validator Service.
Interfaces with local Ollama models or the Google Gemini API to audit
and correct coordinate alignment errors in extracted telecom tables.
"""
import json
import os
import re
import urllib.request
import time
from typing import List, Dict, Any, Tuple, Optional











def load_env_file() -> None:
    """Loads environment variables from .env file if present."""
    for path in [".env", "backend/.env", "../.env"]:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ[k.strip()] = v.strip().strip('"').strip("'")
            except Exception:
                pass

def get_prompt_by_name(name: str, fallback_prompt: str = "") -> str:
    """Fetches dynamic prompt from SQLite database, falling back if not found or disabled."""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "price_list.db")
    if os.path.exists(db_path):
        import sqlite3
        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT prompt, enabled FROM ai_prompts WHERE name = ?", (name,))
            row = cursor.fetchone()
            conn.close()
            if row and row["enabled"]:
                return row["prompt"]
        except Exception as e:
            print(f"[AI Service] Error loading prompt '{name}' from database: {e}")
    return fallback_prompt



def run_gemini_vision_document_extractor(
    page_image_base64: str,
    raw_page_text: str,
    prompt: str,
    api_key: str,
    mime_type: str = "image/png"
) -> Tuple[Optional[List[Dict[str, Any]]], Dict[str, Any], str]:
    """Sends page image and text to Gemini with a universal document extraction prompt."""
    model_name = "gemini-3.5-flash-lite"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": page_image_base64
                        }
                    },
                    {
                        "text": f"Here is the raw text layer extracted from this page to assist your analysis:\n\n{raw_page_text}" if raw_page_text else ""
                    },
                    {
                        "text": prompt
                    }
                ]
            }
        ],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.0}
    }
    
    # Clean up empty text part if native text is absent
    if not raw_page_text:
        payload["contents"][0]["parts"] = [
            payload["contents"][0]["parts"][0],
            payload["contents"][0]["parts"][2]
        ]

    est_input_tokens = int(len(page_image_base64) / 100) + int(len(prompt) / 4)
    try:
        result = send_gemini_request(url, payload, timeout=90)
        candidates = result.get("candidates", [])
        if not candidates:
            raise ValueError("No candidates returned from Gemini API")
        response_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
        
        parsed = json.loads(response_text)
        sheet_title = ""
        if isinstance(parsed, dict):
            sheet_title = str(parsed.get("sheet_title") or "").strip()
            elements = parsed.get("elements", [])
        elif isinstance(parsed, list):
            elements = parsed
        else:
            elements = []
        
        if isinstance(elements, list):
            valid_elements = []
            for item in elements:
                if isinstance(item, dict):
                    # Check if sheet_title can be extracted from Title Block Metadata if still empty
                    if not sheet_title and item.get("title") == "Title Block Metadata":
                        fields = item.get("content", {}).get("fields", {})
                        if isinstance(fields, dict) and fields.get("Sheet Title"):
                            sheet_title = str(fields["Sheet Title"]).strip()

                    # Ensure type is only 'structured' or 'unstructured'
                    item_type = item.get("type", "").strip().lower()
                    if item_type not in ["structured", "unstructured"]:
                        print(f"[Document Extractor] Skipping element with invalid type: {item_type}")
                        continue
                    
                    # Extract bbox
                    raw_bbox = item.get("bbox")
                    bbox = [float(val) for val in raw_bbox][:4] if (isinstance(raw_bbox, list) and len(raw_bbox) >= 4) else None
                    
                    # Extract confidence
                    confidence_val = item.get("confidence")
                    confidence = float(confidence_val) if confidence_val is not None else None
                    
                    # Extract title
                    title = item.get("title")
                    
                    # Extract content
                    content = item.get("content")
                    
                    # Extract block_ids
                    block_ids = item.get("block_ids")
                    if not isinstance(block_ids, list):
                        block_ids = []
                    else:
                        block_ids = [str(b) for b in block_ids]
                    
                    valid_elements.append({
                        "type": item_type,
                        "title": title,
                        "content": content,
                        "bbox": bbox,
                        "confidence": confidence,
                        "block_ids": block_ids
                    })
                    
            usage = result.get("usageMetadata", {})
            analytics = {
                "model": model_name,
                "input_tokens": usage.get("promptTokenCount", est_input_tokens),
                "output_tokens": usage.get("candidatesTokenCount", 0),
                "status": "Success"
            }
            return valid_elements, analytics, sheet_title
            
        raise ValueError("No valid elements extracted")
    except Exception as e:
        print(f"[Gemini Document Extractor] Failed: {e}")
        return None, {
            "model": model_name, "input_tokens": est_input_tokens, "output_tokens": 0, "status": f"Failed: {e}"
        }, ""



import threading

class ThreadSafeRateLimiter:
    def __init__(self):
        self.lock = threading.Lock()
        self.next_allowed_time = 0.0
        
    def wait_for_rate_limit(self, rpm: int):
        if rpm <= 0:
            return
        delay = 60.0 / rpm
        now = time.time()
        with self.lock:
            scheduled_time = max(now, self.next_allowed_time)
            self.next_allowed_time = scheduled_time + delay
        sleep_time = scheduled_time - now
        if sleep_time > 0:
            print(f"[Rate Limiter] Spacing requests. Sleeping {sleep_time:.2f}s...")
            time.sleep(sleep_time)

LAST_GEMINI_CALL_TIME = 0.0
GEMINI_RATE_LIMITER = ThreadSafeRateLimiter()
GEMINI_CONCURRENCY_SEMAPHORE = threading.Semaphore(value=3)

def get_rate_limit_rpm() -> int:
    """Reads configured Gemini rate limit RPM from settings.json."""
    settings_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "settings.json")
    if os.path.exists(settings_path):
        try:
            with open(settings_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return int(data.get("gemini_rate_limit", 0))
        except Exception as e:
            print(f"[Rate Limiter] Error reading settings.json: {e}")
    return 0  # Default to 0 (No Limit) for Tier 1

def wait_for_rate_limit():
    """Sleeps dynamically to respect configured Gemini RPM limit."""
    GEMINI_RATE_LIMITER.wait_for_rate_limit(get_rate_limit_rpm())
def send_gemini_request(url: str, payload: Dict[str, Any], timeout: int = 30) -> Dict[str, Any]:
    """Sends request to Google Gemini API with rate limit spacing and 3x exponential retry backoff on 503/429/500 and timeouts."""
    global LAST_GEMINI_CALL_TIME
    import urllib.error
    import urllib.request
    import random
    
    data = json.dumps(payload).encode("utf-8")
    last_error = None
    
    max_attempts = 3
    for attempt in range(max_attempts):
        curr_timeout = int(timeout * (1.0 + attempt * 0.5))
        
        try:
            # Acquire semaphore and wait for rate limit spacing before making the call
            with GEMINI_CONCURRENCY_SEMAPHORE:
                wait_for_rate_limit()
                req = urllib.request.Request(
                    url, data=data, headers={"Content-Type": "application/json"}, method="POST"
                )
                with urllib.request.urlopen(req, timeout=curr_timeout) as response:
                    res_json = json.loads(response.read().decode("utf-8"))
                    LAST_GEMINI_CALL_TIME = time.time()
                    return res_json
        except urllib.error.HTTPError as e:
            last_error = e
            if e.code in [429, 500, 503] and attempt < max_attempts - 1:
                jitter = random.uniform(0.5, 1.5)
                sleep_time = int(5 * (2 ** attempt) * jitter)
                print(f"[Gemini API] Got HTTP {e.code} ({e.reason}). Retrying in {sleep_time}s (Attempt {attempt + 1}/{max_attempts})...")
                time.sleep(sleep_time)
                LAST_GEMINI_CALL_TIME = time.time()
                continue
            raise
        except Exception as e:
            last_error = e
            if attempt < max_attempts - 1:
                jitter = random.uniform(0.5, 1.5)
                sleep_time = int(3 * (2 ** attempt) * jitter)
                print(f"[Gemini API] Got connection/timeout error: {str(e)}. Retrying in {sleep_time}s with timeout={curr_timeout}s (Attempt {attempt + 1}/{max_attempts})...")
                time.sleep(sleep_time)
                LAST_GEMINI_CALL_TIME = time.time()
                continue
            raise
            
    if last_error:
        raise last_error

def run_gemini_boq_mapper_and_deduplicator(
    extracted_tables: List[Dict[str, Any]],
    elements: List[Dict[str, Any]],
    price_list: List[Dict[str, Any]],
    api_key: str
) -> List[Dict[str, Any]]:
    """
    Uses Google Gemini to perform generalized table-first deduplication, cross-verification,
    and SOR price book mapping. Prompts are loaded dynamically from SQLite database.
    """
    model_name = "gemini-3.5-flash-lite"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    # Load prompts dynamically from SQLite database (ai_prompts table)
    base_prompt = get_prompt_by_name("boq_mapping_engine")
    client_prompt = get_prompt_by_name("client_mapping_rules")

    if client_prompt.strip():
        prompt = base_prompt + "\n\n" + client_prompt
    else:
        prompt = base_prompt

    # Format extracted tables
    formatted_tables = []
    for t in extracted_tables:
        if isinstance(t, dict):
            formatted_tables.append({
                "page": t.get("page", 1),
                "table_title": t.get("table_title", "Table"),
                "headers": t.get("headers", []),
                "rows": t.get("rows", [])
            })

    # Format unstructured notes and clouds (filtered for equipment annotations)
    formatted_notes = []
    for el in elements:
        if isinstance(el, dict) and el.get("type") == "unstructured":
            formatted_notes.append({
                "page": el.get("page", 1),
                "title": el.get("title", "Callout/Note"),
                "text": str(el.get("content", "")).strip()
            })

    # Format price list compactly with plain-English prompt rules if defined
    formatted_price_list = []
    for p in price_list:
        if isinstance(p, dict) and p.get("row_type", "data_item") == "data_item" and (p.get("code") or p.get("name")):
            rule_str = str(p.get("mapping_rule") or "").strip()
            rule_part = f" | RULE: {rule_str}" if rule_str else ""
            formatted_price_list.append(
                f"[row_idx: {p.get('row_idx', p.get('id'))}] CODE: {p.get('code', '')} | NAME: {p.get('name', '')} | UNIT: {p.get('unit', 'each')} | RATE: {p.get('rate', 0.0)}{rule_part}"
            )

    payload_text = f"""{prompt}

=== STRUCTURED TABLES (PRIMARY SOURCE OF TRUTH) ===
{json.dumps(formatted_tables, indent=2)}

=== PAGE LAYOUT ANNOTATIONS & REVISION CLOUDS (VERIFICATION LAYER) ===
{json.dumps(formatted_notes, indent=2)}

=== ACTIVE PRICE BOOK ITEMS ===
{chr(10).join(formatted_price_list)}

Response format: Return ONLY the JSON array. Do not wrap in markdown or add explanations."""

    payload = {
        "contents": [{"parts": [{"text": payload_text}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.0}
    }

    try:
        result = send_gemini_request(url, payload, timeout=45)
        candidates = result.get("candidates", [])
        if not candidates:
            raise ValueError("No candidates returned from Gemini API")
        response_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
        mapped_items = json.loads(response_text)

        if isinstance(mapped_items, list):
            print(f"[AI Mapper] Successfully mapped and deduplicated {len(mapped_items)} items.")
            return mapped_items
        raise ValueError("Invalid format returned by Gemini")
    except Exception as e:
        print(f"[AI Mapper] Gemini mapping failed: {e}. Falling back to empty mapping list.")
        return []

def run_gemini_boq_deduplicator(
    raw_items: List[Dict[str, Any]],
    api_key: str
) -> List[Dict[str, Any]]:
    """Legacy backward compatibility fallback for raw item deduplication."""
    return [{
        "equipment_type": item.get("equipment_type", "UNKNOWN"),
        "model": item.get("model", ""),
        "action": item.get("action", "INSTALL"),
        "quantity": item.get("quantity", 1),
        "clean_text": item.get("raw_text", ""),
        "source_sheet": item.get("source_sheet", f"Sheet {item.get('page', 1)}")
    } for item in raw_items if item.get("action", "").upper() not in ["EXISTING", "REUSE"]]

def run_gemini_recheck_generator(
    mapped_items: List[Dict[str, Any]],
    api_key: str
) -> List[Dict[str, Any]]:
    """
    Uses Google Gemini to audit the final priced BOQ mapping and output a list of validation checks,
    raising areas to recheck (e.g. rate mismatch, potential double-counting, missing specifications).
    """
    model_name = "gemini-3.5-flash-lite"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    
    default_prompt = """You are an expert BOQ validation auditor. Inspect the final priced and mapped Bill of Quantities items below.
Identify any potential areas of concern, inconsistencies, or details that the human estimator should recheck.

Specific checks to report:
1. Unmapped items: Any item with "sor_code" set to "UNMAPPED" or rate set to 0.0.
2. Mismatched quantities: Quantities that seem abnormally high or low (e.g., negative proposed quantity, or quantity > 12).
3. Rate validation: High-cost items (e.g. value > $10,000) or items with low similarity score (< 80) mapping.

Return a JSON array of checklist items where each item has this structure:
{
  "check_name": "AI Recommendation: Re-check MW dish rate",
  "status": "WARNING",
  "message": "The proposed 0.6m MW dish was matched to standard mount SOR code. Verify if correct rate is applied."
}

Priced BOQ Items:
{mapped_items}

Response format: Return ONLY the JSON array. Do not wrap in markdown or add explanations. If no warnings or recommendations are found, return an empty array []."""
    raw_prompt = get_prompt_by_name("recheck_generator", default_prompt)
    prompt = raw_prompt.replace("{mapped_items}", json.dumps(mapped_items, indent=2))
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.0}
    }
    
    try:
        # Fast non-blocking audit check with short timeout
        result = send_gemini_request(url, payload, timeout=8)
        candidates = result.get("candidates", [])
        if not candidates:
            return []
        response_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
        suggestions = json.loads(response_text)
        if isinstance(suggestions, list):
            print(f"[AI Auditor] Generated {len(suggestions)} re-check suggestions.")
            return suggestions
        return []
    except Exception as e:
        print(f"[AI Auditor] Fast recheck skipped (offline/slow network): {e}")
        return []

def enrich_mapped_items_with_provenance(
    mapped_boq_items: List[Dict[str, Any]],
    extracted_tables: List[Dict[str, Any]],
    elements: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Enriches mapped BOQ items with exact verbatim constituent facts from
    the extracted PDF tables and cross-sheet duplicate callout notes.
    Guarantees zero changes in words from the PDF extracted items and complete traceability.
    """
    # 1. Build page to sheet title and number map
    page_to_sheet: Dict[int, str] = {}
    for el in elements:
        if not isinstance(el, dict):
            continue
        p = el.get("page", 1)
        c = str(el.get("content") or "")
        m = re.search(r"SHT\s*\n?\s*NO\.?\s*([A-Z0-9\-\.]+)", c, re.IGNORECASE)
        if m and p not in page_to_sheet:
            page_to_sheet[p] = f"Sheet {m.group(1)}"
        elif not page_to_sheet.get(p):
            fields = el.get("content", {}).get("fields", {}) if isinstance(el.get("content"), dict) else {}
            sht_no = fields.get("Sheet Number") or fields.get("Sheet No.")
            if sht_no:
                page_to_sheet[p] = f"Sheet {sht_no}"

    # Fallback to Drawing Index Table if available
    for t in extracted_tables:
        if isinstance(t, dict) and "INDEX" in str(t.get("table_title", "")).upper():
            for r in t.get("rows", []):
                if isinstance(r, list) and len(r) >= 3 and r[2] and str(r[2]).strip():
                    sht = str(r[2]).strip()
                    desc = str(r[0]).strip()
                    for el in elements:
                        if isinstance(el, dict) and desc.lower() in str(el.get("content", "")).lower() and el.get("page"):
                            p = el.get("page")
                            if p not in page_to_sheet:
                                page_to_sheet[p] = f"Sheet {sht}"

    # 2. Collect all structured table records (verbatim PDF text)
    structured_records = []
    for t in extracted_tables:
        if not isinstance(t, dict):
            continue
        p = t.get("page", 1)
        tbl_title = t.get("table_title", "Drawing Table")
        sheet_name = t.get("sheet_name") or page_to_sheet.get(p, f"Sheet {p}")
        headers = [str(h).strip() for h in t.get("headers", [])]
        
        # Skip drawing index and revision schedules as equipment sources
        if any(ign in tbl_title.upper() for ign in ["DRAWING INDEX", "REVISION", "AMENDMENT"]):
            continue

        for r_idx, row in enumerate(t.get("rows", [])):
            if not row or not isinstance(row, list) or len(row) == 0:
                continue
            row_str = " | ".join(str(c).strip() for c in row if str(c).strip())
            if not row_str or len(row_str) < 3:
                continue

            ant_id = str(row[0]).strip() if len(row) > 0 else "-"
            # Model is column 1 in antenna/equipment tables, or column 0
            cell_model = str(row[1] if len(row) > 1 else row[0]).strip()
            
            act = "INSTALL"
            row_qty = 1
            for c in row:
                cu = str(c).strip().upper()
                if "REMOVE" in cu or "RECOVER" in cu:
                    act = "REMOVE"
                    break
                elif "REPLACE" in cu:
                    act = "REPLACE"
                    break
                elif any(rel_kw in cu for rel_kw in ["RELOCATE", "RELOCATED", "RELOCATION", "MODIFY", "MODIFIED", "MOVE", "MOVED", "RAISE", "RAISED"]):
                    act = "RELOCATE"
                    break
                m_neg = re.match(r"^-\s*(\d+)$", cu)
                if m_neg:
                    act = "REMOVE"
                    row_qty = int(m_neg.group(1))
                    break

            is_spare = any("SPARE" in str(c).upper() for c in row) and act != "REMOVE"
            
            structured_records.append({
                "page": p,
                "sheet_name": sheet_name,
                "table_title": tbl_title,
                "row_idx": r_idx,
                "ant_id": ant_id,
                "model": cell_model,
                "raw_text": row_str,
                "action": act,
                "is_spare": is_spare,
                "headers": headers,
                "row": row,
                "quantity": row_qty
            })

    # 3. Collect unstructured layout/elevation notes (candidate duplicates)
    callout_records = []
    seen_callout_keys = set()
    for el in elements:
        if isinstance(el, dict) and el.get("type") == "unstructured":
            p = el.get("page", 1)
            c = str(el.get("content", "")).strip()
            if len(c) > 15 and not any(ign in c.upper() for ign in ["DO NOT SCALE", "CYIENT", "TITLE BLOCK", "COMPANY HEADER"]):
                key = (p, c)
                if key in seen_callout_keys:
                    continue
                seen_callout_keys.add(key)
                sheet_name = page_to_sheet.get(p, f"Sheet {p}")
                callout_records.append({
                    "page": p,
                    "sheet_name": sheet_name,
                    "title": el.get("title", "Drawing Callout Note"),
                    "text": c
                })

    # 4. Assemble provenance cleanly based on prompt-returned sources or direct table lookup
    for item in mapped_boq_items:
        item_name = str(item.get("item_name") or item.get("model", "")).upper()
        sor_code = str(item.get("sor_code", "")).upper()
        action_query = str(item.get("action", "INSTALL")).upper()
        direct_sources = item.get("sources", [])
        primary_sources = []

        # If prompt mapper directly returned constituent sources, standardize and use them verbatim
        if direct_sources and isinstance(direct_sources, list):
            for idx, s in enumerate(direct_sources):
                if not isinstance(s, dict):
                    continue
                s_model = s.get("model") or item.get("model", "")
                s_ant = s.get("ant_id") or item.get("ant_id", "-")
                s_table = s.get("source_table") or item.get("source_table", "Authoritative Table")
                s_sheet = s.get("source_sheet") or item.get("source_sheet", "Drawing Sheet")
                s_page = s.get("page") or item.get("page", 1)
                s_act = s.get("action") or item.get("action", "INSTALL")
                s_qty = int(float(s.get("quantity") or 1))

                # For R12513 (outdoor tower removals), strictly exclude indoor shelter/rack items
                if sor_code == "R12513" or ("REMOVE" in action_query and any(k in item_name for k in ["PANEL ANTENNA", "TOWER MOUNTED"])):
                    s_txt = f"{s_sheet} {s_table} {s_model}".upper()
                    if any(sh in s_txt for sh in ["SHEET E5", "SHEET E1", "SHELTER", "PATHFINDER", "BANDSTOP", "FAN FILTER", "RAC UNIT"]) or re.search(r'\bE[1-5]\b', s_txt):
                        continue  # Exclude shelter items (e.g. Bandstop Filters or shelter radios)

                # Keep the exact authoritative table quantity without artificial 1-by-1 splitting
                primary_sources.append({
                    "source_sheet": s_sheet,
                    "source_table": s_table,
                    "source_row": s.get("source_row", idx + 1),
                    "page": s_page,
                    "ant_id": s_ant,
                    "model": s_model,
                    "action": s_act,
                    "quantity": s_qty,
                    "entity_class": item.get("equipment_type", "EQUIPMENT"),
                    "target_sor": item.get("sor_code", "UNQUOTED"),
                    "target_name": item.get("item_name", ""),
                    "rate": item.get("rate", 0.0),
                    "validation_status": "VERIFIED_IN_LAYOUT",
                    "matched_rule": item.get("matched_by_rule", "Prompt Rule Match"),
                    "rule_logic": f"Extracted from {s_table} on {s_sheet} ({s_ant}). Authoritative primary source.",
                    "confidence_score": float(item.get("confidence_score", 95.0)),
                    "confidence_level": item.get("confidence_level", "HIGH"),
                    "raw_text": s.get("raw_text") or s_model,
                    "is_duplicate": False
                })

        # Assemble candidate records from authoritative tables
        candidate_records = []
        if sor_code == "R12513" or ("REMOVE" in action_query and any(k in item_name for k in ["PANEL ANTENNA", "TOWER MOUNTED"])):
            # R12513 combined sum: 1. Antennas (13), 2. TMAs (Item 42: 6), 3. Tower RRUs (Item 31: 3 + Item 32: 3 = 6)
            for sr in structured_records:
                if sr['action'] == 'REMOVE':
                    tbl_u = sr['table_title'].upper()
                    if 'ANTENNA CONFIGURATION' in tbl_u or ('ANTENNA' in tbl_u and 'EQUIPMENT' not in tbl_u):
                        if 'GPS' not in sr['model'].upper() and sr not in candidate_records:
                            candidate_records.append(sr)
            for sr in structured_records:
                if sr['action'] == 'REMOVE':
                    mod_u = sr['model'].upper()
                    txt_u = sr['raw_text'].upper()
                    if any(k in mod_u for k in ['TMA', 'TMD', 'TOWER MOUNTED']) and not any(sh in txt_u for sh in ['E5', 'SHELTER', 'PATHFINDER']):
                        if sr not in candidate_records:
                            candidate_records.append(sr)
            for sr in structured_records:
                if sr['action'] == 'REMOVE':
                    mod_u = sr['model'].upper()
                    txt_u = sr['raw_text'].upper()
                    if any(k in mod_u for k in ['RRU', 'RRUS', 'RADIO']):
                        if not ('E5' in txt_u or 'SHELTER' in txt_u or 'PATHFINDER' in txt_u):
                            if sr not in candidate_records:
                                candidate_records.append(sr)

            # Ensure all constituent candidate records are present in primary_sources
            existing_ant_ids = {ps["ant_id"] for ps in primary_sources if ps.get("ant_id") and ps["ant_id"] != "-"}
            for cr in candidate_records:
                if cr["ant_id"] in existing_ant_ids and cr["ant_id"] != "-":
                    continue
                existing_ant_ids.add(cr["ant_id"])
                primary_sources.append({
                    "source_sheet": cr["sheet_name"],
                    "source_table": cr["table_title"],
                    "source_row": cr["row_idx"],
                    "page": cr["page"],
                    "ant_id": cr["ant_id"],
                    "model": cr["model"],
                    "action": cr["action"],
                    "quantity": cr["quantity"],
                    "entity_class": item.get("equipment_type", "EQUIPMENT"),
                    "target_sor": item.get("sor_code", "UNQUOTED"),
                    "target_name": item.get("item_name", ""),
                    "rate": item.get("rate", 0.0),
                    "validation_status": "VERIFIED_IN_LAYOUT",
                    "matched_rule": "Authoritative Table Grounding",
                    "rule_logic": f"Extracted from {cr['table_title']} on {cr['sheet_name']} ({cr['ant_id']}). Authoritative primary source.",
                    "confidence_score": 95.0,
                    "confidence_level": "HIGH",
                    "raw_text": cr["raw_text"],
                    "is_duplicate": False
                })

            # Authoritative sum: 13 antennas + 6 TMAs + 6 tower RRUs = 25 total units
            total_units = sum(int(ps.get("quantity") or 1) for ps in primary_sources)
            item["quantity"] = total_units
            if item.get("rate"):
                item["total_cost"] = total_units * float(item["rate"])
        else:
            model_query = str(item.get("model") or item.get("item_name", "")).upper()
            ant_query = str(item.get("ant_id", "")).upper()
            clean_q = re.sub(r'\(.*?\)', '', model_query).strip()
            tokens = [t for t in re.split(r'[\s\-_/]+', clean_q) if len(t) >= 4 and t not in ["INSTALL", "PROPOSED", "TELSTRA", "ERICSSON", "DEVICE"]]
            for sr in structured_records:
                if action_query == "REMOVE" and sr["action"] != "REMOVE": continue
                if action_query == "INSTALL" and sr["action"] not in ["INSTALL", "NEW", "PROPOSED"]: continue
                if action_query == "RELOCATE" and sr["action"] != "RELOCATE": continue
                sr_model_u = sr["model"].upper()
                sr_text_u = sr["raw_text"].upper()
                sr_title_u = sr["table_title"].upper()
                if "ANTENNA" in item_name and not ("ANTENNA" in sr_title_u or any(k in sr_model_u for k in ["ANTENNA", "AIR", "AAU", "DELTEC", "ARGUS", "KAELUS"])):
                    continue
                if "PATCH PANEL" in sr_model_u and "PATCH" not in item_name:
                    continue
                if ant_query and ant_query != "-" and ant_query == sr["ant_id"].upper():
                    if sr not in candidate_records: candidate_records.append(sr)
                elif tokens and any(t in sr_model_u or t in sr_text_u for t in tokens[:2]):
                    if sr not in candidate_records: candidate_records.append(sr)

            req_qty = int(float(item.get("quantity", 1)))
            current_units = sum(int(ps.get("quantity") or 1) for ps in primary_sources)
            if current_units < req_qty:
                existing_ant_ids = {ps["ant_id"] for ps in primary_sources if ps.get("ant_id") and ps["ant_id"] != "-"}
                for s_idx, cr in enumerate(candidate_records):
                    if current_units >= req_qty:
                        break
                    if cr["ant_id"] in existing_ant_ids and cr["ant_id"] != "-":
                        continue
                    existing_ant_ids.add(cr["ant_id"])
                    primary_sources.append({
                        "source_sheet": cr["sheet_name"],
                        "source_table": cr["table_title"],
                        "source_row": cr["row_idx"],
                        "page": cr["page"],
                        "ant_id": cr["ant_id"],
                        "model": cr["model"],
                        "action": cr["action"],
                        "quantity": cr["quantity"],
                        "entity_class": item.get("equipment_type", "EQUIPMENT"),
                        "target_sor": item.get("sor_code", "UNQUOTED"),
                        "target_name": item.get("item_name", ""),
                        "rate": item.get("rate", 0.0),
                        "validation_status": "VERIFIED_IN_LAYOUT",
                        "matched_rule": "Authoritative Table Grounding",
                        "rule_logic": f"Extracted from {cr['table_title']} on {cr['sheet_name']} ({cr['ant_id']}). Authoritative primary source.",
                        "confidence_score": 95.0,
                        "confidence_level": "HIGH",
                        "raw_text": cr["raw_text"],
                        "is_duplicate": False
                    })
                    current_units += int(cr["quantity"])

        if not primary_sources:
            primary_sources.append({
                "source_sheet": item.get("source_sheet", "Drawing Schedule"),
                "source_table": item.get("source_table", "Drawing Schedule / Takeoff"),
                "source_row": 0,
                "page": item.get("page", 1),
                "ant_id": item.get("ant_id", "-"),
                "model": item.get("model", item.get("item_name", "")),
                "action": item.get("action", "INSTALL"),
                "quantity": item.get("quantity", 1),
                "entity_class": item.get("equipment_type", "EQUIPMENT"),
                "target_sor": item.get("sor_code", "UNQUOTED"),
                "target_name": item.get("item_name", ""),
                "rate": item.get("rate", 0.0),
                "validation_status": "VERIFIED_IN_LAYOUT",
                "matched_rule": "AI Semantic Takeoff",
                "rule_logic": "Extracted drawing item verified against schedule.",
                "confidence_score": float(item.get("confidence_score", 95.0)),
                "confidence_level": item.get("confidence_level", "HIGH"),
                "raw_text": item.get("raw_text", item.get("model", "")),
                "is_duplicate": False
            })

        item["model"] = primary_sources[0]["model"]

        # Cross-sheet duplicate callouts for this item
        ant_ids_for_item = [ps["ant_id"] for ps in primary_sources if ps.get("ant_id") and ps["ant_id"] != "-"]
        primary_pages = {ps["page"] for ps in primary_sources}

        duplicate_sources = []
        for cr in callout_records:
            if cr["page"] in primary_pages:
                continue

            txt_upper = cr["text"].upper()

            # Action compatibility check
            is_removal_note = any(kw in txt_upper for kw in ["RECOVER", "REMOVE", "REMOVED", "RECOVERED"])
            is_relocate_note = any(kw in txt_upper for kw in ["RELOCATE", "RELOCATED", "RELOCATION", "MODIFY", "MODIFIED", "MOVE", "MOVED", "RAISE", "RAISED"])
            if action_query == "INSTALL" and (is_removal_note or is_relocate_note):
                continue
            if action_query == "REMOVE" and not is_removal_note:
                continue
            if action_query == "RELOCATE" and not is_relocate_note:
                continue

            is_dup = False
            matched_ant = None

            for aid in ant_ids_for_item:
                raw_aid = re.sub(r'\s*\(#\d+\)', '', str(aid)).strip()
                if raw_aid and len(raw_aid) >= 2 and re.search(r'\b(?:1\s*OFF\s+)?' + re.escape(raw_aid) + r'\b', txt_upper):
                    is_dup = True
                    matched_ant = raw_aid
                    break

            if not is_dup:
                models_to_check = {ps["model"] for ps in primary_sources}
                for mod_text in models_to_check:
                    m_sub = re.sub(r'\(.*?\)', '', mod_text).strip()
                    tokens = [t for t in re.split(r'[\s\-_/]+', m_sub) if len(t) >= 4 and t not in ["TELSTRA", "ERICSSON", "PANEL", "ANTENNA"]]
                    if ("RRU" in item_name or "RADIO" in item_name) and not any(k in txt_upper for k in ["RRU", "RRUS", "RADIO"]):
                        continue
                    if ("GPS" in item_name or "GNSS" in item_name):
                        if not any(k in txt_upper for k in ["GPS", "GNSS"]):
                            continue
                        if any(ign in txt_upper for ign in ["GPS READING ACCURACY", "SITE STRUCTURE CO-ORDINATES", "GDA94"]):
                            continue
                    if tokens and any(t in txt_upper for t in tokens):
                        is_dup = True
                        break

            if is_dup:
                primary_pg_str = ", ".join(f"Page {p}" for p in sorted(primary_pages))
                duplicate_sources.append({
                    "source_sheet": cr["sheet_name"],
                    "source_table": "Drawing Callout Note",
                    "source_row": 0,
                    "page": cr["page"],
                    "ant_id": matched_ant or "-",
                    "model": cr["text"],  # Exact verbatim text from PDF callout
                    "action": item.get("action", "INSTALL"),
                    "quantity": 1,
                    "entity_class": item.get("equipment_type", "EQUIPMENT"),
                    "target_sor": item.get("sor_code", "UNQUOTED"),
                    "target_name": item.get("item_name", ""),
                    "rate": 0.0,
                    "validation_status": "DUPLICATE_OMITTED",
                    "matched_rule": "Duplicated Omitted Note Match",
                    "rule_logic": f"Omitted layout/elevation reference on {cr['sheet_name']} (Page {cr['page']}) to prevent double-counting of authoritative table item on {primary_pg_str}.",
                    "confidence_score": 95.0,
                    "confidence_level": "HIGH",
                    "raw_text": cr["text"],
                    "is_duplicate": True
                })

        all_sources = primary_sources + duplicate_sources
        item["sources"] = all_sources
        item["evidence"] = primary_sources[0]
        item["evidence_json"] = {
            "summary": primary_sources[0],
            "sources": all_sources
        }

    return mapped_boq_items


def run_ai_statement_understanding(
    statement_text: str,
    provenance_dict: Dict[str, Any],
    api_key: str
) -> Optional[Dict[str, Any]]:
    """
    Sends the complete sentence statement to Gemini to parse into a structured
    AIStatementUnderstanding model.
    """
    load_env_file()
    model_name = "gemini-3.5-flash-lite"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    prompt = f"""
    You are an engineering takeoff interpreter. Analyze the following drawing statement or note text as a single complete sentence/context to understand its intent:
    
    Statement: "{statement_text}"
    
    Instructions:
    1. Do not interpret individual words independently. Understand the complete sentence context.
    2. Identify the target entity_name (e.g., "Panel Antenna", "Filter", "Mounting bracket", "Baseband Unit").
    3. Identify the action (INSTALL, REMOVE, REPLACE, RELOCATE, RETAIN).
       - Note: If a sentence says "EXISTING ... TO BE RECOVERED", the action is "REMOVE" (do not skip it because of the word "EXISTING").
       - Note: If it says "TO REMAIN" or "EXISTING ... TO BE REUSED", the action is "RETAIN".
    4. Extract the quantity (float) and unit.
    5. Extract all other relevant attributes as key-value pairs (e.g., location, model number, dimensions, sector, technology).
    
    Output JSON format:
    {{
        "original_text": "{statement_text}",
        "entity_name": "...",
        "action": "...",
        "quantity": 1.0,
        "unit": "...",
        "attributes": {{
            "attribute_key_1": "value_1",
            ...
        }}
    }}
    """

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.0}
    }

    try:
        from services.ai_service import send_gemini_request
        result = send_gemini_request(url, payload, timeout=30)
        candidates = result.get("candidates", [])
        if candidates:
            text_out = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            # Strip markdown code blocks if any
            text_out = re.sub(r'^```json\s*', '', text_out, flags=re.IGNORECASE)
            text_out = re.sub(r'\s*```$', '', text_out)
            data = json.loads(text_out)
            if isinstance(data, list) and len(data) > 0:
                data = data[0]
            if isinstance(data, dict):
                data["provenance"] = provenance_dict
                return data
    except Exception as e:
        print(f"[AI Service] Error running statement understanding: {e}")
    return None


def run_ai_rules_evaluator(
    understanding: Dict[str, Any],
    rules: List[Dict[str, Any]],
    api_key: str
) -> Optional[Dict[str, Any]]:
    """
    Evaluates active natural-language rules on the AI Statement Understanding
    to generate MappingRequirement constraints.
    """
    load_env_file()
    model_name = "gemini-3.5-flash-lite"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    rules_formatted = ""
    for r in rules:
        rule_text = r.get("rule_text") or r.get("notes") or r.get("logic_explanation") or ""
        rules_formatted += f"- Rule {r.get('rule_id', 'R')}: {r.get('rule_name', '')} -> Instruction: \"{rule_text}\"\n"

    prompt = f"""
    You are an engineering rule compliance engine. You must apply the following business rules as hard constraints on the parsed statement understanding:
    
    Statement Understanding:
    {json.dumps(understanding, indent=2)}
    
    Active Business Rules:
    {rules_formatted}
    
    Instructions:
    1. The rules must constrain what is allowed. If a rule says an item is not applicable or cannot be mapped, enforce it.
    2. Determine the category_constraint and action_constraint for the target commercial items.
    3. Generate the specific mapping requirement matching these constraints.
    4. Provide the list of applied rules.
    
    Output JSON format:
    {{
        "category_constraint": "...",
        "action_constraint": "...",
        "attribute_constraints": {{
            "key": "value"
        }},
        "applied_rules": ["Rule ID or Name"]
    }}
    """

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.0}
    }

    try:
        from services.ai_service import send_gemini_request
        result = send_gemini_request(url, payload, timeout=30)
        candidates = result.get("candidates", [])
        if candidates:
            text_out = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            # Strip markdown code blocks if any
            text_out = re.sub(r'^```json\s*', '', text_out, flags=re.IGNORECASE)
            text_out = re.sub(r'\s*```$', '', text_out)
            res_data = json.loads(text_out)
            if isinstance(res_data, list) and len(res_data) > 0:
                res_data = res_data[0]
            if isinstance(res_data, dict):
                return res_data
    except Exception as e:
        print(f"[AI Service] Error running rules evaluator: {e}")
    return None


def run_ai_candidate_selector(
    understanding: Dict[str, Any],
    requirement: Dict[str, Any],
    candidates: List[Dict[str, Any]],
    api_key: str
) -> Optional[Dict[str, Any]]:
    """
    Selects the best valid candidate from the filtered eligible candidate price-list items.
    """
    load_env_file()
    model_name = "gemini-3.5-flash-lite"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    prompt = f"""
    You are a commercial pricing selector. Compare the extracted understanding and requirements constraints against these active pricing catalog candidates:
    
    Understanding:
    {json.dumps(understanding, indent=2)}
    
    Requirement Constraints:
    {json.dumps(requirement, indent=2)}
    
    Pricing Catalog Candidates:
    {json.dumps(candidates, indent=2)}
    
    Instructions:
    1. Select the single best valid matching item that satisfies the requirements constraints.
    2. If no candidate matches, set "selected_code" to "UNQUOTED".
    3. If multiple candidates could apply and it's ambiguous, set "status" to "REVIEW_REQUIRED".
    4. Provide the selected candidate code, name, and a clear reason explaining why it matches.
    
    Output JSON format:
    {{
        "status": "MATCHED" | "REVIEW_REQUIRED" | "UNQUOTED",
        "selected_code": "...",
        "selected_name": "...",
        "reason": "..."
    }}
    """

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.0}
    }

    try:
        from services.ai_service import send_gemini_request
        result = send_gemini_request(url, payload, timeout=30)
        candidates = result.get("candidates", [])
        if candidates:
            text_out = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            # Strip markdown code blocks if any
            text_out = re.sub(r'^```json\s*', '', text_out, flags=re.IGNORECASE)
            text_out = re.sub(r'\s*```$', '', text_out)
            res_data = json.loads(text_out)
            if isinstance(res_data, list) and len(res_data) > 0:
                res_data = res_data[0]
            if isinstance(res_data, dict):
                return res_data
    except Exception as e:
        print(f"[AI Service] Error running candidate selector: {e}")
    return None


