// @ts-nocheck

import { PolicySubagentsPanel } from './PolicySubagentsPanel';

interface DashboardPolicySubagentsSectionProps {
	[key: string]: any;
}

export function DashboardPolicySubagentsSection({
	t,
	platformLoading,
	platformStatus,
	platformError,
	toolPolicyMode,
	policyDecisions,
	subagentTemplates,
}: DashboardPolicySubagentsSectionProps) {
	return (
		<PolicySubagentsPanel
			platformLoading={platformLoading}
			hasPlatformStatus={Boolean(platformStatus)}
			platformError={platformError}
			toolPolicyMode={toolPolicyMode}
			policyDecisions={policyDecisions}
			subagentTemplates={subagentTemplates}
			labels={{
				policyTitle: t('platform.policy.title'),
				policyDescription: t('platform.policy.description'),
				policyMode: t('platform.policy.mode'),
				policyError: t('platform.policy.error'),
				policyEmpty: t('platform.policy.empty'),
				policyAllowed: t('platform.policy.allowed'),
				policyDenied: t('platform.policy.denied'),
				subagentsTitle: t('platform.subagents.title'),
				subagentsDescription: t('platform.subagents.description'),
				subagentsError: t('platform.subagents.error'),
				subagentsEmpty: t('platform.subagents.empty'),
				subagentPermission: t('platform.subagents.permission'),
				subagentOverrideEnabled: t('platform.subagents.overrideEnabled'),
				subagentOverrideDisabled: t('platform.subagents.overrideDisabled'),
			}}
		/>
	);
}
