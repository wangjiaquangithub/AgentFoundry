import { connectorOperationsStateForStatus } from './platform-utils';

export interface PlatformConnectorDisplayState {
	operationsState: ReturnType<typeof connectorOperationsStateForStatus>;
}

export function platformConnectorDisplayStateForStatus(
	values: Parameters<typeof connectorOperationsStateForStatus>[0],
): PlatformConnectorDisplayState {
	return {
		operationsState: connectorOperationsStateForStatus(values),
	};
}
