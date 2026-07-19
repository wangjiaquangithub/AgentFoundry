import type {
	EnterpriseAgentRunRequest,
	EnterpriseAgentRunResponse,
	EnterpriseAgentRunHistoryItem,
	EnterpriseIdentity,
	EnterprisePublishedAgent,
	EnterprisePlatformScenario,
	EnterpriseToolRunRequest,
	EnterpriseToolRunResponse,
	EnterpriseWorkflowRunRequest,
	EnterpriseWorkflowRunResponse,
	EnterpriseWorkflowTemplate,
} from '@/api';
import type { MemoryOperationsItem } from './components/MemoryOperationsPanel';
import {
	agentAccessAllowed,
	approvalRequiredDetail,
	identityForTenant,
	identityForMemoryOperation,
	mapAgentRunToConversationTurn,
	normalizeWorkflowInputs,
	type EnterpriseAgentConversationTurn,
} from './platform-utils';

export type { EnterpriseAgentConversationTurn };

export type AgentConversationMap = Record<string, EnterpriseAgentConversationTurn[]>;
export type ClearAgentRunsParams = {
	agent_id?: string;
	tenant?: string;
	user_id?: string;
	session_id?: string;
};
export type ClearAgentConversationTarget =
	| { type: 'skip' }
	| {
			type: 'clear';
			agentId: string;
			userId: string;
			params: ClearAgentRunsParams;
	  };
export type AgentRunHistorySelectionTarget = {
	runId: string;
	question: string;
	result: EnterpriseAgentRunResponse;
};
type NavigationHandler = () => void;

export function platformAgentAccessAllowedForDisplay(
	agent: Parameters<typeof agentAccessAllowed>[0],
	identity?: Parameters<typeof agentAccessAllowed>[1],
) {
	return agentAccessAllowed(agent, identity);
}

export function agentConversationTurnFromRunResponse(values: {
	response: EnterpriseAgentRunResponse;
	agentId: string;
	question: string;
	createdAt: string;
	fallbackId: string;
}): EnterpriseAgentConversationTurn {
	return {
		id: values.response.turn_id || values.fallbackId,
		agentId: values.agentId,
		question: values.question,
		answer: values.response.answer,
		createdAt: values.createdAt,
		response: values.response,
	};
}

export function agentConversationTurnFromRunHistoryItem(
	run: EnterpriseAgentRunHistoryItem,
): EnterpriseAgentConversationTurn {
	return mapAgentRunToConversationTurn(run);
}

export function agentRunResponseRequiresApproval(
	response: EnterpriseAgentRunResponse,
): boolean {
	return Boolean(
		response.tool_calls?.some((toolCall) => toolCall.approval_required),
	);
}

export function latestAgentRunResponse(
	agentConversations: AgentConversationMap,
	agentId: string,
): EnterpriseAgentRunResponse | null {
	return agentConversations[agentId]?.[0]?.response ?? null;
}

export function agentRunSelectionResult(values: {
	agentConversations: AgentConversationMap;
	agentId: string;
}): EnterpriseAgentRunResponse | null {
	return latestAgentRunResponse(values.agentConversations, values.agentId);
}

export function publishedAgentRunnerTarget(values: {
	agentConversations: AgentConversationMap;
	agentId: string;
	currentQuestion: string;
	sampleQuestion: string;
}): {
	agentId: string;
	question: string;
	result: EnterpriseAgentRunResponse | null;
} {
	return {
		agentId: values.agentId,
		question: agentQuestionWithFallback(
			values.currentQuestion,
			values.sampleQuestion,
		),
		result: agentRunSelectionResult({
			agentConversations: values.agentConversations,
			agentId: values.agentId,
		}),
	};
}

export type PublishedAgentRunnerTargetActionHandlers = {
	selectRunAgent: (agentId: string) => void;
	setQuestion: (question: string) => void;
	setResult: (result: EnterpriseAgentRunResponse | null) => void;
	clearError: NavigationHandler;
	scrollToAgentRunner: NavigationHandler;
};

export function runPublishedAgentRunnerTargetAction(
	target: ReturnType<typeof publishedAgentRunnerTarget>,
	handlers: PublishedAgentRunnerTargetActionHandlers,
) {
	handlers.selectRunAgent(target.agentId);
	handlers.setQuestion(target.question);
	handlers.setResult(target.result);
	handlers.clearError();
	handlers.scrollToAgentRunner();
}

export function runPrimePublishedAgentAction(
	values: Parameters<typeof publishedAgentRunnerTarget>[0],
	handlers: PublishedAgentRunnerTargetActionHandlers,
) {
	const target = publishedAgentRunnerTarget(values);

	runPublishedAgentRunnerTargetAction(target, handlers);
}

