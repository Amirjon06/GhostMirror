import argparse
from pathlib import Path
import sys
import time

from app.db.session import SessionLocal, init_db
from app.services.filesystem import FileFingerprint, capture_filesystem_snapshot


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
    parser = argparse.ArgumentParser(description="Capture filesystem text files as GhostMirror events.")
    parser.add_argument("path", nargs="?", default=".", help="Directory to scan.")
    parser.add_argument("--interval", type=positive_float, default=5.0, help="Polling interval in seconds.")
    parser.add_argument("--once", action="store_true", help="Scan once and exit.")
    parser.add_argument("--max-events", type=positive_int, default=None, help="Stop after creating this many events.")
    parser.add_argument("--include-hidden", action="store_true", help="Include hidden files and directories.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    root = Path(args.path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        print(f"Directory does not exist: {root}", file=sys.stderr)
        return 1

    init_db()
    fingerprints: dict[Path, FileFingerprint] = {}
    created_count = 0

    while True:
        with SessionLocal() as db:
            results = capture_filesystem_snapshot(
                db,
                root,
                previous_fingerprints=fingerprints,
                include_hidden=args.include_hidden,
            )

        for result in results:
            if result.fingerprint is not None:
                fingerprints[result.path] = result.fingerprint

            if result.created:
                created_count += 1
                print(f"Created event {result.event_id}: {result.title}")

                if args.max_events is not None and created_count >= args.max_events:
                    return 0

        if args.once:
            return 0

        time.sleep(args.interval)


if __name__ == "__main__":
    raise SystemExit(main())
