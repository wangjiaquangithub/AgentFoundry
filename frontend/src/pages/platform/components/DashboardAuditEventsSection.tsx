import type { ComponentProps } from 'react';

import { AuditEventsPanel } from './AuditEventsPanel';
import type { EnterprisePlatformStatusResponse } from '@/api';

type AuditEventsPanelProps = ComponentProps<typeof AuditEventsPanel>;

interface DashboardAuditEventsSectionProps
	extends Pick<
		AuditEventsPanelProps,
		| 'auditFilters'
		| 'activePlatformAgents'
		| 'availableToolItems'
		| 'username'
		| 'auditLoading'
		| 'auditError'
		| 'auditEvents'
		| 'auditStats'
		| 'summarizeAuditObject'
		| 't'
	> {
	platformStatus?: EnterprisePlatformStatusResponse | null;
	setAuditFilters: AuditEventsPanelProps['onAuditFiltersChange'];
	refetchAuditEvents: AuditEventsPanelProps['onRefetchAuditEvents'];
}

export function DashboardAuditEventsSection({
	t,
	auditFilters,
	activePlatformAgents,
	availableToolItems,
	platformStatus,
	username,
	auditLoading,
	auditError,
	auditEvents,
	auditStats,
	setAuditFilters,
	refetchAuditEvents,
	summarizeAuditObject,
}: DashboardAuditEventsSectionProps) {
	return (
		<AuditEventsPanel
			auditFilters={auditFilters}
			activePlatformAgents={activePlatformAgents}
			availableToolItems={availableToolItems}
			currentTenant={platformStatus?.current_user.tenant}
			currentUserId={platformStatus?.current_user.user_id}
			username={username}
			auditLoading={auditLoading}
			auditError={auditError}
			auditEvents={auditEvents}
			auditStats={auditStats}
			onAuditFiltersChange={setAuditFilters}
			onRefetchAuditEvents={refetchAuditEvents}
			summarizeAuditObject={summarizeAuditObject}
			t={t}
		/>
	);
}
