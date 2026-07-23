"""Service-layer orchestration for enterprise agent run history."""

import logging
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Protocol
from uuid import uuid4

from backend.persistence import (
    AuditEventRecord,
    RuntimeInvocationRecord,
    ToolCallRecord,
)
from repositories.agent_runs import AgentRunRepositoryProtocol
from services.approvals import PlatformApprovalServiceError


logger = logging.getLogger(__name__)


class ToolCallWriteRepositoryProtocol(Protocol):
    """Persistence boundary for production tool-call execution evidence."""

    def append_tool_call(self, record: ToolCallRecord) -> ToolCallRecord:
        """Persist one tenant-scoped tool-call record."""


class RuntimeInvocationWriteRepositoryProtocol(Protocol):
    """Persistence boundary for production runtime invocation evidence."""

    def append_invocation(
        self,
        record: RuntimeInvocationRecord,
    ) -> RuntimeInvocationRecord:
        """Persist one tenant-scoped runtime invocation record."""


class AuditEventWriteRepositoryProtocol(Protocol):
    """Persistence boundary for immutable production audit events."""

    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        """Persist one tenant-scoped audit event."""


class PlatformAgentRunServiceError(ValueError):
    """Raised when an agent run history operation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class PlatformAgentRunService:
    """Manage persisted enterprise agent question-answer turns."""

    def __init__(
        self,
        *,
        repository: AgentRunRepositoryProtocol,
        tool_call_writer: ToolCallWriteRepositoryProtocol | None = None,
        runtime_invocation_writer: (
            RuntimeInvocationWriteRepositoryProtocol | None
        ) = None,
        audit_event_writer: AuditEventWriteRepositoryProtocol | None = None,
    ) -> None:
        self._repository = repository
        self._tool_call_writer = tool_call_writer
        self._runtime_invocation_writer = runtime_invocation_writer
        self._audit_event_writer = audit_event_writer

    def list_runs(
        self,
        *,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        return {
            "runs": self._repository.list(
                limit=limit,
                agent_id=_optional_filter(agent_id),
                tenant=_optional_filter(tenant),
                user_id=_optional_filter(user_id),
                session_id=_optional_filter(session_id),
            ),
        }

    def list_runs_request_payload(
        self,
        *,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        return {
            "agent_id": _optional_filter(agent_id),
            "tenant": _optional_filter(tenant),
            "user_id": _optional_filter(user_id),
            "session_id": _optional_filter(session_id),
            "limit": limit,
        }

    def get_run(self, turn_id: str, *, tenant: str | None = None) -> dict[str, Any]:
        run = self._repository.get(turn_id.strip(), tenant=_optional_filter(tenant))
        if run is None:
            raise PlatformAgentRunServiceError(404, "Agent run not found.")
        return run

    def append_run(self, record: dict[str, Any]) -> dict[str, Any]:
        return self._repository.append(record)

    def build_run_identity(self) -> dict[str, str]:
        return {
            "turn_id": uuid4().hex,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def run_request_user_id(
        *,
        payload_user_id: str | None = None,
        header_user_id: str | None = None,
    ) -> str:
        return payload_user_id or header_user_id or "acme:alice"

    def run_request_payload(
        self,
        *,
        question: str,
        payload_user_id: str | None = None,
        header_user_id: str | None = None,
        agent_id: str | None = None,
        session_id: str | None = None,
        approval_id: str | None = None,
    ) -> dict[str, Any]:
        return {
            "question": question.strip(),
            "user_id": self.run_request_user_id(
                payload_user_id=payload_user_id,
                header_user_id=header_user_id,
            ),
            "agent_id": _optional_filter(agent_id),
            "session_id": session_id,
            "approval_id": approval_id,
        }

    @staticmethod
    def resolve_run_agent(
        *,
        run_request: dict[str, Any],
        load_published_agent: Callable[[str, str], tuple[dict[str, Any], Any]],
    ) -> dict[str, Any] | None:
        agent_id = run_request["agent_id"]
        if not agent_id:
            return None
        agent, _ = load_published_agent(agent_id, run_request["user_id"])
        return agent

    def resolve_run_agent_context(
        self,
        *,
        run_request: dict[str, Any],
        load_published_agent: Callable[[str, str], tuple[dict[str, Any], Any]],
        build_run_metadata: Callable[[dict[str, Any] | None], dict[str, Any]],
        describe_runtime_adapter: Callable[[dict[str, Any]], dict[str, Any]],
    ) -> dict[str, Any]:
        agent = self.resolve_run_agent(
            run_request=run_request,
            load_published_agent=load_published_agent,
        )
        agent_metadata = build_run_metadata(agent)
        return {
            "agent": agent,
            "agent_metadata": agent_metadata,
            "runtime_adapter": self.runtime_adapter_payload_from_metadata(
                describe_runtime_adapter=describe_runtime_adapter,
                agent_metadata=agent_metadata,
            ),
        }

    @staticmethod
    def agent_context_view(agent_context: dict[str, Any]) -> dict[str, Any]:
        return {
            "agent": agent_context["agent"],
            "agent_metadata": agent_context["agent_metadata"],
            "runtime_adapter": agent_context["runtime_adapter"],
        }

    @staticmethod
    def resolve_runtime_context(
        *,
        user_id: str,
        load_runtime_context: Callable[[str], dict[str, Any]],
        runtime_context_error_type: type[Exception],
        raise_runtime_context_error: Callable[[Exception], None],
    ) -> dict[str, Any]:
        try:
            return load_runtime_context(user_id)
        except runtime_context_error_type as exc:
            raise_runtime_context_error(exc)
            raise

    @staticmethod
    def runtime_adapter_payload_from_metadata(
        *,
        describe_runtime_adapter: Callable[[dict[str, Any]], dict[str, Any]],
        agent_metadata: dict[str, Any],
    ) -> dict[str, Any]:
        return describe_runtime_adapter(agent_metadata)

    @staticmethod
    def runtime_tenant(runtime: dict[str, Any]) -> str:
        return str(runtime["tenant"])

    @staticmethod
    def runtime_connector_label(runtime: dict[str, Any]) -> str:
        return str(runtime["connector_label"])

    @staticmethod
    def runtime_connector_source(runtime: dict[str, Any]) -> str:
        return str(runtime["connector_source"])

    def build_runtime_identity(self, runtime: dict[str, Any]) -> dict[str, str]:
        return {
            "tenant": self.runtime_tenant(runtime),
            "connector": self.runtime_connector_label(runtime),
            "connector_source": self.runtime_connector_source(runtime),
        }

    def build_response_trace(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
        session_id: str,
        tool_calls: list[dict[str, Any]],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        memory_saved: bool,
        run_identity: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        run_identity = run_identity or self.build_run_identity()
        turn_id = run_identity["turn_id"]
        created_at = run_identity["created_at"]
        return {
            "turn_id": turn_id,
            "created_at": created_at,
            "evidence": self.build_evidence(
                turn_id=turn_id,
                created_at=created_at,
                tenant=tenant,
                user_id=user_id,
                agent_id=agent_id,
                session_id=session_id,
                tool_calls=tool_calls,
                knowledge_hits=knowledge_hits,
                memory_hits=memory_hits,
                memory_saved=memory_saved,
            ),
        }

    def build_routed_response_trace(
        self,
        *,
        primary_call: dict[str, Any],
        tenant: str,
        user_id: str,
        agent_id: str,
        session_id: str,
        tool_calls: list[dict[str, Any]],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        memory_saved: bool,
        run_identity: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        return self.build_response_trace(
            tenant=str(primary_call.get("tenant", tenant)),
            user_id=str(primary_call.get("user_id", user_id)),
            agent_id=agent_id,
            session_id=session_id,
            tool_calls=tool_calls,
            knowledge_hits=knowledge_hits,
            memory_hits=memory_hits,
            memory_saved=memory_saved,
            run_identity=run_identity,
        )

    def build_unrouted_response_trace(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
        session_id: str,
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        memory_saved: bool,
        run_identity: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        return self.build_response_trace(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            session_id=session_id,
            tool_calls=[],
            knowledge_hits=knowledge_hits,
            memory_hits=memory_hits,
            memory_saved=memory_saved,
            run_identity=run_identity,
        )

    def build_response_record_context(
        self,
        *,
        runtime_context: dict[str, Any],
        session_id: str,
        agent_id: str,
        agent_name: Any,
        tenant: str,
        user_id: str,
        question: str,
        runtime_adapter: dict[str, Any],
        runtime_invocation_request: dict[str, Any] | None = None,
        runtime_invocation_id: str | None = None,
    ) -> dict[str, Any]:
        context = {
            "session_id": runtime_context["session_id"],
            "agent_id": runtime_context["agent_id"],
            "agent_name": runtime_context.get("agent_name"),
            "tenant": runtime_context["tenant"],
            "user_id": runtime_context["user_id"],
            "question": question,
            "runtime_adapter": runtime_adapter,
        }
        if runtime_invocation_request is not None:
            context["runtime_invocation_request"] = runtime_invocation_request
        if runtime_invocation_id is not None:
            context["runtime_invocation_id"] = runtime_invocation_id
        return context

    def build_execution_context(
        self,
        *,
        run_request: dict[str, Any],
        agent: dict[str, Any] | None,
        agent_metadata: dict[str, Any],
        runtime: dict[str, Any],
        runtime_adapter: dict[str, Any],
        build_runtime_invocation_request_payload: Callable[..., dict[str, Any]],
        default_tool_names: set[str],
        safe_path_part: Callable[[str], str],
    ) -> dict[str, Any]:
        runtime_identity = self.build_runtime_identity(runtime)
        tenant = runtime_identity["tenant"]
        question = run_request["question"]
        runtime_invocation_id = uuid4().hex
        run_identity = self.build_run_identity()
        runner_context = self.resolve_runner_context(
            agent_metadata=agent_metadata,
            agent=agent,
            user_id=run_request["user_id"],
            session_id=run_request["session_id"],
            default_tool_names=default_tool_names,
            safe_path_part=safe_path_part,
        )
        knowledge_base_ids = self.knowledge_base_ids_from_metadata(agent_metadata)
        runtime_invocation_request = build_runtime_invocation_request_payload(
            tenant=tenant,
            user_id=run_request["user_id"],
            session_id=runner_context["runner_session_id"],
            agent_id=runner_context["runner_agent_id"],
            agent_name=agent_metadata.get("agent_name"),
            question=question,
            tools=sorted(runner_context["configured_tools"]),
            knowledge_base_ids=knowledge_base_ids,
            memory_enabled=bool(agent_metadata.get("memory_enabled", False)),
            metadata={
                "source": "enterprise_agent_run",
                "runtime_invocation_id": runtime_invocation_id,
            },
        )
        response_record_context = self.build_response_record_context(
            runtime_context=runtime_invocation_request["context"],
            session_id=runner_context["runner_session_id"],
            agent_id=runner_context["runner_agent_id"],
            agent_name=agent_metadata.get("agent_name"),
            tenant=tenant,
            user_id=run_request["user_id"],
            question=question,
            runtime_adapter=runtime_adapter,
            runtime_invocation_request=runtime_invocation_request,
            runtime_invocation_id=runtime_invocation_id,
        )
        return {
            "agent_metadata": agent_metadata,
            "runtime_adapter": runtime_adapter,
            "runtime_identity": runtime_identity,
            "tenant": tenant,
            "connector_label": runtime_identity["connector"],
            "connector_source": runtime_identity["connector_source"],
            "question": question,
            "configured_tools": runner_context["configured_tools"],
            "runner_agent_id": runner_context["runner_agent_id"],
            "runner_session_id": runner_context["runner_session_id"],
            "runtime_invocation_id": runtime_invocation_id,
            "run_identity": run_identity,
            "runtime_invocation_request": runtime_invocation_request,
            "response_record_context": response_record_context,
            "knowledge_base_ids": knowledge_base_ids,
        }

    def build_execution_context_from_agent_context(
        self,
        *,
        run_request: dict[str, Any],
        agent_context: dict[str, Any],
        runtime: dict[str, Any],
        build_runtime_invocation_request_payload: Callable[..., dict[str, Any]],
        default_tool_names: set[str],
        safe_path_part: Callable[[str], str],
    ) -> dict[str, Any]:
        agent_context_view = self.agent_context_view(agent_context)
        return self.build_execution_context(
            run_request=run_request,
            agent=agent_context_view["agent"],
            agent_metadata=agent_context_view["agent_metadata"],
            runtime=runtime,
            runtime_adapter=agent_context_view["runtime_adapter"],
            build_runtime_invocation_request_payload=(
                build_runtime_invocation_request_payload
            ),
            default_tool_names=default_tool_names,
            safe_path_part=safe_path_part,
        )

    async def invoke_runtime_adapter_from_execution_context(
        self,
        *,
        invoke_runtime_adapter_from_payload: Callable[
            ...,
            Awaitable[dict[str, Any]],
        ],
        execution_context: dict[str, Any],
    ) -> dict[str, Any]:
        return await invoke_runtime_adapter_from_payload(
            execution_context["runtime_invocation_request"],
            agent_metadata=execution_context["agent_metadata"],
        )

    @staticmethod
    def execution_context_view(execution_context: dict[str, Any]) -> dict[str, Any]:
        return {
            "agent_metadata": execution_context["agent_metadata"],
            "runtime_adapter": execution_context["runtime_adapter"],
            "tenant": execution_context["tenant"],
            "connector_label": execution_context["connector_label"],
            "connector_source": execution_context["connector_source"],
            "question": execution_context["question"],
            "configured_tools": execution_context["configured_tools"],
            "runner_agent_id": execution_context["runner_agent_id"],
            "runner_session_id": execution_context["runner_session_id"],
            "run_identity": execution_context["run_identity"],
            "response_record_context": execution_context["response_record_context"],
        }

    def resolve_runner_context(
        self,
        *,
        agent_metadata: dict[str, Any],
        agent: dict[str, Any] | None,
        user_id: str,
        session_id: str | None,
        default_tool_names: set[str],
        safe_path_part: Callable[[str], str],
    ) -> dict[str, Any]:
        configured_tools = (
            set(agent_metadata["configured_tools"])
            if agent is not None
            else set(default_tool_names)
        )
        runner_agent_id = (
            str(agent_metadata["agent_id"])
            if agent_metadata.get("agent_id")
            else "platform-agent-runner"
        )
        runner_session_id = (session_id or "").strip() or (
            f"platform-agent:{runner_agent_id}:{safe_path_part(user_id)}"
        )
        return {
            "configured_tools": configured_tools,
            "runner_agent_id": runner_agent_id,
            "runner_session_id": runner_session_id,
        }

    def knowledge_base_ids_from_metadata(
        self,
        agent_metadata: dict[str, Any],
    ) -> list[Any]:
        return list(agent_metadata.get("knowledge_base_ids") or [])

    def build_memory_context(
        self,
        *,
        memory_payload: dict[str, Any],
        memory_state: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "memory_payload": memory_payload,
            "memory_enabled": bool(memory_state["memory_enabled"]),
            "memory_hits": list(memory_state["memory_hits"]),
        }

    def prepare_memory_context_from_execution_context(
        self,
        *,
        build_agent_run_context: Callable[..., dict[str, Any]],
        agent_run_state: Callable[[dict[str, Any]], dict[str, Any]],
        execution_context: dict[str, Any],
        max_records: int,
        limit: int,
    ) -> dict[str, Any]:
        agent_metadata = execution_context["agent_metadata"]
        response_record_context = execution_context["response_record_context"]
        memory_payload = build_agent_run_context(
            enabled=bool(agent_metadata.get("memory_enabled", False)),
            tenant=str(execution_context["tenant"]),
            user_id=str(response_record_context["user_id"]),
            agent_id=str(execution_context["runner_agent_id"]),
            question=str(execution_context["question"]),
            max_records=max_records,
            limit=limit,
        )
        return self.build_memory_context(
            memory_payload=memory_payload,
            memory_state=agent_run_state(memory_payload),
        )

    @staticmethod
    def memory_context_view(memory_context: dict[str, Any]) -> dict[str, Any]:
        return {
            "memory_payload": memory_context["memory_payload"],
            "memory_hits": memory_context["memory_hits"],
        }

    def build_memory_append_context(
        self,
        *,
        enabled: bool,
        tenant: str,
        user_id: str,
        agent_id: str,
        session_id: str,
        question: str,
        answer: str,
        tool_calls: list[dict[str, Any]],
        knowledge_base_ids: list[Any],
        max_records: int,
    ) -> dict[str, Any]:
        return {
            "enabled": enabled,
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "session_id": session_id,
            "question": question,
            "answer": answer,
            "tool_calls": tool_calls,
            "knowledge_base_ids": knowledge_base_ids,
            "max_records": max_records,
        }

    def build_routed_memory_append_context(
        self,
        *,
        execution_context: dict[str, Any],
        memory_context: dict[str, Any],
        answer: str,
        tool_calls: list[dict[str, Any]],
        max_records: int,
    ) -> dict[str, Any]:
        response_record_context = execution_context["response_record_context"]
        return self.build_memory_append_context(
            enabled=bool(memory_context["memory_enabled"]),
            tenant=str(execution_context["tenant"]),
            user_id=str(response_record_context["user_id"]),
            agent_id=str(execution_context["runner_agent_id"]),
            session_id=str(execution_context["runner_session_id"]),
            question=str(execution_context["question"]),
            answer=answer,
            tool_calls=tool_calls,
            knowledge_base_ids=list(execution_context["knowledge_base_ids"]),
            max_records=max_records,
        )

    def append_routed_memory_from_context(
        self,
        *,
        append_agent_turn_if_enabled: Callable[..., bool],
        execution_context: dict[str, Any],
        memory_context: dict[str, Any],
        answer: str,
        tool_calls: list[dict[str, Any]],
        max_records: int,
    ) -> bool:
        return append_agent_turn_if_enabled(
            **self.build_routed_memory_append_context(
                execution_context=execution_context,
                memory_context=memory_context,
                answer=answer,
                tool_calls=tool_calls,
                max_records=max_records,
            ),
        )

    def build_unrouted_memory_append_context(
        self,
        *,
        execution_context: dict[str, Any],
        memory_context: dict[str, Any],
        answer: str,
        max_records: int,
    ) -> dict[str, Any]:
        response_record_context = execution_context["response_record_context"]
        return self.build_memory_append_context(
            enabled=bool(memory_context["memory_enabled"]),
            tenant=str(execution_context["tenant"]),
            user_id=str(response_record_context["user_id"]),
            agent_id=str(execution_context["runner_agent_id"]),
            session_id=str(execution_context["runner_session_id"]),
            question=str(execution_context["question"]),
            answer=answer,
            tool_calls=[],
            knowledge_base_ids=list(execution_context["knowledge_base_ids"]),
            max_records=max_records,
        )

    def append_unrouted_memory_from_context(
        self,
        *,
        append_agent_turn_if_enabled: Callable[..., bool],
        execution_context: dict[str, Any],
        memory_context: dict[str, Any],
        answer: str,
        max_records: int,
    ) -> bool:
        return append_agent_turn_if_enabled(
            **self.build_unrouted_memory_append_context(
                execution_context=execution_context,
                memory_context=memory_context,
                answer=answer,
                max_records=max_records,
            ),
        )

    def build_knowledge_context(
        self,
        *,
        knowledge_hits: list[dict[str, Any]],
        knowledge_error: str | None,
        knowledge_payload: dict[str, Any],
        retrieval_readiness: dict[str, Any],
        knowledge_document_readiness: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        context = {
            "knowledge_hits": list(knowledge_hits),
            "knowledge_error": knowledge_error,
            "knowledge_payload": knowledge_payload,
            "retrieval_readiness": retrieval_readiness,
        }
        if knowledge_document_readiness is not None:
            context["knowledge_document_readiness"] = knowledge_document_readiness
        return context

    @staticmethod
    def build_knowledge_document_readiness(
        *,
        knowledge_document_readiness_service: Any | None,
        tenant: str,
        knowledge_base_ids: list[str],
    ) -> dict[str, Any] | None:
        bound_ids = [
            str(knowledge_base_id).strip()
            for knowledge_base_id in knowledge_base_ids
            if str(knowledge_base_id).strip()
        ]
        if not bound_ids or knowledge_document_readiness_service is None:
            return None
        return knowledge_document_readiness_service.build_readiness(
            tenant_id=tenant,
            knowledge_base_ids=bound_ids,
        )

    @staticmethod
    def knowledge_document_readiness_blocks_retrieval(
        knowledge_document_readiness: dict[str, Any] | None,
    ) -> bool:
        if knowledge_document_readiness is None:
            return False
        return str(knowledge_document_readiness.get("status") or "") in {
            "blocked",
            "not_configured",
        }

    @staticmethod
    def knowledge_document_readiness_error(
        knowledge_document_readiness: dict[str, Any],
    ) -> str:
        guidance = str(knowledge_document_readiness.get("guidance") or "").strip()
        guidance_parts = [guidance] if guidance else []
        for knowledge_base in knowledge_document_readiness.get("knowledge_bases") or []:
            if not isinstance(knowledge_base, dict):
                continue
            knowledge_base_id = str(knowledge_base.get("id") or "").strip()
            for key in ("guidance", "embedding_guidance"):
                item_guidance = str(knowledge_base.get(key) or "").strip()
                if not item_guidance:
                    continue
                if knowledge_base_id:
                    item_guidance = f"{knowledge_base_id}: {item_guidance}"
                if item_guidance not in guidance_parts:
                    guidance_parts.append(item_guidance)
        if guidance_parts:
            return " ".join(guidance_parts)
        status = str(knowledge_document_readiness.get("status") or "blocked")
        return (
            "PostgreSQL knowledge documents are not ready for agent retrieval "
            f"(status: {status})."
        )

    async def prepare_knowledge_context_from_execution_context(
        self,
        *,
        search_agent_knowledge_bases: Callable[..., Any],
        build_agent_run_payload: Callable[..., dict[str, Any]],
        knowledge_base_service: Any,
        dev_knowledge_service: Any,
        dev_knowledge_provider: str,
        knowledge_document_readiness_service: Any | None = None,
        allow_dev_knowledge_fallback: bool = True,
        execution_context: dict[str, Any],
    ) -> dict[str, Any]:
        response_record_context = execution_context["response_record_context"]
        tenant = str(execution_context["tenant"])
        knowledge_base_ids = list(execution_context["knowledge_base_ids"])
        knowledge_document_readiness = self.build_knowledge_document_readiness(
            knowledge_document_readiness_service=knowledge_document_readiness_service,
            tenant=tenant,
            knowledge_base_ids=knowledge_base_ids,
        )
        if self.knowledge_document_readiness_blocks_retrieval(
            knowledge_document_readiness,
        ):
            knowledge_error = self.knowledge_document_readiness_error(
                knowledge_document_readiness or {},
            )
            retrieval_readiness = {
                "status": "blocked",
                "bound_knowledge_base_ids": [
                    str(knowledge_base_id).strip()
                    for knowledge_base_id in knowledge_base_ids
                    if str(knowledge_base_id).strip()
                ],
                "production_retriever_available": knowledge_base_service is not None,
                "production_hit_count": 0,
                "dev_fallback_hit_count": 0,
                "dev_fallback_used": False,
                "knowledge_error": knowledge_error,
                "guidance": "Resolve PostgreSQL document readiness before agent retrieval.",
            }
            knowledge_payload = build_agent_run_payload(
                knowledge_hits=[],
                knowledge_error=knowledge_error,
                retrieval_readiness=retrieval_readiness,
                knowledge_document_readiness=knowledge_document_readiness,
            )
            return self.build_knowledge_context(
                knowledge_hits=[],
                knowledge_error=knowledge_error,
                knowledge_payload=knowledge_payload,
                retrieval_readiness=retrieval_readiness,
                knowledge_document_readiness=knowledge_document_readiness,
            )

        knowledge_hits, knowledge_error, retrieval_readiness = await search_agent_knowledge_bases(
            knowledge_base_service=knowledge_base_service,
            dev_knowledge_service=dev_knowledge_service,
            dev_knowledge_provider=dev_knowledge_provider,
            user_id=str(response_record_context["user_id"]),
            tenant=tenant,
            question=str(execution_context["question"]),
            knowledge_base_ids=knowledge_base_ids,
            agent_run_id=str(execution_context["run_identity"]["turn_id"]),
            allow_dev_fallback=allow_dev_knowledge_fallback,
        )
        knowledge_payload = build_agent_run_payload(
            knowledge_hits=knowledge_hits,
            knowledge_error=knowledge_error,
            retrieval_readiness=retrieval_readiness,
            knowledge_document_readiness=knowledge_document_readiness,
        )
        return self.build_knowledge_context(
            knowledge_hits=knowledge_hits,
            knowledge_error=knowledge_error,
            knowledge_payload=knowledge_payload,
            retrieval_readiness=retrieval_readiness,
            knowledge_document_readiness=knowledge_document_readiness,
        )

    @staticmethod
    def knowledge_context_view(knowledge_context: dict[str, Any]) -> dict[str, Any]:
        return {
            "knowledge_hits": knowledge_context["knowledge_hits"],
            "knowledge_payload": knowledge_context["knowledge_payload"],
            "retrieval_readiness": knowledge_context["retrieval_readiness"],
            "knowledge_document_readiness": knowledge_context.get(
                "knowledge_document_readiness",
            ),
        }

    def build_routing_context(
        self,
        *,
        routing_state: dict[str, Any],
        routing_error: str | None,
    ) -> dict[str, Any]:
        return {
            "routing_mode": str(routing_state["routing_mode"]),
            "routing_source": str(routing_state["routing_source"]),
            "routing_error": routing_error,
        }

    async def prepare_routing_context_from_execution_context(
        self,
        *,
        select_routes_for_question: Callable[..., Any],
        routing_state_for: Callable[..., dict[str, Any]],
        execution_context: dict[str, Any],
        env: Any,
    ) -> dict[str, Any]:
        routes, routing_error = await select_routes_for_question(
            str(execution_context["question"]),
            env=env,
        )
        routing_context = self.build_routing_context(
            routing_state=routing_state_for(routes),
            routing_error=routing_error,
        )
        return {
            "routes": routes,
            "routing_context": routing_context,
        }

    @staticmethod
    def routing_context_view(routing_context: dict[str, Any]) -> dict[str, Any]:
        return {
            "routing_mode": routing_context["routing_mode"],
            "routing_source": routing_context["routing_source"],
            "routing_error": routing_context["routing_error"],
        }

    def summarize_routed_tool_calls(
        self,
        tool_calls: list[dict[str, Any]],
    ) -> dict[str, Any]:
        executed_tool_calls = [call for call in tool_calls if call.get("allowed")]
        primary_call = executed_tool_calls[0] if executed_tool_calls else tool_calls[0]
        routing_reason = "; ".join(
            f"{call['tool_name']}: {call.get('routing_reason', '')}"
            for call in tool_calls
        )
        return {
            "executed_tool_calls": executed_tool_calls,
            "primary_call": primary_call,
            "routing_reason": routing_reason,
            "routed": bool(executed_tool_calls),
        }

    def build_routed_summary_context(
        self,
        *,
        tool_calls: list[dict[str, Any]],
    ) -> dict[str, Any]:
        tool_call_summary = self.summarize_routed_tool_calls(tool_calls)
        return {
            "tool_call_summary": tool_call_summary,
            "primary_call": tool_call_summary["primary_call"],
            "routing_reason": str(tool_call_summary["routing_reason"]),
            "routed": bool(tool_call_summary["routed"]),
        }

    def build_routed_finalize_context(
        self,
        *,
        routed_summary_context: dict[str, Any],
        execution_context: dict[str, Any],
        answer: str,
        routing_mode: str,
        routing_source: str,
        routing_error: str | None,
        tool_calls: list[dict[str, Any]],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        knowledge_payload: dict[str, Any],
        memory_payload: dict[str, Any],
        memory_saved: bool,
    ) -> dict[str, Any]:
        execution_context_view = self.execution_context_view(execution_context)
        response_record_context = execution_context_view["response_record_context"]
        return {
            "primary_call": routed_summary_context["primary_call"],
            "response_record_context": response_record_context,
            "answer": answer,
            "routed": routed_summary_context["routed"],
            "session_id": str(execution_context_view["runner_session_id"]),
            "tenant": str(execution_context_view["tenant"]),
            "user_id": str(response_record_context["user_id"]),
            "agent_id": str(execution_context_view["runner_agent_id"]),
            "connector": str(execution_context_view["connector_label"]),
            "connector_source": str(execution_context_view["connector_source"]),
            "routing_mode": routing_mode,
            "routing_source": routing_source,
            "routing_reason": routed_summary_context["routing_reason"],
            "routing_error": routing_error,
            "agent_metadata": execution_context_view["agent_metadata"],
            "runtime_adapter": execution_context_view["runtime_adapter"],
            "run_identity": execution_context_view["run_identity"],
            "tool_calls": tool_calls,
            "knowledge_hits": knowledge_hits,
            "memory_hits": memory_hits,
            "knowledge_payload": knowledge_payload,
            "memory_payload": memory_payload,
            "memory_saved": memory_saved,
        }

    def finalize_routed_response_from_context(
        self,
        *,
        build_runtime_invocation_result_payload: Callable[..., dict[str, Any]],
        routed_summary_context: dict[str, Any],
        execution_context: dict[str, Any],
        answer: str,
        routing_mode: str,
        routing_source: str,
        routing_error: str | None,
        tool_calls: list[dict[str, Any]],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        knowledge_payload: dict[str, Any],
        memory_payload: dict[str, Any],
        memory_saved: bool,
        runtime_boundary_result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self.finalize_routed_response(
            build_runtime_invocation_result_payload=(
                build_runtime_invocation_result_payload
            ),
            runtime_boundary_result=runtime_boundary_result,
            **self.build_routed_finalize_context(
                routed_summary_context=routed_summary_context,
                execution_context=execution_context,
                answer=answer,
                routing_mode=routing_mode,
                routing_source=routing_source,
                routing_error=routing_error,
                tool_calls=tool_calls,
                knowledge_hits=knowledge_hits,
                memory_hits=memory_hits,
                knowledge_payload=knowledge_payload,
                memory_payload=memory_payload,
                memory_saved=memory_saved,
            ),
        )

    def finalize_routed_run_from_context(
        self,
        *,
        build_runtime_invocation_result_payload: Callable[..., dict[str, Any]],
        append_agent_turn_if_enabled: Callable[..., bool],
        execution_context: dict[str, Any],
        memory_context: dict[str, Any],
        tool_calls: list[dict[str, Any]],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        format_knowledge_answer: Callable[[list[dict[str, Any]]], str],
        format_memory_answer: Callable[[list[dict[str, Any]]], str],
        routing_mode: str,
        routing_source: str,
        routing_error: str | None,
        knowledge_payload: dict[str, Any],
        memory_payload: dict[str, Any],
        max_records: int,
        runtime_boundary_result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        routed_summary_context = self.build_routed_summary_context(
            tool_calls=tool_calls,
        )
        answer = self.compose_routed_answer_from_context(
            tool_calls=tool_calls,
            knowledge_hits=knowledge_hits,
            memory_hits=memory_hits,
            format_knowledge_answer=format_knowledge_answer,
            format_memory_answer=format_memory_answer,
        )
        memory_saved = self.append_routed_memory_from_context(
            append_agent_turn_if_enabled=append_agent_turn_if_enabled,
            execution_context=execution_context,
            memory_context=memory_context,
            answer=answer,
            tool_calls=tool_calls,
            max_records=max_records,
        )
        return self.finalize_routed_response_from_context(
            build_runtime_invocation_result_payload=(
                build_runtime_invocation_result_payload
            ),
            routed_summary_context=routed_summary_context,
            execution_context=execution_context,
            answer=answer,
            routing_mode=routing_mode,
            routing_source=routing_source,
            routing_error=routing_error,
            tool_calls=tool_calls,
            knowledge_hits=knowledge_hits,
            memory_hits=memory_hits,
            knowledge_payload=knowledge_payload,
            memory_payload=memory_payload,
            memory_saved=memory_saved,
            runtime_boundary_result=runtime_boundary_result,
        )

    def finalize_unrouted_run_from_context(
        self,
        *,
        build_runtime_invocation_result_payload: Callable[..., dict[str, Any]],
        append_agent_turn_if_enabled: Callable[..., bool],
        execution_context: dict[str, Any],
        memory_context: dict[str, Any],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        format_knowledge_answer: Callable[[list[dict[str, Any]]], str],
        format_memory_answer: Callable[[list[dict[str, Any]]], str],
        routing_mode: str,
        routing_source: str,
        routing_error: str | None,
        knowledge_payload: dict[str, Any],
        memory_payload: dict[str, Any],
        max_records: int,
        decision: dict[str, Any],
        runtime_boundary_result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        answer = self.compose_unrouted_answer_from_context(
            knowledge_hits=knowledge_hits,
            memory_hits=memory_hits,
            format_knowledge_answer=format_knowledge_answer,
            format_memory_answer=format_memory_answer,
        )
        memory_saved = self.append_unrouted_memory_from_context(
            append_agent_turn_if_enabled=append_agent_turn_if_enabled,
            execution_context=execution_context,
            memory_context=memory_context,
            answer=answer,
            max_records=max_records,
        )
        return self.finalize_unrouted_response_from_context(
            build_runtime_invocation_result_payload=(
                build_runtime_invocation_result_payload
            ),
            execution_context=execution_context,
            answer=answer,
            routing_mode=routing_mode,
            routing_source=routing_source,
            routing_error=routing_error,
            knowledge_hits=knowledge_hits,
            memory_hits=memory_hits,
            knowledge_payload=knowledge_payload,
            memory_payload=memory_payload,
            memory_saved=memory_saved,
            decision=decision,
            runtime_boundary_result=runtime_boundary_result,
        )

    def build_unrouted_finalize_context(
        self,
        *,
        execution_context: dict[str, Any],
        answer: str,
        routing_mode: str,
        routing_source: str,
        routing_error: str | None,
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        knowledge_payload: dict[str, Any],
        memory_payload: dict[str, Any],
        memory_saved: bool,
        decision: dict[str, Any],
    ) -> dict[str, Any]:
        execution_context_view = self.execution_context_view(execution_context)
        response_record_context = execution_context_view["response_record_context"]
        return {
            "response_record_context": response_record_context,
            "answer": answer,
            "session_id": str(execution_context_view["runner_session_id"]),
            "tenant": str(execution_context_view["tenant"]),
            "user_id": str(response_record_context["user_id"]),
            "agent_id": str(execution_context_view["runner_agent_id"]),
            "connector": str(execution_context_view["connector_label"]),
            "connector_source": str(execution_context_view["connector_source"]),
            "routing_mode": routing_mode,
            "routing_source": routing_source,
            "routing_reason": str(decision["routing_reason"]),
            "routing_error": routing_error,
            "agent_metadata": execution_context_view["agent_metadata"],
            "runtime_adapter": execution_context_view["runtime_adapter"],
            "run_identity": execution_context_view["run_identity"],
            "knowledge_hits": knowledge_hits,
            "memory_hits": memory_hits,
            "knowledge_payload": knowledge_payload,
            "memory_payload": memory_payload,
            "memory_saved": memory_saved,
            "decision": decision,
        }

    def finalize_unrouted_response_from_context(
        self,
        *,
        build_runtime_invocation_result_payload: Callable[..., dict[str, Any]],
        execution_context: dict[str, Any],
        answer: str,
        routing_mode: str,
        routing_source: str,
        routing_error: str | None,
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        knowledge_payload: dict[str, Any],
        memory_payload: dict[str, Any],
        memory_saved: bool,
        decision: dict[str, Any],
        runtime_boundary_result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self.finalize_unrouted_response(
            build_runtime_invocation_result_payload=(
                build_runtime_invocation_result_payload
            ),
            runtime_boundary_result=runtime_boundary_result,
            **self.build_unrouted_finalize_context(
                execution_context=execution_context,
                answer=answer,
                routing_mode=routing_mode,
                routing_source=routing_source,
                routing_error=routing_error,
                knowledge_hits=knowledge_hits,
                memory_hits=memory_hits,
                knowledge_payload=knowledge_payload,
                memory_payload=memory_payload,
                memory_saved=memory_saved,
                decision=decision,
            ),
        )

    def compose_routed_answer(
        self,
        *,
        tool_calls: list[dict[str, Any]],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        format_knowledge_answer: Callable[[list[dict[str, Any]]], str],
        format_memory_answer: Callable[[list[dict[str, Any]]], str],
    ) -> str:
        answer_parts = [
            f"工具 {call['tool_name']}: {call['answer']}"
            for call in tool_calls
            if call.get("answer")
        ]
        if knowledge_hits:
            answer_parts.append(
                f"知识库: {format_knowledge_answer(knowledge_hits)}",
            )
        if memory_hits:
            answer_parts.insert(
                0,
                f"长期记忆: {format_memory_answer(memory_hits)}",
            )
        return "\n\n".join(answer_parts)

    def build_routed_answer_context(
        self,
        *,
        tool_calls: list[dict[str, Any]],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        format_knowledge_answer: Callable[[list[dict[str, Any]]], str],
        format_memory_answer: Callable[[list[dict[str, Any]]], str],
    ) -> dict[str, Any]:
        return {
            "tool_calls": tool_calls,
            "knowledge_hits": knowledge_hits,
            "memory_hits": memory_hits,
            "format_knowledge_answer": format_knowledge_answer,
            "format_memory_answer": format_memory_answer,
        }

    def compose_routed_answer_from_context(
        self,
        *,
        tool_calls: list[dict[str, Any]],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        format_knowledge_answer: Callable[[list[dict[str, Any]]], str],
        format_memory_answer: Callable[[list[dict[str, Any]]], str],
    ) -> str:
        return self.compose_routed_answer(
            **self.build_routed_answer_context(
                tool_calls=tool_calls,
                knowledge_hits=knowledge_hits,
                memory_hits=memory_hits,
                format_knowledge_answer=format_knowledge_answer,
                format_memory_answer=format_memory_answer,
            ),
        )

    def compose_unrouted_answer(
        self,
        *,
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        format_knowledge_answer: Callable[[list[dict[str, Any]]], str],
        format_memory_answer: Callable[[list[dict[str, Any]]], str],
    ) -> str:
        if knowledge_hits:
            return format_knowledge_answer(knowledge_hits)
        if memory_hits:
            return format_memory_answer(memory_hits)
        return (
            "这个演示 Agent 暂时只会处理三类问题：工单状态、制度查询、"
            "部门指标。你可以试试：帮我查一下 INC-1001 的工单状态。"
        )

    def build_unrouted_answer_context(
        self,
        *,
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        format_knowledge_answer: Callable[[list[dict[str, Any]]], str],
        format_memory_answer: Callable[[list[dict[str, Any]]], str],
    ) -> dict[str, Any]:
        return {
            "knowledge_hits": knowledge_hits,
            "memory_hits": memory_hits,
            "format_knowledge_answer": format_knowledge_answer,
            "format_memory_answer": format_memory_answer,
        }

    def compose_unrouted_answer_from_context(
        self,
        *,
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        format_knowledge_answer: Callable[[list[dict[str, Any]]], str],
        format_memory_answer: Callable[[list[dict[str, Any]]], str],
    ) -> str:
        return self.compose_unrouted_answer(
            **self.build_unrouted_answer_context(
                knowledge_hits=knowledge_hits,
                memory_hits=memory_hits,
                format_knowledge_answer=format_knowledge_answer,
                format_memory_answer=format_memory_answer,
            ),
        )

    def normalize_route_context(
        self,
        route: dict[str, Any],
        *,
        default_source: str,
    ) -> dict[str, Any]:
        return {
            "tool_name": str(route["tool_name"]),
            "inputs": dict(route["inputs"]),
            "reason": str(route.get("reason", "Matched enterprise tool route.")),
            "source": str(route.get("source", default_source)),
        }

    @staticmethod
    def route_context_view(route_context: dict[str, Any]) -> dict[str, Any]:
        return {
            "tool_name": route_context["tool_name"],
            "inputs": route_context["inputs"],
            "reason": route_context["reason"],
            "source": route_context["source"],
        }

    def process_routed_routes(
        self,
        *,
        routes: list[dict[str, Any]],
        default_source: str,
        tool_denial_payload: Callable[..., dict[str, Any]],
        decision_with_routing_context: Callable[..., dict[str, Any]],
        execution_context: dict[str, Any],
        require_platform_approval: Callable[..., str | None],
        approval_exception_type: type[Exception],
        run_request: dict[str, Any],
        approval_required_tools: set[str],
        platform_approval_service: Callable[[], Any],
        raise_platform_approval_service_error: Callable[
            [PlatformApprovalServiceError],
            Any,
        ],
        run_authorized_enterprise_tool: Callable[..., dict[str, Any]],
        format_tool_result_answer: Callable[..., str],
        headers: Any,
        routing_mode: str,
        routing_error: str | None,
    ) -> list[dict[str, Any]]:
        route_context_views = [
            self.route_context_view(
                self.normalize_route_context(route, default_source=default_source)
            )
            for route in routes
        ]
        tool_calls: list[dict[str, Any]] = []
        for route_context_view in route_context_views:
            if self.record_unconfigured_routed_tool_denial_from_context(
                tool_calls=tool_calls,
                tool_denial_payload=tool_denial_payload,
                decision_with_routing_context=decision_with_routing_context,
                execution_context=execution_context,
                route_context_view=route_context_view,
                routing_mode=routing_mode,
                routing_error=routing_error,
            ):
                continue

            try:
                execution_context_view = self.execution_context_view(execution_context)
                response_record_context = execution_context_view[
                    "response_record_context"
                ]
                approved_by = self.resolve_routed_tool_approval_from_context(
                    require_platform_approval=require_platform_approval,
                    run_request=run_request,
                    approval_required_tools=approval_required_tools,
                    tool_name=route_context_view["tool_name"],
                    tenant=execution_context_view["tenant"],
                    user_id=response_record_context["user_id"],
                    agent_id=execution_context_view["runner_agent_id"],
                    inputs=route_context_view["inputs"],
                )
            except approval_exception_type as exc:
                self.record_pending_tool_approval_from_exception_context(
                    exc=exc,
                    tool_calls=tool_calls,
                    platform_approval_service=platform_approval_service,
                    raise_platform_approval_service_error=(
                        raise_platform_approval_service_error
                    ),
                    decision_with_routing_context=decision_with_routing_context,
                    execution_context=execution_context,
                    route_context_view=route_context_view,
                    headers=headers,
                    routing_mode=routing_mode,
                    routing_error=routing_error,
                )
                continue

            self.run_and_record_executed_routed_tool_call_from_context(
                tool_calls=tool_calls,
                run_authorized_enterprise_tool=run_authorized_enterprise_tool,
                decision_with_routing_context=decision_with_routing_context,
                format_tool_result_answer=format_tool_result_answer,
                execution_context=execution_context,
                route_context_view=route_context_view,
                routing_mode=routing_mode,
                routing_error=routing_error,
                approval_id=approved_by,
            )
        return tool_calls

    def build_routed_decision_context(
        self,
        *,
        routing_reason: str,
        routing_source: str,
        routing_mode: str,
        routing_error: str | None,
    ) -> dict[str, Any]:
        return {
            "routing_reason": routing_reason,
            "routing_source": routing_source,
            "routing_mode": routing_mode,
            "routing_error": routing_error,
        }

    def resolve_routed_tool_approval_from_context(
        self,
        *,
        require_platform_approval: Callable[..., str | None],
        run_request: dict[str, Any],
        approval_required_tools: set[str],
        tool_name: str,
        tenant: str,
        user_id: str,
        agent_id: str,
        inputs: dict[str, Any],
    ) -> str | None:
        if tool_name not in approval_required_tools:
            return None
        return require_platform_approval(
            approval_id=run_request["approval_id"],
            request_type="tool_run",
            target_key="tool_name",
            target_value=tool_name,
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            inputs=inputs,
        )

    def build_denied_routed_tool_call(
        self,
        *,
        tool_name: str,
        inputs: dict[str, Any],
        tenant: str,
        user_id: str,
        connector: str,
        connector_source: str,
        routing_source: str,
        routing_reason: str,
        decision: dict[str, Any],
        answer: str,
    ) -> dict[str, Any]:
        return {
            "tool_name": tool_name,
            "inputs": inputs,
            "allowed": False,
            "tenant": tenant,
            "user_id": user_id,
            "connector": connector,
            "connector_source": connector_source,
            "routing_source": routing_source,
            "routing_reason": routing_reason,
            "decision": decision,
            "answer": answer,
        }

    def append_denied_routed_tool_call(
        self,
        *,
        tool_calls: list[dict[str, Any]],
        tool_name: str,
        inputs: dict[str, Any],
        tenant: str,
        user_id: str,
        connector: str,
        connector_source: str,
        routing_source: str,
        routing_reason: str,
        decision: dict[str, Any],
        answer: str,
    ) -> None:
        tool_calls.append(
            self.build_denied_routed_tool_call(
                tool_name=tool_name,
                inputs=inputs,
                tenant=tenant,
                user_id=user_id,
                connector=connector,
                connector_source=connector_source,
                routing_source=routing_source,
                routing_reason=routing_reason,
                decision=decision,
                answer=answer,
            ),
        )

    def record_denied_routed_tool_call_from_context(
        self,
        *,
        tool_calls: list[dict[str, Any]],
        decision_with_routing_context: Callable[..., dict[str, Any]],
        denial: dict[str, Any],
        execution_context: dict[str, Any],
        route_context_view: dict[str, Any],
        routing_mode: str,
        routing_error: str | None,
    ) -> None:
        execution_context_view = self.execution_context_view(execution_context)
        response_record_context = execution_context_view["response_record_context"]
        self.append_denied_routed_tool_call(
            tool_calls=tool_calls,
            tool_name=route_context_view["tool_name"],
            inputs=route_context_view["inputs"],
            tenant=execution_context_view["tenant"],
            user_id=response_record_context["user_id"],
            connector=execution_context_view["connector_label"],
            connector_source=execution_context_view["connector_source"],
            routing_source=route_context_view["source"],
            routing_reason=route_context_view["reason"],
            decision=decision_with_routing_context(
                decision=denial,
                **self.build_routed_decision_context(
                    routing_reason=route_context_view["reason"],
                    routing_source=route_context_view["source"],
                    routing_mode=routing_mode,
                    routing_error=routing_error,
                ),
            ),
            answer=str(denial["reason"]),
        )

    def record_unconfigured_routed_tool_denial_from_context(
        self,
        *,
        tool_calls: list[dict[str, Any]],
        tool_denial_payload: Callable[..., dict[str, Any]],
        decision_with_routing_context: Callable[..., dict[str, Any]],
        execution_context: dict[str, Any],
        route_context_view: dict[str, Any],
        routing_mode: str,
        routing_error: str | None,
    ) -> bool:
        execution_context_view = self.execution_context_view(execution_context)
        if route_context_view["tool_name"] in execution_context_view["configured_tools"]:
            return False
        self.record_denied_routed_tool_call_from_context(
            tool_calls=tool_calls,
            decision_with_routing_context=decision_with_routing_context,
            denial=tool_denial_payload(route_context_view["tool_name"]),
            execution_context=execution_context,
            route_context_view=route_context_view,
            routing_mode=routing_mode,
            routing_error=routing_error,
        )
        return True

    def build_pending_approval_routed_tool_call(
        self,
        *,
        tool_name: str,
        inputs: dict[str, Any],
        approval_id: str,
        tenant: str,
        user_id: str,
        connector: str,
        connector_source: str,
        routing_source: str,
        routing_reason: str,
        decision: dict[str, Any],
        answer: str,
    ) -> dict[str, Any]:
        return {
            "tool_name": tool_name,
            "inputs": inputs,
            "allowed": False,
            "approval_required": True,
            "approval_id": approval_id,
            "approval_status": "pending",
            "tenant": tenant,
            "user_id": user_id,
            "connector": connector,
            "connector_source": connector_source,
            "routing_source": routing_source,
            "routing_reason": routing_reason,
            "decision": decision,
            "answer": answer,
        }

    def append_pending_approval_routed_tool_call(
        self,
        *,
        tool_calls: list[dict[str, Any]],
        tool_name: str,
        inputs: dict[str, Any],
        approval_id: str,
        tenant: str,
        user_id: str,
        connector: str,
        connector_source: str,
        routing_source: str,
        routing_reason: str,
        decision: dict[str, Any],
        answer: str,
    ) -> None:
        tool_calls.append(
            self.build_pending_approval_routed_tool_call(
                tool_name=tool_name,
                inputs=inputs,
                approval_id=approval_id,
                tenant=tenant,
                user_id=user_id,
                connector=connector,
                connector_source=connector_source,
                routing_source=routing_source,
                routing_reason=routing_reason,
                decision=decision,
                answer=answer,
            ),
        )

    def record_created_pending_approval_routed_tool_call_from_context(
        self,
        *,
        tool_calls: list[dict[str, Any]],
        decision_with_routing_context: Callable[..., dict[str, Any]],
        detail: dict[str, Any],
        approval: dict[str, Any],
        tool_name: str,
        inputs: dict[str, Any],
        tenant: str,
        user_id: str,
        connector: str,
        connector_source: str,
        routing_source: str,
        routing_reason: str,
        routing_mode: str,
        routing_error: str | None,
    ) -> None:
        approval_id = str(approval["approval_id"])
        pending_approval_context = self.build_pending_approval_response_context(
            detail=detail,
            approval_id=approval_id,
        )
        self.append_pending_approval_routed_tool_call(
            tool_calls=tool_calls,
            tool_name=tool_name,
            inputs=inputs,
            approval_id=approval_id,
            tenant=tenant,
            user_id=user_id,
            connector=connector,
            connector_source=connector_source,
            routing_source=routing_source,
            routing_reason=routing_reason,
            decision=decision_with_routing_context(
                decision=dict(pending_approval_context["decision_payload"]),
                **self.build_routed_decision_context(
                    routing_reason=routing_reason,
                    routing_source=routing_source,
                    routing_mode=routing_mode,
                    routing_error=routing_error,
                ),
            ),
            answer=str(pending_approval_context["approval_message"]),
        )

    def build_pending_approval_response_context(
        self,
        *,
        detail: dict[str, Any],
        approval_id: str,
    ) -> dict[str, Any]:
        reason = self.resolve_approval_required_reason(detail=detail)
        return {
            "approval_message": (
                f"该工具需要审批，已自动创建审批请求 {approval_id}。"
                "请到审批中心批准后再运行。"
            ),
            "decision_payload": {
                "allowed": False,
                "reason": reason,
                "approval_required": True,
                "approval_id": approval_id,
                "approval_status": "pending",
            },
        }

    def resolve_requested_by(self, *, headers: Any, user_id: str) -> str:
        return str(headers.get("X-User-ID") or user_id)

    @staticmethod
    def approval_exception_detail(exc: Any) -> dict[str, Any]:
        return exc.detail if isinstance(exc.detail, dict) else {}

    def is_approval_required_exception(
        self,
        *,
        status_code: int,
        detail: dict[str, Any],
    ) -> bool:
        return status_code == 403 and bool(detail.get("approval_required"))

    def approval_required_exception_detail(self, exc: Any) -> dict[str, Any] | None:
        detail = self.approval_exception_detail(exc)
        if not self.is_approval_required_exception(
            status_code=exc.status_code,
            detail=detail,
        ):
            return None
        return detail

    def require_approval_required_exception_detail(
        self,
        exc: Any,
    ) -> dict[str, Any]:
        detail = self.approval_required_exception_detail(exc)
        if detail is None:
            raise exc
        return detail

    def resolve_approval_required_reason(self, *, detail: dict[str, Any]) -> str:
        return str(
            detail.get(
                "message",
                "该工具需要审批后才能运行。",
            ),
        )

    def build_approval_request_payload(
        self,
        *,
        detail: dict[str, Any],
        tenant: str,
        user_id: str,
        agent_id: str,
        tool_name: str,
        inputs: dict[str, Any],
        requested_by: str,
    ) -> dict[str, Any]:
        return {
            "request_type": "tool_run",
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "tool_name": tool_name,
            "inputs": inputs,
            "reason": self.resolve_approval_required_reason(detail=detail),
            "requested_by": requested_by,
        }

    def create_pending_approval_request(
        self,
        *,
        create_request: Callable[..., dict[str, Any]],
        detail: dict[str, Any],
        tenant: str,
        user_id: str,
        agent_id: str,
        tool_name: str,
        inputs: dict[str, Any],
        headers: Any,
    ) -> dict[str, Any]:
        return create_request(
            **self.build_approval_request_payload(
                detail=detail,
                tenant=tenant,
                user_id=user_id,
                agent_id=agent_id,
                tool_name=tool_name,
                inputs=inputs,
                requested_by=self.resolve_requested_by(
                    headers=headers,
                    user_id=user_id,
                ),
            ),
        )

    def create_pending_tool_approval_request_or_raise_from_context(
        self,
        *,
        platform_approval_service: Callable[[], Any],
        raise_platform_approval_service_error: Callable[
            [PlatformApprovalServiceError],
            Any,
        ],
        detail: dict[str, Any],
        execution_context: dict[str, Any],
        route_context_view: dict[str, Any],
        headers: Any,
    ) -> dict[str, Any]:
        try:
            execution_context_view = self.execution_context_view(execution_context)
            response_record_context = execution_context_view[
                "response_record_context"
            ]
            return self.create_pending_approval_request(
                create_request=platform_approval_service().create_request,
                detail=detail,
                tenant=execution_context_view["tenant"],
                user_id=response_record_context["user_id"],
                agent_id=execution_context_view["runner_agent_id"],
                tool_name=route_context_view["tool_name"],
                inputs=route_context_view["inputs"],
                headers=headers,
            )
        except PlatformApprovalServiceError as exc:
            raise_platform_approval_service_error(exc)
            raise

    def record_pending_tool_approval_from_exception_context(
        self,
        *,
        exc: Any,
        tool_calls: list[dict[str, Any]],
        platform_approval_service: Callable[[], Any],
        raise_platform_approval_service_error: Callable[
            [PlatformApprovalServiceError],
            Any,
        ],
        decision_with_routing_context: Callable[..., dict[str, Any]],
        execution_context: dict[str, Any],
        route_context_view: dict[str, Any],
        headers: Any,
        routing_mode: str,
        routing_error: str | None,
    ) -> None:
        execution_context_view = self.execution_context_view(execution_context)
        response_record_context = execution_context_view["response_record_context"]
        detail = self.require_approval_required_exception_detail(exc)
        approval = self.create_pending_tool_approval_request_or_raise_from_context(
            platform_approval_service=platform_approval_service,
            raise_platform_approval_service_error=(
                raise_platform_approval_service_error
            ),
            detail=detail,
            execution_context=execution_context,
            route_context_view=route_context_view,
            headers=headers,
        )
        self.record_created_pending_approval_routed_tool_call_from_context(
            tool_calls=tool_calls,
            decision_with_routing_context=decision_with_routing_context,
            detail=detail,
            approval=approval,
            tool_name=route_context_view["tool_name"],
            inputs=route_context_view["inputs"],
            tenant=execution_context_view["tenant"],
            user_id=response_record_context["user_id"],
            connector=execution_context_view["connector_label"],
            connector_source=execution_context_view["connector_source"],
            routing_source=route_context_view["source"],
            routing_reason=route_context_view["reason"],
            routing_mode=routing_mode,
            routing_error=routing_error,
        )

    def append_executed_routed_tool_call(
        self,
        *,
        tool_calls: list[dict[str, Any]],
        tool_name: str,
        inputs: dict[str, Any],
        tool_response: dict[str, Any],
        connector: str,
        connector_source: str,
        routing_source: str,
        routing_reason: str,
        approval_id: str | None,
        decision: dict[str, Any],
        answer: str,
    ) -> None:
        tool_calls.append(
            self.build_executed_routed_tool_call(
                tool_name=tool_name,
                inputs=inputs,
                allowed=bool(tool_response.get("allowed")),
                tenant=str(tool_response["tenant"]),
                user_id=str(tool_response["user_id"]),
                connector=str(tool_response.get("connector", connector)),
                connector_source=str(tool_response.get("connector_source", connector_source)),
                routing_source=routing_source,
                routing_reason=routing_reason,
                approval_id=approval_id,
                decision=decision,
                result=tool_response.get("result"),
                answer=answer,
            ),
        )

    def record_executed_routed_tool_call_from_context(
        self,
        *,
        tool_calls: list[dict[str, Any]],
        decision_with_routing_context: Callable[..., dict[str, Any]],
        format_tool_result_answer: Callable[..., str],
        execution_context: dict[str, Any],
        route_context_view: dict[str, Any],
        tool_response: dict[str, Any],
        routing_mode: str,
        routing_error: str | None,
        approval_id: str | None,
    ) -> None:
        execution_context_view = self.execution_context_view(execution_context)
        decision = decision_with_routing_context(
            decision=dict(tool_response["decision"]),
            **self.build_routed_decision_context(
                routing_reason=route_context_view["reason"],
                routing_source=route_context_view["source"],
                routing_mode=routing_mode,
                routing_error=routing_error,
            ),
        )
        answer = format_tool_result_answer(
            tool_name=route_context_view["tool_name"],
            result=tool_response.get("result"),
            tenant=str(tool_response["tenant"]),
        )
        self.append_executed_routed_tool_call(
            tool_calls=tool_calls,
            tool_name=route_context_view["tool_name"],
            inputs=route_context_view["inputs"],
            tool_response=tool_response,
            connector=execution_context_view["connector_label"],
            connector_source=execution_context_view["connector_source"],
            routing_source=route_context_view["source"],
            routing_reason=route_context_view["reason"],
            approval_id=approval_id,
            decision=decision,
            answer=answer,
        )

    def run_and_record_executed_routed_tool_call_from_context(
        self,
        *,
        tool_calls: list[dict[str, Any]],
        run_authorized_enterprise_tool: Callable[..., dict[str, Any]],
        decision_with_routing_context: Callable[..., dict[str, Any]],
        format_tool_result_answer: Callable[..., str],
        execution_context: dict[str, Any],
        route_context_view: dict[str, Any],
        routing_mode: str,
        routing_error: str | None,
        approval_id: str | None,
    ) -> None:
        execution_context_view = self.execution_context_view(execution_context)
        response_record_context = execution_context_view["response_record_context"]
        tool_response = run_authorized_enterprise_tool(
            user_id=response_record_context["user_id"],
            tool_name=route_context_view["tool_name"],
            inputs=route_context_view["inputs"],
            agent_id=execution_context_view["runner_agent_id"],
            session_id=execution_context_view["runner_session_id"],
            fail_on_denied=False,
        )
        self.record_executed_routed_tool_call_from_context(
            tool_calls=tool_calls,
            decision_with_routing_context=decision_with_routing_context,
            format_tool_result_answer=format_tool_result_answer,
            execution_context=execution_context,
            route_context_view=route_context_view,
            tool_response=tool_response,
            routing_mode=routing_mode,
            routing_error=routing_error,
            approval_id=approval_id,
        )

    def build_executed_routed_tool_call(
        self,
        *,
        tool_name: str,
        inputs: dict[str, Any],
        allowed: bool,
        tenant: str,
        user_id: str,
        connector: str,
        connector_source: str,
        routing_source: str,
        routing_reason: str,
        approval_id: str | None,
        decision: dict[str, Any],
        result: Any,
        answer: str,
    ) -> dict[str, Any]:
        return {
            "tool_name": tool_name,
            "inputs": inputs,
            "allowed": allowed,
            "tenant": tenant,
            "user_id": user_id,
            "connector": connector,
            "connector_source": connector_source,
            "routing_source": routing_source,
            "routing_reason": routing_reason,
            "approval_id": approval_id,
            "decision": decision,
            "result": result,
            "answer": answer,
        }

    def build_evidence(
        self,
        *,
        turn_id: str,
        created_at: str,
        tenant: str,
        user_id: str,
        agent_id: str,
        session_id: str,
        tool_calls: list[dict[str, Any]],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        memory_saved: bool,
    ) -> dict[str, Any]:
        """Build a compact evidence summary for enterprise traceability."""
        allowed_tool_calls = [call for call in tool_calls if call.get("allowed")]
        denied_tool_calls = [
            call for call in tool_calls if call.get("allowed") is False
        ]
        approval_required_calls = [
            call for call in tool_calls if call.get("approval_required")
        ]
        approval_ids = sorted(
            {
                str(call.get("approval_id"))
                for call in tool_calls
                if call.get("approval_id")
            },
        )
        tool_names = [
            str(call.get("tool_name"))
            for call in tool_calls
            if call.get("tool_name")
        ]
        audit_filter: dict[str, Any] = {
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "session_id": session_id,
        }
        if tool_names:
            audit_filter["tool_names"] = sorted(set(tool_names))
        if approval_ids:
            audit_filter["approval_ids"] = approval_ids

        dev_fallback_hit_count = sum(
            1
            for hit in knowledge_hits
            if (
                hit.get("retrieval_source") == "dev_fallback"
                or bool((hit.get("metadata") or {}).get("dev_fallback"))
            )
        )
        production_knowledge_hit_count = len(knowledge_hits) - dev_fallback_hit_count

        return {
            "run_id": turn_id,
            "turn_id": turn_id,
            "created_at": created_at,
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "session_id": session_id,
            "tool_call_count": len(tool_calls),
            "allowed_tool_call_count": len(allowed_tool_calls),
            "denied_tool_call_count": len(denied_tool_calls),
            "approval_required_count": len(approval_required_calls),
            "approval_ids": approval_ids,
            "knowledge_hit_count": len(knowledge_hits),
            "production_knowledge_hit_count": production_knowledge_hit_count,
            "dev_fallback_knowledge_hit_count": dev_fallback_hit_count,
            "dev_fallback_knowledge_used": dev_fallback_hit_count > 0,
            "memory_hit_count": len(memory_hits),
            "memory_saved": memory_saved,
            "audit_filter": audit_filter,
        }

    def build_unrouted_response(
        self,
        *,
        answer: str,
        turn_id: str,
        session_id: str,
        tenant: str,
        user_id: str,
        connector: str,
        connector_source: str,
        routing_mode: str,
        routing_source: str,
        routing_reason: str,
        routing_error: str | None,
        agent_metadata: dict[str, Any],
        runtime_adapter: dict[str, Any],
        knowledge_payload: dict[str, Any],
        memory_payload: dict[str, Any],
        memory_saved: bool,
        decision: dict[str, Any],
        evidence: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "answer": answer,
            "routed": False,
            "turn_id": turn_id,
            "session_id": session_id,
            "tenant": tenant,
            "user_id": user_id,
            "connector": connector,
            "connector_source": connector_source,
            "routing_mode": routing_mode,
            "routing_source": routing_source,
            "routing_reason": routing_reason,
            **({"routing_error": routing_error} if routing_error else {}),
            **agent_metadata,
            "runtime_adapter": runtime_adapter,
            **knowledge_payload,
            **memory_payload,
            "memory_saved": memory_saved,
            "decision": decision,
            "tool_calls": [],
            "evidence": evidence,
        }

    def build_unrouted_response_from_trace(
        self,
        *,
        response_trace: dict[str, Any],
        answer: str,
        session_id: str,
        tenant: str,
        user_id: str,
        connector: str,
        connector_source: str,
        routing_mode: str,
        routing_source: str,
        routing_reason: str,
        routing_error: str | None,
        agent_metadata: dict[str, Any],
        runtime_adapter: dict[str, Any],
        knowledge_payload: dict[str, Any],
        memory_payload: dict[str, Any],
        memory_saved: bool,
        decision: dict[str, Any],
    ) -> dict[str, Any]:
        return self.build_unrouted_response(
            answer=answer,
            turn_id=str(response_trace["turn_id"]),
            session_id=session_id,
            tenant=tenant,
            user_id=user_id,
            connector=connector,
            connector_source=connector_source,
            routing_mode=routing_mode,
            routing_source=routing_source,
            routing_reason=routing_reason,
            routing_error=routing_error,
            agent_metadata=agent_metadata,
            runtime_adapter=runtime_adapter,
            knowledge_payload=knowledge_payload,
            memory_payload=memory_payload,
            memory_saved=memory_saved,
            decision=decision,
            evidence=dict(response_trace["evidence"]),
        )

    def build_routed_response(
        self,
        *,
        answer: str,
        routed: bool,
        turn_id: str,
        session_id: str,
        primary_call: dict[str, Any],
        tenant: str,
        user_id: str,
        connector: str,
        connector_source: str,
        routing_mode: str,
        routing_source: str,
        routing_reason: str,
        routing_error: str | None,
        agent_metadata: dict[str, Any],
        runtime_adapter: dict[str, Any],
        tool_calls: list[dict[str, Any]],
        knowledge_payload: dict[str, Any],
        memory_payload: dict[str, Any],
        memory_saved: bool,
        evidence: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "answer": answer,
            "routed": routed,
            "turn_id": turn_id,
            "session_id": session_id,
            "tool_name": primary_call.get("tool_name"),
            "inputs": primary_call.get("inputs"),
            "tenant": primary_call.get("tenant", tenant),
            "user_id": primary_call.get("user_id", user_id),
            "connector": primary_call.get("connector", connector),
            "connector_source": primary_call.get("connector_source", connector_source),
            "routing_mode": routing_mode,
            "routing_source": routing_source,
            "routing_reason": routing_reason,
            **({"routing_error": routing_error} if routing_error else {}),
            **agent_metadata,
            "runtime_adapter": runtime_adapter,
            "decision": primary_call.get("decision"),
            "result": primary_call.get("result"),
            "tool_calls": tool_calls,
            **knowledge_payload,
            **memory_payload,
            "memory_saved": memory_saved,
            "evidence": evidence,
        }

    def build_routed_response_from_trace(
        self,
        *,
        response_trace: dict[str, Any],
        answer: str,
        routed: bool,
        session_id: str,
        primary_call: dict[str, Any],
        tenant: str,
        user_id: str,
        connector: str,
        connector_source: str,
        routing_mode: str,
        routing_source: str,
        routing_reason: str,
        routing_error: str | None,
        agent_metadata: dict[str, Any],
        runtime_adapter: dict[str, Any],
        tool_calls: list[dict[str, Any]],
        knowledge_payload: dict[str, Any],
        memory_payload: dict[str, Any],
        memory_saved: bool,
    ) -> dict[str, Any]:
        return self.build_routed_response(
            answer=answer,
            routed=routed,
            turn_id=str(response_trace["turn_id"]),
            session_id=session_id,
            primary_call=primary_call,
            tenant=tenant,
            user_id=user_id,
            connector=connector,
            connector_source=connector_source,
            routing_mode=routing_mode,
            routing_source=routing_source,
            routing_reason=routing_reason,
            routing_error=routing_error,
            agent_metadata=agent_metadata,
            runtime_adapter=runtime_adapter,
            tool_calls=tool_calls,
            knowledge_payload=knowledge_payload,
            memory_payload=memory_payload,
            memory_saved=memory_saved,
            evidence=dict(response_trace["evidence"]),
        )

    def build_run_record(
        self,
        *,
        turn_id: str,
        session_id: str,
        agent_id: str,
        agent_name: Any,
        tenant: str,
        user_id: str,
        question: str,
        answer: str,
        created_at: str,
        runtime_adapter: dict[str, Any],
        evidence: dict[str, Any],
        response: dict[str, Any],
        runtime_invocation_id: str | None = None,
        runtime_invocation_result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        record = {
            "turn_id": turn_id,
            "session_id": session_id,
            "agent_id": agent_id,
            "agent_name": agent_name,
            "tenant": tenant,
            "user_id": user_id,
            "question": question,
            "answer": answer,
            "created_at": created_at,
            "runtime_adapter": runtime_adapter,
            "evidence": evidence,
            "response": response,
        }
        if runtime_invocation_id is not None:
            record["runtime_invocation_id"] = runtime_invocation_id
        if runtime_invocation_result is not None:
            record["runtime_invocation_result"] = runtime_invocation_result
        return record

    def append_response_record(
        self,
        *,
        turn_id: str,
        session_id: str,
        agent_id: str,
        agent_name: Any,
        tenant: str,
        user_id: str,
        question: str,
        answer: str,
        created_at: str,
        runtime_adapter: dict[str, Any],
        evidence: dict[str, Any],
        response: dict[str, Any],
        runtime_invocation_id: str | None = None,
        runtime_invocation_result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        record = self.build_run_record(
            turn_id=turn_id,
            session_id=session_id,
            agent_id=agent_id,
            agent_name=agent_name,
            tenant=tenant,
            user_id=user_id,
            question=question,
            answer=answer,
            created_at=created_at,
            runtime_adapter=runtime_adapter,
            evidence=evidence,
            response=response,
            runtime_invocation_id=runtime_invocation_id,
            runtime_invocation_result=runtime_invocation_result,
        )
        return self.append_run(record)

    def append_response_record_from_trace(
        self,
        *,
        response_trace: dict[str, Any],
        session_id: str,
        agent_id: str,
        agent_name: Any,
        tenant: str,
        user_id: str,
        question: str,
        answer: str,
        runtime_adapter: dict[str, Any],
        response: dict[str, Any],
        runtime_invocation_id: str | None = None,
        runtime_invocation_result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self.append_response_record(
            turn_id=str(response_trace["turn_id"]),
            session_id=session_id,
            agent_id=agent_id,
            agent_name=agent_name,
            tenant=tenant,
            user_id=user_id,
            question=question,
            answer=answer,
            created_at=str(response_trace["created_at"]),
            runtime_adapter=runtime_adapter,
            evidence=dict(response_trace["evidence"]),
            response=response,
            runtime_invocation_id=runtime_invocation_id,
            runtime_invocation_result=runtime_invocation_result,
        )

    def append_response_record_from_context(
        self,
        *,
        response_trace: dict[str, Any],
        context: dict[str, Any],
        answer: str,
        response: dict[str, Any],
        runtime_invocation_result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        record = self.append_response_record_from_trace(
            response_trace=response_trace,
            session_id=str(context["session_id"]),
            agent_id=str(context["agent_id"]),
            agent_name=context.get("agent_name"),
            tenant=str(context["tenant"]),
            user_id=str(context["user_id"]),
            question=str(context["question"]),
            answer=answer,
            runtime_adapter=dict(context["runtime_adapter"]),
            response=response,
            runtime_invocation_id=context.get("runtime_invocation_id"),
            runtime_invocation_result=runtime_invocation_result,
        )
        self.append_runtime_invocation_record_from_context(
            response_trace=response_trace,
            context=context,
            runtime_invocation_result=runtime_invocation_result,
        )
        self.append_completed_audit_event(record)
        return record

    def append_completed_audit_event(self, record: dict[str, Any]) -> None:
        """Append non-sensitive audit evidence for one completed agent run."""
        if self._audit_event_writer is None:
            return

        evidence = record.get("evidence")
        if not isinstance(evidence, dict):
            evidence = {}
        runtime_invocation_id = _optional_string(
            record.get("runtime_invocation_id"),
        )
        payload = {
            "schema_version": 1,
            "turn_id": str(record.get("turn_id") or ""),
            "tenant": str(record.get("tenant") or ""),
            "user_id": str(record.get("user_id") or ""),
            "agent_id": str(record.get("agent_id") or ""),
            "session_id": str(record.get("session_id") or ""),
            "runtime_invocation_id": runtime_invocation_id,
            "tool_call_count": _optional_int(evidence.get("tool_call_count")) or 0,
            "knowledge_hit_count": (
                _optional_int(evidence.get("knowledge_hit_count")) or 0
            ),
            "memory_hit_count": (
                _optional_int(evidence.get("memory_hit_count")) or 0
            ),
            "memory_saved": bool(evidence.get("memory_saved", False)),
        }
        try:
            persisted_audit_event = self._audit_event_writer.append_audit_event(
                AuditEventRecord(
                    id=str(uuid4()),
                    tenant_id=payload["tenant"],
                    actor_user_id=payload["user_id"],
                    event_type="agent_run.completed",
                    target_type="agent_run",
                    target_id=payload["turn_id"],
                    payload=payload,
                    created_at=str(record.get("created_at") or ""),
                ),
            )
            if not persisted_audit_event.id:
                raise PlatformAgentRunServiceError(
                    500,
                    "PostgreSQL audit event write did not return a persisted id.",
                )
        except PlatformAgentRunServiceError:
            raise
        except Exception as exc:
            raise PlatformAgentRunServiceError(500, str(exc)) from exc

    def append_runtime_invocation_record_from_context(
        self,
        *,
        response_trace: dict[str, Any],
        context: dict[str, Any],
        runtime_invocation_result: dict[str, Any] | None,
    ) -> None:
        if self._runtime_invocation_writer is None:
            return
        if runtime_invocation_result is None:
            return

        runtime_invocation_id = runtime_invocation_result.get(
            "runtime_invocation_id",
        ) or context.get("runtime_invocation_id")
        if not runtime_invocation_id:
            return

        tenant = str(context["tenant"])
        turn_id = str(response_trace["turn_id"])
        created_at = str(response_trace["created_at"])
        completed_at = runtime_invocation_result.get("completed_at") or created_at
        request_summary = context.get("runtime_invocation_request")
        if not isinstance(request_summary, dict):
            request_summary = {
                "context": {
                    "tenant": tenant,
                    "user_id": context.get("user_id"),
                    "session_id": context.get("session_id"),
                    "agent_id": context.get("agent_id"),
                    "agent_name": context.get("agent_name"),
                },
                "question": context.get("question"),
                "metadata": {
                    "runtime_invocation_id": str(runtime_invocation_id),
                },
            }
        else:
            request_runtime_invocation_id = (
                _runtime_invocation_id_from_request_summary(request_summary)
            )
            if (
                request_runtime_invocation_id is not None
                and request_runtime_invocation_id != str(runtime_invocation_id)
            ):
                logger.warning(
                    "Skipped runtime invocation persistence because request and "
                    "result evidence identifiers do not match.",
                    extra={
                        "agent_run_id": turn_id,
                        "tenant_id": tenant,
                        "request_runtime_invocation_id": request_runtime_invocation_id,
                        "result_runtime_invocation_id": str(runtime_invocation_id),
                    },
                )
                return
            if not _runtime_invocation_context_matches_response_context(
                request_summary,
                context,
            ):
                logger.warning(
                    "Skipped runtime invocation persistence because request "
                    "context does not match response context.",
                    extra={
                        "agent_run_id": turn_id,
                        "tenant_id": tenant,
                    },
                )
                return
            request_metadata = request_summary.get("metadata")
            if not isinstance(request_metadata, dict):
                request_metadata = {}
            request_summary = {
                **request_summary,
                "metadata": {
                    **request_metadata,
                    "runtime_invocation_id": str(runtime_invocation_id),
                },
            }
        request_summary = _redact_runtime_invocation_summary(request_summary)
        response_summary = _redact_runtime_invocation_summary(runtime_invocation_result)

        try:
            self._runtime_invocation_writer.append_invocation(
                RuntimeInvocationRecord(
                    id=str(runtime_invocation_id),
                    tenant_id=tenant,
                    provider_id=_optional_string(
                        runtime_invocation_result.get("provider_id"),
                    ),
                    agent_run_id=turn_id,
                    request_summary=request_summary,
                    response_summary=response_summary,
                    provider_run_id=_optional_string(
                        runtime_invocation_result.get("provider_run_id"),
                    ),
                    latency_ms=_optional_int(
                        runtime_invocation_result.get("latency_ms"),
                    ),
                    token_usage=_optional_dict(
                        runtime_invocation_result.get("token_usage"),
                    ),
                    error=_optional_string(runtime_invocation_result.get("error")),
                    created_at=created_at,
                    completed_at=str(completed_at) if completed_at is not None else None,
                ),
            )
        except Exception:
            logger.warning(
                "Failed to persist runtime invocation evidence.",
                extra={"agent_run_id": turn_id, "tenant_id": tenant},
                exc_info=True,
            )

    def append_tool_call_records(
        self,
        *,
        turn_id: str,
        tenant: str,
        created_at: str,
        tool_calls: list[dict[str, Any]],
    ) -> None:
        if self._tool_call_writer is None:
            return
        for index, tool_call in enumerate(tool_calls, start=1):
            try:
                self._tool_call_writer.append_tool_call(
                    self.build_tool_call_record(
                        turn_id=turn_id,
                        tenant=tenant,
                        created_at=created_at,
                        sequence=index,
                        tool_call=tool_call,
                    ),
                )
            except Exception:
                logger.warning(
                    "Failed to persist tool call execution evidence.",
                    extra={"agent_run_id": turn_id, "tenant_id": tenant},
                    exc_info=True,
                )
                continue

    @staticmethod
    def build_tool_call_record(
        *,
        turn_id: str,
        tenant: str,
        created_at: str,
        sequence: int,
        tool_call: dict[str, Any],
    ) -> ToolCallRecord:
        completed_at = None if tool_call.get("approval_required") else created_at
        return ToolCallRecord(
            id=f"{turn_id}:tool:{sequence}",
            tenant_id=tenant,
            agent_run_id=turn_id,
            tool_id=None,
            inputs={
                "tool_name": tool_call.get("tool_name"),
                "arguments": tool_call.get("inputs", {}),
                "connector": tool_call.get("connector"),
                "connector_source": tool_call.get("connector_source"),
                "routing_source": tool_call.get("routing_source"),
                "routing_reason": tool_call.get("routing_reason"),
                "decision": tool_call.get("decision"),
            },
            result=tool_call.get("result") if tool_call.get("allowed") else None,
            allowed=bool(tool_call.get("allowed")),
            approval_id=(
                str(tool_call["approval_id"]) if tool_call.get("approval_id") else None
            ),
            created_at=created_at,
            completed_at=completed_at,
        )

    def finalize_unrouted_response(
        self,
        *,
        build_runtime_invocation_result_payload: Callable[..., dict[str, Any]],
        response_record_context: dict[str, Any],
        answer: str,
        session_id: str,
        tenant: str,
        user_id: str,
        agent_id: str,
        connector: str,
        connector_source: str,
        routing_mode: str,
        routing_source: str,
        routing_reason: str,
        routing_error: str | None,
        agent_metadata: dict[str, Any],
        runtime_adapter: dict[str, Any],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        knowledge_payload: dict[str, Any],
        memory_payload: dict[str, Any],
        memory_saved: bool,
        decision: dict[str, Any],
        run_identity: dict[str, str] | None = None,
        runtime_boundary_result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        response_trace = self.build_unrouted_response_trace(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            session_id=session_id,
            knowledge_hits=knowledge_hits,
            memory_hits=memory_hits,
            memory_saved=memory_saved,
            run_identity=run_identity,
        )
        response = self.build_unrouted_response_from_trace(
            response_trace=response_trace,
            answer=answer,
            session_id=session_id,
            tenant=tenant,
            user_id=user_id,
            connector=connector,
            connector_source=connector_source,
            routing_mode=routing_mode,
            routing_source=routing_source,
            routing_reason=routing_reason,
            routing_error=routing_error,
            agent_metadata=agent_metadata,
            runtime_adapter=runtime_adapter,
            knowledge_payload=knowledge_payload,
            memory_payload=memory_payload,
            memory_saved=memory_saved,
            decision=decision,
        )
        runtime_invocation_result = build_runtime_invocation_result_payload(
            answer=answer,
            status="completed",
            evidence=dict(response_trace["evidence"]),
            runtime_adapter=runtime_adapter,
            runtime_invocation_id=response_record_context.get(
                "runtime_invocation_id",
            ),
            agent_run_id=str(response_trace["turn_id"]),
            provider_run_id=_runtime_boundary_provider_run_id(
                runtime_boundary_result,
                fallback=str(response_trace["turn_id"]),
            ),
            completed_at=_runtime_boundary_completed_at(
                runtime_boundary_result,
                fallback=str(response_trace["created_at"]),
            ),
            **_runtime_boundary_result_metadata(runtime_boundary_result),
            raw={
                "routed": False,
                "routing_mode": routing_mode,
                "routing_source": routing_source,
                "routing_reason": routing_reason,
                "runtime_boundary_result": runtime_boundary_result,
                **({"routing_error": routing_error} if routing_error else {}),
            },
        )
        self.append_response_record_from_context(
            response_trace=response_trace,
            context=response_record_context,
            answer=answer,
            response=response,
            runtime_invocation_result=runtime_invocation_result,
        )
        return response

    def finalize_routed_response(
        self,
        *,
        build_runtime_invocation_result_payload: Callable[..., dict[str, Any]],
        primary_call: dict[str, Any],
        response_record_context: dict[str, Any],
        answer: str,
        routed: bool,
        session_id: str,
        tenant: str,
        user_id: str,
        agent_id: str,
        connector: str,
        connector_source: str,
        routing_mode: str,
        routing_source: str,
        routing_reason: str,
        routing_error: str | None,
        agent_metadata: dict[str, Any],
        runtime_adapter: dict[str, Any],
        tool_calls: list[dict[str, Any]],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        knowledge_payload: dict[str, Any],
        memory_payload: dict[str, Any],
        memory_saved: bool,
        run_identity: dict[str, str] | None = None,
        runtime_boundary_result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        response_trace = self.build_routed_response_trace(
            primary_call=primary_call,
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            session_id=session_id,
            tool_calls=tool_calls,
            knowledge_hits=knowledge_hits,
            memory_hits=memory_hits,
            memory_saved=memory_saved,
            run_identity=run_identity,
        )
        response = self.build_routed_response_from_trace(
            response_trace=response_trace,
            answer=answer,
            routed=routed,
            session_id=session_id,
            primary_call=primary_call,
            tenant=tenant,
            user_id=user_id,
            connector=connector,
            connector_source=connector_source,
            routing_mode=routing_mode,
            routing_source=routing_source,
            routing_reason=routing_reason,
            routing_error=routing_error,
            agent_metadata=agent_metadata,
            runtime_adapter=runtime_adapter,
            tool_calls=tool_calls,
            knowledge_payload=knowledge_payload,
            memory_payload=memory_payload,
            memory_saved=memory_saved,
        )
        runtime_invocation_result = build_runtime_invocation_result_payload(
            answer=answer,
            status="completed",
            evidence=dict(response_trace["evidence"]),
            runtime_adapter=runtime_adapter,
            runtime_invocation_id=response_record_context.get(
                "runtime_invocation_id",
            ),
            agent_run_id=str(response_trace["turn_id"]),
            provider_run_id=_runtime_boundary_provider_run_id(
                runtime_boundary_result,
                fallback=str(response_trace["turn_id"]),
            ),
            completed_at=_runtime_boundary_completed_at(
                runtime_boundary_result,
                fallback=str(response_trace["created_at"]),
            ),
            **_runtime_boundary_result_metadata(runtime_boundary_result),
            raw={
                "routed": routed,
                "routing_mode": routing_mode,
                "routing_source": routing_source,
                "routing_reason": routing_reason,
                "tool_call_count": len(tool_calls),
                "runtime_boundary_result": runtime_boundary_result,
                **({"routing_error": routing_error} if routing_error else {}),
            },
        )
        self.append_response_record_from_context(
            response_trace=response_trace,
            context=response_record_context,
            answer=answer,
            response=response,
            runtime_invocation_result=runtime_invocation_result,
        )
        self.append_tool_call_records(
            turn_id=str(response_trace["turn_id"]),
            tenant=str(response_trace["evidence"].get("tenant", tenant)),
            created_at=str(response_trace["created_at"]),
            tool_calls=tool_calls,
        )
        return response

    def clear_runs(
        self,
        *,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        filters = {
            "agent_id": _optional_filter(agent_id),
            "tenant": _optional_filter(tenant),
            "user_id": _optional_filter(user_id),
            "session_id": _optional_filter(session_id),
        }
        if not any(filters.values()):
            raise PlatformAgentRunServiceError(
                400,
                "At least one agent run filter is required.",
            )

        return {"deleted_count": self._repository.delete(**filters)}

    def clear_runs_request_payload(
        self,
        *,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        return {
            "agent_id": _optional_filter(agent_id),
            "tenant": _optional_filter(tenant),
            "user_id": _optional_filter(user_id),
            "session_id": _optional_filter(session_id),
        }


def _optional_filter(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized or None


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _optional_dict(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return value
    return None


def _runtime_boundary_provider_run_id(
    runtime_boundary_result: dict[str, Any] | None,
    *,
    fallback: str,
) -> str:
    if not isinstance(runtime_boundary_result, dict):
        return fallback
    provider_run_id = _optional_string(runtime_boundary_result.get("provider_run_id"))
    return provider_run_id or fallback


def _runtime_boundary_completed_at(
    runtime_boundary_result: dict[str, Any] | None,
    *,
    fallback: str,
) -> str:
    if not isinstance(runtime_boundary_result, dict):
        return fallback
    completed_at = _optional_string(runtime_boundary_result.get("completed_at"))
    return completed_at or fallback


def _runtime_boundary_result_metadata(
    runtime_boundary_result: dict[str, Any] | None,
) -> dict[str, Any]:
    if not isinstance(runtime_boundary_result, dict):
        return {}

    metadata: dict[str, Any] = {}
    for key in ("latency_ms", "token_usage", "error"):
        value = runtime_boundary_result.get(key)
        if value is not None:
            metadata[key] = value
    return metadata


def _redact_runtime_invocation_summary(value: Any) -> Any:
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, nested_value in value.items():
            if key == "runtime_provider_config" and isinstance(nested_value, dict):
                redacted[key] = {
                    config_key: "<configured>"
                    for config_key, config_value in nested_value.items()
                    if _configured_runtime_value(config_value)
                }
            else:
                redacted[key] = _redact_runtime_invocation_summary(nested_value)
        return redacted
    if isinstance(value, list):
        return [_redact_runtime_invocation_summary(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_redact_runtime_invocation_summary(item) for item in value)
    return value


def _configured_runtime_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


def _runtime_invocation_id_from_request_summary(
    request_summary: dict[str, Any],
) -> str | None:
    metadata = request_summary.get("metadata")
    if not isinstance(metadata, dict):
        return None
    runtime_invocation_id = metadata.get("runtime_invocation_id")
    if runtime_invocation_id is None:
        return None
    return str(runtime_invocation_id)


def _runtime_invocation_context_matches_response_context(
    request_summary: dict[str, Any],
    response_context: dict[str, Any],
) -> bool:
    request_context = request_summary.get("context")
    if not isinstance(request_context, dict):
        return False
    for key in ("tenant", "user_id", "session_id", "agent_id"):
        if str(request_context.get(key)) != str(response_context.get(key)):
            return False
    return True
