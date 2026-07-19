import {
	triggerOperationsStateForStatus,
	workflowOperationsStateForStatus,
} from './platform-utils';

export interface PlatformWorkflowDisplayState {
	operationsState: ReturnType<typeof workflowOperationsStateForStatus>;
	triggerState: ReturnType<typeof triggerOperationsStateForStatus>;
}

export function platformWorkflowDisplayStateForStatus(values: {
	operations: Parameters<typeof workflowOperationsStateForStatus>[0];
	trigger: Parameters<typeof triggerOperationsStateForStatus>[0];
}): PlatformWorkflowDisplayState {
	return {
		operationsState: workflowOperationsStateForStatus(values.operations),
		triggerState: triggerOperationsStateForStatus(values.trigger),
	};
}
