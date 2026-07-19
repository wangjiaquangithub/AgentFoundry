import { platformAgentInventoryStateForStatus } from './platform-utils';

export interface PlatformAgentInventoryDisplayState {
	inventoryState: ReturnType<typeof platformAgentInventoryStateForStatus>;
}

export function platformAgentInventoryDisplayStateForStatus(
	values: Parameters<typeof platformAgentInventoryStateForStatus>[0],
): PlatformAgentInventoryDisplayState {
	return {
		inventoryState: platformAgentInventoryStateForStatus(values),
	};
}
