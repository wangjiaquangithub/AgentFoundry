"""Small migration runner for the local SQLite persistence baseline.

This module intentionally does not replace the development JSON repositories.
It provides a repeatable schema bootstrap point for the production data layer
work in phase 2.
"""

from __future__ import annotations

import argparse
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlparse


MIGRATIONS_DIR = Path(__file__).with_name("migrations")


@dataclass(frozen=True)
class Migration:
    version: str
    name: str
    path: Path


def migration_registry() -> list[Migration]:
    migrations: list[Migration] = []
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        version, _, name = path.stem.partition("_")
        if not version or not name:
            raise ValueError(f"Invalid migration filename: {path.name}")
        migrations.append(Migration(version=version, name=name, path=path))
    return migrations


def sqlite_path_from_database_url(database_url: str) -> Path:
    parsed = urlparse(database_url)
    if parsed.scheme != "sqlite":
        raise ValueError("Only sqlite:// URLs are supported by this baseline runner.")
    if parsed.netloc and parsed.netloc != "":
        raise ValueError("Use sqlite:///absolute/path.db or sqlite:///:memory:.")
    if parsed.path == "/:memory:":
        return Path(":memory:")
    if not parsed.path:
        raise ValueError("SQLite database URL must include a path.")
    return Path(unquote(parsed.path))


def apply_migrations(database_url: str) -> list[Migration]:
    database_path = sqlite_path_from_database_url(database_url)
    if str(database_path) != ":memory:":
        database_path.parent.mkdir(parents=True, exist_ok=True)

    applied: list[Migration] = []
    with sqlite3.connect(str(database_path)) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        completed = {
            row[0]
            for row in connection.execute("SELECT version FROM schema_migrations")
        }
        for migration in migration_registry():
            if migration.version in completed:
                continue
            with migration.path.open("r", encoding="utf-8") as migration_file:
                connection.executescript(migration_file.read())
            connection.execute(
                """
                INSERT INTO schema_migrations (version, name)
                VALUES (?, ?)
                """,
                (migration.version, migration.name),
            )
            applied.append(migration)
    return applied


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply AgentFoundry migrations.")
    parser.add_argument(
        "--database-url",
        default="sqlite:///backend/data/agentfoundry.db",
        help="SQLite URL for the local persistence baseline.",
    )
    args = parser.parse_args()
    applied = apply_migrations(args.database_url)
    if applied:
        for migration in applied:
            print(f"applied {migration.version} {migration.name}")
    else:
        print("database already up to date")


if __name__ == "__main__":
    main()

