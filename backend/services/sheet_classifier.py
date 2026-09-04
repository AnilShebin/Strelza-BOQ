"""
Sheet Classifier Service.
Extracts Title Block metadata (Drawing No, Sheet No, Sheet Title, Site ID) from drawing pages
and dynamically classifies each sheet's commercial role (SCHEDULE, PLAN_LAYOUT, ELEVATION, etc.)
independent of PDF page order or page count.
"""

import re
from typing import Dict, Any, List, Optional


class SheetMetadata:
    def __init__(
        self,
        page_num: int,
        sheet_number: str = "",
        drawing_number: str = "",
        sheet_title: str = "",
        site_id: str = "",
        site_name: str = "",
        sheet_role: str = "PLAN_LAYOUT",
        raw_title_block_text: str = ""
    ):
        self.page_num = page_num
        self.sheet_number = sheet_number
        self.drawing_number = drawing_number
        self.sheet_title = sheet_title
        self.site_id = site_id
        self.site_name = site_name
        self.sheet_role = sheet_role
        self.raw_title_block_text = raw_title_block_text

    def to_dict(self) -> Dict[str, Any]:
        return {
            "page_num": self.page_num,
            "sheet_number": self.sheet_number,
            "drawing_number": self.drawing_number,
            "sheet_title": self.sheet_title,
            "site_id": self.site_id,
            "site_name": self.site_name,
            "sheet_role": self.sheet_role,
            "display_label": f"{self.sheet_number}: {self.sheet_title}".strip(": ") or f"Sheet {self.page_num}"
        }


