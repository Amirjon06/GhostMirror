from dataclasses import dataclass
import shutil
import subprocess
import sys
from typing import Protocol

from sqlalchemy.orm import Session

from app.schemas.event import EventCreate
from app.services import events as event_service


class ClipboardReadError(RuntimeError):
    pass


class ClipboardReader(Protocol):
    def read_text(self) -> str | None:
        pass


@dataclass(frozen=True)
class ClipboardCaptureResult:
    created: bool
    reason: str
    content: str | None = None
    event_id: int | None = None
    title: str | None = None


class SystemClipboardReader:
    def read_text(self) -> str | None:
        command = self._command()
        if command is None:
            raise ClipboardReadError("No supported clipboard command is available.")

        try:
            result = subprocess.run(
                command,
                capture_output=True,
                check=True,
                text=True,
                timeout=2,
            )
        except (subprocess.SubprocessError, OSError) as exc:
            raise ClipboardReadError("Could not read the system clipboard.") from exc

        return result.stdout

    def _command(self) -> list[str] | None:
        if sys.platform == "darwin" and shutil.which("pbpaste"):
            return ["pbpaste"]

        if sys.platform.startswith("win") and shutil.which("powershell"):
            return ["powershell", "-NoProfile", "-Command", "Get-Clipboard"]

        linux_commands = (
            ["wl-paste", "--no-newline"],
            ["xclip", "-selection", "clipboard", "-out"],
            ["xsel", "--clipboard", "--output"],
        )
        for command in linux_commands:
            if shutil.which(command[0]):
                return command

        return None


def capture_clipboard_text(
    db: Session,
    content: str | None,
    previous_content: str | None = None,
) -> ClipboardCaptureResult:
    normalized_content = content.strip() if content else ""
    if not normalized_content:
        return ClipboardCaptureResult(created=False, reason="empty")

    if previous_content == normalized_content:
        return ClipboardCaptureResult(
            created=False,
            reason="unchanged",
            content=normalized_content,
        )

    title = build_clipboard_title(normalized_content)
    event = event_service.create_event(
        db,
        EventCreate(
            source="clipboard",
            event_type="snippet",
            title=title,
            content=normalized_content,
            metadata={"characters": len(normalized_content)},
        ),
    )

    return ClipboardCaptureResult(
        created=True,
        reason="created",
        content=normalized_content,
        event_id=event.id,
        title=title,
    )


def build_clipboard_title(content: str) -> str:
    first_line = next((line.strip() for line in content.splitlines() if line.strip()), "Clipboard text")
    if len(first_line) > 80:
        first_line = f"{first_line[:77]}..."

    return first_line
