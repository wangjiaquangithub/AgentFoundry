import type {
	EnterpriseApprovalCreateRequest,
	EnterpriseApprovalRequestItem,
	EnterpriseApprovalRequestType,
} from '@/api';
import type { ApprovalFiltersState, ApprovalFormState } from './platform-defaults';

export type PlatformApprovalRunType = Extract<
	EnterpriseApprovalRequestType,
	'tool_run' | 'workflow_run'
>;

export interface ApprovalCreateDefaults {
	selectedIdentityUserId: string;
	selectedRunAgentId: string;
	username: string;
}

export function approvalQueryFromFilters(filters: ApprovalFiltersState) {
	const limitValue = Number.parseInt(filters.limit, 10);

	return {
		status: filters.status || undefined,
		tenant: filters.tenant || undefined,
		user_id: filters.user_id || undefined,
		agent_id: filters.agent_id || undefined,
		limit: Number.isFinite(limitValue) ? limitValue : 20,
	};
}

export function approvalCreatePayloadFromForm(
	form: ApprovalFormState,
	defaults: ApprovalCreateDefaults,
): EnterpriseApprovalCreateRequest {
	const inputKey = form.input_key.trim();
	const inputValue = form.input_value.trim();

	return {
		request_type: form.request_type,
		tool_name: form.request_type === 'tool_run' ? form.tool_name.trim() : undefined,
		workflow_type:
			form.request_type === 'workflow_run' ? form.workflow_type.trim() : undefined,
		inputs: inputKey ? { [inputKey]: inputValue } : {},
		reason: form.reason.trim() || undefined,
		user_id:
			form.user_id.trim() ||
			defaults.selectedIdentityUserId ||
			defaults.username ||
			undefined,
		agent_id: form.agent_id.trim() || defaults.selectedRunAgentId || undefined,
	};
}

export function approvalCreatePayloadFromRun(
	requestType: PlatformApprovalRunType,
	options: {
		inputs: Record<string, unknown>;
		reason: string;
		selectedIdentityUserId: string;
		selectedRunAgentId: string;
		selectedToolName: string;
		selectedWorkflowType: string;
		username: string;
	},
): EnterpriseApprovalCreateRequest {
	return {
		request_type: requestType,
		tool_name: requestType === 'tool_run' ? options.selectedToolName : undefined,
		workflow_type:
			requestType === 'workflow_run' ? options.selectedWorkflowType : undefined,
		inputs: options.inputs,
		reason: options.reason,
		user_id: options.selectedIdentityUserId || options.username || undefined,
		agent_id: options.selectedRunAgentId || undefined,
	};
}

export function approvalContinuationState(approval: EnterpriseApprovalRequestItem) {
	const canContinueAgentRun =
		approval.request_type === 'tool_run' &&
		Boolean(approval.tool_name) &&
		Boolean(approval.agent_id) &&
		approval.agent_id !== 'platform-console';
	const canContinueToolRun =
		approval.request_type === 'tool_run' && Boolean(approval.tool_name);
	const canContinueWorkflowRun =
		approval.request_type === 'workflow_run' && Boolean(approval.workflow_type);

	return {
		canContinueAgentRun,
		canContinueToolRun,
		canContinueWorkflowRun,
		canContinue: canContinueToolRun || canContinueWorkflowRun,
	};
}

export function approvalInputForTool(
	inputs: Record<string, unknown> | undefined,
	inputKey?: string,
) {
	const inputEntries = Object.entries(inputs ?? {});
	const resolvedInputKey = inputKey ?? inputEntries[0]?.[0];
	const inputValue =
		resolvedInputKey && inputs?.[resolvedInputKey] != null
			? inputs[resolvedInputKey]
			: inputEntries[0]?.[1];

	return {
		inputKey: resolvedInputKey,
		inputValue,
	};
}
