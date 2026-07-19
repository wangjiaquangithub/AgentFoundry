import { platformRuntimeConfigStateForStatus } from './platform-utils';

export interface PlatformRuntimeDisplayState {
	configState: ReturnType<typeof platformRuntimeConfigStateForStatus>;
}

export function platformRuntimeDisplayStateForStatus(
	values: Parameters<typeof platformRuntimeConfigStateForStatus>[0],
): PlatformRuntimeDisplayState {
	return {
		configState: platformRuntimeConfigStateForStatus(values),
	};
}
