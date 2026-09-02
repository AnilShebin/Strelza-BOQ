"""
Price List Differ & Change-Management Engine.

Audits and diffs carrier Excel price book revisions against the internal registry.
Prevents contract wording changes from breaking active estimating rules.
"""

from typing import List, Dict, Any, Tuple
from datetime import datetime
from models.price_registry import PriceDiffItem, PriceListDiffReport


def calculate_price_list_diff(
    old_items: List[Dict[str, Any]],
    new_items: List[Dict[str, Any]],
    active_rules: List[Dict[str, Any]],
    price_list_id: int = 1,
    carrier_name: str = "Carrier Price Book"
) -> PriceListDiffReport:
    """
    Compares two revisions of a carrier's price list and produces an audit diff report.
    Identifies Unchanged, Modified, Removed, and New items, plus any Orphaned Rules.
    """
    diff_items: List[PriceDiffItem] = []
    unchanged_count = 0
    modified_count = 0
    removed_count = 0
    new_count = 0

    # Index old items by (code, normalized_name)
    old_by_code: Dict[str, Dict[str, Any]] = {}
    old_by_name: Dict[str, Dict[str, Any]] = {}
    for item in old_items:
        code = str(item.get("code") or "").strip().upper()
        name = str(item.get("name") or "").strip().upper()
        if code:
            old_by_code[code] = item
        if name:
            old_by_name[name] = item

    # Index new items
    new_by_code: Dict[str, Dict[str, Any]] = {}
    new_by_name: Dict[str, Dict[str, Any]] = {}
    for item in new_items:
        code = str(item.get("code") or "").strip().upper()
        name = str(item.get("name") or "").strip().upper()
        if code:
            new_by_code[code] = item
        if name:
            new_by_name[name] = item

    # 1. Process all new items against old items
    matched_old_ids = set()
    for n_item in new_items:
        code = str(n_item.get("code") or "").strip().upper()
        name = str(n_item.get("name") or "").strip().upper()
        new_rate = float(n_item.get("rate") or 0.0)

        old_match = None
        if code and code in old_by_code:
            old_match = old_by_code[code]
        elif name in old_by_name:
            old_match = old_by_name[name]

        if old_match:
            old_id = old_match.get("id") or old_match.get("row_idx")
            matched_old_ids.add(old_id)
            old_rate = float(old_match.get("rate") or 0.0)
            old_name = str(old_match.get("name") or "").strip()

            if abs(old_rate - new_rate) < 0.001 and old_name.upper() == name:
                unchanged_count += 1
                diff_items.append(PriceDiffItem(
                    status="UNCHANGED",
                    carrier_code=code,
                    carrier_name=n_item.get("name", ""),
                    old_rate=old_rate,
                    new_rate=new_rate,
                    message="Item active with identical rate and title"
                ))
            else:
                modified_count += 1
                rate_change_msg = f"Rate updated: ${old_rate:.2f} -> ${new_rate:.2f}" if abs(old_rate - new_rate) >= 0.001 else "Description modified"
                diff_items.append(PriceDiffItem(
                    status="MODIFIED",
                    carrier_code=code,
                    carrier_name=n_item.get("name", ""),
                    old_rate=old_rate,
                    new_rate=new_rate,
                    message=rate_change_msg
                ))
        else:
            new_count += 1
            diff_items.append(PriceDiffItem(
                status="NEW",
                carrier_code=code,
                carrier_name=n_item.get("name", ""),
                new_rate=new_rate,
                message="Brand new price book item added"
            ))

    # 2. Check for removed old items
    for o_item in old_items:
        old_id = o_item.get("id") or o_item.get("row_idx")
        if old_id not in matched_old_ids:
            removed_count += 1
            code = str(o_item.get("code") or "").strip().upper()
            diff_items.append(PriceDiffItem(
                status="REMOVED",
                carrier_code=code,
                carrier_name=o_item.get("name", ""),
                old_rate=float(o_item.get("rate") or 0.0),
                message="Item discontinued or removed in new revision"
            ))

    # 3. Detect Orphaned Rules
    orphaned_rules = []
    active_carrier_codes = set(new_by_code.keys())
    active_carrier_names = set(new_by_name.keys())

    for rule in active_rules:
        r_name = rule.get("rule_name", "Unnamed Rule")
        actions = rule.get("actions") or rule.get("actions_json")
        target_code = ""
        target_name = ""

        if isinstance(actions, list) and actions:
            params = actions[0].get("params", {})
            target_code = str(params.get("sor_code") or "").strip().upper()
            target_name = str(params.get("target_name") or "").strip().upper()
        elif isinstance(actions, dict):
            params = actions.get("params", {})
            target_code = str(params.get("sor_code") or "").strip().upper()
            target_name = str(params.get("target_name") or "").strip().upper()
        else:
            target_code = str(rule.get("target_sor_code") or "").strip().upper()
            target_name = str(rule.get("target_sor_name") or "").strip().upper()

        is_orphan = False
        if target_code and target_code != "UNQUOTED":
            if target_code not in active_carrier_codes:
                is_orphan = True
        elif target_name:
            if not any(target_name in aname or aname in target_name for aname in active_carrier_names):
                is_orphan = True

        if is_orphan:
            orphaned_rules.append(r_name)

    return PriceListDiffReport(
        price_list_id=price_list_id,
        carrier_name=carrier_name,
        timestamp=datetime.now().isoformat(),
        total_items=len(new_items),
        unchanged_count=unchanged_count,
        modified_count=modified_count,
        removed_count=removed_count,
        new_count=new_count,
        items=diff_items,
        orphaned_rules=orphaned_rules
    )
