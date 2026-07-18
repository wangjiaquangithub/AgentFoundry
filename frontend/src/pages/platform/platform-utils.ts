import type {
	AgentView,
	EnterpriseAgentTemplate,
	EnterpriseIdentity,
	EnterprisePublishedAgent,
} from '@/api';
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
