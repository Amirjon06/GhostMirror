import argparse
import sys

from app.db.session import SessionLocal, init_db
from app.services.demo import seed_demo_events


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create demo events for local GhostMirror development.")
    parser.add_argument("--force", action="store_true", help="Create demo events even if they already exist.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    init_db()

    with SessionLocal() as db:
        result = seed_demo_events(db, force=args.force)

    if result.created_count == 0:
        print("Demo events already exist.")
    else:
        print(f"Created {result.created_count} demo events.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
