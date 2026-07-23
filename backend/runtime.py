# -*- coding: utf-8 -*-
"""Governance mapping boundary between AgentFoundry and AgentScope runtime.

AgentFoundry owns enterprise governance and the durable business projection of
runtime evidence. AgentScope owns Agent execution. The adapter maps published
versions, trusted identity, authorization and events between those boundaries;
it is not an alternative reasoning, tool-routing, memory or RAG runtime.
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Mapping, Protocol


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
    "local_service_completion_wired",
    "provider_native_config_ready",
    "provider_invocation_wired",
    "direct_agentscope_dependency",
)
RUNTIME_PROVIDER_NATIVE_INVOCATION_REQUIRED_CONFIG = (
    "agentscope_runtime_url",
    "agentscope_runtime_auth_ref",
)
RUNTIME_INVOCATION_RESULT_REQUIRED_FIELDS = frozenset(
    {
        "answer",
        "status",
        "evidence",
        "provider_id",
        "provider",
        "mode",
        "raw",
    },
)
RUNTIME_INVOCATION_RESULT_STATUSES = frozenset(
    {"pending", "running", "completed", "failed", "error", "cancelled"},
)
RUNTIME_INVOCATION_FAILURE_STATUSES = frozenset({"failed", "error", "cancelled"})
AGENTSCOPE_NATIVE_EXECUTION_MODE = "agentscope_native"
FOUNDRY_COMPATIBILITY_EXECUTION_MODE = "foundry_compatibility"
RUNTIME_EXECUTION_MODES = frozenset(
    {AGENTSCOPE_NATIVE_EXECUTION_MODE, FOUNDRY_COMPATIBILITY_EXECUTION_MODE},
)


def _optional_clean_string(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned or None


@dataclass(frozen=True)
class RuntimeExecutionSelection:
    """Immutable execution decision resolved from a published version binding."""

    execution_mode: str
    runtime_provider: str
    scope_provider_id: str | None = None
    scope_runtime_id: str | None = None
    fallback_reason: str | None = None

    def __post_init__(self) -> None:
        mode = _optional_clean_string(self.execution_mode)
        runtime_provider = _optional_clean_string(self.runtime_provider)
        provider_id = _optional_clean_string(self.scope_provider_id)
        runtime_id = _optional_clean_string(self.scope_runtime_id)
        fallback_reason = _optional_clean_string(self.fallback_reason)
        if mode not in RUNTIME_EXECUTION_MODES:
            raise ValueError(f"Unsupported runtime execution mode: {mode!r}.")
        if not runtime_provider:
            raise ValueError("Runtime execution requires an explicit runtime provider.")
        if mode == AGENTSCOPE_NATIVE_EXECUTION_MODE:
            if fallback_reason:
                raise ValueError("agentscope_native cannot record a fallback reason.")
        elif not fallback_reason:
            raise ValueError(
                "foundry_compatibility requires an explicit fallback reason.",
            )
        object.__setattr__(self, "execution_mode", mode)
        object.__setattr__(self, "runtime_provider", runtime_provider)
        object.__setattr__(self, "scope_provider_id", provider_id)
        object.__setattr__(self, "scope_runtime_id", runtime_id)
        object.__setattr__(self, "fallback_reason", fallback_reason)

    def to_dict(self) -> dict[str, str | None]:
        return {
            "execution_mode": self.execution_mode,
            "runtime_provider": self.runtime_provider,
            "scope_provider_id": self.scope_provider_id,
            "scope_runtime_id": self.scope_runtime_id,
            "fallback_reason": self.fallback_reason,
        }


def resolve_runtime_execution_selection(
    agent_metadata: Mapping[str, Any] | None,
) -> RuntimeExecutionSelection:
    """Resolve runtime choice only from an explicit published-version binding."""
    metadata = agent_metadata if isinstance(agent_metadata, Mapping) else {}
    execution_mode = _optional_clean_string(metadata.get("execution_mode"))
    runtime_provider = _optional_clean_string(metadata.get("runtime_provider"))
    binding = metadata.get("runtime_binding")
    binding = binding if isinstance(binding, Mapping) else {}
    if execution_mode:
        return RuntimeExecutionSelection(
            execution_mode=execution_mode,
            runtime_provider=runtime_provider or "local-dev-runtime",
            scope_provider_id=_optional_clean_string(
                binding.get("scope_provider_id"),
            ),
            scope_runtime_id=_optional_clean_string(
                binding.get("scope_runtime_id"),
            ),
            fallback_reason=(
                "Agent is explicitly configured for the legacy Foundry execution path."
                if execution_mode == FOUNDRY_COMPATIBILITY_EXECUTION_MODE
                else None
            ),
        )

    if binding:
        mode = _optional_clean_string(binding.get("execution_mode"))
        if mode == AGENTSCOPE_NATIVE_EXECUTION_MODE:
            return RuntimeExecutionSelection(
                execution_mode=mode,
                runtime_provider=(
                    runtime_provider
                    or _optional_clean_string(binding.get("runtime_provider"))
                    or "agentscope"
                ),
                scope_provider_id=_optional_clean_string(
                    binding.get("scope_provider_id"),
                ),
                scope_runtime_id=_optional_clean_string(
                    binding.get("scope_runtime_id"),
                ),
            )
        if mode == FOUNDRY_COMPATIBILITY_EXECUTION_MODE:
            return RuntimeExecutionSelection(
                execution_mode=mode,
                runtime_provider=(
                    runtime_provider
                    or _optional_clean_string(binding.get("runtime_provider"))
                    or "local-dev-runtime"
                ),
                scope_provider_id=_optional_clean_string(
                    binding.get("scope_provider_id"),
                ),
                scope_runtime_id=_optional_clean_string(
                    binding.get("scope_runtime_id"),
                ),
                fallback_reason=_optional_clean_string(
                    binding.get("fallback_reason"),
                )
                or "Legacy Agent explicitly uses the Foundry compatibility path.",
            )
        return RuntimeExecutionSelection(
            execution_mode=FOUNDRY_COMPATIBILITY_EXECUTION_MODE,
            runtime_provider=runtime_provider or "local-dev-runtime",
            fallback_reason=(
                "Published Agent version has an unknown runtime binding and "
                "requires migration before AgentScope-native execution."
            ),
        )
    return RuntimeExecutionSelection(
        execution_mode=FOUNDRY_COMPATIBILITY_EXECUTION_MODE,
        runtime_provider=runtime_provider or "local-dev-runtime",
        fallback_reason=(
            "Published Agent version has no immutable AgentScope runtime binding; "
            "the explicit migration compatibility provider is required."
        ),
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


@dataclass(frozen=True)
class RuntimeProviderConfigGate:
    """Readiness gate for provider-native runtime invocation configuration."""

    id: str
    required_keys: tuple[str, ...]
    configured_keys: tuple[str, ...]
    missing_keys: tuple[str, ...]
    ready: bool
    message: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "required_keys": list(self.required_keys),
            "configured_keys": list(self.configured_keys),
            "missing_keys": list(self.missing_keys),
            "ready": self.ready,
            "message": self.message,
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


class RuntimeProviderInvocationClient(Protocol):
    """Provider-native runtime invocation client behind the adapter boundary."""

    async def invoke(
        self,
        envelope: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """Invoke the provider-native runtime with a platform-owned envelope."""
        ...


@dataclass(frozen=True)
class AgentScopeRuntimeAdapter:
    """Map Foundry governance context to the AgentScope execution runtime."""

    id: str
    name: str
    provider: str
    mode: str
    description: str
    capabilities: tuple[RuntimeCapability, ...]
    provider_client: RuntimeProviderInvocationClient | None = None

    def describe(self, agent_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        """Return provider metadata suitable for API responses."""
        native_in_process = bool(
            getattr(self.provider_client, "native_in_process", False),
        )
        config_gate = (
            _native_in_process_config_gate()
            if native_in_process
            else describe_provider_native_invocation_config_gate(agent_metadata)
        )
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
            "provider_native_invocation": config_gate,
        }

    def health(self, agent_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        """Return conservative runtime provider health for platform operations."""
        native_in_process = bool(
            getattr(self.provider_client, "native_in_process", False),
        )
        config_gate = (
            _native_in_process_config_gate()
            if native_in_process
            else describe_provider_native_invocation_config_gate(agent_metadata)
        )
        provider_invocation_wired = self.provider_client is not None
        ready = config_gate["ready"] and provider_invocation_wired
        if ready:
            status = "ready"
            message = (
                "Runtime adapter boundary is configured and provider-native "
                "AgentScope invocation is wired through AgentFoundry."
            )
        else:
            status = "degraded"
            message = (
                "AgentScope invocation is not ready. Native runs must fail "
                "explicitly; only Agents bound to the named migration "
                "compatibility provider may use the legacy Foundry path."
            )
        return RuntimeProviderHealth(
            provider_id=self.id,
            provider=self.provider,
            mode=self.mode,
            status=status,
            ready=ready,
            message=message,
            capabilities=tuple(capability.id for capability in self.capabilities),
            checks={
                "adapter_configured": True,
                "local_service_completion_wired": True,
                "provider_native_config_ready": config_gate["ready"],
                "provider_invocation_wired": provider_invocation_wired,
                "direct_agentscope_dependency": native_in_process,
            },
        ).to_dict()

    async def invoke(
        self,
        request: RuntimeInvocationRequest,
    ) -> RuntimeInvocationResult:
        """Invoke AgentScope or return an explicit provider-unavailable failure."""
        runtime_adapter = self.describe(
            _runtime_agent_metadata_from_request(request),
        )
        if self.provider_client is not None:
            return await _invoke_agentscope_provider_client(
                provider_client=self.provider_client,
                request=request,
                runtime_adapter=runtime_adapter,
            )

        return _build_agentscope_pending_invocation_result(
            adapter=self,
            request=request,
            runtime_adapter=runtime_adapter,
        )


AGENTSCOPE_PLATFORM_ADAPTER = AgentScopeRuntimeAdapter(
    id="agentscope-platform-adapter",
    name="AgentScope Platform Adapter",
    provider="agentscope",
    mode="local-service",
    description=(
        "AgentFoundry maps enterprise versions, identity, authorization and audit "
        "projections to AgentScope, the execution source of truth for Agents."
    ),
    capabilities=(
        RuntimeCapability(
            id="foundry_governance",
            name="Foundry Governance Mapping",
            description=(
                "Maps immutable versions, deployments, trusted identity and "
                "enterprise authorization into runtime calls."
            ),
        ),
        RuntimeCapability(
            id="agentscope_runtime",
            name="AgentScope Runtime",
            description=(
                "AgentScope owns inference, Agent state, tool execution, runtime "
                "memory, knowledge retrieval and provider events."
            ),
        ),
        RuntimeCapability(
            id="migration_compatibility",
            name="Migration Compatibility",
            description=(
                "Legacy Foundry execution is isolated, explicitly selected and "
                "recorded with a mandatory fallback reason until retired."
            ),
        ),
    ),
)


def _build_agentscope_pending_invocation_result(
    *,
    adapter: AgentScopeRuntimeAdapter,
    request: RuntimeInvocationRequest,
    runtime_adapter: dict[str, Any],
) -> RuntimeInvocationResult:
    """Build the default pending result while provider invocation is unwired."""
    error = (
        "AgentScope provider invocation is not wired. An agentscope_native run "
        "cannot fall back to the Foundry compatibility execution path."
    )
    raw = {
        "runtime_bridge": {
            "type": "agentscope_adapter_invocation_pending",
            "provider_invocation_wired": False,
            "provider_native_invocation": runtime_adapter[
                "provider_native_invocation"
            ],
            "adapter_id": adapter.id,
        },
        "request": _runtime_invocation_request_audit_payload(request),
    }
    payload = build_runtime_invocation_error_result_payload(
        error=error,
        evidence=_runtime_invocation_evidence_from_request(request),
        runtime_adapter=runtime_adapter,
        runtime_invocation_id=(request.metadata or {}).get("runtime_invocation_id"),
        raw=raw,
    )
    normalized = normalize_runtime_invocation_result(payload, runtime_adapter)
    return RuntimeInvocationResult(
        answer=normalized["answer"],
        status=normalized["status"],
        evidence=normalized["evidence"],
        provider_id=normalized["provider_id"],
        provider=normalized["provider"],
        mode=normalized["mode"],
        runtime_invocation_id=normalized.get("runtime_invocation_id"),
        agent_run_id=normalized.get("agent_run_id"),
        provider_run_id=normalized.get("provider_run_id"),
        completed_at=normalized.get("completed_at"),
        latency_ms=normalized.get("latency_ms"),
        token_usage=normalized.get("token_usage"),
        error=normalized.get("error"),
        raw=normalized["raw"],
    )


async def _invoke_agentscope_provider_client(
    *,
    provider_client: RuntimeProviderInvocationClient,
    request: RuntimeInvocationRequest,
    runtime_adapter: dict[str, Any],
) -> RuntimeInvocationResult:
    """Invoke an injected AgentScope provider client and normalize the result."""
    config_gate = runtime_adapter["provider_native_invocation"]
    native_in_process = bool(getattr(provider_client, "native_in_process", False))
    if not native_in_process and not config_gate["ready"]:
        error = (
            "AgentScope provider invocation requires configured runtime URL "
            "and auth reference before provider-native execution can run."
        )
        raw = {
            "runtime_bridge": {
                "type": "agentscope_provider_native_config_blocked",
                "provider_invocation_wired": True,
                "provider_native_invocation": config_gate,
                "adapter_id": runtime_adapter["id"],
            },
            "request": _runtime_invocation_request_audit_payload(request),
        }
        payload = build_runtime_invocation_error_result_payload(
            error=error,
            evidence=_runtime_invocation_evidence_from_request(request),
            runtime_adapter=runtime_adapter,
            runtime_invocation_id=(request.metadata or {}).get("runtime_invocation_id"),
            raw=raw,
        )
        normalized = normalize_runtime_invocation_result(payload, runtime_adapter)
        return RuntimeInvocationResult(
            answer=normalized["answer"],
            status=normalized["status"],
            evidence=normalized["evidence"],
            provider_id=normalized["provider_id"],
            provider=normalized["provider"],
            mode=normalized["mode"],
            runtime_invocation_id=normalized.get("runtime_invocation_id"),
            agent_run_id=normalized.get("agent_run_id"),
            provider_run_id=normalized.get("provider_run_id"),
            completed_at=normalized.get("completed_at"),
            latency_ms=normalized.get("latency_ms"),
            token_usage=normalized.get("token_usage"),
            error=normalized.get("error"),
            raw=normalized["raw"],
        )

    envelope = build_agentscope_provider_native_invocation_envelope(
        request=request,
        runtime_adapter=runtime_adapter,
        native_in_process=native_in_process,
    )
    provider_response = await provider_client.invoke(envelope)
    if not isinstance(provider_response, Mapping):
        raise ValueError("AgentScope provider client must return an object.")

    normalized = _normalize_agentscope_provider_client_response(
        provider_response,
        request=request,
        runtime_adapter=runtime_adapter,
    )
    return RuntimeInvocationResult(
        answer=normalized["answer"],
        status=normalized["status"],
        evidence=normalized["evidence"],
        provider_id=normalized["provider_id"],
        provider=normalized["provider"],
        mode=normalized["mode"],
        runtime_invocation_id=normalized.get("runtime_invocation_id"),
        agent_run_id=normalized.get("agent_run_id"),
        provider_run_id=normalized.get("provider_run_id"),
        completed_at=normalized.get("completed_at"),
        latency_ms=normalized.get("latency_ms"),
        token_usage=normalized.get("token_usage"),
        error=normalized.get("error"),
        raw=normalized["raw"],
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


def build_runtime_invocation_request_from_payload(
    payload: Mapping[str, Any],
) -> RuntimeInvocationRequest:
    """Build a provider-neutral runtime request from a serialized payload."""
    context_payload = payload.get("context")
    if not isinstance(context_payload, Mapping):
        raise ValueError("Runtime invocation request requires context.")

    question = payload.get("question")
    if not isinstance(question, str) or not question.strip():
        raise ValueError("Runtime invocation request requires a non-empty question.")

    metadata = payload.get("metadata")
    if metadata is not None and not isinstance(metadata, dict):
        raise ValueError("Runtime invocation request metadata must be an object.")

    context_metadata = context_payload.get("metadata")
    if context_metadata is not None and not isinstance(context_metadata, dict):
        raise ValueError("Runtime invocation context metadata must be an object.")

    return RuntimeInvocationRequest(
        context=RuntimeContext(
            tenant=_required_text(context_payload, "tenant"),
            user_id=_required_text(context_payload, "user_id"),
            session_id=_required_text(context_payload, "session_id"),
            agent_id=_required_text(context_payload, "agent_id"),
            agent_name=_optional_text(context_payload.get("agent_name")),
            metadata=context_metadata,
        ),
        question=question,
        instructions=_optional_text(payload.get("instructions")),
        tools=_string_tuple(payload.get("tools", ()), "tools"),
        knowledge_base_ids=_string_tuple(
            payload.get("knowledge_base_ids", ()),
            "knowledge_base_ids",
        ),
        memory_enabled=bool(payload.get("memory_enabled", False)),
        metadata=metadata,
    )


def build_agentscope_provider_native_invocation_envelope(
    *,
    request: RuntimeInvocationRequest,
    runtime_adapter: dict[str, Any],
    native_in_process: bool = False,
) -> dict[str, Any]:
    """Build the platform-owned envelope for provider-native AgentScope calls."""
    agent_metadata = _runtime_agent_metadata_from_request(request)
    config = agent_metadata.get("runtime_provider_config")
    if not isinstance(config, Mapping):
        config = {}

    config_gate = (
        _native_in_process_config_gate()
        if native_in_process
        else describe_provider_native_invocation_config_gate(agent_metadata)
    )
    if not config_gate["ready"]:
        raise ValueError(
            "AgentScope provider-native invocation requires runtime URL and auth reference.",
        )

    envelope = {
        "provider_id": runtime_adapter["id"],
        "provider": runtime_adapter["provider"],
        "mode": runtime_adapter["mode"],
        "request": request.to_dict(),
        "audit": {
            "provider_native_invocation": config_gate,
            "request": _runtime_invocation_request_audit_payload(request),
        },
    }
    if not native_in_process:
        envelope["endpoint"] = str(config["agentscope_runtime_url"]).strip()
        envelope["auth_ref"] = str(config["agentscope_runtime_auth_ref"]).strip()
    return envelope


async def invoke_runtime_adapter_from_payload(
    payload: Mapping[str, Any],
    *,
    agent_metadata: dict[str, Any] | None = None,
    runtime_adapter: RuntimeAdapter | None = None,
) -> dict[str, Any]:
    """Invoke the selected runtime adapter from a serialized request payload."""
    request = build_runtime_invocation_request_from_payload(payload)
    return await invoke_runtime_adapter(
        request,
        agent_metadata=agent_metadata,
        runtime_adapter=runtime_adapter,
    )


async def invoke_runtime_adapter(
    request: RuntimeInvocationRequest,
    *,
    agent_metadata: dict[str, Any] | None = None,
    runtime_adapter: RuntimeAdapter | None = None,
) -> dict[str, Any]:
    """Invoke the selected runtime adapter and normalize its result."""
    selected_adapter = runtime_adapter or get_runtime_adapter(agent_metadata)
    adapter_metadata = selected_adapter.describe(
        agent_metadata
        or {
            "agent_id": request.context.agent_id,
            "agent_name": request.context.agent_name,
        },
    )
    invocation_request = _runtime_invocation_request_with_agent_metadata(
        request,
        agent_metadata,
    )
    result = await selected_adapter.invoke(invocation_request)
    return normalize_runtime_invocation_result(result.to_dict(), adapter_metadata)


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
    payload = RuntimeInvocationResult(
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
    return normalize_runtime_invocation_result(payload, adapter)


def build_runtime_invocation_error_result_payload(
    *,
    error: str,
    evidence: dict[str, Any],
    runtime_adapter: dict[str, Any] | None = None,
    status: str = "failed",
    answer: str = "",
    runtime_invocation_id: str | None = None,
    agent_run_id: str | None = None,
    provider_run_id: str | None = None,
    completed_at: str | None = None,
    latency_ms: int | None = None,
    token_usage: dict[str, Any] | None = None,
    raw: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a serialized provider-neutral runtime invocation failure result."""
    error_text = str(error).strip()
    raw_payload = {
        **(raw or {}),
        "runtime_error": {
            "message": error_text,
            "status": status,
        },
    }
    return build_runtime_invocation_result_payload(
        answer=answer,
        status=status,
        evidence=evidence,
        runtime_adapter=runtime_adapter,
        runtime_invocation_id=runtime_invocation_id,
        agent_run_id=agent_run_id,
        provider_run_id=provider_run_id,
        completed_at=completed_at,
        latency_ms=latency_ms,
        token_usage=token_usage,
        error=error_text,
        raw=raw_payload,
    )


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
            "provider_native_invocation": adapter_metadata[
                "provider_native_invocation"
            ],
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


