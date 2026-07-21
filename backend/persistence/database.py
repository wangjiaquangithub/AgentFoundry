"""Database connection and transaction helpers for persistence repositories."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from backend.persistence.migrations import sqlite_path_from_database_url


@dataclass(frozen=True)
class SQLiteDatabase:
    """Small database boundary used by phase 2 repository work."""

    database_url: str

    @property
    def path(self) -> Path:
        return sqlite_path_from_database_url(self.database_url)

    def connect(self) -> sqlite3.Connection:
        database_path = self.path
        if str(database_path) != ":memory:":
            database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(str(database_path))
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        connection = self.connect()
        try:
            with connection:
                yield connection
        finally:
            connection.close()


def create_sqlite_database(database_url: str) -> SQLiteDatabase:
    return SQLiteDatabase(database_url=database_url)


@dataclass(frozen=True)
class PostgresDatabase:
    """Production PostgreSQL transaction boundary for phase 2 repositories."""

    database_url: str

    def connect(self) -> Any:
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as exc:
            raise RuntimeError(
                "PostgreSQL database access requires the optional psycopg "
                "package. Install psycopg before using postgresql:// or "
                "postgres:// persistence URLs."
            ) from exc

        return psycopg.connect(self.database_url, row_factory=dict_row)

    @contextmanager
    def transaction(self) -> Iterator[Any]:
        connection = self.connect()
        try:
            with connection:
                yield connection
        finally:
            connection.close()


def create_postgres_database(database_url: str) -> PostgresDatabase:
    parsed = urlparse(database_url)
    if parsed.scheme not in {"postgresql", "postgres"}:
        raise ValueError("PostgreSQL database URLs must use postgresql:// or postgres://.")
    return PostgresDatabase(database_url=database_url)
