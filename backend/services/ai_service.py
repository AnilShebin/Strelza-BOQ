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

def get_prompt_by_name(name: str, fallback_prompt: str) -> str:
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
) -> Tuple[Optional[List[Dict[str, Any]]], Dict[str, Any]]:
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
        elements = parsed.get("elements", []) if isinstance(parsed, dict) else (parsed if isinstance(parsed, list) else [])
        
        if isinstance(elements, list):
            valid_elements = []
            for item in elements:
                if isinstance(item, dict):
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
            return valid_elements, analytics
            
        raise ValueError("No valid elements extracted")
    except Exception as e:
        print(f"[Gemini Document Extractor] Failed: {e}")
        return None, {
            "model": model_name, "input_tokens": est_input_tokens, "output_tokens": 0, "status": f"Failed: {e}"
        }



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

DEFAULT_MAPPING_PROMPT_TEMPLATE = """You are a senior telecom Bill of Quantities (BOQ) estimator and universal pricing AI engine.
Your task is to analyze all extracted drawing data (structured schedules, layout notes, revision clouds, elevation details, and equipment notes) and map every single active scope of work to the active Price Book Schedule of Rates (SOR).

CRITICAL ARCHITECTURAL DIRECTIVES:

1. ZERO-LOSS SCOPE GUARANTEE (FINANCIAL CRITICAL):
   - Every active work scope, proposed equipment item, removal action, structural modification, civil fixing, testing requirement, or preliminary task extracted from the drawing MUST appear in the final BOQ output.
   - If an active item/work scope MATCHES an item in the Price Book:
     - Map to that Price Book item with its exact "row_idx", "sor_code", "rate", "unit", and compute "total_cost".
   - If an active item/work scope DOES NOT exist in the Price Book (or is a custom civil/structural/non-SOR scope):
     - DO NOT OMIT OR DISCARD IT!
     - Set "row_idx": null, "sor_code": "UNQUOTED", "rate": 0.0, "total_cost": 0.0.
     - Set "comment": "Estimator need to fill: <Detailed extracted scope, dimensions, hardware specs, and drawing sheet reference>".

2. TABLE-FIRST PRIMARY AUTHORITY & CROSS-VERIFICATION:
   - Structured Tables are the primary source of truth for equipment quantities and specifications.
   - Antenna Configuration Tables take precedence for Antenna items (Panel Antennas, AAU, GPS antennas) and antenna removals.
   - Equipment Notes tables take precedence for internal shelter hardware, racks, RRUs, TMAs, filters, and DC power equipment.
   - For every table item, cross-check with layout callouts and revision clouds:
     - If table quantity and layout annotations MATCH: output table quantity with comment "".
     - If table quantity and layout annotations DIFFER: output the TABLE quantity as authoritative count, and set comment: "Data not matching with antenna layout".

3. 5-TIER SCOPE TAXONOMY:
   Tier 1: RF & Antennas (4G Panels >1.5m, 5G AAUs <1.0m / active beamforming, 1st antenna per sector vs extra-over, general antenna removals).
   Tier 2: Active Radios (RRU) & Tower Mounted Devices (TMA, Filters, Combiners, Diplexers, MHAs) for both install and removal.
   Tier 3: Internal Shelter, Baseband & DC Power (Baseband units/RP6672, Cell Site Routers, Digital Units, internal filter recoveries, battery strings, rectifiers).
   Tier 4: Feeders, Tails, Cabling & Commissioning Testing:
     - Automatically derive Blackbird testing line items: 1st Carrier testing per sector (count = active sectors) + Subsequent Carrier testing (count = total active carriers across sectors minus 1st carriers).
     - Feeder PIM / Sweep testing for reused or proposed feeder lines.
   Tier 5: Structural Mounts, Plinths, Civil & Preliminaries:
     - New mounts, mount relocations, plinth removals/replacements, Hilti chemical anchors with embedment depth, EME chain barriers, roof handrails, tower inspections, FIM waste management, crane hire, traffic control.

4. ACTION FILTERING:
   - Active Actions to include: INSTALL, PROPOSED, NEW, TO BE INSTALLED, REMOVE, RECOVER, TO BE REMOVED, TO BE RECOVERED, TO BE REPLACED, TO BE RELOCATED, TO BE MODIFIED, TO BE MOVED.
   - Non-Action: Items marked purely as EXISTING, REUSE, or SPARE / MADE SPARE with NO active work scope (PROPOSED: 0) must be skipped.
   - If an item marked as SPARE explicitly has an active action (e.g. REMOVE SPARE ANTENNA), include and process it.

5. OUTPUT STRUCTURE:
Return ONLY a valid JSON array of mapped BOQ objects matching this schema:
[
  {
    "equipment_type": "PANEL ANTENNA",
    "model": "KAELUS F6RHEU01",
    "action": "INSTALL",
    "quantity": 3,
    "source_sheet": "Sheet S3-3",
    "clean_text": "Install proposed Telstra Kaelus F6RHEU01 panel antenna",
    "row_idx": 45,
    "sor_code": "W7520",
    "item_name": "One panel Antenna",
    "unit": "each",
    "rate": 675.0,
    "total_cost": 2025.0,
    "comment": ""
  }
]"""

