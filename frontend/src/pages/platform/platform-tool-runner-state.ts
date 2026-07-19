import { platformToolRunnerDisplayStateForStatus } from './platform-tool-runner-display';

type PlatformToolRunnerDisplayValues = Parameters<typeof platformToolRunnerDisplayStateForStatus>[0];

export function createPlatformToolRunnerPageState(values: PlatformToolRunnerDisplayValues) {
	const toolRunnerDisplay = platformToolRunnerDisplayStateForStatus(values);
	const selectedToolRunnerState = toolRunnerDisplay.selectedToolRunnerState;

	return {
		policyDecisions: toolRunnerDisplay.catalogState.policyDecisions,
		availableToolItems: toolRunnerDisplay.catalogState.availableToolItems,
		selectedToolCatalogItem: selectedToolRunnerState.selectedToolCatalogItem,
		selectedToolConfig: selectedToolRunnerState.selectedToolConfig,
		selectedToolDecision: selectedToolRunnerState.selectedToolDecision,
		selectedToolInputKey: selectedToolRunnerState.selectedToolInputKey,
		selectedToolInputValue: selectedToolRunnerState.selectedToolInputValue,
		selectedToolAllowed: selectedToolRunnerState.selectedToolAllowed,
		selectedToolReason: selectedToolRunnerState.selectedToolReason,
	};
}
