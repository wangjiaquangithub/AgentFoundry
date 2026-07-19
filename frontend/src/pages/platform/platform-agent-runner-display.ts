import { agentRunnerStateForStatus } from './platform-utils';

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
