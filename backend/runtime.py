# -*- coding: utf-8 -*-
"""Runtime adapter boundary for AgentFoundry platform runs.

The platform should depend on this module instead of directly depending on a
specific Agent runtime implementation. AgentScope is the first provider behind
this boundary, not the platform itself.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


RUNTIME_PROVIDER_HEALTH_REQUIRED_FIELDS = frozenset(
    {
        "provider_id",
        "provider",
        "mode",
        "status",
        "ready",
        "message",
        "capabilities",
        "checks",
    },
)
RUNTIME_PROVIDER_HEALTH_REQUIRED_CHECKS = (
    "adapter_configured",
    "provider_invocation_wired",
    "direct_agentscope_dependency",
)


@dataclass(frozen=True)
class RuntimeCapability:
    """A provider-neutral runtime capability exposed to platform services."""

    id: str
    name: str
    description: str

    def to_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
        }


@dataclass(frozen=True)
class RuntimeContext:
    """Tenant and user context supplied by AgentFoundry."""

    tenant: str
    user_id: str
    session_id: str
    agent_id: str
    agent_name: str | None = None
    metadata: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "tenant": self.tenant,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "metadata": self.metadata or {},
        }


@dataclass(frozen=True)
class RuntimeInvocationRequest:
    """Provider-neutral request for running an Agent."""

    context: RuntimeContext
    question: str
    instructions: str | None = None
    tools: tuple[str, ...] = ()
    knowledge_base_ids: tuple[str, ...] = ()
    memory_enabled: bool = False
    metadata: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "context": self.context.to_dict(),
            "question": self.question,
            "instructions": self.instructions,
            "tools": list(self.tools),
            "knowledge_base_ids": list(self.knowledge_base_ids),
            "memory_enabled": self.memory_enabled,
            "metadata": self.metadata or {},
        }


@dataclass(frozen=True)
class RuntimeInvocationResult:
    """Provider-neutral result returned from an Agent runtime."""

    answer: str
    status: str
    evidence: dict[str, Any]
    provider_id: str | None = None
    provider: str | None = None
    mode: str | None = None
    runtime_invocation_id: str | None = None
    agent_run_id: str | None = None
    provider_run_id: str | None = None
    completed_at: str | None = None
    latency_ms: int | None = None
    token_usage: dict[str, Any] | None = None
    error: str | None = None
    raw: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        payload = {
            "answer": self.answer,
            "status": self.status,
            "evidence": self.evidence,
            "raw": self.raw or {},
        }
        optional_fields = {
            "provider_id": self.provider_id,
            "provider": self.provider,
            "mode": self.mode,
            "runtime_invocation_id": self.runtime_invocation_id,
            "agent_run_id": self.agent_run_id,
            "provider_run_id": self.provider_run_id,
            "completed_at": self.completed_at,
            "latency_ms": self.latency_ms,
            "token_usage": self.token_usage,
            "error": self.error,
        }
        payload.update(
            {
                key: value
                for key, value in optional_fields.items()
                if value is not None
            },
        )
        return payload


@dataclass(frozen=True)
class RuntimeProviderHealth:
    """Provider-neutral runtime health exposed to platform status APIs."""

    provider_id: str
    provider: str
    mode: str
    status: str
    ready: bool
    message: str
    capabilities: tuple[str, ...]
    checks: dict[str, bool]

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider_id": self.provider_id,
            "provider": self.provider,
            "mode": self.mode,
            "status": self.status,
            "ready": self.ready,
            "message": self.message,
            "capabilities": list(self.capabilities),
            "checks": dict(self.checks),
        }


class RuntimeAdapter(Protocol):
    """Runtime adapter contract implemented by concrete providers."""

    id: str
    name: str
    provider: str
    mode: str
    description: str
    capabilities: tuple[RuntimeCapability, ...]

    def describe(self, agent_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        """Return provider metadata suitable for API responses."""
        ...

    def health(self, agent_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        """Return provider health metadata suitable for operations snapshots."""
        ...

    async def invoke(
        self,
        request: RuntimeInvocationRequest,
    ) -> RuntimeInvocationResult:
        """Run an Agent through the provider."""
        ...


@dataclass(frozen=True)
class AgentScopeRuntimeAdapter:
    """AgentScope provider metadata and future invocation boundary."""

    id: str
    name: str
    provider: str
    mode: str
    description: str
    capabilities: tuple[RuntimeCapability, ...]

    def describe(self, agent_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        """Return provider metadata suitable for API responses."""
        metadata = agent_metadata or {}
        return {
            "id": self.id,
            "name": self.name,
            "provider": self.provider,
            "mode": self.mode,
            "description": self.description,
            "capabilities": [capability.id for capability in self.capabilities],
            "capability_details": [
                capability.to_dict() for capability in self.capabilities
            ],
            "agent_id": metadata.get("agent_id"),
            "agent_name": metadata.get("agent_name"),
        }

    def health(self, agent_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        """Return conservative runtime provider health for platform operations."""
        _metadata = agent_metadata or {}
        return RuntimeProviderHealth(
            provider_id=self.id,
            provider=self.provider,
            mode=self.mode,
            status="degraded",
            ready=False,
            message=(
                "Runtime adapter boundary is configured; provider invocation "
                "extraction is pending."
            ),
            capabilities=tuple(capability.id for capability in self.capabilities),
            checks={
                "adapter_configured": True,
                "provider_invocation_wired": False,
                "direct_agentscope_dependency": False,
            },
        ).to_dict()

    async def invoke(
        self,
        request: RuntimeInvocationRequest,
    ) -> RuntimeInvocationResult:
        """Placeholder for provider execution extraction from main.py.

        Current platform run behavior still lives in main.py. This method is the
        production boundary that will receive that logic during service
        extraction.
        """
        raise NotImplementedError(
            "AgentScope invocation is still implemented in backend/main.py. "
            "Move provider-specific execution here during runtime extraction.",
        )


AGENTSCOPE_PLATFORM_ADAPTER = AgentScopeRuntimeAdapter(
    id="agentscope-platform-adapter",
    name="AgentScope Platform Adapter",
    provider="agentscope",
    mode="local-service",
    description=(
        "AgentFoundry owns tenant, governance, memory, knowledge, and audit APIs; "
        "AgentScope is treated as the replaceable agent runtime boundary."
    ),
    capabilities=(
        RuntimeCapability(
            id="tenant_context",
            name="Tenant Context",
            description="Carries tenant, user, session, and agent identity into runtime calls.",
        ),
        RuntimeCapability(
            id="tool_routing",
            name="Tool Routing",
            description="Supports governed tool selection and execution evidence.",
        ),
        RuntimeCapability(
            id="approval_gate",
            name="Approval Gate",
            description="Allows platform policy to pause sensitive actions for human approval.",
        ),
        RuntimeCapability(
            id="knowledge_retrieval",
            name="Knowledge Retrieval",
            description="Accepts scoped knowledge base context and retrieval evidence.",
        ),
        RuntimeCapability(
            id="long_term_memory",
            name="Long-Term Memory",
            description="Accepts platform-controlled memory scope and persistence decisions.",
        ),
        RuntimeCapability(
            id="run_evidence",
            name="Run Evidence",
            description="Returns traceable runtime metadata for audit and operations.",
        ),
    ),
)


def build_runtime_context(
    *,
    tenant: str,
    user_id: str,
    session_id: str,
    agent_id: str,
    agent_name: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> RuntimeContext:
    """Build a provider-neutral runtime context."""
    return RuntimeContext(
        tenant=tenant,
        user_id=user_id,
        session_id=session_id,
        agent_id=agent_id,
        agent_name=agent_name,
        metadata=metadata,
    )


def build_runtime_context_payload(
    *,
    tenant: str,
    user_id: str,
    session_id: str,
    agent_id: str,
    agent_name: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a serialized provider-neutral runtime context."""
    return build_runtime_context(
        tenant=tenant,
        user_id=user_id,
        session_id=session_id,
        agent_id=agent_id,
        agent_name=agent_name,
        metadata=metadata,
    ).to_dict()


