import { platformWorkflowDisplayStateForStatus } from './platform-workflow-display';

type PlatformWorkflowDisplayValues = Parameters<
	typeof platformWorkflowDisplayStateForStatus
>[0];

export function createPlatformWorkflowPageState(
	values: PlatformWorkflowDisplayValues,
) {
	const workflowDisplay = platformWorkflowDisplayStateForStatus(values);
	const workflowSelectionState = workflowDisplay.selectionState;
	const workflowOperationsState = workflowDisplay.operationsState;
	const triggerOperationsState = workflowDisplay.triggerState;

	return {
		selectedWorkflowTemplate: workflowSelectionState.selectedWorkflowTemplate,
		workflowOptions: workflowSelectionState.workflowOptions,
		selectedWorkflowDisabled: workflowSelectionState.selectedWorkflowDisabled,
		workflowPendingApprovals: workflowOperationsState.workflowPendingApprovals,
		selectedWorkflowName: workflowOperationsState.selectedWorkflowName,
		selectedWorkflowSteps: workflowOperationsState.selectedWorkflowSteps,
		selectedWorkflowLastRun: workflowOperationsState.selectedWorkflowLastRun,
		workflowOpsStats: workflowOperationsState.workflowOpsStats,
		recentSchedules: triggerOperationsState.recentSchedules,
		triggerOpsStats: triggerOperationsState.triggerOpsStats,
		triggerOpsSummary: triggerOperationsState.triggerOpsSummary,
	};
}
