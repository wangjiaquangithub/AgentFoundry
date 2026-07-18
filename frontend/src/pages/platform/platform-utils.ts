import type {
	AgentView,
	EnterpriseAgentRunResponse,
	EnterpriseAgentTemplate,
	EnterpriseAgentToolCall,
	EnterpriseApprovalRequestItem,
	EnterpriseAuditEvent,
	EnterpriseAuditQueryResponse,
	EnterpriseIdentity,
	EnterprisePlatformMember,
	EnterprisePlatformOperations,
	EnterprisePlatformDashboardRiskTool,
	EnterprisePlatformDashboard,
	EnterprisePlatformConnectorsResponse,
	EnterprisePlatformGovernanceResponse,
	EnterprisePlatformStatusResponse,
	EnterprisePublishedAgent,
	EnterpriseTenantWorkspace,
	EnterpriseToolCatalogResponse,
	EnterpriseToolCatalogItem,
	EnterpriseWorkflowRunHistoryItem,
	EnterpriseWorkflowTemplate,
	ScheduleRecord,
} from '@/api';
import type { ComponentType, RefObject } from 'react';
import type { AccessControlStat } from './components/AccessControlPanel';
import type { FirstAgentGuideStep } from './components/FirstAgentGuide';
import type { GovernanceHealthItem } from './components/GovernanceHealthPanel';
import type { LaunchpadStep } from './components/LaunchpadPanel';
import type { MemoryOperationsItem } from './components/MemoryOperationsPanel';
import type { MonitoringAgentTurn, MonitoringStat } from './components/MonitoringSnapshotPanel';
import type { PlatformMemberTenantSummary } from './components/MembersPanel';
import type { OrchestrationWorkbenchStep } from './components/OrchestrationWorkbenchPanel';
import type { PlatformConsoleItem } from './components/PlatformConsolePanel';
import type { RolloutPathStep } from './components/RolloutPath';
import type { RuntimeStatusItem } from './components/RuntimeStatusPanel';
import type { ToolPolicyDraftValue } from './components/TenantGovernancePanel';
import type { TenantOverviewItem } from './components/TenantWorkspacePanel';
import type { TriggerOpsStat } from './components/TriggerOpsPanel';
import type {
	WorkbenchReadinessItem,
	WorkbenchQuickAction,
	WorkbenchRiskItem,
} from './components/WorkbenchReadinessPanel';
import type {
	WorkbenchActionCard,
	WorkbenchIndicator,
} from './components/WorkbenchStatusPanel';
import type { WorkflowOpsStat } from './components/WorkflowOpsPanel';
import type { CapabilityItem } from './components/CapabilitiesPanel';
import type { HealthState, StatCardProps } from './components/common';

export const defaultEnterpriseWorkflowInputs: Record<string, string> = {
	policy_keyword: 'remote',
	ticket_id: 'INC-1001',
	department: 'engineering',
};

export const enterpriseWorkflowFallbackOptions = [
	{ value: 'daily_ops_brief', labelKey: 'dailyOpsBrief' },
	{ value: 'ticket_followup', labelKey: 'ticketFollowup' },
	{ value: 'policy_review', labelKey: 'policyReview' },
];

export const workflowInputLabelKeys: Record<string, string> = {
	policy_keyword: 'policyKeyword',
	ticket_id: 'ticketId',
	department: 'department',
};

export type AgentSetupStepKey = 'template' | 'model' | 'knowledge' | 'tools' | 'runtime';

export interface AgentWizardStep {
	key: AgentSetupStepKey;
	title: string;
	detail: string;
	state: HealthState;
	ref: RefObject<HTMLDivElement | HTMLElement | null>;
}

export type EnterpriseToolInputConfigMap = Record<
	string,
	{ inputKey: string; labelKey: string; defaultValue: string }
>;

