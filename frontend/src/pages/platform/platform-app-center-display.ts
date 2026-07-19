import {
	appCenterAgentDisplayStateForStatus,
	appCenterOperationsStateForStatus,
} from './platform-utils';

export interface PlatformAppCenterDisplayState {
	agentDisplayState: ReturnType<typeof appCenterAgentDisplayStateForStatus>;
	operationsState: ReturnType<typeof appCenterOperationsStateForStatus>;
}

export function platformAppCenterDisplayStateForStatus(values: {
	agentDisplay: Parameters<typeof appCenterAgentDisplayStateForStatus>[0];
	operations: Parameters<typeof appCenterOperationsStateForStatus>[0];
}): PlatformAppCenterDisplayState {
	return {
		agentDisplayState: appCenterAgentDisplayStateForStatus(values.agentDisplay),
		operationsState: appCenterOperationsStateForStatus(values.operations),
	};
}