DEFAULT_CLIENT_MAPPING_PROMPT = """[UNIVERSAL TELECOM CLIENT-SPECIFIC DOMAIN RULES]:
1. ANTENNA TECHNOLOGY & COMPOUND ACTIONS:
   - Primary 4G Panel Antenna: Length/height > 1.5m (1500mm), e.g. Kaelus F6RHEU01, Argus RVVPX series. First panel antenna per sector maps to primary antenna SOR (e.g. W7520).
   - Extra-Over 4G Panel Antenna: Second or additional panel antenna on the same sector maps to Extra-Over SOR (e.g. W13360).
   - 5G AAU (Active Antenna Unit) / Massive MIMO: Compact height < 1.0m (1000mm) or active beamforming (e.g. AIR3258, AIR6488, AAU series) maps to 5G AAU SOR (e.g. W13358).
   - Compound Replace Actions: "Recovered and Replaced" / "Replace" (e.g. GPS antenna replacement) maps to single line item "GPS antenna and receiver replacement", NOT two separate split items.
   - Antenna Removals: Map strictly by total quantity count to general antenna removal/recovery SOR (e.g. R12513), without differentiating technology.

2. RADIOS (RRU) & LOCATION DISAMBIGUATION (REFERENCE DWG COLUMN):
   - Tower Top (Reference DWG: S sheets / Antenna Layout):
     - RRU Install: Maps to "Remote Radio Unit (RRU)" (W12252).
     - RRU Removal: Maps to "Remote Radio Unit (RRU) Removal" (R12513).
     - TMD / TMA / Filter Install: Maps to "Tower Mounted Device (TMA, COM,FILTER)" (W7893).
     - TMD / TMA / Filter Removal: Maps to "Tower Mounted Device (TMA, COM,FILTER) Removal" (R12513).
   - Shelter / Internal (Reference DWG: E sheets / Equipment Layout):
     - RRU Install: Maps to "RRU installed in shelter".
     - RRU Recovery: Maps to "RRU recovery from shelter".
     - Filter / Combiner / Bandstop Recovery: Maps to "Removal and Recover internal Filter or Combiner" (R13169).

3. SPARE & EXISTING ITEM FILTERING:
   - Items in tables marked with "(SPARE)" or "SPARE" with PROPOSED: 0 are existing spare equipment; MUST BE SKIPPED (no active work scope).
   - Only process items with active proposed quantities (+N or -N) or explicit work instructions.

4. INTERNAL SHELTER, BASEBAND & POWER:
   - Baseband / Radio Processors: Proposed baseband units (e.g. RP6672, Baseband 6630/6648) map to Baseband Unit Installation SOR (e.g. W13393).
   - Baseband Recovery: Recovered DUS, R503, or baseband units map to Baseband Recovery SOR (e.g. R13701).
   - Cell Site Routers: Relocations or installs map to Router SOR (e.g. W13700).

5. COMMISSIONING & TESTING:
   - 4G/5G Testing (Blackbird / Call & Data Tests):
     - First carrier per sector: Qty = total active sectors (e.g. W13374).
     - Subsequent carriers per sector: Qty = sum of (carriers per sector - 1) across all sectors (e.g. W13400).
   - PIM / Sweep Testing: Map to PIM testing SOR (e.g. W13375) when reusing existing feeder lines or installing new RF tails.

6. STRUCTURAL, CIVIL & PRELIMINARIES:
   - Tier 2 Tower Inspections: Auto-include standard tower inspection SOR (e.g. W13398) for macro build completion.
   - Antenna Mounts, Plinths & Hilti Anchors: If new mounts, plinth replacements, or Hilti chemical anchors are specified in notes/clouds, map to matching SOR or emit as UNQUOTED with exact specs for estimator pricing.
   - Site Safety & Preliminaries: EME chain barrier, roof handrail, crane hire, traffic control, and FIM waste management should be captured with full estimator notes."""

