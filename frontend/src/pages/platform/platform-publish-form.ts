import type {
	EnterpriseAgentPublishRequest,
	EnterpriseAgentTemplate,
} from '@/api';
import type { PublishFormState } from './platform-defaults';

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
