import {
	auditStatsForSummary,
	governanceOperationsStateForStatus,
	selectedIdentityGovernanceDisplayStateForStatus,
	selectedIdentityStateForStatus,
	summarizeAuditObject,
} from './platform-utils';

export interface PlatformGovernanceDisplayState {
	selectedIdentityState: ReturnType<typeof selectedIdentityGovernanceDisplayStateForStatus>;
	operationsState: ReturnType<typeof governanceOperationsStateForStatus>;
}

export function platformSelectedIdentityDisplayStateForStatus(
	values: Parameters<typeof selectedIdentityStateForStatus>[0],
) {
	return selectedIdentityStateForStatus(values);
}

export function platformAuditStatsDisplayStateForSummary(
	values: Parameters<typeof auditStatsForSummary>[0],
	labels: Parameters<typeof auditStatsForSummary>[1],
) {
	return auditStatsForSummary(values, labels);
}

export function platformSummarizeAuditObject(
	value?: Parameters<typeof summarizeAuditObject>[0],
) {
	return summarizeAuditObject(value);
}

export function platformGovernanceDisplayStateForStatus(values: {
	selectedIdentity: Parameters<typeof selectedIdentityGovernanceDisplayStateForStatus>[0];
	operations: Omit<
		Parameters<typeof governanceOperationsStateForStatus>[0],
		'selectedIdentityPendingApprovalCount'
	>;
}): PlatformGovernanceDisplayState {
	const selectedIdentityState = selectedIdentityGovernanceDisplayStateForStatus(
		values.selectedIdentity,
	);
	const operationsState = governanceOperationsStateForStatus({
		...values.operations,
		selectedIdentityPendingApprovalCount:
			selectedIdentityState.selectedIdentityPendingApprovals.length,
	});

	return {
		selectedIdentityState,
		operationsState,
	};
}
