type PlatformTranslate = (key: string, options?: Record<string, unknown>) => string;

export const platformOverviewStatLabels = (t: PlatformTranslate) => ({
	label: (key: string) => t(`platform.stats.${key}`),
	helper: (key: string) => t(`platform.stats.${key}Helper`),
});

export const runtimeStatusLabels = (t: PlatformTranslate) => ({
	label: (key: string) => t(`platform.runtime.${key}`),
	unavailable: t('platform.runtime.unavailable'),
	enabled: t('platform.runtime.enabled'),
	disabled: t('platform.runtime.disabled'),
});

export const selectedToolRunnerLabels = (t: PlatformTranslate) => ({
	notConfiguredForAgent: t('platform.toolRunner.notConfiguredForAgent'),
});

export const agentRoutingLabels = (t: PlatformTranslate) => ({
	model: t('platform.agentRunner.routingModel'),
	rules: t('platform.agentRunner.routingRules'),
});
