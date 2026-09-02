"""
Application Configuration and Constants.
Provides centralized path management and environment settings.
"""
import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

ACTIVE_PRICE_LIST_PATH = str(UPLOADS_DIR / "active_price_list.xlsx")
MAPPING_RULES_PATH = str(BASE_DIR / "mapping_rules.json")
SETTINGS_PATH = str(BASE_DIR / "settings.json")
DB_PATH = str(BASE_DIR / "boq.db")

# API Configuration
API_TITLE = "Strelza BOQ Engine API"
API_DESCRIPTION = "High-performance PyMuPDF + Gemini Vision Backend for Engineering BOQs"
API_VERSION = "2.0.0"

# CORS Configuration
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "*",
]
