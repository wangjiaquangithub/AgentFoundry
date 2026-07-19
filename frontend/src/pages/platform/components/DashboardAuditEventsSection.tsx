// @ts-nocheck

import { AuditEventsPanel } from './AuditEventsPanel';

interface DashboardAuditEventsSectionProps {
	[key: string]: any;
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