export function formatTimestamp(value?: string) {
	if (!value) {
		return '-';
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleString();
}

export function countArrayField(record: Record<string, unknown>, key: string) {
	const value = record[key];
	return Array.isArray(value) ? value.length : 0;
}

export function shortResourceId(id: string) {
	return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

export function capabilityStateForCount(
	count: number,
	emptyState: HealthState = 'partial',
): HealthState {
	return count > 0 ? 'ready' : emptyState;
}

export function capabilityStatusForCount(
	count: number,
	labels: { ready: string; empty: string },
) {
	return count > 0 ? labels.ready : labels.empty;
}

export function capabilityItemsForStatus(options: {
	t: (key: string, options?: Record<string, unknown>) => string;
	counts: {
		credentials: number;
		knowledgeBases: number;
		activeAgents: number;
		availableTools: number;
		workflows: number;
		tenants: number;
		pendingApprovals: number;
		auditEvents: number;
		configMembers: number;
		configAgents: number;
	};
	hasConfigExport: boolean;
	icons: {
		model: ComponentType<{ className?: string }>;
		knowledge: ComponentType<{ className?: string }>;
		agent: ComponentType<{ className?: string }>;
		tools: ComponentType<{ className?: string }>;
		workflow: ComponentType<{ className?: string }>;
		tenant: ComponentType<{ className?: string }>;
		audit: ComponentType<{ className?: string }>;
		config: ComponentType<{ className?: string }>;
	};
	actions: {
		credentials: () => void;
		knowledge: () => void;
		agents: () => void;
		tools: () => void;
		workflows: () => void;
		tenants: () => void;
		governance: () => void;
		config: () => void;
	};
}): CapabilityItem[] {
	const { actions, counts, hasConfigExport, icons, t } = options;

	return [
		{
			title: t('platform.capabilities.model.title'),
			description: t('platform.capabilities.model.description'),
			metric: t('platform.capabilities.model.metric', { count: counts.credentials }),
			actionLabel: t('platform.capabilities.model.action'),
			status: capabilityStatusForCount(counts.credentials, {
				ready: t('platform.status.ready'),
				empty: t('platform.status.toConfigure'),
			}),
			state: capabilityStateForCount(counts.credentials),
			icon: icons.model,
			onClick: actions.credentials,
		},
		{
			title: t('platform.capabilities.knowledge.title'),
			description: t('platform.capabilities.knowledge.description'),
			metric: t('platform.capabilities.knowledge.metric', { count: counts.knowledgeBases }),
			actionLabel: t('platform.capabilities.knowledge.action'),
			status: capabilityStatusForCount(counts.knowledgeBases, {
				ready: t('platform.status.ready'),
				empty: t('platform.status.toConfigure'),
			}),
			state: capabilityStateForCount(counts.knowledgeBases),
			icon: icons.knowledge,
			onClick: actions.knowledge,
		},
		{
			title: t('platform.capabilities.agent.title'),
			description: t('platform.capabilities.agent.description'),
			metric: t('platform.capabilities.agent.metric', {
				count: counts.activeAgents,
			}),
			actionLabel: t('platform.capabilities.agent.action'),
			status: capabilityStatusForCount(counts.activeAgents, {
				ready: t('platform.status.ready'),
				empty: t('platform.status.toConfigure'),
			}),
			state: capabilityStateForCount(counts.activeAgents, 'todo'),
			icon: icons.agent,
			onClick: actions.agents,
		},
		{
			title: t('platform.capabilities.tools.title'),
			description: t('platform.capabilities.tools.description'),
			metric: t('platform.capabilities.tools.metric', { count: counts.availableTools }),
			actionLabel: t('platform.capabilities.tools.action'),
			status: capabilityStatusForCount(counts.availableTools, {
				ready: t('platform.status.demoReady'),
				empty: t('platform.status.toConfigure'),
			}),
			state: capabilityStateForCount(counts.availableTools),
			icon: icons.tools,
			onClick: actions.tools,
		},
		{
			title: t('platform.capabilities.workflow.title'),
			description: t('platform.capabilities.workflow.description'),
			metric: t('platform.capabilities.workflow.metric', {
				count: counts.workflows,
			}),
			actionLabel: t('platform.capabilities.workflow.action'),
			status: capabilityStatusForCount(counts.workflows, {
				ready: t('platform.status.ready'),
				empty: t('platform.status.toConfigure'),
			}),
			state: capabilityStateForCount(counts.workflows, 'todo'),
			icon: icons.workflow,
			onClick: actions.workflows,
		},
		{
			title: t('platform.capabilities.tenant.title'),
			description: t('platform.capabilities.tenant.description'),
			metric: t('platform.capabilities.tenant.metric', {
				count: counts.tenants,
			}),
			actionLabel: t('platform.capabilities.tenant.action'),
			status: capabilityStatusForCount(counts.tenants, {
				ready: t('platform.status.ready'),
				empty: t('platform.status.toConfigure'),
			}),
			state: capabilityStateForCount(counts.tenants),
			icon: icons.tenant,
			onClick: actions.tenants,
		},
		{
			title: t('platform.capabilities.audit.title'),
			description: t('platform.capabilities.audit.description'),
			metric: t('platform.capabilities.audit.metric', {
				count: counts.pendingApprovals,
				auditCount: counts.auditEvents,
			}),
			actionLabel: t('platform.capabilities.audit.action'),
			status:
				counts.pendingApprovals > 0 ? t('platform.status.next') : t('platform.status.ready'),
			state: counts.pendingApprovals > 0 ? 'partial' : 'ready',
			icon: icons.audit,
			onClick: actions.governance,
		},
		{
			title: t('platform.capabilities.config.title'),
			description: t('platform.capabilities.config.description'),
			metric: t('platform.capabilities.config.metric', {
				members: counts.configMembers,
				agents: counts.configAgents,
			}),
			actionLabel: t('platform.capabilities.config.action'),
			status: hasConfigExport ? t('platform.status.ready') : t('platform.status.toConfigure'),
			state: hasConfigExport ? 'ready' : 'partial',
			icon: icons.config,
			onClick: actions.config,
		},
	];
}

export function launchpadTargetActionsForNavigation(actions: {
	members: () => void;
	credentials: () => void;
	agents: () => void;
	knowledge: () => void;
	run: () => void;
	tools: () => void;
	memory: () => void;
	connectors: () => void;
	governance: () => void;
	workflows: () => void;
}): Record<string, () => void> {
	return {
		members: actions.members,
		credentials: actions.credentials,
		agents: actions.agents,
		knowledge: actions.knowledge,
		run: actions.run,
		tools: actions.tools,
		memory: actions.memory,
		connectors: actions.connectors,
		governance: actions.governance,
		workflows: actions.workflows,
		audit: actions.governance,
	};
}

export function credentialLabel(credential: { id?: unknown; data?: { name?: unknown } }) {
	const name = credential.data?.name;
	return typeof name === 'string' && name.trim() ? name : String(credential.id ?? '');
}

export function modelCredentialLabel(
	modelConfigId: string | null | undefined,
	credentialById: Map<string, { id?: unknown; data?: { name?: unknown } }>,
	fallback: string,
	options?: { shortenFallback?: boolean },
) {
	if (!modelConfigId) {
		return fallback;
	}

	const credential = credentialById.get(modelConfigId);
	if (credential) {
		return credentialLabel(credential);
	}

	return options?.shortenFallback ? shortResourceId(modelConfigId) : modelConfigId;
}

export function knowledgeBaseLabel(knowledgeBase: { id?: unknown; name?: unknown }) {
	return typeof knowledgeBase.name === 'string' && knowledgeBase.name
		? knowledgeBase.name
		: String(knowledgeBase.id ?? '');
}

export function knowledgeBaseLabels(
	knowledgeBaseIds: string[],
	knowledgeBaseById: Map<string, { id?: unknown; name?: unknown }>,
) {
	return knowledgeBaseIds.map((knowledgeBaseId) => {
		const knowledgeBase = knowledgeBaseById.get(knowledgeBaseId);
		return knowledgeBase ? knowledgeBaseLabel(knowledgeBase) : knowledgeBaseId;
	});
}

export type AgentRunnerNextStepMode = 'model' | 'publish' | 'configure' | 'governance' | 'run';

export function agentRoutingDisplayStateForResult(
	agentRunResult: EnterpriseAgentRunResponse | null,
	labels: {
		model: string;
		rules: string;
	},
) {
	const agentRoutingLabel =
		agentRunResult?.routing_mode ||
		agentRunResult?.routing_source ||
		agentRunResult?.decision?.routing_mode ||
		agentRunResult?.decision?.routing_source;
	const agentRoutingText =
		agentRoutingLabel === 'model'
			? labels.model
			: agentRoutingLabel === 'rules'
				? labels.rules
				: agentRoutingLabel;

	return { agentRoutingLabel, agentRoutingText };
}

export function agentRunnerStateForStatus(
	values: {
		selectedRunAgent: EnterprisePublishedAgent | null;
		agentRunResult: EnterpriseAgentRunResponse | null;
		credentialById: Map<string, { id?: unknown; data?: { name?: unknown } }>;
		knowledgeBaseById: Map<string, { id?: unknown; name?: unknown }>;
		credentialCount: number;
		activePlatformAgentCount: number;
		readyPlatformAgentCount: number;
		hasDefaultAgentTemplate: boolean;
		publishingTemplate: boolean;
	},
	labels: {
		noneConfigured: string;
		noSelectedAgent: string;
		readiness: (state: HealthState) => string;
		connectorSourceSaved: string;
		connectorSourceGlobal: string;
		toolCallCount: (count: number) => string;
		notRouted: string;
	},
) {
	const {
		activePlatformAgentCount,
		agentRunResult,
		credentialById,
		credentialCount,
		hasDefaultAgentTemplate,
		knowledgeBaseById,
		publishingTemplate,
		readyPlatformAgentCount,
		selectedRunAgent,
	} = values;

	const selectedRunAgentModelLabel = modelCredentialLabel(
		selectedRunAgent?.model_config_id,
		credentialById,
		labels.noneConfigured,
	);
	const selectedRunAgentKnowledgeLabels = knowledgeBaseLabels(
		selectedRunAgent?.knowledge_base_ids ?? [],
		knowledgeBaseById,
	);
	const selectedRunAgentToolCount = selectedRunAgent?.tools?.length ?? 0;
	const selectedRunAgentKnowledgeCount = selectedRunAgentKnowledgeLabels.length;
	const selectedRunAgentReadinessState = agentReadinessState(selectedRunAgent);
	const selectedRunAgentReadinessLabel = selectedRunAgent
		? labels.readiness(selectedRunAgentReadinessState)
		: labels.noSelectedAgent;
	const nextStepMode: AgentRunnerNextStepMode =
		credentialCount === 0
			? 'model'
			: activePlatformAgentCount === 0
				? 'publish'
				: readyPlatformAgentCount === 0
					? 'configure'
					: agentRunResult
						? 'governance'
						: 'run';
	const nextStepPrimaryDisabled =
		(nextStepMode === 'publish' && (!hasDefaultAgentTemplate || publishingTemplate)) ||
		(nextStepMode === 'run' && !selectedRunAgent);
	const agentRunModelLabel = modelCredentialLabel(
		agentRunResult?.model_config_id,
		credentialById,
		labels.noneConfigured,
	);
	const agentRunKnowledgeLabels = knowledgeBaseLabels(
		agentRunResult?.knowledge_base_ids ?? [],
		knowledgeBaseById,
	);
	const agentRunConnectorSourceText =
		agentRunResult?.connector_source === 'saved_config'
			? labels.connectorSourceSaved
			: agentRunResult?.connector_source === 'global'
				? labels.connectorSourceGlobal
				: agentRunResult?.connector_source;
	const agentToolCalls: EnterpriseAgentToolCall[] =
		agentRunResult?.tool_calls && agentRunResult.tool_calls.length > 0
			? agentRunResult.tool_calls
			: agentRunResult
				? [
						{
							tool_name: agentRunResult.tool_name || '',
							inputs: agentRunResult.inputs,
							allowed: agentRunResult.routed,
							tenant: agentRunResult.tenant,
							user_id: agentRunResult.user_id,
							connector: agentRunResult.connector,
							connector_source: agentRunResult.connector_source,
							routing_source: agentRunResult.routing_source,
							routing_reason: agentRunResult.routing_reason,
							decision: agentRunResult.decision,
							result: agentRunResult.result,
							answer: agentRunResult.answer,
						},
					]
				: [];
	const agentToolCallBadgeText =
		agentToolCalls.length > 1
			? labels.toolCallCount(agentToolCalls.length)
			: agentRunResult?.routed
				? agentRunResult.tool_name || labels.notRouted
				: labels.notRouted;

	return {
		selectedRunAgentModelLabel,
		selectedRunAgentKnowledgeLabels,
		selectedRunAgentToolCount,
		selectedRunAgentKnowledgeCount,
		selectedRunAgentReadinessState,
		selectedRunAgentReadinessLabel,
		nextStepMode,
		nextStepPrimaryDisabled,
		agentRunModelLabel,
		agentRunKnowledgeLabels,
		agentRunConnectorSourceText,
		agentToolCalls,
		agentToolCallBadgeText,
		agentRunEvidence: agentRunResult?.evidence,
	};
}

export function resourceListLabel(values: string[], emptyLabel: string) {
	return values.length > 0 ? values.join(', ') : emptyLabel;
}

export function resourceCountLabel(
	count: number,
	labels: { available: (count: number) => string; empty: string },
) {
	return count > 0 ? labels.available(count) : labels.empty;
}

export function activePlatformMembersForTenant(
	members: EnterprisePlatformMember[],
	tenant: string,
) {
	return members.filter(
		(member) => member.status !== 'inactive' && member.tenant === tenant,
	);
}

export function activePlatformMemberCountForMembers(members: EnterprisePlatformMember[]) {
	return members.filter((member) => member.status !== 'inactive').length;
}

export function platformMembersByUserId(members: EnterprisePlatformMember[]) {
	return new Map(members.map((member) => [member.user_id, member]));
}

export function publishAccessMembersForSelection(values: {
	activeMembers: EnterprisePlatformMember[];
	memberByUserId: Map<string, EnterprisePlatformMember>;
	allowedUserIds: string[];
	tenant: string;
}) {
	const memberById = platformMembersByUserId(values.activeMembers);
	values.allowedUserIds.forEach((userId) => {
		if (!memberById.has(userId)) {
			const existingMember = values.memberByUserId.get(userId);
			memberById.set(userId, {
				user_id: userId,
				tenant: existingMember?.tenant ?? values.tenant,
				display_name: existingMember?.display_name ?? userId,
				role: existingMember?.role ?? '',
				status: existingMember?.status ?? 'inactive',
				source: existingMember?.source,
				updated_at: existingMember?.updated_at,
				updated_by: existingMember?.updated_by,
			});
		}
	});
	return Array.from(memberById.values()).sort((left, right) =>
		(left.display_name || left.user_id).localeCompare(right.display_name || right.user_id),
	);
}

export function publishRoleOptionsForMembers(values: {
	activeMembers: EnterprisePlatformMember[];
	configuredRoles: string[];
	selectedRoles: string[];
}) {
	return Array.from(
		new Set([
			...values.activeMembers.map((member) => member.role).filter(Boolean),
			...values.configuredRoles.filter((role) =>
				values.activeMembers.some((member) => member.role === role),
			),
			...values.selectedRoles,
		]),
	).sort();
}

export function publishAccessStateForStatus(values: {
	tenant: string;
	currentUserTenant?: string;
	members: EnterprisePlatformMember[];
	configuredRoles: string[];
	allowedUserIds: string[];
	allowedRoles: string[];
}) {
	const publishTenant = values.tenant.trim() || values.currentUserTenant || 'default';
	const activePlatformMembers = activePlatformMembersForTenant(values.members, publishTenant);
	const platformMemberById = platformMembersByUserId(values.members);
	const publishAccessMembers = publishAccessMembersForSelection({
		activeMembers: activePlatformMembers,
		memberByUserId: platformMemberById,
		allowedUserIds: values.allowedUserIds,
		tenant: publishTenant,
	});
	const publishRoleOptions = publishRoleOptionsForMembers({
		activeMembers: activePlatformMembers,
		configuredRoles: values.configuredRoles,
		selectedRoles: values.allowedRoles,
	});

	return {
		publishTenant,
		activePlatformMembers,
		platformMemberById,
		publishAccessMembers,
		publishRoleOptions,
	};
}

export function tenantWorkspaceEntriesForWorkspaces(
	workspaces?: Record<string, EnterpriseTenantWorkspace> | null,
) {
	return workspaces ? Object.entries(workspaces) : [];
}

export function tenantWorkspaceByNameForEntries(
	tenantWorkspaces: Array<[string, EnterpriseTenantWorkspace]>,
) {
	return new Map(tenantWorkspaces);
}

export function tenantWorkspaceOperationsStateForStatus(
	values: {
		connectors?: EnterprisePlatformConnectorsResponse | null;
		enterpriseIdentities: EnterpriseIdentity[];
		activePlatformAgents: EnterprisePublishedAgent[];
		pendingApprovals: EnterpriseApprovalRequestItem[];
		auditEvents: EnterpriseAuditEvent[];
		workflowRuns: EnterpriseWorkflowRunHistoryItem[];
		members: EnterprisePlatformMember[];
	},
	labels: {
		localSource: string;
	},
) {
	const tenantWorkspaces = tenantWorkspaceEntriesForWorkspaces(
		values.connectors?.tenant_workspaces,
	);
	const tenantWorkspaceByName = tenantWorkspaceByNameForEntries(tenantWorkspaces);
	const tenantWorkspaceState = tenantWorkspaceStateForStatus(
		{
			tenantWorkspaces,
			tenantWorkspaceByName,
			enterpriseIdentities: values.enterpriseIdentities,
			activePlatformAgents: values.activePlatformAgents,
			pendingApprovals: values.pendingApprovals,
			auditEvents: values.auditEvents,
			workflowRuns: values.workflowRuns,
			members: values.members,
		},
		labels,
	);

	return {
		tenantWorkspaces,
		tenantWorkspaceByName,
		tenantOverviewItems: tenantWorkspaceState.tenantOverviewItems,
		platformMemberTenantSummaries: tenantWorkspaceState.platformMemberTenantSummaries,
	};
}

export function workflowTemplateByTypeForTemplates(templates: EnterpriseWorkflowTemplate[]) {
	return new Map(templates.map((template) => [template.workflow_type, template]));
}

export function workflowSelectionStateForTemplates(
	values: {
		workflowTemplates: EnterpriseWorkflowTemplate[];
		selectedWorkflowType: string;
	},
	labels: {
		fallbackLabel: (labelKey: string) => string;
	},
) {
	const workflowTemplateByType = workflowTemplateByTypeForTemplates(values.workflowTemplates);
	const selectedWorkflowTemplate =
		workflowTemplateByType.get(values.selectedWorkflowType) ?? null;
	const workflowOptions =
		values.workflowTemplates.length > 0
			? values.workflowTemplates.map((template) => ({
					value: template.workflow_type,
					label: template.name,
					enabled: template.enabled,
					defaultInputs: template.default_inputs,
				}))
			: enterpriseWorkflowFallbackOptions.map((workflow) => ({
					value: workflow.value,
					label: labels.fallbackLabel(workflow.labelKey),
					enabled: true,
					defaultInputs: defaultEnterpriseWorkflowInputs,
				}));
	const selectedWorkflowDisabled = Boolean(
		selectedWorkflowTemplate && !selectedWorkflowTemplate.enabled,
	);

	return {
		workflowTemplateByType,
		selectedWorkflowTemplate,
		workflowOptions,
		selectedWorkflowDisabled,
	};
}

export function publishReleaseIssuesForDraft(
	values: {
		modelConfigId?: string | null;
		knowledgeBaseCount: number;
	},
	labels: {
		missingModel: string;
		noKnowledge: string;
	},
) {
	return [
		!values.modelConfigId ? labels.missingModel : null,
		values.knowledgeBaseCount === 0 ? labels.noKnowledge : null,
	].filter(Boolean) as string[];
}

export function publishDraftStateForStatus(
	values: {
		modelConfigId?: string | null;
		knowledgeBaseCount: number;
		allowedUserCount: number;
		allowedRoleCount: number;
		memoryEnabled: boolean;
		workflowEnabled: boolean;
		hasSelectedTemplate: boolean;
		credentialById: Map<string, { id?: unknown; data?: { name?: unknown } }>;
	},
	labels: {
		noneConfigured: string;
		accessOpen: string;
		accessRestricted: (values: { users: number; roles: number }) => string;
		runtimeSummary: (values: { memory: string; workflow: string }) => string;
		enabled: string;
		disabled: string;
		missingModel: string;
		noKnowledge: string;
	},
) {
	const publishSelectedModelLabel = modelCredentialLabel(
		values.modelConfigId,
		values.credentialById,
		labels.noneConfigured,
		{ shortenFallback: true },
	);
	const publishAccessScopeSummary =
		values.allowedUserCount === 0 && values.allowedRoleCount === 0
			? labels.accessOpen
			: labels.accessRestricted({
					users: values.allowedUserCount,
					roles: values.allowedRoleCount,
				});
	const publishRuntimeSummary = labels.runtimeSummary({
		memory: values.memoryEnabled ? labels.enabled : labels.disabled,
		workflow: values.workflowEnabled ? labels.enabled : labels.disabled,
	});
	const publishReleaseIssues = publishReleaseIssuesForDraft(
		{
			modelConfigId: values.modelConfigId,
			knowledgeBaseCount: values.knowledgeBaseCount,
		},
		{
			missingModel: labels.missingModel,
			noKnowledge: labels.noKnowledge,
		},
	);
	const publishBlocked = !values.hasSelectedTemplate || !values.modelConfigId;

	return {
		publishSelectedModelLabel,
		publishAccessScopeSummary,
		publishRuntimeSummary,
		publishReleaseIssues,
		publishBlocked,
	};
}

export function connectorDraftIssuesForDraft(
	values: {
		baseUrl: string;
		timeoutSeconds: number;
		policyPath: string;
		ticketPath: string;
		metricsPath: string;
	},
	labels: {
		baseUrlRequired: string;
		baseUrlProtocol: string;
		timeout: string;
		policyPath: string;
		ticketPath: string;
		metricsPath: string;
	},
) {
	const trimmedBaseUrl = values.baseUrl.trim();

	return [
		!trimmedBaseUrl ? labels.baseUrlRequired : null,
		trimmedBaseUrl && !/^https?:\/\//i.test(trimmedBaseUrl)
			? labels.baseUrlProtocol
			: null,
		!Number.isFinite(values.timeoutSeconds) || values.timeoutSeconds <= 0
			? labels.timeout
			: null,
		!values.policyPath.trim().startsWith('/') ? labels.policyPath : null,
		!values.ticketPath.trim().startsWith('/') ? labels.ticketPath : null,
		!values.metricsPath.trim().startsWith('/') ? labels.metricsPath : null,
	].filter(Boolean) as string[];
}

export function connectorHealthState(status?: string): HealthState {
	if (status === 'ready') {
		return 'ready';
	}

	if (status === 'error') {
		return 'todo';
	}

	return 'partial';
}

export function connectorOperationsStateForStatus(values: {
	connectors?: EnterprisePlatformConnectorsResponse | null;
	form: {
		tenant: string;
		base_url: string;
		policy_path: string;
		ticket_path: string;
		metrics_path: string;
		timeout_seconds: string;
		enabled: boolean;
		token: string;
	};
	testResult?: { status?: string | null } | null;
	labels: Parameters<typeof connectorDraftIssuesForDraft>[1] & {
		runtimeSavedConfig: string;
		runtimeGlobal: string;
	};
}) {
	const connectorState = connectorHealthState(values.connectors?.current.status);
	const savedConnectorConfigs = values.connectors?.saved_configs ?? [];
	const activeConnectorTenant = values.form.tenant.trim() || 'acme';
	const activeSavedConnectorConfig =
		savedConnectorConfigs.find((config) => config.tenant === activeConnectorTenant) ?? null;
	const connectorTimeoutValue = Number.parseFloat(values.form.timeout_seconds);
	const connectorDraftIssues = connectorDraftIssuesForDraft(
		{
			baseUrl: values.form.base_url,
			timeoutSeconds: connectorTimeoutValue,
			policyPath: values.form.policy_path,
			ticketPath: values.form.ticket_path,
			metricsPath: values.form.metrics_path,
		},
		values.labels,
	);
	const connectorDraftMatchesSaved = Boolean(
		activeSavedConnectorConfig &&
			values.form.base_url.trim() === activeSavedConnectorConfig.base_url &&
			values.form.policy_path.trim() === activeSavedConnectorConfig.policy_path &&
			values.form.ticket_path.trim() === activeSavedConnectorConfig.ticket_path &&
			values.form.metrics_path.trim() === activeSavedConnectorConfig.metrics_path &&
			Number.isFinite(connectorTimeoutValue) &&
			connectorTimeoutValue === activeSavedConnectorConfig.timeout_seconds &&
			values.form.enabled === activeSavedConnectorConfig.enabled &&
			!values.form.token.trim(),
	);
	const connectorDraftState: HealthState =
		connectorDraftIssues.length > 0
			? 'todo'
			: connectorDraftMatchesSaved
				? 'ready'
				: 'partial';
	const connectorTestPassed = values.testResult?.status === 'success';
	const connectorRuntimeState = values.connectors?.runtime.saved_config_enabled
		? 'ready'
		: connectorState;
	const connectorRuntimeSourceText =
		values.connectors?.runtime.source === 'saved_config'
			? values.labels.runtimeSavedConfig
			: values.labels.runtimeGlobal;

	return {
		connectorState,
		savedConnectorConfigs,
		activeConnectorTenant,
		activeSavedConnectorConfig,
		connectorTimeoutValue,
		connectorDraftIssues,
		connectorDraftMatchesSaved,
		connectorDraftState,
		connectorTestPassed,
		connectorRuntimeState,
		connectorRuntimeSourceText,
	};
}

export function agentSetupStepsForStatus(
	values: {
		selectedTemplateName?: string | null;
		modelConfigId: string;
		credentialById: Map<string, { id?: unknown; data?: { name?: unknown } }>;
		credentialCount: number;
		selectedKnowledgeBaseCount: number;
		knowledgeBaseCount: number;
		selectedToolCount: number;
		memoryEnabled: boolean;
		workflowEnabled: boolean;
		refs: Record<AgentSetupStepKey, RefObject<HTMLDivElement | HTMLElement | null>>;
	},
	labels: {
		templateTitle: string;
		templateMissing: string;
		modelTitle: string;
		modelMissing: string;
		noModel: string;
		knowledgeTitle: string;
		selectedKnowledge: (count: number) => string;
		knowledgeMissing: string;
		noKnowledge: string;
		toolsTitle: string;
		toolsSelected: (count: number) => string;
		toolsMissing: string;
		runtimeTitle: string;
		runtimeDetail: (values: { memory: string; workflow: string }) => string;
		enabled: string;
		disabled: string;
	},
): AgentWizardStep[] {
	return [
		{
			key: 'template',
			title: labels.templateTitle,
			detail: values.selectedTemplateName ?? labels.templateMissing,
			state: values.selectedTemplateName ? 'ready' : 'todo',
			ref: values.refs.template,
		},
		{
			key: 'model',
			title: labels.modelTitle,
			detail: modelCredentialLabel(
				values.modelConfigId,
				values.credentialById,
				values.credentialCount > 0 ? labels.modelMissing : labels.noModel,
			),
			state: values.modelConfigId
				? 'ready'
				: values.credentialCount > 0
					? 'todo'
					: 'blocked',
			ref: values.refs.model,
		},
		{
			key: 'knowledge',
			title: labels.knowledgeTitle,
			detail:
				values.selectedKnowledgeBaseCount > 0
					? labels.selectedKnowledge(values.selectedKnowledgeBaseCount)
					: values.knowledgeBaseCount > 0
						? labels.knowledgeMissing
						: labels.noKnowledge,
			state:
				values.selectedKnowledgeBaseCount > 0
					? 'ready'
					: values.knowledgeBaseCount > 0
						? 'todo'
						: 'partial',
			ref: values.refs.knowledge,
		},
		{
			key: 'tools',
			title: labels.toolsTitle,
			detail:
				values.selectedToolCount > 0
					? labels.toolsSelected(values.selectedToolCount)
					: labels.toolsMissing,
			state: values.selectedToolCount > 0 ? 'ready' : 'todo',
			ref: values.refs.tools,
		},
		{
			key: 'runtime',
			title: labels.runtimeTitle,
			detail: labels.runtimeDetail({
				memory: values.memoryEnabled ? labels.enabled : labels.disabled,
				workflow: values.workflowEnabled ? labels.enabled : labels.disabled,
			}),
			state: values.memoryEnabled || values.workflowEnabled ? 'ready' : 'partial',
			ref: values.refs.runtime,
		},
	];
}

export function nextAgentSetupStepForSteps(steps: AgentWizardStep[]) {
	return (
		steps.find((step) => step.state === 'blocked' || step.state === 'todo') ??
		steps.find((step) => step.state === 'partial') ??
		null
	);
}

type PlatformOverviewStatKey = 'agents' | 'credentials' | 'knowledgeBases' | 'workflows';

export function platformOverviewStatsForSummary(
	values: {
		platformAgentCount?: number;
		agentCount: number;
		credentialCount: number;
		knowledgeBaseCount: number;
		workflowTemplateCount: number;
		scheduleCount: number;
		loading: Record<PlatformOverviewStatKey, boolean>;
	},
	options: {
		icons: Record<PlatformOverviewStatKey, ComponentType<{ className?: string }>>;
		labels: {
			label: (key: PlatformOverviewStatKey) => string;
			helper: (key: PlatformOverviewStatKey) => string;
		};
	},
): StatCardProps[] {
	const items: Array<{ key: PlatformOverviewStatKey; value: number; loading: boolean }> = [
		{
			key: 'agents',
			value: values.platformAgentCount ?? values.agentCount,
			loading: values.loading.agents,
		},
		{
			key: 'credentials',
			value: values.credentialCount,
			loading: values.loading.credentials,
		},
		{
			key: 'knowledgeBases',
			value: values.knowledgeBaseCount,
			loading: values.loading.knowledgeBases,
		},
		{
			key: 'workflows',
			value: values.workflowTemplateCount || values.scheduleCount,
			loading: values.loading.workflows,
		},
	];

	return items.map((item) => ({
		label: options.labels.label(item.key),
		value: item.value,
		helper: options.labels.helper(item.key),
		icon: options.icons[item.key],
		loading: item.loading,
	}));
}

type RuntimeStatusItemKey =
	| 'platform'
	| 'userTenant'
	| 'connector'
	| 'dataDir'
	| 'auditPath'
	| 'auditStatus';

export function runtimeStatusItemsForStatus(
	values: {
		platformStatus: EnterprisePlatformStatusResponse | null | undefined;
		currentIdentityLabel: string;
	},
	options: {
		icons: Record<RuntimeStatusItemKey, ComponentType<{ className?: string }>>;
		labels: {
			label: (key: RuntimeStatusItemKey) => string;
			unavailable: string;
			enabled: string;
			disabled: string;
		};
	},
): RuntimeStatusItem[] {
	const platformStatus = values.platformStatus;
	const items: Array<{ key: RuntimeStatusItemKey; value: string }> = [
		{
			key: 'platform',
			value: platformStatus
				? `${platformStatus.platform.name} ${platformStatus.platform.version}`
				: options.labels.unavailable,
		},
		{
			key: 'userTenant',
			value: values.currentIdentityLabel,
		},
		{
			key: 'connector',
			value: platformStatus?.connector.name || options.labels.unavailable,
		},
		{
			key: 'dataDir',
			value: platformStatus?.storage.data_dir || options.labels.unavailable,
		},
		{
			key: 'auditPath',
			value: platformStatus?.storage.audit_log_path || options.labels.unavailable,
		},
		{
			key: 'auditStatus',
			value: platformStatus
				? platformStatus.audit.enabled
					? options.labels.enabled
					: options.labels.disabled
				: options.labels.unavailable,
		},
	];

	return items.map((item) => ({
		label: options.labels.label(item.key),
		value: item.value,
		icon: options.icons[item.key],
	}));
}

export function agentKnowledgeBaseLabels(
	agent: Pick<EnterprisePublishedAgent, 'knowledge_base_ids'> | null | undefined,
	knowledgeBaseById: Map<string, { id?: unknown; name?: unknown }>,
) {
	return knowledgeBaseLabels(agent?.knowledge_base_ids ?? [], knowledgeBaseById);
}

export function agentResourceSummary(
	agent: Pick<EnterprisePublishedAgent, 'knowledge_base_ids' | 'model_config_id' | 'tools'>,
	credentialById: Map<string, { id?: unknown; data?: { name?: unknown } }>,
	noModelLabel: string,
) {
	return {
		model: modelCredentialLabel(agent.model_config_id, credentialById, noModelLabel),
		knowledge: (agent.knowledge_base_ids ?? []).length,
		tools: (agent.tools ?? []).length,
	};
}

export function agentModelLabel(
	agent: Pick<EnterprisePublishedAgent, 'model_config_id'> | null | undefined,
	credentialById: Map<string, { id?: unknown; data?: { name?: unknown } }>,
	noModelLabel: string,
) {
	return modelCredentialLabel(agent?.model_config_id, credentialById, noModelLabel);
}

export function tenantOverviewItemsForWorkspace(
	values: {
		tenantWorkspaces: Array<[string, EnterpriseTenantWorkspace]>;
		tenantWorkspaceByName: Map<string, EnterpriseTenantWorkspace>;
		enterpriseIdentities: EnterpriseIdentity[];
		activePlatformAgents: EnterprisePublishedAgent[];
		pendingApprovals: EnterpriseApprovalRequestItem[];
		auditEvents: EnterpriseAuditEvent[];
		workflowRuns: EnterpriseWorkflowRunHistoryItem[];
	},
	labels: {
		localSource: string;
	},
): TenantOverviewItem[] {
	const tenants = new Set<string>();
	values.tenantWorkspaces.forEach(([tenant]) => tenants.add(tenant));
	values.enterpriseIdentities.forEach((identity) => tenants.add(identity.tenant));
	values.activePlatformAgents.forEach((agent) => tenants.add(agent.tenant));
	values.pendingApprovals.forEach((approval) => tenants.add(approval.tenant));
	values.auditEvents.forEach((event) => {
		if (event.tenant) {
			tenants.add(event.tenant);
		}
	});
	values.workflowRuns.forEach((run) => tenants.add(run.tenant));

	return Array.from(tenants)
		.sort()
		.map((tenant) => {
			const workspace = values.tenantWorkspaceByName.get(tenant);
			const identities = values.enterpriseIdentities.filter(
				(identity) => identity.tenant === tenant,
			);
			const roles = new Set(identities.map((identity) => identity.role).filter(Boolean));
			const sampleQuestion =
				workspace?.sample_questions[0] ??
				identities.find((identity) => identity.sample_questions.length > 0)
					?.sample_questions[0] ??
				'';

			return {
				tenant,
				source: workspace?.source ?? labels.localSource,
				identityCount: identities.length,
				roleCount: roles.size,
				agentCount: values.activePlatformAgents.filter((agent) => agent.tenant === tenant)
					.length,
				pendingApprovalCount: values.pendingApprovals.filter(
					(approval) => approval.tenant === tenant,
				).length,
				auditEventCount: values.auditEvents.filter((event) => event.tenant === tenant)
					.length,
				workflowRunCount: values.workflowRuns.filter((run) => run.tenant === tenant)
					.length,
				sampleQuestion,
				representativeIdentity: identities[0] ?? null,
			};
		});
}

export function platformMemberTenantSummariesForMembers(values: {
	members: EnterprisePlatformMember[];
	activePlatformAgents: EnterprisePublishedAgent[];
	pendingApprovals: EnterpriseApprovalRequestItem[];
	auditEvents: EnterpriseAuditEvent[];
}): PlatformMemberTenantSummary[] {
	const tenants = new Set<string>();

	values.members.forEach((member) => tenants.add(member.tenant));
	values.activePlatformAgents.forEach((agent) => tenants.add(agent.tenant));
	values.pendingApprovals.forEach((approval) => tenants.add(approval.tenant));
	values.auditEvents.forEach((event) => {
		if (event.tenant) {
			tenants.add(event.tenant);
		}
	});

	return Array.from(tenants)
		.sort()
		.map((tenant) => {
			const tenantMembers = values.members.filter((member) => member.tenant === tenant);
			const roleNames = Array.from(
				new Set(tenantMembers.map((member) => member.role).filter(Boolean)),
			).sort();

			return {
				tenant,
				members: tenantMembers.sort((first, second) =>
					(first.display_name || first.user_id).localeCompare(
						second.display_name || second.user_id,
					),
				),
				activeMemberCount: activePlatformMemberCountForMembers(tenantMembers),
				inactiveMemberCount: tenantMembers.filter((member) => member.status === 'inactive')
					.length,
				roleNames,
				agentCount: values.activePlatformAgents.filter((agent) => agent.tenant === tenant)
					.length,
				pendingApprovalCount: values.pendingApprovals.filter(
					(approval) => approval.tenant === tenant,
				).length,
				auditEventCount: values.auditEvents.filter((event) => event.tenant === tenant)
					.length,
			};
		});
}

export function tenantWorkspaceStateForStatus(
	values: {
		tenantWorkspaces: Array<[string, EnterpriseTenantWorkspace]>;
		tenantWorkspaceByName: Map<string, EnterpriseTenantWorkspace>;
		enterpriseIdentities: EnterpriseIdentity[];
		activePlatformAgents: EnterprisePublishedAgent[];
		pendingApprovals: EnterpriseApprovalRequestItem[];
		auditEvents: EnterpriseAuditEvent[];
		workflowRuns: EnterpriseWorkflowRunHistoryItem[];
		members: EnterprisePlatformMember[];
	},
	labels: {
		localSource: string;
	},
) {
	return {
		tenantOverviewItems: tenantOverviewItemsForWorkspace(values, labels),
		platformMemberTenantSummaries: platformMemberTenantSummariesForMembers(values),
	};
}

export interface MemoryOperationsConversationTurn {
	agentId: string;
	question: string;
	answer: string;
	createdAt: string;
	response: EnterpriseAgentRunResponse;
}

export function memoryOperationsItemsForConversations(values: {
	activePlatformAgents: EnterprisePublishedAgent[];
	agentConversations: Record<string, MemoryOperationsConversationTurn[]>;
}): MemoryOperationsItem[] {
	const grouped = new Map<string, MemoryOperationsItem>();
	const agentNameById = new Map(
		values.activePlatformAgents.map((agent) => [agent.id, agent.name || agent.id]),
	);

	Object.values(values.agentConversations)
		.flat()
		.forEach((turn) => {
			const response = turn.response;
			const tenant = response.memory_scope?.tenant || response.tenant || 'default';
			const userId = response.memory_scope?.user_id || response.user_id || '';
			const agentId = response.memory_scope?.agent_id || response.agent_id || turn.agentId;
			const key = `${tenant}:${userId}:${agentId}`;
			const hitCount = response.evidence?.memory_hit_count ?? response.memory_hits?.length ?? 0;
			const memorySaved = response.evidence?.memory_saved ?? response.memory_saved ?? false;
			const sources = Array.from(
				new Set(
					(response.memory_hits ?? [])
						.map((hit) => hit.source)
						.filter((source): source is string => Boolean(source)),
				),
			);
			const current = grouped.get(key);
			const latestAt = response.evidence?.created_at || turn.createdAt;
			const agentName =
				response.agent_name ||
				agentNameById.get(agentId) ||
				turn.response.agent_name ||
				agentId;

			if (!current) {
				grouped.set(key, {
					key,
					tenant,
					userId,
					agentId,
					agentName,
					runCount: 1,
					memoryHitCount: hitCount,
					memorySavedCount: memorySaved ? 1 : 0,
					latestAt,
					latestQuestion: turn.question,
					latestAnswer: turn.answer,
					latestResponse: response,
					sources,
				});
				return;
			}

			current.runCount += 1;
			current.memoryHitCount += hitCount;
			current.memorySavedCount += memorySaved ? 1 : 0;
			current.sources = Array.from(new Set([...current.sources, ...sources]));

			const currentLatest = Date.parse(current.latestAt);
			const nextLatest = Date.parse(latestAt);
			if (
				Number.isNaN(currentLatest) ||
				(!Number.isNaN(nextLatest) && nextLatest > currentLatest)
			) {
				current.latestAt = latestAt;
				current.latestQuestion = turn.question;
				current.latestAnswer = turn.answer;
				current.latestResponse = response;
			}
		});

	return Array.from(grouped.values()).sort((left, right) => {
		const rightTime = Date.parse(right.latestAt);
		const leftTime = Date.parse(left.latestAt);
		return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
	});
}

export function memoryOperationsSummaryForItems(items: MemoryOperationsItem[]) {
	return items.reduce(
		(summary, item) => ({
			runCount: summary.runCount + item.runCount,
			hitCount: summary.hitCount + item.memoryHitCount,
			savedCount: summary.savedCount + item.memorySavedCount,
		}),
		{
			runCount: 0,
			hitCount: 0,
			savedCount: 0,
		},
	);
}

export function memoryOperationsStateForConversations(values: {
	activePlatformAgents: EnterprisePublishedAgent[];
	agentConversations: Record<string, MemoryOperationsConversationTurn[]>;
}) {
	const items = memoryOperationsItemsForConversations(values);
	const summary = memoryOperationsSummaryForItems(items);

	return {
		items,
		summary,
		runCount: summary.runCount,
		hitCount: summary.hitCount,
		savedCount: summary.savedCount,
	};
}

export function dashboardOperationsSummaryForOperations(
	operations?: EnterprisePlatformOperations,
) {
	const workflowStatusCounts = operations?.workflow_status_counts ?? {};

	return {
		completedWorkflowRunCount: workflowStatusCounts.completed ?? 0,
		partialWorkflowRunCount: workflowStatusCounts.partial ?? 0,
		failedWorkflowRunCount: workflowStatusCounts.failed ?? 0,
		governedWorkflowItems: operations?.governed_workflows ?? [],
		recommendedOperationActions: operations?.recommended_actions ?? [],
	};
}

export function dashboardOperationsStateForStatus(values: {
	dashboardOperations?: EnterprisePlatformOperations;
	dashboardRiskTools: EnterprisePlatformDashboardRiskTool[] | null | undefined;
	availableToolItems: EnterpriseToolCatalogItem[];
}) {
	const summary = dashboardOperationsSummaryForOperations(values.dashboardOperations);

	return {
		riskToolItems: dashboardRiskToolItemsForStatus({
			dashboardRiskTools: values.dashboardRiskTools,
			availableToolItems: values.availableToolItems,
		}),
		summary,
		completedWorkflowRunCount: summary.completedWorkflowRunCount,
		partialWorkflowRunCount: summary.partialWorkflowRunCount,
		failedWorkflowRunCount: summary.failedWorkflowRunCount,
		governedWorkflowItems: summary.governedWorkflowItems,
		recommendedOperationActions: summary.recommendedOperationActions,
	};
}

export function blockedOrPartialPlatformAgentsForReadiness(values: {
	activePlatformAgents: EnterprisePublishedAgent[];
	readyPlatformAgents: EnterprisePublishedAgent[];
}): EnterprisePublishedAgent[] {
	const readyAgentIds = new Set(
		values.readyPlatformAgents.map((agent) => agent.id),
	);

	return values.activePlatformAgents.filter((agent) => !readyAgentIds.has(agent.id));
}

type LaunchpadStepKey = 'members' | 'model' | 'knowledge' | 'agent' | 'run' | 'governance';
type LaunchpadTarget = 'members' | 'credentials' | 'knowledge' | 'agents' | 'run' | 'governance';

export function launchpadStepsForStatus(
	values: {
		activeMemberCount: number;
		credentialCount: number;
		knowledgeBaseCount: number;
		activeAgentCount: number;
		readyAgentCount: number;
		hasAgentRunResult: boolean;
		hasSelectedRunAgent: boolean;
		auditEventCount: number;
		pendingApprovalCount: number;
	},
	options: {
		icons: Record<LaunchpadStepKey, ComponentType<{ className?: string }>>;
		actions: Record<LaunchpadTarget, () => void>;
		fallbackAction: () => void;
		labels: {
			title: (key: LaunchpadStepKey) => string;
			description: (key: LaunchpadStepKey) => string;
			action: (key: LaunchpadStepKey) => string;
		};
	},
): LaunchpadStep[] {
	const fallbackSteps: {
		key: LaunchpadStepKey;
		target: LaunchpadTarget;
		state: HealthState;
	}[] = [
		{
			key: 'members',
			target: 'members',
			state: values.activeMemberCount > 0 ? 'ready' : 'blocked',
		},
		{
			key: 'model',
			target: 'credentials',
			state: values.credentialCount > 0 ? 'ready' : 'blocked',
		},
		{
			key: 'knowledge',
			target: 'knowledge',
			state: values.knowledgeBaseCount > 0 ? 'ready' : 'blocked',
		},
		{
			key: 'agent',
			target: 'agents',
			state:
				values.readyAgentCount > 0
					? 'ready'
					: values.activeAgentCount > 0
						? 'partial'
						: 'blocked',
		},
		{
			key: 'run',
			target: 'run',
			state:
				values.hasAgentRunResult || values.readyAgentCount > 0 || values.hasSelectedRunAgent
					? values.hasAgentRunResult
						? 'ready'
						: 'partial'
					: 'blocked',
		},
		{
			key: 'governance',
			target: 'governance',
			state:
				values.auditEventCount > 0
					? 'ready'
					: values.hasAgentRunResult || values.pendingApprovalCount > 0
						? 'partial'
						: 'blocked',
		},
	];

	return fallbackSteps.map((step) => ({
		key: step.key,
		title: options.labels.title(step.key),
		description: options.labels.description(step.key),
		actionLabel: options.labels.action(step.key),
		icon: options.icons[step.key],
		state: step.state,
		onClick: options.actions[step.target] ?? options.fallbackAction,
	}));
}

export function readyLaunchpadStepCountForSteps(steps: LaunchpadStep[]) {
	return steps.filter((step) => step.state === 'ready').length;
}

export function launchpadStateForCounts(values: {
	readyCount: number;
	totalCount: number;
}): HealthState {
	if (values.readyCount === values.totalCount) {
		return 'ready';
	}

	return values.readyCount > 0 ? 'partial' : 'blocked';
}

export function launchpadPrimaryStepForSteps(steps: LaunchpadStep[]) {
	return steps.find((step) => step.state !== 'ready') ?? steps[steps.length - 1];
}

type WorkbenchIndicatorKey = 'agents' | 'approvals' | 'workflows' | 'memory';
type WorkbenchActionKey = 'run' | 'workflow' | 'governance' | 'memory';
type WorkbenchReadinessKey =
	| 'model'
	| 'knowledge'
	| 'connectors'
	| 'members'
	| 'agents'
	| 'workflows';
type WorkbenchReadinessTarget =
	| 'credentials'
	| 'knowledge'
	| 'connectors'
	| 'members'
	| 'agents'
	| 'workflows';
type WorkbenchRiskTarget = 'governance' | 'connectors' | 'workflows' | 'agents';
type WorkbenchQuickActionKey =
	| 'connectors'
	| 'publish'
	| 'run'
	| 'workflow'
	| 'governance'
	| 'tools';
type RolloutPathStepKey =
	| 'model'
	| 'knowledge'
	| 'agent'
	| 'run'
	| 'governance'
	| 'config';
type FirstAgentGuideStepKey = 'model' | 'agent' | 'run' | 'governance';
type PlatformConsoleItemKey = 'agents' | 'resources' | 'run' | 'governance';
type OrchestrationWorkbenchStepKey =
	| 'template'
	| 'model'
	| 'knowledge'
	| 'tools'
	| 'policy'
	| 'publish'
	| 'operate';

export function workbenchReadinessItemsForStatus(
	values: {
		credentialCount: number;
		knowledgeBaseCount: number;
		savedConnectorConfigCount: number;
		connectorDraftIssueCount: number;
		savedConnectorConfigEnabled: boolean;
		activeMemberCount: number;
		readyAgentCount: number;
		activeAgentCount: number;
		workflowTemplateCount: number;
	},
	options: {
		icons: Record<WorkbenchReadinessKey, ComponentType<{ className?: string }>>;
		actions: Record<WorkbenchReadinessTarget, () => void>;
		labels: {
			title: (key: WorkbenchReadinessKey) => string;
			modelDescription: (count: number) => string;
			knowledgeDescription: (count: number) => string;
			connectorsDescription: (count: number) => string;
			membersDescription: (count: number) => string;
			agentsDescription: (ready: number, total: number) => string;
			workflowsDescription: (count: number) => string;
		};
	},
): WorkbenchReadinessItem[] {
	return [
		{
			key: 'model',
			title: options.labels.title('model'),
			description: options.labels.modelDescription(values.credentialCount),
			state: values.credentialCount > 0 ? 'ready' : 'blocked',
			icon: options.icons.model,
			onClick: options.actions.credentials,
		},
		{
			key: 'knowledge',
			title: options.labels.title('knowledge'),
			description: options.labels.knowledgeDescription(values.knowledgeBaseCount),
			state: values.knowledgeBaseCount > 0 ? 'ready' : 'blocked',
			icon: options.icons.knowledge,
			onClick: options.actions.knowledge,
		},
		{
			key: 'connectors',
			title: options.labels.title('connectors'),
			description: options.labels.connectorsDescription(values.savedConnectorConfigCount),
			state:
				values.connectorDraftIssueCount > 0
					? 'blocked'
					: values.savedConnectorConfigCount > 0 || values.savedConnectorConfigEnabled
						? 'ready'
						: 'partial',
			icon: options.icons.connectors,
			onClick: options.actions.connectors,
		},
		{
			key: 'members',
			title: options.labels.title('members'),
			description: options.labels.membersDescription(values.activeMemberCount),
			state: values.activeMemberCount > 0 ? 'ready' : 'blocked',
			icon: options.icons.members,
			onClick: options.actions.members,
		},
		{
			key: 'agents',
			title: options.labels.title('agents'),
			description: options.labels.agentsDescription(
				values.readyAgentCount,
				values.activeAgentCount,
			),
			state:
				values.readyAgentCount > 0
					? 'ready'
					: values.activeAgentCount > 0
						? 'partial'
						: 'blocked',
			icon: options.icons.agents,
			onClick: options.actions.agents,
		},
		{
			key: 'workflows',
			title: options.labels.title('workflows'),
			description: options.labels.workflowsDescription(values.workflowTemplateCount),
			state: values.workflowTemplateCount > 0 ? 'ready' : 'partial',
			icon: options.icons.workflows,
			onClick: options.actions.workflows,
		},
	];
}

export function workbenchRiskItemsForStatus(
	values: {
		hasErrors: boolean;
		connectorDraftIssueCount: number;
		pendingApprovalCount: number;
		failedWorkflowRunCount: number;
		readyAgentCount: number;
	},
	options: {
		actions: Record<WorkbenchRiskTarget, () => void>;
		labels: {
			errors: string;
			connectorDraft: (count: number) => string;
			approvals: (count: number) => string;
			workflowFailures: (count: number) => string;
			agents: string;
		};
	},
): WorkbenchRiskItem[] {
	const riskItems: Array<WorkbenchRiskItem | null> = [
		values.hasErrors
			? {
					key: 'errors',
					label: options.labels.errors,
					state: 'blocked',
					onClick: options.actions.governance,
				}
			: null,
		values.connectorDraftIssueCount > 0
			? {
					key: 'connectorDraft',
					label: options.labels.connectorDraft(values.connectorDraftIssueCount),
					state: 'blocked',
					onClick: options.actions.connectors,
				}
			: null,
		values.pendingApprovalCount > 0
			? {
					key: 'approvals',
					label: options.labels.approvals(values.pendingApprovalCount),
					state: 'partial',
					onClick: options.actions.governance,
				}
			: null,
		values.failedWorkflowRunCount > 0
			? {
					key: 'workflowFailures',
					label: options.labels.workflowFailures(values.failedWorkflowRunCount),
					state: 'partial',
					onClick: options.actions.workflows,
				}
			: null,
		values.readyAgentCount === 0
			? {
					key: 'agents',
					label: options.labels.agents,
					state: 'blocked',
					onClick: options.actions.agents,
				}
			: null,
	];

	return riskItems.filter((item): item is WorkbenchRiskItem => Boolean(item));
}

export function workbenchQuickActionsForStatus(options: {
	icons: Record<WorkbenchQuickActionKey, ComponentType<{ className?: string }>>;
	actions: Record<WorkbenchQuickActionKey, () => void>;
	labels: Record<WorkbenchQuickActionKey, string>;
}): WorkbenchQuickAction[] {
	return [
		{
			key: 'connectors',
			label: options.labels.connectors,
			icon: options.icons.connectors,
			onClick: options.actions.connectors,
		},
		{
			key: 'publish',
			label: options.labels.publish,
			icon: options.icons.publish,
			onClick: options.actions.publish,
		},
		{
			key: 'run',
			label: options.labels.run,
			icon: options.icons.run,
			onClick: options.actions.run,
		},
		{
			key: 'workflow',
			label: options.labels.workflow,
			icon: options.icons.workflow,
			onClick: options.actions.workflow,
		},
		{
			key: 'governance',
			label: options.labels.governance,
			icon: options.icons.governance,
			onClick: options.actions.governance,
		},
		{
			key: 'tools',
			label: options.labels.tools,
			icon: options.icons.tools,
			onClick: options.actions.tools,
		},
	];
}

export function rolloutPathStepsForStatus(
	values: {
		credentialCount: number;
		knowledgeBaseCount: number;
		readyAgentCount: number;
		activeAgentCount: number;
		hasAgentRunResult: boolean;
		hasSelectedRunAgent: boolean;
		auditEventCount: number;
		pendingApprovalCount: number;
		hasPlatformConfigExport: boolean;
	},
	options: {
		icons: Record<RolloutPathStepKey, ComponentType<{ className?: string }>>;
		actions: Record<RolloutPathStepKey, () => void>;
		labels: {
			title: (key: RolloutPathStepKey) => string;
			description: (key: RolloutPathStepKey) => string;
			action: (key: RolloutPathStepKey) => string;
		};
	},
): RolloutPathStep[] {
	const steps: Array<{
		key: RolloutPathStepKey;
		state: HealthState;
	}> = [
		{
			key: 'model',
			state: values.credentialCount > 0 ? 'ready' : 'blocked',
		},
		{
			key: 'knowledge',
			state: values.knowledgeBaseCount > 0 ? 'ready' : 'blocked',
		},
		{
			key: 'agent',
			state:
				values.readyAgentCount > 0
					? 'ready'
					: values.activeAgentCount > 0
						? 'partial'
						: 'blocked',
		},
		{
			key: 'run',
			state:
				values.hasAgentRunResult
					? 'ready'
					: values.hasSelectedRunAgent || values.readyAgentCount > 0
						? 'partial'
						: 'todo',
		},
		{
			key: 'governance',
			state:
				values.auditEventCount > 0
					? 'ready'
					: values.hasAgentRunResult || values.pendingApprovalCount > 0
						? 'partial'
						: 'todo',
		},
		{
			key: 'config',
			state: values.hasPlatformConfigExport ? 'ready' : 'partial',
		},
	];

	return steps.map((step) => ({
		key: step.key,
		title: options.labels.title(step.key),
		description: options.labels.description(step.key),
		actionLabel: options.labels.action(step.key),
		icon: options.icons[step.key],
		state: step.state,
		onClick: options.actions[step.key],
	}));
}

export function firstAgentGuideStepsForStatus(
	values: {
		credentialCount: number;
		readyAgentCount: number;
		activeAgentCount: number;
		hasAgentRunResult: boolean;
		hasSelectedRunAgent: boolean;
		auditEventCount: number;
		pendingApprovalCount: number;
	},
	options: {
		icons: Record<FirstAgentGuideStepKey, ComponentType<{ className?: string }>>;
		actions: Record<FirstAgentGuideStepKey, () => void>;
		labels: {
			title: (key: FirstAgentGuideStepKey) => string;
			action: (key: FirstAgentGuideStepKey) => string;
			modelReady: (count: number) => string;
			modelEmpty: string;
			agentReady: (count: number) => string;
			agentPartial: (count: number) => string;
			agentEmpty: string;
			runReady: string;
			runPartial: string;
			runEmpty: string;
			governanceReady: (count: number) => string;
			governancePending: (count: number) => string;
			governanceEmpty: string;
		};
	},
): FirstAgentGuideStep[] {
	const steps: Array<{
		key: FirstAgentGuideStepKey;
		state: HealthState;
		detail: string;
	}> = [
		{
			key: 'model',
			state: values.credentialCount > 0 ? 'ready' : 'blocked',
			detail:
				values.credentialCount > 0
					? options.labels.modelReady(values.credentialCount)
					: options.labels.modelEmpty,
		},
		{
			key: 'agent',
			state:
				values.readyAgentCount > 0
					? 'ready'
					: values.activeAgentCount > 0
						? 'partial'
						: values.credentialCount > 0
							? 'todo'
							: 'blocked',
			detail:
				values.readyAgentCount > 0
					? options.labels.agentReady(values.readyAgentCount)
					: values.activeAgentCount > 0
						? options.labels.agentPartial(values.activeAgentCount)
						: options.labels.agentEmpty,
		},
		{
			key: 'run',
			state: values.hasAgentRunResult
				? 'ready'
				: values.readyAgentCount > 0
					? 'todo'
					: 'blocked',
			detail: values.hasAgentRunResult
				? options.labels.runReady
				: values.hasSelectedRunAgent
					? options.labels.runPartial
					: options.labels.runEmpty,
		},
		{
			key: 'governance',
			state:
				values.auditEventCount > 0
					? 'ready'
					: values.hasAgentRunResult || values.pendingApprovalCount > 0
						? 'partial'
						: 'blocked',
			detail:
				values.auditEventCount > 0
					? options.labels.governanceReady(values.auditEventCount)
					: values.pendingApprovalCount > 0
						? options.labels.governancePending(values.pendingApprovalCount)
						: options.labels.governanceEmpty,
		},
	];

	return steps.map((step) => ({
		key: step.key,
		title: options.labels.title(step.key),
		detail: step.detail,
		actionLabel: options.labels.action(step.key),
		icon: options.icons[step.key],
		state: step.state,
		onClick: options.actions[step.key],
	}));
}

export function firstAgentGuidePrimaryStepForSteps(steps: FirstAgentGuideStep[]) {
	return (
		steps.find((step) => step.state === 'blocked') ??
		steps.find((step) => step.state === 'todo') ??
		steps.find((step) => step.state === 'partial') ??
		steps[steps.length - 1]
	);
}

export function platformConsoleItemsForDisplay(options: {
	icons: Record<PlatformConsoleItemKey, ComponentType<{ className?: string }>>;
	actions: Record<PlatformConsoleItemKey, () => void>;
	labels: {
		title: (key: PlatformConsoleItemKey) => string;
		description: (key: PlatformConsoleItemKey) => string;
		action: (key: PlatformConsoleItemKey) => string;
	};
}): PlatformConsoleItem[] {
	const keys: PlatformConsoleItemKey[] = ['agents', 'resources', 'run', 'governance'];

	return keys.map((key) => ({
		key,
		title: options.labels.title(key),
		description: options.labels.description(key),
		actionLabel: options.labels.action(key),
		icon: options.icons[key],
		onClick: options.actions[key],
	}));
}

export function orchestrationWorkbenchStepsForStatus(
	values: {
		selectedTemplateName?: string;
		credentialCount: number;
		selectedKnowledgeBaseCount: number;
		knowledgeBaseCount: number;
		selectedToolCount: number;
		availableToolCount: number;
		allowedUserCount: number;
		allowedRoleCount: number;
		activeAgentCount: number;
		hasSelectedTemplate: boolean;
		auditEventCount: number;
		pendingApprovalCount: number;
		hasSelectedRunAgent: boolean;
		setupStates: {
			template: HealthState;
			model: HealthState;
			knowledge: HealthState;
			tools: HealthState;
			policy: HealthState;
		};
	},
	options: {
		icons: Record<OrchestrationWorkbenchStepKey, ComponentType<{ className?: string }>>;
		actions: Record<OrchestrationWorkbenchStepKey, () => void>;
		labels: {
			title: (key: OrchestrationWorkbenchStepKey) => string;
			description: (key: OrchestrationWorkbenchStepKey) => string;
			action: (key: OrchestrationWorkbenchStepKey) => string;
			templateEmpty: string;
			modelReady: (count: number) => string;
			modelEmpty: string;
			selectedKnowledge: (count: number) => string;
			knowledgeReady: (count: number) => string;
			toolsSelected: (count: number) => string;
			toolsReady: (count: number) => string;
			policyDetail: (counts: { users: number; roles: number }) => string;
			publishReady: (count: number) => string;
			publishEmpty: string;
			operateReady: (count: number) => string;
			operatePending: (count: number) => string;
			operateEmpty: string;
		};
	},
): OrchestrationWorkbenchStep[] {
	const steps: Array<{
		key: OrchestrationWorkbenchStepKey;
		detail: string;
		state: HealthState;
	}> = [
		{
			key: 'template',
			detail: values.selectedTemplateName ?? options.labels.templateEmpty,
			state: values.setupStates.template,
		},
		{
			key: 'model',
			detail:
				values.credentialCount > 0
					? options.labels.modelReady(values.credentialCount)
					: options.labels.modelEmpty,
			state: values.credentialCount > 0 ? values.setupStates.model : 'blocked',
		},
		{
			key: 'knowledge',
			detail:
				values.selectedKnowledgeBaseCount > 0
					? options.labels.selectedKnowledge(values.selectedKnowledgeBaseCount)
					: options.labels.knowledgeReady(values.knowledgeBaseCount),
			state: values.setupStates.knowledge,
		},
		{
			key: 'tools',
			detail:
				values.selectedToolCount > 0
					? options.labels.toolsSelected(values.selectedToolCount)
					: options.labels.toolsReady(values.availableToolCount),
			state: values.setupStates.tools,
		},
		{
			key: 'policy',
			detail: options.labels.policyDetail({
				users: values.allowedUserCount,
				roles: values.allowedRoleCount,
			}),
			state: values.setupStates.policy,
		},
		{
			key: 'publish',
			detail:
				values.activeAgentCount > 0
					? options.labels.publishReady(values.activeAgentCount)
					: options.labels.publishEmpty,
			state: values.activeAgentCount > 0
				? 'ready'
				: values.hasSelectedTemplate
					? 'todo'
					: 'blocked',
		},
		{
			key: 'operate',
			detail:
				values.auditEventCount > 0
					? options.labels.operateReady(values.auditEventCount)
					: values.pendingApprovalCount > 0
						? options.labels.operatePending(values.pendingApprovalCount)
						: options.labels.operateEmpty,
			state:
				values.auditEventCount > 0
					? 'ready'
					: values.hasSelectedRunAgent || values.pendingApprovalCount > 0
						? 'partial'
						: 'todo',
		},
	];

	return steps.map((step) => ({
		key: step.key,
		title: options.labels.title(step.key),
		description: options.labels.description(step.key),
		detail: step.detail,
		state: step.state,
		icon: options.icons[step.key],
		onClick: options.actions[step.key],
		actionLabel: options.labels.action(step.key),
	}));
}

export function orchestrationPrimaryStepForSteps(steps: OrchestrationWorkbenchStep[]) {
	return (
		steps.find((step) => step.state === 'blocked') ??
		steps.find((step) => step.state === 'todo') ??
		steps.find((step) => step.state === 'partial') ??
		steps[steps.length - 1]
	);
}

export function readyOrchestrationWorkbenchStepCountForSteps(
	steps: OrchestrationWorkbenchStep[],
) {
	return steps.filter((step) => step.state === 'ready').length;
}

export function workbenchIndicatorsForStatus(
	values: {
		activeAgentCount: number;
		readyAgentCount: number;
		pendingApprovalCount: number;
		recentWorkflowRunCount: number;
		failedWorkflowRunCount: number;
		memoryOperationsSavedCount: number;
		memoryOperationsHitCount: number;
		memoryOperationsItemCount: number;
	},
	options: {
		icons: Record<WorkbenchIndicatorKey, ComponentType<{ className?: string }>>;
		actions: Record<WorkbenchIndicatorKey, () => void>;
		labels: {
			readyAgents: string;
			readyAgentsHelper: string;
			approvals: string;
			approvalsHelper: string;
			workflowRuns: string;
			workflowRunsHelper: string;
			memory: string;
			memoryHelper: string;
		};
	},
): WorkbenchIndicator[] {
	return [
		{
			key: 'agents',
			label: options.labels.readyAgents,
			value: `${values.readyAgentCount}/${values.activeAgentCount}`,
			helper: options.labels.readyAgentsHelper,
			icon: options.icons.agents,
			state:
				values.readyAgentCount > 0
					? 'ready'
					: values.activeAgentCount > 0
						? 'partial'
						: 'todo',
			onClick: options.actions.agents,
		},
		{
			key: 'approvals',
			label: options.labels.approvals,
			value: values.pendingApprovalCount,
			helper: options.labels.approvalsHelper,
			icon: options.icons.approvals,
			state: values.pendingApprovalCount > 0 ? 'partial' : 'ready',
			onClick: options.actions.approvals,
		},
		{
			key: 'workflows',
			label: options.labels.workflowRuns,
			value: values.recentWorkflowRunCount,
			helper: options.labels.workflowRunsHelper,
			icon: options.icons.workflows,
			state:
				values.recentWorkflowRunCount > 0
					? values.failedWorkflowRunCount > 0
						? 'partial'
						: 'ready'
					: 'todo',
			onClick: options.actions.workflows,
		},
		{
			key: 'memory',
			label: options.labels.memory,
			value: values.memoryOperationsSavedCount + values.memoryOperationsHitCount,
			helper: options.labels.memoryHelper,
			icon: options.icons.memory,
			state: values.memoryOperationsItemCount > 0 ? 'ready' : 'todo',
			onClick: options.actions.memory,
		},
	];
}

export function workbenchActionsForStatus(
	values: {
		selectedRunAgentName?: string;
		workflowTemplateCount: number;
		pendingApprovalCount: number;
		memoryOperationsRunCount: number;
	},
	options: {
		icons: Record<WorkbenchActionKey, ComponentType<{ className?: string }>>;
		actions: Record<WorkbenchActionKey | 'publish', () => void>;
		labels: {
			runTitle: string;
			runDescriptionReady: (agent: string) => string;
			runDescriptionEmpty: string;
			runAction: string;
			runPublishAction: string;
			workflowTitle: string;
			workflowDescription: (count: number) => string;
			workflowAction: string;
			governanceTitle: string;
			governanceDescription: (count: number) => string;
			governanceAction: string;
			memoryTitle: string;
			memoryDescription: (count: number) => string;
			memoryAction: string;
		};
	},
): WorkbenchActionCard[] {
	const hasSelectedRunAgent = Boolean(values.selectedRunAgentName);

	return [
		{
			key: 'run',
			title: options.labels.runTitle,
			description: values.selectedRunAgentName
				? options.labels.runDescriptionReady(values.selectedRunAgentName)
				: options.labels.runDescriptionEmpty,
			actionLabel: hasSelectedRunAgent
				? options.labels.runAction
				: options.labels.runPublishAction,
			icon: options.icons.run,
			primary: true,
			onClick: hasSelectedRunAgent ? options.actions.run : options.actions.publish,
		},
		{
			key: 'workflow',
			title: options.labels.workflowTitle,
			description: options.labels.workflowDescription(values.workflowTemplateCount),
			actionLabel: options.labels.workflowAction,
			icon: options.icons.workflow,
			primary: false,
			onClick: options.actions.workflow,
		},
		{
			key: 'governance',
			title: options.labels.governanceTitle,
			description: options.labels.governanceDescription(values.pendingApprovalCount),
			actionLabel: options.labels.governanceAction,
			icon: options.icons.governance,
			primary: false,
			onClick: options.actions.governance,
		},
		{
			key: 'memory',
			title: options.labels.memoryTitle,
			description: options.labels.memoryDescription(values.memoryOperationsRunCount),
			actionLabel: options.labels.memoryAction,
			icon: options.icons.memory,
			primary: false,
			onClick: options.actions.memory,
		},
	];
}

export function dashboardTodoItemsForStatus(
	values: {
		credentialCount: number;
		activeAgentCount: number;
		readyAgentCount: number;
		pendingApprovalCount: number;
		hasErrors: boolean;
	},
	labels: {
		model: string;
		agent: string;
		agentReadiness: string;
		approval: (count: number) => string;
		errors: string;
	},
): string[] {
	return [
		values.credentialCount === 0 ? labels.model : null,
		values.activeAgentCount === 0 ? labels.agent : null,
		values.activeAgentCount > 0 && values.readyAgentCount === 0 ? labels.agentReadiness : null,
		values.pendingApprovalCount > 0 ? labels.approval(values.pendingApprovalCount) : null,
		values.hasErrors ? labels.errors : null,
	].filter((item): item is string => Boolean(item));
}

export function dashboardRiskToolItemsForStatus(values: {
	dashboardRiskTools: EnterprisePlatformDashboardRiskTool[] | null | undefined;
	availableToolItems: EnterpriseToolCatalogItem[];
}): Array<EnterprisePlatformDashboardRiskTool | EnterpriseToolCatalogItem> {
	return (
		values.dashboardRiskTools ??
		values.availableToolItems.filter(
			(item) =>
				item.name === 'enterprise_summarize_department_metrics' ||
				item.name.includes('summarize'),
		)
	);
}

type MonitoringStatKey = 'agentRuns' | 'workflowRuns' | 'toolAudit' | 'pendingApprovals';

export function monitoringActivitySummaryForStatus(values: {
	agentConversations: Record<string, MonitoringAgentTurn[]>;
	auditSummary?: EnterpriseAuditQueryResponse['summary'] | null;
	auditEvents: EnterpriseAuditEvent[];
	failedWorkflowRunCount: number;
	pendingApprovalCount: number;
	partialWorkflowRunCount: number;
	workflowRunCount: number;
	auditEventCount: number;
	recentAgentTurnLimit?: number;
}): {
	recentAgentTurns: MonitoringAgentTurn[];
	auditSuccessCount: number;
	auditFailureCount: number;
	healthState: HealthState;
} {
	const recentAgentTurns = Object.values(values.agentConversations)
		.flat()
		.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
		.slice(0, values.recentAgentTurnLimit ?? 3);
	const auditSuccessCount =
		values.auditSummary?.successes ??
		values.auditEvents.filter((event) => event.success === true).length;
	const auditFailureCount =
		values.auditSummary?.failures ??
		values.auditEvents.filter((event) => event.success === false).length;
	const healthState: HealthState =
		auditFailureCount > 0 || values.failedWorkflowRunCount > 0
			? 'blocked'
			: values.pendingApprovalCount > 0 || values.partialWorkflowRunCount > 0
				? 'partial'
				: recentAgentTurns.length > 0 ||
					  values.workflowRunCount > 0 ||
					  values.auditEventCount > 0
					? 'ready'
					: 'todo';

	return {
		recentAgentTurns,
		auditSuccessCount,
		auditFailureCount,
		healthState,
	};
}

export function monitoringStatsForSummary(
	values: {
		recentAgentTurnCount: number;
		workflowRunCount: number;
		completedWorkflowRunCount: number;
		partialWorkflowRunCount: number;
		failedWorkflowRunCount: number;
		auditEventCount: number;
		auditSuccessCount: number;
		auditFailureCount: number;
		pendingApprovalCount: number;
	},
	options: {
		icons: Record<MonitoringStatKey, ComponentType<{ className?: string }>>;
		labels: {
			agentRuns: string;
			agentRunsHelper: string;
			workflowRuns: string;
			workflowRunsHelper: (counts: {
				completed: number;
				partial: number;
				failed: number;
			}) => string;
			toolAudit: string;
			toolAuditHelper: (counts: { success: number; failure: number }) => string;
			pendingApprovals: string;
			pendingApprovalsHelper: string;
		};
	},
): MonitoringStat[] {
	return [
		{
			label: options.labels.agentRuns,
			value: values.recentAgentTurnCount,
			helper: options.labels.agentRunsHelper,
			icon: options.icons.agentRuns,
		},
		{
			label: options.labels.workflowRuns,
			value: values.workflowRunCount,
			helper: options.labels.workflowRunsHelper({
				completed: values.completedWorkflowRunCount,
				partial: values.partialWorkflowRunCount,
				failed: values.failedWorkflowRunCount,
			}),
			icon: options.icons.workflowRuns,
		},
		{
			label: options.labels.toolAudit,
			value: values.auditEventCount,
			helper: options.labels.toolAuditHelper({
				success: values.auditSuccessCount,
				failure: values.auditFailureCount,
			}),
			icon: options.icons.toolAudit,
		},
		{
			label: options.labels.pendingApprovals,
			value: values.pendingApprovalCount,
			helper: options.labels.pendingApprovalsHelper,
			icon: options.icons.pendingApprovals,
		},
	];
}

export function formatOperationsAgentIssueText(
	agent: Pick<EnterprisePublishedAgent, 'readiness' | 'status'>,
	labels: { archived: string; missing: string; ready: string },
) {
	if (agent.status !== 'published') {
		return labels.archived;
	}

	const issue = agent.readiness?.issues[0];
	if (issue?.message) {
		return issue.message;
	}

	if (agentIsReady(agent)) {
		return labels.ready;
	}

	return labels.missing;
}

export function agentAccessAllowed(
	agent: EnterprisePublishedAgent,
	identity?: EnterpriseIdentity | null,
) {
	const allowedUsers = agent.allowed_user_ids ?? [];
	const allowedRoles = agent.allowed_roles ?? [];
	if (!identity) {
		return false;
	}
	if (agent.tenant && identity.tenant !== agent.tenant) {
		return false;
	}
	if (allowedUsers.length === 0 && allowedRoles.length === 0) {
		return true;
	}
	return allowedUsers.includes(identity.user_id) || allowedRoles.includes(identity.role);
}

export function agentAccessRestricted(
	agent: { allowed_user_ids?: string[] | null; allowed_roles?: string[] | null },
) {
	return (agent.allowed_user_ids?.length ?? 0) > 0 || (agent.allowed_roles?.length ?? 0) > 0;
}

export function formatAgentAccessLabel(
	agent: { allowed_user_ids?: string[] | null; allowed_roles?: string[] | null },
	labels: { restricted: (counts: { users: number; roles: number }) => string; open: string },
) {
	const allowedUsers = agent.allowed_user_ids ?? [];
	const allowedRoles = agent.allowed_roles ?? [];

	return agentAccessRestricted(agent)
		? labels.restricted({ users: allowedUsers.length, roles: allowedRoles.length })
		: labels.open;
}

export function formatAgentRuntimeLabel(
	agent: { memory_enabled?: boolean | null; workflow_enabled?: boolean | null },
	labels: {
		runtime: (states: { memory: string; workflow: string }) => string;
		enabled: string;
		disabled: string;
	},
) {
	return labels.runtime({
		memory: agent.memory_enabled ? labels.enabled : labels.disabled,
		workflow: agent.workflow_enabled ? labels.enabled : labels.disabled,
	});
}

export function appCenterAgentDetailLabels(
	agent: Pick<
		EnterprisePublishedAgent,
		'allowed_roles' | 'allowed_user_ids' | 'memory_enabled' | 'workflow_enabled'
	>,
	labels: {
		access: {
			restricted: (counts: { users: number; roles: number }) => string;
			open: string;
		};
		runtime: {
			value: (states: { memory: string; workflow: string }) => string;
			enabled: string;
			disabled: string;
		};
	},
) {
	return {
		access: formatAgentAccessLabel(agent, labels.access),
		runtime: formatAgentRuntimeLabel(agent, {
			runtime: labels.runtime.value,
			enabled: labels.runtime.enabled,
			disabled: labels.runtime.disabled,
		}),
	};
}

export function appCenterAgentDetailResourceValues(
	agent: Pick<
		EnterprisePublishedAgent,
		| 'allowed_roles'
		| 'allowed_user_ids'
		| 'knowledge_base_ids'
		| 'memory_enabled'
		| 'model_config_id'
		| 'tools'
		| 'workflow_enabled'
	>,
	credentialById: Map<string, { id?: unknown; data?: { name?: unknown } }>,
	knowledgeBaseById: Map<string, { id?: unknown; name?: unknown }>,
	labels: {
		noModel: string;
		access: {
			restricted: (counts: { users: number; roles: number }) => string;
			open: string;
		};
		runtime: {
			value: (states: { memory: string; workflow: string }) => string;
			enabled: string;
			disabled: string;
		};
	},
) {
	const detailLabels = appCenterAgentDetailLabels(agent, {
		access: labels.access,
		runtime: labels.runtime,
	});

	return {
		model: agentModelLabel(agent, credentialById, labels.noModel),
		knowledge: agentKnowledgeBaseLabels(agent, knowledgeBaseById),
		tools: agent.tools ?? [],
		runtime: detailLabels.runtime,
		access: detailLabels.access,
	};
}

export function appCenterTemplateDetailResourceValues(
	template: Pick<EnterpriseAgentTemplate, 'tools'>,
	resources: { modelCount: number; knowledgeBaseCount: number },
) {
	return {
		modelCount: resources.modelCount,
		knowledgeBaseCount: resources.knowledgeBaseCount,
		tools: template.tools ?? [],
	};
}

export function appCenterDetailResourceValuesForSelection(values: {
	agent?: EnterprisePublishedAgent | null;
	template?: EnterpriseAgentTemplate | null;
	credentialById: Map<string, { id?: unknown; data?: { name?: unknown } }>;
	knowledgeBaseById: Map<string, { id?: unknown; name?: unknown }>;
	modelCount: number;
	knowledgeBaseCount: number;
	labels: {
		noModel: string;
		access: {
			restricted: (counts: { users: number; roles: number }) => string;
			open: string;
		};
		runtime: {
			value: (states: { memory: string; workflow: string }) => string;
			enabled: string;
			disabled: string;
		};
	};
}) {
	return {
		agent: values.agent
			? appCenterAgentDetailResourceValues(
					values.agent,
					values.credentialById,
					values.knowledgeBaseById,
					values.labels,
				)
			: null,
		template: values.template
			? appCenterTemplateDetailResourceValues(values.template, {
					modelCount: values.modelCount,
					knowledgeBaseCount: values.knowledgeBaseCount,
				})
			: null,
	};
}

export function appCenterSelectionState<
	TAgent extends { id: string },
	TTemplate extends { id: string },
>(values: {
	selectedItem?: { type: 'template' | 'agent'; id: string } | null;
	activeAgents: TAgent[];
	readyAgents: TAgent[];
	appCenterAgents: TAgent[];
	templates: TTemplate[];
	defaultTemplate?: TTemplate | null;
	hasCredentials: boolean;
	publishingTemplateId?: string | null;
}) {
	const selectedAgent =
		values.selectedItem?.type === 'agent'
			? values.activeAgents.find((agent) => agent.id === values.selectedItem?.id) ?? null
			: null;
	const selectedTemplate =
		values.selectedItem?.type === 'template'
			? values.templates.find((template) => template.id === values.selectedItem?.id) ?? null
			: null;
	const inspectedAgent =
		selectedAgent ??
		(values.selectedItem?.type
			? null
			: values.readyAgents[0] ?? values.appCenterAgents[0] ?? null);
	const inspectedTemplate =
		selectedTemplate ?? (!inspectedAgent ? values.defaultTemplate ?? null : null);

	return {
		inspectedAgent,
		inspectedTemplate,
		primaryDisabled:
			values.hasCredentials &&
			values.activeAgents.length === 0 &&
			(!values.defaultTemplate || Boolean(values.publishingTemplateId)),
	};
}

export function appCenterAgentsForDisplay<TAgent>(
	readyAgents: TAgent[],
	blockedOrPartialAgents: TAgent[],
	limit = 3,
) {
	return [...readyAgents, ...blockedOrPartialAgents].slice(0, limit);
}

export function appCenterDerivedStateForStatus(values: {
	selectedItem?: { type: 'template' | 'agent'; id: string } | null;
	activeAgents: EnterprisePublishedAgent[];
	readyAgents: EnterprisePublishedAgent[];
	templates: EnterpriseAgentTemplate[];
	defaultTemplate?: EnterpriseAgentTemplate | null;
	hasCredentials: boolean;
	publishingTemplateId?: string | null;
	displayLimit?: number;
}) {
	const blockedOrPartialAgents = blockedOrPartialPlatformAgentsForReadiness({
		activePlatformAgents: values.activeAgents,
		readyPlatformAgents: values.readyAgents,
	});
	const appCenterAgents = appCenterAgentsForDisplay(
		values.readyAgents,
		blockedOrPartialAgents,
		values.displayLimit,
	);
	const selection = appCenterSelectionState({
		selectedItem: values.selectedItem,
		activeAgents: values.activeAgents,
		readyAgents: values.readyAgents,
		appCenterAgents,
		templates: values.templates,
		defaultTemplate: values.defaultTemplate,
		hasCredentials: values.hasCredentials,
		publishingTemplateId: values.publishingTemplateId,
	});

	return {
		blockedOrPartialAgents,
		appCenterAgents,
		selection,
	};
}

export function agentOpsSummaryItems(
	values: {
		published: number;
		active: number;
		ready: number;
		needsSetup: number;
		archived: number;
	},
	labels: {
		publishedTotal: string;
		publishedTotalHelper: string;
		activeTotal: string;
		activeTotalHelper: string;
		readyTotal: string;
		readyTotalHelper: string;
		needsSetupTotal: string;
		needsSetupTotalHelper: (counts: { count: number }) => string;
	},
) {
	return [
		{
			label: labels.publishedTotal,
			value: values.published,
			helper: labels.publishedTotalHelper,
		},
		{
			label: labels.activeTotal,
			value: values.active,
			helper: labels.activeTotalHelper,
		},
		{
			label: labels.readyTotal,
			value: values.ready,
			helper: labels.readyTotalHelper,
		},
		{
			label: labels.needsSetupTotal,
			value: values.needsSetup,
			helper: labels.needsSetupTotalHelper({ count: values.archived }),
		},
	];
}

export function appCenterOperationsStateForStatus(values: {
	selectedItem?: { type: 'template' | 'agent'; id: string } | null;
	activeAgents: EnterprisePublishedAgent[];
	readyAgents: EnterprisePublishedAgent[];
	publishedAgents: EnterprisePublishedAgent[];
	archivedAgents: EnterprisePublishedAgent[];
	templates: EnterpriseAgentTemplate[];
	defaultTemplate?: EnterpriseAgentTemplate | null;
	hasCredentials: boolean;
	publishingTemplateId?: string | null;
	labels: Parameters<typeof agentOpsSummaryItems>[1];
}) {
	const derivedState = appCenterDerivedStateForStatus({
		selectedItem: values.selectedItem,
		activeAgents: values.activeAgents,
		readyAgents: values.readyAgents,
		templates: values.templates,
		defaultTemplate: values.defaultTemplate,
		hasCredentials: values.hasCredentials,
		publishingTemplateId: values.publishingTemplateId,
	});
	const selection = derivedState.selection;
	const agentOpsSummary = agentOpsSummaryItems(
		{
			published: values.publishedAgents.length,
			active: values.activeAgents.length,
			ready: values.readyAgents.length,
			needsSetup: derivedState.blockedOrPartialAgents.length,
			archived: values.archivedAgents.length,
		},
		values.labels,
	);
	const topOperationsAgents = topOperationsAgentsForDisplay(
		values.readyAgents,
		derivedState.blockedOrPartialAgents,
		values.publishedAgents,
	);

	return {
		derivedState,
		blockedOrPartialAgents: derivedState.blockedOrPartialAgents,
		appCenterAgents: derivedState.appCenterAgents,
		selection,
		inspectedAgent: selection.inspectedAgent,
		inspectedTemplate: selection.inspectedTemplate,
		primaryDisabled: selection.primaryDisabled,
		agentOpsSummary,
		topOperationsAgents,
	};
}

export function topOperationsAgentsForDisplay<
	TAgent extends { status?: string | null },
>(
	readyAgents: TAgent[],
	blockedOrPartialAgents: TAgent[],
	publishedAgents: TAgent[],
	limit = 4,
) {
	return [
		...readyAgents,
		...blockedOrPartialAgents,
		...publishedAgents.filter((agent) => agent.status !== 'published'),
	].slice(0, limit);
}

export function operationsHeadlineText(
	values: {
		activeAgentCount: number;
		blockedOrPartialAgentCount: number;
		pendingApprovalCount: number;
	},
	labels: {
		empty: string;
		needsWork: (counts: { count: number }) => string;
		approvals: (counts: { count: number }) => string;
		ready: string;
	},
) {
	if (values.activeAgentCount === 0) {
		return labels.empty;
	}

	if (values.blockedOrPartialAgentCount > 0) {
		return labels.needsWork({ count: values.blockedOrPartialAgentCount });
	}

	if (values.pendingApprovalCount > 0) {
		return labels.approvals({ count: values.pendingApprovalCount });
	}

	return labels.ready;
}

export function agentReleasePipelineItems<TIcon>(
	values: {
		selectedTemplate?: { name: string } | null;
		modelConfigId?: string | null;
		credentialById: Map<string, { id?: unknown; data?: { name?: unknown } }>;
		knowledgeBaseCount: number;
		toolCount: number;
		memoryEnabled: boolean;
		workflowEnabled: boolean;
		activeAgentCount: number;
		pendingApprovalCount: number;
		auditEventCount: number;
		hasSelectedRunAgent: boolean;
		stepStates: Array<{ state: HealthState }>;
	},
	labels: {
		template: string;
		templateDetail: string;
		model: string;
		modelDetail: string;
		knowledge: string;
		selectedKnowledge: (counts: { count: number }) => string;
		knowledgeDetail: string;
		tools: string;
		toolsSelected: (counts: { count: number }) => string;
		toolsDetail: string;
		runtime: string;
		runtimeDetail: (states: { memory: string; workflow: string }) => string;
		enabled: string;
		disabled: string;
		publish: string;
		publishDetailReady: (counts: { count: number }) => string;
		publishDetail: string;
		governance: string;
		governanceDetailPending: (counts: { count: number }) => string;
		governanceDetail: string;
	},
	icons: {
		template: TIcon;
		model: TIcon;
		knowledge: TIcon;
		tools: TIcon;
		runtime: TIcon;
		publish: TIcon;
		governance: TIcon;
	},
): Array<{
	key: string;
	title: string;
	detail: string;
	state: HealthState;
	icon: TIcon;
}> {
	return [
		{
			key: 'template',
			title: labels.template,
			detail: values.selectedTemplate ? values.selectedTemplate.name : labels.templateDetail,
			state: values.stepStates[0].state,
			icon: icons.template,
		},
		{
			key: 'model',
			title: labels.model,
			detail: modelCredentialLabel(
				values.modelConfigId,
				values.credentialById,
				labels.modelDetail,
			),
			state: values.stepStates[1].state,
			icon: icons.model,
		},
		{
			key: 'knowledge',
			title: labels.knowledge,
			detail:
				values.knowledgeBaseCount > 0
					? labels.selectedKnowledge({ count: values.knowledgeBaseCount })
					: labels.knowledgeDetail,
			state: values.stepStates[2].state,
			icon: icons.knowledge,
		},
		{
			key: 'tools',
			title: labels.tools,
			detail:
				values.toolCount > 0
					? labels.toolsSelected({ count: values.toolCount })
					: labels.toolsDetail,
			state: values.stepStates[3].state,
			icon: icons.tools,
		},
		{
			key: 'runtime',
			title: labels.runtime,
			detail: labels.runtimeDetail({
				memory: values.memoryEnabled ? labels.enabled : labels.disabled,
				workflow: values.workflowEnabled ? labels.enabled : labels.disabled,
			}),
			state: values.stepStates[4].state,
			icon: icons.runtime,
		},
		{
			key: 'publish',
			title: labels.publish,
			detail:
				values.activeAgentCount > 0
					? labels.publishDetailReady({ count: values.activeAgentCount })
					: labels.publishDetail,
			state:
				values.activeAgentCount > 0
					? 'ready'
					: values.selectedTemplate
						? 'todo'
						: 'blocked',
			icon: icons.publish,
		},
		{
			key: 'governance',
			title: labels.governance,
			detail:
				values.pendingApprovalCount > 0
					? labels.governanceDetailPending({ count: values.pendingApprovalCount })
					: labels.governanceDetail,
			state:
				values.auditEventCount > 0 || values.pendingApprovalCount > 0
					? 'ready'
					: values.hasSelectedRunAgent
						? 'partial'
						: 'todo',
			icon: icons.governance,
		},
	];
}

export function agentReleasePipelineForStatus<TIcon>(
	values: {
		selectedTemplate?: { name: string } | null;
		publishForm: {
			model_config_id?: string | null;
			knowledge_base_ids: string[];
			tools: string[];
			memory_enabled: boolean;
			workflow_enabled: boolean;
		};
		credentialById: Map<string, { id?: unknown; data?: { name?: unknown } }>;
		activeAgents: EnterprisePublishedAgent[];
		pendingApprovals: EnterpriseApprovalRequestItem[];
		auditEventCount: number;
		selectedRunAgent?: EnterprisePublishedAgent | null;
		stepStates: Array<{ state: HealthState }>;
	},
	labels: {
		template: string;
		templateDetail: string;
		model: string;
		modelDetail: string;
		knowledge: string;
		selectedKnowledge: (counts: { count: number }) => string;
		knowledgeDetail: string;
		tools: string;
		toolsSelected: (counts: { count: number }) => string;
		toolsDetail: string;
		runtime: string;
		runtimeDetail: (states: { memory: string; workflow: string }) => string;
		enabled: string;
		disabled: string;
		publish: string;
		publishDetailReady: (counts: { count: number }) => string;
		publishDetail: string;
		governance: string;
		governanceDetailPending: (counts: { count: number }) => string;
		governanceDetail: string;
	},
	icons: {
		template: TIcon;
		model: TIcon;
		knowledge: TIcon;
		tools: TIcon;
		runtime: TIcon;
		publish: TIcon;
		governance: TIcon;
	},
) {
	return agentReleasePipelineItems(
		{
			selectedTemplate: values.selectedTemplate,
			modelConfigId: values.publishForm.model_config_id,
			credentialById: values.credentialById,
			knowledgeBaseCount: values.publishForm.knowledge_base_ids.length,
			toolCount: values.publishForm.tools.length,
			memoryEnabled: values.publishForm.memory_enabled,
			workflowEnabled: values.publishForm.workflow_enabled,
			activeAgentCount: values.activeAgents.length,
			pendingApprovalCount: values.pendingApprovals.length,
			auditEventCount: values.auditEventCount,
			hasSelectedRunAgent: Boolean(values.selectedRunAgent),
			stepStates: values.stepStates,
		},
		labels,
		icons,
	);
}

export function dashboardFallbackStateForStatus(values: {
	dashboard?: EnterprisePlatformDashboard | null;
	governance?: Pick<EnterprisePlatformGovernanceResponse, 'pending_approvals'> | null;
	approvalRequests: EnterpriseApprovalRequestItem[];
	workflowRuns: EnterpriseWorkflowRunHistoryItem[];
	auditEvents: EnterpriseAuditEvent[];
}) {
	const pendingApprovals =
		values.governance?.pending_approvals ??
		values.dashboard?.pending_approvals.items ??
		values.approvalRequests.filter((approval) => approval.status === 'pending');
	const approvedApprovalCount =
		values.dashboard?.approved_approval_count ??
		values.approvalRequests.filter((approval) => approval.status === 'approved').length;
	const approvalSummary = {
		total: values.approvalRequests.length,
		pending: values.approvalRequests.filter((approval) => approval.status === 'pending').length,
		approved: values.approvalRequests.filter((approval) => approval.status === 'approved').length,
		rejected: values.approvalRequests.filter((approval) => approval.status === 'rejected').length,
	};
	const recentWorkflowRuns =
		values.dashboard?.recent_workflow_runs ?? values.workflowRuns.slice(0, 3);
	const workflowRunCount = values.dashboard?.workflow_run_count ?? values.workflowRuns.length;
	const recentAuditEvents = values.dashboard?.recent_audit_events ?? values.auditEvents.slice(0, 4);
	const auditEventCount = values.dashboard?.audit_event_count ?? values.auditEvents.length;

	return {
		pendingApprovals,
		approvedApprovalCount,
		approvalSummary,
		recentWorkflowRuns,
		workflowRunCount,
		recentAuditEvents,
		auditEventCount,
	};
}

export function identityAccessRowsForGovernance(
	enterpriseIdentities: EnterpriseIdentity[],
	pendingApprovals: EnterpriseApprovalRequestItem[],
	governance: Pick<EnterprisePlatformGovernanceResponse, 'identity_summaries'> | null | undefined,
) {
	const governanceIdentitySummaries = new Map(
		governance?.identity_summaries.map((summary) => [summary.user_id, summary]) ?? [],
	);

	return enterpriseIdentities.map((identity) => {
		const governanceSummary = governanceIdentitySummaries.get(identity.user_id);
		const allowedCount =
			governanceSummary?.allowed_count ??
			identity.tool_policy.decisions.filter((decision) => decision.allowed).length;
		const deniedCount =
			governanceSummary?.denied_count ??
			identity.tool_policy.decisions.length - allowedCount;
		const pendingCount =
			governanceSummary?.pending_approvals ??
			pendingApprovals.filter((approval) => approval.user_id === identity.user_id).length;

		return {
			identity,
			allowedCount,
			deniedCount,
			pendingCount,
			risk: deniedCount + pendingCount,
		};
	});
}

export function accessTenantSummariesForGovernance(
	enterpriseIdentities: EnterpriseIdentity[],
	pendingApprovals: EnterpriseApprovalRequestItem[],
	governance: Pick<EnterprisePlatformGovernanceResponse, 'tenant_summaries'> | null | undefined,
) {
	return Object.values(
		governance?.tenant_summaries.map((tenant) => ({
			tenant: tenant.tenant,
			identities: tenant.identity_count,
			roles: tenant.roles,
			allowed: tenant.allowed_count,
			denied: tenant.denied_count,
			pending: tenant.pending_approvals,
		})) ??
			enterpriseIdentities.reduce<
				Record<
					string,
					{
						tenant: string;
						identities: number;
						roles: string[];
						allowed: number;
						denied: number;
						pending: number;
					}
				>
			>((summary, identity) => {
				const tenantSummary =
					summary[identity.tenant] ??
					(summary[identity.tenant] = {
						tenant: identity.tenant,
						identities: 0,
						roles: [],
						allowed: 0,
						denied: 0,
						pending: 0,
					});
				const decisions = identity.tool_policy.decisions;
				const allowed = decisions.filter((decision) => decision.allowed).length;
				const pending = pendingApprovals.filter(
					(approval) => approval.user_id === identity.user_id,
				).length;

				tenantSummary.identities += 1;
				if (!tenantSummary.roles.includes(identity.role)) {
					tenantSummary.roles.push(identity.role);
				}
				tenantSummary.allowed += allowed;
				tenantSummary.denied += decisions.length - allowed;
				tenantSummary.pending += pending;
				return summary;
			}, {}),
	);
}

export function accessControlStatsForGovernance(
	values: {
		identityCount: number;
		tenantCount: number;
		riskyIdentityCount: number;
		selectedIdentityPendingApprovalCount: number;
	},
	labels: {
		identities: string;
		tenants: string;
		riskyIdentities: string;
		pendingApprovals: string;
	},
): AccessControlStat[] {
	return [
		{
			label: labels.identities,
			value: values.identityCount,
		},
		{
			label: labels.tenants,
			value: values.tenantCount,
		},
		{
			label: labels.riskyIdentities,
			value: values.riskyIdentityCount,
		},
		{
			label: labels.pendingApprovals,
			value: values.selectedIdentityPendingApprovalCount,
		},
	];
}

export function governanceHealthItemsForSummary(
	values: {
		governanceSummary?: EnterprisePlatformGovernanceResponse['summary'] | null;
		tenantCount: number;
		identityCount: number;
		pendingApprovalCount: number;
		auditEventCount: number;
	},
	labels: {
		tenants: string;
		tenantsHelper: string;
		identities: string;
		identitiesHelper: string;
		pendingApprovals: string;
		pendingApprovalsHelper: string;
		auditEvents: string;
		auditEventsHelper: string;
		auditEventsFailedHelper: (values: { count: number }) => string;
	},
	icons: {
		tenants: GovernanceHealthItem['icon'];
		identities: GovernanceHealthItem['icon'];
		pendingApprovals: GovernanceHealthItem['icon'];
		auditEvents: GovernanceHealthItem['icon'];
	},
): GovernanceHealthItem[] {
	const failedAuditEventCount = values.governanceSummary?.failed_audit_event_count ?? 0;

	return [
		{
			label: labels.tenants,
			value: values.governanceSummary?.tenant_count ?? values.tenantCount,
			helper: labels.tenantsHelper,
			state: values.tenantCount > 0 ? 'ready' : 'todo',
			icon: icons.tenants,
		},
		{
			label: labels.identities,
			value: values.governanceSummary?.identity_count ?? values.identityCount,
			helper: labels.identitiesHelper,
			state: values.identityCount > 0 ? 'ready' : 'todo',
			icon: icons.identities,
		},
		{
			label: labels.pendingApprovals,
			value: values.governanceSummary?.pending_approval_count ?? values.pendingApprovalCount,
			helper: labels.pendingApprovalsHelper,
			state: values.pendingApprovalCount > 0 ? 'partial' : 'ready',
			icon: icons.pendingApprovals,
		},
		{
			label: labels.auditEvents,
			value: values.governanceSummary?.audit_event_count ?? values.auditEventCount,
			helper:
				failedAuditEventCount > 0
					? labels.auditEventsFailedHelper({ count: failedAuditEventCount })
					: labels.auditEventsHelper,
			state:
				failedAuditEventCount > 0
					? 'partial'
					: values.auditEventCount > 0
						? 'ready'
						: 'todo',
			icon: icons.auditEvents,
		},
	] satisfies GovernanceHealthItem[];
}

export function governanceOperationsStateForStatus(values: {
	enterpriseIdentities: EnterpriseIdentity[];
	pendingApprovals: EnterpriseApprovalRequestItem[];
	governance?: EnterprisePlatformGovernanceResponse | null;
	auditEventCount: number;
	selectedIdentityPendingApprovalCount: number;
	accessLabels: Parameters<typeof accessControlStatsForGovernance>[1];
	healthLabels: Parameters<typeof governanceHealthItemsForSummary>[1];
	icons: Parameters<typeof governanceHealthItemsForSummary>[2];
}) {
	const identityAccessRows = identityAccessRowsForGovernance(
		values.enterpriseIdentities,
		values.pendingApprovals,
		values.governance,
	);
	const accessTenantSummaries = accessTenantSummariesForGovernance(
		values.enterpriseIdentities,
		values.pendingApprovals,
		values.governance,
	);
	const riskyIdentityCount =
		values.governance?.summary.risky_identity_count ??
		identityAccessRows.filter((row) => row.risk > 0).length;
	const accessControlStats = accessControlStatsForGovernance(
		{
			identityCount: values.enterpriseIdentities.length,
			tenantCount: accessTenantSummaries.length,
			riskyIdentityCount,
			selectedIdentityPendingApprovalCount: values.selectedIdentityPendingApprovalCount,
		},
		values.accessLabels,
	);
	const governanceHealthItems = governanceHealthItemsForSummary(
		{
			governanceSummary: values.governance?.summary,
			tenantCount: accessTenantSummaries.length,
			identityCount: values.enterpriseIdentities.length,
			pendingApprovalCount: values.pendingApprovals.length,
			auditEventCount: values.auditEventCount,
		},
		values.healthLabels,
		values.icons,
	);

	return {
		identityAccessRows,
		accessTenantSummaries,
		riskyIdentityCount,
		accessControlStats,
		governanceHealthItems,
	};
}

export function pendingWorkflowRunApprovals(
	approvals: EnterpriseApprovalRequestItem[],
): EnterpriseApprovalRequestItem[] {
	return approvals.filter((approval) => approval.request_type === 'workflow_run');
}

export function selectedIdentityGovernanceActivityForIdentity(values: {
	selectedIdentity?: EnterpriseIdentity;
	pendingApprovals: EnterpriseApprovalRequestItem[];
	auditEvents: EnterpriseAuditEvent[];
}) {
	const selectedIdentityPendingApprovals = values.selectedIdentity
		? values.pendingApprovals.filter(
				(approval) => approval.user_id === values.selectedIdentity?.user_id,
			)
		: [];
	const selectedIdentityPendingToolNames = new Set(
		selectedIdentityPendingApprovals
			.filter((approval) => approval.request_type === 'tool_run')
			.map((approval) => approval.tool_name)
			.filter((toolName): toolName is string => Boolean(toolName)),
	);
	const selectedIdentityFailedAuditEvents = values.selectedIdentity
		? values.auditEvents.filter(
				(event) =>
					event.user_id === values.selectedIdentity?.user_id &&
					event.tenant === values.selectedIdentity?.tenant &&
					event.success === false,
			)
		: [];
	const selectedIdentityRecentAuditEvents = values.selectedIdentity
		? values.auditEvents.filter(
				(event) =>
					event.user_id === values.selectedIdentity?.user_id &&
					event.tenant === values.selectedIdentity?.tenant,
			)
		: [];

	return {
		selectedIdentityPendingApprovals,
		selectedIdentityPendingToolNames,
		selectedIdentityFailedAuditEvents,
		selectedIdentityRecentAuditEvents,
	};
}

export function toolPolicySummaryForGovernance(
	availableToolItems: EnterpriseToolCatalogItem[],
	toolPolicyDraft: Record<string, ToolPolicyDraftValue>,
	pendingToolNames: Set<string>,
) {
	const effectiveAllowed = availableToolItems.filter((tool) => tool.allowed).length;
	const effectiveDenied = availableToolItems.length - effectiveAllowed;
	const draftAllow = Object.values(toolPolicyDraft).filter((value) => value === 'allow').length;
	const draftDeny = Object.values(toolPolicyDraft).filter((value) => value === 'deny').length;
	const draftInherit = Math.max(availableToolItems.length - draftAllow - draftDeny, 0);
	const pending = availableToolItems.filter((tool) => pendingToolNames.has(tool.name)).length;

	return {
		effectiveAllowed,
		effectiveDenied,
		draftAllow,
		draftDeny,
		draftInherit,
		pending,
	};
}

export function availableToolItemsForCatalog(values: {
	toolCatalogItems: EnterpriseToolCatalogItem[];
	policyDecisions: EnterprisePlatformStatusResponse['tool_policy']['decisions'];
	toolInputConfig: EnterpriseToolInputConfigMap;
}): EnterpriseToolCatalogItem[] {
	if (values.toolCatalogItems.length > 0) {
		return values.toolCatalogItems;
	}

	return values.policyDecisions.map((decision) => ({
		name: decision.name,
		description: decision.reason,
		input_key: values.toolInputConfig[decision.name]?.inputKey ?? 'input',
		default_input: values.toolInputConfig[decision.name]?.defaultValue ?? '',
		allowed: decision.allowed,
		reason: decision.reason,
		configured_by_agents: [],
		configured_for_agent: null,
		configured_agent_id: null,
		stats: {
			calls: 0,
			successes: 0,
			failures: 0,
		},
	}));
}

export function toolCatalogStateForStatus(values: {
	platformStatus?: EnterprisePlatformStatusResponse | null;
	toolCatalog?: EnterpriseToolCatalogResponse | null;
	toolInputConfig: EnterpriseToolInputConfigMap;
}) {
	const policyDecisions = values.platformStatus?.tool_policy.decisions ?? [];
	const toolCatalogItems = values.toolCatalog?.tools ?? [];
	const availableToolItems = availableToolItemsForCatalog({
		toolCatalogItems,
		policyDecisions,
		toolInputConfig: values.toolInputConfig,
	});

	return {
		policyDecisions,
		toolCatalogItems,
		availableToolItems,
	};
}

export function selectedToolRunnerStateForStatus(values: {
	availableToolItems: EnterpriseToolCatalogItem[];
	selectedToolName: string;
	toolInputs: Record<string, string>;
	toolInputConfig: EnterpriseToolInputConfigMap;
	policyDecisions: EnterprisePlatformStatusResponse['tool_policy']['decisions'];
	labels: {
		notConfiguredForAgent: string;
	};
}) {
	const selectedToolCatalogItem =
		values.availableToolItems.find((item) => item.name === values.selectedToolName) ?? null;
	const selectedToolConfig = values.toolInputConfig[values.selectedToolName];
	const selectedToolDecision = values.policyDecisions.find(
		(decision) => decision.name === values.selectedToolName,
	);
	const selectedToolConfigured =
		selectedToolCatalogItem?.configured_for_agent !== false;
	const selectedToolInputKey =
		selectedToolConfig?.inputKey ?? selectedToolCatalogItem?.input_key;
	const selectedToolInputValue =
		values.toolInputs[values.selectedToolName] ??
		selectedToolConfig?.defaultValue ??
		selectedToolCatalogItem?.default_input ??
		'';
	const selectedToolAllowed =
		selectedToolConfigured &&
		(selectedToolCatalogItem?.allowed ?? selectedToolDecision?.allowed ?? false);
	const selectedToolReason = selectedToolConfigured
		? (selectedToolCatalogItem?.reason ?? selectedToolDecision?.reason ?? '')
		: values.labels.notConfiguredForAgent;

	return {
		selectedToolCatalogItem,
		selectedToolConfig,
		selectedToolDecision,
		selectedToolConfigured,
		selectedToolInputKey,
		selectedToolInputValue,
		selectedToolAllowed,
		selectedToolReason,
	};
}

export function enabledEnterpriseWorkflowTemplates(
	templates: EnterpriseWorkflowTemplate[],
): EnterpriseWorkflowTemplate[] {
	return templates.filter((template) => template.enabled);
}

export function workflowOpsStatsForSummary(
	values: {
		workflowTemplateCount: number;
		workflowOptionCount: number;
		enabledWorkflowTemplateCount: number;
		workflowRunCount: number;
		workflowPendingApprovalCount: number;
	},
	labels: {
		templates: string;
		enabled: string;
		runs: string;
		approvals: string;
	},
): WorkflowOpsStat[] {
	return [
		{
			label: labels.templates,
			value: values.workflowTemplateCount || values.workflowOptionCount,
		},
		{
			label: labels.enabled,
			value:
				values.workflowTemplateCount > 0
					? values.enabledWorkflowTemplateCount
					: values.workflowOptionCount,
		},
		{
			label: labels.runs,
			value: values.workflowRunCount,
		},
		{
			label: labels.approvals,
			value: values.workflowPendingApprovalCount,
		},
	];
}

export function workflowOperationsStateForStatus(values: {
	workflowTemplates: EnterpriseWorkflowTemplate[];
	workflowOptions: Array<{ value: string; label: string }>;
	selectedWorkflowType: string;
	selectedWorkflowTemplate?: EnterpriseWorkflowTemplate | null;
	recentWorkflowRuns: EnterpriseWorkflowRunHistoryItem[];
	workflowRunCount: number;
	pendingApprovals: EnterpriseApprovalRequestItem[];
	labels: Parameters<typeof workflowOpsStatsForSummary>[1];
}) {
	const workflowPendingApprovals = pendingWorkflowRunApprovals(values.pendingApprovals);
	const enabledWorkflowTemplates = enabledEnterpriseWorkflowTemplates(values.workflowTemplates);
	const selectedWorkflowOption = values.workflowOptions.find(
		(workflow) => workflow.value === values.selectedWorkflowType,
	);
	const selectedWorkflowName =
		values.selectedWorkflowTemplate?.name ??
		selectedWorkflowOption?.label ??
		values.selectedWorkflowType;
	const selectedWorkflowSteps = values.selectedWorkflowTemplate?.steps ?? [];
	const selectedWorkflowLastRun =
		values.recentWorkflowRuns.find(
			(run) => run.workflow_type === values.selectedWorkflowType,
		) ??
		values.recentWorkflowRuns[0] ??
		null;
	const workflowOpsStats = workflowOpsStatsForSummary(
		{
			workflowTemplateCount: values.workflowTemplates.length,
			workflowOptionCount: values.workflowOptions.length,
			enabledWorkflowTemplateCount: enabledWorkflowTemplates.length,
			workflowRunCount: values.workflowRunCount,
			workflowPendingApprovalCount: workflowPendingApprovals.length,
		},
		values.labels,
	);

	return {
		workflowPendingApprovals,
		enabledWorkflowTemplates,
		selectedWorkflowOption,
		selectedWorkflowName,
		selectedWorkflowSteps,
		selectedWorkflowLastRun,
		workflowOpsStats,
	};
}

export function scheduleSortTime(schedule: ScheduleRecord) {
	const timestamp = Date.parse(schedule.updated_at || schedule.created_at || schedule.data.started_at);
	return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function enabledTriggerSchedules(schedules: ScheduleRecord[]): ScheduleRecord[] {
	return schedules.filter((schedule) => schedule.data.enabled);
}

export function triggerSchedulesBySource(
	schedules: ScheduleRecord[],
	source: ScheduleRecord['data']['source'],
): ScheduleRecord[] {
	return schedules.filter((schedule) => schedule.data.source === source);
}

export function recentTriggerSchedules(
	schedules: ScheduleRecord[],
	limit = 4,
): ScheduleRecord[] {
	return [...schedules]
		.sort((left, right) => scheduleSortTime(right) - scheduleSortTime(left))
		.slice(0, limit);
}

export function triggerOpsStatsForSummary(
	values: {
		scheduleCount: number;
		enabledScheduleCount: number;
		agentSourceScheduleCount: number;
		userSourceScheduleCount: number;
	},
	labels: {
		schedules: string;
		enabled: string;
		agentSource: string;
		userSource: string;
	},
): TriggerOpsStat[] {
	return [
		{
			label: labels.schedules,
			value: values.scheduleCount,
		},
		{
			label: labels.enabled,
			value: values.enabledScheduleCount,
		},
		{
			label: labels.agentSource,
			value: values.agentSourceScheduleCount,
		},
		{
			label: labels.userSource,
			value: values.userSourceScheduleCount,
		},
	];
}

export function triggerOpsSummaryText(
	values: {
		scheduleCount: number;
		enabledScheduleCount: number;
	},
	labels: {
		manual: string;
		paused: string;
		active: (values: { count: number }) => string;
	},
): string {
	if (values.scheduleCount === 0) {
		return labels.manual;
	}

	if (values.enabledScheduleCount === 0) {
		return labels.paused;
	}

	return labels.active({ count: values.enabledScheduleCount });
}

export function triggerOperationsStateForStatus(values: {
	schedules: ScheduleRecord[];
	statLabels: Parameters<typeof triggerOpsStatsForSummary>[1];
	summaryLabels: Parameters<typeof triggerOpsSummaryText>[1];
}) {
	const enabledSchedules = enabledTriggerSchedules(values.schedules);
	const agentSourceSchedules = triggerSchedulesBySource(values.schedules, 'AGENT');
	const userSourceSchedules = triggerSchedulesBySource(values.schedules, 'USER');
	const recentSchedules = recentTriggerSchedules(values.schedules);
	const triggerOpsStats = triggerOpsStatsForSummary(
		{
			scheduleCount: values.schedules.length,
			enabledScheduleCount: enabledSchedules.length,
			agentSourceScheduleCount: agentSourceSchedules.length,
			userSourceScheduleCount: userSourceSchedules.length,
		},
		values.statLabels,
	);
	const triggerOpsSummary = triggerOpsSummaryText(
		{
			scheduleCount: values.schedules.length,
			enabledScheduleCount: enabledSchedules.length,
		},
		values.summaryLabels,
	);

	return {
		enabledSchedules,
		agentSourceSchedules,
		userSourceSchedules,
		recentSchedules,
		triggerOpsStats,
		triggerOpsSummary,
	};
}

export function auditStatsForSummary(
	values: {
		auditSummary?: EnterpriseAuditQueryResponse['summary'] | null;
		auditEvents: EnterpriseAuditEvent[];
	},
	labels: {
		returned: string;
		successes: string;
		failures: string;
		avgDuration: string;
	},
): Array<{ label: string; value: string | number }> {
	return [
		{
			label: labels.returned,
			value: values.auditSummary?.total_returned ?? values.auditEvents.length,
		},
		{
			label: labels.successes,
			value:
				values.auditSummary?.successes ??
				values.auditEvents.filter((event) => event.success === true).length,
		},
		{
			label: labels.failures,
			value:
				values.auditSummary?.failures ??
				values.auditEvents.filter((event) => event.success === false).length,
		},
		{
			label: labels.avgDuration,
			value:
				values.auditSummary?.avg_duration_ms === null ||
				values.auditSummary?.avg_duration_ms === undefined
					? '-'
					: `${Math.round(values.auditSummary.avg_duration_ms)} ms`,
		},
	];
}

export function templateDetailIssues(
	hasCredentials: boolean,
	hasKnowledgeBases: boolean,
	labels: { missingModel: string; missingKnowledge: string },
) {
	return [
		hasCredentials ? null : labels.missingModel,
		hasKnowledgeBases ? null : labels.missingKnowledge,
	].filter(Boolean) as string[];
}

export function appCenterDetailStatusState(
	hasAgent: boolean,
	agentReadiness: HealthState,
	issues: string[],
	hasCredentials: boolean,
): HealthState {
	if (hasAgent) {
		return agentReadiness;
	}

	if (issues.length === 0) {
		return 'ready';
	}

	return hasCredentials ? 'partial' : 'blocked';
}

export function appCenterDetailHealthState(values: {
	hasAgent: boolean;
	agentReadiness: HealthState;
	agentIssues: string[];
	hasTemplate: boolean;
	hasCredentials: boolean;
	hasKnowledgeBases: boolean;
	labels: { missingModel: string; missingKnowledge: string };
}) {
	const issues = values.hasAgent
		? values.agentIssues
		: values.hasTemplate
			? templateDetailIssues(values.hasCredentials, values.hasKnowledgeBases, values.labels)
			: [];

	return {
		issues,
		status: appCenterDetailStatusState(
			values.hasAgent,
			values.agentReadiness,
			issues,
			values.hasCredentials,
		),
	};
}

export function agentRunnerAccessLabelKey(
	agent:
		| { allowed_user_ids?: string[] | null; allowed_roles?: string[] | null }
		| null
		| undefined,
	allowed: boolean,
) {
	if (!agent) {
		return '';
	}

	if (!allowed) {
		return 'platform.agentRunner.accessDenied';
	}

	return agentAccessRestricted(agent)
		? 'platform.agentRunner.accessAllowed'
		: 'platform.agentRunner.accessOpen';
}

export function selectedIdentityStateForStatus(values: {
	enterpriseIdentities: EnterpriseIdentity[];
	selectedIdentityUserId: string;
	selectedRunAgent?: EnterprisePublishedAgent | null;
	governanceWorkspaces?: Record<string, EnterpriseTenantWorkspace> | null;
	connectorWorkspaces?: Record<string, EnterpriseTenantWorkspace> | null;
	username: string;
	accessLabel: (key: string) => string;
}) {
	const selectedIdentity =
		values.enterpriseIdentities.find(
			(identity) => identity.user_id === values.selectedIdentityUserId,
		) ??
		values.enterpriseIdentities[0] ??
		null;
	const selectedRunAgentAccessAllowed = values.selectedRunAgent
		? agentAccessAllowed(values.selectedRunAgent, selectedIdentity)
		: true;
	const selectedRunAgentAccessLabelKey = agentRunnerAccessLabelKey(
		values.selectedRunAgent,
		selectedRunAgentAccessAllowed,
	);
	const selectedRunAgentAccessLabel = selectedRunAgentAccessLabelKey
		? values.accessLabel(selectedRunAgentAccessLabelKey)
		: '';
	const selectedIdentityAllowedTools =
		selectedIdentity?.tool_policy.decisions.filter((decision) => decision.allowed) ?? [];
	const selectedIdentityDeniedTools =
		selectedIdentity?.tool_policy.decisions.filter((decision) => !decision.allowed) ?? [];
	const selectedIdentityWorkspace = selectedIdentity
		? (values.governanceWorkspaces?.[selectedIdentity.tenant] ??
			values.connectorWorkspaces?.[selectedIdentity.tenant] ??
			null)
		: null;
	const currentIdentityLabel = selectedIdentity
		? `${selectedIdentity.display_name} / ${selectedIdentity.tenant}`
		: values.username;

	return {
		selectedIdentity,
		selectedRunAgentAccessAllowed,
		selectedRunAgentAccessLabel,
		selectedIdentityAllowedTools,
		selectedIdentityDeniedTools,
		selectedIdentityWorkspace,
		currentIdentityLabel,
	};
}

export function agentReadinessState(
	agent?: Pick<EnterprisePublishedAgent, 'readiness'> | null,
): HealthState {
	return agent ? agent.readiness?.status ?? 'partial' : 'todo';
}

export function agentReadinessIssues(
	agent?: Pick<EnterprisePublishedAgent, 'readiness'> | null,
) {
	return agent?.readiness?.issues.map((issue) => issue.message).filter(Boolean) ?? [];
}

export function agentIsReady(agent?: Pick<EnterprisePublishedAgent, 'readiness'> | null) {
	return agentReadinessState(agent) === 'ready';
}

export function activePlatformAgentsForAgents(agents: EnterprisePublishedAgent[]) {
	return agents.filter((agent) => agent.status === 'published');
}

export function archivedPlatformAgentsForAgents(agents: EnterprisePublishedAgent[]) {
	return agents.filter((agent) => agent.status !== 'published');
}

export function readyPlatformAgentsForAgents(agents: EnterprisePublishedAgent[]) {
	return agents.filter(
		(agent) =>
			agentIsReady(agent) ||
			(Boolean(agent.model_config_id) &&
				!(agent.readiness?.issues ?? []).some((issue) => issue.severity === 'blocking')),
	);
}

export function publishedAgentReadinessState(
	agent: {
		readiness?: EnterprisePublishedAgent['readiness'] | null;
		status?: string | null;
	},
): HealthState {
	return agent.status !== 'published' ? 'todo' : agent.readiness?.status ?? 'partial';
}

export function formatScheduleAgentLabel(
	schedule: { agent_id?: string | null },
	activePlatformAgents: EnterprisePublishedAgent[],
	agents: AgentView[],
	fallback: string,
) {
	const publishedName = activePlatformAgents.find(
		(agent) => agent.id === schedule.agent_id,
	)?.name;
	if (publishedName) {
		return publishedName;
	}

	const draftName = agents.find((agent) => agent.id === schedule.agent_id)?.data?.name;
	if (typeof draftName === 'string' && draftName.trim()) {
		return draftName;
	}

	return schedule.agent_id || fallback;
}

export function normalizeWorkflowInputs(
	inputs?: Record<string, unknown>,
): Record<string, string> {
	const source = inputs && Object.keys(inputs).length > 0 ? inputs : defaultEnterpriseWorkflowInputs;

	return Object.fromEntries(
		Object.entries(source).map(([key, value]) => [key, value == null ? '' : String(value)]),
	);
}

export function workflowStatusLabelKey(status?: string) {
	if (status === 'completed') {
		return 'statusCompleted';
	}

	if (status === 'partial') {
		return 'statusPartial';
	}

	return 'statusWorkflowFailed';
}

export function workflowStatusClassName(status?: string) {
	if (status === 'completed') {
		return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
	}

	if (status === 'partial') {
		return 'border-amber-500/30 bg-amber-500/10 text-amber-700';
	}

	return '';
}

export function operationSeverityClassName(severity?: string) {
	if (severity === 'error') {
		return 'border-red-500/30 bg-red-500/10 text-red-700';
	}

	if (severity === 'warning') {
		return 'border-amber-500/30 bg-amber-500/10 text-amber-700';
	}

	return 'border-sky-500/30 bg-sky-500/10 text-sky-700';
}

export function approvalStatusClassName(status?: string) {
	if (status === 'approved') {
		return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
	}

	if (status === 'pending') {
		return 'border-amber-500/30 bg-amber-500/10 text-amber-700';
	}

	return 'border-slate-500/30 bg-slate-500/10 text-slate-700';
}

export function workflowInputLabel(key: string) {
	return key.replace(/_/g, ' ');
}
