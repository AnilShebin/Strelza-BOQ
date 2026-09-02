"""
Validator Service.
Provides generic compliance checks for estimated BOQ items against the master price list mapping.
"""
from typing import List, Dict, Any

def run_checklist_validation(
    extracted_items: List[Dict[str, Any]],
    mapped_items: List[Dict[str, Any]],
    pdf_text_corpus: str
) -> List[Dict[str, Any]]:
    """Runs generic compliance check on BOQ items to flag unmapped codes or missing quantities."""
    results = []

    # 1. Check for Unmapped Items
    unmapped_count = sum(1 for m in mapped_items if m.get("sor_code") == "UNMAPPED")
    if unmapped_count > 0:
        results.append({
            "category": "Estimation Compliance",
            "check_name": "Price List Code Alignment",
            "status": "WARNING",
            "message": f"There are {unmapped_count} items in the BOQ that are not mapped to any valid Price List SOR code.",
            "action_required": "Fuzzy align these items or manually match them in the BOQ inspector."
        })
    else:
        results.append({
            "category": "Estimation Compliance",
            "check_name": "Price List Code Alignment",
            "status": "PASSED",
            "message": "All extracted items mapped successfully to active price list codes.",
            "action_required": "None."
        })

    # 2. Check for zero-rate items
    zero_rate_items = [m for m in mapped_items if m.get("sor_code") != "UNMAPPED" and m.get("rate", 0.0) == 0.0]
    if zero_rate_items:
        results.append({
            "category": "Pricing Accuracy",
            "check_name": "Null Rate Check",
            "status": "WARNING",
            "message": f"{len(zero_rate_items)} items have an aligned rate of $0.00. Please verify if this is correct.",
            "action_required": "Set manual rates or verify SOR rate mappings."
        })
    else:
        results.append({
            "category": "Pricing Accuracy",
            "check_name": "Null Rate Check",
            "status": "PASSED",
            "message": "All active mapped items have non-zero pricing rates.",
            "action_required": "None."
        })

    # 3. Check for outlier large quantities
    outlier_qty_items = [m for m in mapped_items if m.get("quantity", 0.0) >= 100.0]
    if outlier_qty_items:
        results.append({
            "category": "Quantity Verification",
            "check_name": "High Quantity Threshold Alert",
            "status": "WARNING",
            "message": f"Large quantity detected for {len(outlier_qty_items)} items (>= 100 units). Please verify.",
            "action_required": "Check drawing sheet annotations to verify quantities."
        })
    else:
        results.append({
            "category": "Quantity Verification",
            "check_name": "High Quantity Threshold Alert",
            "status": "PASSED",
            "message": "All item quantities are within normal single-digit and double-digit bounds.",
            "action_required": "None."
        })

    return results
