import type { EnterpriseAuditEvent, EnterpriseAuditQueryResponse } from '@/api';
import type { AuditFiltersState } from './platform-defaults';
import { auditQueryFromFilters } from './platform-filter-builders';

export type AuditEventLoadActionHandlers = {
	setLoading: (loading: boolean) => void;
	clearError: () => void;
	loadAuditEvents: (
		params: ReturnType<typeof auditQueryFromFilters>,
	) => EnterpriseAuditQueryResponse | Promise<EnterpriseAuditQueryResponse>;
	setAuditEvents: (events: EnterpriseAuditEvent[]) => void;
	setAuditSummary: (summary: EnterpriseAuditQueryResponse['summary']) => void;
	setError: (message: string) => void;
};

export async function runAuditEventLoadAction(
	values: {
		filters: AuditFiltersState;
		overrides: Partial<AuditFiltersState>;
		loadErrorMessage: string;
	},
	handlers: AuditEventLoadActionHandlers,
) {
	handlers.setLoading(true);
	handlers.clearError();
	try {
		const filters = { ...values.filters, ...values.overrides };
		const response = await handlers.loadAuditEvents(auditQueryFromFilters(filters));
		handlers.setAuditEvents(response.events);
		handlers.setAuditSummary(response.summary);
	} catch (error) {
		handlers.setError(
			error instanceof Error ? error.message : values.loadErrorMessage,
		);
	} finally {
		handlers.setLoading(false);
	}
}
