import { platformMonitoringDisplayStateForStatus } from './platform-monitoring-display';

type PlatformMonitoringDisplayValues = Parameters<
	typeof platformMonitoringDisplayStateForStatus
>[0];
type PlatformMonitoringDisplayOptions = Parameters<
	typeof platformMonitoringDisplayStateForStatus
>[1];

export function createPlatformMonitoringPageState(values: {
	monitoring: PlatformMonitoringDisplayValues;
	monitoringOptions: PlatformMonitoringDisplayOptions;
}) {
	const monitoringDisplay = platformMonitoringDisplayStateForStatus(
		values.monitoring,
		values.monitoringOptions,
	);

	return {
		monitoringActivitySummary: monitoringDisplay.activitySummary,
		monitoringLoading: monitoringDisplay.loading,
		monitoringStats: monitoringDisplay.stats,
	};
}
