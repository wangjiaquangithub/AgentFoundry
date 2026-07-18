import type { EnterpriseAgentRunResponse } from '@/api';
import type { EnterpriseAgentConversationTurn } from './platform-utils';

export type AgentConversationMap = Record<string, EnterpriseAgentConversationTurn[]>;

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
