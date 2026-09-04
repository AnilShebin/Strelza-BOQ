"""
Equipment Catalog Service.
Dedicated storage and management for equipment details (Sl.No, Product Name, and Product Category).
Completely decoupled from all mapping, extraction, or resolution services.
"""

from typing import Dict, Any, List, Optional
from services.db import get_db_connection, init_db

# Ensure table exists on load
init_db()


def get_all_equipment(
    search: Optional[str] = None,
    category: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Retrieves all equipment items from the database with sequential Sl.No,
    Product Name, and Product Category.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT id, product_name, product_category, created_at FROM equipment_catalog WHERE 1=1"
    params: List[Any] = []
    
    if category and category.strip().upper() != "ALL":
        query += " AND product_category = ?"
        params.append(category.strip())
        
    if search and search.strip():
        term = f"%{search.strip()}%"
        query += " AND (product_name LIKE ? OR product_category LIKE ?)"
        params.extend([term, term])
        
    query += " ORDER BY id ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for idx, row in enumerate(rows, start=1):
        results.append({
            "id": row["id"],
            "sl_no": idx,
            "product_name": row["product_name"],
            "product_category": row["product_category"],
            "created_at": row["created_at"]
        })
    return results


def get_equipment_by_id(item_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves a single equipment record by its database ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, product_name, product_category, created_at FROM equipment_catalog WHERE id = ?",
        (item_id,)
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row["id"],
        "product_name": row["product_name"],
        "product_category": row["product_category"],
        "created_at": row["created_at"]
    }


def create_equipment(product_name: str, product_category: str) -> int:
    """Inserts a new equipment record into the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO equipment_catalog (product_name, product_category)
        VALUES (?, ?)
    """, (product_name.strip(), product_category.strip()))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id


def update_equipment(item_id: int, product_name: str, product_category: str) -> bool:
    """Updates an existing equipment record in the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE equipment_catalog
        SET product_name = ?, product_category = ?
        WHERE id = ?
    """, (product_name.strip(), product_category.strip(), item_id))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


def delete_equipment(item_id: int) -> bool:
    """Deletes an equipment record from the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM equipment_catalog WHERE id = ?", (item_id,))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


def get_equipment_categories() -> List[str]:
    """Retrieves distinct non-empty equipment categories from the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT DISTINCT product_category FROM equipment_catalog WHERE product_category != '' ORDER BY product_category ASC"
    )
    rows = cursor.fetchall()
    conn.close()
    return [r["product_category"] for r in rows if r["product_category"]]
