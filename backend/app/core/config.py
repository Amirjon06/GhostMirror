from dataclasses import dataclass
import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = PROJECT_ROOT / "data"


@dataclass(frozen=True)
class Settings:
    app_name: str = "GhostMirror API"
    app_version: str = "0.1.0"
    database_url: str = os.getenv("GHOSTMIRROR_DATABASE_URL", f"sqlite:///{DATA_DIR / 'ghostmirror.db'}")
    allowed_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("GHOSTMIRROR_ALLOWED_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",")
        if origin.strip()
    )


settings = Settings()
