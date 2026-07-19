import type { EnterpriseIdentity, EnterprisePlatformGovernanceResponse } from '@/api';
import type { MemoryOperationsItem } from './components/MemoryOperationsPanel';
import type { ApprovalFiltersState, AuditFiltersState } from './platform-defaults';
import {
	runInspectAgentRunEvidenceAuditAction,
	runInspectIdentityApprovalsAction,
	runInspectIdentityAuditAction,
	runInspectIdentityFailuresAction,
	runInspectMemoryOperationAuditAction,
	runInspectTenantApprovalsAction,
	runInspectTenantAuditAction,
} from './platform-filter-builders';

export type GovernanceLoadActionHandlers = {
	setLoading: (loading: boolean) => void;
	clearError: () => void;
	loadGovernance: () =>
		| EnterprisePlatformGovernanceResponse
		| Promise<EnterprisePlatformGovernanceResponse>;
	setGovernance: (governance: EnterprisePlatformGovernanceResponse) => void;
	setError: (message: string) => void;
};

export async function runGovernanceLoadAction(
	loadErrorMessage: string,
	handlers: GovernanceLoadActionHandlers,
) {
	handlers.setLoading(true);
	handlers.clearError();
	try {
		const response = await handlers.loadGovernance();
		handlers.setGovernance(response);
	} catch (error) {
		handlers.setError(
			error instanceof Error ? error.message : loadErrorMessage,
		);
	} finally {
		handlers.setLoading(false);
	}
}

export type PlatformGovernanceHandlerValues = {
	loadErrorMessage: string;
};

export type PlatformGovernanceHandlerActions = {
	setLoading: (loading: boolean) => void;
	clearError: () => void;
	loadGovernance: () =>
		| EnterprisePlatformGovernanceResponse
		| Promise<EnterprisePlatformGovernanceResponse>;
	setGovernance: (governance: EnterprisePlatformGovernanceResponse) => void;
	setError: (message: string) => void;
};

export function createPlatformGovernanceHandlers(
	values: PlatformGovernanceHandlerValues,
	actions: PlatformGovernanceHandlerActions,
) {
	async function refetchGovernance() {
		await runGovernanceLoadAction(values.loadErrorMessage, {
			setLoading: actions.setLoading,
			clearError: actions.clearError,
			loadGovernance: actions.loadGovernance,
			setGovernance: actions.setGovernance,
			setError: actions.setError,
		});
	}

	return {
		refetchGovernance,
	};
}

export type PlatformGovernanceInspectionHandlerValues = {
	agentRunEvidence: Parameters<typeof runInspectAgentRunEvidenceAuditAction>[0];
};

export type PlatformGovernanceInspectionHandlerActions = {
	patchAuditFilters: (
		updater: (current: AuditFiltersState) => AuditFiltersState,
	) => void;
	refetchAuditEvents: (
		overrides: Partial<AuditFiltersState>,
	) => void | Promise<void>;
	patchApprovalFilters: (
		updater: (current: ApprovalFiltersState) => ApprovalFiltersState,
	) => void;
	refetchApprovals: (
		overrides: Partial<ApprovalFiltersState>,
	) => void | Promise<void>;
	scrollToGovernance: () => void;
};

export function createPlatformGovernanceInspectionHandlers(
	values: PlatformGovernanceInspectionHandlerValues,
	actions: PlatformGovernanceInspectionHandlerActions,
) {
	const scrollToGovernance = () =>
		window.setTimeout(actions.scrollToGovernance, 0);

	function handleInspectIdentityAudit(identity: EnterpriseIdentity) {
		runInspectIdentityAuditAction(identity, {
			patchAuditFilters: actions.patchAuditFilters,
			refetchAuditEvents: actions.refetchAuditEvents,
			scrollToGovernance,
		});
	}

	function handleInspectIdentityApprovals(identity: EnterpriseIdentity) {
		runInspectIdentityApprovalsAction(identity, {
			patchApprovalFilters: actions.patchApprovalFilters,
			refetchApprovals: actions.refetchApprovals,
			scrollToGovernance,
		});
	}

	function handleInspectIdentityFailures(identity: EnterpriseIdentity) {
		runInspectIdentityFailuresAction(identity, {
			patchAuditFilters: actions.patchAuditFilters,
			refetchAuditEvents: actions.refetchAuditEvents,
			scrollToGovernance,
		});
	}

	function handleInspectTenantAudit(tenant: string) {
		runInspectTenantAuditAction(tenant, {
			patchAuditFilters: actions.patchAuditFilters,
			refetchAuditEvents: actions.refetchAuditEvents,
			scrollToGovernance,
		});
	}

	function handleInspectMemoryOperationAudit(item: MemoryOperationsItem) {
		runInspectMemoryOperationAuditAction(item, {
			patchAuditFilters: actions.patchAuditFilters,
			refetchAuditEvents: actions.refetchAuditEvents,
			scrollToGovernance,
		});
	}

	function handleInspectTenantApprovals(tenant: string) {
		runInspectTenantApprovalsAction(tenant, {
			patchApprovalFilters: actions.patchApprovalFilters,
			refetchApprovals: actions.refetchApprovals,
			scrollToGovernance,
		});
	}

	function handleInspectAgentRunAudit() {
		runInspectAgentRunEvidenceAuditAction(values.agentRunEvidence, {
			patchAuditFilters: actions.patchAuditFilters,
			refetchAuditEvents: actions.refetchAuditEvents,
			scrollToGovernance,
		});
	}

	return {
		handleInspectIdentityAudit,
		handleInspectIdentityApprovals,
		handleInspectIdentityFailures,
		handleInspectTenantAudit,
		handleInspectMemoryOperationAudit,
		handleInspectTenantApprovals,
		handleInspectAgentRunAudit,
	};
}