def extract_sheet_metadata_from_elements(page_elements: List[Dict[str, Any]], page_num: int) -> SheetMetadata:
    """
    Scans elements extracted from a single PDF page to identify the Title Block and classify sheet role.
    """
    sheet_number = ""
    drawing_number = ""
    sheet_title = ""
    site_id = ""
    site_name = ""
    raw_tb_text = ""
    has_authoritative_schedule = False

    # 1. Search for title block elements or bottom-right corner elements (typical title block location)
    for el in page_elements:
        title = el.get("title", "")
        content = el.get("content")
        el_type = el.get("type")
        bbox = el.get("bbox") or [0, 0, 0, 0]

        # Check for structured title block properties
        if isinstance(content, dict) and "fields" in content:
            fields = content["fields"]
            for k, v in fields.items():
                k_clean = str(k).upper()
                v_str = str(v).strip()
                if any(w in k_clean for w in ["SHT", "SHEET NO", "SHEET NUMBER"]):
                    sheet_number = v_str
                elif any(w in k_clean for w in ["DWG NO", "DRAWING NO", "DRAWING NUMBER"]):
                    drawing_number = v_str
                elif any(w in k_clean for w in ["TITLE", "SHEET TITLE", "DESCRIPTION"]):
                    sheet_title = v_str
                elif any(w in k_clean for w in ["SITE NO", "SITE ID", "SITE NUMBER"]):
                    site_id = v_str
                elif any(w in k_clean for w in ["SITE NAME", "LOCATION"]):
                    site_name = v_str

        # Check if this element is an authoritative configuration table
        if el_type == "structured" and isinstance(content, dict) and "headers" in content:
            headers_upper = [str(h).upper() for h in content.get("headers", [])]
            table_title_upper = str(title).upper()
            
            # Common keywords indicating an inventory/configuration table
            is_config_table = (
                any(w in table_title_upper for w in ["CONFIGURATION", "SCHEDULE", "EQUIPMENT TABLE", "ANTENNA TABLE"]) or
                any(w in headers_upper for w in ["ANTENNA NO", "ANTENNA TYPE", "EQUIPMENT", "ACTION REQUIRED", "ACTION", "MODEL"])
            )
            if is_config_table:
                has_authoritative_schedule = True
                if not sheet_title:
                    sheet_title = title

        # Check text in unstructured elements located in the title block zone (usually y > 700 and x > 600)
        if isinstance(content, str):
            c_text = content.strip()
            c_upper = c_text.upper()
            
            # Check for standard title block tokens
            if "SHT NO." in c_upper or "SHEET NO." in c_upper or "DWG NO." in c_upper or "MOBILE NETWORK SITE" in c_upper:
                raw_tb_text += " " + c_text
                
                # Extract SHT NO. (e.g., S1-1, S1-2, E1, T1)
                sht_m = re.search(r'\b(?:SHT|SHEET)\s*(?:NO\.?|#)\s*[:\s]?\s*([A-Z0-9\-_/]+)', c_upper)
                if sht_m and not sheet_number:
                    sheet_number = sht_m.group(1).strip()
                elif not sheet_number:
                    sht_fallback = re.search(r'\bSHT\s*[:\s]\s*([A-Z0-9\-_/]+)', c_upper)
                    if sht_fallback:
                        sheet_number = sht_fallback.group(1).strip()
                    
                # Extract DWG NO. (e.g., N109732)
                dwg_m = re.search(r'(?:DWG|DRAWING)\s*(?:NO\.?|#)?\s*[:\s]?\s*([A-Z0-9\-_/]+)', c_upper)
                if dwg_m and not drawing_number:
                    drawing_number = dwg_m.group(1).strip()

                # Extract Site ID (e.g. 288399)
                site_m = re.search(r'(?:SITE\s*(?:NO\.?|ID|NUMBER)?|MOBILE\s+NETWORK\s+SITE)\s*[:\s]?\s*(\d{4,8})', c_upper)
                if site_m and not site_id:
                    site_id = site_m.group(1).strip()

                # Extract Sheet Title (e.g. ANTENNA LAYOUT - SHEET 1 OF 2)
                if not sheet_title:
                    title_match = re.search(
                        r'(?:ANTENNA\s+LAYOUT[^\n\r]*|CONFIGURATION\s+TABLE[^\n\r]*|ELEVATION[^\n\r]*|EQUIPMENT\s+LAYOUT[^\n\r]*)',
                        c_upper
                    )
                    if title_match:
                        sheet_title = title_match.group(0).strip()

    # 2. Determine Sheet Role dynamically
    # Priority A: If it contains an authoritative schedule matrix -> SCHEDULE
    if has_authoritative_schedule:
        sheet_role = "SCHEDULE"
    else:
        role_text = f"{sheet_title} {raw_tb_text}".upper()
        if any(w in role_text for w in ["CONFIGURATION TABLE", "SCHEDULE", "MATRIX", "EQUIPMENT LIST"]):
            sheet_role = "SCHEDULE"
        elif any(w in role_text for w in ["ELEVATION", "ELEVATIONS", "SECTION"]):
            sheet_role = "ELEVATION"
        elif any(w in role_text for w in ["LAYOUT", "PLAN", "ROOF", "ARRANGEMENT", "SECTOR"]):
            sheet_role = "PLAN_LAYOUT"
        elif any(w in role_text for w in ["SCHEMATIC", "SLD", "SINGLE LINE", "DIAGRAM"]):
            sheet_role = "SCHEMATIC"
        else:
            sheet_role = "PLAN_LAYOUT"

    if not sheet_number:
        sheet_number = f"Sheet {page_num}"

    return SheetMetadata(
        page_num=page_num,
        sheet_number=sheet_number,
        drawing_number=drawing_number,
        sheet_title=sheet_title or sheet_role.replace("_", " ").title(),
        site_id=site_id,
        site_name=site_name,
        sheet_role=sheet_role,
        raw_title_block_text=raw_tb_text.strip()
    )


def classify_drawing_sheets(elements_by_page: Dict[int, List[Dict[str, Any]]]) -> Dict[int, SheetMetadata]:
    """
    Classifies all pages in a drawing package, returning a mapping of page_num -> SheetMetadata.
    """
    classified = {}
    for page_num, elements in elements_by_page.items():
        classified[page_num] = extract_sheet_metadata_from_elements(elements, page_num)
    return classified
