from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TakeoffProvenance(BaseModel):
    """Drawing location and structural authority metadata."""
    page: Optional[int] = Field(default=None, description="1-based PDF page number")
    source_sheet: str = Field(default="Drawing Sheet", description="Sheet name or identifier")
    source_table: Optional[str] = Field(default=None, description="Source table title or type")
    source_type: str = Field(default="MASTER_TABLE", description="MASTER_TABLE | DETAIL_CALLOUT | GENERAL_NOTE")
    source_row: Optional[int] = Field(default=None, description="Source table row index")
    raw_text: str = Field(default="", description="Original drawing text")


class TelecomAttributes(BaseModel):
    """Normalized physical and RF engineering attributes."""
    location: str = Field(default="GENERAL", description="TOWER | SHELTER | ROOFTOP | GROUND | GENERAL")
    technology: str = Field(default="EQUIPMENT", description="4G_PASSIVE_PANEL | 5G_ACTIVE_AAU | REMOTE_RADIO | TMA_FILTER | GPS | BASEBAND | MOUNT")
    height_mm: float = Field(default=0.0, description="Height/length in millimeters")
    sector: str = Field(default="-", description="Physical RF sector (e.g. S1, S2, S3, or '-')")
    sector_index: int = Field(default=1, description="1 = Primary item on sector, 2+ = Extra-Over")
    is_active: bool = Field(default=False, description="True for active beamforming 5G AAU / Massive MIMO")
    ports: Optional[int] = Field(default=None, description="Number of antenna RF ports e.g. 4, 8, 12, 16")
    ref_drawing: str = Field(default="", description="Reference drawing string from table e.g. SHEET E5")
    has_quantity_mismatch: bool = Field(default=False, description="True if table count disagrees with drawing note callout")
    table_quantity: float = Field(default=0.0, description="Authoritative quantity from table")
    note_quantity: float = Field(default=0.0, description="Quantity stated in drawing note")
    mismatch_reason: str = Field(default="", description="Description of discrepancy if found")


class TelecomTakeoffEntity(BaseModel):
    """
    Canonical Telecom Takeoff Entity representing an extracted drawing fact
    independent of any specific vendor model name or commercial pricing code.
    """
    entity_id: str = Field(..., description="Unique takeoff item ID e.g. ent_001")
    category: str = Field(
        default="EQUIPMENT",
        description="ANTENNA | RRU | TMA_FILTER | GPS | SHELTER_RACK | BASEBAND | MOUNT | TESTING | PRELIMINARY | EQUIPMENT"
    )
    semantic_class: str = Field(default="EQUIPMENT", description="E.g., STRUCTURE, FEEDER, FOUNDATION, LABOUR, EQUIPMENT")
    action: str = Field(
        default="INSTALL",
        description="INSTALL | REMOVE | REPLACE | RELOCATE | EXISTING | SPARE"
    )
    model: str = Field(default="", description="Equipment model or drawing text description")
    ant_id: Optional[str] = Field(default=None, description="Antenna / Equipment ID e.g. A1, A4, A1 (OLD)")
    quantity: float = Field(default=1.0, description="Quantity extracted")
    unit: str = Field(default="each", description="Measurement unit (each, m, per unit)")
    attributes: TelecomAttributes = Field(default_factory=TelecomAttributes)
    attributes_dict: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary attributes dictionary for generic objects")
    provenance: TakeoffProvenance = Field(default_factory=TakeoffProvenance)
    extraction_confidence: str = Field(default="HIGH", description="HIGH | MEDIUM | LOW")
    review_required: bool = Field(default=False, description="Flag for low-confidence extraction requiring manual review")

