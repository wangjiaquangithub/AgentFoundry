import {
	dashboardFallbackStateForStatus,
	dashboardOperationsStateForStatus,
	dashboardTodoItemsForStatus,
	memoryOperationsStateForConversations,
	platformDashboardSourceStateForStatus,
	tenantWorkspaceOperationsStateForStatus,
} from './platform-utils';

export interface PlatformDashboardDisplayState {
	sourceState: ReturnType<typeof platformDashboardSourceStateForStatus>;
	fallbackState: ReturnType<typeof dashboardFallbackStateForStatus>;
	tenantWorkspaceState: ReturnType<typeof tenantWorkspaceOperationsStateForStatus>;
	memoryOperationsState: ReturnType<typeof memoryOperationsStateForConversations>;
	operationsState: ReturnType<typeof dashboardOperationsStateForStatus>;
	todoItems: string[];
}

export function platformDashboardDisplayStateForStatus(values: {
	source: Parameters<typeof platformDashboardSourceStateForStatus>[0];
	fallback: Omit<Parameters<typeof dashboardFallbackStateForStatus>[0], 'dashboard'>;
	tenantWorkspace: Omit<
		Parameters<typeof tenantWorkspaceOperationsStateForStatus>[0],
		'pendingApprovals'
	>;
	tenantWorkspaceLabels: Parameters<typeof tenantWorkspaceOperationsStateForStatus>[1];
	memoryOperations: Parameters<typeof memoryOperationsStateForConversations>[0];
	operations: Omit<
		Parameters<typeof dashboardOperationsStateForStatus>[0],
		'dashboardOperations' | 'dashboardRiskTools'
	>;
	todo: Omit<Parameters<typeof dashboardTodoItemsForStatus>[0], 'pendingApprovalCount'>;
	todoLabels: Parameters<typeof dashboardTodoItemsForStatus>[1];
}): PlatformDashboardDisplayState {
	const sourceState = platformDashboardSourceStateForStatus(values.source);
	const fallbackState = dashboardFallbackStateForStatus({
		...values.fallback,
		dashboard: sourceState.dashboard,
	});
	const operationsState = dashboardOperationsStateForStatus({
		...values.operations,
		dashboardOperations: sourceState.dashboardOperations,
		dashboardRiskTools: sourceState.dashboardRiskTools,
	});
	const tenantWorkspaceState = tenantWorkspaceOperationsStateForStatus(
		{
			...values.tenantWorkspace,
			pendingApprovals: fallbackState.pendingApprovals,
		},
		values.tenantWorkspaceLabels,
	);
	const memoryOperationsState = memoryOperationsStateForConversations(
		values.memoryOperations,
	);

	return {
		sourceState,
		fallbackState,
		tenantWorkspaceState,
		memoryOperationsState,
		operationsState,
		todoItems: dashboardTodoItemsForStatus(
			{
				...values.todo,
				pendingApprovalCount: fallbackState.pendingApprovals.length,
			},
			values.todoLabels,
		),
	};
}
