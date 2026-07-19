import type { ComponentProps } from 'react';

import { ApprovalsViewPage } from './components/ApprovalsViewPage';

type ApprovalsViewPageProps = ComponentProps<typeof ApprovalsViewPage>;

export function createPlatformApprovalsViewProps(
	props: ApprovalsViewPageProps,
): ApprovalsViewPageProps {
	return props;
}
