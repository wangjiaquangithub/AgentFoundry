import {
	selectedToolRunnerStateForStatus,
	toolCatalogStateForStatus,
} from './platform-utils';

export interface PlatformToolRunnerDisplayState {
	catalogState: ReturnType<typeof toolCatalogStateForStatus>;
	selectedToolRunnerState: ReturnType<typeof selectedToolRunnerStateForStatus>;
}

export function platformToolRunnerDisplayStateForStatus(values: {
	catalog: Parameters<typeof toolCatalogStateForStatus>[0];
	selectedTool: Omit<
		Parameters<typeof selectedToolRunnerStateForStatus>[0],
		'availableToolItems' | 'policyDecisions'
	>;
}): PlatformToolRunnerDisplayState {
	const catalogState = toolCatalogStateForStatus(values.catalog);
	const selectedToolRunnerState = selectedToolRunnerStateForStatus({
		...values.selectedTool,
		availableToolItems: catalogState.availableToolItems,
		policyDecisions: catalogState.policyDecisions,
	});

	return {
		catalogState,
		selectedToolRunnerState,
	};
}
