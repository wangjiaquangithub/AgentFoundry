import type { EnterpriseAuditEvent, EnterpriseAuditQueryResponse } from '@/api';
import type { AuditFiltersState } from './platform-defaults';
import { normalizePlatformErrorMessage } from './platform-error-state';
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

export type PlatformAuditHandlerValues = {
	filters: AuditFiltersState;
	loadErrorMessage: string;
};

export type PlatformAuditHandlerActions = AuditEventLoadActionHandlers;

export function createPlatformAuditHandlers(
	values: PlatformAuditHandlerValues,
	actions: PlatformAuditHandlerActions,
) {
	async function refetchAuditEvents(
		overrides: Partial<AuditFiltersState> = {},
	) {
		await runAuditEventLoadAction(
			{
				filters: values.filters,
				overrides,
				loadErrorMessage: values.loadErrorMessage,
			},
			actions,
		);
	}

	return {
		refetchAuditEvents,
	};
}

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
			normalizePlatformErrorMessage(error, values.loadErrorMessage),
		);
	} finally {
		handlers.setLoading(false);
	}
}
