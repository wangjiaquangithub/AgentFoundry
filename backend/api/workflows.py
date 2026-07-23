"""Enterprise platform workflow, scenario, ops, and approval HTTP routes."""

from dataclasses import dataclass
from typing import Any, Callable, NoReturn
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from api.request_identity import get_request_identity
from api.schemas import (
    EnterpriseApprovalCreateRequest,
    EnterpriseApprovalDecisionRequest,
    EnterpriseWorkflowRunRequest,
    EnterpriseWorkflowTemplateUpdateRequest,
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
from services.platform_status import PlatformStatusService
from services.tools import PlatformToolPolicyService
from services.workflows import (
    PlatformWorkflowRunService,
    PlatformWorkflowRunServiceError,
    PlatformWorkflowTemplateService,
    PlatformWorkflowTemplateServiceError,
)


def _raise_service_error(exc: Any) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@dataclass(frozen=True)
class WorkflowGovernanceRouteDependencies:
    tool_names: list[str]
    tool_catalog: dict[str, dict[str, Any]]
    approval_required_tools: set[str]
    approval_required_workflows: set[str]
    workflow_template_service: Callable[[], PlatformWorkflowTemplateService]
    workflow_run_service: Callable[[], PlatformWorkflowRunService]
    approval_service: Callable[[], PlatformApprovalService]
    connector_config_service: Callable[[], PlatformConnectorConfigService]
    status_service: Callable[[], PlatformStatusService]
    agent_service: Callable[[], PlatformAgentService]
    tool_policy_service: Callable[[], PlatformToolPolicyService]
    identity_metadata: Callable[[str, str], list[dict[str, Any]]]
    published_agent_tool_scope_for_user: Callable[[str, str], tuple[Any, set[str]]]
    require_platform_approval: Callable[..., str]
    run_authorized_enterprise_tool: Callable[..., dict[str, Any]]
    tenant_hint_from_user_id: Callable[[str], str | None]
    now: Callable[[], str]


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


def _enterprise_platform_scenarios(
    deps: WorkflowGovernanceRouteDependencies,
    *,
    tenant: str,
    user_id: str,
) -> dict[str, Any]:
    try:
        workflows = deps.workflow_template_service().list_templates(
            tenant=tenant,
            actor=user_id,
        )
    except PlatformWorkflowTemplateServiceError as exc:
        _raise_service_error(exc)
    workflow_run_service = deps.workflow_run_service()
    workflow_runs = workflow_run_service.list_run_records(
        limit=100,
        tenant=tenant,
        user_id=user_id,
    )
    try:
        pending_approvals = deps.approval_service().list_records(
            limit=100,
            status="pending",
            tenant=tenant,
            user_id=user_id,
        )
    except PlatformApprovalServiceError as exc:
        _raise_service_error(exc)
    return workflow_run_service.build_platform_scenarios(
        workflows=workflows,
        workflow_runs=workflow_runs,
        pending_approvals=pending_approvals,
        enterprise_tool_catalog=deps.tool_catalog,
        approval_required_tools=deps.approval_required_tools,
        approval_required_workflows=deps.approval_required_workflows,
    )


def _runtime_tenant_for_user(
    deps: WorkflowGovernanceRouteDependencies,
    request: Request,
    user_id: str,
) -> str:
    request_tenant = _request_tenant(
        request=request,
        tenant=None,
        tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
    )
    try:
        runtime = deps.connector_config_service().enterprise_runtime_context(
            user_id,
            tenant=request_tenant,
        )
    except PlatformConnectorConfigServiceError as exc:
        _raise_service_error(exc)
    runtime_selection = deps.status_service().runtime_selection(runtime)
    return _request_tenant(
        request=request,
        tenant=runtime_selection["tenant"],
        tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
    )


def _workflow_step(
    deps: WorkflowGovernanceRouteDependencies,
    *,
    tenant: str,
    user_id: str,
    agent_id: str,
    session_id: str,
    step_id: str,
    title: str,
    tool_name: str,
    inputs: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    try:
        workflow_run_service = deps.workflow_run_service()
        tool_response = workflow_run_service.run_step_tool_from_context(
            run_authorized_enterprise_tool=deps.run_authorized_enterprise_tool,
            tenant=tenant,
            user_id=user_id,
            tool_name=tool_name,
            inputs=inputs,
            agent_id=agent_id,
            session_id=session_id,
        )
        return workflow_run_service.executed_step_record_from_context(
            format_tool_result_answer=(
                deps.tool_policy_service().format_tool_result_answer
            ),
            step_id=step_id,
            title=title,
            tool_name=tool_name,
            inputs=inputs,
            tool_response=tool_response,
        )
    except HTTPException as exc:
        workflow_run_service = deps.workflow_run_service()
        decision = workflow_run_service.error_detail_decision(exc.detail)
        message = workflow_run_service.error_detail_message(exc.detail)
    except Exception as exc:  # pragma: no cover - defensive platform boundary.
        workflow_run_service = deps.workflow_run_service()
        decision = None
        message = f"{exc.__class__.__name__}: {exc}"

    return workflow_run_service.failed_step_record(
        step_id=step_id,
        title=title,
        tool_name=tool_name,
        inputs=inputs,
        decision=decision,
        message=message,
    )


def create_workflow_governance_router(
    deps: WorkflowGovernanceRouteDependencies,
) -> APIRouter:
    router = APIRouter()

    @router.get("/enterprise/platform/workflows")
    async def list_enterprise_workflows(request: Request) -> dict[str, Any]:
        """List platform-managed workflow templates."""
        identity = get_request_identity(request)
        tenant = _request_tenant(
            request=request,
            tenant=None,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        try:
            return deps.workflow_template_service().list_templates_response(
                tenant=tenant,
                actor=identity.user_id,
            )
        except PlatformWorkflowTemplateServiceError as exc:
            _raise_service_error(exc)

    @router.get("/enterprise/platform/scenarios")
    async def list_enterprise_platform_scenarios(request: Request) -> dict[str, Any]:
        """List business scenarios backed by platform-managed workflows."""
        identity = get_request_identity(request)
        tenant = _request_tenant(
            request=request,
            tenant=None,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        return _enterprise_platform_scenarios(
            deps,
            tenant=tenant,
            user_id=identity.user_id,
        )

    @router.get("/enterprise/platform/ops/tasks")
    async def enterprise_platform_ops_tasks(request: Request) -> dict[str, Any]:
        """List open operator tasks for the current enterprise platform tenant."""
        identity = get_request_identity(request)
        tenant = _request_tenant(
            request=request,
            tenant=None,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        status_service = deps.status_service()
        try:
            request_context = status_service.status_request_context(
                user_id=identity.user_id,
                tenant=tenant,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)
        return status_service.ops_tasks(
            tenant=request_context["tenant"],
            user_id=request_context["user_id"],
            identities=request_context["identities"],
        )

    @router.post("/enterprise/platform/ops/tasks/{task_code}/resolve")
    async def resolve_enterprise_platform_ops_task(
        task_code: str,
        request: Request,
    ) -> dict[str, Any]:
        """Resolve deterministic platform operations tasks from the console."""
        identity = get_request_identity(request)
        tenant = _request_tenant(
            request=request,
            tenant=None,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        status_service = deps.status_service()
        try:
            resolve_context = status_service.resolve_ops_task_context(
                task_code=task_code,
                actor=identity.user_id,
                user_id=identity.user_id,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        try:
            (
                enabled_workflows,
                workflows,
            ) = deps.workflow_template_service().enable_disabled_templates(
                actor=resolve_context["actor"],
                tenant=tenant,
            )
        except PlatformWorkflowTemplateServiceError as exc:
            _raise_service_error(exc)

        try:
            runtime = deps.connector_config_service().enterprise_runtime_context(
                resolve_context["user_id"],
                tenant=tenant,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)
        runtime_selection = status_service.runtime_selection(runtime)
        tenant = _request_tenant(
            request=request,
            tenant=runtime_selection["tenant"],
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        identities = deps.identity_metadata(resolve_context["user_id"], tenant)
        return status_service.resolved_disabled_workflows_payload(
            task_code=resolve_context["task_code"],
            enabled_workflows=enabled_workflows,
            workflows=workflows,
            tenant=tenant,
            user_id=resolve_context["user_id"],
            identities=identities,
        )

    @router.patch("/enterprise/platform/workflows/{workflow_type}")
    async def update_enterprise_workflow(
        workflow_type: str,
        payload: EnterpriseWorkflowTemplateUpdateRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Update mutable workflow template metadata from the platform console."""
        identity = get_request_identity(request)
        tenant = _request_tenant(
            request=request,
            tenant=None,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        workflow_service = deps.workflow_template_service()
        update_context = workflow_service.update_template_context(
            workflow_type=workflow_type,
            actor=identity.user_id,
            tenant=tenant,
        )
        try:
            workflow, workflows = workflow_service.update_template(
                workflow_type=update_context["workflow_type"],
                payload=payload,
                actor=update_context["actor"],
                tenant=tenant,
            )
        except PlatformWorkflowTemplateServiceError as exc:
            _raise_service_error(exc)
        return workflow_service.update_template_response(
            workflow=workflow,
            workflows=workflows,
        )

    @router.get("/enterprise/platform/workflows/runs")
    async def list_enterprise_workflow_runs(
        request: Request,
        workflow_type: str | None = None,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        """List recent platform workflow runs for review and audit."""
        workflow_run_service = deps.workflow_run_service()
        tenant_id = _request_tenant(
            request=request,
            tenant=tenant,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        list_context = workflow_run_service.list_runs_request_payload(
            workflow_type=workflow_type,
            agent_id=agent_id,
            tenant=tenant_id,
            user_id=user_id,
            limit=limit,
        )
        return workflow_run_service.list_runs(**list_context)

    @router.get("/enterprise/platform/approvals")
    async def list_enterprise_approval_requests(
        request: Request,
        status: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        agent_id: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        """List recent platform governance approval requests."""
        approval_service = deps.approval_service()
        tenant_id = _request_tenant(
            request=request,
            tenant=tenant,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        list_context = approval_service.list_requests_request_payload(
            status=status,
            tenant=tenant_id,
            user_id=user_id,
            agent_id=agent_id,
            limit=limit,
        )
        try:
            return approval_service.list_requests(**list_context)
        except PlatformApprovalServiceError as exc:
            _raise_service_error(exc)

    @router.post("/enterprise/platform/approvals")
    async def create_enterprise_approval_request(
        payload: EnterpriseApprovalCreateRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Create a pending approval request for a high-risk platform action."""
        identity = get_request_identity(request)
        request_tenant = _request_tenant(
            request=request,
            tenant=None,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        approval_service = deps.approval_service()
        create_context = approval_service.build_create_request_context(
            payload=payload,
            actor=identity.user_id,
        )
        try:
            runtime = deps.connector_config_service().enterprise_runtime_context(
                create_context["user_id"],
                tenant=request_tenant,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)
        runtime_selection = deps.status_service().runtime_selection(runtime)
        tenant = _request_tenant(
            request=request,
            tenant=runtime_selection["tenant"],
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        request_payload = approval_service.build_create_request_payload(
            payload=payload,
            tenant=tenant,
            user_id=create_context["user_id"],
            requested_by=create_context["requested_by"],
        )
        tool_name = request_payload["tool_name"]
        workflow_type = request_payload["workflow_type"]
        if tool_name and tool_name not in deps.tool_catalog:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown enterprise tool: {tool_name}",
            )
        if workflow_type:
            try:
                deps.workflow_template_service().get_template(
                    workflow_type,
                    tenant=tenant,
                    actor=identity.user_id,
                )
            except PlatformWorkflowTemplateServiceError as exc:
                _raise_service_error(exc)

        try:
            record = approval_service.create_request(
                **request_payload,
            )
        except PlatformApprovalServiceError as exc:
            _raise_service_error(exc)
        return approval_service.create_response(record)

    @router.post("/enterprise/platform/approvals/{approval_id}/approve")
    async def approve_enterprise_approval_request(
        approval_id: str,
        payload: EnterpriseApprovalDecisionRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Approve a pending platform governance request."""
        identity = get_request_identity(request)
        approval_service = deps.approval_service()
        decision_payload = approval_service.build_decision_payload(
            payload=payload,
            actor=identity.user_id,
        )
        tenant = _runtime_tenant_for_user(
            deps,
            request,
            decision_payload["decided_by"],
        )
        try:
            approval = approval_service.update_status(
                approval_id=approval_id,
                tenant=tenant,
                status="approved",
                **decision_payload,
            )
        except PlatformApprovalServiceError as exc:
            _raise_service_error(exc)
        return approval_service.decision_response(approval)

    @router.post("/enterprise/platform/approvals/{approval_id}/reject")
    async def reject_enterprise_approval_request(
        approval_id: str,
        payload: EnterpriseApprovalDecisionRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Reject a pending platform governance request."""
        identity = get_request_identity(request)
        approval_service = deps.approval_service()
        decision_payload = approval_service.build_decision_payload(
            payload=payload,
            actor=identity.user_id,
        )
        tenant = _runtime_tenant_for_user(
            deps,
            request,
            decision_payload["decided_by"],
        )
        try:
            approval = approval_service.update_status(
                approval_id=approval_id,
                tenant=tenant,
                status="rejected",
                **decision_payload,
            )
        except PlatformApprovalServiceError as exc:
            _raise_service_error(exc)
        return approval_service.decision_response(approval)

    @router.post("/enterprise/platform/workflows/run")
    async def run_enterprise_workflow(
        payload: EnterpriseWorkflowRunRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Run a predefined enterprise automation workflow from the platform."""
        identity = get_request_identity(request)
        request_tenant = _request_tenant(
            request=request,
            tenant=None,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        workflow_run_service = deps.workflow_run_service()
        run_request = workflow_run_service.build_run_request_payload(
            payload=payload,
            actor=identity.user_id,
        )
        user_id = run_request["user_id"]
        requested_agent_id = run_request["requested_agent_id"]
        agent_id = run_request["agent_id"]
        configured_tools: set[str] | None = None
        if requested_agent_id:
            _, configured_tools = deps.published_agent_tool_scope_for_user(
                requested_agent_id,
                user_id,
            )

        try:
            runtime = deps.connector_config_service().enterprise_runtime_context(
                user_id,
                tenant=request_tenant,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)
        status_service = deps.status_service()
        runtime_selection = status_service.runtime_selection(runtime)
        tenant = _request_tenant(
            request=request,
            tenant=runtime_selection["tenant"],
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        workflow_type = run_request["workflow_type"]
        try:
            workflow_template = (
                deps.workflow_template_service().get_enabled_template(
                    workflow_type,
                    tenant=tenant,
                    actor=identity.user_id,
                )
            )
        except PlatformWorkflowTemplateServiceError as exc:
            _raise_service_error(exc)
        connector_label = runtime_selection["connector_label"]
        connector_source = runtime_selection["connector_source"]
        execution_context = workflow_run_service.build_execution_context(
            workflow_type=workflow_type,
            workflow_template=workflow_template,
            inputs=run_request["inputs"],
            run_id=uuid4().hex,
            started_at=deps.now(),
        )
        session_id = execution_context["session_id"]
        normalized_inputs = execution_context["normalized_inputs"]
        try:
            step_specs = workflow_run_service.build_step_specs(
                workflow_template,
                normalized_inputs,
                enterprise_tool_names=deps.tool_names,
                enterprise_tool_catalog=deps.tool_catalog,
            )
        except PlatformWorkflowRunServiceError as exc:
            _raise_service_error(exc)
        approval_required_tools = workflow_run_service.approval_required_tools(
            step_specs,
            deps.approval_required_tools,
        )

        approval_id = None
        if workflow_run_service.requires_approval(
            workflow_type,
            approval_required_tools,
            deps.approval_required_workflows,
        ):
            approval_id = deps.require_platform_approval(
                **workflow_run_service.build_approval_request_context(
                    approval_id=run_request["approval_id"],
                    workflow_type=workflow_type,
                    tenant=tenant,
                    user_id=user_id,
                    agent_id=agent_id,
                    inputs=normalized_inputs,
                ),
            )

        steps: list[dict[str, Any]] = []
        tool_calls: list[dict[str, Any]] = []
        for step_id, title, tool_name, step_inputs in step_specs:
            if configured_tools is not None and tool_name not in configured_tools:
                decision = deps.agent_service().tool_denial_payload(tool_name)
                step_result = workflow_run_service.denied_step_record(
                    step_id=step_id,
                    title=title,
                    tool_name=tool_name,
                    inputs=step_inputs,
                    decision=decision,
                    tenant=tenant,
                    user_id=user_id,
                    connector=connector_label,
                    connector_source=connector_source,
                )
            else:
                step_result = _workflow_step(
                    deps,
                    tenant=tenant,
                    user_id=user_id,
                    agent_id=agent_id,
                    session_id=session_id,
                    step_id=step_id,
                    title=title,
                    tool_name=tool_name,
                    inputs=step_inputs,
                )
            workflow_run_service.append_step_result(
                steps=steps,
                tool_calls=tool_calls,
                step_result=step_result,
            )

        finished_at = deps.now()
        response = workflow_run_service.build_run_record(
            **workflow_run_service.build_run_record_context(
                workflow_type=workflow_type,
                execution_context=execution_context,
                finished_at=finished_at,
                tenant=tenant,
                user_id=user_id,
                agent_id=agent_id,
                connector=connector_label,
                connector_source=connector_source,
                approval_id=approval_id,
                steps=steps,
                tool_calls=tool_calls,
            ),
        )
        workflow_run_service.append_run(response)
        return response

    return router
