"""Enterprise platform agent runtime HTTP routes."""

from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Mapping, NoReturn
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from api.request_identity import get_request_identity
from api.schemas import EnterpriseAgentRunRequest
from persistence.database import is_production_environment
from persistence.runtime_lifecycle import RuntimeLifecycleStore
from services.agent_runs import (
    PlatformAgentRunService,
    PlatformAgentRunServiceError,
)
from services.agents import PlatformAgentService
from services.approvals import (
    PlatformApprovalService,
    PlatformApprovalServiceError,
)
from services.connectors import (
    PlatformConnectorConfigService,
    PlatformConnectorConfigServiceError,
)
from services.dev_knowledge import PlatformDevKnowledgeService
from services.enterprise_router import PlatformEnterpriseRouterService
from services.knowledge import (
    PlatformKnowledgeDocumentReadinessService,
    PlatformKnowledgeResponseService,
    PlatformKnowledgeRetrievalServiceError,
)
from services.execution_context import ExecutionContextError, ExecutionContextService
from services.memories import PlatformMemoryService, PlatformMemoryServiceError
from services.tools import PlatformToolPolicyService


def _raise_service_error(exc: Any) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@dataclass(frozen=True)
class AgentRuntimeRouteDependencies:
    tool_names: list[str]
    approval_required_tools: set[str]
    memory_max_records: int
    memory_search_limit: int
    routing_source_rules: str
    dev_knowledge_provider: str
    env: Mapping[str, str]
    agent_run_service: Callable[[], PlatformAgentRunService]
    connector_config_service: Callable[[], PlatformConnectorConfigService]
    agent_service: Callable[[], PlatformAgentService]
    approval_service: Callable[[], PlatformApprovalService]
    tool_policy_service: Callable[[], PlatformToolPolicyService]
    memory_service: PlatformMemoryService
    knowledge_response_service: PlatformKnowledgeResponseService
    knowledge_document_readiness_service: (
        PlatformKnowledgeDocumentReadinessService | None
    )
    dev_knowledge_service: PlatformDevKnowledgeService
    enterprise_router_service: PlatformEnterpriseRouterService
    published_agent_tool_scope_for_user: Callable[[str, str], tuple[Any, set[str]]]
    require_platform_approval: Callable[..., str]
    run_authorized_enterprise_tool: Callable[..., dict[str, Any]]
    safe_path_part: Callable[[str], str]
    describe_runtime_adapter: Callable[..., dict[str, Any]]
    build_runtime_invocation_request_payload: Callable[..., dict[str, Any]]
    invoke_runtime_adapter_from_payload: Callable[..., Awaitable[dict[str, Any]]]
    build_runtime_invocation_result_payload: Callable[..., dict[str, Any]]
    tenant_hint_from_user_id: Callable[[str], str | None]
    execution_context_service: ExecutionContextService | None = None
    runtime_lifecycle_store: RuntimeLifecycleStore | None = None


def _request_tenant(
    *,
    request: Request,
    tenant: str | None,
    tenant_hint_from_user_id: Callable[[str], str | None],
) -> str:
    identity = get_request_identity(request)
    identity_tenant = (identity.tenant_id or "").strip()
    hinted_tenant = tenant_hint_from_user_id(identity.user_id or "")
    request_tenant = identity_tenant or hinted_tenant
    if not request_tenant:
        raise HTTPException(
            status_code=400,
            detail="request identity does not resolve to a tenant.",
        )

    explicit_tenant = (tenant or "").strip()
    if explicit_tenant and explicit_tenant != request_tenant:
        raise HTTPException(
            status_code=403,
            detail="tenant does not match request identity tenant boundary.",
        )
    return request_tenant


