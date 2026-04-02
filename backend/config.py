import os
from pathlib import Path

DB_PATH = os.getenv("DB_PATH", str(Path(__file__).parent.parent / "data" / "poker.db"))
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-depu-jifen-2024")
DEFAULT_INITIAL_CHIPS = int(os.getenv("DEFAULT_INITIAL_CHIPS", "1000"))
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
