"""
PDF and Drawing Rendering API Router.
Provides endpoints for uploading PDFs, high-resolution page rendering to images/base64,
and generating thumbnail previews.
"""
import os
import shutil
import base64
from typing import Dict, Any, Optional
from fastapi import APIRouter, File, UploadFile, HTTPException, Query, Response

from core.config import UPLOADS_DIR
from core.pdf_engine import PDFEngine

router = APIRouter(prefix="/api/pdf", tags=["PDF Engine & Rendering"])


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
