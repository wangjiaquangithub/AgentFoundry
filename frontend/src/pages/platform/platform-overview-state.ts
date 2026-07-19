import { platformOverviewDisplayStateForStatus } from './platform-overview-display';

type PlatformOverviewDisplayValues = Parameters<typeof platformOverviewDisplayStateForStatus>[0];

export function createPlatformOverviewPageState(values: PlatformOverviewDisplayValues) {
	const overviewDisplay = platformOverviewDisplayStateForStatus(values);

	return {
		stats: overviewDisplay.stats,
		runtimeItems: overviewDisplay.runtimeItems,
	};
}
