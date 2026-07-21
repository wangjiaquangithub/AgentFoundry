import type { EnterprisePlatformAgentsResponse } from '@/api';
import { normalizePlatformErrorMessage } from './platform-error-state';

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
		handlers.setError(normalizePlatformErrorMessage(error, loadErrorMessage));
	} finally {
		handlers.setLoading(false);
	}
}

export type PlatformAgentManagementHandlerValues = {
	loadErrorMessage: string;
};

export type PlatformAgentManagementHandlerActions = PlatformAgentLoadActionHandlers;

export function createPlatformAgentManagementHandlers(
	values: PlatformAgentManagementHandlerValues,
	actions: PlatformAgentManagementHandlerActions,
) {
	async function refetchPlatformAgents() {
		await runPlatformAgentLoadAction(values.loadErrorMessage, {
			setLoading: actions.setLoading,
			clearError: actions.clearError,
			loadPlatformAgents: actions.loadPlatformAgents,
			setPlatformAgents: actions.setPlatformAgents,
			setError: actions.setError,
		});
	}

	return {
		refetchPlatformAgents,
	};
}
