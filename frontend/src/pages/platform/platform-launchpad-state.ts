import {
	platformCapabilityItemsDisplayStateForStatus,
	platformLaunchpadDisplayStateForStatus,
} from './platform-launchpad-display';

type PlatformCapabilityItemsDisplayValues = Parameters<
	typeof platformCapabilityItemsDisplayStateForStatus
>[0];
type PlatformLaunchpadDisplayValues = Parameters<
	typeof platformLaunchpadDisplayStateForStatus
>[0];
type PlatformLaunchpadDisplayOptions = Parameters<
	typeof platformLaunchpadDisplayStateForStatus
>[1];

export function createPlatformLaunchpadPageState(values: {
	capabilities: PlatformCapabilityItemsDisplayValues;
	launchpad: PlatformLaunchpadDisplayValues;
	launchpadOptions: PlatformLaunchpadDisplayOptions;
}) {
	const launchpadDisplay = platformLaunchpadDisplayStateForStatus(
		values.launchpad,
		values.launchpadOptions,
	);

	return {
		capabilities: platformCapabilityItemsDisplayStateForStatus(values.capabilities),
		activeMemberCount: launchpadDisplay.activeMemberCount,
		launchpadPrimaryStep: launchpadDisplay.primaryStep,
		launchpadReadyCount: launchpadDisplay.readyCount,
		launchpadState: launchpadDisplay.state,
		launchpadSteps: launchpadDisplay.steps,
		launchpadTotalCount: launchpadDisplay.totalCount,
	};
}