export type AgentRunnerPrimeTargetActionHandlers = {
	setQuestion: (question: string) => void;
	clearError: NavigationHandler;
	scrollToAgentRunner: NavigationHandler;
};

export function runAgentRunnerPrimeTargetAction(
	sampleQuestion: string,
	handlers: AgentRunnerPrimeTargetActionHandlers,
) {
	handlers.setQuestion(sampleQuestion);
	handlers.clearError();
	handlers.scrollToAgentRunner();
}

export function selectedRunAgentTarget(values: {
	agentConversations: AgentConversationMap;
	agentId: string;
}): {
	agentId: string;
	result: EnterpriseAgentRunResponse | null;
} {
	return {
		agentId: values.agentId,
		result: agentRunSelectionResult(values),
	};
}

export type SelectedRunAgentTargetActionHandlers = {
	selectRunAgent: (agentId: string) => void;
	setResult: (result: EnterpriseAgentRunResponse | null) => void;
	clearError: NavigationHandler;
};

export function runSelectedRunAgentTargetAction(
	target: ReturnType<typeof selectedRunAgentTarget>,
	handlers: SelectedRunAgentTargetActionHandlers,
) {
	handlers.selectRunAgent(target.agentId);
	handlers.setResult(target.result);
	handlers.clearError();
}

export function runSelectAgentForRunAction(
	values: Parameters<typeof selectedRunAgentTarget>[0],
	handlers: SelectedRunAgentTargetActionHandlers,
) {
	const target = selectedRunAgentTarget(values);

	runSelectedRunAgentTargetAction(target, handlers);
}

export function identityAgentRunnerTarget(
	identity: EnterpriseIdentity,
	fallbackQuestion: string,
): {
	userId: string;
	question: string;
} {
	return {
		userId: identity.user_id,
		question: identity.sample_questions[0] ?? fallbackQuestion,
	};
}

export type IdentityAgentRunnerTargetActionHandlers = {
	selectIdentityUser: (userId: string) => void;
	setQuestion: (question: string) => void;
	clearError: NavigationHandler;
	scrollToAgentRunner: NavigationHandler;
};

export function runIdentityAgentRunnerTargetAction(
	target: ReturnType<typeof identityAgentRunnerTarget>,
	handlers: IdentityAgentRunnerTargetActionHandlers,
) {
	handlers.selectIdentityUser(target.userId);
	handlers.setQuestion(target.question);
	handlers.clearError();
	handlers.scrollToAgentRunner();
}

export function runUseIdentityAgentRunnerAction(
	identity: EnterpriseIdentity,
	fallbackQuestion: string,
	handlers: IdentityAgentRunnerTargetActionHandlers,
) {
	const target = identityAgentRunnerTarget(identity, fallbackQuestion);

	runIdentityAgentRunnerTargetAction(target, handlers);
}

export function tenantAgentRunnerTarget(values: {
	enterpriseIdentities: EnterpriseIdentity[];
	tenant: string;
	fallbackIdentity: EnterpriseIdentity | null;
}): {
	identity: EnterpriseIdentity | null;
} {
	return {
		identity: identityForTenant(values),
	};
}

export type TenantAgentRunnerTargetActionHandlers = {
	useIdentity: (identity: EnterpriseIdentity) => void;
	clearError: NavigationHandler;
	scrollToAgentRunner: NavigationHandler;
};

export function runTenantAgentRunnerTargetAction(
	target: ReturnType<typeof tenantAgentRunnerTarget>,
	handlers: TenantAgentRunnerTargetActionHandlers,
) {
	if (target.identity) {
		handlers.useIdentity(target.identity);
		return;
	}

	handlers.clearError();
	handlers.scrollToAgentRunner();
}

export function runUseTenantAgentRunnerAction(
	values: Parameters<typeof tenantAgentRunnerTarget>[0],
	handlers: TenantAgentRunnerTargetActionHandlers,
) {
	const target = tenantAgentRunnerTarget(values);

	runTenantAgentRunnerTargetAction(target, handlers);
}

export function memoryOperationAgentRunTarget(values: {
	enterpriseIdentities: EnterpriseIdentity[];
	item: MemoryOperationsItem;
	fallbackQuestion: string;
}): {
	identity: EnterpriseIdentity | null;
	agentId: string;
	result: EnterpriseAgentRunResponse;
	question: string;
} {
	return {
		identity: identityForMemoryOperation({
			enterpriseIdentities: values.enterpriseIdentities,
			item: values.item,
		}),
		agentId: values.item.agentId,
		result: values.item.latestResponse,
		question: values.item.latestQuestion || values.fallbackQuestion,
	};
}

