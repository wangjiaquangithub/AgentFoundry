import type { ComponentProps } from 'react';

import { RunsViewPage } from './components/RunsViewPage';

type RunsViewPageProps = ComponentProps<typeof RunsViewPage>;

export function createPlatformRunsViewProps(
	props: RunsViewPageProps,
): RunsViewPageProps {
	return props;
}