def run_gemini_boq_mapper_and_deduplicator(
    extracted_tables: List[Dict[str, Any]],
    elements: List[Dict[str, Any]],
    price_list: List[Dict[str, Any]],
    api_key: str
) -> List[Dict[str, Any]]:
    """
    Uses Google Gemini to perform generalized table-first deduplication, cross-verification,
    and SOR price book mapping.
    """
    model_name = "gemini-3.5-flash-lite"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    base_prompt = get_prompt_by_name("boq_mapping_engine", DEFAULT_MAPPING_PROMPT_TEMPLATE)
    client_prompt = get_prompt_by_name("client_mapping_rules", DEFAULT_CLIENT_MAPPING_PROMPT)

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

    # Format price list compactly
    formatted_price_list = []
    for p in price_list:
        if isinstance(p, dict) and p.get("row_type", "data_item") == "data_item" and (p.get("code") or p.get("name")):
            formatted_price_list.append(
                f"[row_idx: {p.get('row_idx', p.get('id'))}] CODE: {p.get('code', '')} | NAME: {p.get('name', '')} | UNIT: {p.get('unit', 'each')} | RATE: {p.get('rate', 0.0)}"
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


def retrieve_sor_candidates(item: Dict[str, Any], price_list: List[Dict[str, Any]], limit: int = 20) -> List[Dict[str, Any]]:
    """
    Retrieves the top N relevant price list candidates for an item using fuzzy/token intersection match.
    These candidates will be passed to Gemini for final semantic validation.
    """
    from rapidfuzz import fuzz
    candidates = []
    
    # Text from takeoff item
    equip_type = str(item.get("equipment_type") or "").upper()
    model = str(item.get("model") or "").upper()
    raw_text = str(item.get("raw_text") or "").upper()
    search_query = f"{equip_type} {model} {raw_text}".strip()
    q_tokens = set(search_query.split())
    
    for p in price_list:
        if p.get("row_type") == "section_header":
            continue
        code = str(p.get("code") or "")
        name = str(p.get("name") or "")
        unit = str(p.get("unit") or "")
        rate = float(p.get("rate") or 0.0)
        comments = str(p.get("comments") or "")
        row_idx = p.get("row_idx")
        
        # Overlap and similarity
        p_tokens = set(name.upper().split())
        overlap = len(q_tokens.intersection(p_tokens))
        
        # Similarity ratio
        sim = fuzz.token_sort_ratio(search_query, name.upper())
        
        # Total heuristic score
        score = sim + (overlap * 10)
        
        candidates.append({
            "code": code,
            "name": name,
            "unit": unit,
            "rate": rate,
            "comments": comments,
            "row_idx": row_idx,
            "score": score
        })
        
    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates[:limit]


def run_ai_semantic_matching(
    unmapped_items: List[Dict[str, Any]],
    price_list: List[Dict[str, Any]],
    api_key: str
) -> List[Dict[str, Any]]:
    """
    Takes unmapped or UNQUOTED items, retrieves candidate Price Book items, and uses Gemini
    to semantically map them to the best candidate. Returns mappings list.
    """
    if not unmapped_items:
        return []

    model_name = "gemini-3.5-flash-lite"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    # Prepare payloads for each item to avoid oversized model context
    resolved_mappings = []
    
    for item in unmapped_items:
        candidates = retrieve_sor_candidates(item, price_list, limit=15)
        
        item_summary = {
            "item_id": item.get("item_id"),
            "equipment_type": item.get("equipment_type"),
            "model": item.get("model"),
            "action": item.get("action"),
            "quantity": item.get("quantity"),
            "raw_text": item.get("raw_text"),
            "source_sheet": item.get("source_sheet"),
            "location": item.get("location"),
            "height_mm": item.get("height_mm"),
            "sector": item.get("sector")
        }

        prompt = f"""You are a senior telecom Bill of Quantities (BOQ) estimator.
Your task is to analyze the extracted takeoff item details and map it to the most semantically appropriate Price Book SOR item from the candidate list below.

CRITICAL INSTRUCTIONS:
1. Deep Semantic Matching: Do not rely blindly on word similarity. Look at dimensions (e.g. antenna length >1.5m vs <1.0m active AAU), mounting locations (shelter/internal vs tower-mounted), actions (install vs remove/decommission), and equipment classes.
2. Select the absolute best matching candidate: If one candidate matches the scope, assign its 'sor_code'.
3. Zero-Match Fallback: If NONE of the candidates match or if it is a custom civil/structural/non-SOR scope that requires custom pricing, set 'sor_code' to "UNQUOTED".
4. Do not make up rates or codes. Use only what is in the candidates list.

Takeoff Item details:
{json.dumps(item_summary, indent=2)}

Candidate Price Book entries:
{json.dumps(candidates, indent=2)}

Return a JSON object in this format:
{{
  "item_id": "{item.get("item_id")}",
  "sor_code": "assigned_sor_code or UNQUOTED",
  "confidence_score": 95,
  "confidence_level": "HIGH",
  "comments": "Reasoning explaining why this candidate was selected or why it remains UNQUOTED"
}}

Response format: Return ONLY the JSON object. Do not wrap in markdown or add explanations."""

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.0}
        }
        
        try:
            res_json = send_gemini_request(url, payload, timeout=12)
            candidates_res = res_json.get("candidates", [])
            if candidates_res:
                text_out = candidates_res[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                parsed = json.loads(text_out)
                
                # Normalize confidence level
                score = float(parsed.get("confidence_score", 50))
                level = "NEEDS_REVIEW"
                if score >= 90:
                    level = "HIGH"
                elif score >= 70:
                    level = "MEDIUM"
                parsed["confidence_level"] = level
                
                resolved_mappings.append(parsed)
            else:
                # Default unquoted if Gemini fails
                resolved_mappings.append({
                    "item_id": item.get("item_id"),
                    "sor_code": "UNQUOTED",
                    "confidence_score": 50,
                    "confidence_level": "NEEDS_REVIEW",
                    "comments": "Gemini returned empty response. Mapping fallback to UNQUOTED."
                })
        except Exception as e:
            print(f"[AI Matching] Failed matching for item {item.get('item_id')}: {e}")
            resolved_mappings.append({
                "item_id": item.get("item_id"),
                "sor_code": "UNQUOTED",
                "confidence_score": 50,
                "confidence_level": "NEEDS_REVIEW",
                "comments": f"AI mapping failed: {e}. Fallback to UNQUOTED."
            })
            
    return resolved_mappings


def run_ai_rules_validation(
    mapped_items: List[Dict[str, Any]],
    api_key: str
) -> List[Dict[str, Any]]:
    """
    Audits the proposed BOQ mappings, flagging any parameter inconsistencies
    (e.g., Action mismatches, Size/Dimension mismatches, or Category errors).
    Returns a list of structured audit reports.
    """
    if not mapped_items:
        return []

    model_name = "gemini-3.5-flash-lite"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    # Format list of items compactly for validation
    items_to_validate = []
    for item in mapped_items:
        items_to_validate.append({
            "item_id": item.get("item_id"),
            "equipment_type": item.get("equipment_type"),
            "model": item.get("model"),
            "action": item.get("action"),
            "quantity": item.get("quantity"),
            "source_sheet": item.get("source_sheet"),
            "raw_text": item.get("raw_text"),
            "sor_code": item.get("sor_code"),
            "sor_name": item.get("item_name"),
            "sor_rate": item.get("rate"),
            "sor_unit": item.get("unit"),
            "sector": item.get("evidence", {}).get("sector") if isinstance(item.get("evidence"), dict) else None,
            "location": item.get("evidence", {}).get("location") if isinstance(item.get("evidence"), dict) else None,
            "height_mm": item.get("evidence", {}).get("height_mm") if isinstance(item.get("evidence"), dict) else None
        })

    prompt = f"""You are a senior telecom BOQ validation auditor. Your task is to inspect the final priced and mapped BOQ items below and identify any parameter mismatches or anomalies.

For each item, perform these explicit checks:
1. Action Check: Does the takeoff action (e.g. INSTALL vs REMOVE) match the selected SOR item's purpose? (e.g., mapping a REMOVE takeoff action to an installation SOR code is a critical warning).
2. Category/Equipment Check: Does the takeoff equipment type match the SOR category? (e.g., mapping a TMA to an Antenna SOR code is a warning).
3. Height & Size Check: Does the takeoff item's height/dimensions (height_mm) match the constraints described in the SOR item name? (e.g., W7520 is for panel antennas >1.5m/1500mm, while W13358 is for 5G AAU <1.0m/1000mm).
4. Sector Check: Are quantities or sector allocations consistent with macro layout rules?

Return a JSON array of checklist audits. Each element in the array must match this structure:
{{
  "item_id": "item_id_from_input",
  "status": "APPROVED or REVIEW_REQUIRED",
  "issues": [
    {{
      "field": "action or category or size or quantity",
      "expected": "expected parameter value",
      "mapped": "currently mapped parameter value",
      "message": "Detailed description of the warning/inconsistency"
    }}
  ],
  "confidence_score": 100
}}

Priced BOQ Items:
{json.dumps(items_to_validate, indent=2)}

Response format: Return ONLY the JSON array. Do not wrap in markdown or add explanations. If no warnings are found for any item, return "status": "APPROVED" and an empty "issues" list []."""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.0}
    }

    try:
        res_json = send_gemini_request(url, payload, timeout=15)
        candidates = res_json.get("candidates", [])
        if not candidates:
            return []
        text_out = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
        audits = json.loads(text_out)
        if isinstance(audits, list):
            print(f"[AI Validator] Successfully audited {len(audits)} BOQ mappings.")
            return audits
        return []
    except Exception as e:
        print(f"[AI Validator] Audit request failed: {e}")
        return []


