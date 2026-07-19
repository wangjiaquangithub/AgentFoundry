// @ts-nocheck

import { GovernanceHealthPanel } from './GovernanceHealthPanel';
import { OperationsPanel } from './OperationsPanel';

interface DashboardOperationalHealthSectionProps {
	[key: string]: any;
}

export function DashboardOperationalHealthSection({
	t,
	activePlatformAgents,
	blockedOrPartialPlatformAgents,
	governanceError,
	governanceHealthItems,
	governanceLoading,
	handleEditAgent,
	handlePrimeAgentRunner,
	handleStartPublishing,
	handleUseApproval,
	operationsAgentIssueText,
	operationsHeadline,
	pendingApprovals,
	readyPlatformAgents,
	refetchGovernance,
	scrollToAgentManagement,
	scrollToGovernance,
	setSelectedRunAgentId,
	topOperationsAgents,
}: DashboardOperationalHealthSectionProps) {
	return (
		<>
			<GovernanceHealthPanel
				items={governanceHealthItems}
				error={governanceError}
				loading={governanceLoading}
				onRefresh={() => void refetchGovernance()}
				onOpenDetails={scrollToGovernance}
				labels={{
					eyebrow: t('platform.governanceHealth.eyebrow'),
					title: t('platform.governanceHealth.title'),
					description: t('platform.governanceHealth.description'),
					refresh: t('platform.governanceHealth.refresh'),
					openDetails: t('platform.governanceHealth.openDetails'),
					stateLabel: (state) => t(`platform.launchpad.${state}`),
				}}
			/>

			<OperationsPanel
				activeAgents={activePlatformAgents}
				readyAgents={readyPlatformAgents}
				blockedOrPartialAgents={blockedOrPartialPlatformAgents}
				topAgents={topOperationsAgents}
				pendingApprovals={pendingApprovals}
				headline={operationsHeadline}
				agentIssueText={operationsAgentIssueText}
				onManageAgents={scrollToAgentManagement}
				onOpenGovernance={scrollToGovernance}
				onRunReadyAgent={handlePrimeAgentRunner}
				onStartPublishing={handleStartPublishing}
				onSelectRunAgent={setSelectedRunAgentId}
				onEditAgent={handleEditAgent}
				onUseApproval={handleUseApproval}
				labels={{
					eyebrow: t('platform.operations.eyebrow'),
					title: t('platform.operations.title'),
					manageAgents: t('platform.operations.manageAgents'),
					runReadyAgent: t('platform.operations.runReadyAgent'),
					publishAgent: t('platform.operations.publishAgent'),
					totalAgents: t('platform.operations.totalAgents'),
					readyAgents: t('platform.operations.readyAgents'),
					needsConfiguration: t('platform.operations.needsConfiguration'),
					pendingApprovals: t('platform.operations.pendingApprovals'),
					agentReadiness: t('platform.operations.agentReadiness'),
					viewAll: t('platform.operations.viewAll'),
					emptyAgents: t('platform.operations.emptyAgents'),
					archived: t('platform.agentManagement.archived'),
					readiness: (state) =>
						t(`platform.agentManagement.readiness.${state}`),
					run: t('platform.operations.run'),
					configure: t('platform.operations.configure'),
					humanInLoop: t('platform.operations.humanInLoop'),
					review: t('platform.operations.review'),
					emptyApprovals: t('platform.operations.emptyApprovals'),
				}}
			/>
		</>
	);
}
