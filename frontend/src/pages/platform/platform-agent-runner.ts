import type {
	EnterpriseAgentRunRequest,
	EnterpriseAgentRunResponse,
	EnterprisePlatformScenario,
	EnterpriseToolRunRequest,
	EnterpriseWorkflowRunRequest,
	EnterpriseWorkflowTemplate,
} from '@/api';
import {
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

export function latestAgentRunResponse(
	agentConversations: AgentConversationMap,
	agentId: string,
): EnterpriseAgentRunResponse | null {
	return agentConversations[agentId]?.[0]?.response ?? null;
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
