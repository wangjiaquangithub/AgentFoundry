import type { EnterprisePlatformAgentsResponse } from '@/api';

import type { AgentConversationMap } from './platform-agent-runner';
import { platformAgentInventoryDisplayStateForStatus } from './platform-agent-inventory-display';

interface CreatePlatformAgentInventoryPageStateOptions {
	agents: Parameters<typeof platformAgentInventoryDisplayStateForStatus>[0]['agents'];
	platformAgents: EnterprisePlatformAgentsResponse | null | undefined;
	selectedRunAgentId: string;
	lastPublishedAgentId: string;
	selectedTemplateId: string | null;
	agentConversations: AgentConversationMap;
}

export function createPlatformAgentInventoryPageState({
	agents,
	platformAgents,
	selectedRunAgentId,
	lastPublishedAgentId,
	selectedTemplateId,
	agentConversations,
}: CreatePlatformAgentInventoryPageStateOptions) {
	const agentTemplates = platformAgents?.templates ?? [];
	const publishedPlatformAgents = platformAgents?.agents ?? [];
	const platformAgentInventoryDisplay = platformAgentInventoryDisplayStateForStatus({
		agents,
		agentTemplates,
		publishedPlatformAgents,
		selectedRunAgentId,
		lastPublishedAgentId,
		selectedTemplateId,
	});
	const platformAgentInventoryState = platformAgentInventoryDisplay.inventoryState;

	return {
		agentTemplates,
		publishedPlatformAgents,
		featuredAgents: platformAgentInventoryState.featuredAgents,
		activePlatformAgents: platformAgentInventoryState.activePlatformAgents,
		archivedPlatformAgents: platformAgentInventoryState.archivedPlatformAgents,
		readyPlatformAgents: platformAgentInventoryState.readyPlatformAgents,
		selectedRunAgent: platformAgentInventoryState.selectedRunAgent,
		lastPublishedAgent: platformAgentInventoryState.lastPublishedAgent,
		selectedAgentConversation: agentConversations[selectedRunAgentId] ?? [],
		selectedTemplate: platformAgentInventoryState.selectedTemplate,
		defaultAgentTemplate: platformAgentInventoryState.defaultAgentTemplate,
	};
}
