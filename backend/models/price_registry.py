from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class PriceRegistryItem(BaseModel):
    """
    Persistent canonical Telecom Pricing Item in the internal registry.
    Decouples business rules from carrier-specific Excel wording changes.
    """
    internal_id: str = Field(..., description="Unique immutable ID e.g. TEL_ANT_PANEL_PRIMARY_4G")
    standard_name: str = Field(..., description="Canonical human-readable item name")
    category: str = Field(..., description="ANTENNA | RRU | TMA_FILTER | GPS | SHELTER | MOUNT | TESTING")
    default_unit: str = Field(default="each", description="each | m | per unit | per plinth")
    fingerprint: str = Field(default="", description="Semantic keyword fingerprint for auto-matching")
    description: Optional[str] = Field(default=None, description="Scope of work description")


class CarrierItemLink(BaseModel):
    """Links a carrier's raw uploaded Excel line item to an internal registry item."""
    price_list_id: int
    internal_id: str
    carrier_code: str = Field(default="", description="Carrier SOR code e.g. W7520 or blank")
    carrier_name: str = Field(..., description="Carrier raw Excel description name")
    category: str = Field(default="", description="Carrier category name")
    rate: float = Field(default=0.0, description="Unit rate from Excel")
    unit: str = Field(default="each", description="Unit from Excel")
    is_active: bool = Field(default=True, description="Whether active in current price list")


class PriceDiffItem(BaseModel):
    """Diff status for a single price item when a new carrier price book is uploaded."""
    status: str = Field(..., description="UNCHANGED | MODIFIED | REMOVED | NEW")
    internal_id: Optional[str] = None
    carrier_code: str = ""
    carrier_name: str = ""
    old_rate: Optional[float] = None
    new_rate: Optional[float] = None
    message: str = ""


class PriceListDiffReport(BaseModel):
    """Complete change-management audit report for a carrier price book revision."""
    price_list_id: int
    carrier_name: str
    timestamp: str
    total_items: int
    unchanged_count: int
    modified_count: int
    removed_count: int
    new_count: int
    items: List[PriceDiffItem] = []
    orphaned_rules: List[str] = []
