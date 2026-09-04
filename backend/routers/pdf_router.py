"""
PDF and Drawing Rendering API Router with Proven Fast AI Document Extractor.
Provides endpoints for uploading PDFs, rendering pages, generating thumbnails,
and extracting structured schedule tables via Gemini Vision + PyMuPDF.
"""
import os
import shutil
import base64
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, File, UploadFile, HTTPException, Query, Response

from core.config import UPLOADS_DIR
from core.pdf_engine import PDFEngine
from core.document_extractor import extract_document_elements

router = APIRouter(prefix="/api/pdf", tags=["PDF Engine & Rendering"])


class ExtractRequest(BaseModel):
    path: Optional[str] = None
    name: Optional[str] = None
    base64: Optional[str] = None
    pages: Optional[List[int]] = None


@router.post("/upload", response_model=Dict[str, Any])
async def upload_pdf(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Uploads a drawing PDF via multipart/form-data, strips markups/annotations,
    saves it to uploads, generates thumbnails, and returns metadata with base64.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF.")

    temp_path = str(UPLOADS_DIR / f"temp_{file.filename}")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        engine = PDFEngine(temp_path)
        page_count = engine.get_page_count()

        # Sanitize and write clean copy
        clean_filename = f"{os.path.splitext(file.filename)[0]}_cleaned.pdf"
        clean_path = str(UPLOADS_DIR / clean_filename)
        _, clean_bytes = engine.sanitize_and_clean(output_path=clean_path)
        engine.close()

        # Re-open cleaned for metadata & thumbnails
        clean_engine = PDFEngine(clean_bytes)
        thumbnails = clean_engine.get_all_thumbnails(max_dim=250)
        clean_engine.close()

        base64_str = base64.b64encode(clean_bytes).decode("utf-8")

        return {
            "name": clean_filename,
            "path": clean_path,
            "base64": base64_str,
            "pages": str(page_count),
            "thumbnails": thumbnails,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@router.post("/extract")
async def extract_pdf_tables(req: ExtractRequest) -> Dict[str, Any]:
    """
    Extracts structured CAD schedule tables, equipment lists, and bounding boxes
    using the proven high-speed Gemini Vision + PyMuPDF engine.
    """
    pdf_path = req.path

    # If base64 is provided directly, save it to uploads directory
    if req.base64:
        try:
            filename = req.name or "uploaded_drawing.pdf"
            if not filename.endswith(".pdf"):
                filename += ".pdf"
            target_path = UPLOADS_DIR / filename
            b64_data = req.base64
            if "," in b64_data:
                b64_data = b64_data.split(",")[1]
            with open(target_path, "wb") as f:
                f.write(base64.b64decode(b64_data))
            pdf_path = str(target_path)
        except Exception as e:
            print(f"Error saving base64 to disk: {e}")

    # If path not yet set, attempt finding by name in uploads
    if (not pdf_path or not os.path.exists(pdf_path)) and req.name:
        candidate = UPLOADS_DIR / req.name
        if candidate.exists():
            pdf_path = str(candidate)
        else:
            matches = list(UPLOADS_DIR.glob(f"*{req.name}*"))
            if matches:
                pdf_path = str(matches[0])

    if not pdf_path or not os.path.exists(pdf_path):
        raise HTTPException(
            status_code=404,
            detail=f"PDF document '{req.name or req.path}' not found on server."
        )

    clean_stem = os.path.basename(pdf_path).replace("_cleaned", "").replace(".pdf", "").strip().lower()
    doc_cache = UPLOADS_DIR / f"{clean_stem}_extracted.json"

    # Fast cache retrieval if full document was already extracted
    if not req.pages and doc_cache.exists():
        try:
            import json
            with open(doc_cache, "r", encoding="utf-8") as f:
                cached_data = json.load(f)
            cached_elements = cached_data.get("elements", [])
            if cached_elements:
                print(f"[PDF Router] Serving {len(cached_elements)} cached elements for {clean_stem}")
                return {
                    "success": True,
                    "filename": os.path.basename(pdf_path),
                    "elements": cached_elements,
                    "totalElements": len(cached_elements),
                    "raw_items": cached_data.get("raw_items", [])
                }
        except Exception as e:
            print(f"[PDF Router] Cache read error: {e}")

    try:
        result = extract_document_elements(pdf_path, selected_pages=req.pages)
        elements = result.get("elements", [])
        raw_items = result.get("raw_items", [])

        # If specific pages were re-extracted, merge into existing cache
        if req.pages and doc_cache.exists():
            try:
                import json
                with open(doc_cache, "r", encoding="utf-8") as f:
                    existing = json.load(f)
                other_elements = [el for el in existing.get("elements", []) if el.get("page") not in req.pages]
                elements = other_elements + elements
            except Exception:
                pass

        # Save to per-document cache file
        try:
            import json
            cache_payload = {
                "pdf_path": pdf_path,
                "filename": os.path.basename(pdf_path),
                "elements": elements,
                "raw_items": raw_items
            }
            with open(doc_cache, "w", encoding="utf-8") as f:
                json.dump(cache_payload, f, indent=2)

            # Also update global extracted_tables.json
            global_cache = os.path.join(os.path.dirname(os.path.dirname(__file__)), "extracted_tables.json")
            with open(global_cache, "w", encoding="utf-8") as f:
                json.dump(cache_payload, f, indent=2)
        except Exception as e:
            print(f"[PDF Router] Error caching extraction to disk: {e}")

        return {
            "success": True,
            "filename": os.path.basename(pdf_path),
            "elements": elements,
            "totalElements": len(elements),
            "raw_items": raw_items
        }
    except Exception as e:
        print(f"[PDF Router] Extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.get("/render-page")
async def render_pdf_page(
    path: str = Query(..., description="Path to PDF file"),
    page: int = Query(1, ge=1, description="1-indexed page number"),
    scale: float = Query(2.0, ge=0.5, le=5.0, description="Resolution scale factor"),
    format: str = Query("png", description="Image format: png or jpeg")
):
    """
    Renders a specific PDF page to high-quality image bytes for instant browser display.
    """
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"PDF file not found at: {path}")

    try:
        with PDFEngine(path) as engine:
            if page > engine.get_page_count():
                raise HTTPException(status_code=400, detail="Page number exceeds total pages.")
            img_bytes = engine.render_page_image(page_num=page - 1, scale=scale, image_format=format)
            media_type = f"image/{format}"
            return Response(content=img_bytes, media_type=media_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render page: {str(e)}")


@router.get("/thumbnails")
async def get_pdf_thumbnails(path: str = Query(..., description="Path to PDF file")) -> Dict[str, Any]:
    """
    Generates preview thumbnails for all pages of the given PDF.
    """
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"PDF file not found at: {path}")

    try:
        with PDFEngine(path) as engine:
            thumbnails = engine.get_all_thumbnails(max_dim=250)
            return {"thumbnails": thumbnails, "total_pages": engine.get_page_count()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate thumbnails: {str(e)}")
