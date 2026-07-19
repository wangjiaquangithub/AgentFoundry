import {
	platformAgentRunnerDisplayStateForStatus,
	platformAgentSetupStepsDisplayStateForStatus,
	platformNextAgentSetupStepDisplayStateForSteps,
} from './platform-agent-runner-display';

type PlatformAgentSetupValues = Parameters<
	typeof platformAgentSetupStepsDisplayStateForStatus
>[0];
type PlatformAgentSetupLabels = Parameters<
	typeof platformAgentSetupStepsDisplayStateForStatus
>[1];
type PlatformAgentRunnerValues = Parameters<
	typeof platformAgentRunnerDisplayStateForStatus
>[0];
type PlatformAgentRunnerLabels = Parameters<
	typeof platformAgentRunnerDisplayStateForStatus
>[1];

export function createPlatformAgentRunnerPageState(values: {
	setup: PlatformAgentSetupValues;
	setupLabels: PlatformAgentSetupLabels;
	runner: PlatformAgentRunnerValues;
	runnerLabels: PlatformAgentRunnerLabels;
	sampleQuestions: string[];
}) {
	const agentSetupSteps = platformAgentSetupStepsDisplayStateForStatus(
		values.setup,
		values.setupLabels,
	);
	const nextAgentSetupStep =
		platformNextAgentSetupStepDisplayStateForSteps(agentSetupSteps);
	const primaryAgentSampleQuestion = values.sampleQuestions[0];
	const { runnerState } = platformAgentRunnerDisplayStateForStatus(
		values.runner,
		values.runnerLabels,
	);

	return {
		agentSetupSteps,
		nextAgentSetupStep,
		primaryAgentSampleQuestion,
		...runnerState,
	};
}
