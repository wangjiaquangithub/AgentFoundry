// @ts-nocheck

import { ApprovalsPanel } from './ApprovalsPanel';

interface DashboardApprovalsSectionProps {
	[key: string]: any;
}

export function DashboardApprovalsSection({
	t,
	approvalForm,
	setApprovalForm,
	approvalFilters,
	setApprovalFilters,
	approvalSummary,
	approvalRequests,
	approvalLoading,
	approvalError,
	creatingApproval,
	decidingApprovalId,
	continuingApprovalId,
	workflowOptions,
	availableToolItems,
	activePlatformAgents,
	selectedRunAgentId,
	selectedIdentityUserId,
	username,
	platformStatus,
	enterpriseToolInputConfig,
	handleCreateApproval,
	refetchApprovals,
	handleApproveAndRun,
	handleDecideApproval,
	handleUseApproval,
	summarizeAuditObject,
}: DashboardApprovalsSectionProps) {
	return (
		<ApprovalsPanel
			approvalForm={approvalForm}
			onApprovalFormChange={setApprovalForm}
			approvalFilters={approvalFilters}
			onApprovalFiltersChange={setApprovalFilters}
			approvalSummary={approvalSummary}
			approvalRequests={approvalRequests}
			approvalLoading={approvalLoading}
			approvalError={approvalError}
			creatingApproval={creatingApproval}
			decidingApprovalId={decidingApprovalId}
			continuingApprovalId={continuingApprovalId}
			workflowOptions={workflowOptions}
			availableToolItems={availableToolItems}
			activePlatformAgents={activePlatformAgents}
			selectedRunAgentId={selectedRunAgentId}
			selectedIdentityUserId={selectedIdentityUserId}
			username={username}
			currentTenant={platformStatus?.current_user.tenant}
			currentUserId={platformStatus?.current_user.user_id}
			toolInputConfig={enterpriseToolInputConfig}
			onCreateApproval={handleCreateApproval}
			onRefetchApprovals={refetchApprovals}
			onApproveAndRun={handleApproveAndRun}
			onDecideApproval={handleDecideApproval}
			onUseApproval={handleUseApproval}
			summarizeAuditObject={summarizeAuditObject}
			t={t}
		/>
	);
}