def create_agent_runtime_router(
    deps: AgentRuntimeRouteDependencies,
) -> APIRouter:
    router = APIRouter()

    @router.post("/enterprise/platform/agent/run")
    async def run_enterprise_agent(
        payload: EnterpriseAgentRunRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Route a business question through a published enterprise agent."""

        identity = get_request_identity(request)
        agent_run_service = deps.agent_run_service()
        run_request = agent_run_service.run_request_payload(
            question=payload.question,
            payload_user_id=payload.user_id,
            header_user_id=identity.user_id,
            agent_id=payload.agent_id,
            session_id=payload.session_id,
            approval_id=payload.approval_id,
        )
        user_id = run_request["user_id"]
        request_tenant = _request_tenant(
            request=request,
            tenant=None,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        runtime = agent_run_service.resolve_runtime_context(
            user_id=user_id,
            load_runtime_context=lambda runtime_user_id: (
                deps.connector_config_service().enterprise_runtime_context(
                    runtime_user_id,
                    tenant=request_tenant,
                )
            ),
            runtime_context_error_type=PlatformConnectorConfigServiceError,
            raise_runtime_context_error=_raise_service_error,
        )
        _request_tenant(
            request=request,
            tenant=agent_run_service.runtime_tenant(runtime),
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        agent_context = agent_run_service.resolve_run_agent_context(
            run_request=run_request,
            load_published_agent=deps.published_agent_tool_scope_for_user,
            build_run_metadata=deps.agent_service().run_metadata,
            describe_runtime_adapter=deps.describe_runtime_adapter,
        )
        execution_context = (
            agent_run_service.build_execution_context_from_agent_context(
                run_request=run_request,
                agent_context=agent_context,
                runtime=runtime,
                build_runtime_invocation_request_payload=(
                    deps.build_runtime_invocation_request_payload
                ),
                default_tool_names=set(deps.tool_names),
                safe_path_part=deps.safe_path_part,
            )
        )
        execution_context_view = agent_run_service.execution_context_view(
            execution_context
        )
        question = execution_context_view["question"]
        execution_path = agent_run_service.execution_path(execution_context)
        lifecycle_execution: dict[str, Any] | None = None
        if execution_path == "agentscope_runtime" and deps.execution_context_service:
            request_id = str(
                getattr(request.state, "request_id", "") or uuid4().hex
            )
            try:
                trusted_context = deps.execution_context_service.build(
                    request_id=request_id,
                    tenant_id=request_tenant,
                    subject_id=str(identity.user_id or ""),
                    agent_id=str(execution_context_view["runner_agent_id"]),
                    authentication_method=identity.source,
                )
            except ExecutionContextError as exc:
                _raise_service_error(exc)
            trusted_payload = trusted_context.to_dict()
            runtime_request = execution_context["runtime_invocation_request"]
            runtime_metadata = runtime_request.setdefault("metadata", {})
            context_metadata = runtime_request.setdefault("context", {}).setdefault(
                "metadata", {}
            )
            session_id = str(execution_context_view["runner_session_id"])
            business_run_id = str(
                runtime_metadata.get("business_run_id") or f"run_{uuid4().hex}"
            )
            runtime_execution_id = f"exec_{uuid4().hex}"
            lifecycle_metadata = {
                "request_id": request_id,
                "business_run_id": business_run_id,
                "session_id": session_id,
                "runtime_execution_id": runtime_execution_id,
                "authorization_decision_id": (
                    trusted_context.authorization_decision_id
                ),
                "trusted_execution_context": trusted_payload,
            }
            runtime_metadata.update(lifecycle_metadata)
            context_metadata.update(lifecycle_metadata)
            execution_context["trusted_execution_context"] = trusted_payload
            if deps.runtime_lifecycle_store:
                try:
                    deps.runtime_lifecycle_store.create_session(
                        tenant_id=request_tenant,
                        subject_id=str(identity.user_id or ""),
                        agent_id=str(execution_context_view["runner_agent_id"]),
                        session_id=session_id,
                        metadata={"created_from_request_id": request_id},
                    )
                    lifecycle_execution = deps.runtime_lifecycle_store.create_execution(
                        tenant_id=request_tenant,
                        session_id=session_id,
                        business_run_id=business_run_id,
                        execution_id=runtime_execution_id,
                        context=trusted_payload,
                    )
                    deps.runtime_lifecycle_store.update_execution(
                        request_tenant, runtime_execution_id, "running"
                    )
                except (KeyError, ValueError) as exc:
                    raise HTTPException(status_code=409, detail=str(exc)) from exc
        try:
            runtime_boundary_result = (
                await agent_run_service.invoke_runtime_adapter_from_execution_context(
                    invoke_runtime_adapter_from_payload=(
                        deps.invoke_runtime_adapter_from_payload
                    ),
                    execution_context=execution_context,
                )
            )
        except Exception:
            if lifecycle_execution and deps.runtime_lifecycle_store:
                deps.runtime_lifecycle_store.update_execution(
                    request_tenant,
                    str(lifecycle_execution["id"]),
                    "failed",
                    error_code="RUNTIME_PROVIDER_ERROR",
                )
            raise
        if execution_path == "agentscope_runtime":
            try:
                response = agent_run_service.finalize_native_runtime_run_from_context(
                    build_runtime_invocation_result_payload=(
                        deps.build_runtime_invocation_result_payload
                    ),
                    execution_context=execution_context,
                    runtime_boundary_result=runtime_boundary_result,
                    platform_approval_service=deps.approval_service,
                    raise_platform_approval_service_error=_raise_service_error,
                    decision_with_routing_context=(
                        deps.enterprise_router_service.decision_with_routing_context
                    ),
                    requested_by=str(identity.user_id or ""),
                )
            except Exception:
                if lifecycle_execution and deps.runtime_lifecycle_store:
                    deps.runtime_lifecycle_store.update_execution(
                        request_tenant,
                        str(lifecycle_execution["id"]),
                        "failed",
                        error_code="RUNTIME_RESULT_ERROR",
                    )
                raise
            if lifecycle_execution and deps.runtime_lifecycle_store:
                tool_calls = response.get("tool_calls", [])
                waiting = any(
                    isinstance(call, dict)
                    and call.get("approval_id")
                    and call.get("allowed") is False
                    for call in tool_calls
                )
                final_state = "waiting_approval" if waiting else "succeeded"
                deps.runtime_lifecycle_store.update_execution(
                    request_tenant, str(lifecycle_execution["id"]), final_state
                )
                response["business_run_id"] = lifecycle_execution["business_run_id"]
                response["runtime_execution_id"] = lifecycle_execution["id"]
                response["authorization_decision_id"] = (
                    execution_context["trusted_execution_context"][
                        "authorization_decision_id"
                    ]
                )
            return response
        # Everything below is the isolated legacy compatibility executor. Native
        # AgentScope Agents have already returned from the Runtime Gateway above.
        try:
            memory_context = (
                agent_run_service.prepare_memory_context_from_execution_context(
                    build_agent_run_context=deps.memory_service.build_agent_run_context,
                    agent_run_state=deps.memory_service.agent_run_state,
                    execution_context=execution_context,
                    max_records=deps.memory_max_records,
                    limit=deps.memory_search_limit,
                )
            )
        except PlatformMemoryServiceError as exc:
            _raise_service_error(exc)
        memory_context_view = agent_run_service.memory_context_view(memory_context)
        memory_payload = memory_context_view["memory_payload"]
        memory_hits = memory_context_view["memory_hits"]
        try:
            knowledge_context = (
                await agent_run_service.prepare_knowledge_context_from_execution_context(
                    search_agent_knowledge_bases=(
                        deps.knowledge_response_service.search_agent_knowledge_bases
                    ),
                    build_agent_run_payload=(
                        deps.knowledge_response_service.build_agent_run_payload
                    ),
                    knowledge_base_service=getattr(
                        request.app.state,
                        "knowledge_base_service",
                        None,
                    ),
                    dev_knowledge_service=deps.dev_knowledge_service,
                    dev_knowledge_provider=deps.dev_knowledge_provider,
                    knowledge_document_readiness_service=(
                        deps.knowledge_document_readiness_service
                    ),
                    allow_dev_knowledge_fallback=not is_production_environment(
                        deps.env
                    ),
                    execution_context=execution_context,
                )
            )
        except PlatformKnowledgeRetrievalServiceError as exc:
            _raise_service_error(exc)
        knowledge_context_view = agent_run_service.knowledge_context_view(
            knowledge_context,
        )
        knowledge_hits = knowledge_context_view["knowledge_hits"]
        knowledge_payload = knowledge_context_view["knowledge_payload"]
        routing_selection = (
            await agent_run_service.prepare_routing_context_from_execution_context(
                select_routes_for_question=(
                    deps.enterprise_router_service.select_routes_for_question
                ),
                routing_state_for=deps.enterprise_router_service.routing_state_for,
                execution_context=execution_context,
                env=deps.env,
            )
        )
        routes = routing_selection["routes"]
        routing_context_view = agent_run_service.routing_context_view(
            routing_selection["routing_context"],
        )
        routing_mode = routing_context_view["routing_mode"]
        routing_source = routing_context_view["routing_source"]
        routing_error = routing_context_view["routing_error"]

        if not routes:
            decision = deps.enterprise_router_service.unrouted_decision_for_question(
                question,
                routing_source=routing_source,
                routing_mode=routing_mode,
                routing_error=routing_error,
            )
            try:
                response = agent_run_service.finalize_unrouted_run_from_context(
                    build_runtime_invocation_result_payload=(
                        deps.build_runtime_invocation_result_payload
                    ),
                    append_agent_turn_if_enabled=(
                        deps.memory_service.append_agent_turn_if_enabled
                    ),
                    execution_context=execution_context,
                    memory_context=memory_context,
                    routing_mode=routing_mode,
                    routing_source=routing_source,
                    routing_error=routing_error,
                    knowledge_hits=knowledge_hits,
                    memory_hits=memory_hits,
                    format_knowledge_answer=(
                        deps.knowledge_response_service.format_answer
                    ),
                    format_memory_answer=deps.memory_service.format_answer,
                    knowledge_payload=knowledge_payload,
                    memory_payload=memory_payload,
                    max_records=deps.memory_max_records,
                    decision=decision,
                    runtime_boundary_result=runtime_boundary_result,
                )
            except PlatformMemoryServiceError as exc:
                _raise_service_error(exc)
            return response

        tool_calls = agent_run_service.process_routed_routes(
            routes=routes,
            default_source=deps.routing_source_rules,
            tool_denial_payload=deps.agent_service().tool_denial_payload,
            decision_with_routing_context=(
                deps.enterprise_router_service.decision_with_routing_context
            ),
            execution_context=execution_context,
            require_platform_approval=deps.require_platform_approval,
            approval_exception_type=HTTPException,
            run_request=run_request,
            approval_required_tools=deps.approval_required_tools,
            platform_approval_service=deps.approval_service,
            raise_platform_approval_service_error=_raise_service_error,
            run_authorized_enterprise_tool=deps.run_authorized_enterprise_tool,
            format_tool_result_answer=(
                deps.tool_policy_service().format_tool_result_answer
            ),
            requested_by=identity.user_id,
            routing_mode=routing_mode,
            routing_error=routing_error,
        )
        try:
            response = agent_run_service.finalize_routed_run_from_context(
                build_runtime_invocation_result_payload=(
                    deps.build_runtime_invocation_result_payload
                ),
                append_agent_turn_if_enabled=(
                    deps.memory_service.append_agent_turn_if_enabled
                ),
                execution_context=execution_context,
                memory_context=memory_context,
                routing_mode=routing_mode,
                routing_source=routing_source,
                routing_error=routing_error,
                tool_calls=tool_calls,
                knowledge_hits=knowledge_hits,
                memory_hits=memory_hits,
                format_knowledge_answer=(
                    deps.knowledge_response_service.format_answer
                ),
                format_memory_answer=deps.memory_service.format_answer,
                knowledge_payload=knowledge_payload,
                memory_payload=memory_payload,
                max_records=deps.memory_max_records,
                runtime_boundary_result=runtime_boundary_result,
            )
        except PlatformMemoryServiceError as exc:
            _raise_service_error(exc)
        return response

    @router.get("/enterprise/platform/agent/runs")
    async def list_enterprise_agent_runs(
        request: Request,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        """List recent enterprise agent question-answer turns."""
        agent_run_service = deps.agent_run_service()
        tenant_id = _request_tenant(
            request=request,
            tenant=tenant,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        list_context = agent_run_service.list_runs_request_payload(
            limit=limit,
            agent_id=agent_id,
            tenant=tenant_id,
            user_id=user_id,
            session_id=session_id,
        )
        return agent_run_service.list_runs(**list_context)

    @router.get("/enterprise/platform/agent/runs/{turn_id}")
    async def get_enterprise_agent_run(
        turn_id: str,
        request: Request,
        tenant: str | None = None,
    ) -> dict[str, Any]:
        """Get a single enterprise agent question-answer turn by run ID."""
        tenant_id = _request_tenant(
            request=request,
            tenant=tenant,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        try:
            return deps.agent_run_service().get_run(turn_id, tenant=tenant_id)
        except PlatformAgentRunServiceError as exc:
            _raise_service_error(exc)

    @router.delete("/enterprise/platform/agent/runs")
    async def clear_enterprise_agent_runs(
        request: Request,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """Clear matching enterprise agent question-answer turns."""
        identity = get_request_identity(request)
        agent_run_service = deps.agent_run_service()
        tenant_id = _request_tenant(
            request=request,
            tenant=tenant,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        clear_context = agent_run_service.clear_runs_request_payload(
            agent_id=agent_id,
            tenant=tenant_id,
            user_id=user_id,
            session_id=session_id,
        )
        try:
            return agent_run_service.clear_runs(
                actor_user_id=identity.user_id or "",
                **clear_context,
            )
        except PlatformAgentRunServiceError as exc:
            _raise_service_error(exc)

    return router