def build_runtime_invocation_request_payload(
    *,
    tenant: str,
    user_id: str,
    session_id: str,
    agent_id: str,
    question: str,
    agent_name: str | None = None,
    instructions: str | None = None,
    tools: list[str] | tuple[str, ...] = (),
    knowledge_base_ids: list[str] | tuple[str, ...] = (),
    memory_enabled: bool = False,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a serialized provider-neutral runtime invocation request."""
    return RuntimeInvocationRequest(
        context=build_runtime_context(
            tenant=tenant,
            user_id=user_id,
            session_id=session_id,
            agent_id=agent_id,
            agent_name=agent_name,
            metadata=metadata,
        ),
        question=question,
        instructions=instructions,
        tools=tuple(str(tool) for tool in tools),
        knowledge_base_ids=tuple(
            str(knowledge_base_id) for knowledge_base_id in knowledge_base_ids
        ),
        memory_enabled=memory_enabled,
        metadata=metadata,
    ).to_dict()


def build_runtime_invocation_result_payload(
    *,
    answer: str,
    status: str,
    evidence: dict[str, Any],
    runtime_adapter: dict[str, Any] | None = None,
    runtime_invocation_id: str | None = None,
    agent_run_id: str | None = None,
    provider_run_id: str | None = None,
    completed_at: str | None = None,
    latency_ms: int | None = None,
    token_usage: dict[str, Any] | None = None,
    error: str | None = None,
    raw: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a serialized provider-neutral runtime invocation result."""
    adapter = runtime_adapter or {}
    return RuntimeInvocationResult(
        answer=answer,
        status=status,
        evidence=evidence,
        provider_id=adapter.get("id"),
        provider=adapter.get("provider"),
        mode=adapter.get("mode"),
        runtime_invocation_id=runtime_invocation_id,
        agent_run_id=agent_run_id,
        provider_run_id=provider_run_id,
        completed_at=completed_at,
        latency_ms=latency_ms,
        token_usage=token_usage,
        error=error,
        raw=raw,
    ).to_dict()


def build_adapter_backed_local_invocation_result_payload(
    *,
    answer: str,
    status: str,
    evidence: dict[str, Any],
    agent_metadata: dict[str, Any] | None = None,
    runtime_adapter: dict[str, Any] | None = None,
    runtime_invocation_id: str | None = None,
    agent_run_id: str | None = None,
    provider_run_id: str | None = None,
    completed_at: str | None = None,
    latency_ms: int | None = None,
    token_usage: dict[str, Any] | None = None,
    error: str | None = None,
    raw: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a local service result through the configured runtime adapter.

    This records the current AgentFoundry-local execution path behind the
    runtime boundary without claiming that AgentScope provider invocation is
    wired yet.
    """
    adapter_metadata = get_runtime_adapter(agent_metadata).describe(agent_metadata)
    raw_payload = {
        **(raw or {}),
        "runtime_bridge": {
            "type": "agentfoundry_local_service_completion",
            "provider_invocation_wired": False,
            "adapter_id": adapter_metadata["id"],
        },
    }
    return build_runtime_invocation_result_payload(
        answer=answer,
        status=status,
        evidence=evidence,
        runtime_adapter=adapter_metadata,
        runtime_invocation_id=runtime_invocation_id,
        agent_run_id=agent_run_id,
        provider_run_id=provider_run_id,
        completed_at=completed_at,
        latency_ms=latency_ms,
        token_usage=token_usage,
        error=error,
        raw=raw_payload,
    )


def get_runtime_adapter(_agent_metadata: dict[str, Any] | None = None) -> RuntimeAdapter:
    """Return the runtime adapter for platform agent runs."""
    return AGENTSCOPE_PLATFORM_ADAPTER


def describe_runtime_adapter(
    agent_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return provider metadata for the selected runtime adapter."""
    runtime_adapter = get_runtime_adapter(agent_metadata)
    return runtime_adapter.describe(agent_metadata)


def normalize_runtime_provider_health(
    health: dict[str, Any],
    adapter_metadata: dict[str, Any],
) -> dict[str, Any]:
    """Validate runtime provider health against the selected adapter contract."""
    missing_fields = RUNTIME_PROVIDER_HEALTH_REQUIRED_FIELDS - health.keys()
    if missing_fields:
        raise ValueError(
            f"Runtime provider health missing fields: {sorted(missing_fields)}",
        )

    expected_identity = {
        "provider_id": adapter_metadata.get("id"),
        "provider": adapter_metadata.get("provider"),
        "mode": adapter_metadata.get("mode"),
    }
    for field, expected_value in expected_identity.items():
        if health.get(field) != expected_value:
            raise ValueError(
                "Runtime provider health does not match adapter metadata: "
                f"{field}={health.get(field)!r}, expected {expected_value!r}",
            )

    adapter_capabilities = _string_list(adapter_metadata.get("capabilities"))
    health_capabilities = _string_list(health.get("capabilities"))
    if health_capabilities != adapter_capabilities:
        raise ValueError(
            "Runtime provider health capabilities must match adapter capabilities.",
        )

    checks = health.get("checks")
    if not isinstance(checks, dict):
        raise ValueError("Runtime provider health checks must be an object.")
    missing_checks = [
        check
        for check in RUNTIME_PROVIDER_HEALTH_REQUIRED_CHECKS
        if check not in checks
    ]
    if missing_checks:
        raise ValueError(
            f"Runtime provider health missing checks: {missing_checks}",
        )

    return {
        **health,
        "capabilities": health_capabilities,
        "checks": dict(checks),
    }


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        raise ValueError("Runtime provider capabilities must be a list.")
    return [str(item) for item in value]


def describe_runtime_provider_health(
    agent_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return runtime provider health for platform operations snapshots."""
    runtime_adapter = get_runtime_adapter(agent_metadata)
    adapter_metadata = runtime_adapter.describe(agent_metadata)
    return normalize_runtime_provider_health(
        runtime_adapter.health(agent_metadata),
        adapter_metadata,
    )
