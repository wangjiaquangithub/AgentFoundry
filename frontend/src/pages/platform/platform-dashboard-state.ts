import { platformDashboardDisplayStateForStatus } from './platform-dashboard-display';

type PlatformDashboardDisplayValues = Parameters<typeof platformDashboardDisplayStateForStatus>[0];

export function createPlatformDashboardPageState(values: PlatformDashboardDisplayValues) {
	const dashboardDisplay = platformDashboardDisplayStateForStatus(values);
	const dashboardSourceState = dashboardDisplay.sourceState;
	const tenantWorkspaceOperationsState = dashboardDisplay.tenantWorkspaceState;
	const memoryOperationsState = dashboardDisplay.memoryOperationsState;
	const dashboardOperationsState = dashboardDisplay.operationsState;

	return {
		dashboardOperations: dashboardSourceState.dashboardOperations,
		pendingApprovals: dashboardDisplay.fallbackState.pendingApprovals,
		approvedApprovalCount: dashboardDisplay.fallbackState.approvedApprovalCount,
		approvalSummary: dashboardDisplay.fallbackState.approvalSummary,
		recentWorkflowRuns: dashboardDisplay.fallbackState.recentWorkflowRuns,
		workflowRunCount: dashboardDisplay.fallbackState.workflowRunCount,
		recentAuditEvents: dashboardDisplay.fallbackState.recentAuditEvents,
		auditEventCount: dashboardDisplay.fallbackState.auditEventCount,
		tenantWorkspaces: tenantWorkspaceOperationsState.tenantWorkspaces,
		tenantOverviewItems: tenantWorkspaceOperationsState.tenantOverviewItems,
		platformMemberTenantSummaries: tenantWorkspaceOperationsState.platformMemberTenantSummaries,
		memoryOperationsItems: memoryOperationsState.items,
		memoryOperationsRunCount: memoryOperationsState.runCount,
		memoryOperationsHitCount: memoryOperationsState.hitCount,
		memoryOperationsSavedCount: memoryOperationsState.savedCount,
		riskToolItems: dashboardOperationsState.riskToolItems,
		completedWorkflowRunCount: dashboardOperationsState.completedWorkflowRunCount,
		partialWorkflowRunCount: dashboardOperationsState.partialWorkflowRunCount,
		failedWorkflowRunCount: dashboardOperationsState.failedWorkflowRunCount,
		governedWorkflowItems: dashboardOperationsState.governedWorkflowItems,
		recommendedOperationActions: dashboardOperationsState.recommendedOperationActions,
		dashboardTodoItems: dashboardDisplay.todoItems,
	};
}
