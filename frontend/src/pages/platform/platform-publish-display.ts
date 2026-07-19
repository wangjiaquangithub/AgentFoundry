import {
	agentIsReady,
	agentReleasePipelineForStatus,
	publishAccessStateForStatus,
	publishDraftStateForStatus,
} from './platform-utils';

export function platformAgentReleasePipelineDisplayStateForStatus<TIcon>(
	values: Parameters<typeof agentReleasePipelineForStatus<TIcon>>[0],
	labels: Parameters<typeof agentReleasePipelineForStatus<TIcon>>[1],
	icons: Parameters<typeof agentReleasePipelineForStatus<TIcon>>[2],
) {
	return agentReleasePipelineForStatus(values, labels, icons);
}

export function platformAgentIsReadyForDisplay(
	agent: Parameters<typeof agentIsReady>[0],
) {
	return agentIsReady(agent);
}

export interface PlatformPublishDisplayState {
	accessState: ReturnType<typeof publishAccessStateForStatus>;
	draftState: ReturnType<typeof publishDraftStateForStatus>;
}

export function platformPublishDisplayStateForStatus(values: {
	access: Parameters<typeof publishAccessStateForStatus>[0];
	draft: Parameters<typeof publishDraftStateForStatus>[0];
	draftLabels: Parameters<typeof publishDraftStateForStatus>[1];
}): PlatformPublishDisplayState {
	return {
		accessState: publishAccessStateForStatus(values.access),
		draftState: publishDraftStateForStatus(values.draft, values.draftLabels),
	};
}
