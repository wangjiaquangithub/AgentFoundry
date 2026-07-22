#!/usr/bin/env python3
"""Check the Phase 2 PostgreSQL production data-layer documentation contract."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
BACKEND_README = ROOT / "backend" / "README.md"
DOCS_DIR = ROOT / "docs"

REQUIRED_CONTRACTS = {
    README: (
        "PostgreSQL is the production database target",
        "Local JSON/JSONL",
        "development fixtures or import/export inputs",
        "`sqlite://` is only accepted for explicit local compatibility",
    ),
    BACKEND_README: (
        "生产数据层目标是 PostgreSQL",
        "本地 JSON/JSONL 和 SQLite",
        "只用于开发、smoke 验证、导入导出或兼容路径",
        "不是生产事实来源",
        "PostgreSQL 审计事件",
    ),
    DOCS_DIR / "architecture.md": (
        "The production persistence target is PostgreSQL",
        "Local JSON, JSONL, and SQLite",
        "development, smoke-test, import/export, or compatibility paths",
    ),
    DOCS_DIR / "data-model.md": (
        "PostgreSQL is the production relational database target",
        "not the production system of record",
    ),
    DOCS_DIR / "product-roadmap.md": (
        "生产持久化目标是 PostgreSQL",
        "本地 JSON/JSONL 和 SQLite 只作为开发、迁移或兼容路径",
    ),
    DOCS_DIR / "production-plan.md": (
        "真正的系统记录",
        "优先 PostgreSQL",
        "本地开发可用 SQLite 兼容路径",
    ),
}

DISALLOWED_PRODUCTION_STORAGE_PATTERNS = (
    r"\bsqlite\b[^.\n]{0,100}\bproduction (?:storage|data layer|database|persistence)\b",
    r"\bjsonl?\b[^.\n]{0,100}\bproduction (?:storage|data layer|database|persistence)\b",
    r"\bjson/jsonl\b[^.\n]{0,100}\bproduction (?:storage|data layer|database|persistence)\b",
    r"\bproduction (?:storage|data layer|database|persistence)\b[^.\n]{0,100}\bsqlite\b",
    r"\bproduction (?:storage|data layer|database|persistence)\b[^.\n]{0,100}\bjsonl?\b",
    r"\bproduction (?:storage|data layer|database|persistence)\b[^.\n]{0,100}\bjson/jsonl\b",
    r"\blocal json(?:/jsonl)? files are production\b",
    r"\blocal jsonl files are production\b",
    r"\bsqlite is the production\b",
)


def _relative(path: Path) -> str:
    return str(path.relative_to(ROOT))


def _normalize(text: str) -> str:
    return " ".join(text.lower().split())


def _check_required_contracts() -> list[str]:
    errors: list[str] = []
    for path, required_tokens in sorted(REQUIRED_CONTRACTS.items()):
        if not path.exists():
            errors.append(f"missing production data-layer contract document: {_relative(path)}")
            continue

        source = path.read_text(encoding="utf-8")
        normalized_source = _normalize(source)
        for token in required_tokens:
            if token not in source and _normalize(token) not in normalized_source:
                errors.append(
                    "PostgreSQL production data-layer docs contract drifted: "
                    f"{_relative(path)} missing {token!r}",
                )
    return errors


def _check_no_local_storage_promoted_to_production() -> list[str]:
    errors: list[str] = []
    checked_paths = [README, BACKEND_README, *sorted(DOCS_DIR.glob("*.md"))]
    for path in checked_paths:
        source = _normalize(path.read_text(encoding="utf-8"))
        for pattern in DISALLOWED_PRODUCTION_STORAGE_PATTERNS:
            if re.search(pattern, source):
                errors.append(
                    "PostgreSQL production data-layer docs contract forbids local storage as production: "
                    f"{_relative(path)} matched {pattern!r}",
                )
    return errors


def main() -> int:
    errors = [
        *_check_required_contracts(),
        *_check_no_local_storage_promoted_to_production(),
    ]
    if errors:
        print("Phase 2 PostgreSQL docs contract gate failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("OK: Phase 2 PostgreSQL docs contract is explicit.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
