import {
	platformWorkbenchConsoleItemsDisplayState,
	platformWorkbenchDisplayStateForStatus,
} from './platform-workbench-display';

type PlatformWorkbenchConsoleItemsDisplayOptions = Parameters<
	typeof platformWorkbenchConsoleItemsDisplayState
>[0];
type PlatformWorkbenchDisplayValues = Parameters<
	typeof platformWorkbenchDisplayStateForStatus
>[0];
type PlatformWorkbenchDisplayOptions = Parameters<
	typeof platformWorkbenchDisplayStateForStatus
>[1];

export function createPlatformWorkbenchPageState(values: {
	consoleItems: PlatformWorkbenchConsoleItemsDisplayOptions;
	workbench: PlatformWorkbenchDisplayValues;
	workbenchOptions: PlatformWorkbenchDisplayOptions;
}) {
	const workbenchDisplay = platformWorkbenchDisplayStateForStatus(
		values.workbench,
		values.workbenchOptions,
	);

	return {
		platformConsoleItems: platformWorkbenchConsoleItemsDisplayState(
			values.consoleItems,
		),
		workbenchActions: workbenchDisplay.actions,
		workbenchIndicators: workbenchDisplay.indicators,
		workbenchQuickActions: workbenchDisplay.quickActions,
		workbenchReadinessItems: workbenchDisplay.readinessItems,
		workbenchRiskItems: workbenchDisplay.riskItems,
	};
}
