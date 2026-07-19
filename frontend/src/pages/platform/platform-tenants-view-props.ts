import type { ComponentProps } from 'react';

import { TenantsViewPage } from './components/TenantsViewPage';

type TenantsViewPageProps = ComponentProps<typeof TenantsViewPage>;

export function createPlatformTenantsViewProps(
	props: TenantsViewPageProps,
): TenantsViewPageProps {
	return props;
}
