from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class EngineeringItem(BaseModel):
    """
    Canonical Engineering Object representing an extracted drawing fact
    independent of any specific vendor model name or commercial pricing code.
    """
    item_id: str
    entity_class: str = Field(
        default="EQUIPMENT",
        description="Engineering role/type: PANEL_ANTENNA, AAU, RRU, TMA_FILTER, GPS, BASEBAND, CIVIL_MOUNT, EQUIPMENT"
    )
    action: str = Field(
        default="INSTALL",
        description="Engineering action: INSTALL, REMOVE, REPLACE, RELOCATE, EXISTING, SPARE"
    )
    model: str = Field(
        default="",
        description="Equipment model or drawing text description"
    )
    ant_id: Optional[str] = Field(
        default=None,
        description="Antenna designation number e.g. A1, A4, A15, A1 (OLD)"
    )
    sector: Optional[str] = Field(
        default="-",
        description="Physical RF sector e.g. S1, S2, S3, or '-'"
    )
    location: str = Field(
        default="GENERAL",
        description="Physical location: TOWER, SHELTER, ROOFTOP, GENERAL"
    )
    height_mm: float = Field(
        default=0.0,
        description="Physical antenna height in millimeters"
    )
    is_active: bool = Field(
        default=False,
        description="True if active antenna unit (Massive MIMO / AAU), False if passive panel"
    )
    quantity: float = Field(
        default=1.0,
        description="Quantity extracted from table or note"
    )
    source_sheet: str = Field(
        default="Drawing Sheet",
        description="Drawing sheet name or page reference"
    )
    page: Optional[int] = Field(
        default=None,
        description="1-based PDF page number"
    )
    source_table: Optional[str] = Field(
        default=None,
        description="Source table title or type e.g. ANTENNA CONFIGURATION TABLE"
    )
    source_row: Optional[int] = Field(
        default=None,
        description="Source table row index"
    )
    raw_text: str = Field(
        default="",
        description="Raw unparsed text string from drawing"
    )
    is_first_in_sector: bool = Field(
        default=False,
        description="Sector awareness flag: True if first primary antenna of its type in sector"
    )
    is_verified_in_layout: bool = Field(
        default=True,
        description="Layout cross-verification status"
    )
    has_quantity_mismatch: bool = Field(
        default=False,
        description="True if layout callout stated count differs from table row count"
    )
