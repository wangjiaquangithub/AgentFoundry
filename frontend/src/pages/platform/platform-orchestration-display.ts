import type { OrchestrationWorkbenchStep } from './components/OrchestrationWorkbenchPanel';
import {
	orchestrationPrimaryStepForSteps,
	orchestrationWorkbenchStepsForStatus,
	readyOrchestrationWorkbenchStepCountForSteps,
} from './platform-utils';

export interface PlatformOrchestrationDisplayState {
	primaryStep: OrchestrationWorkbenchStep;
	readyCount: number;
	steps: OrchestrationWorkbenchStep[];
}

export function platformOrchestrationDisplayStateForStatus(
	values: Parameters<typeof orchestrationWorkbenchStepsForStatus>[0],
	options: Parameters<typeof orchestrationWorkbenchStepsForStatus>[1],
): PlatformOrchestrationDisplayState {
	const steps = orchestrationWorkbenchStepsForStatus(values, options);

	return {
		primaryStep: orchestrationPrimaryStepForSteps(steps),
		readyCount: readyOrchestrationWorkbenchStepCountForSteps(steps),
		steps,
	};
}
