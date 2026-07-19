import { platformSelectedIdentityDisplayStateForStatus } from './platform-governance-display';

type PlatformSelectedIdentityValues = Parameters<
	typeof platformSelectedIdentityDisplayStateForStatus
>[0];

export function createPlatformSelectedIdentityPageState(
	values: PlatformSelectedIdentityValues,
) {
	const selectedIdentityState = platformSelectedIdentityDisplayStateForStatus(values);

	return {
		selectedIdentity: selectedIdentityState.selectedIdentity,
		selectedRunAgentAccessAllowed: selectedIdentityState.selectedRunAgentAccessAllowed,
		selectedRunAgentAccessLabel: selectedIdentityState.selectedRunAgentAccessLabel,
		selectedIdentityAllowedTools: selectedIdentityState.selectedIdentityAllowedTools,
		selectedIdentityDeniedTools: selectedIdentityState.selectedIdentityDeniedTools,
		selectedIdentityWorkspace: selectedIdentityState.selectedIdentityWorkspace,
		currentIdentityLabel: selectedIdentityState.currentIdentityLabel,
	};
}
