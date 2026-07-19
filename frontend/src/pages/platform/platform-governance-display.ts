import {
	governanceOperationsStateForStatus,
	selectedIdentityGovernanceDisplayStateForStatus,
} from './platform-utils';

export interface PlatformGovernanceDisplayState {
	selectedIdentityState: ReturnType<typeof selectedIdentityGovernanceDisplayStateForStatus>;
	operationsState: ReturnType<typeof governanceOperationsStateForStatus>;
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
