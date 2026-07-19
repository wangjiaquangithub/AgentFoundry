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

type DashboardApprovalsViewProps = Pick<
	DashboardViewPageProps,
	| 'approvalError'
	| 'approvalFilters'
	| 'approvalForm'
	| 'approvalLoading'
	| 'approvalRequests'
	| 'approvalSummary'
	| 'approvedApprovalCount'
	| 'continuingApprovalId'
	| 'creatingApproval'
	| 'creatingRunApproval'
	| 'decidingApprovalId'
	| 'handleCreateApproval'
	| 'handleCreateRunApproval'
	| 'handleDecideApproval'
	| 'handleInspectIdentityApprovals'
	| 'handleInspectTenantApprovals'
	| 'handlePrimeToolApproval'
	| 'handleUseApproval'
	| 'pendingApprovals'
	| 'refetchApprovals'
	| 'selectedIdentityPendingApprovals'
	| 'setApprovalFilters'
	| 'setApprovalForm'
	| 'setToolApprovalId'
	| 'setWorkflowApprovalId'
	| 'toolApprovalId'
	| 'workflowApprovalId'
	| 'workflowPendingApprovals'
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

export function createPlatformDashboardApprovalsViewProps(
	props: DashboardApprovalsViewProps,
): DashboardApprovalsViewProps {
	return props;
}

export function createPlatformDashboardTenantAccessViewProps(
	props: DashboardTenantAccessViewProps,
): DashboardTenantAccessViewProps {
	return props;
}
