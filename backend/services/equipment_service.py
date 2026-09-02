"""
Equipment Master Catalog Service.
Manages canonical physical equipment records, equipment classes, physical/electrical attributes,
and drawing aliases for fast deterministic entity resolution.
"""

import json
import sqlite3
from typing import Dict, Any, List, Optional
from services.db import get_db_connection

DEFAULT_EQUIPMENT_SEEDS = [
    # --- RRUs / Remote Radio Units ---
    {
        "canonical_id": "EQ-ERICSSON-RADIO-4485",
        "manufacturer": "Ericsson",
        "model_name": "Radio 4485 (B3/B1/B7)",
        "equipment_class": "RRU",
        "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)",
        "aliases": [
            "RADIO 4485",
            "RADIO 4485 (B3/B1/B7)",
            "ERICSSON RADIO 4485",
            "4485 B3/B1/B7",
            "RRUS 4485",
            "RRU 4485",
            "ERICSSON 4485",
            "PROPOSED TELSTRA LTE1800/LTE2100/NR/LTE2600 RADIO 4485",
            "PROPOSED TELSTRA LTE1800/LTE2100/LTE2600 RADIO 4485"
        ],
        "attributes": {
            "bands": ["B1", "B3", "B7"],
            "technologies": ["LTE1800", "LTE2100", "NR/LTE2600"],
            "dimensions_mm": "398 x 145 x 533mm",
            "height_mm": 533.0,
            "mounting": "Rail/Bracket"
        },
        "default_action": "INSTALL"
    },
    {
        "canonical_id": "EQ-ERICSSON-RADIO-4490",
        "manufacturer": "Ericsson",
        "model_name": "Radio 4490HP (B28/B26)",
        "equipment_class": "RRU",
        "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)",
        "aliases": [
            "RADIO 4490",
            "RADIO 4490HP",
            "RADIO 4490HP (B28/B26)",
            "ERICSSON RADIO 4490",
            "ERICSSON RADIO 4490HP",
            "4490HP",
            "4490HP (B28/B26)",
            "RRUS 4490",
            "TELSTRA LTE700/NR850 RADIO 4490HP",
            "PROPOSED TELSTRA LTE700/NR850 RADIO 4490HP"
        ],
        "attributes": {
            "bands": ["B28", "B26"],
            "technologies": ["LTE700", "NR850"],
            "dimensions_mm": "397 x 165 x 522mm",
            "height_mm": 522.0,
            "mounting": "Rail/Bracket"
        },
        "default_action": "INSTALL"
    },
    {
        "canonical_id": "EQ-ERICSSON-RADIO-4480",
        "manufacturer": "Ericsson",
        "model_name": "Radio 4480HP (B5/B28)",
        "equipment_class": "RRU",
        "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)",
        "aliases": [
            "RADIO 4480",
            "RADIO 4480HP",
            "RADIO 4480 (B5/B28)",
            "ERICSSON RADIO 4480",
            "4480HP (B5/B28)",
            "4480HP",
            "RRUS 4480",
            "EXISTING TELSTRA LTE700/NR850/WCDMA850 RADIO 4480HP"
        ],
        "attributes": {
            "bands": ["B5", "B28"],
            "technologies": ["LTE700", "NR850", "WCDMA850"],
            "dimensions_mm": "400 x 145 x 550mm",
            "height_mm": 550.0,
            "mounting": "Rail/Bracket"
        },
        "default_action": "REMOVE"
    },
    {
        "canonical_id": "EQ-ERICSSON-RRUS-32-B3",
        "manufacturer": "Ericsson",
        "model_name": "RRUS 32 B3 (LTE1800)",
        "equipment_class": "RRU",
        "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)",
        "aliases": [
            "RRUS 32 B3",
            "RRUS 32 B3 (LTE1800)",
            "ERICSSON RRUS 32 B3",
            "RRUS32 B3",
            "RRU 32 B3"
        ],
        "attributes": {
            "bands": ["B3"],
            "technologies": ["LTE1800"],
            "dimensions_mm": "431 x 182 x 500mm",
            "height_mm": 500.0,
            "mounting": "Tower/Mount"
        },
        "default_action": "REMOVE"
    },
    {
        "canonical_id": "EQ-ERICSSON-RRUS-32-B7",
        "manufacturer": "Ericsson",
        "model_name": "RRUS 32 B7 (NR/LTE2600)",
        "equipment_class": "RRU",
        "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)",
        "aliases": [
            "RRUS 32 B7",
            "RRUS 32 B7 (NR/LTE2600)",
            "ERICSSON RRUS 32 B7",
            "RRUS32 B7",
            "RRU 32 B7"
        ],
        "attributes": {
            "bands": ["B7"],
            "technologies": ["NR/LTE2600"],
            "dimensions_mm": "431 x 182 x 500mm",
            "height_mm": 500.0,
            "mounting": "Tower/Mount"
        },
        "default_action": "REMOVE"
    },
    {
        "canonical_id": "EQ-ERICSSON-RUS-02",
        "manufacturer": "Ericsson",
        "model_name": "RUS 02 (B28B)",
        "equipment_class": "RRU",
        "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)",
        "aliases": [
            "RUS 02",
            "RUS 02 (B28B)",
            "ERICSSON RUS 02",
            "RUS02"
        ],
        "attributes": {
            "bands": ["B28B"],
            "mounting": "Internal RBS6202 / Rack"
        },
        "default_action": "INSTALL"
    },
    {
        "canonical_id": "EQ-ERICSSON-RP6672",
        "manufacturer": "Ericsson",
        "model_name": "RP6672 Baseband",
        "equipment_class": "BASEBAND",
        "category": "Baseband & Internal Equipment",
        "aliases": [
            "RP6672",
            "ERICSSON RP6672",
            "RP 6672",
            "ERICSSON RP 6672",
            "RP6872",
            "ERICSSON RP6872"
        ],
        "attributes": {
            "mounting": "Pathfinder Rack / Internal"
        },
        "default_action": "INSTALL"
    },

    # --- Panel Antennas ---
    {
        "canonical_id": "EQ-ARGUS-VVPX310R-V4",
        "manufacturer": "Argus / CommScope",
        "model_name": "VVPX310R-V4 Panel Antenna",
        "equipment_class": "ANTENNA",
        "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)",
        "aliases": [
            "ARGUS VVPX310R-V4",
            "VVPX310R-V4",
            "ARGUS VVPX310R",
            "VVPX310R",
            "ARGUS PANEL 1277 x 290 x 103mm",
            "ARGUS PANEL"
        ],
        "attributes": {
            "dimensions_mm": "1277 x 290 x 103mm",
            "height_mm": 1277.0,
            "type": "Panel Antenna",
            "is_active": False
        },
        "default_action": "REMOVE"
    },
    {
        "canonical_id": "EQ-COMMSCOPE-RV4PX308R",
        "manufacturer": "CommScope",
        "model_name": "RV4PX308R-V2 Panel Antenna",
        "equipment_class": "ANTENNA",
        "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)",
        "aliases": [
            "RV4PX308R",
            "RV4PX308R-V2",
            "COMMSCOPE RV4PX308R",
            "RV4PX308R-V2 PANEL"
        ],
        "attributes": {
            "dimensions_mm": "1499 x 398 x 160mm",
            "height_mm": 1499.0,
            "type": "Panel Antenna",
            "is_active": False
        },
        "default_action": "INSTALL"
    },
    {
        "canonical_id": "EQ-GENERIC-5G-AAU",
        "manufacturer": "Ericsson / Generic",
        "model_name": "5G Active Antenna Unit (AAU / Massive MIMO)",
        "equipment_class": "ANTENNA",
        "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)",
        "aliases": [
            "5G AAU",
            "AAU",
            "AIR 6449",
            "AIR 3268",
            "AIR 6419",
            "5G MASSIVE MIMO",
            "ACTIVE ANTENNA UNIT"
        ],
        "attributes": {
            "type": "Active Antenna Unit",
            "is_active": True
        },
        "default_action": "INSTALL"
    },

    # --- Filters, TMAs, Combiners ---
    {
        "canonical_id": "EQ-KAELUS-TWIN-BANDSTOP",
        "manufacturer": "Kaelus",
        "model_name": "Twin Bandstop Filter BSF0020F1V2",
        "equipment_class": "TMA_FILTER",
        "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)",
        "aliases": [
            "KAELUS TWIN BANDSTOP FILTER",
            "TWIN BANDSTOP FILTER",
            "BSF0020F1V2",
            "KAELUS BSF0020F1V2",
            "BANDSTOP FILTER"
        ],
        "attributes": {
            "type": "Filter / TMA",
            "mounting": "Internal / Shelter / Tower"
        },
        "default_action": "REMOVE"
    },
    {
        "canonical_id": "EQ-ERICSSON-DUAL-DUPLEX-FILTER",
        "manufacturer": "Ericsson",
        "model_name": "Dual Duplex Filter KRF 102 268/1",
        "equipment_class": "TMA_FILTER",
        "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)",
        "aliases": [
            "ERICSSON DUAL DUPLEX FILTER",
            "DUAL DUPLEX FILTER",
            "KRF 102 268/1",
            "KRF102268/1"
        ],
        "attributes": {
            "type": "Duplex Filter",
            "mounting": "Internal / Rack"
        },
        "default_action": "REMOVE"
    },
    {
        "canonical_id": "EQ-GENERIC-TMA",
        "manufacturer": "Generic / Telstra",
        "model_name": "Tower Mounted Amplifier (TMA)",
        "equipment_class": "TMA_FILTER",
        "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)",
        "aliases": [
            "TMA",
            "TOWER MOUNTED AMPLIFIER",
            "LTE700/NR850 TMA",
            "TELSTRA TMA",
            "EXISTING TMA",
            "PROPOSED TMA"
        ],
        "attributes": {
            "type": "Tower Mounted Amplifier"
        },
        "default_action": "INSTALL"
    },

    # --- GPS Systems ---
    {
        "canonical_id": "EQ-TELSTRA-GPS-ANTENNA",
        "manufacturer": "Telstra / Generic",
        "model_name": "GPS Antenna KA-7005-1110",
        "equipment_class": "ANTENNA",
        "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)",
        "aliases": [
            "GPS ANTENNA",
            "TELSTRA GPS ANTENNA",
            "KA-7005-1110",
            "KA-7005",
            "LTE700 GPS ANTENNA",
            "GPS SYSTEM"
        ],
        "attributes": {
            "type": "GPS Antenna",
            "mounting": "Standard Mount"
        },
        "default_action": "INSTALL"
    },
    {
        "canonical_id": "EQ-TELSTRA-GPS-RECEIVER",
        "manufacturer": "Telstra",
        "model_name": "GPS Receiver Unit GRU 05 01",
        "equipment_class": "GPS",
        "category": "Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)",
        "aliases": [
            "GPS RECEIVER",
            "GPS RECEIVER UNIT",
            "GRU 05 01",
            "GRU0501",
            "TELSTRA GPS RECEIVER"
        ],
        "attributes": {
            "type": "GPS Receiver"
        },
        "default_action": "INSTALL"
    }
]


