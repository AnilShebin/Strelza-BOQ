"""
PDFEngine wrapper facade.
Provides PyMuPDF extraction utilities.
"""
import os
from typing import Dict, List, Any, Union
import fitz  # PyMuPDF

class PDFEngine:
    """
    Handles PDF document reading, page category classification,
    and text retrieval.
    """
    def __init__(self, file_path_or_bytes: Union[str, bytes]) -> None:
        """
        Initializes the fitz Document.
        
        Args:
            file_path_or_bytes: Path to PDF or raw bytes.
        """
        if isinstance(file_path_or_bytes, bytes):
            self.doc = fitz.open(stream=file_path_or_bytes, filetype="pdf")
        else:
            if not os.path.exists(file_path_or_bytes):
                raise FileNotFoundError(f"PDF file not found at: {file_path_or_bytes}")
            self.doc = fitz.open(file_path_or_bytes)
            
        self.file_path_or_bytes = file_path_or_bytes

    def get_page_count(self) -> int:
        """Returns total pages count."""
        return len(self.doc)

    def get_page_metadata(self, page_num: int) -> Dict[str, Any]:
        """Gets page metadata index, size, and rotation."""
        page = self.doc[page_num]
        rect = page.rect
        return {
            "page_num": page_num + 1,
            "width": rect.width,
            "height": rect.height,
            "rotation": page.rotation
        }

    def extract_page_text(self, page_num: int) -> str:
        """Extracts sorted, clean text blocks from the page."""
        page = self.doc[page_num]
        blocks = page.get_text("blocks")
        
        def block_sort_key(b):
            return (round(b[1] / 5) * 5, b[0])
            
        sorted_blocks = sorted(blocks, key=block_sort_key)
        text_lines = [b[4].strip() for b in sorted_blocks if b[4].strip()]
        return "\n".join(text_lines)

    def detect_cloud_boxes(self, page_num: int, min_curves: int = 4) -> List[Dict[str, Any]]:
        """Placeholder for backward compatibility."""
        return []

    def extract_cloud_notes(self, page_num: int) -> List[str]:
        """Placeholder for backward compatibility."""
        return []

    def extract_tables(self, page_num: int) -> List[List[List[str]]]:
        """Placeholder for backward compatibility."""
        return []

    def classify_page_category(self, page_num: int) -> str:
        """Classifies page category using simple keyword matching."""
        text = self.extract_page_text(page_num).upper()
        if "DRAWING INDEX" in text or "SHEET INDEX" in text or "LIST OF DRAWINGS" in text:
            return "drawing_index"
        if "ANTENNA CONFIGURATION" in text or "ANTENNA SCHEDULE" in text or "ANTENNA SYSTEM CONFIGURATION" in text:
            return "antenna_config_table"
        if "EQUIPMENT LAYOUT" in text or "EQUIPMENT PLAN" in text:
            return "equipment_layout"
        if "ELEVATION" in text or "NORTH ELEVATION" in text or "SOUTH ELEVATION" in text:
            return "elevation"
        return "other"

    def close(self) -> None:
        """Closes the PyMuPDF document handle."""
        self.doc.close()
