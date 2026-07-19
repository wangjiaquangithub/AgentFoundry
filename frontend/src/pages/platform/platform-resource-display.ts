import { platformResourceLookupStateForStatus } from './platform-utils';

export interface PlatformResourceDisplayState {
	lookupState: ReturnType<typeof platformResourceLookupStateForStatus>;
}

export function platformResourceDisplayStateForStatus(
	values: Parameters<typeof platformResourceLookupStateForStatus>[0],
): PlatformResourceDisplayState {
	return {
		lookupState: platformResourceLookupStateForStatus(values),
	};
}
