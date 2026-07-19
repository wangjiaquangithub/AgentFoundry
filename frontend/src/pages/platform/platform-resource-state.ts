import { platformResourceDisplayStateForStatus } from './platform-resource-display';

interface CreatePlatformResourcePageStateOptions {
	credentials: Parameters<typeof platformResourceDisplayStateForStatus>[0]['credentials'];
	knowledgeBases: Parameters<typeof platformResourceDisplayStateForStatus>[0]['knowledgeBases'];
}

export function createPlatformResourcePageState({
	credentials,
	knowledgeBases,
}: CreatePlatformResourcePageStateOptions) {
	const platformResourceDisplay = platformResourceDisplayStateForStatus({
		credentials,
		knowledgeBases,
	});
	const platformResourceLookupState = platformResourceDisplay.lookupState;

	return {
		credentialById: platformResourceLookupState.credentialById,
		knowledgeBaseById: platformResourceLookupState.knowledgeBaseById,
	};
}