export type MemoryOperationAgentRunTargetActionHandlers = {
	selectIdentityUser: (userId: string) => void;
	selectRunAgent: (agentId: string) => void;
	setResult: (result: EnterpriseAgentRunResponse) => void;
	setQuestion: (question: string) => void;
	clearError: NavigationHandler;
	scrollToAgentRunner: NavigationHandler;
};

export function runMemoryOperationAgentRunTargetAction(
	target: ReturnType<typeof memoryOperationAgentRunTarget>,
	handlers: MemoryOperationAgentRunTargetActionHandlers,
) {
	if (target.identity) {
		handlers.selectIdentityUser(target.identity.user_id);
	}

	handlers.selectRunAgent(target.agentId);
	handlers.setResult(target.result);
	handlers.setQuestion(target.question);
	handlers.clearError();
	handlers.scrollToAgentRunner();
}

export function runOpenMemoryOperationAgentAction(
	values: Parameters<typeof memoryOperationAgentRunTarget>[0],
	handlers: MemoryOperationAgentRunTargetActionHandlers,
) {
	const target = memoryOperationAgentRunTarget(values);

	runMemoryOperationAgentRunTargetAction(target, handlers);
}

export function agentRunHistorySelectionTarget(
	turn: EnterpriseAgentConversationTurn,
): AgentRunHistorySelectionTarget {
	return {
		runId: turn.id,
		question: turn.question,
		result: turn.response,
	};
}

export type AgentRunHistorySelectionActionHandlers = {
	setQuestion: (question: string) => void;
	clearRunError: NavigationHandler;
	clearRunsError: NavigationHandler;
	setResult: (result: EnterpriseAgentRunResponse) => void;
	setRunsLoading: (loading: boolean) => void;
};

export function runAgentRunHistorySelectionAction(
	target: AgentRunHistorySelectionTarget,
	handlers: AgentRunHistorySelectionActionHandlers,
) {
	handlers.setQuestion(target.question);
	handlers.clearRunError();
	handlers.clearRunsError();
	handlers.setResult(target.result);
	handlers.setRunsLoading(true);
}

export function runAgentRunHistorySelectionRequestAction(
	turn: EnterpriseAgentConversationTurn,
	handlers: AgentRunHistorySelectionActionHandlers,
): AgentRunHistorySelectionTarget {
	const target = agentRunHistorySelectionTarget(turn);
	runAgentRunHistorySelectionAction(target, handlers);
	return target;
}

export function agentRunResultForSelectedAgent(values: {
	current: EnterpriseAgentRunResponse | null;
	agentConversations: AgentConversationMap;
	agentId: string;
}): EnterpriseAgentRunResponse | null {
	if (values.current?.agent_id === values.agentId) {
		return values.current;
	}

	return latestAgentRunResponse(values.agentConversations, values.agentId);
}

export function selectedRunAgentIdForAvailableAgents(values: {
	currentAgentId: string;
	activeAgents: EnterprisePublishedAgent[];
	readyAgents: EnterprisePublishedAgent[];
}): string {
	if (values.activeAgents.length === 0) {
		return '';
	}

	if (
		values.currentAgentId &&
		values.activeAgents.some((agent) => agent.id === values.currentAgentId)
	) {
		return values.currentAgentId;
	}

	return (values.readyAgents[0] ?? values.activeAgents[0]).id;
}

export function agentQuestionWithFallback(
	currentQuestion: string,
	fallbackQuestion: string,
): string {
	return currentQuestion.trim() || fallbackQuestion;
}

export function replaceAgentConversationTurns(values: {
	agentConversations: AgentConversationMap;
	agentId: string;
	turns: EnterpriseAgentConversationTurn[];
}): AgentConversationMap {
	return {
		...values.agentConversations,
		[values.agentId]: values.turns,
	};
}

export function clearAgentConversationTurns(
	agentConversations: AgentConversationMap,
	agentId: string,
): AgentConversationMap {
	return replaceAgentConversationTurns({
		agentConversations,
		agentId,
		turns: [],
	});
}

export function agentRunResultAfterHistoryRefresh(values: {
	current: EnterpriseAgentRunResponse | null;
	agentId: string;
	turns: EnterpriseAgentConversationTurn[];
}): EnterpriseAgentRunResponse | null {
	if (
		values.current?.agent_id === values.agentId &&
		values.turns.some(
			(turn) => turn.response.turn_id === values.current?.turn_id,
		)
	) {
		return values.current;
	}

	return values.turns[0]?.response ?? null;
}

