import type {
	EnterprisePlatformOpsTask,
	EnterprisePlatformOpsTaskResolveResponse,
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
