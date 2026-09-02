"""
PDFReader module.
Uses PyMuPDF (fitz) to load a vector PDF drawing, fetch page metadata,
and extract text blocks preserving reading order.
"""
import os
from typing import Dict, Any, Union
import fitz  # PyMuPDF

class PDFReader:
    """
    Handles standard PDF reading operations, metadata fetching,
    and text block extraction.
    """
    def __init__(self, file_path_or_bytes: Union[str, bytes]) -> None:
        """
        Initializes the PyMuPDF Document.
        
        Args:
            file_path_or_bytes: File path string or raw PDF bytes.
        """
        if isinstance(file_path_or_bytes, bytes):
            self.doc = fitz.open(stream=file_path_or_bytes, filetype="pdf")
        else:
            if not os.path.exists(file_path_or_bytes):
                raise FileNotFoundError(f"PDF not found at: {file_path_or_bytes}")
            self.doc = fitz.open(file_path_or_bytes)
        self.file_path_or_bytes = file_path_or_bytes

    def get_page_count(self) -> int:
        """Returns the total number of pages in the PDF document."""
        return len(self.doc)

    def get_page_metadata(self, page_num: int) -> Dict[str, Any]:
        """
        Fetches metadata for a specific page including dimensions and rotation.
        
        Args:
            page_num: 0-indexed page number.
        """
        page = self.doc[page_num]
        rect = page.rect
        return {
            "page_num": page_num + 1,
            "width": rect.width,
            "height": rect.height,
            "rotation": page.rotation
        }

    def extract_page_text(self, page_num: int) -> str:
        """
        Extracts sorted text blocks from a page to preserve layout and reading order.
        
        Args:
            page_num: 0-indexed page number.
        """
        page = self.doc[page_num]
        blocks = page.get_text("blocks")
        
        # Sort blocks top-to-bottom, then left-to-right with tolerance grouping
        def block_sort_key(b):
            return (round(b[1] / 5) * 5, b[0])
            
        sorted_blocks = sorted(blocks, key=block_sort_key)
        text_lines = [b[4].strip() for b in sorted_blocks if b[4].strip()]
        return "\n".join(text_lines)

    def close(self) -> None:
        """Closes the PyMuPDF document handle."""
        self.doc.close()
