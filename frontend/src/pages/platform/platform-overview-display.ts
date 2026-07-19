import {
	platformOverviewStatsForSummary,
	runtimeStatusItemsForStatus,
} from './platform-utils';

export interface PlatformOverviewDisplayState {
	stats: ReturnType<typeof platformOverviewStatsForSummary>;
	runtimeItems: ReturnType<typeof runtimeStatusItemsForStatus>;
}

export function platformOverviewDisplayStateForStatus(values: {
	stats: Parameters<typeof platformOverviewStatsForSummary>[0];
	runtime: Parameters<typeof runtimeStatusItemsForStatus>[0];
	options: {
		stats: Parameters<typeof platformOverviewStatsForSummary>[1];
		runtime: Parameters<typeof runtimeStatusItemsForStatus>[1];
	};
}): PlatformOverviewDisplayState {
	return {
		stats: platformOverviewStatsForSummary(values.stats, values.options.stats),
		runtimeItems: runtimeStatusItemsForStatus(values.runtime, values.options.runtime),
	};
}
