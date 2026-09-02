"""
Project File Management API Router.
Handles saving and loading compressed Strelza project files (.slz) in pure Python.
"""
from typing import Dict, Any
from fastapi import APIRouter, File, UploadFile, HTTPException, Response
from fastapi.responses import FileResponse
from services.project_service import ProjectService
from models.schemas import ProjectSaveRequest, ProjectLoadPathRequest

router = APIRouter(prefix="/api/project", tags=["Project Management"])


@router.post("/save")
async def save_project(payload: ProjectSaveRequest) -> Dict[str, Any]:
    """
    Compresses project state to .slz and saves to disk, returning path and size.
    """
    try:
        file_path, size = ProjectService.save_project_file(
            filename=payload.filename or "project.slz",
            project_data=payload.project_data
        )
        return {
            "status": "saved",
            "path": file_path,
            "size_bytes": size,
            "filename": payload.filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save project: {str(e)}")


@router.post("/download")
async def download_project(payload: ProjectSaveRequest):
    """
    Compresses project and streams it as a downloadable .slz file.
    """
    try:
        compressed_bytes = ProjectService.compress_project(payload.project_data)
        filename = payload.filename or "project.slz"
        if not filename.endswith(".slz"):
            filename = f"{filename}.slz"

        return Response(
            content=compressed_bytes,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download project: {str(e)}")


@router.post("/load-file")
async def load_project_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Accepts an uploaded .slz file, decompresses it, and returns the full project JSON.
    """
    try:
        contents = await file.read()
        project_data = ProjectService.decompress_project(contents)
        return {
            "status": "loaded",
            "filename": file.filename,
            "project_data": project_data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load project: {str(e)}")


@router.post("/load-path")
async def load_project_from_path(payload: ProjectLoadPathRequest) -> Dict[str, Any]:
    """
    Loads project from a local file path.
    """
    try:
        project_data = ProjectService.load_project_file(payload.path)
        return {
            "status": "loaded",
            "path": payload.path,
            "project_data": project_data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load project: {str(e)}")
