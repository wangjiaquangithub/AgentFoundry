import {
	agentRunnerStateForStatus,
	agentSetupStepsForStatus,
} from './platform-utils';

export function platformAgentSetupStepsDisplayStateForStatus(
	values: Parameters<typeof agentSetupStepsForStatus>[0],
	labels: Parameters<typeof agentSetupStepsForStatus>[1],
) {
	return agentSetupStepsForStatus(values, labels);
}

export interface PlatformAgentRunnerDisplayState {
	runnerState: ReturnType<typeof agentRunnerStateForStatus>;
}

export function platformAgentRunnerDisplayStateForStatus(
	values: Parameters<typeof agentRunnerStateForStatus>[0],
	labels: Parameters<typeof agentRunnerStateForStatus>[1],
): PlatformAgentRunnerDisplayState {
	return {
		runnerState: agentRunnerStateForStatus(values, labels),
	};
}
