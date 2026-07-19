// @ts-nocheck

import { MembersPanel } from './MembersPanel';

interface DashboardMembersSectionProps {
	[key: string]: any;
}

export function DashboardMembersSection({
	t,
	activeMemberCount,
	activePlatformAgents,
	handleEditMember,
	handleSaveMember,
	handleToggleMemberStatus,
	memberForm,
	membersRef,
	pendingApprovals,
	platformMemberTenantSummaries,
	platformMembers,
	platformMembersError,
	platformMembersLoading,
	refetchMembers,
	savingMember,
	setMemberForm,
	updatingMemberId,
}: DashboardMembersSectionProps) {
	return (
		<MembersPanel
			membersRef={membersRef}
			platformMembers={platformMembers}
			platformMembersLoading={platformMembersLoading}
			platformMembersError={platformMembersError}
			platformMemberTenantSummaries={platformMemberTenantSummaries}
			activeMemberCount={activeMemberCount}
			activePlatformAgentCount={activePlatformAgents.length}
			pendingApprovalCount={pendingApprovals.length}
			memberForm={memberForm}
			setMemberForm={setMemberForm}
			savingMember={savingMember}
			updatingMemberId={updatingMemberId}
			onRefreshMembers={() => void refetchMembers()}
			onSaveMember={() => void handleSaveMember()}
			onEditMember={handleEditMember}
			onToggleMemberStatus={(member) => void handleToggleMemberStatus(member)}
			t={t}
		/>
	);
}
