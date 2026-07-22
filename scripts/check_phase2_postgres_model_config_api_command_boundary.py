#!/usr/bin/env python3
"""Check PostgreSQL model config API command boundary."""

from __future__ import annotations

import ast
import sys
from dataclasses import dataclass, field
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVICE_MODULE = ROOT / "backend" / "services" / "model_configs.py"
sys.path.insert(0, str(ROOT))

from backend.persistence import AuditEventRecord, ModelConfigRecord
from backend.services.model_configs import (
    ModelConfigApiCommandInput,
    PlatformModelConfigService,
)


SECRET_CONFIG_REF = "placeholder"


def _parse_module(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _class_node(tree: ast.AST, class_name: str) -> ast.ClassDef | None:
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            return node
    return None


def _function_names(class_node: ast.ClassDef) -> set[str]:
    return {
        node.name
        for node in class_node.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }


def _function_node(tree: ast.AST, function_name: str) -> ast.FunctionDef | None:
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == function_name:
            return node
    return None


def _calls_method(function: ast.FunctionDef, method_name: str) -> bool:
    for node in ast.walk(function):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr == method_name:
                return True
    return False


def _constructs_name(function: ast.FunctionDef, name: str) -> bool:
    for node in ast.walk(function):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id == name:
                return True
    return False


def _string_constants(tree: ast.AST) -> set[str]:
    return {
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    }


def _check_static_contract() -> list[str]:
    errors: list[str] = []
    tree = _parse_module(SERVICE_MODULE)

    if _class_node(tree, "ModelConfigApiCommandInput") is None:
        errors.append("backend/services/model_configs.py must define ModelConfigApiCommandInput")

    service = _class_node(tree, "PlatformModelConfigService")
    if service is None:
        errors.append("backend/services/model_configs.py must define PlatformModelConfigService")
        return errors

    if "upsert_model_config_from_api" not in _function_names(service):
        errors.append("PlatformModelConfigService must define upsert_model_config_from_api")
        return errors

    boundary = next(
        node
        for node in service.body
        if isinstance(node, ast.FunctionDef) and node.name == "upsert_model_config_from_api"
    )
    if not _constructs_name(boundary, "ModelConfigWriteCommand"):
        errors.append("upsert_model_config_from_api must construct ModelConfigWriteCommand")
    if not _calls_method(boundary, "upsert_model_config"):
        errors.append("upsert_model_config_from_api must call upsert_model_config")
    if not _constructs_name(boundary, "model_config_response_payload"):
        errors.append("upsert_model_config_from_api must return model_config_response_payload")

    response_helper = _function_node(tree, "model_config_response_payload")
    if response_helper is None:
        errors.append("backend/services/model_configs.py must define model_config_response_payload")
        return errors

    constants = _string_constants(response_helper)
    required_fields = {
        "id",
        "tenant_id",
        "name",
        "provider",
        "model",
        "purpose",
        "status",
        "created_at",
        "updated_at",
        "config_ref_configured",
    }
    missing_fields = sorted(required_fields - constants)
    if missing_fields:
        errors.append(
            "model_config_response_payload is missing API-safe fields: "
            + ", ".join(missing_fields),
        )
    if "config_ref" in constants:
        errors.append("model_config_response_payload must not expose config_ref")

    return errors


@dataclass
class CapturingModelConfigWriter:
    records: list[ModelConfigRecord] = field(default_factory=list)

    def upsert_model_config(self, record: ModelConfigRecord) -> ModelConfigRecord:
        self.records.append(record)
        return record


@dataclass
class CapturingAuditEventWriter:
    records: list[AuditEventRecord] = field(default_factory=list)

    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        self.records.append(record)
        return record


def _check_behavior() -> list[str]:
    errors: list[str] = []
    model_writer = CapturingModelConfigWriter()
    audit_writer = CapturingAuditEventWriter()
    service = PlatformModelConfigService(
        model_config_writer=model_writer,
        audit_event_writer=audit_writer,
        now=lambda: "2026-01-01T00:00:00+00:00",
    )

    payload = service.upsert_model_config_from_api(
        ModelConfigApiCommandInput(
            id="model-config-chat-primary",
            tenant_id="acme",
            name="Primary Chat",
            provider="openai",
            model="gpt-4.1",
            purpose="chat",
            status="active",
            config_ref=SECRET_CONFIG_REF,
            actor_user_id="acme_admin",
        ),
    )

    if len(model_writer.records) != 1:
        errors.append("API boundary must write exactly one model config")
    elif model_writer.records[0].config_ref != SECRET_CONFIG_REF:
        errors.append("API boundary must pass config_ref to the service write command")

    if len(audit_writer.records) != 1:
        errors.append("API boundary must preserve audited service behavior")

    if payload.get("config_ref_configured") is not True:
        errors.append("API response must include config_ref_configured=true")
    if "config_ref" in payload:
        errors.append("API response must not include config_ref")
    if SECRET_CONFIG_REF in str(payload):
        errors.append("API response must not expose the config_ref secret reference")

    return errors


def main() -> int:
    errors = [*_check_static_contract(), *_check_behavior()]

    print("Phase 2 PostgreSQL model config API command boundary gate")
    print("- API input: ModelConfigApiCommandInput")
    print("- service method: PlatformModelConfigService.upsert_model_config_from_api")
    print("- internal command: ModelConfigWriteCommand")
    print("- API response: config_ref_configured only")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: PostgreSQL model config API boundary is command-based and secret-safe.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
