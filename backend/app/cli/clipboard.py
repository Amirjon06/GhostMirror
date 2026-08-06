import argparse
import sys
import time

from app.db.session import SessionLocal, init_db
from app.services.clipboard import ClipboardReadError, SystemClipboardReader, capture_clipboard_text


def positive_float(value: str) -> float:
    parsed = float(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than 0")
    return parsed


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than 0")
    return parsed


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Capture clipboard text as GhostMirror events.")
    parser.add_argument("--interval", type=positive_float, default=1.0, help="Polling interval in seconds.")
    parser.add_argument("--once", action="store_true", help="Capture the current clipboard value once.")
    parser.add_argument("--max-events", type=positive_int, default=None, help="Stop after creating this many events.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    init_db()

    reader = SystemClipboardReader()
    previous_content: str | None = None
    created_count = 0

    while True:
        try:
            content = reader.read_text()
        except ClipboardReadError as exc:
            print(str(exc), file=sys.stderr)
            return 1

        with SessionLocal() as db:
            result = capture_clipboard_text(db, content, previous_content=previous_content)

        if result.content is not None:
            previous_content = result.content

        if result.created:
            created_count += 1
            print(f"Created event {result.event_id}: {result.title}")

        if args.once or (args.max_events is not None and created_count >= args.max_events):
            return 0

        time.sleep(args.interval)


if __name__ == "__main__":
    raise SystemExit(main())
