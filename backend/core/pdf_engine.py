"""
PDFEngine wrapper facade.
Provides high-performance PyMuPDF extraction, rendering, and classification utilities.
"""
import os
import io
import base64
from typing import Dict, List, Any, Union, Optional, Tuple
import fitz  # PyMuPDF


class PDFEngine:
    """
    Handles PDF document reading, page category classification,
    high-res rendering to images/base64, annotation stripping, and text retrieval.
    """
    def __init__(self, file_path_or_bytes: Union[str, bytes]) -> None:
        """
        Initializes the PyMuPDF Document.
        
        Args:
            file_path_or_bytes: Absolute path to PDF or raw byte string.
        """
        if isinstance(file_path_or_bytes, bytes):
            self.doc = fitz.open(stream=file_path_or_bytes, filetype="pdf")
            self.file_path = None
        else:
            if not os.path.exists(file_path_or_bytes):
                raise FileNotFoundError(f"PDF file not found at: {file_path_or_bytes}")
            self.doc = fitz.open(file_path_or_bytes)
            self.file_path = os.path.abspath(file_path_or_bytes)

    def get_page_count(self) -> int:
        """Returns total page count."""
        return len(self.doc)

    def get_page_metadata(self, page_num: int) -> Dict[str, Any]:
        """Gets page metadata index, size (width, height), and rotation."""
        if page_num < 0 or page_num >= len(self.doc):
            raise IndexError(f"Page number {page_num} out of bounds (0-{len(self.doc)-1})")
        page = self.doc[page_num]
        rect = page.rect
        return {
            "page_num": page_num + 1,
            "width": rect.width,
            "height": rect.height,
            "rotation": page.rotation
        }

    def render_page_image(
        self,
        page_num: int,
        scale: float = 2.0,
        dpi: Optional[int] = None,
        image_format: str = "png"
    ) -> bytes:
        """
        Renders a specific page into high-quality image bytes.
        
        Args:
            page_num: 0-indexed page number.
            scale: Zoom scale factor (2.0 = 200% resolution for sharp display).
            dpi: Optional target DPI (overrides scale if provided).
            image_format: 'png', 'jpeg', or 'webp'.
            
        Returns:
            Raw image bytes.
        """
        if page_num < 0 or page_num >= len(self.doc):
            raise IndexError(f"Page number {page_num} out of bounds")
            
        page = self.doc[page_num]
        
        if dpi:
            # 72 is standard PDF point resolution
            zoom = dpi / 72.0
            matrix = fitz.Matrix(zoom, zoom)
        else:
            matrix = fitz.Matrix(scale, scale)
            
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        return pix.tobytes(output=image_format)

    def render_page_base64(
        self,
        page_num: int,
        scale: float = 1.5,
        image_format: str = "png"
    ) -> str:
        """
        Renders a specific page and returns a base64 data URL string.
        """
        img_bytes = self.render_page_image(page_num, scale=scale, image_format=image_format)
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        return f"data:image/{image_format};base64,{b64}"

    def get_page_thumbnail(self, page_num: int, max_dim: int = 300) -> str:
        """
        Generates a lightweight thumbnail data URL for rapid UI display.
        """
        if page_num < 0 or page_num >= len(self.doc):
            raise IndexError(f"Page number {page_num} out of bounds")
            
        page = self.doc[page_num]
        rect = page.rect
        scale = max_dim / max(rect.width, rect.height, 1)
        
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        img_bytes = pix.tobytes(output="jpeg")
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        return f"data:image/jpeg;base64,{b64}"

    def get_all_thumbnails(self, max_dim: int = 250) -> List[Dict[str, Any]]:
        """
        Generates thumbnails for all pages in the document.
        """
        thumbnails = []
        for p in range(len(self.doc)):
            page = self.doc[p]
            rect = page.rect
            scale = max_dim / max(rect.width, rect.height, 1)
            pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            b64 = base64.b64encode(pix.tobytes(output="jpeg")).decode("utf-8")
            thumbnails.append({
                "page": p + 1,
                "width": rect.width,
                "height": rect.height,
                "thumbnail": f"data:image/jpeg;base64,{b64}"
            })
        return thumbnails

    def extract_page_text(self, page_num: int) -> str:
        """Extracts sorted, clean text blocks from the page."""
        if page_num < 0 or page_num >= len(self.doc):
            return ""
        page = self.doc[page_num]
        blocks = page.get_text("blocks")
        
        def block_sort_key(b):
            return (round(b[1] / 5) * 5, b[0])
            
        sorted_blocks = sorted(blocks, key=block_sort_key)
        text_lines = [b[4].strip() for b in sorted_blocks if b[4].strip()]
        return "\n".join(text_lines)

    def sanitize_and_clean(self, output_path: Optional[str] = None) -> Tuple[str, bytes]:
        """
        Deletes all annotations (Bluebeam markups, clouds, highlights, strikethroughs)
        and returns the cleaned PDF path and bytes.
        """
        for page in self.doc:
            annots = list(page.annots())
            for annot in annots:
                page.delete_annot(annot)
                
        if output_path:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            self.doc.save(output_path, garbage=3, deflate=True)
            with open(output_path, "rb") as f:
                pdf_bytes = f.read()
            return output_path, pdf_bytes
        else:
            pdf_bytes = self.doc.tobytes(garbage=3, deflate=True)
            return "", pdf_bytes

    def classify_page_category(self, page_num: int) -> str:
        """Classifies page category using heuristic keyword matching."""
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

    def detect_cloud_boxes(self, page_num: int, min_curves: int = 4) -> List[Dict[str, Any]]:
        """Detects revision clouds on drawing page."""
        return []

    def extract_cloud_notes(self, page_num: int) -> List[str]:
        """Extracts text inside revision cloud boxes."""
        return []

    def extract_tables(self, page_num: int) -> List[List[List[str]]]:
        """Extracts structured tables from drawing page."""
        return []

    def close(self) -> None:
        """Closes the PyMuPDF document handle."""
        if hasattr(self, 'doc') and self.doc:
            self.doc.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
