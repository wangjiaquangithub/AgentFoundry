import type { EnterpriseToolCatalogResponse } from '@/api';

export type ToolCatalogLoadActionParams = {
	agentId: string | null;
	userId: string | null;
};

export type ToolCatalogLoadActionHandlers = {
	setLoading: (loading: boolean) => void;
	clearError: () => void;
	loadToolCatalog: (params: {
		agent_id?: string;
		user_id?: string;
	}) => EnterpriseToolCatalogResponse | Promise<EnterpriseToolCatalogResponse>;
	setToolCatalog: (catalog: EnterpriseToolCatalogResponse) => void;
	setError: (message: string) => void;
};

export async function runToolCatalogLoadAction(
	values: {
		loadErrorMessage: string;
		params: ToolCatalogLoadActionParams;
	},
	handlers: ToolCatalogLoadActionHandlers,
) {
	handlers.setLoading(true);
	handlers.clearError();
	try {
		const response = await handlers.loadToolCatalog({
			agent_id: values.params.agentId || undefined,
			user_id: values.params.userId || undefined,
		});
		handlers.setToolCatalog(response);
	} catch (error) {
		handlers.setError(
			error instanceof Error ? error.message : values.loadErrorMessage,
		);
	} finally {
		handlers.setLoading(false);
	}
}

export type PlatformToolCatalogHandlerValues = {
	loadErrorMessage: string;
	params: ToolCatalogLoadActionParams;
};

export type PlatformToolCatalogHandlerActions = {
	setLoading: (loading: boolean) => void;
	clearError: () => void;
	loadToolCatalog: (params: {
		agent_id?: string;
		user_id?: string;
	}) => EnterpriseToolCatalogResponse | Promise<EnterpriseToolCatalogResponse>;
	setToolCatalog: (catalog: EnterpriseToolCatalogResponse) => void;
	setError: (message: string) => void;
};

export function createPlatformToolCatalogHandlers(
	values: PlatformToolCatalogHandlerValues,
	actions: PlatformToolCatalogHandlerActions,
) {
	async function refetchToolCatalog() {
		await runToolCatalogLoadAction(
			{
				loadErrorMessage: values.loadErrorMessage,
				params: values.params,
			},
			{
				setLoading: actions.setLoading,
				clearError: actions.clearError,
				loadToolCatalog: actions.loadToolCatalog,
				setToolCatalog: actions.setToolCatalog,
				setError: actions.setError,
			},
		);
	}

	return {
		refetchToolCatalog,
	};
}
