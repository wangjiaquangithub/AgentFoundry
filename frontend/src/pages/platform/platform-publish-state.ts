import { platformPublishDisplayStateForStatus } from './platform-publish-display';

type PlatformPublishDisplayValues = Parameters<
	typeof platformPublishDisplayStateForStatus
>[0];

export function createPlatformPublishPageState(
	values: PlatformPublishDisplayValues,
) {
	const publishDisplay = platformPublishDisplayStateForStatus(values);

	return {
		...publishDisplay.accessState,
		...publishDisplay.draftState,
	};
}