def validate_proposed_rule_schema(rule_data: Dict[str, Any]) -> bool:
    """
    Strictly validates the structure of an AI-proposed rule to prevent injection.
    Only allows designated condition fields, operators, and assign_price_item action calls.
    """
    try:
        # Check overall fields
        allowed_keys = {
            "operation", "rule_name", "category", "equipment_type", 
            "conditions_json", "actions_json", "priority", "logic_explanation"
        }
        for k in rule_data.keys():
            if k not in allowed_keys:
                print(f"[Schema Guard] Unexpected key in rule data: {k}")
                return False

        # Validate conditions
        c_json = rule_data.get("conditions_json")
        if not isinstance(c_json, dict):
            return False
            
        allowed_vars = {
            "category", "action", "location", "height_mm", 
            "sector_index", "is_active", "model", "raw_text", 
            "quantity", "has_quantity_mismatch"
        }
        allowed_ops = {
            "equal_to", "not_equal_to", "contains", "does_not_contain", 
            "greater_than", "less_than", "greater_than_or_equal_to", 
            "less_than_or_equal_to", "is_true", "is_false"
        }

        def check_node(node: Dict[str, Any]) -> bool:
            if "all" in node:
                if not isinstance(node["all"], list):
                    return False
                return all(check_node(sub) for sub in node["all"])
            if "any" in node:
                if not isinstance(node["any"], list):
                    return False
                return all(check_node(sub) for sub in node["any"])
            
            # Base condition
            var_name = node.get("name")
            op = node.get("operator")
            if var_name not in allowed_vars:
                print(f"[Schema Guard] Rejected variable: {var_name}")
                return False
            if op not in allowed_ops:
                print(f"[Schema Guard] Rejected operator: {op}")
                return False
            return True

        if not check_node(c_json):
            return False

        # Validate actions
        a_json = rule_data.get("actions_json")
        if not isinstance(a_json, list):
            return False

        for act in a_json:
            if not isinstance(act, dict):
                return False
            if act.get("name") != "assign_price_item":
                print(f"[Schema Guard] Rejected action name: {act.get('name')}")
                return False
            params = act.get("params", {})
            if not isinstance(params, dict):
                return False
            allowed_params = {"sor_code", "target_name", "comment", "qty_multiplier", "internal_id"}
            for pk in params.keys():
                if pk not in allowed_params:
                    print(f"[Schema Guard] Rejected action parameter: {pk}")
                    return False
                    
        return True
    except Exception as e:
        print(f"[Schema Guard] Error validating rule schema: {e}")
        return False


