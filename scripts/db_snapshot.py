import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


BACKUP_DIR = Path("backups")
DEFAULT_ENV_FILE = Path(".env")


def parse_dotenv(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def get_database_url() -> str:
    dsn = os.environ.get("DATABASE_URL")
    if dsn:
        return dsn

    dotenv = parse_dotenv(DEFAULT_ENV_FILE)
    dsn = dotenv.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set in environment or .env")
    return dsn


def find_executable(name: str) -> str:
    path = shutil.which(name)
    if path:
        return path
    raise RuntimeError(f"Required executable '{name}' was not found in PATH. Please install PostgreSQL client tools.")


def run_command(command: list[str], env: dict[str, str] | None = None) -> None:
    result = subprocess.run(command, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"Command failed: {' '.join(command)}\n"
            f"stdout:\n{result.stdout}\n"
            f"stderr:\n{result.stderr}"
        )


def make_backup_path() -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return BACKUP_DIR / f"quantum_seo_backup_{timestamp}.dump"


def backup_database(database_url: str, output_file: Path) -> None:
    pg_dump = find_executable("pg_dump")
    command = [
        pg_dump,
        "--format=custom",
        "--blobs",
        "--no-owner",
        "--no-privileges",
        "--file",
        str(output_file),
        database_url,
    ]
    print(f"Backing up database to {output_file}")
    run_command(command)
    print("Backup complete.")


def restore_database(database_url: str, snapshot_file: Path) -> None:
    pg_restore = find_executable("pg_restore")
    if not snapshot_file.exists():
        raise FileNotFoundError(f"Snapshot file not found: {snapshot_file}")

    command = [
        pg_restore,
        "--verbose",
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--dbname",
        database_url,
        str(snapshot_file),
    ]
    print(f"Restoring database from {snapshot_file}")
    run_command(command)
    print("Restore complete.")


def list_snapshots() -> None:
    if not BACKUP_DIR.exists():
        print("No backup snapshots found.")
        return

    entries = sorted(BACKUP_DIR.glob("*.dump"))
    if not entries:
        print("No backup snapshots found.")
        return

    for file_path in entries:
        stat = file_path.stat()
        print(f"{file_path.name}\t{stat.st_size // 1024} KB\t{datetime.utcfromtimestamp(stat.st_mtime).isoformat()} UTC")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create and restore PostgreSQL backup snapshots for the QuAir Search database.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    backup_parser = subparsers.add_parser("backup", help="Create a new backup snapshot.")
    backup_parser.add_argument("--output", "-o", type=Path, help="Optional output file path for the snapshot.")

    restore_parser = subparsers.add_parser("restore", help="Restore from an existing snapshot.")
    restore_parser.add_argument("snapshot", type=Path, nargs="?", help="Snapshot file to restore. If omitted, the latest snapshot is used.")

    subparsers.add_parser("list", help="List available backup snapshots.")

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        database_url = get_database_url()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if args.command == "backup":
        output_file = args.output if args.output else make_backup_path()
        backup_database(database_url, output_file)
        return 0

    if args.command == "restore":
        snapshot = args.snapshot
        if snapshot is None:
            snapshots = sorted(BACKUP_DIR.glob("*.dump"))
            if not snapshots:
                print("ERROR: No snapshots available to restore.", file=sys.stderr)
                return 1
            snapshot = snapshots[-1]
            print(f"Using latest snapshot: {snapshot.name}")
        restore_database(database_url, snapshot)
        return 0

    if args.command == "list":
        list_snapshots()
        return 0

    print("Unknown command", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
