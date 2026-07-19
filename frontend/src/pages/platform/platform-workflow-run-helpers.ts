import type {
	EnterpriseWorkflowRunHistoryItem,
	EnterpriseWorkflowRunsResponse,
} from '@/api';

export type WorkflowRunLoadActionHandlers = {
	setLoading: (loading: boolean) => void;
	clearError: () => void;
	loadWorkflowRuns: (params: {
		limit?: number;
	}) => EnterpriseWorkflowRunsResponse | Promise<EnterpriseWorkflowRunsResponse>;
	setWorkflowRuns: (runs: EnterpriseWorkflowRunHistoryItem[]) => void;
	setError: (message: string) => void;
};

export async function runWorkflowRunLoadAction(
	values: {
		limit: number;
		loadErrorMessage: string;
	},
	handlers: WorkflowRunLoadActionHandlers,
) {
	handlers.setLoading(true);
	handlers.clearError();
	try {
		const response = await handlers.loadWorkflowRuns({ limit: values.limit });
		handlers.setWorkflowRuns(response.runs);
	} catch (error) {
		handlers.setError(
			error instanceof Error ? error.message : values.loadErrorMessage,
		);
	} finally {
		handlers.setLoading(false);
	}
}

export type PlatformWorkflowRunHandlerValues = {
	limit: number;
	loadErrorMessage: string;
};

export type PlatformWorkflowRunHandlerActions = WorkflowRunLoadActionHandlers;

export function createPlatformWorkflowRunHandlers(
	values: PlatformWorkflowRunHandlerValues,
	actions: PlatformWorkflowRunHandlerActions,
) {
	async function refetchWorkflowRuns() {
		await runWorkflowRunLoadAction(
			{
				limit: values.limit,
				loadErrorMessage: values.loadErrorMessage,
			},
			{
				setLoading: actions.setLoading,
				clearError: actions.clearError,
				loadWorkflowRuns: actions.loadWorkflowRuns,
				setWorkflowRuns: actions.setWorkflowRuns,
				setError: actions.setError,
			},
		);
	}

	return {
		refetchWorkflowRuns,
	};
}