export function mergeAgentConversationTurn(
	agentConversations: AgentConversationMap,
	turn: EnterpriseAgentConversationTurn,
	limit?: number,
): AgentConversationMap {
	const existingTurns = agentConversations[turn.agentId] ?? [];
	const nextTurns = existingTurns.some((item) => item.id === turn.id)
		? existingTurns.map((item) => (item.id === turn.id ? turn : item))
		: [turn, ...existingTurns];

	return {
		...agentConversations,
		[turn.agentId]: typeof limit === 'number' ? nextTurns.slice(0, limit) : nextTurns,
	};
}

export type AgentRunHistoryDetailActionHandlers = {
	setAgentConversations: (
		updater: (current: AgentConversationMap) => AgentConversationMap,
	) => void;
	setResult: (result: EnterpriseAgentRunResponse) => void;
};

export function runAgentRunHistoryDetailAction(
	turn: EnterpriseAgentConversationTurn,
	handlers: AgentRunHistoryDetailActionHandlers,
) {
	handlers.setAgentConversations((current) =>
		mergeAgentConversationTurn(current, turn),
	);
	handlers.setResult(turn.response);
}

export function enterpriseAgentRunPayload(values: {
	agentId: string;
	question: string;
	userId: string;
	approvalId: string;
}): EnterpriseAgentRunRequest {
	return {
		agent_id: values.agentId,
		question: values.question,
		user_id: values.userId || undefined,
		approval_id: values.approvalId || undefined,
	};
}

export function runApprovalIdFromInput(
	optionApprovalId: string | undefined,
	formApprovalId: string,
): string {
	return optionApprovalId ?? formApprovalId.trim();
}

export function runQuestionFromInput(
	optionQuestion: string | undefined,
	formQuestion: string,
): string {
	return (optionQuestion ?? formQuestion).trim();
}

export function agentRunTargetForRequest(values: {
	agentId: string;
	selectedRunAgentId: string;
	activeAgents: EnterprisePublishedAgent[];
	selectedRunAgent: EnterprisePublishedAgent | null;
	userId: string;
	enterpriseIdentities: EnterpriseIdentity[];
	selectedIdentity: EnterpriseIdentity | null;
}): {
	targetAgent: EnterprisePublishedAgent | null;
	targetIdentity: EnterpriseIdentity | null;
	accessAllowed: boolean;
} {
	const targetAgent =
		values.activeAgents.find((agent) => agent.id === values.agentId) ??
		(values.agentId === values.selectedRunAgentId ? values.selectedRunAgent : null);
	const targetIdentity =
		values.enterpriseIdentities.find(
			(identity) => identity.user_id === values.userId,
		) ?? values.selectedIdentity;

	return {
		targetAgent,
		targetIdentity,
		accessAllowed: targetAgent ? agentAccessAllowed(targetAgent, targetIdentity) : true,
	};
}

export type AgentRunRequestTarget =
	| {
			type: 'empty';
	  }
	| {
			type: 'access-denied';
	  }
	| {
			type: 'run';
			agentId: string;
			question: string;
			userId: string;
			payload: EnterpriseAgentRunRequest;
	  };

export function agentRunRequestTarget(values: {
	options?: {
		agentId?: string;
		question?: string;
		userId?: string;
		approvalId?: string;
	};
	selectedRunAgentId: string;
	agentQuestion: string;
	selectedIdentityUserId: string;
	agentApprovalId: string;
	activeAgents: EnterprisePublishedAgent[];
	selectedRunAgent: EnterprisePublishedAgent | null;
	enterpriseIdentities: EnterpriseIdentity[];
	selectedIdentity: EnterpriseIdentity | null;
}): AgentRunRequestTarget {
	const agentId = values.options?.agentId ?? values.selectedRunAgentId;
	const question = runQuestionFromInput(
		values.options?.question,
		values.agentQuestion,
	);
	const userId = values.options?.userId ?? values.selectedIdentityUserId;
	const approvalId = runApprovalIdFromInput(
		values.options?.approvalId,
		values.agentApprovalId,
	);

	if (!question || !agentId) {
		return { type: 'empty' };
	}

	const { accessAllowed } = agentRunTargetForRequest({
		agentId,
		selectedRunAgentId: values.selectedRunAgentId,
		activeAgents: values.activeAgents,
		selectedRunAgent: values.selectedRunAgent,
		userId,
		enterpriseIdentities: values.enterpriseIdentities,
		selectedIdentity: values.selectedIdentity,
	});

	if (!accessAllowed) {
		return { type: 'access-denied' };
	}

	return {
		type: 'run',
		agentId,
		question,
		userId,
		payload: enterpriseAgentRunPayload({
			agentId,
			question,
			userId,
			approvalId,
		}),
	};
}

