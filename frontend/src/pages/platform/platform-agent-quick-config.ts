import type {
	EnterpriseAgentTemplate,
	EnterpriseAgentUpdateRequest,
	EnterprisePublishedAgent,
	KnowledgeBaseView,
} from '@/api';
import {
	availableKnowledgeBaseIds,
	type PublishFormPatch,
} from './platform-publish-form';

export type AgentQuickConfigurationPatch = PublishFormPatch &
	EnterpriseAgentUpdateRequest;
export type AgentDefaultModelBindTarget =
	| { type: 'navigate'; path: '/credential' }
	| {
			type: 'bind';
			agentId: string;
			patch: AgentQuickConfigurationPatch;
	  };
export type AgentKnowledgeBasesBindTarget =
	| { type: 'navigate'; path: '/knowledge' }
	| {
			type: 'bind';
			agentId: string;
			patch: AgentQuickConfigurationPatch;
	  };
export type AgentTemplateToolsBindTarget =
	| { type: 'error' }
	| {
			type: 'bind';
			agentId: string;
			patch: AgentQuickConfigurationPatch;
	  };
export type AgentCapabilityKey = 'memory' | 'workflow';
export type AgentCapabilityEnableTarget = {
	agentId: string;
	patch: AgentQuickConfigurationPatch;
};

export function agentQuickConfigurationSyncResult(values: {
	agentId: string;
	editingAgentId: string | null;
	patch: AgentQuickConfigurationPatch;
	selectedRunAgentId: string;
	updatedAgentId: string;
}): {
	publishFormPatch: AgentQuickConfigurationPatch | null;
	selectedRunAgentId: string | null;
} {
	return {
		selectedRunAgentId:
			values.selectedRunAgentId === values.agentId || !values.selectedRunAgentId
				? values.updatedAgentId
				: null,
		publishFormPatch:
			values.editingAgentId === values.agentId ? values.patch : null,
	};
}

export function agentDefaultModelPatch(
	modelConfigId: string,
): AgentQuickConfigurationPatch {
	return {
		model_config_id: modelConfigId,
	};
}

export function agentDefaultModelBindTarget(values: {
	agent: EnterprisePublishedAgent;
	modelConfigId?: string;
}): AgentDefaultModelBindTarget {
	return values.modelConfigId
		? {
				type: 'bind',
				agentId: values.agent.id,
				patch: agentDefaultModelPatch(values.modelConfigId),
			}
		: { type: 'navigate', path: '/credential' };
}

export function agentKnowledgeBasesPatch(
	knowledgeBaseIds: string[],
): AgentQuickConfigurationPatch {
	return {
		knowledge_base_ids: knowledgeBaseIds,
	};
}

export function agentKnowledgeBasesBindTarget(values: {
	agent: EnterprisePublishedAgent;
	knowledgeBases: KnowledgeBaseView[];
}): AgentKnowledgeBasesBindTarget {
	const knowledgeBaseIds = availableKnowledgeBaseIds(values.knowledgeBases);

	return knowledgeBaseIds.length > 0
		? {
				type: 'bind',
				agentId: values.agent.id,
				patch: agentKnowledgeBasesPatch(knowledgeBaseIds),
			}
		: { type: 'navigate', path: '/knowledge' };
}

export function agentTemplateToolsPatch(tools: string[]): AgentQuickConfigurationPatch {
	return {
		tools: [...tools],
	};
}

export function agentTemplateToolsForPublishedAgent(values: {
	agent: EnterprisePublishedAgent;
	templates: EnterpriseAgentTemplate[];
}): string[] | null {
	const template = values.templates.find(
		(item) => item.id === values.agent.template_id,
	);
	const tools = template?.tools ?? [];

	return tools.length > 0 ? tools : null;
}

export function agentTemplateToolsBindTarget(values: {
	agent: EnterprisePublishedAgent;
	templates: EnterpriseAgentTemplate[];
}): AgentTemplateToolsBindTarget {
	const tools = agentTemplateToolsForPublishedAgent(values);

	return tools
		? {
				type: 'bind',
				agentId: values.agent.id,
				patch: agentTemplateToolsPatch(tools),
			}
		: { type: 'error' };
}

export function agentCapabilityEnabledPatch(
	capability: AgentCapabilityKey,
): AgentQuickConfigurationPatch {
	return capability === 'memory'
		? { memory_enabled: true }
		: { workflow_enabled: true };
}

export function agentCapabilityEnableTarget(values: {
	agent: EnterprisePublishedAgent;
	capability: AgentCapabilityKey;
}): AgentCapabilityEnableTarget {
	return {
		agentId: values.agent.id,
		patch: agentCapabilityEnabledPatch(values.capability),
	};
}
