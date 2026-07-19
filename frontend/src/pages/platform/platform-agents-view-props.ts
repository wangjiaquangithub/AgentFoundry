import type { ComponentProps } from 'react';

import { AgentsViewPage } from './components/AgentsViewPage';

type AgentsViewPageProps = ComponentProps<typeof AgentsViewPage>;

export function createPlatformAgentsViewProps(
	props: AgentsViewPageProps,
): AgentsViewPageProps {
	return props;
}