export type EnterpriseAgentRunActionHandlers = {
	setRunning: (running: boolean) => void;
	clearError: () => void;
	setAccessDeniedError: () => void;
	runAgent: (
		payload: EnterpriseAgentRunRequest,
	) => EnterpriseAgentRunResponse | Promise<EnterpriseAgentRunResponse>;
	setResult: (response: EnterpriseAgentRunResponse) => void;
	setAgentConversations: (
		updater: (current: AgentConversationMap) => AgentConversationMap,
	) => void;
	setApprovalRequiredError: () => void;
	refreshApprovals: () => void | Promise<void>;
	refreshAgentRuns: (agentId: string, userId: string) => void | Promise<void>;
	refreshDependentViews: () => void | Promise<void>;
	setError: (message: string) => void;
	now: () => string;
	fallbackId: (agentId: string) => string;
};

export async function runEnterpriseAgentAction(
	target: AgentRunRequestTarget,
	handlers: EnterpriseAgentRunActionHandlers,
) {
	if (target.type === 'empty') {
		return;
	}
	if (target.type === 'access-denied') {
		handlers.setAccessDeniedError();
		return;
	}

	handlers.setRunning(true);
	handlers.clearError();
	try {
		const response = await handlers.runAgent(target.payload);
		const turn = agentConversationTurnFromRunResponse({
			response,
			agentId: target.agentId,
			question: target.question,
			createdAt: handlers.now(),
			fallbackId: handlers.fallbackId(target.agentId),
		});
		handlers.setResult(response);
		handlers.setAgentConversations((current) =>
			mergeAgentConversationTurn(current, turn, 20),
		);
		if (agentRunResponseRequiresApproval(response)) {
			handlers.setApprovalRequiredError();
			await handlers.refreshApprovals();
		}
		await handlers.refreshAgentRuns(target.agentId, target.userId);
		await handlers.refreshDependentViews();
	} catch (error) {
		handlers.setError(error instanceof Error ? error.message : String(error));
	} finally {
		handlers.setRunning(false);
	}
}

export async function runEnterpriseAgentRequestAction(
	values: Parameters<typeof agentRunRequestTarget>[0],
	handlers: EnterpriseAgentRunActionHandlers,
) {
	const target = agentRunRequestTarget(values);
	await runEnterpriseAgentAction(target, handlers);
}

export function clearAgentRunsParams(values: {
	agentId: string;
	userId: string;
}): ClearAgentRunsParams {
	return {
		agent_id: values.agentId,
		user_id: values.userId || undefined,
	};
}

export function clearAgentConversationTarget(values: {
	selectedRunAgentId: string;
	selectedIdentityUserId: string;
	username: string;
}): ClearAgentConversationTarget {
	if (!values.selectedRunAgentId) {
		return { type: 'skip' };
	}

	const agentId = values.selectedRunAgentId;
	const userId = values.selectedIdentityUserId || values.username;

	return {
		type: 'clear',
		agentId,
		userId,
		params: clearAgentRunsParams({ agentId, userId }),
	};
}

export type ClearAgentConversationSuccessActionHandlers = {
	setAgentConversations: (
		updater: (current: AgentConversationMap) => AgentConversationMap,
	) => void;
	clearRunResult: NavigationHandler;
	clearRunError: NavigationHandler;
};

export function runClearAgentConversationSuccessAction(
	target: ClearAgentConversationTarget,
	handlers: ClearAgentConversationSuccessActionHandlers,
) {
	if (target.type === 'skip') {
		return;
	}

	handlers.setAgentConversations((current) =>
		clearAgentConversationTurns(current, target.agentId),
	);
	handlers.clearRunResult();
	handlers.clearRunError();
}

export type ClearAgentConversationRequestActionHandlers =
	ClearAgentConversationSuccessActionHandlers & {
		setRunsLoading: (loading: boolean) => void;
		clearRunsError: NavigationHandler;
		clearRuns: (params: ClearAgentRunsParams) => unknown | Promise<unknown>;
		setRunsError: (message: string) => void;
		historyClearErrorMessage: string;
	};

export async function runClearAgentConversationRequestAction(
	values: Parameters<typeof clearAgentConversationTarget>[0],
	handlers: ClearAgentConversationRequestActionHandlers,
) {
	const target = clearAgentConversationTarget(values);

	if (target.type === 'skip') {
		return;
	}

	handlers.setRunsLoading(true);
	handlers.clearRunsError();
	try {
		await handlers.clearRuns(target.params);
		runClearAgentConversationSuccessAction(target, handlers);
	} catch (error) {
		handlers.setRunsError(
			error instanceof Error ? error.message : handlers.historyClearErrorMessage,
		);
	} finally {
		handlers.setRunsLoading(false);
	}
}

