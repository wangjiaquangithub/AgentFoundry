import type {
	EnterpriseToolCatalogItem,
	EnterpriseToolDecision,
	EnterpriseToolPolicyUpdateRequest,
} from '@/api';
import type { ToolPolicyDraftValue } from './components/TenantGovernancePanel';

export function toolPolicyPayloadFromDraft(values: {
	tenant: string;
	userId: string;
	draft: Record<string, ToolPolicyDraftValue>;
}): EnterpriseToolPolicyUpdateRequest {
	return {
		tenant: values.tenant,
		user_id: values.userId,
		allow: Object.entries(values.draft)
			.filter(([, value]) => value === 'allow')
			.map(([name]) => name),
		deny: Object.entries(values.draft)
			.filter(([, value]) => value === 'deny')
			.map(([name]) => name),
	};
}

export function toolPolicyDraftFromDecisions(values: {
	tools: EnterpriseToolCatalogItem[];
	allowedTools: EnterpriseToolDecision[];
	deniedTools: EnterpriseToolDecision[];
}): Record<string, ToolPolicyDraftValue> {
	const allowed = new Set(values.allowedTools.map((decision) => decision.name));
	const denied = new Set(values.deniedTools.map((decision) => decision.name));
	const draft: Record<string, ToolPolicyDraftValue> = {};

	values.tools.forEach((tool) => {
		if (denied.has(tool.name)) {
			draft[tool.name] = 'deny';
		} else if (allowed.has(tool.name)) {
			draft[tool.name] = 'allow';
		} else {
			draft[tool.name] = 'inherit';
		}
	});

	return draft;
}
