import {
	agentRoutingDisplayStateForResult,
	agentRunnerStateForStatus,
	agentSetupStepsForStatus,
	nextAgentSetupStepForSteps,
} from './platform-utils';

export function platformAgentRoutingDisplayStateForResult(
	agentRunResult: Parameters<typeof agentRoutingDisplayStateForResult>[0],
	labels: Parameters<typeof agentRoutingDisplayStateForResult>[1],
) {
	return agentRoutingDisplayStateForResult(agentRunResult, labels);
}

export function platformAgentSetupStepsDisplayStateForStatus(
	values: Parameters<typeof agentSetupStepsForStatus>[0],
	labels: Parameters<typeof agentSetupStepsForStatus>[1],
) {
	return agentSetupStepsForStatus(values, labels);
}

export function platformNextAgentSetupStepDisplayStateForSteps(
	steps: Parameters<typeof nextAgentSetupStepForSteps>[0],
) {
	return nextAgentSetupStepForSteps(steps);
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
