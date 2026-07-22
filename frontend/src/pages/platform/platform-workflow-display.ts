import {
	triggerOperationsStateForStatus,
	workflowOperationsStateForStatus,
	workflowSelectionStateForTemplates,
} from './platform-utils';
import type {
	EnterpriseWorkflowRunHistoryItem,
	EnterpriseWorkflowTemplate,
} from '@/api';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface PlatformWorkflowDisplayState {
	selectionState: ReturnType<typeof workflowSelectionStateForTemplates>;
	operationsState: ReturnType<typeof workflowOperationsStateForStatus>;
	triggerState: ReturnType<typeof triggerOperationsStateForStatus>;
}

export interface PlatformWorkflowViewMetrics {
	enabledWorkflowCount: number;
	totalWorkflowSteps: number;
	latestWorkflowStatusLabel: string;
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

export function platformWorkflowViewMetrics(values: {
	workflowTemplates: EnterpriseWorkflowTemplate[];
	workflowRuns: EnterpriseWorkflowRunHistoryItem[];
	t: Translate;
}): PlatformWorkflowViewMetrics {
	const enabledWorkflowCount = values.workflowTemplates.filter(
		(template) => template.enabled,
	).length;
	const totalWorkflowSteps = values.workflowTemplates.reduce(
		(total, template) => total + template.steps.length,
		0,
	);
	const latestWorkflowRun = values.workflowRuns[0];
	const latestWorkflowStatusLabel = latestWorkflowRun
		? values.t(
				latestWorkflowRun.status === 'completed'
					? 'platform.workflowRunner.statusCompleted'
					: latestWorkflowRun.status === 'partial'
						? 'platform.workflowRunner.statusPartial'
						: 'platform.workflowRunner.statusWorkflowFailed',
			)
		: values.t('platform.workflowRunner.historyEmpty');

	return {
		enabledWorkflowCount,
		totalWorkflowSteps,
		latestWorkflowStatusLabel,
	};
}
