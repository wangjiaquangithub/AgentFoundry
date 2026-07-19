import type { EnterpriseIdentity } from '@/api';
import type { MemoryOperationsItem } from './components/MemoryOperationsPanel';
import type { ApprovalFiltersState, AuditFiltersState } from './platform-defaults';

type ApprovalFilterPatch = Partial<ApprovalFiltersState>;
type AuditFilterPatch = Partial<AuditFiltersState>;
type NavigationHandler = () => void;
type AgentRunEvidence = {
	tenant: string;
	user_id: string;
	agent_id: string;
	audit_filter: { tool_names?: unknown };
};

export function mergeAuditFilters(
	current: AuditFiltersState,
	patch: AuditFilterPatch,
): AuditFiltersState {
	return { ...current, ...patch };
}

export function mergeApprovalFilters(
	current: ApprovalFiltersState,
	patch: ApprovalFilterPatch,
): ApprovalFiltersState {
	return { ...current, ...patch };
}

export function auditQueryFromFilters(filters: AuditFiltersState) {
	const limitValue = Number.parseInt(filters.limit, 10);

	return {
		tenant: filters.tenant || undefined,
		user_id: filters.user_id || undefined,
		agent_id: filters.agent_id || undefined,
		tool_name: filters.tool_name || undefined,
		success:
			filters.success === 'true'
				? true
				: filters.success === 'false'
					? false
					: undefined,
		limit: Number.isFinite(limitValue) ? limitValue : 50,
	};
}

export function auditFiltersForIdentity(identity: EnterpriseIdentity): AuditFilterPatch {
	return { tenant: identity.tenant, user_id: identity.user_id };
}

export function approvalFiltersForIdentity(identity: EnterpriseIdentity): ApprovalFilterPatch {
	return {
		status: 'pending',
		tenant: identity.tenant,
		user_id: identity.user_id,
	};
}

export function failedAuditFiltersForIdentity(
	identity: EnterpriseIdentity,
): AuditFilterPatch {
	return {
		tenant: identity.tenant,
		user_id: identity.user_id,
		success: 'false',
	};
}

export function auditFiltersForTenant(tenant: string): AuditFilterPatch {
	return { tenant, user_id: '', agent_id: '', tool_name: '', success: '' };
}

export function approvalFiltersForTenant(tenant: string): ApprovalFilterPatch {
	return {
		status: 'pending',
		tenant,
		user_id: '',
		agent_id: '',
	};
}

export function auditFiltersForMemoryOperation(
	item: MemoryOperationsItem,
): AuditFilterPatch {
	return {
		tenant: item.tenant,
		user_id: item.userId,
		agent_id: item.agentId,
		tool_name: '',
		success: '',
	};
}

export function auditFiltersForAgentRunEvidence(
	evidence: AgentRunEvidence,
): AuditFilterPatch {
	const toolNames = evidence.audit_filter.tool_names;
	const firstToolName = Array.isArray(toolNames) ? toolNames[0] : '';

	return {
		tenant: evidence.tenant,
		user_id: evidence.user_id,
		agent_id: evidence.agent_id,
		tool_name: firstToolName ? String(firstToolName) : '',
	};
}

export function agentRunEvidenceAuditTarget(
	evidence: AgentRunEvidence | null | undefined,
): AuditFilterPatch | null {
	return evidence ? auditFiltersForAgentRunEvidence(evidence) : null;
}

export type AuditFilterTargetActionHandlers = {
	patchAuditFilters: (
		updater: (current: AuditFiltersState) => AuditFiltersState,
	) => void;
	refetchAuditEvents: (
		filters: AuditFilterPatch,
	) => void | Promise<void>;
	scrollToGovernance: NavigationHandler;
};

export function runAuditFilterTargetAction(
	filters: AuditFilterPatch,
	handlers: AuditFilterTargetActionHandlers,
) {
	handlers.patchAuditFilters((previous) => mergeAuditFilters(previous, filters));
	void handlers.refetchAuditEvents(filters);
	handlers.scrollToGovernance();
}

export function runAgentRunEvidenceAuditTargetAction(
	target: AuditFilterPatch | null,
	handlers: AuditFilterTargetActionHandlers,
) {
	if (!target) {
		return;
	}

	runAuditFilterTargetAction(target, handlers);
}

export function runInspectAgentRunEvidenceAuditAction(
	evidence: Parameters<typeof agentRunEvidenceAuditTarget>[0],
	handlers: AuditFilterTargetActionHandlers,
) {
	const target = agentRunEvidenceAuditTarget(evidence);

	runAgentRunEvidenceAuditTargetAction(target, handlers);
}

export type ApprovalFilterTargetActionHandlers = {
	patchApprovalFilters: (
		updater: (current: ApprovalFiltersState) => ApprovalFiltersState,
	) => void;
	refetchApprovals: (
		filters: ApprovalFilterPatch,
	) => void | Promise<void>;
	scrollToGovernance: NavigationHandler;
};

export function runApprovalFilterTargetAction(
	filters: ApprovalFilterPatch,
	handlers: ApprovalFilterTargetActionHandlers,
) {
	handlers.patchApprovalFilters((previous) =>
		mergeApprovalFilters(previous, filters),
	);
	void handlers.refetchApprovals(filters);
	handlers.scrollToGovernance();
}
