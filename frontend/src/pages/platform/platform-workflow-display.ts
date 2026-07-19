import {
	triggerOperationsStateForStatus,
	workflowOperationsStateForStatus,
	workflowSelectionStateForTemplates,
} from './platform-utils';

export interface PlatformWorkflowDisplayState {
	selectionState: ReturnType<typeof workflowSelectionStateForTemplates>;
	operationsState: ReturnType<typeof workflowOperationsStateForStatus>;
	triggerState: ReturnType<typeof triggerOperationsStateForStatus>;
}

export function platformWorkflowDisplayStateForStatus(values: {
	selection: {
		values: Parameters<typeof workflowSelectionStateForTemplates>[0];
		labels: Parameters<typeof workflowSelectionStateForTemplates>[1];
	};
	operations: Omit<
		Parameters<typeof workflowOperationsStateForStatus>[0],
		'workflowOptions' | 'selectedWorkflowTemplate'
	>;
	trigger: Parameters<typeof triggerOperationsStateForStatus>[0];
}): PlatformWorkflowDisplayState {
	const selectionState = workflowSelectionStateForTemplates(
		values.selection.values,
		values.selection.labels,
	);

	return {
		selectionState,
		operationsState: workflowOperationsStateForStatus({
			...values.operations,
			workflowOptions: selectionState.workflowOptions,
			selectedWorkflowTemplate: selectionState.selectedWorkflowTemplate,
		}),
		triggerState: triggerOperationsStateForStatus(values.trigger),
	};
}
