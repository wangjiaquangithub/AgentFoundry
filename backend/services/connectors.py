"""Service-layer orchestration for enterprise connector configuration."""

import json
from collections.abc import Mapping
from datetime import datetime, timezone
from time import perf_counter
from typing import Any, Callable

from connectors import EnterpriseConnector, HttpEnterpriseConnector
from repositories.connectors import (
    ConnectorConfigRegistryError,
    ConnectorConfigRepository,
)


class PlatformConnectorConfigServiceError(ValueError):
    """Raised when a connector configuration operation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class PlatformConnectorConfigService:
    """Manage tenant-scoped enterprise connector configuration records."""

    def __init__(
        self,
        *,
        repository: ConnectorConfigRepository,
        global_connector: EnterpriseConnector,
        tenant_hint_from_user_id: Callable[[str], str | None],
        preview_result: Callable[[Any], str] | None = None,
        now: Callable[[], str] | None = None,
    ) -> None:
        self._repository = repository
        self._global_connector = global_connector
        self._tenant_hint_from_user_id = tenant_hint_from_user_id
        self._preview_result = preview_result or _preview_connector_result
        self._now = now or _utc_now_iso

    def supported_connectors(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "mock",
                "mode": "local",
                "description": "Built-in tenant fixture data for local demos.",
                "env_vars": ["ENTERPRISE_CONNECTOR"],
            },
            {
                "name": "fixture",
                "mode": "local",
                "description": "Load tenant fixture data from a JSON file.",
                "env_vars": [
                    "ENTERPRISE_CONNECTOR",
                    "ENTERPRISE_FIXTURE_PATH",
                    "ENTERPRISE_MOCK_DATA_PATH",
                ],
            },
            {
                "name": "http",
                "mode": "remote",
                "description": (
                    "Read tenant-scoped business data from an enterprise HTTP API."
                ),
                "env_vars": [
                    "ENTERPRISE_CONNECTOR",
                    "ENTERPRISE_API_BASE_URL",
                    "ENTERPRISE_API_TOKEN",
                    "ENTERPRISE_POLICY_PATH",
                    "ENTERPRISE_TICKET_PATH",
                    "ENTERPRISE_METRICS_PATH",
                ],
                "paths": {
                    "policy": "/tenants/{tenant}/policies/search",
                    "ticket": "/tenants/{tenant}/tickets/{ticket_id}",
                    "metrics": "/tenants/{tenant}/departments/{department}/metrics",
                },
            },
        ]

    def env_metadata(
        self,
        *,
        connector_mode: str,
        env: Mapping[str, str],
    ) -> list[dict[str, Any]]:
        return [
            {
                "name": "ENTERPRISE_CONNECTOR",
                "configured": self._env_configured(env, "ENTERPRISE_CONNECTOR"),
                "required": False,
                "description": "Connector mode: mock, fixture, or http.",
            },
            {
                "name": "ENTERPRISE_API_BASE_URL",
                "configured": self._env_configured(env, "ENTERPRISE_API_BASE_URL"),
                "required": connector_mode == "http",
                "description": "Base URL for the enterprise HTTP data API.",
            },
            {
                "name": "ENTERPRISE_API_TOKEN",
                "configured": self._env_configured(env, "ENTERPRISE_API_TOKEN"),
                "required": False,
                "secret": True,
                "description": "Bearer token for the enterprise HTTP API.",
            },
            {
                "name": "ENTERPRISE_FIXTURE_PATH",
                "configured": self._env_configured(env, "ENTERPRISE_FIXTURE_PATH")
                or self._env_configured(env, "ENTERPRISE_MOCK_DATA_PATH"),
                "required": False,
                "description": "Local JSON fixture path for mock/fixture connector data.",
            },
            {
                "name": "ENTERPRISE_POLICY_PATH",
                "configured": self._env_configured(env, "ENTERPRISE_POLICY_PATH"),
                "required": False,
                "description": "HTTP path template for tenant policy search.",
            },
            {
                "name": "ENTERPRISE_TICKET_PATH",
                "configured": self._env_configured(env, "ENTERPRISE_TICKET_PATH"),
                "required": False,
                "description": "HTTP path template for tenant ticket lookup.",
            },
            {
                "name": "ENTERPRISE_METRICS_PATH",
                "configured": self._env_configured(env, "ENTERPRISE_METRICS_PATH"),
                "required": False,
                "description": "HTTP path template for tenant department metrics.",
            },
        ]

    def health_metadata(
        self,
        *,
        connector_name: str,
        connector_mode: str,
        env_metadata: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if connector_name == "http":
            missing = [
                item["name"]
                for item in env_metadata
                if item.get("required") and not item.get("configured")
            ]
            return {
                "name": connector_name,
                "mode": connector_mode,
                "status": "error" if missing else "ready",
                "message": (
                    f"Missing required configuration: {', '.join(missing)}"
                    if missing
                    else "HTTP enterprise connector is configured."
                ),
            }

        if connector_name == "mock":
            return {
                "name": connector_name,
                "mode": connector_mode,
                "status": "ready",
                "message": "Using local tenant fixture data.",
            }

        return {
            "name": connector_name,
            "mode": connector_mode,
            "status": "partial",
            "message": (
                "Connector metadata is available; verify runtime data access with a "
                "tool call."
            ),
        }

    def health_response(
        self,
        *,
        connector_name: str,
        connector_mode: str,
        env: Mapping[str, str],
    ) -> dict[str, Any]:
        env_metadata = self.env_metadata(
            connector_mode=connector_mode,
            env=env,
        )
        return self.health_metadata(
            connector_name=connector_name,
            connector_mode=connector_mode,
            env_metadata=env_metadata,
        )

    def tenant_workspaces(
        self,
        *,
        identities: list[dict[str, Any]],
        current_tenant: str,
        runtime_connector_for_tenant: Callable[[str], tuple[EnterpriseConnector, str]],
    ) -> dict[str, Any]:
        tenants = {current_tenant}
        tenants.update(
            str(identity.get("tenant"))
            for identity in identities
            if identity.get("tenant")
        )
        workspaces: dict[str, Any] = {}
        for tenant in sorted(tenants):
            connector, source = runtime_connector_for_tenant(tenant)
            workspace = connector.describe_tenant_workspace(tenant)
            workspace["runtime_connector_source"] = source
            workspaces[tenant] = workspace
        return workspaces

    def list_configs(self) -> dict[str, dict[str, Any]]:
        try:
            return self._repository.list_by_tenant()
        except ConnectorConfigRegistryError as exc:
            raise PlatformConnectorConfigServiceError(500, str(exc)) from exc

    def save_configs(self, configs: dict[str, dict[str, Any]]) -> None:
        self._repository.save_all(configs)

    def redact_config(self, config: dict[str, Any]) -> dict[str, Any]:
        return {
            "tenant": str(config.get("tenant") or ""),
            "base_url": str(config.get("base_url") or ""),
            "policy_path": str(
                config.get("policy_path") or HttpEnterpriseConnector.policy_path,
            ),
            "ticket_path": str(
                config.get("ticket_path") or HttpEnterpriseConnector.ticket_path,
            ),
            "metrics_path": str(
                config.get("metrics_path") or HttpEnterpriseConnector.metrics_path,
            ),
            "timeout_seconds": float(config.get("timeout_seconds") or 5.0),
            "enabled": bool(config.get("enabled", True)),
            "token_configured": bool(str(config.get("token") or "").strip()),
            "updated_at": str(config.get("updated_at") or ""),
            "updated_by": str(config.get("updated_by") or ""),
        }

    def redacted_configs(self) -> list[dict[str, Any]]:
        return [
            self.redact_config(config)
            for _tenant, config in sorted(self.list_configs().items())
        ]

    def export_configs_payload(self) -> list[dict[str, Any]]:
        return self.redacted_configs()

    def export_config_counts(self, config: dict[str, Any]) -> dict[str, int]:
        tool_policy = config.get("tool_policy") if isinstance(config, dict) else {}
        tenants = tool_policy.get("tenants", {}) if isinstance(tool_policy, dict) else {}
        tenant_count = len(tenants) if isinstance(tenants, dict) else 0
        user_policy_count = 0
        if isinstance(tenants, dict):
            for tenant_policy in tenants.values():
                if isinstance(tenant_policy, dict) and isinstance(
                    tenant_policy.get("users"),
                    dict,
                ):
                    user_policy_count += len(tenant_policy["users"])

        return {
            "members": len(config.get("members") or []),
            "connector_configs": len(config.get("connector_configs") or []),
            "agents": len(config.get("agents") or []),
            "workflow_templates": len(config.get("workflow_templates") or []),
            "tool_policy_tenants": tenant_count,
            "tool_policy_users": user_policy_count,
        }

    def export_config_response(
        self,
        *,
        config: dict[str, Any],
        platform_version: str,
        exported_at: str,
        file_paths: dict[str, str],
    ) -> dict[str, Any]:
        counts = self.export_config_counts(config)
        return {
            "schema_version": 1,
            "platform_version": platform_version,
            "exported_at": exported_at,
            "redacted": True,
            "files": {
                "members": {
                    "path": file_paths["members"],
                    "count": counts["members"],
                },
                "connector_configs": {
                    "path": file_paths["connector_configs"],
                    "count": counts["connector_configs"],
                },
                "agents": {
                    "path": file_paths["agents"],
                    "count": counts["agents"],
                },
                "workflow_templates": {
                    "path": file_paths["workflow_templates"],
                    "count": counts["workflow_templates"],
                },
                "tool_policy": {
                    "path": file_paths["tool_policy"],
                    "tenant_count": counts["tool_policy_tenants"],
                    "user_policy_count": counts["tool_policy_users"],
                },
            },
            "counts": counts,
            "config": config,
        }

    def normalize_config_import_request(self, payload: Any) -> tuple[str, dict[str, Any]]:
        mode = payload.mode.strip().lower()
        if mode not in {"merge", "replace"}:
            raise PlatformConnectorConfigServiceError(
                400,
                "mode must be merge or replace.",
            )

        incoming = payload.config.get("config", payload.config)
        if not isinstance(incoming, dict):
            raise PlatformConnectorConfigServiceError(
                400,
                "config must be a JSON object.",
            )
        return mode, incoming

    def import_config_response(
        self,
        *,
        mode: str,
        exported_config: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "imported": True,
            "mode": mode,
            "counts": exported_config["counts"],
            "config": exported_config,
        }

    def list_configs_response(self) -> dict[str, Any]:
        return {"saved_configs": self.redacted_configs()}

    def metadata_response(
        self,
        *,
        runtime: dict[str, Any],
        connector_name: str,
        connector_mode: str,
        env: Mapping[str, str],
    ) -> dict[str, Any]:
        env_metadata = self.env_metadata(
            connector_mode=connector_mode,
            env=env,
        )
        return {
            "current": self.health_metadata(
                connector_name=connector_name,
                connector_mode=connector_mode,
                env_metadata=env_metadata,
            ),
            "runtime": {
                "tenant": str(runtime["tenant"]),
                "connector": runtime["connector_label"],
                "source": runtime["connector_source"],
                "saved_config_enabled": runtime["saved_config_enabled"],
            },
            "supported": self.supported_connectors(),
            "env": env_metadata,
            "http_paths": {
                "policy": self._env_value(
                    env,
                    "ENTERPRISE_POLICY_PATH",
                    "/tenants/{tenant}/policies/search",
                ),
                "ticket": self._env_value(
                    env,
                    "ENTERPRISE_TICKET_PATH",
                    "/tenants/{tenant}/tickets/{ticket_id}",
                ),
                "metrics": self._env_value(
                    env,
                    "ENTERPRISE_METRICS_PATH",
                    "/tenants/{tenant}/departments/{department}/metrics",
                ),
            },
            "saved_configs": self.redacted_configs(),
        }

    def _env_configured(self, env: Mapping[str, str], name: str) -> bool:
        return bool(env.get(name, "").strip())

    def _env_value(self, env: Mapping[str, str], name: str, default: str) -> str:
        return env.get(name, default)

    def runtime_tenant_for_user(self, user_id: str) -> str:
        hinted_tenant = self._tenant_hint_from_user_id(user_id)
        if hinted_tenant:
            hinted_config = self.list_configs().get(hinted_tenant)
            if hinted_config and bool(hinted_config.get("enabled", True)):
                return hinted_tenant
        return self._global_connector.tenant_for_user(user_id)

    def configured_tenant_for_user(self, user_id: str) -> str:
        hinted_tenant = self._tenant_hint_from_user_id(user_id)
        if hinted_tenant and hinted_tenant in self.list_configs():
            return hinted_tenant
        return self._global_connector.tenant_for_user(user_id)

    def connector_config_for_tenant(self, tenant: str) -> dict[str, Any] | None:
        config = self.list_configs().get(tenant)
        if not config or not bool(config.get("enabled", True)):
            return None
        if not str(config.get("base_url") or "").strip():
            return None
        return config

    def connector_from_saved_config(
        self,
        config: dict[str, Any],
    ) -> HttpEnterpriseConnector:
        return HttpEnterpriseConnector(
            base_url=str(config.get("base_url") or "").strip().rstrip("/"),
            token=str(config.get("token") or "").strip() or None,
            timeout_seconds=float(config.get("timeout_seconds") or 5.0),
            policy_path=str(
                config.get("policy_path") or HttpEnterpriseConnector.policy_path,
            ),
            ticket_path=str(
                config.get("ticket_path") or HttpEnterpriseConnector.ticket_path,
            ),
            metrics_path=str(
                config.get("metrics_path") or HttpEnterpriseConnector.metrics_path,
            ),
        )

    def runtime_enterprise_connector_for_tenant(
        self,
        tenant: str,
    ) -> tuple[EnterpriseConnector, str]:
        config = self.connector_config_for_tenant(tenant)
        if config is not None:
            return self.connector_from_saved_config(config), "saved_config"
        return self._global_connector, "global"

    def enterprise_runtime_context(self, user_id: str) -> dict[str, Any]:
        tenant = self.runtime_tenant_for_user(user_id)
        connector, source = self.runtime_enterprise_connector_for_tenant(tenant)
        connector_label = (
            f"{connector.name}:saved_config"
            if source == "saved_config"
            else connector.name
        )
        return {
            "tenant": tenant,
            "connector": connector,
            "connector_source": source,
            "connector_label": connector_label,
            "saved_config_enabled": source == "saved_config",
        }

    def normalize_config_payload(
        self,
        payload: Any,
        *,
        user_id: str,
        existing_config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        base_url = payload.base_url.strip().rstrip("/")
        if not base_url:
            raise PlatformConnectorConfigServiceError(
                400,
                "Enterprise API URL is required.",
            )

        tenant = payload.tenant.strip() or self.configured_tenant_for_user(user_id)
        token = payload.token.strip() if payload.token and payload.token.strip() else None
        if token is None and existing_config is not None:
            saved_token = str(existing_config.get("token") or "").strip()
            token = saved_token or None

        return {
            "tenant": tenant,
            "base_url": base_url,
            "token": token,
            "policy_path": payload.policy_path.strip()
            or HttpEnterpriseConnector.policy_path,
            "ticket_path": payload.ticket_path.strip()
            or HttpEnterpriseConnector.ticket_path,
            "metrics_path": payload.metrics_path.strip()
            or HttpEnterpriseConnector.metrics_path,
            "timeout_seconds": payload.timeout_seconds,
            "enabled": payload.enabled,
            "updated_at": self._now(),
            "updated_by": user_id,
        }

    def save_config_payload(self, payload: Any, *, user_id: str) -> dict[str, Any]:
        configs = self.list_configs()
        tenant = payload.tenant.strip() or self.configured_tenant_for_user(user_id)
        config = self.normalize_config_payload(
            payload,
            user_id=user_id,
            existing_config=configs.get(tenant),
        )
        configs[config["tenant"]] = config
        self.save_configs(configs)
        return {
            "config": self.redact_config(config),
            "saved_configs": self.redacted_configs(),
        }

    def normalize_import_configs(
        self,
        value: Any,
        *,
        existing_configs: dict[str, dict[str, Any]],
        actor: str,
    ) -> list[dict[str, Any]]:
        if value is None:
            return []
        if isinstance(value, dict):
            raw_configs = [
                {**raw, "tenant": raw.get("tenant") or tenant}
                for tenant, raw in value.items()
                if isinstance(raw, dict)
            ]
        elif isinstance(value, list):
            raw_configs = [raw for raw in value if isinstance(raw, dict)]
        else:
            raise PlatformConnectorConfigServiceError(
                400,
                "connector_configs must be a JSON array or object.",
            )

        configs: list[dict[str, Any]] = []
        for raw in raw_configs:
            tenant = str(raw.get("tenant") or "").strip()
            base_url = str(raw.get("base_url") or "").strip().rstrip("/")
            if not tenant or not base_url:
                continue
            existing = existing_configs.get(tenant) or {}
            token = str(raw.get("token") or "").strip() or str(
                existing.get("token") or "",
            ).strip()
            configs.append(
                {
                    "tenant": tenant,
                    "base_url": base_url,
                    "token": token or None,
                    "policy_path": str(
                        raw.get("policy_path") or HttpEnterpriseConnector.policy_path,
                    ).strip(),
                    "ticket_path": str(
                        raw.get("ticket_path") or HttpEnterpriseConnector.ticket_path,
                    ).strip(),
                    "metrics_path": str(
                        raw.get("metrics_path") or HttpEnterpriseConnector.metrics_path,
                    ).strip(),
                    "timeout_seconds": float(raw.get("timeout_seconds") or 5.0),
                    "enabled": bool(raw.get("enabled", True)),
                    "updated_at": self._now(),
                    "updated_by": actor,
                },
            )
        return configs

    def import_configs_payload(self, value: Any, *, actor: str, mode: str) -> None:
        existing_configs = self.list_configs()
        imported_configs = self.normalize_import_configs(
            value,
            existing_configs=existing_configs,
            actor=actor,
        )
        if mode == "replace":
            configs = {config["tenant"]: config for config in imported_configs}
        else:
            configs = {
                **existing_configs,
                **{config["tenant"]: config for config in imported_configs},
            }
        self.save_configs(configs)

    def test_connector(self, payload: Any) -> dict[str, Any]:
        base_url = payload.base_url.strip().rstrip("/")
        if not base_url:
            raise PlatformConnectorConfigServiceError(
                400,
                "Enterprise API URL is required.",
            )

        saved_config = self.list_configs().get(payload.tenant.strip())
        token = payload.token.strip() if payload.token and payload.token.strip() else None
        if token is None and saved_config is not None:
            saved_token = str(saved_config.get("token") or "").strip()
            token = saved_token or None

        connector = HttpEnterpriseConnector(
            base_url=base_url,
            token=token,
            timeout_seconds=payload.timeout_seconds,
            policy_path=payload.policy_path,
            ticket_path=payload.ticket_path,
            metrics_path=payload.metrics_path,
        )
        checks = []
        test_cases = [
            (
                "policy",
                "Policy lookup",
                lambda: connector.lookup_policy(payload.tenant, payload.policy_keyword),
            ),
            (
                "ticket",
                "Ticket lookup",
                lambda: connector.get_ticket_status(payload.tenant, payload.ticket_id),
            ),
            (
                "metrics",
                "Department metrics",
                lambda: connector.summarize_department_metrics(
                    payload.tenant,
                    payload.department,
                ),
            ),
        ]

        for name, label, run_test in test_cases:
            started_at = perf_counter()
            try:
                result = run_test()
            except Exception as exc:  # pragma: no cover - depends on remote gateways
                checks.append(
                    {
                        "name": name,
                        "label": label,
                        "status": "error",
                        "latency_ms": round((perf_counter() - started_at) * 1000, 2),
                        "message": str(exc),
                        "preview": "",
                    },
                )
                continue

            checks.append(
                {
                    "name": name,
                    "label": label,
                    "status": "success",
                    "latency_ms": round((perf_counter() - started_at) * 1000, 2),
                    "message": "Connector request completed.",
                    "preview": self._preview_result(result),
                },
            )

        success_count = sum(1 for check in checks if check["status"] == "success")
        if success_count == len(checks):
            status = "success"
        elif success_count:
            status = "partial"
        else:
            status = "error"

        return {
            "status": status,
            "checks": checks,
        }


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _preview_connector_result(result: Any) -> str:
    return json.dumps(result, ensure_ascii=False, default=str)[:500]
