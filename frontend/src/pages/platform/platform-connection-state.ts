import { platformConnectionDisplayStateForStatus } from './platform-connection-display';

type PlatformConnectionDisplayValues = Parameters<typeof platformConnectionDisplayStateForStatus>[0];

export function createPlatformConnectionPageState(values: PlatformConnectionDisplayValues) {
	const platformConnectionDisplay = platformConnectionDisplayStateForStatus(values);
	const platformConnectionState = platformConnectionDisplay.connectionState;

	return {
		serverUrl: platformConnectionState.serverUrl,
		username: platformConnectionState.username,
	};
}
