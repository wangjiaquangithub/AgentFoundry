# -*- coding: utf-8 -*-
"""Enterprise system connectors for the knowledge assistant example."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import quote

import httpx


DEFAULT_TENANT = "default"

TENANT_DATA: dict[str, dict[str, Any]] = {
    "acme": {
        "policies": {
            "remote": (
                "Acme engineering may work remotely up to three days per "
                "week. Wednesday is the shared office day."
            ),
            "expense": (
                "Acme employees can reimburse approved home-office equipment "
                "up to USD 1,500 within 90 days of onboarding."
            ),
            "security": (
                "Production data access requires manager approval, MFA, and "
                "an audit ticket linked to the incident or project."
            ),
        },
        "tickets": {
            "INC-1001": {
                "status": "investigating",
                "owner": "platform-oncall",
                "summary": "Intermittent latency on the billing API.",
            },
            "REQ-2048": {
                "status": "waiting_for_approval",
                "owner": "finance-ops",
                "summary": "Quarterly SaaS renewal approval.",
            },
        },
        "metrics": {
            "engineering": {
                "active_projects": 12,
                "open_incidents": 1,
                "sla": "99.94%",
            },
            "support": {
                "active_projects": 4,
                "open_incidents": 0,
                "sla": "98.70%",
            },
        },
    },
    "globex": {
        "policies": {
            "remote": (
                "Globex staff use a hybrid schedule. Department heads define "
                "office days and exceptions."
            ),
            "expense": (
                "Globex equipment purchases above USD 500 require procurement "
                "pre-approval."
            ),
            "security": (
                "Customer exports require a data-processing ticket and "
                "security review before release."
            ),
        },
        "tickets": {
            "CASE-7788": {
                "status": "resolved",
                "owner": "customer-success",
                "summary": "Escalated enterprise onboarding question.",
            },
        },
        "metrics": {
            "sales": {
                "active_projects": 7,
                "open_incidents": 0,
                "sla": "99.10%",
            },
            "support": {
                "active_projects": 9,
                "open_incidents": 2,
                "sla": "97.85%",
            },
        },
    },
    DEFAULT_TENANT: {
        "policies": {
            "remote": "Default tenant remote-work policy is not configured.",
            "expense": "Default tenant expense policy is not configured.",
            "security": "Default tenant security policy is not configured.",
        },
        "tickets": {},
        "metrics": {},
    },
}


def _load_tenant_data(path: str) -> dict[str, dict[str, Any]]:
    """Load tenant fixture data from a JSON file."""
    source = Path(path).expanduser()
    with source.open("r", encoding="utf-8") as file:
        raw_data = json.load(file)

    if not isinstance(raw_data, dict):
        raise ValueError("Enterprise fixture data must be a JSON object.")

    raw_tenants = raw_data.get("tenants", raw_data)
    if not isinstance(raw_tenants, dict):
        raise ValueError("Enterprise fixture data 'tenants' must be an object.")

    tenant_data: dict[str, dict[str, Any]] = {}
    for tenant, data in raw_tenants.items():
        if not isinstance(tenant, str) or not isinstance(data, dict):
            raise ValueError("Each tenant fixture entry must be an object.")

        tenant_data[tenant] = {
            "policies": _fixture_section(data, tenant, "policies"),
            "tickets": _fixture_section(data, tenant, "tickets"),
            "metrics": _fixture_section(data, tenant, "metrics"),
        }

    if DEFAULT_TENANT not in tenant_data:
        tenant_data[DEFAULT_TENANT] = TENANT_DATA[DEFAULT_TENANT]

    return tenant_data


def _fixture_section(
    tenant_data: dict[str, Any],
    tenant: str,
    section: str,
) -> dict[str, Any]:
    """Read a required fixture section and fail early on malformed data."""
    value = tenant_data.get(section, {})
    if not isinstance(value, dict):
        raise ValueError(
            f"Tenant {tenant!r} fixture section {section!r} must be an object.",
        )
    return value


class EnterpriseConnector(Protocol):
    """Tenant-aware business data source used by enterprise tools."""

    name: str

    def list_demo_identities(self) -> list[dict[str, Any]]:
        """Return demo identities that the platform console can switch between."""

    def describe_tenant_workspace(self, tenant: str) -> dict[str, Any]:
        """Return a safe, frontend-friendly overview of tenant data."""

    def tenant_for_user(self, user_id: str) -> str:
        """Resolve the tenant id visible to the current user."""

    def lookup_policy(self, tenant: str, keyword: str) -> dict[str, Any]:
        """Look up policy snippets for a tenant."""

    def get_ticket_status(self, tenant: str, ticket_id: str) -> dict[str, Any]:
        """Look up a tenant-scoped ticket."""

    def summarize_department_metrics(
        self,
        tenant: str,
        department: str,
    ) -> dict[str, Any]:
        """Read tenant-scoped department metrics."""


def _tenant_from_user_id(user_id: str) -> str:
    if ":" not in user_id:
        return DEFAULT_TENANT
    tenant, _user = user_id.split(":", 1)
    return tenant.strip() or DEFAULT_TENANT


def _preview_text(value: Any, limit: int = 140) -> str:
    text = str(value).strip()
    if len(text) <= limit:
        return text
    return f"{text[: limit - 3]}..."


def _sample_questions_for_tenant(
    tenant: str,
    tenant_data: dict[str, Any],
) -> list[str]:
    samples: list[str] = []
    tickets = tenant_data.get("tickets", {})
    policies = tenant_data.get("policies", {})
    metrics = tenant_data.get("metrics", {})

    if isinstance(tickets, dict) and tickets:
        ticket_id = sorted(str(key) for key in tickets)[0]
        samples.append(f"帮我查一下 {ticket_id} 的工单状态。")

    if isinstance(policies, dict) and policies:
        policy_key = "remote" if "remote" in policies else sorted(str(key) for key in policies)[0]
        samples.append(f"{tenant} 的 {policy_key} 制度是什么？")

    if isinstance(metrics, dict) and metrics:
        department = sorted(str(key) for key in metrics)[0]
        samples.append(f"总结一下 {department} 部门指标。")

    if not samples:
        samples.append("这个租户现在配置了哪些企业数据？")

    return samples


class MockEnterpriseConnector:
    """In-memory enterprise connector for local development and demos."""

    name = "mock"

    def __init__(self, tenant_data: dict[str, dict[str, Any]] | None = None):
        self._tenant_data = tenant_data or TENANT_DATA

    def list_demo_identities(self) -> list[dict[str, Any]]:
        known_identities = {
            "acme": {
                "user_id": "acme:alice",
                "display_name": "Alice Chen",
                "role": "Acme engineering employee",
            },
            "globex": {
                "user_id": "globex:bob",
                "display_name": "Bob Li",
                "role": "Globex customer success employee",
            },
            DEFAULT_TENANT: {
                "user_id": "default:user",
                "display_name": "Default User",
                "role": "Fallback tenant user",
            },
        }

        identities: list[dict[str, Any]] = []
        for tenant, tenant_data in self._tenant_data.items():
            defaults = known_identities.get(
                tenant,
                {
                    "user_id": f"{tenant}:demo",
                    "display_name": f"{tenant} demo user",
                    "role": "Tenant demo user",
                },
            )
            identities.append(
                {
                    **defaults,
                    "tenant": tenant,
                    "sample_questions": _sample_questions_for_tenant(
                        tenant,
                        tenant_data,
                    ),
                },
            )

        return identities

    def describe_tenant_workspace(self, tenant: str) -> dict[str, Any]:
        resolved_tenant = tenant if tenant in self._tenant_data else DEFAULT_TENANT
        tenant_data = self._data_for_tenant(resolved_tenant)
        policies = tenant_data.get("policies", {})
        tickets = tenant_data.get("tickets", {})
        metrics = tenant_data.get("metrics", {})

        return {
            "tenant": resolved_tenant,
            "source": self.name,
            "policies": [
                {
                    "key": str(key),
                    "preview": _preview_text(value),
                }
                for key, value in sorted(policies.items())
            ],
            "tickets": [
                {
                    "id": str(ticket_id),
                    "status": value.get("status") if isinstance(value, dict) else None,
                    "owner": value.get("owner") if isinstance(value, dict) else None,
                    "summary": (
                        value.get("summary")
                        if isinstance(value, dict)
                        else _preview_text(value)
                    ),
                }
                for ticket_id, value in sorted(tickets.items())
            ],
            "departments": [
                {
                    "name": str(department),
                    "metrics": value if isinstance(value, dict) else {"value": value},
                }
                for department, value in sorted(metrics.items())
            ],
            "sample_questions": _sample_questions_for_tenant(
                resolved_tenant,
                tenant_data,
            ),
        }

    def tenant_for_user(self, user_id: str) -> str:
        tenant = _tenant_from_user_id(user_id)
        if tenant not in self._tenant_data:
            return DEFAULT_TENANT
        return tenant

    def _data_for_tenant(self, tenant: str) -> dict[str, Any]:
        return self._tenant_data.get(tenant, self._tenant_data[DEFAULT_TENANT])

    def lookup_policy(self, tenant: str, keyword: str) -> dict[str, Any]:
        normalized = keyword.lower().strip()
        policies: dict[str, str] = self._data_for_tenant(tenant)["policies"]
        matches = {
            name: text
            for name, text in policies.items()
            if normalized in name.lower() or normalized in text.lower()
        }
        return {
            "source": self.name,
            "tenant": tenant,
            "keyword": keyword,
            "matches": matches,
            "available_policy_keys": sorted(policies),
        }

    def get_ticket_status(self, tenant: str, ticket_id: str) -> dict[str, Any]:
        normalized = ticket_id.strip().upper()
        ticket = self._data_for_tenant(tenant)["tickets"].get(normalized)
        return {
            "source": self.name,
            "tenant": tenant,
            "ticket_id": normalized,
            "ticket": ticket,
            "found": ticket is not None,
        }

    def summarize_department_metrics(
        self,
        tenant: str,
        department: str,
    ) -> dict[str, Any]:
        normalized = department.lower().strip()
        metrics: dict[str, Any] = self._data_for_tenant(tenant)["metrics"]
        department_metrics = metrics.get(normalized)
        return {
            "source": self.name,
            "tenant": tenant,
            "department": normalized,
            "metrics": department_metrics,
            "found": department_metrics is not None,
            "available_departments": sorted(metrics),
        }


@dataclass(frozen=True)
class HttpEnterpriseConnector:
    """HTTP adapter for an internal enterprise gateway."""

    base_url: str
    token: str | None = None
    timeout_seconds: float = 5.0
    policy_path: str = "/tenants/{tenant}/policies/search"
    ticket_path: str = "/tenants/{tenant}/tickets/{ticket_id}"
    metrics_path: str = "/tenants/{tenant}/departments/{department}/metrics"

    name = "http"

    def list_demo_identities(self) -> list[dict[str, Any]]:
        user_ids = [
            item.strip()
            for item in os.getenv(
                "ENTERPRISE_DEMO_USERS",
                "acme:alice,globex:bob",
            ).split(",")
            if item.strip()
        ]
        return [
            {
                "user_id": user_id,
                "tenant": self.tenant_for_user(user_id),
                "display_name": user_id,
                "role": "Enterprise API user",
                "sample_questions": [
                    "帮我查一下 INC-1001 的工单状态。",
                    "远程办公制度是什么？",
                    "总结一下 support 部门指标。",
                ],
            }
            for user_id in user_ids
        ]

    def describe_tenant_workspace(self, tenant: str) -> dict[str, Any]:
        return {
            "tenant": tenant,
            "source": self.name,
            "policies": [],
            "tickets": [],
            "departments": [],
            "sample_questions": [
                "帮我查一下 INC-1001 的工单状态。",
                "远程办公制度是什么？",
                "总结一下 support 部门指标。",
            ],
            "note": (
                "HTTP connector workspace metadata is supplied by your "
                "enterprise gateway; configure ENTERPRISE_DEMO_USERS for "
                "console identities."
            ),
        }

    def tenant_for_user(self, user_id: str) -> str:
        return _tenant_from_user_id(user_id)

    def lookup_policy(self, tenant: str, keyword: str) -> dict[str, Any]:
        payload = self._request_json(
            self.policy_path,
            tenant=tenant,
            params={"keyword": keyword},
        )
        matches = payload.get("matches", payload.get("policies", {}))
        available_keys = payload.get("available_policy_keys")
        if available_keys is None and isinstance(matches, dict):
            available_keys = sorted(str(key) for key in matches)
        return {
            "source": self.name,
            "tenant": tenant,
            "keyword": keyword,
            "matches": matches,
            "available_policy_keys": available_keys or [],
            "raw_response": payload,
        }

    def get_ticket_status(self, tenant: str, ticket_id: str) -> dict[str, Any]:
        normalized = ticket_id.strip().upper()
        payload = self._request_json(
            self.ticket_path,
            tenant=tenant,
            ticket_id=normalized,
            allow_not_found=True,
        )
        if payload is None:
            return {
                "source": self.name,
                "tenant": tenant,
                "ticket_id": normalized,
                "ticket": None,
                "found": False,
            }
        ticket = payload.get("ticket", payload)
        return {
            "source": self.name,
            "tenant": tenant,
            "ticket_id": normalized,
            "ticket": ticket,
            "found": bool(payload.get("found", ticket)),
            "raw_response": payload,
        }

    def summarize_department_metrics(
        self,
        tenant: str,
        department: str,
    ) -> dict[str, Any]:
        normalized = department.lower().strip()
        payload = self._request_json(
            self.metrics_path,
            tenant=tenant,
            department=normalized,
            allow_not_found=True,
        )
        if payload is None:
            return {
                "source": self.name,
                "tenant": tenant,
                "department": normalized,
                "metrics": None,
                "found": False,
                "available_departments": [],
            }
        metrics = payload.get("metrics", payload)
        return {
            "source": self.name,
            "tenant": tenant,
            "department": normalized,
            "metrics": metrics,
            "found": bool(payload.get("found", metrics)),
            "available_departments": payload.get("available_departments", []),
            "raw_response": payload,
        }

    def _request_json(
        self,
        path_template: str,
        *,
        allow_not_found: bool = False,
        params: dict[str, str] | None = None,
        **path_values: str,
    ) -> dict[str, Any] | None:
        path = self._format_path(path_template, path_values)
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        try:
            with httpx.Client(
                base_url=self.base_url,
                timeout=self.timeout_seconds,
                headers=headers,
            ) as client:
                response = client.get(path, params=params)
                if allow_not_found and response.status_code == 404:
                    return None
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:500]
            raise RuntimeError(
                f"Enterprise API returned HTTP {exc.response.status_code} "
                f"for {path}: {detail}",
            ) from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(
                f"Enterprise API request failed for {path}: {exc}",
            ) from exc

        try:
            data = response.json()
        except ValueError:
            data = {"body": response.text}

        if isinstance(data, dict):
            return data
        return {"result": data}

    @staticmethod
    def _format_path(path_template: str, values: dict[str, str]) -> str:
        encoded_values = {
            key: quote(str(value), safe="")
            for key, value in values.items()
        }
        path = path_template.format(**encoded_values)
        if not path.startswith("/"):
            path = f"/{path}"
        return path


def build_enterprise_connector() -> EnterpriseConnector:
    """Build the configured enterprise connector."""
    connector_type = os.getenv("ENTERPRISE_CONNECTOR", "mock").lower().strip()
    if connector_type in {"mock", "fixture", "fixtures"}:
        fixture_path = (
            os.getenv("ENTERPRISE_FIXTURE_PATH")
            or os.getenv("ENTERPRISE_MOCK_DATA_PATH")
        )
        if fixture_path:
            return MockEnterpriseConnector(_load_tenant_data(fixture_path))
        return MockEnterpriseConnector()

    if connector_type == "http":
        base_url = os.getenv("ENTERPRISE_API_BASE_URL", "").strip()
        if not base_url:
            raise ValueError(
                "ENTERPRISE_API_BASE_URL is required when "
                "ENTERPRISE_CONNECTOR=http.",
            )

        timeout = float(os.getenv("ENTERPRISE_API_TIMEOUT_SECONDS", "5"))
        return HttpEnterpriseConnector(
            base_url=base_url.rstrip("/"),
            token=os.getenv("ENTERPRISE_API_TOKEN") or None,
            timeout_seconds=timeout,
            policy_path=os.getenv(
                "ENTERPRISE_POLICY_PATH",
                HttpEnterpriseConnector.policy_path,
            ),
            ticket_path=os.getenv(
                "ENTERPRISE_TICKET_PATH",
                HttpEnterpriseConnector.ticket_path,
            ),
            metrics_path=os.getenv(
                "ENTERPRISE_METRICS_PATH",
                HttpEnterpriseConnector.metrics_path,
            ),
        )

    raise ValueError(
        "Unsupported ENTERPRISE_CONNECTOR value "
        f"{connector_type!r}. Use 'mock' or 'http'.",
    )
