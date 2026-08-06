from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.schemas.event import EventCreate
from app.services import events as event_service

MAX_TEXT_BYTES = 200_000


@dataclass(frozen=True)
class FileFingerprint:
    size_bytes: int
    modified_ns: int


@dataclass(frozen=True)
class FileCaptureResult:
    path: Path
    created: bool
    reason: str
    fingerprint: FileFingerprint | None = None
    event_id: int | None = None
    title: str | None = None


def capture_filesystem_snapshot(
    db: Session,
    root: Path,
    previous_fingerprints: dict[Path, FileFingerprint] | None = None,
    include_hidden: bool = False,
) -> list[FileCaptureResult]:
    fingerprints = previous_fingerprints or {}
    results: list[FileCaptureResult] = []

    for path in iter_files(root, include_hidden=include_hidden):
        results.append(
            capture_file(
                db,
                path,
                root=root,
                previous_fingerprint=fingerprints.get(path),
            )
        )

    return results


def capture_file(
    db: Session,
    path: Path,
    root: Path,
    previous_fingerprint: FileFingerprint | None = None,
) -> FileCaptureResult:
    try:
        if not path.is_file():
            return FileCaptureResult(path=path, created=False, reason="not_file")

        stat = path.stat()
    except OSError:
        return FileCaptureResult(path=path, created=False, reason="read_error")

    fingerprint = FileFingerprint(size_bytes=stat.st_size, modified_ns=stat.st_mtime_ns)
    if previous_fingerprint == fingerprint:
        return FileCaptureResult(path=path, created=False, reason="unchanged", fingerprint=fingerprint)

    if stat.st_size == 0:
        return FileCaptureResult(path=path, created=False, reason="empty", fingerprint=fingerprint)

    if stat.st_size > MAX_TEXT_BYTES:
        return FileCaptureResult(path=path, created=False, reason="too_large", fingerprint=fingerprint)

    try:
        content = path.read_text(encoding="utf-8").strip()
    except UnicodeDecodeError:
        return FileCaptureResult(path=path, created=False, reason="not_text", fingerprint=fingerprint)
    except OSError:
        return FileCaptureResult(path=path, created=False, reason="read_error", fingerprint=fingerprint)

    if not content:
        return FileCaptureResult(path=path, created=False, reason="empty", fingerprint=fingerprint)

    title = build_file_title(path, root)
    event = event_service.create_event(
        db,
        EventCreate(
            source="filesystem",
            event_type="file_snapshot",
            title=title,
            content=content,
            metadata={
                "path": str(path),
                "size_bytes": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
            },
        ),
    )

    return FileCaptureResult(
        path=path,
        created=True,
        reason="created",
        fingerprint=fingerprint,
        event_id=event.id,
        title=title,
    )


def iter_files(root: Path, include_hidden: bool = False) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*"):
        if not include_hidden and has_hidden_part(path.relative_to(root)):
            continue

        if path.is_file():
            files.append(path)

    return sorted(files)


def has_hidden_part(path: Path) -> bool:
    return any(part.startswith(".") for part in path.parts)


def build_file_title(path: Path, root: Path) -> str:
    try:
        title = str(path.relative_to(root))
    except ValueError:
        title = path.name

    if len(title) > 200:
        title = f"...{title[-197:]}"

    return title
