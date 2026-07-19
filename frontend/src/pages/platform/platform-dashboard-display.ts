import {
	dashboardFallbackStateForStatus,
	dashboardOperationsStateForStatus,
	dashboardTodoItemsForStatus,
	platformDashboardSourceStateForStatus,
} from './platform-utils';

export interface PlatformDashboardDisplayState {
	sourceState: ReturnType<typeof platformDashboardSourceStateForStatus>;
	fallbackState: ReturnType<typeof dashboardFallbackStateForStatus>;
	operationsState: ReturnType<typeof dashboardOperationsStateForStatus>;
	todoItems: string[];
}

export function platformDashboardDisplayStateForStatus(values: {
	source: Parameters<typeof platformDashboardSourceStateForStatus>[0];
	fallback: Omit<Parameters<typeof dashboardFallbackStateForStatus>[0], 'dashboard'>;
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

	return {
		sourceState,
		fallbackState,
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
