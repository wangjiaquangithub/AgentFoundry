import type {
	EnterprisePlatformOpsTask,
	EnterprisePlatformOpsTasksResponse,
	EnterprisePlatformOpsTaskResolveResponse,
	EnterpriseWorkflowTemplate,
} from '@/api';
import {
	runPlatformOperationAction,
	type PlatformOperationActionHandlers,
} from './platform-operation-actions';

export type OpsTaskActionTarget =
	| {
			type: 'resolve';
			code: string;
	  }
	| {
			type: 'operation';
			target?: string;
	  };

export function opsTaskActionTarget(
	task: EnterprisePlatformOpsTask,
): OpsTaskActionTarget {
	return task.action?.type === 'resolve'
		? {
				type: 'resolve',
				code: task.code,
			}
		: {
				type: 'operation',
				target: task.target,
			};
}

export function opsTaskResolvePatch(
	response: EnterprisePlatformOpsTaskResolveResponse,
) {
	return {
		workflows: response.workflows,
		tasks: response.ops_tasks.tasks,
		summary: response.ops_tasks.summary,
	};
}

export type OpsTaskResolveActionHandlers = {
	runOperationAction: (target?: string) => void;
	setResolvingOpsTaskCode: (code: string | null) => void;
	clearError: () => void;
	resolveOpsTask: (
		code: string,
	) => EnterprisePlatformOpsTaskResolveResponse | Promise<EnterprisePlatformOpsTaskResolveResponse>;
	setWorkflowTemplates: (workflows: EnterpriseWorkflowTemplate[]) => void;
	setOpsTasks: (tasks: EnterprisePlatformOpsTask[]) => void;
	setOpsTasksSummary: (summary: EnterprisePlatformOpsTasksResponse['summary']) => void;
	refreshDependentViews: () => void | Promise<void>;
	handleError: (error: unknown) => void;
};

export type OpsTaskLoadActionHandlers = {
	setLoading: (loading: boolean) => void;
	clearError: () => void;
	loadOpsTasks: () =>
		| EnterprisePlatformOpsTasksResponse
		| Promise<EnterprisePlatformOpsTasksResponse>;
	setOpsTasks: (tasks: EnterprisePlatformOpsTask[]) => void;
	setOpsTasksSummary: (summary: EnterprisePlatformOpsTasksResponse['summary']) => void;
	setError: (message: string) => void;
};

export type PlatformOpsTaskHandlerValues = {
	text: {
		loadError: string;
		resolveError: string;
	};
};

export type PlatformOpsTaskHandlerActions = PlatformOperationActionHandlers & {
	setOpsTasksLoading: (loading: boolean) => void;
	setResolvingOpsTaskCode: (code: string | null) => void;
	setOpsTasksError: (message: string | null) => void;
	loadOpsTasks: () =>
		| EnterprisePlatformOpsTasksResponse
		| Promise<EnterprisePlatformOpsTasksResponse>;
	resolveOpsTask: (
		code: string,
	) => EnterprisePlatformOpsTaskResolveResponse | Promise<EnterprisePlatformOpsTaskResolveResponse>;
	setWorkflowTemplates: (workflows: EnterpriseWorkflowTemplate[]) => void;
	setOpsTasks: (tasks: EnterprisePlatformOpsTask[]) => void;
	setOpsTasksSummary: (summary: EnterprisePlatformOpsTasksResponse['summary']) => void;
	refreshDependentViews: () => void | Promise<void>;
};

export async function runOpsTaskLoadAction(
	loadErrorMessage: string,
	handlers: OpsTaskLoadActionHandlers,
) {
	handlers.setLoading(true);
	handlers.clearError();
	try {
		const response = await handlers.loadOpsTasks();
		handlers.setOpsTasks(response.tasks);
		handlers.setOpsTasksSummary(response.summary);
	} catch (error) {
		handlers.setError(
			error instanceof Error ? error.message : loadErrorMessage,
		);
	} finally {
		handlers.setLoading(false);
	}
}

export function createPlatformOpsTaskHandlers(
	values: PlatformOpsTaskHandlerValues,
	actions: PlatformOpsTaskHandlerActions,
) {
	async function refetchOpsTasks() {
		await runOpsTaskLoadAction(
			values.text.loadError,
			{
				setLoading: actions.setOpsTasksLoading,
				clearError: () => actions.setOpsTasksError(null),
				loadOpsTasks: actions.loadOpsTasks,
				setOpsTasks: actions.setOpsTasks,
				setOpsTasksSummary: actions.setOpsTasksSummary,
				setError: actions.setOpsTasksError,
			},
		);
	}

	function handleOperationAction(target?: string) {
		runPlatformOperationAction(target, actions);
	}

	async function handleResolveOpsTask(task: EnterprisePlatformOpsTask) {
		await runOpsTaskResolveAction(task, {
			runOperationAction: handleOperationAction,
			setResolvingOpsTaskCode: actions.setResolvingOpsTaskCode,
			clearError: () => actions.setOpsTasksError(null),
			resolveOpsTask: actions.resolveOpsTask,
			setWorkflowTemplates: actions.setWorkflowTemplates,
			setOpsTasks: actions.setOpsTasks,
			setOpsTasksSummary: actions.setOpsTasksSummary,
			refreshDependentViews: actions.refreshDependentViews,
			handleError: (error) =>
				actions.setOpsTasksError(
					error instanceof Error ? error.message : values.text.resolveError,
				),
		});
	}

	return {
		refetchOpsTasks,
		handleOperationAction,
		handleResolveOpsTask,
	};
}

export async function runOpsTaskResolveAction(
	task: EnterprisePlatformOpsTask,
	handlers: OpsTaskResolveActionHandlers,
) {
	const actionTarget = opsTaskActionTarget(task);
	if (actionTarget.type === 'operation') {
		handlers.runOperationAction(actionTarget.target);
		return;
	}

	handlers.setResolvingOpsTaskCode(actionTarget.code);
	handlers.clearError();
	try {
		const response = await handlers.resolveOpsTask(actionTarget.code);
		const patch = opsTaskResolvePatch(response);
		if (patch.workflows) {
			handlers.setWorkflowTemplates(patch.workflows);
		}
		handlers.setOpsTasks(patch.tasks);
		handlers.setOpsTasksSummary(patch.summary);
		await handlers.refreshDependentViews();
	} catch (error) {
		handlers.handleError(error);
	} finally {
		handlers.setResolvingOpsTaskCode(null);
	}
}
