import type {
	EnterpriseAgentTemplate,
	EnterpriseAgentUpdateRequest,
	EnterpriseAgentUpdateResponse,
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
export type AgentDefaultModelBindActionHandlers = {
	navigateToPath: (path: '/credential') => void;
	setBindingAgent: (agentId: string | null) => void;
	clearError: () => void;
	updateAgent: (
		agentId: string,
		patch: AgentQuickConfigurationPatch,
	) => EnterpriseAgentUpdateResponse | Promise<EnterpriseAgentUpdateResponse>;
	syncQuickConfiguration: (
		agentId: string,
		updatedAgentId: string,
		patch: AgentQuickConfigurationPatch,
	) => void;
	refreshDependentViews: () => void | Promise<void>;
	handleError: (error: unknown) => void;
};
export type AgentKnowledgeBasesBindActionHandlers = {
	navigateToPath: (path: '/knowledge') => void;
	setBindingAgent: (agentId: string | null) => void;
	clearError: () => void;
	updateAgent: (
		agentId: string,
		patch: AgentQuickConfigurationPatch,
	) => EnterpriseAgentUpdateResponse | Promise<EnterpriseAgentUpdateResponse>;
	syncQuickConfiguration: (
		agentId: string,
		updatedAgentId: string,
		patch: AgentQuickConfigurationPatch,
	) => void;
	refreshDependentViews: () => void | Promise<void>;
	handleError: (error: unknown) => void;
};
export type AgentTemplateToolsBindActionHandlers = {
	setBindingAgent: (agentId: string | null) => void;
	clearError: () => void;
	updateAgent: (
		agentId: string,
		patch: AgentQuickConfigurationPatch,
	) => EnterpriseAgentUpdateResponse | Promise<EnterpriseAgentUpdateResponse>;
	syncQuickConfiguration: (
		agentId: string,
		updatedAgentId: string,
		patch: AgentQuickConfigurationPatch,
	) => void;
	refreshDependentViews: () => void | Promise<void>;
	handleEmptyTemplateTools: () => void;
	handleError: (error: unknown) => void;
};
export type AgentCapabilityEnableActionHandlers = {
	setEnablingAgent: (agentId: string | null) => void;
	clearError: () => void;
	updateAgent: (
		agentId: string,
		patch: AgentQuickConfigurationPatch,
	) => EnterpriseAgentUpdateResponse | Promise<EnterpriseAgentUpdateResponse>;
	syncQuickConfiguration: (
		agentId: string,
		updatedAgentId: string,
		patch: AgentQuickConfigurationPatch,
	) => void;
	refreshDependentViews: () => void | Promise<void>;
	handleError: (error: unknown) => void;
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

export async function runAgentDefaultModelBindAction(
	target: AgentDefaultModelBindTarget,
	handlers: AgentDefaultModelBindActionHandlers,
) {
	if (target.type === 'navigate') {
		handlers.navigateToPath(target.path);
		return;
	}

	handlers.setBindingAgent(target.agentId);
	handlers.clearError();
	try {
		const response = await handlers.updateAgent(target.agentId, target.patch);
		handlers.syncQuickConfiguration(
			target.agentId,
			response.agent.id,
			target.patch,
		);
		await handlers.refreshDependentViews();
	} catch (error) {
		handlers.handleError(error);
	} finally {
		handlers.setBindingAgent(null);
	}
}

export async function runAgentDefaultModelBindRequestAction(
	values: Parameters<typeof agentDefaultModelBindTarget>[0],
	handlers: AgentDefaultModelBindActionHandlers,
) {
	const target = agentDefaultModelBindTarget(values);
	await runAgentDefaultModelBindAction(target, handlers);
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

export async function runAgentKnowledgeBasesBindAction(
	target: AgentKnowledgeBasesBindTarget,
	handlers: AgentKnowledgeBasesBindActionHandlers,
) {
	if (target.type === 'navigate') {
		handlers.navigateToPath(target.path);
		return;
	}

	handlers.setBindingAgent(target.agentId);
	handlers.clearError();
	try {
		const response = await handlers.updateAgent(target.agentId, target.patch);
		handlers.syncQuickConfiguration(
			target.agentId,
			response.agent.id,
			target.patch,
		);
		await handlers.refreshDependentViews();
	} catch (error) {
		handlers.handleError(error);
	} finally {
		handlers.setBindingAgent(null);
	}
}

export async function runAgentKnowledgeBasesBindRequestAction(
	values: Parameters<typeof agentKnowledgeBasesBindTarget>[0],
	handlers: AgentKnowledgeBasesBindActionHandlers,
) {
	const target = agentKnowledgeBasesBindTarget(values);
	await runAgentKnowledgeBasesBindAction(target, handlers);
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

export async function runAgentTemplateToolsBindAction(
	target: AgentTemplateToolsBindTarget,
	handlers: AgentTemplateToolsBindActionHandlers,
) {
	if (target.type === 'error') {
		handlers.handleEmptyTemplateTools();
		return;
	}

	handlers.setBindingAgent(target.agentId);
	handlers.clearError();
	try {
		const response = await handlers.updateAgent(target.agentId, target.patch);
		handlers.syncQuickConfiguration(
			target.agentId,
			response.agent.id,
			target.patch,
		);
		await handlers.refreshDependentViews();
	} catch (error) {
		handlers.handleError(error);
	} finally {
		handlers.setBindingAgent(null);
	}
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

export async function runAgentCapabilityEnableAction(
	target: AgentCapabilityEnableTarget,
	handlers: AgentCapabilityEnableActionHandlers,
) {
	handlers.setEnablingAgent(target.agentId);
	handlers.clearError();
	try {
		const response = await handlers.updateAgent(target.agentId, target.patch);
		handlers.syncQuickConfiguration(
			target.agentId,
			response.agent.id,
			target.patch,
		);
		await handlers.refreshDependentViews();
	} catch (error) {
		handlers.handleError(error);
	} finally {
		handlers.setEnablingAgent(null);
	}
}
