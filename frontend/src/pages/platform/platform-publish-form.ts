import type {
	CredentialView,
	EnterpriseAgentUpdateRequest,
	EnterpriseAgentPublishRequest,
	EnterpriseAgentTemplate,
	EnterprisePublishedAgent,
	EnterprisePlatformMember,
	KnowledgeBaseView,
} from '@/api';
import type { PublishFormState } from './platform-defaults';
import { activePlatformMembersForTenant } from './platform-utils';

export type PublishListFormKey =
	| 'knowledge_base_ids'
	| 'tools'
	| 'allowed_user_ids'
	| 'allowed_roles';

export type PublishFormPatch = Partial<
	Pick<
		PublishFormState,
		| 'model_config_id'
		| 'knowledge_base_ids'
		| 'tools'
		| 'memory_enabled'
		| 'workflow_enabled'
	>
>;
export type AgentQuickConfigurationPatch = PublishFormPatch & EnterpriseAgentUpdateRequest;
export type AgentDefaultModelBindTarget =
	| { type: 'navigate'; path: '/credential' }
	| { type: 'bind'; modelConfigId: string };
export type AgentKnowledgeBasesBindTarget =
	| { type: 'navigate'; path: '/knowledge' }
	| { type: 'bind'; knowledgeBaseIds: string[] };
export type AgentTemplateToolsBindTarget =
	| { type: 'error' }
	| { type: 'bind'; tools: string[] };
export type AgentCapabilityKey = 'memory' | 'workflow';
export type AgentEditDraft = {
	templateId: string;
	editingAgentId: string;
	form: PublishFormState;
};
export type AgentEditCancelTarget =
	| { type: 'clear' }
	| { type: 'configure-template'; template: EnterpriseAgentTemplate };
export type QuickPublishTarget =
	| { type: 'navigate'; path: '/credential' }
	| { type: 'start-publishing' }
	| { type: 'publish'; template: EnterpriseAgentTemplate };
export type AgentPublishRequestTarget =
	| { type: 'skip' }
	| {
			type: 'update';
			agentId: string;
			publishingTemplateId: string;
			payload: EnterpriseAgentUpdateRequest;
	  }
	| {
			type: 'publish';
			publishingTemplateId: string;
			payload: EnterpriseAgentPublishRequest;
	  };

export type DefaultPublishFormOptions = {
	template: EnterpriseAgentTemplate;
	tenant: string;
	modelConfigId?: string;
	knowledgeBaseIds: string[];
};

export function createDefaultPublishForm({
	template,
	tenant,
	modelConfigId = '',
	knowledgeBaseIds,
}: DefaultPublishFormOptions): PublishFormState {
	return {
		name: template.name,
		description: template.description,
		tenant,
		model_config_id: modelConfigId,
		knowledge_base_ids: knowledgeBaseIds,
		tools: [...template.tools],
		allowed_user_ids: [],
		allowed_roles: [],
		memory_enabled: true,
		workflow_enabled: false,
	};
}

export function availableKnowledgeBaseIds(
	knowledgeBases: KnowledgeBaseView[],
): string[] {
	return knowledgeBases.map((knowledgeBase) => knowledgeBase.id);
}

export function defaultPublishFormForTemplate(values: {
	template: EnterpriseAgentTemplate;
	currentUserTenant?: string;
	credentials: CredentialView[];
	knowledgeBases: KnowledgeBaseView[];
}): PublishFormState {
	return createDefaultPublishForm({
		template: values.template,
		tenant: values.currentUserTenant ?? '',
		modelConfigId: values.credentials[0]?.id ?? '',
		knowledgeBaseIds: availableKnowledgeBaseIds(values.knowledgeBases),
	});
}

export function buildAgentConfigurationPayloadFromForm(
	form: PublishFormState,
): Omit<EnterpriseAgentPublishRequest, 'template_id'> {
	return {
		name: form.name.trim() || undefined,
		description: form.description.trim() || undefined,
		tenant: form.tenant.trim() || undefined,
		model_config_id: form.model_config_id || undefined,
		knowledge_base_ids: form.knowledge_base_ids,
		tools: form.tools,
		allowed_user_ids: form.allowed_user_ids,
		allowed_roles: form.allowed_roles,
		memory_enabled: form.memory_enabled,
		workflow_enabled: form.workflow_enabled,
	};
}

export function agentPublishPayloadFromForm(values: {
	templateId: string;
	form: PublishFormState;
}): EnterpriseAgentPublishRequest {
	return {
		template_id: values.templateId,
		...buildAgentConfigurationPayloadFromForm(values.form),
	};
}

