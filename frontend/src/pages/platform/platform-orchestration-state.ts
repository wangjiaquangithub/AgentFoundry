import { platformOrchestrationDisplayStateForStatus } from './platform-orchestration-display';

type PlatformOrchestrationDisplayValues = Parameters<
	typeof platformOrchestrationDisplayStateForStatus
>[0];
type PlatformOrchestrationDisplayOptions = Parameters<
	typeof platformOrchestrationDisplayStateForStatus
>[1];

export function createPlatformOrchestrationPageState(values: {
	orchestration: PlatformOrchestrationDisplayValues;
	orchestrationOptions: PlatformOrchestrationDisplayOptions;
}) {
	const orchestrationDisplay = platformOrchestrationDisplayStateForStatus(
		values.orchestration,
		values.orchestrationOptions,
	);

	return {
		orchestrationPrimaryStep: orchestrationDisplay.primaryStep,
		orchestrationReadyCount: orchestrationDisplay.readyCount,
		orchestrationWorkbenchSteps: orchestrationDisplay.steps,
	};
}
