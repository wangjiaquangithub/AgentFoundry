import type { EnterprisePlatformGovernanceResponse } from '@/api';

export type GovernanceLoadActionHandlers = {
	setLoading: (loading: boolean) => void;
	clearError: () => void;
	loadGovernance: () =>
		| EnterprisePlatformGovernanceResponse
		| Promise<EnterprisePlatformGovernanceResponse>;
	setGovernance: (governance: EnterprisePlatformGovernanceResponse) => void;
	setError: (message: string) => void;
};

export async function runGovernanceLoadAction(
	loadErrorMessage: string,
	handlers: GovernanceLoadActionHandlers,
) {
	handlers.setLoading(true);
	handlers.clearError();
	try {
		const response = await handlers.loadGovernance();
		handlers.setGovernance(response);
	} catch (error) {
		handlers.setError(
			error instanceof Error ? error.message : loadErrorMessage,
		);
	} finally {
		handlers.setLoading(false);
	}
}