export function selectedToolInputs(values: {
	inputKey: string;
	inputValue: string;
}): Record<string, unknown> | null {
	return values.inputKey ? { [values.inputKey]: values.inputValue } : null;
}

export function toolRunTargetForRequest(values: {
	options?: {
		toolName?: string;
		inputs?: Record<string, unknown>;
		userId?: string;
		agentId?: string;
		approvalId?: string;
	};
	selectedToolName: string;
	selectedToolInputKey: string;
	selectedToolInputValue: string;
	selectedIdentityUserId: string;
	selectedRunAgentId: string;
	toolApprovalId: string;
}): {
	toolName: string;
	inputs: Record<string, unknown> | null;
	userId: string;
	agentId: string;
	approvalId: string;
} {
	return {
		toolName: values.options?.toolName ?? values.selectedToolName,
		inputs:
			values.options?.inputs ??
			selectedToolInputs({
				inputKey: values.selectedToolInputKey,
				inputValue: values.selectedToolInputValue,
			}),
		userId: values.options?.userId ?? values.selectedIdentityUserId,
		agentId: values.options?.agentId ?? values.selectedRunAgentId,
		approvalId: runApprovalIdFromInput(
			values.options?.approvalId,
			values.toolApprovalId,
		),
	};
}

export function enterpriseToolRunPayload(values: {
	toolName: string;
	inputs: Record<string, unknown>;
	userId: string;
	agentId: string;
	approvalId: string;
}): EnterpriseToolRunRequest {
	return {
		tool_name: values.toolName,
		inputs: values.inputs,
		user_id: values.userId || undefined,
		agent_id: values.agentId || undefined,
		approval_id: values.approvalId || undefined,
	};
}

export type ToolRunRequestTarget =
	| {
			type: 'empty';
	  }
	| {
			type: 'run';
			payload: EnterpriseToolRunRequest;
	  };

export function toolRunRequestTarget(values: {
	options?: {
		toolName?: string;
		inputs?: Record<string, unknown>;
		userId?: string;
		agentId?: string;
		approvalId?: string;
	};
	selectedToolName: string;
	selectedToolInputKey: string;
	selectedToolInputValue: string;
	selectedIdentityUserId: string;
	selectedRunAgentId: string;
	toolApprovalId: string;
}): ToolRunRequestTarget {
	const target = toolRunTargetForRequest(values);

	if (!target.inputs) {
		return { type: 'empty' };
	}

	return {
		type: 'run',
		payload: enterpriseToolRunPayload({
			toolName: target.toolName,
			inputs: target.inputs,
			userId: target.userId,
			agentId: target.agentId,
			approvalId: target.approvalId,
		}),
	};
}

export type EnterpriseToolRunActionHandlers = {
	setRunning: (running: boolean) => void;
	clearError: () => void;
	runTool: (
		payload: EnterpriseToolRunRequest,
	) => EnterpriseToolRunResponse | Promise<EnterpriseToolRunResponse>;
	setResult: (response: EnterpriseToolRunResponse) => void;
	refreshDependentViews: () => void | Promise<void>;
	createApproval: (message: string) => boolean | Promise<boolean>;
	setApprovalRequiredError: () => void;
	setError: (message: string) => void;
};

export async function runEnterpriseToolAction(
	target: ToolRunRequestTarget,
	handlers: EnterpriseToolRunActionHandlers,
) {
	if (target.type === 'empty') {
		return;
	}

	handlers.setRunning(true);
	handlers.clearError();
	try {
		const response = await handlers.runTool(target.payload);
		handlers.setResult(response);
		await handlers.refreshDependentViews();
	} catch (error) {
		const approvalRequired = approvalRequiredDetail(error, 'tool_run');
		if (approvalRequired) {
			const created = await handlers.createApproval(approvalRequired.message);
			if (created) {
				handlers.setApprovalRequiredError();
			}
			return;
		}
		handlers.setError(error instanceof Error ? error.message : String(error));
	} finally {
		handlers.setRunning(false);
	}
}

export async function runEnterpriseToolRequestAction(
	values: Parameters<typeof toolRunRequestTarget>[0],
	handlers: EnterpriseToolRunActionHandlers,
) {
	const target = toolRunRequestTarget(values);
	await runEnterpriseToolAction(target, handlers);
}

export function enterpriseWorkflowRunPayload(values: {
	workflowType: string;
	inputs: Record<string, unknown>;
	userId: string;
	agentId: string;
	approvalId: string;
}): EnterpriseWorkflowRunRequest {
	return {
		workflow_type: values.workflowType,
		inputs: values.inputs,
		agent_id: values.agentId || undefined,
		user_id: values.userId || undefined,
		approval_id: values.approvalId || undefined,
	};
}

