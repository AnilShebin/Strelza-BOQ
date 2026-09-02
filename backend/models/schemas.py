"""
Pydantic Data Models and Schemas for API Requests & Responses.
"""
from typing import Dict, List, Any, Optional, Union
from pydantic import BaseModel, Field


# PDF Schemas
class PDFSanitizeRequest(BaseModel):
    path: Optional[str] = None


class PDFSanitizeResponse(BaseModel):
    name: str
    path: str
    base64: str
    pages: str
    width: Optional[float] = None
    height: Optional[float] = None


class PDFRenderPageRequest(BaseModel):
    path: Optional[str] = None
    base64: Optional[str] = None
    page: int = Field(default=1, ge=1)
    scale: float = Field(default=2.0, ge=0.2, le=5.0)
    image_format: str = Field(default="png")


class PDFExtractDrawingDataRequest(BaseModel):
    path: Optional[str] = None
    base64: Optional[str] = None
    pages: Optional[List[int]] = None


class PDFReextractPageRequest(BaseModel):
    path: Optional[str] = None
    base64: Optional[str] = None
    page: int = Field(default=1, ge=1)


# Project Schemas
class ProjectSaveRequest(BaseModel):
    filename: Optional[str] = "project.slz"
    project_data: Dict[str, Any]


class ProjectLoadPathRequest(BaseModel):
    path: str


# BOQ Schemas
class BOQCellUpdateRequest(BaseModel):
    row_idx: int
    column_key: str
    value: Any
    price_list_id: Optional[int] = 1


class BOQDeduplicateRequest(BaseModel):
    raw_items: List[Dict[str, Any]]
    price_list_id: Optional[int] = 1