def seed_default_equipment_catalog(force: bool = False) -> int:
    """Seeds default canonical equipment items into the equipment_catalog table if empty."""
    from services.db import init_db
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if force:
        cursor.execute("DELETE FROM equipment_catalog")
    else:
        cursor.execute("SELECT COUNT(*) as count FROM equipment_catalog")
        row = cursor.fetchone()
        if row and row["count"] > 0:
            conn.close()
            return 0

    inserted_count = 0
    for item in DEFAULT_EQUIPMENT_SEEDS:
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO equipment_catalog (
                    canonical_id, manufacturer, model_name, equipment_class,
                    category, aliases_json, attributes_json, default_action, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                item["canonical_id"],
                item.get("manufacturer", ""),
                item["model_name"],
                item["equipment_class"],
                item.get("category", ""),
                json.dumps(item.get("aliases", [])),
                json.dumps(item.get("attributes", {})),
                item.get("default_action", "INSTALL"),
                1
            ))
            inserted_count += 1
        except Exception as e:
            print(f"[Equipment Service] Error seeding item {item.get('canonical_id')}: {e}")
            
    conn.commit()
    conn.close()
    print(f"[Equipment Service] Seeded {inserted_count} default canonical equipment records.")
    return inserted_count


def get_all_equipment(
    equipment_class: Optional[str] = None,
    manufacturer: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True
) -> List[Dict[str, Any]]:
    """Retrieves all equipment items with optional class, manufacturer, and search filters."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM equipment_catalog WHERE 1=1"
    params: List[Any] = []
    
    if active_only:
        query += " AND is_active = 1"
    if equipment_class:
        query += " AND equipment_class = ?"
        params.append(equipment_class.upper())
    if manufacturer:
        query += " AND manufacturer LIKE ?"
        params.append(f"%{manufacturer}%")
    if search:
        query += " AND (model_name LIKE ? OR canonical_id LIKE ? OR aliases_json LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])
        
    query += " ORDER BY equipment_class ASC, model_name ASC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    items = []
    for r in rows:
        d = dict(r)
        try:
            d["aliases"] = json.loads(d.get("aliases_json") or "[]")
        except Exception:
            d["aliases"] = []
        try:
            d["attributes"] = json.loads(d.get("attributes_json") or "{}")
        except Exception:
            d["attributes"] = {}
        items.append(d)
        
    conn.close()
    return items


def get_equipment_by_id(item_id: int) -> Optional[Dict[str, Any]]:
    """Fetches a single equipment item by its primary key ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM equipment_catalog WHERE id = ?", (item_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    try:
        d["aliases"] = json.loads(d.get("aliases_json") or "[]")
    except Exception:
        d["aliases"] = []
    try:
        d["attributes"] = json.loads(d.get("attributes_json") or "{}")
    except Exception:
        d["attributes"] = {}
    return d