def _normalize_agentscope_provider_client_response(
    provider_response: Mapping[str, Any],
    *,
    request: RuntimeInvocationRequest,
    runtime_adapter: dict[str, Any],
) -> dict[str, Any]:
    status = str(provider_response.get("status") or "completed").strip()
    evidence = provider_response.get("evidence")
    if not isinstance(evidence, dict):
        evidence = _runtime_invocation_evidence_from_request(request)

    provider_raw = provider_response.get("raw")
    native_in_process = bool(
        runtime_adapter.get("provider_native_invocation", {}).get("native_in_process"),
    )
    raw_payload = {
        "runtime_bridge": {
            "type": (
                "agentscope_native_in_process"
                if native_in_process
                else "agentscope_provider_native_invocation"
            ),
            "provider_invocation_wired": True,
            "provider_native_invocation": runtime_adapter["provider_native_invocation"],
            "adapter_id": runtime_adapter["id"],
        },
        "request": _runtime_invocation_request_audit_payload(request),
        "provider_response": (
            dict(provider_raw) if isinstance(provider_raw, Mapping) else {}
        ),
    }
    runtime_invocation_id = _optional_provider_text(
        provider_response.get("runtime_invocation_id"),
    ) or (request.metadata or {}).get("runtime_invocation_id")
    common = {
        "evidence": evidence,
        "runtime_adapter": runtime_adapter,
        "runtime_invocation_id": runtime_invocation_id,
        "agent_run_id": _optional_provider_text(provider_response.get("agent_run_id")),
        "provider_run_id": _optional_provider_text(
            provider_response.get("provider_run_id"),
        ),
        "completed_at": _optional_provider_text(provider_response.get("completed_at")),
        "latency_ms": provider_response.get("latency_ms"),
        "token_usage": provider_response.get("token_usage"),
        "raw": raw_payload,
    }
    if status in RUNTIME_INVOCATION_FAILURE_STATUSES:
        return build_runtime_invocation_error_result_payload(
            answer=str(provider_response.get("answer") or ""),
            status=status,
            error=str(
                provider_response.get("error")
                or "AgentScope provider invocation failed.",
            ),
            **common,
        )

    return build_runtime_invocation_result_payload(
        answer=str(provider_response.get("answer") or ""),
        status=status,
        error=_optional_provider_text(provider_response.get("error")),
        **common,
    )


