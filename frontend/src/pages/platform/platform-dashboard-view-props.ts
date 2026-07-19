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

type DashboardAgentRunnerViewProps = Pick<
	DashboardViewPageProps,
	| 'agentAccessAllowed'
	| 'agentApprovalId'
	| 'agentQuestion'
	| 'agentRunConnectorSourceText'
	| 'agentRunError'
	| 'agentRunKnowledgeLabels'
	| 'agentRunModelLabel'
	| 'agentRunResult'
	| 'agentRunnerRef'
	| 'agentToolCallBadgeText'
	| 'agentToolCalls'
	| 'handleApproveAndRun'
	| 'handleClearAgentConversation'
	| 'handleInspectAgentRunAudit'
	| 'handleRunEnterpriseAgent'
	| 'handleSelectAgentRun'
	| 'refetchAgentRuns'
	| 'runningAgent'
	| 'selectedAgentConversation'
	| 'setAgentApprovalId'
	| 'setAgentQuestion'
	| 'setAgentRunError'
	| 'setAgentRunResult'
>;

export function createPlatformDashboardViewProps(
	props: DashboardViewPageProps,
): DashboardViewPageProps {
	return props;
}

export function createPlatformDashboardAgentRunnerViewProps(
	props: DashboardAgentRunnerViewProps,
): DashboardAgentRunnerViewProps {
	return props;
}

export function createPlatformDashboardTenantAccessViewProps(
	props: DashboardTenantAccessViewProps,
): DashboardTenantAccessViewProps {
	return props;
}
