// @ts-nocheck

import { AccessControlPanel } from './AccessControlPanel';
import { TenantWorkspacePanel } from './TenantWorkspacePanel';

interface DashboardTenantAccessSectionProps {
	[key: string]: any;
}

export function DashboardTenantAccessSection({
	t,
	accessControlStats,
	accessTenantSummaries,
	creatingRunApproval,
	enterpriseIdentities,
	governance,
	governanceError,
	governanceLoading,
	handleCreateRunApproval,
	handleInspectIdentityApprovals,
	handleInspectIdentityAudit,
	handleInspectIdentityFailures,
	handleInspectTenantApprovals,
	handleInspectTenantAudit,
	handlePrepareTenantAgent,
	handleUseApproval,
	handleUseIdentity,
	handleUseTenant,
	identityAccessRows,
	refetchGovernance,
	scrollToConnectorCenter,
	scrollToGovernance,
	selectedIdentity,
	selectedIdentityAllowedTools,
	selectedIdentityDeniedTools,
	selectedIdentityFailedAuditEvents,
	selectedIdentityPendingApprovals,
	selectedIdentityRecentAuditEvents,
	selectedIdentityWorkspace,
	setSelectedIdentityUserId,
	tenantOverviewItems,
	toolPolicyMode,
}: DashboardTenantAccessSectionProps) {
	return (
		<>
			<TenantWorkspacePanel
				tenantOverviewItems={tenantOverviewItems}
				selectedIdentity={selectedIdentity}
				selectedIdentityWorkspace={selectedIdentityWorkspace}
				selectedIdentityAllowedTools={selectedIdentityAllowedTools}
				selectedIdentityDeniedTools={selectedIdentityDeniedTools}
				enterpriseIdentityCount={enterpriseIdentities.length}
				onConfigureSources={scrollToConnectorCenter}
				onUseIdentity={handleUseIdentity}
				onUseTenant={handleUseTenant}
				onPrepareTenantAgent={handlePrepareTenantAgent}
				onInspectTenantApprovals={handleInspectTenantApprovals}
				onInspectTenantAudit={handleInspectTenantAudit}
				onInspectIdentityAudit={handleInspectIdentityAudit}
				onOpenGovernance={scrollToGovernance}
				labels={{
					eyebrow: t('platform.tenantWorkspace.eyebrow'),
					title: t('platform.tenantWorkspace.title'),
					description: t('platform.tenantWorkspace.description'),
					configureSources: t('platform.tenantWorkspace.configureSources'),
					runAsCurrent: t('platform.tenantWorkspace.runAsCurrent'),
					emptyTenants: t('platform.tenantWorkspace.emptyTenants'),
					tenant: t('platform.tenantWorkspace.tenant'),
					roleCount: (count) =>
						t('platform.tenantWorkspace.roleCount', { count }),
					identities: t('platform.tenantWorkspace.identities'),
					agents: t('platform.tenantWorkspace.agents'),
					pendingApprovals: t('platform.tenantWorkspace.pendingApprovals'),
					auditEvents: t('platform.tenantWorkspace.auditEvents'),
					workflowRuns: t('platform.tenantWorkspace.workflowRuns'),
					roles: t('platform.tenantWorkspace.roles'),
					sampleQuestion: t('platform.tenantWorkspace.sampleQuestion'),
					noSample: t('platform.tenantWorkspace.noSample'),
					useTenant: t('platform.tenantWorkspace.useTenant'),
					publishForTenant: t('platform.tenantWorkspace.publishForTenant'),
					openTenantApprovals: t(
						'platform.tenantWorkspace.openTenantApprovals',
					),
					openTenantAudit: t('platform.tenantWorkspace.openTenantAudit'),
					activeIdentity: t('platform.tenantWorkspace.activeIdentity'),
					runSample: t('platform.tenantWorkspace.runSample'),
					viewAudit: t('platform.tenantWorkspace.viewAudit'),
					workspace: t('platform.tenantWorkspace.workspace'),
					localSource: t('platform.tenantWorkspace.localSource'),
					policies: t('platform.tenantGovernance.policies'),
					tickets: t('platform.tenantGovernance.tickets'),
					departments: t('platform.tenantGovernance.departments'),
					knowledgeBases: t('platform.tenantGovernance.knowledgeBases'),
					tools: t('platform.tenantGovernance.tools'),
					policy: t('platform.tenantWorkspace.policy'),
					allowedTools: t('platform.tenantGovernance.allowedTools'),
					deniedTools: t('platform.tenantGovernance.deniedTools'),
					none: t('platform.tenantWorkspace.none'),
					openGovernance: t('platform.tenantWorkspace.openGovernance'),
					noIdentity: t('platform.tenantWorkspace.noIdentity'),
				}}
			/>

			<AccessControlPanel
				stats={accessControlStats}
				governance={governance}
				governanceLoading={governanceLoading}
				governanceError={governanceError}
				enterpriseIdentities={enterpriseIdentities}
				accessTenantSummaries={accessTenantSummaries}
				identityAccessRows={identityAccessRows}
				toolPolicyMode={toolPolicyMode}
				selectedIdentity={selectedIdentity}
				selectedIdentityAllowedTools={selectedIdentityAllowedTools}
				selectedIdentityDeniedTools={selectedIdentityDeniedTools}
				selectedIdentityPendingApprovals={selectedIdentityPendingApprovals}
				selectedIdentityFailedAuditEvents={selectedIdentityFailedAuditEvents}
				selectedIdentityRecentAuditEvents={selectedIdentityRecentAuditEvents}
				creatingRunApproval={creatingRunApproval}
				onRefreshGovernance={() => void refetchGovernance()}
				onCreateRunApproval={handleCreateRunApproval}
				onSelectIdentity={setSelectedIdentityUserId}
				onUseApproval={handleUseApproval}
				onInspectIdentityApprovals={handleInspectIdentityApprovals}
				onInspectIdentityFailures={handleInspectIdentityFailures}
				onUseIdentity={handleUseIdentity}
				onInspectIdentityAudit={handleInspectIdentityAudit}
				labels={{
					eyebrow: t('platform.accessControl.eyebrow'),
					title: t('platform.accessControl.title'),
					description: t('platform.accessControl.description'),
					refreshStatus: t('platform.actions.refreshStatus'),
					requestingApproval: t('platform.accessControl.requestingApproval'),
					requestToolApproval: t('platform.accessControl.requestToolApproval'),
					tenantMatrix: t('platform.accessControl.tenantMatrix'),
					roleCount: (count) => t('platform.accessControl.roleCount', { count }),
					identityCount: (count) =>
						t('platform.accessControl.identityCount', { count }),
					allowed: t('platform.accessControl.allowed'),
					denied: t('platform.accessControl.denied'),
					pending: t('platform.accessControl.pending'),
					identityDirectory: t('platform.accessControl.identityDirectory'),
					allowedCount: (count) =>
						t('platform.accessControl.allowedCount', { count }),
					deniedCount: (count) =>
						t('platform.accessControl.deniedCount', { count }),
					pendingCount: (count) =>
						t('platform.accessControl.pendingCount', { count }),
					selectedPolicy: t('platform.accessControl.selectedPolicy'),
					needsReview: t('platform.accessControl.needsReview'),
					normal: t('platform.accessControl.normal'),
					identityOps: t('platform.accessControl.identityOps'),
					actionNeeded: t('platform.accessControl.actionNeeded'),
					pendingApprovalsShort: t(
						'platform.accessControl.pendingApprovalsShort',
					),
					failedAudits: t('platform.accessControl.failedAudits'),
					recentAudit: t('platform.accessControl.recentAudit'),
					pendingQueue: t('platform.accessControl.pendingQueue'),
					noPendingQueue: t('platform.accessControl.noPendingQueue'),
					reviewApprovals: t('platform.accessControl.reviewApprovals'),
					viewFailures: t('platform.accessControl.viewFailures'),
					allowedTools: t('platform.accessControl.allowedTools'),
					deniedTools: t('platform.accessControl.deniedTools'),
					none: t('platform.accessControl.none'),
					runAsIdentity: t('platform.accessControl.runAsIdentity'),
					viewAudit: t('platform.accessControl.viewAudit'),
					noIdentity: t('platform.accessControl.noIdentity'),
				}}
			/>
		</>
	);
}