def _native_in_process_config_gate() -> dict[str, Any]:
    """Describe an injected native client that needs no URL or auth reference."""
    return {
        "id": "agentscope_native_in_process",
        "required_keys": [],
        "configured_keys": [],
        "missing_keys": [],
        "ready": True,
        "native_in_process": True,
        "message": "Native in-process AgentScope invocation is ready.",
    }


def build_runtime_provider_invocation_client(
    agent_metadata: dict[str, Any] | None = None,
) -> RuntimeProviderInvocationClient | None:
    """Build the provider-native invocation client when runtime config is ready."""
    config_gate = describe_provider_native_invocation_config_gate(agent_metadata)
    if not config_gate["ready"]:
        return None

    try:
        from .runtime_provider_clients import AgentScopeProviderHttpInvocationClient
    except ImportError:
        from runtime_provider_clients import AgentScopeProviderHttpInvocationClient

    return AgentScopeProviderHttpInvocationClient()


def get_runtime_adapter(agent_metadata: dict[str, Any] | None = None) -> RuntimeAdapter:
    """Return the runtime adapter for platform agent runs."""
    provider_client = build_runtime_provider_invocation_client(agent_metadata)
    if provider_client is not None:
        return replace(AGENTSCOPE_PLATFORM_ADAPTER, provider_client=provider_client)
    return AGENTSCOPE_PLATFORM_ADAPTER


