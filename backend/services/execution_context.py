"""Trusted enterprise execution contexts passed to AgentScope."""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from backend.persistence.database import (
    PostgresDatabase,
    SQLiteDatabase,
    create_database,
)
from backend.persistence.database_urls import is_postgres_database_url
from backend.services.authorization import AuthorizationService
from backend.services.enterprise_identity import (
    EnterpriseIdentityError,
    EnterpriseIdentityService,
)


class ExecutionContextError(ValueError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


@dataclass(frozen=True)
class TrustedExecutionContext:
    request_id: str
    tenant_id: str
    subject_id: str
    membership_id: str
    organization_unit_ids: list[str]
    primary_department_id: str | None
    manager_id: str | None
    role_ids: list[str]
    permission_codes: list[str]
    resource_grants: list[str]
    data_scope: str
    authentication_method: str
    policy_version: str
    issued_at: str
    expires_at: str
    authorization_decision_id: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ExecutionContextService:
    """Build contexts solely from authenticated identity and persisted policy."""

    def __init__(
        self,
        database: SQLiteDatabase | PostgresDatabase,
        *,
        ttl_seconds: int = 300,
    ) -> None:
        self.database = database
        self.identity = EnterpriseIdentityService(database)
        self.authorization = AuthorizationService(database)
        self.ttl_seconds = ttl_seconds

    @property
    def _sqlite(self) -> bool:
        return not is_postgres_database_url(self.database.database_url)

    def _sql(self, value: str) -> str:
        return value if self._sqlite else value.replace("?", "%s")

    @staticmethod
    def _loads(value: Any, fallback: Any) -> Any:
        if isinstance(value, (list, dict)):
            return value
        try:
            return json.loads(value or "")
        except (TypeError, ValueError):
            return fallback

    def build(
        self,
        *,
        request_id: str,
        tenant_id: str,
        subject_id: str,
        agent_id: str,
        authentication_method: str,
    ) -> TrustedExecutionContext:
        try:
            membership = self.identity.require_active_subject(tenant_id, subject_id)
        except EnterpriseIdentityError as exc:
            raise ExecutionContextError(exc.status_code, exc.detail) from exc
        decision = self.authorization.authorize(
            tenant_id=tenant_id,
            subject_id=subject_id,
            action="agent.invoke",
            resource={"type": "agent", "id": agent_id},
            environment={
                "request_id": request_id,
                "authentication_method": authentication_method,
            },
        )
        if not decision["allowed"]:
            raise ExecutionContextError(
                403,
                f"agent invocation denied: {decision['reason_code']}",
            )
        with self.database.connect() as connection:
            assignment_rows = connection.execute(
                self._sql(
                    """SELECT organization_unit_id, assignment_type
                       FROM member_org_assignments
                       WHERE tenant_id=? AND membership_id=? AND status='active'"""
                ),
                (tenant_id, membership["id"]),
            ).fetchall()
            assignments = [dict(row) for row in assignment_rows]
            unit_ids = sorted({row["organization_unit_id"] for row in assignments})
            selectors = [("user", subject_id), ("membership", membership["id"])]
            selectors.extend(("organization_unit", unit_id) for unit_id in unit_ids)
            bindings: list[dict[str, Any]] = []
            for subject_type, selector_id in selectors:
                rows = connection.execute(
                    self._sql(
                        """SELECT DISTINCT roles.id AS role_id,
                                  permissions.code AS permission_code
                           FROM role_bindings
                           JOIN roles ON roles.id=role_bindings.role_id
                           LEFT JOIN role_permissions
                             ON role_permissions.role_id=roles.id
                           LEFT JOIN permissions
                             ON permissions.id=role_permissions.permission_id
                           WHERE role_bindings.tenant_id=?
                             AND role_bindings.subject_type=?
                             AND role_bindings.subject_id=?
                             AND role_bindings.status='active'
                             AND roles.status='active'"""
                    ),
                    (tenant_id, subject_type, selector_id),
                ).fetchall()
                bindings.extend(dict(row) for row in rows)
            manager = connection.execute(
                self._sql(
                    """SELECT manager_membership.user_id AS manager_id
                       FROM member_manager_relations AS relation
                       JOIN memberships AS manager_membership
                         ON manager_membership.id=relation.manager_membership_id
                        AND manager_membership.tenant_id=relation.tenant_id
                       JOIN users AS manager_user
                         ON manager_user.id=manager_membership.user_id
                       WHERE relation.tenant_id=? AND relation.membership_id=?
                         AND relation.status='active'
                         AND manager_membership.status='active'
                         AND manager_user.status='active'"""
                ),
                (tenant_id, membership["id"]),
            ).fetchone()
        issued = datetime.now(UTC)
        primary = next(
            (
                row["organization_unit_id"]
                for row in assignments
                if row["assignment_type"] == "primary"
            ),
            None,
        )
        manager_id = dict(manager)["manager_id"] if manager is not None else None
        return TrustedExecutionContext(
            request_id=request_id, tenant_id=tenant_id, subject_id=subject_id,
            membership_id=membership["id"],
            organization_unit_ids=unit_ids,
            primary_department_id=primary, manager_id=manager_id,
            role_ids=sorted({row["role_id"] for row in bindings}),
            permission_codes=sorted(
                {
                    row["permission_code"]
                    for row in bindings
                    if row.get("permission_code")
                }
            ),
            resource_grants=list(decision["matched_resource_grants"]),
            data_scope=decision["effective_scope"],
            authentication_method=authentication_method,
            policy_version=decision["policy_version"],
            issued_at=issued.isoformat(),
            expires_at=(issued + timedelta(seconds=self.ttl_seconds)).isoformat(),
            authorization_decision_id=decision["decision_id"],
        )


def build_execution_context_service() -> ExecutionContextService | None:
    url = os.getenv("AGENTFOUNDRY_DATABASE_URL", "").strip()
    return ExecutionContextService(create_database(url)) if url else None
