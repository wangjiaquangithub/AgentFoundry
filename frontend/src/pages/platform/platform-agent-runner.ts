import type {
	EnterpriseAgentRunRequest,
	EnterpriseAgentRunResponse,
	EnterpriseIdentity,
	EnterprisePublishedAgent,
	EnterprisePlatformScenario,
	EnterpriseToolRunRequest,
	EnterpriseWorkflowRunRequest,
	EnterpriseWorkflowTemplate,
} from '@/api';
import type { MemoryOperationsItem } from './components/MemoryOperationsPanel';
import {
	agentAccessAllowed,
	identityForTenant,
	identityForMemoryOperation,
	normalizeWorkflowInputs,
	type EnterpriseAgentConversationTurn,
} from './platform-utils';

export type AgentConversationMap = Record<string, EnterpriseAgentConversationTurn[]>;
export type ClearAgentRunsParams = {
	agent_id?: string;
	tenant?: string;
	user_id?: string;
	session_id?: string;
};

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

export function clearAgentRunsParams(values: {
	agentId: string;
	userId: string;
}): ClearAgentRunsParams {
	return {
		agent_id: values.agentId,
		user_id: values.userId || undefined,
	};
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
