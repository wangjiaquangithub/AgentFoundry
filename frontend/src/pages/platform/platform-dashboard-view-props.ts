import type { ComponentProps } from 'react';

import { DashboardViewPage } from './components/DashboardViewPage';

type DashboardViewPageProps = ComponentProps<typeof DashboardViewPage>;

type DashboardTenantAccessViewProps = Pick<
	DashboardViewPageProps,
	| 'accessControlStats'
	| 'accessTenantSummaries'
	| 'activeMemberCount'
	| 'identityAccessRows'
	| 'platformMemberTenantSummaries'
	| 'tenantOverviewItems'
	| 'tenantWorkspaces'
>;

export function createPlatformDashboardViewProps(
	props: DashboardViewPageProps,
): DashboardViewPageProps {
	return props;
}

export function createPlatformDashboardTenantAccessViewProps(
	props: DashboardTenantAccessViewProps,
): DashboardTenantAccessViewProps {
	return props;
}
