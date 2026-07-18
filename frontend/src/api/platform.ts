import { client } from './client';
import type {
	EnterpriseAgentPublishRequest,
	EnterpriseAgentPublishResponse,
	EnterpriseAgentRunRequest,
	EnterpriseAgentRunResponse,
	EnterpriseAgentRunHistoryItem,
	EnterpriseAgentRunsDeleteResponse,
	EnterpriseAgentRunsResponse,
	EnterpriseAgentUpdateRequest,
	EnterpriseAgentUpdateResponse,
	EnterpriseApprovalCreateRequest,
	EnterpriseApprovalDecisionRequest,
	EnterpriseApprovalDecisionResponse,
	EnterpriseApprovalsResponse,
	EnterpriseAuditQueryResponse,
	EnterpriseConnectorConfigSaveRequest,
	EnterpriseConnectorConfigSaveResponse,
	EnterpriseConnectorTestRequest,
	EnterpriseConnectorTestResponse,
	EnterprisePlatformConfigExportResponse,
	EnterprisePlatformConfigImportRequest,
	EnterprisePlatformConfigImportResponse,
	EnterprisePlatformConnectorsResponse,
	EnterprisePlatformGovernanceResponse,
	EnterprisePlatformMemberUpdateResponse,
	EnterprisePlatformMemberUpsertRequest,
	EnterprisePlatformMembersResponse,
	EnterprisePlatformAgentsResponse,
	EnterprisePlatformOpsTaskResolveResponse,
	EnterprisePlatformOpsTasksResponse,
	EnterprisePlatformScenariosResponse,
	EnterprisePlatformStatusResponse,
	EnterpriseToolCatalogResponse,
	EnterpriseToolPolicyResponse,
	EnterpriseToolPolicyUpdateRequest,
	EnterpriseToolPolicyUpdateResponse,
	EnterpriseToolRunRequest,
	EnterpriseToolRunResponse,
	EnterpriseWorkflowRunRequest,
	EnterpriseWorkflowRunResponse,
	EnterpriseWorkflowRunsResponse,
	EnterpriseWorkflowTemplatesResponse,
	EnterpriseWorkflowTemplateUpdateRequest,
} from './types';

function compactParams(params?: Record<string, string | number | boolean | undefined>) {
	if (!params) return undefined;
	const result: Record<string, string> = {};
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== '') {
			result[key] = String(value);
		}
	});
	return result;
}

