import type {
	EnterprisePlatformOpsTask,
	EnterprisePlatformOpsTasksResponse,
	EnterprisePlatformOpsTaskResolveResponse,
	EnterpriseWorkflowTemplate,
} from '@/api';

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
