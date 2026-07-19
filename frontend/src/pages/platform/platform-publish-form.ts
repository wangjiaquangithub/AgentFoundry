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
	| {
			type: 'publish';
			templateId: string;
			form: PublishFormState;
			payload: EnterpriseAgentPublishRequest;
	  };
export type PreparedTenantAgentTarget =
	| { type: 'current' }
	| {
			type: 'template';
			templateId: string;
			templateForm: PublishFormState;
	  };
export type StartPublishingTarget =
	| { type: 'scroll' }
	| { type: 'configure-template'; template: EnterpriseAgentTemplate };
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
export type AgentArchiveTarget =
	| { type: 'skip' }
	| { type: 'archive'; agentId: string };
export type AgentArchiveSyncTarget = {
	selectedRunAgentId: string | null;
	shouldClearRunResult: boolean;
	shouldClearEditingAgent: boolean;
};
type NavigationHandler = () => void;

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

export function preparedTenantAgentTarget(values: {
	defaultTemplate?: EnterpriseAgentTemplate | null;
	currentUserTenant?: string;
	credentials: CredentialView[];
	knowledgeBases: KnowledgeBaseView[];
}): PreparedTenantAgentTarget {
	if (!values.defaultTemplate) {
		return { type: 'current' };
	}

	return {
		type: 'template',
		templateId: values.defaultTemplate.id,
		templateForm: defaultPublishFormForTemplate({
			template: values.defaultTemplate,
			currentUserTenant: values.currentUserTenant,
			credentials: values.credentials,
			knowledgeBases: values.knowledgeBases,
		}),
	};
}

export function startPublishingTarget(values: {
	selectedTemplateId: string | null;
	templates: EnterpriseAgentTemplate[];
}): StartPublishingTarget {
	if (!values.selectedTemplateId && values.templates.length > 0) {
		return { type: 'configure-template', template: values.templates[0] };
	}

	return { type: 'scroll' };
}

export type StartPublishingTargetActionHandlers = {
	configureTemplate: (template: EnterpriseAgentTemplate) => void;
	scrollToAgentManagement: NavigationHandler;
};

export function runStartPublishingTargetAction(
	target: StartPublishingTarget,
	handlers: StartPublishingTargetActionHandlers,
) {
	if (target.type === 'configure-template') {
		handlers.configureTemplate(target.template);
	}

	handlers.scrollToAgentManagement();
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
	currentUserTenant?: string;
	credentials: CredentialView[];
	knowledgeBases: KnowledgeBaseView[];
}): QuickPublishTarget {
	if (values.credentialCount === 0) {
		return { type: 'navigate', path: '/credential' };
	}

	const template = values.selectedTemplate ?? values.defaultTemplate;

	if (!template) {
		return { type: 'start-publishing' };
	}

	const form = defaultPublishFormForTemplate({
		template,
		currentUserTenant: values.currentUserTenant,
		credentials: values.credentials,
		knowledgeBases: values.knowledgeBases,
	});

	return {
		type: 'publish',
		templateId: template.id,
		form,
		payload: agentPublishPayloadFromForm({
			templateId: template.id,
			form,
		}),
	};
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

export function agentArchiveTarget(
	agent: EnterprisePublishedAgent,
): AgentArchiveTarget {
	return agent.status === 'published'
		? { type: 'archive', agentId: agent.id }
		: { type: 'skip' };
}

export function agentArchiveSyncTarget(values: {
	agents: EnterprisePublishedAgent[];
	archivedAgentId: string;
	selectedRunAgentId: string;
	editingAgentId: string | null;
}): AgentArchiveSyncTarget {
	const shouldClearRunResult = values.selectedRunAgentId === values.archivedAgentId;

	return {
		selectedRunAgentId: shouldClearRunResult
			? nextPublishedAgentIdAfterArchive({
					agents: values.agents,
					archivedAgentId: values.archivedAgentId,
				})
			: null,
		shouldClearRunResult,
		shouldClearEditingAgent: values.editingAgentId === values.archivedAgentId,
	};
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

export type PreparedTenantAgentTargetActionHandlers = {
	clearEditingAgent: NavigationHandler;
	selectTemplate: (templateId: string) => void;
	setPublishForm: (
		updater: (current: PublishFormState) => PublishFormState,
	) => void;
	scrollToAgentManagement: NavigationHandler;
};

export function runPreparedTenantAgentTargetAction(
	target: PreparedTenantAgentTarget,
	values: {
		tenant: string;
	},
	handlers: PreparedTenantAgentTargetActionHandlers,
) {
	if (target.type === 'template') {
		handlers.clearEditingAgent();
		handlers.selectTemplate(target.templateId);
	}

	handlers.setPublishForm((current) =>
		publishFormForPreparedTenant({
			current,
			tenant: values.tenant,
			templateForm: target.type === 'template' ? target.templateForm : null,
		}),
	);
	handlers.scrollToAgentManagement();
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

export type AgentEditDraftActionHandlers = {
	selectTemplate: (templateId: string) => void;
	setEditingAgent: (agentId: string) => void;
	setPublishForm: (form: PublishFormState) => void;
};

export function runAgentEditDraftAction(
	draft: AgentEditDraft,
	handlers: AgentEditDraftActionHandlers,
) {
	handlers.selectTemplate(draft.templateId);
	handlers.setEditingAgent(draft.editingAgentId);
	handlers.setPublishForm(draft.form);
}

export function agentEditCancelTarget(
	selectedTemplate?: EnterpriseAgentTemplate | null,
): AgentEditCancelTarget {
	return selectedTemplate
		? { type: 'configure-template', template: selectedTemplate }
		: { type: 'clear' };
}

export type AgentEditCancelTargetActionHandlers = {
	clearEditingAgent: NavigationHandler;
	configureTemplate: (template: EnterpriseAgentTemplate) => void;
};

export function runAgentEditCancelTargetAction(
	target: AgentEditCancelTarget,
	handlers: AgentEditCancelTargetActionHandlers,
) {
	handlers.clearEditingAgent();
	if (target.type === 'configure-template') {
		handlers.configureTemplate(target.template);
	}
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
