import type {
	EnterpriseApprovalCreateRequest,
	EnterpriseApprovalDecisionRequest,
	EnterpriseApprovalRequestItem,
	EnterpriseApprovalRequestType,
} from '@/api';
import type { ApprovalFiltersState, ApprovalFormState } from './platform-defaults';
import { normalizeWorkflowInputs } from './platform-utils';

export type PlatformApprovalRunType = Extract<
	EnterpriseApprovalRequestType,
	'tool_run' | 'workflow_run'
>;

export interface ApprovalCreateDefaults {
	selectedIdentityUserId: string;
	selectedRunAgentId: string;
	username: string;
}

export interface ApprovalDecisionLabels {
	approved: string;
	rejected: string;
}

export interface ApprovalToolInputDefaults {
	defaultInputValue: string;
	selectedIdentityUserId: string;
	username: string;
}

export interface ApprovalToolInputConfig {
	inputKey?: string;
	defaultValue?: string;
}

export interface ApprovalToolCatalogItem {
	name: string;
	input_key?: string;
	default_input?: string;
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

export function prependApprovalRequest(
	current: EnterpriseApprovalRequestItem[],
	approval?: EnterpriseApprovalRequestItem,
) {
	return approval ? [approval, ...current] : current;
}

export function replaceApprovalRequest(
	current: EnterpriseApprovalRequestItem[],
	nextApproval: EnterpriseApprovalRequestItem,
) {
	return current.map((approval) =>
		approval.approval_id === nextApproval.approval_id ? nextApproval : approval,
	);
}

export function approvalDecisionPayload(
	decision: 'approved' | 'rejected',
	options: { username: string; labels: ApprovalDecisionLabels },
): EnterpriseApprovalDecisionRequest {
	return {
		decided_by: options.username,
		decision_note:
			decision === 'approved' ? options.labels.approved : options.labels.rejected,
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

export function approvalAgentQuestionFromInputs(
	inputs: Record<string, unknown> | undefined,
	fallbackQuestion: string,
	options: { trimFallback?: boolean } = {},
) {
	const department = inputs?.department;

	return department != null
		? `帮我看一下 ${String(department)} 部门指标`
		: options.trimFallback
			? fallbackQuestion.trim()
			: fallbackQuestion;
}

export function approvalWorkflowContinuationTarget(approval: EnterpriseApprovalRequestItem) {
	return {
		workflowType: approval.workflow_type ?? '',
		inputs: normalizeWorkflowInputs(approval.inputs),
		userId: approval.user_id,
		agentId: approval.agent_id,
		approvalId: approval.approval_id,
	};
}

export function approvalToolInputsPatch(
	current: Record<string, string>,
	toolName: string,
	inputValue: unknown,
) {
	return {
		...current,
		[toolName]: inputValue == null ? '' : String(inputValue),
	};
}

export function approvalToolFormPatch(
	current: ApprovalFormState,
	options: {
		agentId: string;
		inputConfig?: ApprovalToolInputConfig;
		catalogItem?: ApprovalToolCatalogItem;
		reason: string;
		toolName: string;
		defaults: ApprovalToolInputDefaults;
	},
): ApprovalFormState {
	const inputKey =
		options.inputConfig?.inputKey ?? options.catalogItem?.input_key ?? 'input';
	const inputValue =
		options.inputConfig?.defaultValue ??
		options.catalogItem?.default_input ??
		options.defaults.defaultInputValue;

	return {
		...current,
		request_type: 'tool_run',
		tool_name: options.toolName,
		input_key: inputKey,
		input_value: inputValue,
		reason: options.reason,
		user_id:
			current.user_id ||
			options.defaults.selectedIdentityUserId ||
			options.defaults.username,
		agent_id: options.agentId,
	};
}