def run_proposed_rule_simulation(
    c_json: Dict[str, Any],
    a_json: List[Dict[str, Any]],
    target_sor_code: str,
    target_sor_name: str
) -> Dict[str, Any]:
    """
    Simulates the proposed rule against correction log data, historical accepted items,
    and existing active rules to calculate true positives, false positives, precision, and conflict detections.
    """
    from services.db import get_db_connection
    from models.telecom_entity import TelecomTakeoffEntity, TelecomAttributes, TakeoffProvenance
    from services.venmo_engine import evaluate_venmo_rules_for_entity
    
    # 1. Load historical dataset
    test_cases = []
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # A. Correction Log items
    try:
        cursor.execute("SELECT original_description, corrected_code, corrected_name FROM correction_log")
        for row in cursor.fetchall():
            test_cases.append({
                "description": row["original_description"],
                "correct_code": row["corrected_code"],
                "correct_name": row["corrected_name"],
                "source": "Correction Log"
            })
    except Exception:
        pass
        
    # B. Current / Historical accepted items (priced items in the database)
    try:
        cursor.execute("SELECT code, name, category, action, quantity, comments FROM price_items WHERE quantity > 0")
        for row in cursor.fetchall():
            if row["code"] and row["code"] != "UNQUOTED":
                test_cases.append({
                    "description": row["name"],
                    "correct_code": row["code"],
                    "correct_name": row["name"],
                    "category": row["category"],
                    "action": row["action"],
                    "source": "Accepted Mapping"
                })
    except Exception:
        pass
        
    # C. Load active rules for conflict detection
    active_rules = []
    try:
        cursor.execute("SELECT id, rule_name, conditions_json, actions_json, target_sor_code FROM mapping_rules WHERE status = 'ACTIVE' AND enabled = 1")
        for row in cursor.fetchall():
            active_rules.append(dict(row))
    except Exception:
        pass
        
    conn.close()

    if not test_cases:
        return {
            "tested_count": 0,
            "true_positives": 0,
            "false_positives": 0,
            "precision": 100.0,
            "conflicts": []
        }

    true_pos = 0
    false_pos = 0
    conflicts = []
    seen_conflicts = set()

    # Define a temporary rule dict for venmo engine
    temp_rule = {
        "rule_name": "Proposed Temporary Simulator Rule",
        "conditions_json": c_json,
        "actions_json": a_json,
        "enabled": 1,
        "priority": 999
    }
    dummy_price_list = [{"code": target_sor_code, "name": target_sor_name, "rate": 1.0, "unit": "each", "id": 9999}]

    for case in test_cases:
        desc = case["description"]
        expected = case["correct_code"].upper()
        
        # Deduce category and action
        category = case.get("category", "ANTENNA")
        action = case.get("action", "INSTALL")
        
        # Build temp entity
        height_mm = 0.0
        h_match = re.search(r'([0-9]{3,4})\s*mm', desc, re.IGNORECASE)
        if h_match:
            height_mm = float(h_match.group(1))

        entity = TelecomTakeoffEntity(
            entity_id="sim_case",
            category=category,
            action=action,
            model=desc,
            attributes=TelecomAttributes(
                location="SHELTER" if "SHELTER" in desc.upper() or "INTERNAL" in desc.upper() else "TOWER",
                height_mm=height_mm,
                sector="-",
                sector_index=1,
                is_active=("5G" in desc.upper() or "AAU" in desc.upper())
            ),
            provenance=TakeoffProvenance(
                page=1,
                source_sheet="Simulation",
                source_table=case["source"],
                raw_text=desc
            )
        )

        # Trigger check with proposed rule
        res, triggered_rule = evaluate_venmo_rules_for_entity(entity, [temp_rule], dummy_price_list)
        if res and triggered_rule:
            mapped_code = str(res.get("sor_code") or "").upper()
            if mapped_code == expected:
                true_pos += 1
            else:
                false_pos += 1

            # Check overlap with existing active rules (Conflict Detection)
            for rule in active_rules:
                if rule["target_sor_code"] != target_sor_code:
                    # Parse conditions
                    try:
                        r_cond = json.loads(rule["conditions_json"])
                        r_act = json.loads(rule["actions_json"])
                    except Exception:
                        continue
                    
                    r_rule_spec = {
                        "rule_name": rule["rule_name"],
                        "conditions_json": r_cond,
                        "actions_json": r_act,
                        "enabled": 1,
                        "priority": 999
                    }
                    
                    active_res, _ = evaluate_venmo_rules_for_entity(entity, [r_rule_spec], [{"code": rule["target_sor_code"], "id": rule["id"], "rate": 1.0}])
                    if active_res:
                        conflict_key = f"{rule['id']}_{rule['rule_name']}"
                        if conflict_key not in seen_conflicts:
                            seen_conflicts.add(conflict_key)
                            conflicts.append({
                                "rule_id": rule["id"],
                                "rule_name": rule["rule_name"],
                                "target_sor_code": rule["target_sor_code"],
                                "example_description": desc
                            })

    total_hits = true_pos + false_pos
    precision = (true_pos / total_hits * 100.0) if total_hits > 0 else 100.0

    return {
        "tested_count": len(test_cases),
        "true_positives": true_pos,
        "false_positives": false_pos,
        "precision": round(precision, 2),
        "conflicts": conflicts
    }