def get_equipment_by_canonical_id(canonical_id: str) -> Optional[Dict[str, Any]]:
    """Fetches a single equipment item by its unique canonical ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM equipment_catalog WHERE canonical_id = ?", (canonical_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    try:
        d["aliases"] = json.loads(d.get("aliases_json") or "[]")
    except Exception:
        d["aliases"] = []
    try:
        d["attributes"] = json.loads(d.get("attributes_json") or "{}")
    except Exception:
        d["attributes"] = {}
    return d


def create_equipment(data: Dict[str, Any]) -> int:
    """Creates a new canonical equipment item in the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    canonical_id = data.get("canonical_id")
    if not canonical_id:
        # Generate canonical ID from model name
        clean_model = "".join(c if c.isalnum() else "-" for c in data.get("model_name", "UNKNOWN")).upper()
        canonical_id = f"EQ-{clean_model}"
        
    aliases = data.get("aliases", [])
    if isinstance(aliases, str):
        aliases = [a.strip() for a in aliases.split(",") if a.strip()]
        
    attributes = data.get("attributes", {})
    if isinstance(attributes, str):
        try:
            attributes = json.loads(attributes)
        except Exception:
            attributes = {}
            
    cursor.execute("""
        INSERT INTO equipment_catalog (
            canonical_id, manufacturer, model_name, equipment_class,
            category, aliases_json, attributes_json, default_action, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        canonical_id,
        data.get("manufacturer", ""),
        data.get("model_name", "New Equipment"),
        data.get("equipment_class", "EQUIPMENT").upper(),
        data.get("category", ""),
        json.dumps(aliases),
        json.dumps(attributes),
        data.get("default_action", "INSTALL").upper(),
        1 if data.get("is_active", True) else 0
    ))
    
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id


def update_equipment(item_id: int, data: Dict[str, Any]) -> bool:
    """Updates an existing equipment record."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    aliases = data.get("aliases")
    aliases_json = json.dumps(aliases) if aliases is not None else None
    
    attributes = data.get("attributes")
    attributes_json = json.dumps(attributes) if attributes is not None else None
    
    fields = []
    params = []
    
    if "canonical_id" in data:
        fields.append("canonical_id = ?")
        params.append(data["canonical_id"])
    if "manufacturer" in data:
        fields.append("manufacturer = ?")
        params.append(data["manufacturer"])
    if "model_name" in data:
        fields.append("model_name = ?")
        params.append(data["model_name"])
    if "equipment_class" in data:
        fields.append("equipment_class = ?")
        params.append(data["equipment_class"].upper())
    if "category" in data:
        fields.append("category = ?")
        params.append(data["category"])
    if aliases_json is not None:
        fields.append("aliases_json = ?")
        params.append(aliases_json)
    if attributes_json is not None:
        fields.append("attributes_json = ?")
        params.append(attributes_json)
    if "default_action" in data:
        fields.append("default_action = ?")
        params.append(data["default_action"].upper())
    if "is_active" in data:
        fields.append("is_active = ?")
        params.append(1 if data["is_active"] else 0)
        
    fields.append("updated_at = CURRENT_TIMESTAMP")
    params.append(item_id)
    
    cursor.execute(f"UPDATE equipment_catalog SET {', '.join(fields)} WHERE id = ?", params)
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


def delete_equipment(item_id: int) -> bool:
    """Deletes an equipment record."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM equipment_catalog WHERE id = ?", (item_id,))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


def add_alias_to_equipment(canonical_id: str, new_alias: str) -> bool:
    """Appends a new alias string pattern to a canonical equipment record."""
    item = get_equipment_by_canonical_id(canonical_id)
    if not item:
        return False
    clean_alias = new_alias.strip()
    if not clean_alias:
        return False
        
    aliases = item.get("aliases", [])
    if clean_alias.upper() not in [a.upper() for a in aliases]:
        aliases.append(clean_alias)
        return update_equipment(item["id"], {"aliases": aliases})
    return True
