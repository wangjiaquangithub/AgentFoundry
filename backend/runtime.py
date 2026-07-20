# -*- coding: utf-8 -*-
"""Runtime adapter boundary for AgentFoundry platform runs.

The platform should depend on this module instead of directly depending on a
specific Agent runtime implementation. AgentScope is the first provider behind
this boundary, not the platform itself.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


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
    provider_run_id: str | None = None
    raw: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "answer": self.answer,
            "status": self.status,
            "evidence": self.evidence,
            "provider_run_id": self.provider_run_id,
            "raw": self.raw or {},
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


def get_runtime_adapter(_agent_metadata: dict[str, Any] | None = None) -> RuntimeAdapter:
    """Return the runtime adapter for platform agent runs."""
    return AGENTSCOPE_PLATFORM_ADAPTER


def describe_runtime_adapter(
    agent_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return provider metadata for the selected runtime adapter."""
    runtime_adapter = get_runtime_adapter(agent_metadata)
    return runtime_adapter.describe(agent_metadata)
