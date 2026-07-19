import type { EnterprisePlatformAgentsResponse } from '@/api';

export type PlatformAgentLoadActionHandlers = {
	setLoading: (loading: boolean) => void;
	clearError: () => void;
	loadPlatformAgents: () =>
		| EnterprisePlatformAgentsResponse
		| Promise<EnterprisePlatformAgentsResponse>;
	setPlatformAgents: (response: EnterprisePlatformAgentsResponse) => void;
	setError: (message: string) => void;
};

export async function runPlatformAgentLoadAction(
	loadErrorMessage: string,
	handlers: PlatformAgentLoadActionHandlers,
) {
	handlers.setLoading(true);
	handlers.clearError();
	try {
		const response = await handlers.loadPlatformAgents();
		handlers.setPlatformAgents(response);
	} catch (error) {
		handlers.setError(error instanceof Error ? error.message : loadErrorMessage);
	} finally {
		handlers.setLoading(false);
	}
}
