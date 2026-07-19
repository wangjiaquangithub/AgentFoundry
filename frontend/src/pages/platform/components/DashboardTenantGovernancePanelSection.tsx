// @ts-nocheck

import { TenantGovernancePanel } from './TenantGovernancePanel';

interface DashboardTenantGovernancePanelSectionProps {
	[key: string]: any;
}

export function DashboardTenantGovernancePanelSection({
	t,
	availableToolItems,
	connectors,
	connectorsLoading,
	currentIdentityLabel,
	enterpriseIdentities,
	handleInspectIdentityAudit,
	handleSaveToolPolicy,
	handleUseIdentity,
	savingToolPolicy,
	scrollToAgentRunner,
	selectedIdentity,
	selectedIdentityAllowedTools,
	selectedIdentityDeniedTools,
	selectedIdentityPendingToolNames,
	selectedIdentityWorkspace,
	setAgentQuestion,
	setSelectedIdentityUserId,
	setToolPolicyDraft,
	setToolPolicySaveError,
	setToolPolicySaveSuccess,
	toolPolicyDraft,
	toolPolicyMode,
	toolPolicySaveError,
	toolPolicySaveSuccess,
	toolPolicySummary,
}: DashboardTenantGovernancePanelSectionProps) {
	return (
		<TenantGovernancePanel
			connectorsLoading={connectorsLoading}
			hasConnectors={Boolean(connectors)}
			enterpriseIdentities={enterpriseIdentities}
			selectedIdentity={selectedIdentity}
			currentIdentityLabel={currentIdentityLabel}
			selectedIdentityAllowedTools={selectedIdentityAllowedTools}
			selectedIdentityDeniedTools={selectedIdentityDeniedTools}
			toolPolicyMode={toolPolicyMode}
			toolPolicySummary={toolPolicySummary}
			savingToolPolicy={savingToolPolicy}
			availableToolItems={availableToolItems}
			toolPolicyDraft={toolPolicyDraft}
			selectedIdentityPendingToolNames={selectedIdentityPendingToolNames}
			selectedIdentityWorkspace={selectedIdentityWorkspace}
			toolPolicySaveError={toolPolicySaveError}
			toolPolicySaveSuccess={toolPolicySaveSuccess}
			onSelectIdentity={setSelectedIdentityUserId}
			onUseSampleQuestion={(question) => {
				setAgentQuestion(question);
				window.setTimeout(scrollToAgentRunner, 0);
			}}
			onSaveToolPolicy={() => void handleSaveToolPolicy()}
			onChangeToolPolicyDraft={(toolName, value) => {
				setToolPolicyDraft((previous) => ({
					...previous,
					[toolName]: value,
				}));
				setToolPolicySaveError(null);
				setToolPolicySaveSuccess(null);
			}}
			onUseIdentity={handleUseIdentity}
			onInspectIdentityAudit={handleInspectIdentityAudit}
			labels={{
				title: t('platform.tenantGovernance.title'),
				description: t('platform.tenantGovernance.description'),
				currentIdentity: t('platform.tenantGovernance.currentIdentity'),
				noIdentity: t('platform.tenantGovernance.noIdentity'),
				selectIdentity: t('platform.tenantGovernance.selectIdentity'),
				sampleQuestion: t('platform.tenantGovernance.sampleQuestion'),
				policies: t('platform.tenantGovernance.policies'),
				allowedTools: t('platform.tenantGovernance.allowedTools'),
				deniedTools: t('platform.tenantGovernance.deniedTools'),
				editToolPolicy: t('platform.tenantGovernance.editToolPolicy'),
				effectiveAllowed: t('platform.tenantGovernance.effectiveAllowed'),
				effectiveDenied: t('platform.tenantGovernance.effectiveDenied'),
				policyInherited: t('platform.tenantGovernance.policyInherited'),
				pendingToolApprovals: t(
					'platform.tenantGovernance.pendingToolApprovals',
				),
				draftAllowCount: (count) =>
					t('platform.tenantGovernance.draftAllowCount', { count }),
				draftDenyCount: (count) =>
					t('platform.tenantGovernance.draftDenyCount', { count }),
				draftInheritCount: (count) =>
					t('platform.tenantGovernance.draftInheritCount', { count }),
				savingPolicy: t('platform.tenantGovernance.savingPolicy'),
				savePolicy: t('platform.tenantGovernance.savePolicy'),
				effectiveAllow: t('platform.tenantGovernance.effectiveAllow'),
				effectiveDeny: t('platform.tenantGovernance.effectiveDeny'),
				pendingApproval: t('platform.tenantGovernance.pendingApproval'),
				notBoundToAgent: t('platform.tenantGovernance.notBoundToAgent'),
				toolCalls: (count) =>
					t('platform.tenantGovernance.toolCalls', { count }),
				toolSuccesses: (count) =>
					t('platform.tenantGovernance.toolSuccesses', { count }),
				toolFailures: (count) =>
					t('platform.tenantGovernance.toolFailures', { count }),
				effectiveReason: t('platform.tenantGovernance.effectiveReason'),
				configuredBy: t('platform.tenantGovernance.configuredBy'),
				noConfiguredAgent: t('platform.tenantGovernance.noConfiguredAgent'),
				policyInherit: t('platform.tenantGovernance.policyInherit'),
				policyAllow: t('platform.tenantGovernance.policyAllow'),
				policyDeny: t('platform.tenantGovernance.policyDeny'),
				tenantWorkspaces: t('platform.tenantGovernance.tenantWorkspaces'),
				source: t('platform.tenantGovernance.source'),
				tickets: t('platform.tenantGovernance.tickets'),
				departments: t('platform.tenantGovernance.departments'),
				knowledgeBases: t('platform.tenantGovernance.knowledgeBases'),
				tools: t('platform.tenantGovernance.tools'),
				identities: t('platform.tenantGovernance.identities'),
				useIdentity: t('platform.tenantGovernance.useIdentity'),
				viewAudit: t('platform.tenantGovernance.viewAudit'),
			}}
		/>
	);
}
