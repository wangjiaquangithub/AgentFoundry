"""Service-layer orchestration for enterprise agent run history."""

from datetime import datetime, timezone
from typing import Any, Callable
from uuid import uuid4

from repositories.agent_runs import AgentRunRepository


class PlatformAgentRunServiceError(ValueError):
    """Raised when an agent run history operation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class PlatformAgentRunService:
    """Manage persisted enterprise agent question-answer turns."""

    def __init__(self, *, repository: AgentRunRepository) -> None:
        self._repository = repository

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

    def get_run(self, turn_id: str) -> dict[str, Any]:
        run = self._repository.get(turn_id.strip())
        if run is None:
            raise PlatformAgentRunServiceError(404, "Agent run not found.")
        return run

    def append_run(self, record: dict[str, Any]) -> dict[str, Any]:
        self._repository.append(record)
        return record

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
    ) -> dict[str, Any]:
        run_identity = self.build_run_identity()
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
        )

    def build_response_record_context(
        self,
        *,
        session_id: str,
        agent_id: str,
        agent_name: Any,
        tenant: str,
        user_id: str,
        question: str,
        runtime_adapter: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "session_id": session_id,
            "agent_id": agent_id,
            "agent_name": agent_name,
            "tenant": tenant,
            "user_id": user_id,
            "question": question,
            "runtime_adapter": runtime_adapter,
        }

    def build_execution_context(
        self,
        *,
        run_request: dict[str, Any],
        agent: dict[str, Any] | None,
        agent_metadata: dict[str, Any],
        runtime: dict[str, Any],
        runtime_adapter: dict[str, Any],
        default_tool_names: set[str],
        safe_path_part: Callable[[str], str],
    ) -> dict[str, Any]:
        runtime_identity = self.build_runtime_identity(runtime)
        tenant = runtime_identity["tenant"]
        question = run_request["question"]
        runner_context = self.resolve_runner_context(
            agent_metadata=agent_metadata,
            agent=agent,
            user_id=run_request["user_id"],
            session_id=run_request["session_id"],
            default_tool_names=default_tool_names,
            safe_path_part=safe_path_part,
        )
        response_record_context = self.build_response_record_context(
            session_id=runner_context["runner_session_id"],
            agent_id=runner_context["runner_agent_id"],
            agent_name=agent_metadata.get("agent_name"),
            tenant=tenant,
            user_id=run_request["user_id"],
            question=question,
            runtime_adapter=runtime_adapter,
        )
        return {
            "runtime_identity": runtime_identity,
            "tenant": tenant,
            "connector_label": runtime_identity["connector"],
            "connector_source": runtime_identity["connector_source"],
            "question": question,
            "configured_tools": runner_context["configured_tools"],
            "runner_agent_id": runner_context["runner_agent_id"],
            "runner_session_id": runner_context["runner_session_id"],
            "response_record_context": response_record_context,
            "knowledge_base_ids": self.knowledge_base_ids_from_metadata(
                agent_metadata,
            ),
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
        user_id: str,
        answer: str,
        tool_calls: list[dict[str, Any]],
        max_records: int,
    ) -> dict[str, Any]:
        return self.build_memory_append_context(
            enabled=bool(memory_context["memory_enabled"]),
            tenant=str(execution_context["tenant"]),
            user_id=user_id,
            agent_id=str(execution_context["runner_agent_id"]),
            session_id=str(execution_context["runner_session_id"]),
            question=str(execution_context["question"]),
            answer=answer,
            tool_calls=tool_calls,
            knowledge_base_ids=list(execution_context["knowledge_base_ids"]),
            max_records=max_records,
        )

    def build_unrouted_memory_append_context(
        self,
        *,
        execution_context: dict[str, Any],
        memory_context: dict[str, Any],
        user_id: str,
        answer: str,
        max_records: int,
    ) -> dict[str, Any]:
        return self.build_memory_append_context(
            enabled=bool(memory_context["memory_enabled"]),
            tenant=str(execution_context["tenant"]),
            user_id=user_id,
            agent_id=str(execution_context["runner_agent_id"]),
            session_id=str(execution_context["runner_session_id"]),
            question=str(execution_context["question"]),
            answer=answer,
            tool_calls=[],
            knowledge_base_ids=list(execution_context["knowledge_base_ids"]),
            max_records=max_records,
        )

    def build_knowledge_context(
        self,
        *,
        knowledge_hits: list[dict[str, Any]],
        knowledge_error: str | None,
        knowledge_payload: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "knowledge_hits": list(knowledge_hits),
            "knowledge_error": knowledge_error,
            "knowledge_payload": knowledge_payload,
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
        routing_error: str | None,
        agent_metadata: dict[str, Any],
        runtime_adapter: dict[str, Any],
        tool_calls: list[dict[str, Any]],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        knowledge_payload: dict[str, Any],
        memory_payload: dict[str, Any],
        memory_saved: bool,
    ) -> dict[str, Any]:
        return {
            "primary_call": routed_summary_context["primary_call"],
            "response_record_context": response_record_context,
            "answer": answer,
            "routed": routed_summary_context["routed"],
            "session_id": session_id,
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "connector": connector,
            "connector_source": connector_source,
            "routing_mode": routing_mode,
            "routing_source": routing_source,
            "routing_reason": routed_summary_context["routing_reason"],
            "routing_error": routing_error,
            "agent_metadata": agent_metadata,
            "runtime_adapter": runtime_adapter,
            "tool_calls": tool_calls,
            "knowledge_hits": knowledge_hits,
            "memory_hits": memory_hits,
            "knowledge_payload": knowledge_payload,
            "memory_payload": memory_payload,
            "memory_saved": memory_saved,
        }

    def build_unrouted_finalize_context(
        self,
        *,
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
        routing_error: str | None,
        agent_metadata: dict[str, Any],
        runtime_adapter: dict[str, Any],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        knowledge_payload: dict[str, Any],
        memory_payload: dict[str, Any],
        memory_saved: bool,
        decision: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "response_record_context": response_record_context,
            "answer": answer,
            "session_id": session_id,
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "connector": connector,
            "connector_source": connector_source,
            "routing_mode": routing_mode,
            "routing_source": routing_source,
            "routing_reason": str(decision["routing_reason"]),
            "routing_error": routing_error,
            "agent_metadata": agent_metadata,
            "runtime_adapter": runtime_adapter,
            "knowledge_hits": knowledge_hits,
            "memory_hits": memory_hits,
            "knowledge_payload": knowledge_payload,
            "memory_payload": memory_payload,
            "memory_saved": memory_saved,
            "decision": decision,
        }

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

    def build_denied_route_decision_context(
        self,
        *,
        denial: dict[str, Any],
        routing_reason: str,
        routing_source: str,
        routing_mode: str,
        routing_error: str | None,
    ) -> dict[str, Any]:
        return {
            "decision": denial,
            **self.build_routed_decision_context(
                routing_reason=routing_reason,
                routing_source=routing_source,
                routing_mode=routing_mode,
                routing_error=routing_error,
            ),
        }

    def denied_tool_answer(self, denial: dict[str, Any]) -> str:
        return str(denial["reason"])

    def is_configured_tool(
        self,
        *,
        tool_name: str,
        configured_tools: set[str],
    ) -> bool:
        return tool_name in configured_tools

    def requires_tool_approval(
        self,
        *,
        tool_name: str,
        approval_required_tools: set[str],
    ) -> bool:
        return tool_name in approval_required_tools

    def build_tool_approval_requirement_context(
        self,
        *,
        approval_id: str | None,
        tool_name: str,
        tenant: str,
        user_id: str,
        agent_id: str,
        inputs: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "approval_id": approval_id,
            "request_type": "tool_run",
            "target_key": "tool_name",
            "target_value": tool_name,
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "inputs": inputs,
        }

    def build_tool_execution_request_context(
        self,
        *,
        user_id: str,
        tool_name: str,
        inputs: dict[str, Any],
        agent_id: str,
        session_id: str,
        fail_on_denied: bool,
    ) -> dict[str, Any]:
        return {
            "user_id": user_id,
            "tool_name": tool_name,
            "inputs": inputs,
            "agent_id": agent_id,
            "session_id": session_id,
            "fail_on_denied": fail_on_denied,
        }

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

    def build_denied_routed_tool_call_context(
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
            "tenant": tenant,
            "user_id": user_id,
            "connector": connector,
            "connector_source": connector_source,
            "routing_source": routing_source,
            "routing_reason": routing_reason,
            "decision": decision,
            "answer": answer,
        }

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

    def build_pending_approval_routed_tool_call_context(
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
            "approval_id": approval_id,
            "tenant": tenant,
            "user_id": user_id,
            "connector": connector,
            "connector_source": connector_source,
            "routing_source": routing_source,
            "routing_reason": routing_reason,
            "decision": decision,
            "answer": answer,
        }

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

    def pending_approval_decision_payload(
        self,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        return dict(context["decision_payload"])

    def build_pending_approval_route_decision_context(
        self,
        *,
        pending_approval_context: dict[str, Any],
        routing_reason: str,
        routing_source: str,
        routing_mode: str,
        routing_error: str | None,
    ) -> dict[str, Any]:
        return {
            "decision": self.pending_approval_decision_payload(
                pending_approval_context,
            ),
            **self.build_routed_decision_context(
                routing_reason=routing_reason,
                routing_source=routing_source,
                routing_mode=routing_mode,
                routing_error=routing_error,
            ),
        }

    def pending_approval_message(
        self,
        context: dict[str, Any],
    ) -> str:
        return str(context["approval_message"])

    def resolve_requested_by(self, *, headers: Any, user_id: str) -> str:
        return str(headers.get("X-User-ID") or user_id)

    def is_approval_required_exception(
        self,
        *,
        status_code: int,
        detail: dict[str, Any],
    ) -> bool:
        return status_code == 403 and bool(detail.get("approval_required"))

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

    def resolve_approval_id(self, approval: dict[str, Any]) -> str:
        return str(approval["approval_id"])

    def executed_tool_decision_payload(
        self,
        tool_response: dict[str, Any],
    ) -> dict[str, Any]:
        return dict(tool_response["decision"])

    def build_executed_tool_route_decision_context(
        self,
        *,
        tool_response: dict[str, Any],
        routing_reason: str,
        routing_source: str,
        routing_mode: str,
        routing_error: str | None,
    ) -> dict[str, Any]:
        return {
            "decision": self.executed_tool_decision_payload(tool_response),
            **self.build_routed_decision_context(
                routing_reason=routing_reason,
                routing_source=routing_source,
                routing_mode=routing_mode,
                routing_error=routing_error,
            ),
        }

    def executed_tool_result(self, tool_response: dict[str, Any]) -> Any:
        return tool_response.get("result")

    def executed_tool_tenant(self, tool_response: dict[str, Any]) -> str:
        return str(tool_response["tenant"])

    def build_executed_tool_answer_context(
        self,
        *,
        tool_name: str,
        tool_response: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "tool_name": tool_name,
            "result": self.executed_tool_result(tool_response),
            "tenant": self.executed_tool_tenant(tool_response),
        }

    def build_executed_routed_tool_call_context(
        self,
        *,
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
    ) -> dict[str, Any]:
        return {
            "tool_name": tool_name,
            "inputs": inputs,
            "tool_response": tool_response,
            "connector": connector,
            "connector_source": connector_source,
            "routing_source": routing_source,
            "routing_reason": routing_reason,
            "approval_id": approval_id,
            "decision": decision,
            "answer": answer,
        }

    def build_executed_routed_tool_call(
        self,
        *,
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
    ) -> dict[str, Any]:
        return {
            "tool_name": tool_name,
            "inputs": inputs,
            "allowed": bool(tool_response.get("allowed")),
            "tenant": tool_response["tenant"],
            "user_id": tool_response["user_id"],
            "connector": tool_response.get("connector", connector),
            "connector_source": tool_response.get(
                "connector_source",
                connector_source,
            ),
            "routing_source": routing_source,
            "routing_reason": routing_reason,
            "approval_id": approval_id,
            "decision": decision,
            "result": tool_response.get("result"),
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
    ) -> dict[str, Any]:
        return {
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
        )

    def append_response_record_from_context(
        self,
        *,
        response_trace: dict[str, Any],
        context: dict[str, Any],
        answer: str,
        response: dict[str, Any],
    ) -> dict[str, Any]:
        return self.append_response_record_from_trace(
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
        )

    def finalize_unrouted_response(
        self,
        *,
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
    ) -> dict[str, Any]:
        response_trace = self.build_unrouted_response_trace(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            session_id=session_id,
            knowledge_hits=knowledge_hits,
            memory_hits=memory_hits,
            memory_saved=memory_saved,
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
        self.append_response_record_from_context(
            response_trace=response_trace,
            context=response_record_context,
            answer=answer,
            response=response,
        )
        return response

    def finalize_routed_response(
        self,
        *,
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
        self.append_response_record_from_context(
            response_trace=response_trace,
            context=response_record_context,
            answer=answer,
            response=response,
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
