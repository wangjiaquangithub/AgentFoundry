import { platformGovernanceDisplayStateForStatus } from './platform-governance-display';

type PlatformGovernanceDisplayValues = Parameters<
	typeof platformGovernanceDisplayStateForStatus
>[0];

export function createPlatformGovernancePageState(
	values: PlatformGovernanceDisplayValues,
) {
	const governanceDisplay = platformGovernanceDisplayStateForStatus(values);
	const selectedIdentityGovernanceDisplayState =
		governanceDisplay.selectedIdentityState;
	const governanceOperationsState = governanceDisplay.operationsState;

	return {
		selectedIdentityPendingApprovals:
			selectedIdentityGovernanceDisplayState.selectedIdentityPendingApprovals,
		selectedIdentityPendingToolNames:
			selectedIdentityGovernanceDisplayState.selectedIdentityPendingToolNames,
		identityAccessRows: governanceOperationsState.identityAccessRows,
		accessTenantSummaries: governanceOperationsState.accessTenantSummaries,
		accessControlStats: governanceOperationsState.accessControlStats,
		governanceHealthItems: governanceOperationsState.governanceHealthItems,
		toolPolicySummary: selectedIdentityGovernanceDisplayState.toolPolicySummary,
		selectedIdentityFailedAuditEvents:
			selectedIdentityGovernanceDisplayState.selectedIdentityFailedAuditEvents,
		selectedIdentityRecentAuditEvents:
			selectedIdentityGovernanceDisplayState.selectedIdentityRecentAuditEvents,
	};
}