export function workflowRunTargetForRequest(values: {
	options?: {
		workflowType?: string;
		inputs?: Record<string, unknown>;
		userId?: string;
		agentId?: string;
		approvalId?: string;
	};
	selectedWorkflowType: string;
	workflowInputs: Record<string, string>;
	selectedIdentityUserId: string;
	selectedRunAgentId: string;
	workflowApprovalId: string;
}): {
	workflowType: string;
	inputs: Record<string, unknown>;
	userId: string;
	agentId: string;
	approvalId: string;
} {
	return {
		workflowType: values.options?.workflowType ?? values.selectedWorkflowType,
		inputs: values.options?.inputs ?? values.workflowInputs,
		userId: values.options?.userId ?? values.selectedIdentityUserId,
		agentId: values.options?.agentId ?? values.selectedRunAgentId,
		approvalId: runApprovalIdFromInput(
			values.options?.approvalId,
			values.workflowApprovalId,
		),
	};
}

export function workflowRunRequestTarget(values: {
	options?: {
		workflowType?: string;
		inputs?: Record<string, unknown>;
		userId?: string;
		agentId?: string;
		approvalId?: string;
	};
	selectedWorkflowType: string;
	workflowInputs: Record<string, string>;
	selectedIdentityUserId: string;
	selectedRunAgentId: string;
	workflowApprovalId: string;
}): EnterpriseWorkflowRunRequest {
	const target = workflowRunTargetForRequest(values);

	return enterpriseWorkflowRunPayload({
		workflowType: target.workflowType,
		inputs: target.inputs,
		agentId: target.agentId,
		userId: target.userId,
		approvalId: target.approvalId,
	});
}

export type EnterpriseWorkflowRunActionHandlers = {
	setRunning: (running: boolean) => void;
	clearError: () => void;
	runWorkflow: (
		payload: EnterpriseWorkflowRunRequest,
	) => EnterpriseWorkflowRunResponse | Promise<EnterpriseWorkflowRunResponse>;
	setResult: (response: EnterpriseWorkflowRunResponse) => void;
	refreshDependentViews: () => void | Promise<void>;
	createApproval: (message: string) => boolean | Promise<boolean>;
	setApprovalRequiredError: () => void;
	setError: (message: string) => void;
};

export async function runEnterpriseWorkflowAction(
	payload: EnterpriseWorkflowRunRequest,
	handlers: EnterpriseWorkflowRunActionHandlers,
) {
	handlers.setRunning(true);
	handlers.clearError();
	try {
		const response = await handlers.runWorkflow(payload);
		handlers.setResult(response);
		await handlers.refreshDependentViews();
	} catch (error) {
		const approvalRequired = approvalRequiredDetail(error, 'workflow_run');
		if (approvalRequired) {
			const created = await handlers.createApproval(approvalRequired.message);
			if (created) {
				handlers.setApprovalRequiredError();
			}
			return;
		}
		handlers.setError(error instanceof Error ? error.message : String(error));
	} finally {
		handlers.setRunning(false);
	}
}

export async function runEnterpriseWorkflowRequestAction(
	values: Parameters<typeof workflowRunRequestTarget>[0],
	handlers: EnterpriseWorkflowRunActionHandlers,
) {
	const payload = workflowRunRequestTarget(values);
	await runEnterpriseWorkflowAction(payload, handlers);
}

export function scenarioWorkflowRunTarget(values: {
	scenario: EnterprisePlatformScenario;
	workflowTemplates: EnterpriseWorkflowTemplate[];
	currentInputs: Record<string, unknown>;
}): {
	workflowType: string;
	inputs: Record<string, string>;
} {
	const template = values.workflowTemplates.find(
		(item) => item.workflow_type === values.scenario.workflow_type,
	);

	return {
		workflowType: values.scenario.workflow_type,
		inputs: normalizeWorkflowInputs(template?.default_inputs ?? values.currentInputs),
	};
}

export type ScenarioWorkflowRunActionHandlers = {
	setWorkflowType: (workflowType: string) => void;
	setWorkflowInputs: (inputs: Record<string, string>) => void;
	scheduleWorkflowRunnerFocus: () => void;
	runWorkflow: (target: {
		workflowType: string;
		inputs: Record<string, string>;
	}) => void | Promise<void>;
};

export async function runScenarioWorkflowAction(
	target: ReturnType<typeof scenarioWorkflowRunTarget>,
	handlers: ScenarioWorkflowRunActionHandlers,
) {
	handlers.setWorkflowType(target.workflowType);
	handlers.setWorkflowInputs(target.inputs);
	handlers.scheduleWorkflowRunnerFocus();
	await handlers.runWorkflow({
		workflowType: target.workflowType,
		inputs: target.inputs,
	});
}