export function agentPublishRequestTarget(values: {
	selectedTemplateId: string | null;
	editingAgentId: string | null;
	form: PublishFormState;
}): AgentPublishRequestTarget {
	if (!values.selectedTemplateId) {
		return { type: 'skip' };
	}

	const payload = buildAgentConfigurationPayloadFromForm(values.form);

	return values.editingAgentId
		? {
				type: 'update',
				agentId: values.editingAgentId,
				publishingTemplateId: values.selectedTemplateId,
				payload,
			}
		: {
				type: 'publish',
				publishingTemplateId: values.selectedTemplateId,
				payload: {
					template_id: values.selectedTemplateId,
					...payload,
				},
			};
}

export function publishedAgentPrimeTarget(
	agent: EnterprisePublishedAgent,
): string | null {
	return agent.status === 'published' ? agent.id : null;
}

export function quickPublishTarget(values: {
	credentialCount: number;
	selectedTemplate?: EnterpriseAgentTemplate | null;
	defaultTemplate?: EnterpriseAgentTemplate | null;
}): QuickPublishTarget {
	if (values.credentialCount === 0) {
		return { type: 'navigate', path: '/credential' };
	}

	const template = values.selectedTemplate ?? values.defaultTemplate;

	return template ? { type: 'publish', template } : { type: 'start-publishing' };
}

export function nextPublishedAgentIdAfterArchive(values: {
	agents: EnterprisePublishedAgent[];
	archivedAgentId: string;
}): string {
	return (
		values.agents.find(
			(agent) =>
				agent.status === 'published' && agent.id !== values.archivedAgentId,
		)?.id ?? ''
	);
}

export function publishFormForTenantChange(values: {
	current: PublishFormState;
	tenant: string;
	currentUserTenant?: string;
	members: EnterprisePlatformMember[];
}): PublishFormState {
	const nextTenant = values.tenant.trim() || values.currentUserTenant || 'default';
	const activeMembersForTenant = activePlatformMembersForTenant(values.members, nextTenant);
	const validUserIds = new Set(activeMembersForTenant.map((member) => member.user_id));
	const validRoles = new Set(
		activeMembersForTenant.map((member) => member.role).filter(Boolean),
	);

	return {
		...values.current,
		tenant: values.tenant,
		allowed_user_ids: values.current.allowed_user_ids.filter((userId) =>
			validUserIds.has(userId),
		),
		allowed_roles: values.current.allowed_roles.filter((role) => validRoles.has(role)),
	};
}

export function publishFormForPreparedTenant(values: {
	current: PublishFormState;
	tenant: string;
	templateForm?: PublishFormState | null;
}): PublishFormState {
	return {
		...(values.templateForm ?? values.current),
		tenant: values.tenant,
	};
}

export function publishFormFromPublishedAgent(
	agent: EnterprisePublishedAgent,
): PublishFormState {
	return {
		name: agent.name,
		description: agent.description,
		tenant: agent.tenant,
		model_config_id: agent.model_config_id ?? '',
		knowledge_base_ids: agent.knowledge_base_ids ?? [],
		tools: agent.tools ?? [],
		allowed_user_ids: agent.allowed_user_ids ?? [],
		allowed_roles: agent.allowed_roles ?? [],
		memory_enabled: agent.memory_enabled,
		workflow_enabled: agent.workflow_enabled,
	};
}

export function agentEditDraft(agent: EnterprisePublishedAgent): AgentEditDraft {
	return {
		templateId: agent.template_id,
		editingAgentId: agent.id,
		form: publishFormFromPublishedAgent(agent),
	};
}

export function agentEditCancelTarget(
	selectedTemplate?: EnterpriseAgentTemplate | null,
): AgentEditCancelTarget {
	return selectedTemplate
		? { type: 'configure-template', template: selectedTemplate }
		: { type: 'clear' };
}

export function publishFormForListToggle(values: {
	current: PublishFormState;
	key: PublishListFormKey;
	value: string;
	checked: boolean;
}): PublishFormState {
	const currentValues = values.current[values.key];
	const nextValues = values.checked
		? Array.from(new Set([...currentValues, values.value]))
		: currentValues.filter((item) => item !== values.value);

	return {
		...values.current,
		[values.key]: nextValues,
	};
}

export function publishFormWithPatch(
	current: PublishFormState,
	patch: PublishFormPatch,
): PublishFormState {
	return {
		...current,
		...patch,
	};
}

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
	modelConfigId?: string;
}): AgentDefaultModelBindTarget {
	return values.modelConfigId
		? { type: 'bind', modelConfigId: values.modelConfigId }
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
	knowledgeBases: KnowledgeBaseView[];
}): AgentKnowledgeBasesBindTarget {
	const knowledgeBaseIds = availableKnowledgeBaseIds(values.knowledgeBases);

	return knowledgeBaseIds.length > 0
		? { type: 'bind', knowledgeBaseIds }
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

	return tools ? { type: 'bind', tools } : { type: 'error' };
}

export function agentCapabilityEnabledPatch(
	capability: AgentCapabilityKey,
): AgentQuickConfigurationPatch {
	return capability === 'memory'
		? { memory_enabled: true }
		: { workflow_enabled: true };
}
