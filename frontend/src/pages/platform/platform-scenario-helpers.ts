import type {
	EnterprisePlatformScenario,
	EnterprisePlatformScenariosResponse,
} from '@/api';

export type ScenarioLoadActionHandlers = {
	setLoading: (loading: boolean) => void;
	clearError: () => void;
	loadScenarios: () =>
		| EnterprisePlatformScenariosResponse
		| Promise<EnterprisePlatformScenariosResponse>;
	setScenarios: (scenarios: EnterprisePlatformScenario[]) => void;
	setError: (message: string) => void;
};

export async function runScenarioLoadAction(
	loadErrorMessage: string,
	handlers: ScenarioLoadActionHandlers,
) {
	handlers.setLoading(true);
	handlers.clearError();
	try {
		const response = await handlers.loadScenarios();
		handlers.setScenarios(response.scenarios);
	} catch (error) {
		handlers.setError(
			error instanceof Error ? error.message : loadErrorMessage,
		);
	} finally {
		handlers.setLoading(false);
	}
}

export type PlatformScenarioHandlerValues = {
	loadErrorMessage: string;
};

export type PlatformScenarioHandlerActions = ScenarioLoadActionHandlers;

export function createPlatformScenarioHandlers(
	values: PlatformScenarioHandlerValues,
	actions: PlatformScenarioHandlerActions,
) {
	async function refetchScenarios() {
		await runScenarioLoadAction(values.loadErrorMessage, {
			setLoading: actions.setLoading,
			clearError: actions.clearError,
			loadScenarios: actions.loadScenarios,
			setScenarios: actions.setScenarios,
			setError: actions.setError,
		});
	}

	return {
		refetchScenarios,
	};
}