export async function runScenarioWorkflowRequestAction(
	values: Parameters<typeof scenarioWorkflowRunTarget>[0],
	handlers: ScenarioWorkflowRunActionHandlers,
) {
	const target = scenarioWorkflowRunTarget(values);
	await runScenarioWorkflowAction(target, handlers);
}

export function agentWorkflowPrimeInputs(values: {
	selectedWorkflowTemplate: EnterpriseWorkflowTemplate | null;
	workflowOptions: Array<{
		value: string;
		defaultInputs?: Record<string, unknown>;
	}>;
	selectedWorkflowType: string;
}): Record<string, string> {
	const selectedDefaultInputs =
		values.selectedWorkflowTemplate?.default_inputs ??
		values.workflowOptions.find(
			(workflow) => workflow.value === values.selectedWorkflowType,
		)?.defaultInputs;

	return normalizeWorkflowInputs(selectedDefaultInputs);
}

export function agentWorkflowPrimeTarget(values: {
	agent: EnterprisePublishedAgent;
	selectedIdentityUserId: string;
	username: string;
	selectedWorkflowTemplate: EnterpriseWorkflowTemplate | null;
	workflowOptions: Array<{
		value: string;
		defaultInputs?: Record<string, unknown>;
	}>;
	selectedWorkflowType: string;
}): {
	agentId: string;
	userId: string;
	inputs: Record<string, string>;
} {
	return {
		agentId: values.agent.id,
		userId: values.selectedIdentityUserId || values.username,
		inputs: agentWorkflowPrimeInputs({
			selectedWorkflowTemplate: values.selectedWorkflowTemplate,
			workflowOptions: values.workflowOptions,
			selectedWorkflowType: values.selectedWorkflowType,
		}),
	};
}

export type AgentWorkflowPrimeTargetActionHandlers = {
	selectRunAgent: (agentId: string) => void;
	selectIdentityUser: (userId: string) => void;
	setWorkflowInputs: (inputs: Record<string, string>) => void;
	setWorkflowApprovalId: (approvalId: string) => void;
	clearWorkflowRunError: NavigationHandler;
	scrollToWorkflowRunner: NavigationHandler;
};

export function runAgentWorkflowPrimeTargetAction(
	target: ReturnType<typeof agentWorkflowPrimeTarget>,
	handlers: AgentWorkflowPrimeTargetActionHandlers,
) {
	handlers.selectRunAgent(target.agentId);
	handlers.selectIdentityUser(target.userId);
	handlers.setWorkflowInputs(target.inputs);
	handlers.setWorkflowApprovalId('');
	handlers.clearWorkflowRunError();
	handlers.scrollToWorkflowRunner();
}

export function runPrimeAgentWorkflowAction(
	values: Parameters<typeof agentWorkflowPrimeTarget>[0],
	handlers: AgentWorkflowPrimeTargetActionHandlers,
) {
	const target = agentWorkflowPrimeTarget(values);

	runAgentWorkflowPrimeTargetAction(target, handlers);
}

export function workflowInputsForSelectedOption(
	workflowOptions: Array<{
		value: string;
		defaultInputs?: Record<string, unknown>;
	}>,
	workflowType: string,
): Record<string, string> {
	const selectedWorkflow = workflowOptions.find(
		(workflow) => workflow.value === workflowType,
	);

	return normalizeWorkflowInputs(selectedWorkflow?.defaultInputs);
}

export function workflowTypeIsAvailable(
	workflowTemplates: EnterpriseWorkflowTemplate[],
	workflowType: string,
): boolean {
	return workflowTemplates.some(
		(template) => template.workflow_type === workflowType,
	);
}

export function workflowSelectionForAvailableTemplates(values: {
	workflowTemplates: EnterpriseWorkflowTemplate[];
	selectedWorkflowType: string;
}): {
	workflowType: string;
	inputs: Record<string, string>;
} | null {
	if (
		values.workflowTemplates.length === 0 ||
		workflowTypeIsAvailable(
			values.workflowTemplates,
			values.selectedWorkflowType,
		)
	) {
		return null;
	}

	const firstTemplate = values.workflowTemplates[0];

	return {
		workflowType: firstTemplate.workflow_type,
		inputs: normalizeWorkflowInputs(firstTemplate.default_inputs),
	};
}

export function workflowInputsWithValue(
	current: Record<string, string>,
	key: string,
	value: string,
): Record<string, string> {
	return {
		...current,
		[key]: value,
	};
}