def propose_rule_improvement_with_ai(
    original_item: Dict[str, Any],
    correct_sor_code: str,
    correct_sor_name: str,
    api_key: str
) -> Optional[int]:
    """
    Invokes Gemini to analyze a manual mapping correction and propose an improved Venmo business rule.
    Validates schema, runs the rule simulator, and inserts the rule in PENDING_REVIEW state.
    """
    from services.db import get_all_mapping_rules, create_mapping_rule
    
    model_name = "gemini-3.5-flash-lite"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    # Fetch active rules for AI context
    current_rules = get_all_mapping_rules()
    formatted_rules = []
    for r in current_rules:
        if r.get("status") == "ACTIVE" and r.get("enabled"):
            formatted_rules.append({
                "rule_name": r.get("rule_name"),
                "equipment_type": r.get("equipment_type"),
                "logic": r.get("logic_explanation")
            })

    correction_details = {
        "item_description": original_item.get("model") or original_item.get("raw_text"),
        "equipment_type": original_item.get("equipment_type") or original_item.get("category"),
        "action": original_item.get("action") or "INSTALL",
        "assigned_incorrect_sor_code": original_item.get("sor_code"),
        "target_correct_sor_code": correct_sor_code,
        "target_correct_sor_name": correct_sor_name
    }

    prompt = f"""You are an expert telecom rule optimization engine.
A human estimator has corrected a BOQ mapping result. We need to teach the Rules Engine how to handle this item correctly next time.

Correction Details:
{json.dumps(correction_details, indent=2)}

Active Rules in Database:
{json.dumps(formatted_rules[:30], indent=2)}

Your task is to write a single Venmo business rule in JSON format that will trigger on the corrected item's properties and map it to the correct SOR code.

CRITICAL INSTRUCTIONS:
1. Target Variable Names: Use ONLY these names: "category", "action", "location", "height_mm", "sector_index", "is_active", "model", "raw_text", "quantity"
2. Target Operator Names: Use ONLY these: "equal_to", "not_equal_to", "contains", "does_not_contain", "greater_than", "less_than", "is_true", "is_false"
3. Action Format: You must only call "assign_price_item" action, passing 'sor_code' set to "{correct_sor_code}", 'target_name' set to "{correct_sor_name}", and a custom audit comment template.
4. Specificity & Precedence: Ensure the rule's conditions are specific enough so they do not trigger on unrelated equipment. Assign a priority between 80 and 150.

Return a JSON object in this format:
{{
  "operation": "CREATE",
  "rule_name": "Proposed Rule: Match specific model or note phrase",
  "category": "General",
  "equipment_type": "PANEL ANTENNA",
  "conditions_json": {{
    "all": [
      {{
        "name": "category",
        "operator": "equal_to",
        "value": "ANTENNA"
      }},
      {{
        "name": "model",
        "operator": "contains",
        "value": "KEYWORDS"
      }}
    ]
  }},
  "actions_json": [
    {{
      "name": "assign_price_item",
      "params": {{
        "sor_code": "{correct_sor_code}",
        "target_name": "{correct_sor_name}",
        "comment": "AI proposal: Mapped model via learned note rule."
      }}
    }}
  ],
  "priority": 110,
  "logic_explanation": "Plain english summary of why this rule fires."
}}

Response format: Return ONLY the JSON object. Do not wrap in markdown or add explanations."""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.0}
    }

    try:
        res_json = send_gemini_request(url, payload, timeout=15)
        candidates = res_json.get("candidates", [])
        if not candidates:
            return None
        text_out = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
        rule_data = json.loads(text_out)
        
        # 1. Strict Schema Guard
        if not validate_proposed_rule_schema(rule_data):
            print("[AI Rule Improvement] Schema validation failed. Proposed rule rejected.")
            return None

        # 2. Run proposed rule simulation
        sim_stats = run_proposed_rule_simulation(
            rule_data["conditions_json"],
            rule_data["actions_json"],
            correct_sor_code,
            correct_sor_name
        )
        
        # Add metadata fields
        rule_data["status"] = "PENDING_REVIEW"
        rule_data["source"] = "AI_PROPOSED"
        rule_data["version"] = 1
        rule_data["target_sor_code"] = correct_sor_code
        rule_data["target_sor_name"] = correct_sor_name
        rule_data["simulation_stats"] = json.dumps(sim_stats)
        rule_data["conditions_json"] = json.dumps(rule_data["conditions_json"])
        rule_data["actions_json"] = json.dumps(rule_data["actions_json"])

        # 3. Save rule to database in PENDING_REVIEW state
        rule_id = create_mapping_rule(rule_data)
        print(f"[AI Rule Improvement] Proposed rule #{rule_id} created in PENDING_REVIEW state (Precision: {sim_stats['precision']}%).")
        return rule_id
    except Exception as e:
        print(f"[AI Rule Improvement] Proposal generation failed: {e}")
        return None


