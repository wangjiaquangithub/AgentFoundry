import type {
	EnterpriseApprovalCreateRequest,
	EnterpriseApprovalDecisionRequest,
	EnterpriseApprovalDecisionResponse,
	EnterpriseApprovalRequestItem,
	EnterpriseApprovalRequestType,
	EnterpriseApprovalsResponse,
	EnterprisePublishedAgent,
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

export type ApprovalCreateActionHandlers = {
	setCreatingApproval: (creating: boolean) => void;
	clearApprovalError: () => void;
	createApproval: (
		payload: EnterpriseApprovalCreateRequest,
	) => EnterpriseApprovalsResponse | Promise<EnterpriseApprovalsResponse>;
	setApprovalRequests: (
		update: (
			current: EnterpriseApprovalRequestItem[],
		) => EnterpriseApprovalRequestItem[],
	) => void;
	refreshDependentViews: () => void | Promise<void>;
	resetApprovalReason: (
		update: (current: ApprovalFormState) => ApprovalFormState,
	) => void;
	handleError: (error: unknown) => void;
};

export type ApprovalRunCreateActionHandlers = {
	setCreatingRunApproval: (requestType: PlatformApprovalRunType | null) => void;
	clearApprovalError: () => void;
	createApproval: (
		payload: EnterpriseApprovalCreateRequest,
	) => EnterpriseApprovalsResponse | Promise<EnterpriseApprovalsResponse>;
	setApprovalRequests: (
		update: (
			current: EnterpriseApprovalRequestItem[],
		) => EnterpriseApprovalRequestItem[],
	) => void;
	clearRunError: (requestType: PlatformApprovalRunType) => void;
	refreshDependentViews: () => void | Promise<void>;
	scrollToGovernance: () => void;
	handleError: (
		requestType: PlatformApprovalRunType,
		error: unknown,
	) => void;
};

export type ApprovalDecisionActionHandlers = {
	setDecidingApprovalId: (approvalId: string | null) => void;
	clearApprovalError: () => void;
	approveApproval: (
		approvalId: string,
		payload: EnterpriseApprovalDecisionRequest,
	) =>
		| EnterpriseApprovalDecisionResponse
		| Promise<EnterpriseApprovalDecisionResponse>;
	rejectApproval: (
		approvalId: string,
		payload: EnterpriseApprovalDecisionRequest,
	) =>
		| EnterpriseApprovalDecisionResponse
		| Promise<EnterpriseApprovalDecisionResponse>;
	setApprovalRequests: (
		update: (
			current: EnterpriseApprovalRequestItem[],
		) => EnterpriseApprovalRequestItem[],
	) => void;
	refreshDependentViews: () => void | Promise<void>;
	handleError: (error: unknown) => void;
};

export type ApprovalApproveAndContinueActionHandlers = {
	setContinuingApprovalId: (approvalId: string | null) => void;
	clearApprovalError: () => void;
	approveApproval: (
		approvalId: string,
		payload: EnterpriseApprovalDecisionRequest,
	) =>
		| EnterpriseApprovalDecisionResponse
		| Promise<EnterpriseApprovalDecisionResponse>;
	setApprovalRequests: (
		update: (
			current: EnterpriseApprovalRequestItem[],
		) => EnterpriseApprovalRequestItem[],
	) => void;
	refreshDependentViews: () => void | Promise<void>;
	selectIdentityUser: (userId: string) => void;
	selectRunAgent: (agentId: string) => void;
	setAgentApprovalId: (approvalId: string) => void;
	setAgentQuestion: (question: string) => void;
	scrollToAgentRunner: NavigationHandler;
	runAgent: (options: {
		agentId?: string;
		question?: string;
		userId?: string;
		approvalId?: string;
	}) => void | Promise<void>;
	selectToolName: (toolName: string) => void;
	patchToolInputs: (
		updater: (current: Record<string, string>) => Record<string, string>,
	) => void;
	setToolApprovalId: (approvalId: string) => void;
	scrollToToolRunner: NavigationHandler;
	runTool: (options: {
		toolName?: string;
		inputs?: Record<string, unknown>;
		userId?: string;
		agentId?: string;
		approvalId?: string;
	}) => void | Promise<void>;
	selectWorkflowType: (workflowType: string) => void;
	setWorkflowInputs: (inputs: Record<string, string>) => void;
	setWorkflowApprovalId: (approvalId: string) => void;
	scrollToWorkflowRunner: NavigationHandler;
	runWorkflow: (options: {
		workflowType?: string;
		inputs?: Record<string, unknown>;
		userId?: string;
		agentId?: string;
		approvalId?: string;
	}) => void | Promise<void>;
	handleError: (error: unknown) => void;
};

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

export function approvalRunInputsFromSelection(
	requestType: PlatformApprovalRunType,
	options: {
		selectedToolInputKey: string;
		selectedToolInputValue: string;
		workflowInputs: Record<string, string>;
	},
): Record<string, unknown> | null {
	if (requestType === 'tool_run') {
		return options.selectedToolInputKey
			? { [options.selectedToolInputKey]: options.selectedToolInputValue }
			: null;
	}

	return options.workflowInputs;
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

export function approvalFormWithReasonReset(
	current: ApprovalFormState,
	defaultReason: string,
): ApprovalFormState {
	return {
		...current,
		reason: defaultReason,
	};
}

export async function runApprovalCreateAction(
	values: {
		form: ApprovalFormState;
		defaults: ApprovalCreateDefaults;
		defaultReason: string;
	},
	handlers: ApprovalCreateActionHandlers,
) {
	handlers.setCreatingApproval(true);
	handlers.clearApprovalError();
	try {
		const response = await handlers.createApproval(
			approvalCreatePayloadFromForm(values.form, values.defaults),
		);
		handlers.setApprovalRequests((current) =>
			prependApprovalRequest(current, response.approval),
		);
		await handlers.refreshDependentViews();
		handlers.resetApprovalReason((current) =>
			approvalFormWithReasonReset(current, values.defaultReason),
		);
	} catch (error) {
		handlers.handleError(error);
	} finally {
		handlers.setCreatingApproval(false);
	}
}

export async function runApprovalRunCreateAction(
	values: {
		requestType: PlatformApprovalRunType;
		reason?: string;
		runApprovalReason: string;
		selectedToolInputKey: string;
		selectedToolInputValue: string;
		workflowInputs: Record<string, string>;
		selectedIdentityUserId: string;
		selectedRunAgentId: string;
		selectedToolName: string;
		selectedWorkflowType: string;
		username: string;
	},
	handlers: ApprovalRunCreateActionHandlers,
): Promise<boolean> {
	const inputs = approvalRunInputsFromSelection(values.requestType, {
		selectedToolInputKey: values.selectedToolInputKey,
		selectedToolInputValue: values.selectedToolInputValue,
		workflowInputs: values.workflowInputs,
	});
	if (!inputs) {
		return false;
	}

	handlers.setCreatingRunApproval(values.requestType);
	handlers.clearApprovalError();
	try {
		const response = await handlers.createApproval(
			approvalCreatePayloadFromRun(values.requestType, {
				inputs,
				reason: values.reason || values.runApprovalReason,
				selectedIdentityUserId: values.selectedIdentityUserId,
				selectedRunAgentId: values.selectedRunAgentId,
				selectedToolName: values.selectedToolName,
				selectedWorkflowType: values.selectedWorkflowType,
				username: values.username,
			}),
		);
		handlers.setApprovalRequests((current) =>
			prependApprovalRequest(current, response.approval),
		);
		handlers.clearRunError(values.requestType);
		await handlers.refreshDependentViews();
		handlers.scrollToGovernance();
		return true;
	} catch (error) {
		handlers.handleError(values.requestType, error);
		return false;
	} finally {
		handlers.setCreatingRunApproval(null);
	}
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

export function approvalDecisionPayloadFromRequestText(
	decision: 'approved' | 'rejected',
	options: { username: string; text: ApprovalDecisionLabels },
): EnterpriseApprovalDecisionRequest {
	return approvalDecisionPayload(decision, {
		username: options.username,
		labels: options.text,
	});
}

export async function runApprovalDecisionAction(
	values: {
		approvalId: string;
		decision: 'approved' | 'rejected';
		username: string;
		text: ApprovalDecisionLabels;
	},
	handlers: ApprovalDecisionActionHandlers,
) {
	handlers.setDecidingApprovalId(values.approvalId);
	handlers.clearApprovalError();
	try {
		const request = approvalDecisionPayloadFromRequestText(values.decision, {
			username: values.username,
			text: values.text,
		});
		const response =
			values.decision === 'approved'
				? await handlers.approveApproval(values.approvalId, request)
				: await handlers.rejectApproval(values.approvalId, request);
		handlers.setApprovalRequests((current) =>
			replaceApprovalRequest(current, response.approval),
		);
		await handlers.refreshDependentViews();
	} catch (error) {
		handlers.handleError(error);
	} finally {
		handlers.setDecidingApprovalId(null);
	}
}

export async function runApprovalApproveAndContinueAction(
	values: {
		approval: EnterpriseApprovalRequestItem;
		agentQuestion: string;
		inputConfig?: ApprovalToolInputConfig;
		username: string;
		text: ApprovalDecisionLabels;
	},
	handlers: ApprovalApproveAndContinueActionHandlers,
) {
	const { approval } = values;
	const { canContinue, canContinueAgentRun, canContinueToolRun, canContinueWorkflowRun } =
		approvalContinuationState(approval);

	if (!canContinue) {
		return;
	}

	handlers.setContinuingApprovalId(approval.approval_id);
	handlers.clearApprovalError();
	try {
		const response = await handlers.approveApproval(
			approval.approval_id,
			approvalDecisionPayloadFromRequestText('approved', {
				username: values.username,
				text: values.text,
			}),
		);
		handlers.setApprovalRequests((current) =>
			replaceApprovalRequest(current, response.approval),
		);
		await handlers.refreshDependentViews();

		if (canContinueAgentRun && approval.tool_name) {
			const target = approvalAgentContinuationTarget(
				approval,
				values.agentQuestion,
			);

			handlers.selectIdentityUser(target.userId);
			handlers.selectRunAgent(target.agentId);
			handlers.setAgentApprovalId(target.approvalId);
			handlers.setAgentQuestion(target.question);
			handlers.scrollToAgentRunner();
			await handlers.runAgent(target);
			return;
		}

		if (canContinueToolRun && approval.tool_name) {
			const target = approvalToolContinuationTarget(
				approval,
				values.inputConfig,
			);

			handlers.selectIdentityUser(target.userId);
			handlers.selectRunAgent(target.agentId);
			handlers.selectToolName(target.toolName);
			handlers.patchToolInputs((current) =>
				approvalToolInputsPatch(current, target.toolName, target.inputValue),
			);
			handlers.setToolApprovalId(target.approvalId);
			handlers.scrollToToolRunner();
			await handlers.runTool(target);
			return;
		}

		if (canContinueWorkflowRun && approval.workflow_type) {
			const target = approvalWorkflowContinuationTarget(approval);

			handlers.selectIdentityUser(target.userId);
			handlers.selectRunAgent(target.agentId);
			handlers.selectWorkflowType(target.workflowType);
			handlers.setWorkflowInputs(target.inputs);
			handlers.setWorkflowApprovalId(target.approvalId);
			handlers.scrollToWorkflowRunner();
			await handlers.runWorkflow(target);
		}
	} catch (error) {
		handlers.handleError(error);
	} finally {
		handlers.setContinuingApprovalId(null);
	}
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

export type ApprovalUsageKind = 'agent_run' | 'tool_run' | 'workflow_run';
type NavigationHandler = () => void;
type StringStateValue = string | ((current: string) => string);

export function approvalUsageKind(
	approval: EnterpriseApprovalRequestItem,
): ApprovalUsageKind | null {
	if (approval.request_type === 'tool_run' && approval.tool_name) {
		return approval.agent_id && approval.agent_id !== 'platform-console'
			? 'agent_run'
			: 'tool_run';
	}

	if (approval.request_type === 'workflow_run' && approval.workflow_type) {
		return 'workflow_run';
	}

	return null;
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

export function approvalAgentContinuationTarget(
	approval: EnterpriseApprovalRequestItem,
	fallbackQuestion: string,
) {
	const question = approvalAgentQuestionFromInputs(
		approval.inputs,
		fallbackQuestion,
		{ trimFallback: true },
	);

	return {
		agentId: approval.agent_id,
		question,
		userId: approval.user_id,
		approvalId: approval.approval_id,
	};
}

export function approvalAgentUsageTarget(
	approval: EnterpriseApprovalRequestItem,
) {
	return {
		agentId: approval.agent_id,
		questionFromCurrent: (currentQuestion: string) =>
			approvalAgentQuestionFromInputs(approval.inputs, currentQuestion),
		approvalId: approval.approval_id,
	};
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

export function approvalToolContinuationTarget(
	approval: EnterpriseApprovalRequestItem,
	inputConfig?: ApprovalToolInputConfig,
) {
	const { inputValue } = approvalInputForTool(
		approval.inputs,
		inputConfig?.inputKey,
	);

	return {
		toolName: approval.tool_name ?? '',
		inputs: approval.inputs,
		inputValue,
		userId: approval.user_id,
		agentId: approval.agent_id,
		approvalId: approval.approval_id,
	};
}

export function approvalUsageTarget(
	approval: EnterpriseApprovalRequestItem,
	inputConfig?: ApprovalToolInputConfig,
) {
	const usageKind = approvalUsageKind(approval);

	if (usageKind === 'agent_run') {
		return {
			kind: usageKind,
			target: approvalAgentUsageTarget(approval),
		};
	}

	if (usageKind === 'tool_run') {
		return {
			kind: usageKind,
			target: approvalToolContinuationTarget(approval, inputConfig),
		};
	}

	if (usageKind === 'workflow_run') {
		return {
			kind: usageKind,
			target: approvalWorkflowContinuationTarget(approval),
		};
	}

	return null;
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

export function approvalToolCatalogItemForName(
	catalogItems: ApprovalToolCatalogItem[],
	toolName: string,
) {
	return catalogItems.find((tool) => tool.name === toolName);
}

export function primedToolApprovalFormPatch(
	current: ApprovalFormState,
	options: {
		agentId: string;
		inputConfig?: ApprovalToolInputConfig;
		catalogItems: ApprovalToolCatalogItem[];
		reason: string;
		toolName: string;
		defaults: ApprovalToolInputDefaults;
	},
): ApprovalFormState {
	return approvalToolFormPatch(current, {
		agentId: options.agentId,
		inputConfig: options.inputConfig,
		catalogItem: approvalToolCatalogItemForName(
			options.catalogItems,
			options.toolName,
		),
		toolName: options.toolName,
		reason: options.reason,
		defaults: options.defaults,
	});
}

export function toolApprovalPrimeTarget(values: {
	agent: EnterprisePublishedAgent;
	inputConfig?: ApprovalToolInputConfig;
	catalogItems: ApprovalToolCatalogItem[];
	reason: string;
	toolName: string;
	defaultInputValue: string;
	selectedIdentityUserId: string;
	username: string;
}): {
	userId: string;
	formPatch: Parameters<typeof primedToolApprovalFormPatch>[1];
} {
	return {
		userId: values.selectedIdentityUserId || values.username,
		formPatch: {
			agentId: values.agent.id,
			inputConfig: values.inputConfig,
			catalogItems: values.catalogItems,
			toolName: values.toolName,
			reason: values.reason,
			defaults: {
				defaultInputValue: values.defaultInputValue,
				selectedIdentityUserId: values.selectedIdentityUserId,
				username: values.username,
			},
		},
	};
}

export type ToolApprovalPrimeTargetActionHandlers = {
	selectIdentityUser: (userId: string) => void;
	patchApprovalForm: (
		updater: (current: ApprovalFormState) => ApprovalFormState,
	) => void;
	clearApprovalError: NavigationHandler;
	scrollToGovernance: NavigationHandler;
};

export function runToolApprovalPrimeTargetAction(
	target: ReturnType<typeof toolApprovalPrimeTarget>,
	handlers: ToolApprovalPrimeTargetActionHandlers,
) {
	handlers.selectIdentityUser(target.userId);
	handlers.patchApprovalForm((current) =>
		primedToolApprovalFormPatch(current, target.formPatch),
	);
	handlers.clearApprovalError();
	handlers.scrollToGovernance();
}

export function runPrimeToolApprovalAction(
	values: Parameters<typeof toolApprovalPrimeTarget>[0],
	handlers: ToolApprovalPrimeTargetActionHandlers,
) {
	const target = toolApprovalPrimeTarget(values);

	runToolApprovalPrimeTargetAction(target, handlers);
}

export type ApprovalUsageTargetActionHandlers = {
	selectIdentityUser: (userId: string) => void;
	selectRunAgent: (agentId: string) => void;
	setAgentApprovalId: (approvalId: string) => void;
	setAgentQuestion: (question: StringStateValue) => void;
	clearAgentRunError: NavigationHandler;
	scrollToAgentRunner: NavigationHandler;
	selectToolName: (toolName: string) => void;
	patchToolInputs: (
		updater: (current: Record<string, string>) => Record<string, string>,
	) => void;
	setToolApprovalId: (approvalId: string) => void;
	clearToolRunError: NavigationHandler;
	scrollToToolRunner: NavigationHandler;
	selectWorkflowType: (workflowType: string) => void;
	setWorkflowInputs: (inputs: Record<string, string>) => void;
	setWorkflowApprovalId: (approvalId: string) => void;
	clearWorkflowRunError: NavigationHandler;
	scrollToWorkflowRunner: NavigationHandler;
};

export function runApprovalUsageTargetAction(
	approval: EnterpriseApprovalRequestItem,
	inputConfig: ApprovalToolInputConfig | undefined,
	handlers: ApprovalUsageTargetActionHandlers,
) {
	const usageTarget = approvalUsageTarget(approval, inputConfig);

	handlers.selectIdentityUser(approval.user_id);

	if (usageTarget?.kind === 'agent_run') {
		const { target } = usageTarget;

		handlers.selectRunAgent(target.agentId);
		handlers.setAgentApprovalId(target.approvalId);
		handlers.setAgentQuestion(target.questionFromCurrent);
		handlers.clearAgentRunError();
		handlers.scrollToAgentRunner();
		return;
	}

	if (usageTarget?.kind === 'tool_run') {
		const { target } = usageTarget;

		handlers.selectToolName(target.toolName);
		handlers.patchToolInputs((current) =>
			approvalToolInputsPatch(current, target.toolName, target.inputValue),
		);
		handlers.setToolApprovalId(target.approvalId);
		handlers.clearToolRunError();
		handlers.scrollToToolRunner();
		return;
	}

	if (usageTarget?.kind === 'workflow_run') {
		const { target } = usageTarget;

		handlers.selectWorkflowType(target.workflowType);
		handlers.setWorkflowInputs(target.inputs);
		handlers.setWorkflowApprovalId(target.approvalId);
		handlers.clearWorkflowRunError();
		handlers.scrollToWorkflowRunner();
	}
}
