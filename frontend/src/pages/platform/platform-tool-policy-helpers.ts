import type { EnterpriseToolPolicyUpdateRequest } from '@/api';
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