def describe_runtime_adapter(
    agent_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return provider metadata for the selected runtime adapter."""
    runtime_adapter = get_runtime_adapter(agent_metadata)
    return runtime_adapter.describe(agent_metadata)


def describe_provider_native_invocation_config_gate(
    agent_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return the provider-native invocation config gate without secret values."""
    config = (agent_metadata or {}).get("runtime_provider_config")
    if not isinstance(config, Mapping):
        config = {}
    configured_keys = tuple(
        key
        for key in RUNTIME_PROVIDER_NATIVE_INVOCATION_REQUIRED_CONFIG
        if _configured_config_value(config.get(key))
    )
    missing_keys = tuple(
        key
        for key in RUNTIME_PROVIDER_NATIVE_INVOCATION_REQUIRED_CONFIG
        if key not in configured_keys
    )
    ready = not missing_keys
    if ready:
        message = (
            "Provider-native invocation configuration is present for adapter "
            "selection and provider-owned execution."
        )
    else:
        message = (
            "Provider-native AgentScope invocation is blocked until required "
            "configuration references are present."
        )
    return RuntimeProviderConfigGate(
        id="agentscope_provider_native_invocation_config",
        required_keys=RUNTIME_PROVIDER_NATIVE_INVOCATION_REQUIRED_CONFIG,
        configured_keys=configured_keys,
        missing_keys=missing_keys,
        ready=ready,
        message=message,
    ).to_dict()


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


def normalize_runtime_invocation_result(
    result: dict[str, Any],
    adapter_metadata: dict[str, Any],
) -> dict[str, Any]:
    """Validate runtime invocation result identity and payload shape."""
    missing_fields = RUNTIME_INVOCATION_RESULT_REQUIRED_FIELDS - result.keys()
    if missing_fields:
        raise ValueError(
            f"Runtime invocation result missing fields: {sorted(missing_fields)}",
        )

    expected_identity = {
        "provider_id": adapter_metadata.get("id"),
        "provider": adapter_metadata.get("provider"),
        "mode": adapter_metadata.get("mode"),
    }
    for field, expected_value in expected_identity.items():
        if not expected_value:
            raise ValueError(
                f"Runtime invocation result requires adapter metadata field: {field}",
            )
        if result.get(field) != expected_value:
            raise ValueError(
                "Runtime invocation result does not match adapter metadata: "
                f"{field}={result.get(field)!r}, expected {expected_value!r}",
            )

    if not isinstance(result.get("answer"), str):
        raise ValueError("Runtime invocation result answer must be a string.")
    if not isinstance(result.get("status"), str) or not result["status"].strip():
        raise ValueError("Runtime invocation result status must be a non-empty string.")
    status = result["status"].strip()
    if status not in RUNTIME_INVOCATION_RESULT_STATUSES:
        raise ValueError(
            "Runtime invocation result status must be one of: "
            f"{sorted(RUNTIME_INVOCATION_RESULT_STATUSES)}.",
        )
    if not isinstance(result.get("evidence"), dict):
        raise ValueError("Runtime invocation result evidence must be an object.")
    if not isinstance(result.get("raw"), dict):
        raise ValueError("Runtime invocation result raw payload must be an object.")

    error = result.get("error")
    if error is not None and not isinstance(error, str):
        raise ValueError("Runtime invocation result error must be a string.")
    if status in RUNTIME_INVOCATION_FAILURE_STATUSES:
        if not isinstance(error, str) or not error.strip():
            raise ValueError(
                "Runtime invocation failure result requires a non-empty error.",
            )
        runtime_error = result["raw"].get("runtime_error")
        if not isinstance(runtime_error, dict):
            raise ValueError(
                "Runtime invocation failure result requires raw.runtime_error.",
            )
        if runtime_error.get("message") != error.strip():
            raise ValueError(
                "Runtime invocation failure raw.runtime_error.message must match error.",
            )
        if runtime_error.get("status") != status:
            raise ValueError(
                "Runtime invocation failure raw.runtime_error.status must match status.",
            )

    latency_ms = result.get("latency_ms")
    if latency_ms is not None and (
        not isinstance(latency_ms, int) or latency_ms < 0
    ):
        raise ValueError(
            "Runtime invocation result latency_ms must be a non-negative integer.",
        )

    token_usage = result.get("token_usage")
    if token_usage is not None and not isinstance(token_usage, dict):
        raise ValueError("Runtime invocation result token_usage must be an object.")

    return {
        **result,
        "status": status,
        "raw": dict(result["raw"]),
        "evidence": dict(result["evidence"]),
    }


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        raise ValueError("Runtime provider capabilities must be a list.")
    return [str(item) for item in value]


def _string_tuple(value: Any, field: str) -> tuple[str, ...]:
    if not isinstance(value, (list, tuple)):
        raise ValueError(f"Runtime invocation request {field} must be a list.")
    return tuple(str(item) for item in value)


def _required_text(payload: Mapping[str, Any], field: str) -> str:
    value = payload.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Runtime invocation context requires {field}.")
    return value


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Runtime invocation optional text fields must be strings.")
    return value


def _optional_provider_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _configured_config_value(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _runtime_invocation_evidence_from_request(
    request: RuntimeInvocationRequest,
) -> dict[str, Any]:
    return {
        "tenant": request.context.tenant,
        "user_id": request.context.user_id,
        "session_id": request.context.session_id,
        "agent_id": request.context.agent_id,
        "agent_name": request.context.agent_name,
    }


def _runtime_invocation_request_with_agent_metadata(
    request: RuntimeInvocationRequest,
    agent_metadata: dict[str, Any] | None,
) -> RuntimeInvocationRequest:
    if agent_metadata is None:
        return request
    metadata = dict(request.metadata or {})
    metadata["agent_metadata"] = dict(agent_metadata)
    return replace(request, metadata=metadata)


def _runtime_agent_metadata_from_request(
    request: RuntimeInvocationRequest,
) -> dict[str, Any]:
    metadata = request.metadata or {}
    context_metadata = request.context.metadata or {}
    agent_metadata: dict[str, Any] = {
        "agent_id": request.context.agent_id,
        "agent_name": request.context.agent_name,
    }
    for source in (context_metadata, metadata):
        runtime_provider_config = source.get("runtime_provider_config")
        if isinstance(runtime_provider_config, dict):
            agent_metadata["runtime_provider_config"] = runtime_provider_config
    nested_agent_metadata = metadata.get("agent_metadata")
    if isinstance(nested_agent_metadata, dict):
        agent_metadata.update(nested_agent_metadata)
        agent_metadata["agent_id"] = request.context.agent_id
        agent_metadata["agent_name"] = request.context.agent_name
    return agent_metadata


def _runtime_invocation_request_audit_payload(
    request: RuntimeInvocationRequest,
) -> dict[str, Any]:
    payload = request.to_dict()
    metadata = payload.get("metadata")
    if isinstance(metadata, dict):
        payload["metadata"] = _redact_runtime_provider_config(metadata)
    context = payload.get("context")
    if isinstance(context, dict):
        context_metadata = context.get("metadata")
        if isinstance(context_metadata, dict):
            context["metadata"] = _redact_runtime_provider_config(context_metadata)
    return payload


def _redact_runtime_provider_config(metadata: dict[str, Any]) -> dict[str, Any]:
    redacted = dict(metadata)
    nested_agent_metadata = redacted.get("agent_metadata")
    if isinstance(nested_agent_metadata, dict):
        redacted["agent_metadata"] = _redact_runtime_provider_config(
            nested_agent_metadata,
        )
    runtime_provider_config = redacted.get("runtime_provider_config")
    if isinstance(runtime_provider_config, dict):
        redacted["runtime_provider_config"] = {
            key: "<configured>"
            for key in RUNTIME_PROVIDER_NATIVE_INVOCATION_REQUIRED_CONFIG
            if _configured_config_value(runtime_provider_config.get(key))
        }
    return redacted


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
