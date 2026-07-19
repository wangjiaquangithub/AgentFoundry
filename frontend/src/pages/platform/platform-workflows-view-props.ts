import type { ComponentProps } from 'react';

import { WorkflowsViewPage } from './components/WorkflowsViewPage';

type WorkflowsViewPageProps = ComponentProps<typeof WorkflowsViewPage>;

export function createPlatformWorkflowsViewProps(
	props: WorkflowsViewPageProps,
): WorkflowsViewPageProps {
	return props;
}