export const platformApi = {
	status: () => client.get<EnterprisePlatformStatusResponse>('/enterprise/platform/status'),
	exportConfig: () =>
		client.get<EnterprisePlatformConfigExportResponse>(
			'/enterprise/platform/config/export',
		),
	importConfig: (request: EnterprisePlatformConfigImportRequest) =>
		client.post<EnterprisePlatformConfigImportResponse>(
			'/enterprise/platform/config/import',
			request,
		),
	connectors: () =>
		client.get<EnterprisePlatformConnectorsResponse>('/enterprise/platform/connectors'),
	governance: () =>
		client.get<EnterprisePlatformGovernanceResponse>('/enterprise/platform/governance'),
	members: () =>
		client.get<EnterprisePlatformMembersResponse>('/enterprise/platform/members'),
	createMember: (request: EnterprisePlatformMemberUpsertRequest) =>
		client.post<EnterprisePlatformMemberUpdateResponse>(
			'/enterprise/platform/members',
			request,
		),
	updateMember: (
		userId: string,
		request: Partial<EnterprisePlatformMemberUpsertRequest>,
	) =>
		client.patch<EnterprisePlatformMemberUpdateResponse>(
			`/enterprise/platform/members/${encodeURIComponent(userId)}`,
			request,
		),
	deactivateMember: (userId: string) =>
		client.delete<EnterprisePlatformMemberUpdateResponse>(
			`/enterprise/platform/members/${encodeURIComponent(userId)}`,
		),
	scenarios: () =>
		client.get<EnterprisePlatformScenariosResponse>('/enterprise/platform/scenarios'),
	opsTasks: () =>
		client.get<EnterprisePlatformOpsTasksResponse>('/enterprise/platform/ops/tasks'),
	resolveOpsTask: (taskCode: string) =>
		client.post<EnterprisePlatformOpsTaskResolveResponse>(
			`/enterprise/platform/ops/tasks/${encodeURIComponent(taskCode)}/resolve`,
			{},
		),
	testConnector: (request: EnterpriseConnectorTestRequest) =>
		client.post<EnterpriseConnectorTestResponse>(
			'/enterprise/platform/connectors/test',
			request,
		),
	saveConnectorConfig: (request: EnterpriseConnectorConfigSaveRequest) =>
		client.post<EnterpriseConnectorConfigSaveResponse>(
			'/enterprise/platform/connectors/configs',
			request,
		),
	agents: () => client.get<EnterprisePlatformAgentsResponse>('/enterprise/platform/agents'),
	tools: (params?: { agent_id?: string; user_id?: string }) =>
		client.get<EnterpriseToolCatalogResponse>(
			'/enterprise/platform/tools',
			compactParams(params),
		),
	toolPolicy: (params?: { user_id?: string; tenant?: string }) =>
		client.get<EnterpriseToolPolicyResponse>(
			'/enterprise/platform/policies/tools',
			compactParams(params),
		),
	updateToolPolicy: (request: EnterpriseToolPolicyUpdateRequest) =>
		client.patch<EnterpriseToolPolicyUpdateResponse>(
			'/enterprise/platform/policies/tools',
			request,
		),
	audit: (params?: {
		tenant?: string;
		user_id?: string;
		agent_id?: string;
		tool_name?: string;
		success?: boolean;
		limit?: number;
	}) =>
		client.get<EnterpriseAuditQueryResponse>(
			'/enterprise/platform/audit',
			compactParams(params),
		),
	publishAgent: (request: EnterpriseAgentPublishRequest) =>
		client.post<EnterpriseAgentPublishResponse>(
			'/enterprise/platform/agents/publish',
			request,
		),
	updateAgent: (agentId: string, request: EnterpriseAgentUpdateRequest) =>
		client.patch<EnterpriseAgentUpdateResponse>(
			`/enterprise/platform/agents/${agentId}`,
			request,
		),
	archiveAgent: (agentId: string) =>
		client.delete<EnterpriseAgentUpdateResponse>(
			`/enterprise/platform/agents/${agentId}`,
		),
	runAgent: (request: EnterpriseAgentRunRequest) =>
		client.post<EnterpriseAgentRunResponse>('/enterprise/platform/agent/run', request),
	agentRuns: (params?: {
		agent_id?: string;
		tenant?: string;
		user_id?: string;
		session_id?: string;
		limit?: number;
	}) =>
		client.get<EnterpriseAgentRunsResponse>(
			'/enterprise/platform/agent/runs',
			compactParams(params),
		),
	agentRun: (turnId: string) =>
		client.get<EnterpriseAgentRunHistoryItem>(
			`/enterprise/platform/agent/runs/${encodeURIComponent(turnId)}`,
		),
	clearAgentRuns: (params?: {
		agent_id?: string;
		tenant?: string;
		user_id?: string;
		session_id?: string;
	}) =>
		client.delete<EnterpriseAgentRunsDeleteResponse>(
			'/enterprise/platform/agent/runs',
			compactParams(params),
		),
	runTool: (request: EnterpriseToolRunRequest) =>
		client.post<EnterpriseToolRunResponse>('/enterprise/platform/tools/run', request),
	workflows: () =>
		client.get<EnterpriseWorkflowTemplatesResponse>('/enterprise/platform/workflows'),
	updateWorkflow: (
		workflowType: string,
		request: EnterpriseWorkflowTemplateUpdateRequest,
	) =>
		client.patch<EnterpriseWorkflowTemplatesResponse>(
			`/enterprise/platform/workflows/${workflowType}`,
			request,
		),
	workflowRuns: (params?: {
		workflow_type?: string;
		agent_id?: string;
		tenant?: string;
		user_id?: string;
		limit?: number;
	}) =>
		client.get<EnterpriseWorkflowRunsResponse>(
			'/enterprise/platform/workflows/runs',
			compactParams(params),
		),
	runWorkflow: (request: EnterpriseWorkflowRunRequest) =>
		client.post<EnterpriseWorkflowRunResponse>(
			'/enterprise/platform/workflows/run',
			request,
		),
	approvals: (params?: {
		status?: string;
		tenant?: string;
		user_id?: string;
		agent_id?: string;
		limit?: number;
	}) =>
		client.get<EnterpriseApprovalsResponse>(
			'/enterprise/platform/approvals',
			compactParams(params),
		),
	createApproval: (request: EnterpriseApprovalCreateRequest) =>
		client.post<EnterpriseApprovalsResponse>('/enterprise/platform/approvals', request),
	approveApproval: (id: string, request: EnterpriseApprovalDecisionRequest) =>
		client.post<EnterpriseApprovalDecisionResponse>(
			`/enterprise/platform/approvals/${id}/approve`,
			request,
		),
	rejectApproval: (id: string, request: EnterpriseApprovalDecisionRequest) =>
		client.post<EnterpriseApprovalDecisionResponse>(
			`/enterprise/platform/approvals/${id}/reject`,
			request,
		),
};
