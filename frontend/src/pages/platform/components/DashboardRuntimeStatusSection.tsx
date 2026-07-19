// @ts-nocheck

import { RuntimeStatusPanel } from './RuntimeStatusPanel';

interface DashboardRuntimeStatusSectionProps {
	[key: string]: any;
}

export function DashboardRuntimeStatusSection({
	t,
	governanceRef,
	platformLoading,
	platformStatus,
	platformError,
	runtimeItems,
	refetchPlatform,
}: DashboardRuntimeStatusSectionProps) {
	return (
		<RuntimeStatusPanel
			governanceRef={governanceRef}
			platformLoading={platformLoading}
			hasPlatformStatus={Boolean(platformStatus)}
			platformError={platformError}
			runtimeItems={runtimeItems}
			onRefreshPlatform={refetchPlatform}
			labels={{
				title: t('platform.runtime.title'),
				description: t('platform.runtime.description'),
				refreshStatus: t('platform.actions.refreshStatus'),
				error: t('platform.runtime.error'),
			}}
		/>
	);
}
