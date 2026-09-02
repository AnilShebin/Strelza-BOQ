"""
Project Management Service.
Handles saving and loading compressed Strelza project files (.slz)
using Python zlib and JSON serialization with the BOQPROJ\x01 binary header.
"""
import os
import zlib
import json
from typing import Dict, Any, Tuple
from core.config import UPLOADS_DIR

PROJECTS_DIR = UPLOADS_DIR / "projects"
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
PROJECT_HEADER = b"BOQPROJ\x01"


class ProjectService:
    @staticmethod
    def compress_project(project_data: Dict[str, Any]) -> bytes:
        """
        Serializes project dict to JSON and compresses with zlib, prepending BOQPROJ\\x01 header.
        """
        json_str = json.dumps(project_data, ensure_ascii=False)
        compressed = zlib.compress(json_str.encode("utf-8"), level=9)
        return PROJECT_HEADER + compressed

    @staticmethod
    def decompress_project(file_bytes: bytes) -> Dict[str, Any]:
        """
        Validates header, decompresses zlib payload, and returns project dict.
        """
        if len(file_bytes) < len(PROJECT_HEADER) or not file_bytes.startswith(PROJECT_HEADER):
            # Fallback to pure json if plain text
            try:
                return json.loads(file_bytes.decode("utf-8"))
            except Exception:
                raise ValueError("Invalid Strelza project file format (unknown header).")
                
        payload = file_bytes[len(PROJECT_HEADER):]
        decompressed = zlib.decompress(payload)
        return json.loads(decompressed.decode("utf-8"))

    @staticmethod
    def save_project_file(filename: str, project_data: Dict[str, Any]) -> Tuple[str, int]:
        """
        Saves a project to disk and returns (absolute_path, file_size).
        """
        if not filename.endswith(".slz"):
            filename = f"{filename}.slz"
            
        file_path = PROJECTS_DIR / filename
        data = ProjectService.compress_project(project_data)
        
        with open(file_path, "wb") as f:
            f.write(data)
            
        return str(file_path), len(data)

    @staticmethod
    def load_project_file(file_path: str) -> Dict[str, Any]:
        """
        Loads and decompresses a project file from disk.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Project file not found at: {file_path}")
            
        with open(file_path, "rb") as f:
            data = f.read()
            
        return ProjectService.decompress_project(data)
