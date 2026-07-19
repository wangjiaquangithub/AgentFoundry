import type { ComponentProps } from 'react';

import { DashboardViewPage } from './components/DashboardViewPage';

type DashboardViewPageProps = ComponentProps<typeof DashboardViewPage>;

export function createPlatformDashboardViewProps(
	props: DashboardViewPageProps,
): DashboardViewPageProps {
	return props;
}
