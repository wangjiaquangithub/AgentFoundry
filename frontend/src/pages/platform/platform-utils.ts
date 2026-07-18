import type { AgentView, EnterpriseIdentity, EnterprisePublishedAgent } from '@/api';
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
