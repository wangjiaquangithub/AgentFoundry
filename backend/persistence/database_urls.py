"""Database URL helpers shared by persistence runtime and migrations."""

from __future__ import annotations

from urllib.parse import urlparse

POSTGRES_DATABASE_SCHEMES = frozenset({"postgresql", "postgres"})


def is_postgres_database_url(database_url: str) -> bool:
    return urlparse(database_url.strip()).scheme in POSTGRES_DATABASE_SCHEMES


def has_postgres_database_name(database_url: str) -> bool:
    parsed = urlparse(database_url.strip())
    if parsed.scheme not in POSTGRES_DATABASE_SCHEMES:
        return False
    return bool(parsed.path.strip("/"))
