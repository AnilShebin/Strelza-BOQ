from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class FactProvenance(BaseModel):
    page: Optional[int] = None
    source_sheet: str = "Drawing Sheet"
    source_table: Optional[str] = None
    source_row: Optional[int] = None
    raw_text: str = ""

class AIStatementUnderstanding(BaseModel):
    original_text: str
    entity_name: str
    attributes: Dict[str, Any] = Field(default_factory=dict)
    action: str  # e.g., INSTALL, REMOVE, RETAIN, MODIFY
    quantity: float = 1.0
    unit: str = "each"
    provenance: FactProvenance = Field(default_factory=FactProvenance)

class MappingRequirement(BaseModel):
    requirement_id: str
    category_constraint: str
    action_constraint: str
    attribute_constraints: Dict[str, Any] = Field(default_factory=dict)
    quantity: float = 1.0
    evidence_fact_id: str
    priority_level: int = 100

class BusinessRule(BaseModel):
    rule_id: str
    rule_name: str
    rule_text: str
    priority: int = 100
    enabled: bool = True
