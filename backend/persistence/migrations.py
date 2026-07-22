"""Small migration runner for the AgentFoundry persistence baseline.

PostgreSQL is the production target. SQLite remains supported as a local
development compatibility path while the phase 2 repository work moves toward
the production data layer.
"""

from __future__ import annotations

import argparse
import os
import sqlite3
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType
from urllib.parse import unquote, urlparse

MIGRATIONS_DIR = Path(__file__).with_name("migrations")
POSTGRES_DATABASE_SCHEMES = {"postgresql", "postgres"}


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


def plan_migrations(completed_versions: Iterable[str]) -> list[Migration]:
    completed = set(completed_versions)
    return [
        migration
        for migration in migration_registry()
        if migration.version not in completed
    ]


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


def postgres_database_url_has_name(database_url: str) -> bool:
    parsed = urlparse(database_url.strip())
    if parsed.scheme not in POSTGRES_DATABASE_SCHEMES:
        return False
    return bool(parsed.path.strip("/"))


def _import_psycopg() -> ModuleType:
    try:
        import psycopg
    except ImportError as exc:
        raise RuntimeError(
            "PostgreSQL migrations require the optional psycopg package. "
            "Install psycopg before running migrations against postgresql:// "
            "or postgres:// URLs."
        ) from exc
    return psycopg


def _apply_sqlite_migrations(database_url: str) -> list[Migration]:
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
        for migration in plan_migrations(completed):
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


def _apply_postgres_migrations(database_url: str) -> list[Migration]:
    if not postgres_database_url_has_name(database_url):
        raise ValueError("PostgreSQL database URLs must include an explicit database name.")

    psycopg = _import_psycopg()

    applied: list[Migration] = []
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                  version TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            cursor.execute("SELECT version FROM schema_migrations")
            completed = {row[0] for row in cursor.fetchall()}
            for migration in plan_migrations(completed):
                with migration.path.open("r", encoding="utf-8") as migration_file:
                    cursor.execute(migration_file.read())
                cursor.execute(
                    """
                    INSERT INTO schema_migrations (version, name)
                    VALUES (%s, %s)
                    """,
                    (migration.version, migration.name),
                )
                applied.append(migration)
    return applied


def apply_migrations(database_url: str) -> list[Migration]:
    parsed = urlparse(database_url)
    if parsed.scheme == "sqlite":
        return _apply_sqlite_migrations(database_url)
    if parsed.scheme in POSTGRES_DATABASE_SCHEMES:
        return _apply_postgres_migrations(database_url)
    raise ValueError(
        "Unsupported database URL scheme. Use postgresql:// for production "
        "or sqlite:// for explicit local development compatibility."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply AgentFoundry migrations.")
    parser.add_argument(
        "--database-url",
        default=os.getenv(
            "AGENTFOUNDRY_DATABASE_URL",
            "postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry",
        ),
        help=(
            "Database URL. Use postgresql:// for production; sqlite:// is "
            "explicit local development compatibility only."
        ),
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
