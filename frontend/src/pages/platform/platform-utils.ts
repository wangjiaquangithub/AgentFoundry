import type {
	AgentView,
	EnterpriseAgentTemplate,
	EnterpriseApprovalRequestItem,
	EnterpriseAuditEvent,
	EnterpriseAuditQueryResponse,
	EnterpriseIdentity,
	EnterprisePlatformGovernanceResponse,
	EnterprisePublishedAgent,
	EnterpriseTenantWorkspace,
	EnterpriseToolCatalogItem,
	EnterpriseWorkflowRunHistoryItem,
	EnterpriseWorkflowTemplate,
	ScheduleRecord,
} from '@/api';
import type { AccessControlStat } from './components/AccessControlPanel';
import type { GovernanceHealthItem } from './components/GovernanceHealthPanel';
import type { ToolPolicyDraftValue } from './components/TenantGovernancePanel';
import type { TenantOverviewItem } from './components/TenantWorkspacePanel';
import type { TriggerOpsStat } from './components/TriggerOpsPanel';
import type { WorkflowOpsStat } from './components/WorkflowOpsPanel';
import type { HealthState } from './components/common';

export const defaultEnterpriseWorkflowInputs: Record<string, string> = {
	policy_keyword: 'remote',
	ticket_id: 'INC-1001',
	department: 'engineering',
};

export const workflowInputLabelKeys: Record<string, string> = {
	policy_keyword: 'policyKeyword',
	ticket_id: 'ticketId',
	department: 'department',
};

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

export function resourceListLabel(values: string[], emptyLabel: string) {
	return values.length > 0 ? values.join(', ') : emptyLabel;
}

export function resourceCountLabel(
	count: number,
	labels: { available: (count: number) => string; empty: string },
) {
	return count > 0 ? labels.available(count) : labels.empty;
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

export function pendingWorkflowRunApprovals(
	approvals: EnterpriseApprovalRequestItem[],
): EnterpriseApprovalRequestItem[] {
	return approvals.filter((approval) => approval.request_type === 'workflow_run');
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
