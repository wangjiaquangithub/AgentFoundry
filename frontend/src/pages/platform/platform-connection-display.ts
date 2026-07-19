import { platformConnectionStateForStatus } from './platform-utils';

export interface PlatformConnectionDisplayState {
	connectionState: ReturnType<typeof platformConnectionStateForStatus>;
}

export function platformConnectionDisplayStateForStatus(
	values: Parameters<typeof platformConnectionStateForStatus>[0],
): PlatformConnectionDisplayState {
	return {
		connectionState: platformConnectionStateForStatus(values),
	};
}
