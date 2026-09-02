"""
Docling-Powered Document Extraction Service for Strelza BOQ.
Extracts complex CAD schedule tables, equipment lists, and text notes with precise bounding box coordinates.
"""
import os
import json
import logging
from typing import Dict, List, Any, Optional
import pandas as pd
import fitz

logger = logging.getLogger(__name__)

class DoclingExtractionService:
    def __init__(self):
        self._converter = None
        self._cache: Dict[str, Dict[str, Any]] = {}

    def _get_converter(self):
        """Lazy load DocumentConverter to ensure quick backend startup."""
        if self._converter is None:
            try:
                from docling.document_converter import DocumentConverter, PdfFormatOption
                from docling.datamodel.pipeline_options import PdfPipelineOptions
                from docling.datamodel.base_models import InputFormat

                pipeline_options = PdfPipelineOptions()
                pipeline_options.do_table_structure = True
                pipeline_options.do_ocr = True

                self._converter = DocumentConverter(
                    format_options={
                        InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
                    }
                )
                logger.info("Docling DocumentConverter initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize Docling: {e}")
                self._converter = None
        return self._converter

    def extract_document(
        self,
        pdf_path: str,
        selected_pages: Optional[List[int]] = None,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """
        Extracts structured tables and text elements from a PDF document using Docling.
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

        cache_key = f"{pdf_path}:{','.join(map(str, sorted(selected_pages))) if selected_pages else 'all'}"
        if use_cache and cache_key in self._cache:
            logger.info(f"Returning cached extraction for {cache_key}")
            return self._cache[cache_key]

        # Open with PyMuPDF to get page sizes for coordinate normalization
        doc_fitz = fitz.open(pdf_path)
        total_pages = len(doc_fitz)
        pages_to_process = set(selected_pages) if selected_pages else set(range(1, total_pages + 1))

        elements: List[Dict[str, Any]] = []

        try:
            converter = self._get_converter()
            if converter is not None:
                logger.info(f"Converting PDF with Docling: {pdf_path}")
                conv_result = converter.convert(pdf_path)
                docling_doc = conv_result.document

                # 1. Extract Structured Tables
                for t_idx, table in enumerate(docling_doc.tables):
                    try:
                        page_no = 1
                        bbox_coords = None

                        if table.prov and len(table.prov) > 0:
                            prov = table.prov[0]
                            page_no = getattr(prov, "page_no", 1)
                            raw_bbox = getattr(prov, "bbox", None)

                            if raw_bbox:
                                # Check if bbox is Docling BoundingBox
                                l = getattr(raw_bbox, "l", None)
                                t = getattr(raw_bbox, "t", None)
                                r = getattr(raw_bbox, "r", None)
                                b = getattr(raw_bbox, "b", None)
                                coord_origin = getattr(raw_bbox, "coord_origin", "BOTTOMLEFT")

                                if l is not None and t is not None and r is not None and b is not None:
                                    # Normalize coordinates to top-left origin if needed
                                    if 1 <= page_no <= total_pages:
                                        fitz_page = doc_fitz[page_no - 1]
                                        page_height = fitz_page.rect.height

                                        if str(coord_origin).upper() == "BOTTOMLEFT":
                                            # Convert bottom-left to standard top-left
                                            ymin = max(0.0, page_height - t)
                                            ymax = max(0.0, page_height - b)
                                            bbox_coords = [round(l, 2), round(min(ymin, ymax), 2), round(r, 2), round(max(ymin, ymax), 2)]
                                        else:
                                            bbox_coords = [round(l, 2), round(t, 2), round(r, 2), round(b, 2)]

                        if page_no not in pages_to_process:
                            continue

                        df = table.export_to_dataframe()
                        if df is not None and not df.empty:
                            headers = [str(c).strip() for c in df.columns]
                            rows = []
                            for row in df.values:
                                clean_row = [
                                    "" if pd.isna(cell) else str(cell).strip()
                                    for cell in row
                                ]
                                if any(clean_row):
                                    rows.append(clean_row)

                            if rows:
                                elements.append({
                                    "id": f"table-{page_no}-{t_idx}",
                                    "type": "structured",
                                    "page": page_no,
                                    "title": f"Schedule Table ({len(rows)} rows)",
                                    "bbox": bbox_coords,
                                    "confidence": 0.95,
                                    "content": {
                                        "headers": headers,
                                        "rows": rows,
                                    }
                                })
                    except Exception as e:
                        logger.warning(f"Error parsing table {t_idx}: {e}")

                # 2. Extract Key Drawing Notes / Texts
                for text_idx, text_item in enumerate(getattr(docling_doc, "texts", [])):
                    try:
                        text_val = getattr(text_item, "text", "").strip()
                        if not text_val or len(text_val) < 20:
                            continue

                        page_no = 1
                        bbox_coords = None
                        if getattr(text_item, "prov", None) and len(text_item.prov) > 0:
                            prov = text_item.prov[0]
                            page_no = getattr(prov, "page_no", 1)
                            raw_bbox = getattr(prov, "bbox", None)
                            if raw_bbox:
                                l = getattr(raw_bbox, "l", None)
                                t = getattr(raw_bbox, "t", None)
                                r = getattr(raw_bbox, "r", None)
                                b = getattr(raw_bbox, "b", None)
                                if l is not None and t is not None:
                                    bbox_coords = [round(l, 2), round(t, 2), round(r, 2), round(b, 2)]

                        if page_no not in pages_to_process:
                            continue

                        # Add as general notes/unstructured element if it contains schedule keywords
                        keywords = ["note", "specification", "drawing", "revision", "cable", "feeder", "antenna"]
                        if any(kw in text_val.lower() for kw in keywords):
                            elements.append({
                                "id": f"text-{page_no}-{text_idx}",
                                "type": "unstructured",
                                "page": page_no,
                                "title": "Drawing Notes & Specifications",
                                "bbox": bbox_coords,
                                "confidence": 0.90,
                                "content": text_val
                            })
                    except Exception as e:
                        logger.debug(f"Error parsing text item {text_idx}: {e}")

        except Exception as e:
            logger.error(f"Docling extraction encountered an issue: {e}, using vector fallback")

        # 3. Fallback: If any requested page produced 0 elements, extract native vector blocks via PyMuPDF
        for page_no in sorted(pages_to_process):
            page_elements = [el for el in elements if el["page"] == page_no]
            if not page_elements and 1 <= page_no <= total_pages:
                fitz_page = doc_fitz[page_no - 1]
                tables = fitz_page.find_tables()
                if tables and len(tables.tables) > 0:
                    for t_idx, tab in enumerate(tables):
                        tab_df = tab.extract()
                        if tab_df and len(tab_df) > 1:
                            headers = [str(c or "").strip() for c in tab_df[0]]
                            rows = [[str(c or "").strip() for c in r] for r in tab_df[1:]]
                            bbox = [round(tab.bbox[0], 2), round(tab.bbox[1], 2), round(tab.bbox[2], 2), round(tab.bbox[3], 2)]
                            elements.append({
                                "id": f"vec-table-{page_no}-{t_idx}",
                                "type": "structured",
                                "page": page_no,
                                "title": f"Schedule Table ({len(rows)} rows)",
                                "bbox": bbox,
                                "confidence": 0.88,
                                "content": {
                                    "headers": headers,
                                    "rows": rows
                                }
                            })

        doc_fitz.close()

        response = {
            "success": True,
            "filename": os.path.basename(pdf_path),
            "totalPages": total_pages,
            "processedPages": list(pages_to_process),
            "elements": elements,
            "totalElements": len(elements)
        }

        self._cache[cache_key] = response
        return response

extraction_service = DoclingExtractionService()
