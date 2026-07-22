#!/usr/bin/env python3
"""Validate Phase 6 secret hygiene for tracked repository content."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
GITIGNORE = ROOT / ".gitignore"

ALLOWED_ENV_FILE_SUFFIXES = (
    ".example",
    ".sample",
    ".template",
)
SECRET_FILE_SUFFIXES = (
    ".key",
    ".pem",
    ".p12",
    ".pfx",
)
BINARY_FILE_SUFFIXES = (
    ".gif",
    ".ico",
    ".jpg",
    ".jpeg",
    ".pdf",
    ".png",
    ".webp",
)
REQUIRED_GITIGNORE_ENTRIES = {
    ".env",
    "backend/.env",
    "backend/data/audit/*.jsonl",
    "backend/data/*.jsonl",
    "*.log",
}
PLACEHOLDER_VALUES = {
    "",
    "changeme",
    "change-me",
    "example",
    "example-value",
    "placeholder",
    "replace-me",
    "replace-with-local-secret",
    "replace-with-real-token",
    "todo",
    "your-api-key",
    "your-secret",
    "your-token",
}
LOCAL_DATABASE_URLS = {
    "postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry",
    "postgres://agentfoundry:agentfoundry@localhost:5432/agentfoundry",
}

HIGH_CONFIDENCE_PATTERNS = (
    (
        re.compile(r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----"),
        "private key block",
    ),
    (
        re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
        "AWS access key id",
    ),
    (
        re.compile(r"\bASIA[0-9A-Z]{16}\b"),
        "AWS temporary access key id",
    ),
    (
        re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
        "OpenAI-style API key",
    ),
)
SECRET_ASSIGNMENT_RE = re.compile(
    r"^\s*(?:export\s+)?"
    r"(?P<name>[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|DATABASE_URL)[A-Z0-9_]*)"
    r"\s*(?::=|=|:)\s*"
    r"(?P<value>.+?)\s*$"
)
DATABASE_URL_RE = re.compile(r"\b(?:postgresql|postgres)://[^\s\"'`<>]+")
NON_SECRET_ASSIGNMENT_SUFFIXES = (
    "_ENV_VAR",
    "_MODULE",
    "_MODULES",
    "_PATTERN",
    "_PATTERNS",
    "_RE",
    "_SUFFIX",
    "_SUFFIXES",
    "_URLS",
)


def tracked_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    return [
        ROOT / raw.decode("utf-8")
        for raw in result.stdout.split(b"\0")
        if raw
    ]


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def is_allowed_env_example(path: Path) -> bool:
    name = path.name
    return (
        name.startswith(".env")
        and any(name.endswith(suffix) for suffix in ALLOWED_ENV_FILE_SUFFIXES)
    )


def check_tracked_file_names(paths: list[Path]) -> list[str]:
    failures: list[str] = []
    for path in paths:
        rel = relative(path)
        name = path.name
        if name == ".env" or (name.startswith(".env.") and not is_allowed_env_example(path)):
            failures.append(f"{rel} must not be tracked; use an ignored local env file.")
        if path.suffix in SECRET_FILE_SUFFIXES:
            failures.append(f"{rel} looks like a private key/certificate secret file.")
    return failures


def read_text(path: Path) -> str | None:
    if path.suffix.lower() in BINARY_FILE_SUFFIXES:
        return None
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return None


def clean_assignment_value(raw_value: str) -> str:
    value = raw_value.strip().split(" #", 1)[0].strip()
    if (
        len(value) >= 2
        and value[0] == value[-1]
        and value[0] in {'"', "'"}
    ):
        value = value[1:-1].strip()
    return value


def is_placeholder_value(value: str) -> bool:
    normalized = value.strip().strip("\"'").lower()
    if normalized in PLACEHOLDER_VALUES:
        return True
    return (
        normalized.startswith("${")
        or normalized.startswith("$")
        or "<" in normalized
        or "..." in normalized
        or normalized.endswith("_example")
    )


def is_allowed_database_url(value: str) -> bool:
    value = value.rstrip("*")
    if value in LOCAL_DATABASE_URLS:
        return True
    parsed = urlparse(value)
    if value in {"postgresql://", "postgres://"} or "..." in value:
        return True
    if parsed.scheme not in {"postgresql", "postgres"}:
        return False
    if parsed.hostname in {"localhost", "127.0.0.1"} and parsed.password in {
        None,
        "",
        "agentfoundry",
    }:
        return True
    if parsed.username is None and parsed.password is None:
        return True
    return False


def check_database_urls(path: Path, text: str) -> list[str]:
    failures: list[str] = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        for match in DATABASE_URL_RE.finditer(line):
            value = match.group(0).rstrip(").,]*")
            if not is_allowed_database_url(value):
                failures.append(
                    f"{relative(path)}:{line_no} contains a non-local PostgreSQL URL.",
                )
    return failures


def check_secret_patterns(path: Path, text: str) -> list[str]:
    failures: list[str] = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        for pattern, label in HIGH_CONFIDENCE_PATTERNS:
            if pattern.search(line):
                failures.append(f"{relative(path)}:{line_no} contains {label}.")

        assignment = SECRET_ASSIGNMENT_RE.match(line)
        if assignment is None:
            continue

        name = assignment.group("name")
        if name.endswith(NON_SECRET_ASSIGNMENT_SUFFIXES):
            continue

        value = clean_assignment_value(assignment.group("value"))
        if is_placeholder_value(value):
            continue
        if name.endswith("DATABASE_URL") and is_allowed_database_url(value):
            continue
        failures.append(
            f"{relative(path)}:{line_no} assigns {name} to a non-placeholder value.",
        )
    return failures


def check_tracked_content(paths: list[Path]) -> list[str]:
    failures: list[str] = []
    for path in paths:
        text = read_text(path)
        if text is None:
            continue
        failures.extend(check_secret_patterns(path, text))
        failures.extend(check_database_urls(path, text))
    return failures


def check_gitignore() -> list[str]:
    entries = {
        line.strip()
        for line in GITIGNORE.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    }
    missing = sorted(REQUIRED_GITIGNORE_ENTRIES - entries)
    return [f".gitignore must include {entry}" for entry in missing]


def main() -> int:
    paths = tracked_files()
    failures = [
        *check_tracked_file_names(paths),
        *check_tracked_content(paths),
        *check_gitignore(),
    ]
    if failures:
        print("Phase 6 secret hygiene check failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("Phase 6 secret hygiene check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
