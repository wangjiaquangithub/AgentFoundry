import { platformRuntimeDisplayStateForStatus } from './platform-runtime-display';

type PlatformRuntimeDisplayValues = Parameters<typeof platformRuntimeDisplayStateForStatus>[0];

export function createPlatformRuntimePageState(values: PlatformRuntimeDisplayValues) {
	const platformRuntimeDisplay = platformRuntimeDisplayStateForStatus(values);
	const platformRuntimeConfigState = platformRuntimeDisplay.configState;

	return {
		enterpriseIdentities: platformRuntimeConfigState.enterpriseIdentities,
		subagentTemplates: platformRuntimeConfigState.subagentTemplates,
		toolPolicyMode: platformRuntimeConfigState.toolPolicyMode,
	};
}
