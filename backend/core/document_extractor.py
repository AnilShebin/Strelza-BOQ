"""
Document Extractor.
Scans layout drawing pages page-by-page using Gemini Vision for universal structured and unstructured content extraction.
"""
import os
import base64
import json
import fitz
from typing import Dict, List, Any, Tuple, Optional
import re
from services.ai_service import (
    get_prompt_by_name,
    run_gemini_vision_document_extractor,
    load_env_file,
    send_gemini_request
)

def load_extractor_settings() -> Dict[str, Any]:
    """Loads active settings.json safely without importing main.py to prevent circular dependencies."""
    default_settings = {
        "gemini_rate_limit": 0,
        "gemini_reconciliation_model": "gemini-3.1-flash-lite"
    }
    settings_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "settings.json")
    if os.path.exists(settings_file):
        try:
            with open(settings_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for k, v in default_settings.items():
                    if k not in data:
                        data[k] = v
                return data
        except Exception:
            pass
    return default_settings

def get_bbox_overlap_iou(box1: Optional[List[float]], box2: Optional[List[float]]) -> float:
    """Calculates the Intersection over Union (IoU) between two bounding boxes in points [xmin, ymin, xmax, ymax]."""
    if not box1 or not box2 or len(box1) < 4 or len(box2) < 4:
        return 0.0
    x0 = max(box1[0], box2[0])
    y0 = max(box1[1], box2[1])
    x1 = min(box1[2], box2[2])
    y1 = min(box1[3], box2[3])
    
    if x1 <= x0 or y1 <= y0:
        return 0.0
        
    intersection = (x1 - x0) * (y1 - y0)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - intersection
    if union <= 0:
        return 0.0
    return intersection / union

def normalize_words(s: str) -> List[str]:
    """Splits normalized text into individual word tokens for Jaccard comparison."""
    return re.findall(r'[a-z0-9]+', str(s).lower())

def jaccard_word_overlap(words_a: List[str], words_b: List[str]) -> float:
    """
    Computes Jaccard word overlap between two token lists.
    Returns 0.0 if either is empty. Range: [0.0, 1.0].
    """
    if not words_a or not words_b:
        return 0.0
    set_a = set(words_a)
    set_b = set(words_b)
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0

def merge_adjacent_blocks(blocks: list, vertical_gap: float = 35.0, h_overlap_ratio: float = 0.20) -> list:
    """Merges spatially nearby text-only blocks into single coherent candidates."""
    text_entries = [
        [xmn, ymn, xmx, ymx, txt]
        for xmn, ymn, xmx, ymx, txt in blocks
        if txt.strip()
    ]
    if not text_entries:
        return []
    text_entries.sort(key=lambda b: (b[1], b[0]))  # sort by ymin, then xmin

    merged: list = []
    cur = list(text_entries[0])
    for entry in text_entries[1:]:
        bx0, by0, bx1, by1, btext = entry
        cx0, cy0, cx1, cy1, ctext = cur

        v_dist = max(0.0, by0 - cy1)
        x_overlap = min(bx1, cx1) - max(bx0, cx0)
        x_total   = max(bx1, cx1) - min(bx0, cx0)
        h_ratio   = (x_overlap / x_total) if x_total > 0 else 0.0

        if v_dist <= vertical_gap and h_ratio >= h_overlap_ratio:
            cur[0] = min(cx0, bx0)  # expand bbox
            cur[1] = min(cy0, by0)
            cur[2] = max(cx1, bx1)
            cur[3] = max(cy1, by1)
            cur[4] = ctext.rstrip() + " " + btext.strip()  # concatenate text
        else:
            merged.append(tuple(cur))
            cur = list(entry)
    merged.append(tuple(cur))
    return merged

def get_complete_canonical_blocks(fitz_page, pdf_path: str) -> List[Dict[str, Any]]:
    """Extracts, rotates, and merges all native PDF blocks to form the complete canonical layer."""
    raw_blocks = fitz_page.get_text("blocks")
    if isinstance(raw_blocks, str):
        raw_blocks = [(0.0, 0.0, 1000.0, 1000.0, raw_blocks, 0, 0)]
    elif not isinstance(raw_blocks, list):
        raw_blocks = []
        
    rot_matrix = getattr(fitz_page, "rotation_matrix", None)
    
    blocks = []
    for item in raw_blocks:
        if isinstance(item, (tuple, list)) and len(item) >= 5:
            xmin, ymin, xmax, ymax, text = item[:5]
            if rot_matrix and isinstance(rot_matrix, fitz.Matrix):
                rect = fitz.Rect(xmin, ymin, xmax, ymax) * rot_matrix
                xmin, ymin, xmax, ymax = rect.x0, rect.y0, rect.x1, rect.y1
            blocks.append((xmin, ymin, xmax, ymax, text))
        
    merged_blocks = merge_adjacent_blocks(blocks)
    
    canonical_blocks = []
    block_idx = 0
    for xmin, ymin, xmax, ymax, text in merged_blocks:
        cleaned_text = text.strip()
        if not cleaned_text:
            continue
        block_id = f"B{block_idx}"
        canonical_blocks.append({
            "id": block_id,
            "text": cleaned_text,
            "bbox": [round(xmin, 2), round(ymin, 2), round(xmax, 2), round(ymax, 2)]
        })
        block_idx += 1
    return canonical_blocks

def filter_gemini_prompt_blocks(complete_blocks: List[Dict[str, Any]], pdf_path: str) -> List[Dict[str, Any]]:
    """Filters the complete blocks to provide Gemini prompt with a clean, useful subset (hides noise blocks)."""
    filtered = []
    filename_part_words = normalize_words(os.path.basename(pdf_path)) if pdf_path else []
    for b in complete_blocks:
        text = b["text"]
        block_words = normalize_words(text)
        
        # 1. Skip short blocks
        if len(block_words) < 2:
            continue
        # 2. Skip pure numbers
        if all(w.isdigit() for w in block_words):
            continue
            
        # 3. Filter common drawing header/footer noise
        noise_tokens = {"drawnby", "checkby"}
        if noise_tokens.intersection(set(block_words)):
            continue
        # Filter blocks that are purely the filename
        if len(filename_part_words) >= 2 and set(filename_part_words[:2]).issubset(set(block_words)) and len(block_words) <= 4:
            continue
            
        filtered.append(b)
    return filtered

def map_elements_to_blocks_fallback(elements: List[Dict[str, Any]], complete_blocks: List[Dict[str, Any]]):
    """Fuzzy maps elements to block IDs if Gemini omits them."""
    for el in elements:
        if not el.get("block_ids"):
            el_content = el.get("content")
            if isinstance(el_content, dict):
                el_text = json.dumps(el_content)
            else:
                el_text = str(el_content)
            el_words = normalize_words(el_text)
            if not el_words:
                continue
                
            best_score = 0.0
            best_block_ids = []
            
            # 1. Check direct Jaccard match first
            for b in complete_blocks:
                b_words = normalize_words(b["text"])
                score = jaccard_word_overlap(el_words, b_words)
                if score > best_score:
                    best_score = score
                    best_block_ids = [b["id"]]
            
            # 2. Check substring containment Jaccard if exact match was low but one contains another
            # Or if Jaccard was decent (e.g. >= 0.40) and it overlapped spatially
            if best_score < 0.85:
                # Spatial check fallback: if there is high overlap IoU and decent text similarity
                el_bbox = el.get("bbox")
                if el_bbox:
                    for b in complete_blocks:
                        iou = get_bbox_overlap_iou(el_bbox, b["bbox"])
                        if iou > 0.4:
                            b_words = normalize_words(b["text"])
                            score = jaccard_word_overlap(el_words, b_words)
                            if score >= 0.25:
                                                best_block_ids = [b["id"]]
                                                break
            else:
                el["block_ids"] = best_block_ids

def is_extraction_suspiciously_incomplete(elements: List[Dict[str, Any]], raw_text: str, fitz_page) -> bool:
    """Evaluates completeness using multiple signals to check if extraction is suspiciously incomplete."""
    # Signal 1: Average extraction confidence check
    confidences = [el["confidence"] for el in elements if el.get("confidence") is not None]
    if confidences and (sum(confidences) / len(confidences)) < 0.6:
        print("[Completeness Check] Flagged: Average extraction confidence is low.")
        return True

    # Signal 2: Check global counts on scanned drawings (no native text)
    if not raw_text:
        if len(elements) < 3:
            print(f"[Completeness Check] Flagged scanned page: very few elements extracted ({len(elements)}).")
            return True
        return False

    # Count words in native text
    native_word_count = len([w for w in raw_text.split() if len(w) > 1])
    
    # Count words in extracted elements
    extracted_word_count = 0
    for el in elements:
        content = el.get("content", "")
        if isinstance(content, str):
            extracted_word_count += len(content.split())
        elif isinstance(content, dict):
            extracted_word_count += len(str(content).split())

    # Signal 3: Substantial text but very low extracted text
    if native_word_count > 150 and extracted_word_count < 25:
        print(f"[Completeness Check] Flagged: Native text has {native_word_count} words but elements have only {extracted_word_count} words.")
        return True
    if native_word_count > 50 and extracted_word_count < 10:
        print(f"[Completeness Check] Flagged: Native text has {native_word_count} words but elements have only {extracted_word_count} words.")
        return True

    # Signal 4: Bbox quadrant coverage check
    width = float(fitz_page.rect.width)
    height = float(fitz_page.rect.height)
    
    quadrants = [
        ("Top-Left", fitz.Rect(0, 0, width/2, height/2)),
        ("Top-Right", fitz.Rect(width/2, 0, width, height/2)),
        ("Bottom-Left", fitz.Rect(0, height/2, width/2, height)),
        ("Bottom-Right", fitz.Rect(width/2, height/2, width, height))
    ]
    
    for name, rect in quadrants:
        quad_text = fitz_page.get_text("text", clip=rect).strip()
        quad_words = len([w for w in quad_text.split() if len(w) > 1])
        
        if quad_words > 15: # substantial text in quadrant
            has_element = False
            for el in elements:
                bbox = el.get("bbox")
                if bbox:
                    cx = (bbox[0] + bbox[2]) / 2.0
                    cy = (bbox[1] + bbox[3]) / 2.0
                    
                    if name == "Top-Left" and cx < width/2 and cy < height/2:
                        has_element = True
                    elif name == "Top-Right" and cx >= width/2 and cy < height/2:
                        has_element = True
                    elif name == "Bottom-Left" and cx < width/2 and cy >= height/2:
                        has_element = True
                    elif name == "Bottom-Right" and cx >= width/2 and cy >= height/2:
                        has_element = True
            
            if not has_element:
                print(f"[Completeness Check] Flagged: Quadrant '{name}' has {quad_words} words in native text but 0 extracted elements.")
                return True
                
    return False

def map_global_to_local_bbox(global_bbox: List[float], crop_coords: Tuple[float, float, float, float]) -> List[float]:
    """Converts global page bbox coordinates to local crop coords system (0 to 1000) for Gemini prompt."""
    xmin_crop, ymin_crop, xmax_crop, ymax_crop = crop_coords
    crop_w = xmax_crop - xmin_crop
    crop_h = ymax_crop - ymin_crop
    
    xmin_g, ymin_g, xmax_g, ymax_g = global_bbox
    
    xmin_l = ((xmin_g - xmin_crop) / crop_w) * 1000.0
    ymin_l = ((ymin_g - ymin_crop) / crop_h) * 1000.0
    xmax_l = ((xmax_g - xmin_crop) / crop_w) * 1000.0
    ymax_l = ((ymax_g - ymin_crop) / crop_h) * 1000.0
    
    xmin_l = max(0.0, min(1000.0, xmin_l))
    ymin_l = max(0.0, min(1000.0, ymin_l))
    xmax_l = max(0.0, min(1000.0, xmax_l))
    ymax_l = max(0.0, min(1000.0, ymax_l))
    
    return [round(ymin_l, 2), round(xmin_l, 2), round(ymax_l, 2), round(xmax_l, 2)]

def is_bbox_overlapping_rect(bbox: List[float], rect: Tuple[float, float, float, float]) -> bool:
    """Checks if a global bbox overlaps a crop rect."""
    xmin_crop, ymin_crop, xmax_crop, ymax_crop = rect
    xmin_b, ymin_b, xmax_b, ymax_b = bbox
    return not (xmax_b < xmin_crop or xmin_b > xmax_crop or ymax_b < ymin_crop or ymin_b > ymax_crop)

# ----------------- REBUILT EXTRACTOR ARCHITECTURE V2 -----------------

UNIFIED_EXTRACTOR_PROMPT_TEMPLATE = """You are a precise, exhaustive document extraction vision AI.
Your task is to analyze the provided page image (as the primary source of truth) and its native text layer (as supplementary reference) to extract BOTH:
1. STRUCTURED elements (tables, grids, schedules, key-value data list, or structured properties).
2. UNSTRUCTURED elements (general notes, annotations, labels, callouts, paragraph text, or standalone drawing descriptions).

CRITICAL INSTRUCTIONS FOR HIGH-FIDELITY EXTRACTION:
1. Identify and scan all structured tables, schedules, grids, or key-value sections.
2. Extract ALL cells, keeping the exact grid and column layout. Do NOT combine adjacent columns (e.g., if columns are 'EQUIPMENT' and 'EQUIPMENT DETAILS', extract them as separate columns; do not merge them into one).
3. Do NOT skip any rows, even empty-looking spacer rows or rows with empty cells. Keep the original row index matching the sheet.
4. For structured table elements:
   - "type" must be "structured".
   - "content" must be a JSON object with headers and rows: { "headers": ["Col 1", "Col 2", ...], "rows": [["Val 1A", "Val 1B", ...], ...] }
   - Or if it is key-value properties: { "fields": { "Key 1": "Value 1", ... } }
5. Scan the page completely for any drawing notes, layout labels, notes blocks, and annotations.
6. For unstructured elements:
   - "type" must be "unstructured".
   - "content" must be a plain string containing the exact text of the label or note. Do not summarize or format it.
7. Provide the normalized bounding box [ymin, xmin, ymax, xmax] between 0 and 1000 relative to the page.
8. Map elements to the NATIVE PDF TEXT BLOCKS by matching their IDs (e.g. B0, B1) in the "block_ids" array.

Return ONLY a valid JSON object matching the following structure:
{
  "elements": [
    {
      "type": "structured",
      "title": "Equipment Notes Table",
      "bbox": [100, 100, 300, 900],
      "block_ids": ["B0", "B1"],
      "content": {
        "headers": ["ITEM", "EQUIPMENT", "EQUIPMENT DETAILS", "EXISTING", "PROPOSED", "TOTAL", "REFERENCE DWG"],
        "rows": [
          ["1", "ELTEK SP18 RRU HC (PSU)", "600(w) x 600(d) x 2200mm(h)", "1", "0", "1", "SHEET E4-1"]
        ]
      },
      "confidence": 0.99
    },
    {
      "type": "unstructured",
      "title": "Drawing General Note",
      "bbox": [500, 120, 520, 350],
      "block_ids": ["B2"],
      "content": "EXISTING TELSTRA RBS6102 ODU TO ACCOMMODATE PROPOSED EQUIPMENT.",
      "confidence": 0.95
    }
  ]
}

If no extractable content is found, return:
{
  "elements": []
}"""

def render_page_to_jpeg_safe(fitz_page, initial_dpi: int, initial_quality: int = 85) -> Tuple[str, str]:
    """Renders page to JPEG and base64 encodes it, dynamically downgrading quality/DPI if base64 size > 1MB."""
    dpi = initial_dpi
    quality = initial_quality
    
    for attempt in range(3):
        pix = fitz_page.get_pixmap(dpi=dpi)
        img_bytes = pix.tobytes("jpg", jpg_quality=quality)
        img_base64 = base64.b64encode(img_bytes).decode("utf-8")
        
        size_bytes = len(img_base64)
        if size_bytes <= 1024 * 1024:
            return img_base64, "image/jpeg"
            
        if attempt == 0:
            quality = 70
            print(f"[Size Control] Payload estimated size ({size_bytes / 1024:.1f} KB) > 1MB. Downgrading quality to 70...")
        elif attempt == 1:
            dpi = max(100, int(dpi * 0.8))
            quality = 70
            print(f"[Size Control] Payload estimated size ({size_bytes / 1024:.1f} KB) still > 1MB. Downgrading DPI to {dpi}...")
        else:
            break
            
    return img_base64, "image/jpeg"

def is_bbox_mostly_contained_in_outer(inner: Optional[List[float]], outer: Optional[List[float]], threshold: float = 0.85) -> bool:
    """Checks if the inner bbox is mostly contained inside the outer bbox (> threshold ratio of inner area)."""
    if not inner or not outer or len(inner) < 4 or len(outer) < 4:
        return False
    x0 = max(inner[0], outer[0])
    y0 = max(inner[1], outer[1])
    x1 = min(inner[2], outer[2])
    y1 = min(inner[3], outer[3])
    
    if x1 <= x0 or y1 <= y0:
        return False
        
    intersection = (x1 - x0) * (y1 - y0)
    inner_area = (inner[2] - inner[0]) * (inner[3] - inner[1])
    if inner_area <= 0:
        return False
    return (intersection / inner_area) >= threshold


def merge_and_deduplicate_elements(existing_elements: List[Dict[str, Any]], new_elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Merges new elements into existing ones, deduplicating by bbox IoU, block_id overlap, or spatial containment."""
    merged = list(existing_elements)
    
    for new_el in new_elements:
        new_bbox = new_el.get("bbox")
        new_block_ids = set(new_el.get("block_ids", []))
        new_type = new_el.get("type", "")
        
        is_duplicate = False
        to_remove = []
        
        for ext_el in merged:
            ext_bbox = ext_el.get("bbox")
            ext_block_ids = set(ext_el.get("block_ids", []))
            ext_type = ext_el.get("type", "")
            
            # 1. Structured table containment check to filter out sub-cell annotations
            if new_type == "unstructured" and ext_type == "structured" and new_bbox and ext_bbox:
                if is_bbox_mostly_contained_in_outer(new_bbox, ext_bbox):
                    is_duplicate = True
                    break
                    
            if new_type == "structured" and ext_type == "unstructured" and new_bbox and ext_bbox:
                if is_bbox_mostly_contained_in_outer(ext_bbox, new_bbox):
                    to_remove.append(ext_el)
                    continue

            # 2. Deduplicate structured elements overlapping global structured elements (IoU > 0.1)
            if new_type == "structured" and ext_type == "structured" and new_bbox and ext_bbox:
                iou = get_bbox_overlap_iou(new_bbox, ext_bbox)
                if iou > 0.1:
                    is_duplicate = True
                    break
                    
            # 3. Deduplicate by block_ids intersection
            block_overlap = False
            if new_block_ids and ext_block_ids:
                if new_block_ids.intersection(ext_block_ids):
                    block_overlap = True
                    
            # 4. Deduplicate by spatial overlap (IoU > 0.40)
            spatial_overlap = False
            if new_bbox and ext_bbox:
                iou = get_bbox_overlap_iou(new_bbox, ext_bbox)
                if iou > 0.4:
                    spatial_overlap = True
                    
            if block_overlap or spatial_overlap:
                is_duplicate = True
                break
                
            # Fallback exact text match for bboxless elements
            if not new_bbox and not ext_bbox:
                if str(new_el.get("content", "")).strip().lower() == str(ext_el.get("content", "")).strip().lower():
                    is_duplicate = True
                    break
                    
        for rm in to_remove:
            if rm in merged:
                merged.remove(rm)
                
        if not is_duplicate:
            merged.append(new_el)
            
    return merged

def parse_and_scale_ai_elements(
    ai_elements: List[Dict[str, Any]], 
    page_num: int, 
    fitz_page,
    crop_coords: Optional[Tuple[float, float, float, float]] = None,
    complete_canonical_blocks: Optional[List[Dict[str, Any]]] = None
) -> List[Dict[str, Any]]:
    """Parses extracted elements and scales coordinates. Snaps to canonical block bboxes but DOES NOT override text content."""
    parsed_elements = []
    width = float(fitz_page.rect.width)
    height = float(fitz_page.rect.height)
    
    if crop_coords:
        xmin_crop, ymin_crop, xmax_crop, ymax_crop = crop_coords
        crop_w = xmax_crop - xmin_crop
        crop_h = ymax_crop - ymin_crop
    else:
        xmin_crop, ymin_crop, xmax_crop, ymax_crop = 0.0, 0.0, width, height
        crop_w, crop_h = width, height

    if ai_elements:
        if complete_canonical_blocks:
            map_elements_to_blocks_fallback(ai_elements, complete_canonical_blocks)

        block_map = {b["id"]: b for b in complete_canonical_blocks} if complete_canonical_blocks else {}

        for el in ai_elements:
            if not isinstance(el, dict):
                continue
            item_type = str(el.get("type", "")).strip().lower()
            if item_type not in ["structured", "unstructured"]:
                print(f"[Document Extractor] Skipping element with invalid type: {item_type}")
                continue
            
            title = el.get("title")
            content = el.get("content")
            confidence = el.get("confidence")
            block_ids = el.get("block_ids", [])
            
            snapped_bbox = None
            if block_ids and block_map:
                xmins, ymins, xmaxs, ymaxs = [], [], [], []
                for b_id in block_ids:
                    if b_id in block_map:
                        b_box = block_map[b_id]["bbox"]
                        xmins.append(b_box[0])
                        ymins.append(b_box[1])
                        xmaxs.append(b_box[2])
                        ymaxs.append(b_box[3])
                if xmins:
                    snapped_bbox = [
                        round(min(xmins), 2),
                        round(min(ymins), 2),
                        round(max(xmaxs), 2),
                        round(max(ymaxs), 2)
                    ]
            
            is_reconciled = False
            if snapped_bbox:
                bbox = snapped_bbox
                is_reconciled = True
            else:
                raw_bbox = el.get("bbox")
                if raw_bbox and isinstance(raw_bbox, list) and len(raw_bbox) >= 4:
                    ymin_local, xmin_local, ymax_local, xmax_local = raw_bbox
                    
                    xmin_pt_global = xmin_crop + (xmin_local / 1000.0) * crop_w
                    ymin_pt_global = ymin_crop + (ymin_local / 1000.0) * crop_h
                    xmax_pt_global = xmin_crop + (xmax_local / 1000.0) * crop_w
                    ymax_pt_global = ymin_crop + (ymax_local / 1000.0) * crop_h
                    
                    bbox = [
                        round(xmin_pt_global, 2),
                        round(ymin_pt_global, 2),
                        round(xmax_pt_global, 2),
                        round(ymax_pt_global, 2)
                    ]
                else:
                    bbox = None

            parsed_el = {
                "page": page_num,
                "type": item_type,
                "title": title,
                "content": content,
                "bbox": bbox,
                "confidence": confidence,
                "block_ids": block_ids
            }
            if is_reconciled:
                parsed_el["is_reconciled"] = True
                parsed_el["reconciliation_source"] = "pdf_text_layer"
                parsed_el["extraction_confidence"] = "HIGH"
            elif bbox:
                parsed_el["is_reconciled"] = False
                parsed_el["reconciliation_source"] = "ocr_fallback"
                parsed_el["extraction_confidence"] = "MEDIUM"
            else:
                parsed_el["is_reconciled"] = False
                parsed_el["reconciliation_source"] = "unmatched"
                parsed_el["extraction_confidence"] = "LOW"
                
            parsed_elements.append(parsed_el)
            
    return parsed_elements

def process_single_page(
    pdf_path: str,
    page_idx: int,
    api_key: str,
    unified_prompt: str
) -> List[Dict[str, Any]]:
    """Worker task that processes a single PDF page using a single unified visual scan."""
    page_num = page_idx + 1
    doc = fitz.open(pdf_path)
    try:
        fitz_page = doc[page_idx]
        
        complete_canonical_blocks = get_complete_canonical_blocks(fitz_page, pdf_path)
        prompt_blocks = filter_gemini_prompt_blocks(complete_canonical_blocks, pdf_path)
        
        formatted_blocks = ""
        if prompt_blocks:
            formatted_blocks = "NATIVE PDF TEXT BLOCKS:\n" + "\n".join([f"{b['id']}: \"{b['text']}\"" for b in prompt_blocks])
            
        width = float(fitz_page.rect.width)
        height = float(fitz_page.rect.height)
        area_sq_in = (width / 72.0) * (height / 72.0)
        
        # Upfront DPI sizing based on page physical area
        if area_sq_in < 200.0:
            dpi = 150
        else:
            dpi = 120
            
        print(f"[Document Extractor] Scanning page {page_num} at {dpi} DPI...")
        try:
            img_base64, mime_type = render_page_to_jpeg_safe(fitz_page, dpi)
            ai_elements, _ = run_gemini_vision_document_extractor(
                img_base64, formatted_blocks, unified_prompt, api_key, mime_type=mime_type
            )
            page_elements = parse_and_scale_ai_elements(
                ai_elements, page_num, fitz_page, complete_canonical_blocks=complete_canonical_blocks
            )
        except Exception as e:
            print(f"[Document Extractor] Error during page {page_num} visual extraction: {e}")
            page_elements = []
            
        return page_elements
    finally:
        doc.close()

def extract_document_elements(pdf_path: str, selected_pages: Optional[List[int]] = None) -> Dict[str, Any]:
    """Scans all selected pages of the PDF concurrently using Gemini Vision and aggregates results thread-safely."""
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

    load_env_file()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[Document Extractor] Warning: GEMINI_API_KEY is missing.")
        return {"elements": [], "raw_items": []}

    unified_prompt = get_prompt_by_name("unified_extractor", UNIFIED_EXTRACTOR_PROMPT_TEMPLATE)
    
    additional_prompt = get_prompt_by_name("additional_extraction_instructions", "")
    if additional_prompt.strip():
        unified_prompt = unified_prompt + "\n\nADDITIONAL CLIENT-SPECIFIC INSTRUCTIONS:\n" + additional_prompt

    doc = fitz.open(pdf_path)
    page_count = len(doc)
    doc.close()
    
    if selected_pages is not None:
        indices_to_scan = [p - 1 for p in selected_pages if 1 <= p <= page_count]
    else:
        indices_to_scan = list(range(page_count))
        
    all_elements = []
    
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    futures = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        for page_idx in indices_to_scan:
            page_num = page_idx + 1
            fut = executor.submit(process_single_page, pdf_path, page_idx, api_key, unified_prompt)
            futures[fut] = page_num
            
    # Gather results safely and in page order on the main thread
    results_by_page = {}
    for fut in as_completed(futures):
        page_num = futures[fut]
        try:
            results_by_page[page_num] = fut.result()
        except Exception as e:
            print(f"[Document Extractor] Error processing page {page_num}: {e}")
            results_by_page[page_num] = []
            
    for page_num in sorted(results_by_page.keys()):
        all_elements.extend(results_by_page[page_num])
        
    return {
        "elements": all_elements,
        "raw_items": []
    }

def reextract_single_page_elements(pdf_path: str, page_num: int, existing_elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Re-extracts a specific single page and updates the elements."""
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

    load_env_file()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[Document Extractor] Warning: GEMINI_API_KEY is missing.")
        return []

    unified_prompt = get_prompt_by_name("unified_extractor", UNIFIED_EXTRACTOR_PROMPT_TEMPLATE)
    
    additional_prompt = get_prompt_by_name("additional_extraction_instructions", "")
    if additional_prompt.strip():
        unified_prompt = unified_prompt + "\n\nADDITIONAL CLIENT-SPECIFIC INSTRUCTIONS:\n" + additional_prompt

    doc = fitz.open(pdf_path)
    try:
        page_idx = page_num - 1
        fitz_page = doc[page_idx]
        
        complete_canonical_blocks = get_complete_canonical_blocks(fitz_page, pdf_path)
        prompt_blocks = filter_gemini_prompt_blocks(complete_canonical_blocks, pdf_path)
        
        formatted_blocks = ""
        if prompt_blocks:
            formatted_blocks = "NATIVE PDF TEXT BLOCKS:\n" + "\n".join([f"{b['id']}: \"{b['text']}\"" for b in prompt_blocks])
            
        width = float(fitz_page.rect.width)
        height = float(fitz_page.rect.height)
        area_sq_in = (width / 72.0) * (height / 72.0)
        
        # Decide DPI based on physical size
        if area_sq_in < 200.0:
            dpi = 150
        else:
            dpi = 120
            
        print(f"[Document Extractor] Re-extracting page {page_num} at {dpi} DPI...")
        try:
            img_base64, mime_type = render_page_to_jpeg_safe(fitz_page, dpi)
            ai_elements, _ = run_gemini_vision_document_extractor(
                img_base64, formatted_blocks, unified_prompt, api_key, mime_type=mime_type
            )
            page_elements = parse_and_scale_ai_elements(
                ai_elements, page_num, fitz_page, complete_canonical_blocks=complete_canonical_blocks
            )
        except Exception as e:
            print(f"[Document Extractor] Error during page {page_num} visual extraction: {e}")
            page_elements = []
            
        return page_elements
    finally:
        doc.close()