def compile_natural_language_conditions_with_ai(
    rule_name: str,
    action: str,
    item_type: str,
    matching_conditions: str,
    target_sor_code: str,
    target_sor_name: str,
    api_key: str = ""
) -> Tuple[str, str]:
    """
    Calls Google Gemini to translate a human-readable rule name, action, item type, and
    matching conditions into structured conditions_json and actions_json compatible with the Venmo engine.
    """
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY") or ""
    
    if not api_key:
        # Fallback to default empty structures
        return '{"all": []}', '[]'
        
    model_name = "gemini-3.5-flash-lite"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    prompt = f"""You are a precise telecom rule compiler. Translate the human-readable rule description and matching conditions into a structured JSON condition tree for the 'business-rules' Python package.

Allowed Variable Names: "category", "action", "location", "height_mm", "sector_index", "is_active", "model", "raw_text", "quantity"
Allowed Operator Names: "equal_to", "not_equal_to", "contains", "does_not_contain", "greater_than", "less_than", "is_true", "is_false"

Telecom mapping guidelines:
- "category" can be "ANTENNA", "RRU", "TMA_FILTER", "GPS", "BASEBAND", "DCDU", "CIVIL_MOUNT", "SHELTER_EQUIPMENT", "TESTING", "EQUIPMENT".
- "is_active" represents if it is a 5G AAU or Massive MIMO (active antenna).
- "sector_index" represents which sector occurrence (1 for first antenna, > 1 for extra/additional).
- "action" represents scope action: "INSTALL", "REMOVE", "RELOCATE", "REPLACE".

Rule Context:
- Rule Name: "{rule_name}"
- Action Filter: "{action}"
- Item Type: "{item_type}"
- Human Matching Conditions: "{matching_conditions}"

Your task: Propose a valid JSON object matching the rule's conditions. It must have either "all" or "any" at the top level.
Keep the conditions highly specific to match this rule.

Example output format:
{{
  "all": [
    {{
      "name": "category",
      "operator": "equal_to",
      "value": "ANTENNA"
    }},
    {{
      "name": "is_active",
      "operator": "is_true",
      "value": true
    }}
  ]
}}

Return ONLY a valid JSON object. No markdown, no comments, no explanations."""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.0}
    }
    
    try:
        res = send_gemini_request(url, payload, timeout=15)
        text_out = res.get("candidates", [])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
        conditions = json.loads(text_out)
        
        # Standardize conditions envelope
        if "all" not in conditions and "any" not in conditions:
            if conditions:
                conditions = {"all": [conditions]}
            else:
                conditions = {"all": []}
                
        # Fix the boolean values for is_true / is_false operators as expected by business-rules
        def fix_bool_value(node):
            if "all" in node:
                for sub in node["all"]:
                    fix_bool_value(sub)
            elif "any" in node:
                for sub in node["any"]:
                    fix_bool_value(sub)
            else:
                if node.get("operator") in ["is_true", "is_false"]:
                    node["value"] = True
        fix_bool_value(conditions)
        
        conditions_json = json.dumps(conditions)
        
        # Build actions_json
        actions = [
            {
                "name": "assign_price_item",
                "params": {
                    "sor_code": target_sor_code or "UNQUOTED",
                    "target_name": target_sor_name or rule_name,
                    "comment": f"Mapped via rule: {rule_name}"
                }
            }
        ]
        actions_json = json.dumps(actions)
        return conditions_json, actions_json
    except Exception as e:
        print(f"[Rule Compiler] Gemini failed to compile rule: {e}")
        # Return fallback structures
        return '{"all": []}', '[]'


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


