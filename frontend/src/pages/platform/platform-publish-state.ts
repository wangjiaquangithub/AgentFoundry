import {
	platformAgentReleasePipelineDisplayStateForStatus,
	platformPublishDisplayStateForStatus,
} from './platform-publish-display';

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

export function createPlatformAgentReleasePipelinePageState<TIcon>(
	values: Parameters<typeof platformAgentReleasePipelineDisplayStateForStatus<TIcon>>[0],
	labels: Parameters<typeof platformAgentReleasePipelineDisplayStateForStatus<TIcon>>[1],
	icons: Parameters<typeof platformAgentReleasePipelineDisplayStateForStatus<TIcon>>[2],
) {
	return platformAgentReleasePipelineDisplayStateForStatus(values, labels, icons);
}
