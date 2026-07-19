// @ts-nocheck

import { DashboardOpsPanel } from './DashboardOpsPanel';
import { PlatformConsolePanel } from './PlatformConsolePanel';

interface DashboardOperationsConsoleSectionProps {
	[key: string]: any;
}

export function DashboardOperationsConsoleSection({
	t,
	NextStepIcon,
	approvedApprovalCount,
	auditEventCount,
	completedWorkflowRunCount,
	dashboardOperations,
	dashboardTodoItems,
	failedWorkflowRunCount,
	governedWorkflowItems,
	handleNextStepPrimaryAction,
	handleOperationAction,
	nextStepMode,
	nextStepPrimaryDisabled,
	partialWorkflowRunCount,
	pendingApprovals,
	platformConsoleItems,
	recentAuditEvents,
	recentWorkflowRuns,
	recommendedOperationActions,
	riskToolItems,
	scrollToAgentRunner,
	scrollToGovernance,
	scrollToToolRunner,
	scrollToWorkflowRunner,
	workflowRunCount,
	workflowTemplates,
}: DashboardOperationsConsoleSectionProps) {
	return (
		<>
			<DashboardOpsPanel
				dashboardOperations={dashboardOperations}
				workflowTemplates={workflowTemplates}
				completedWorkflowRunCount={completedWorkflowRunCount}
				partialWorkflowRunCount={partialWorkflowRunCount}
				failedWorkflowRunCount={failedWorkflowRunCount}
				governedWorkflowItems={governedWorkflowItems}
				recommendedOperationActions={recommendedOperationActions}
				pendingApprovals={pendingApprovals}
				approvedApprovalCount={approvedApprovalCount}
				workflowRunCount={workflowRunCount}
				recentWorkflowRuns={recentWorkflowRuns}
				riskToolItems={riskToolItems}
				auditEventCount={auditEventCount}
				recentAuditEvents={recentAuditEvents}
				dashboardTodoItems={dashboardTodoItems}
				nextStepMode={nextStepMode}
				nextStepIcon={NextStepIcon}
				nextStepPrimaryDisabled={nextStepPrimaryDisabled}
				onOperationAction={handleOperationAction}
				onNextStepPrimaryAction={handleNextStepPrimaryAction}
				onScrollToGovernance={scrollToGovernance}
				onScrollToAgentRunner={scrollToAgentRunner}
				onScrollToWorkflowRunner={scrollToWorkflowRunner}
				onScrollToToolRunner={scrollToToolRunner}
				labels={{
					eyebrow: t('platform.dashboard.eyebrow'),
					title: t('platform.dashboard.title'),
					description: t('platform.dashboard.description'),
					openAudit: t('platform.dashboard.openAudit'),
					runAgent: t('platform.dashboard.runAgent'),
					workflowHealth: t('platform.dashboard.workflowHealth'),
					workflowHealthDescription: t('platform.dashboard.workflowHealthDescription'),
					enabledWorkflows: t('platform.dashboard.enabledWorkflows'),
					completedRuns: t('platform.dashboard.completedRuns'),
					partialRuns: t('platform.dashboard.partialRuns'),
					failedRuns: t('platform.dashboard.failedRuns'),
					noGovernedWorkflows: t('platform.dashboard.noGovernedWorkflows'),
					workflowApprovalRequired: t('platform.dashboard.workflowApprovalRequired'),
					ready: t('platform.status.ready'),
					toConfigure: t('platform.status.toConfigure'),
					pendingCount: (count) => t('platform.dashboard.pendingCount', { count }),
					recommendedActions: t('platform.dashboard.recommendedActions'),
					recommendedActionsDescription: t('platform.dashboard.recommendedActionsDescription'),
					actionLabel: (code, count) => t(`platform.dashboard.actions.${code}`, { count }),
					severityLabel: (severity) => t(`platform.dashboard.severity.${severity}`),
					workflowApprovals: t('platform.dashboard.workflowApprovals'),
					toolApprovals: t('platform.dashboard.toolApprovals'),
					pendingApprovals: t('platform.dashboard.pendingApprovals'),
					pendingApprovalsDescription: (approved) => t('platform.dashboard.pendingApprovalsDescription', { approved }),
					emptyApprovals: t('platform.dashboard.emptyApprovals'),
					openApprovals: t('platform.dashboard.openApprovals'),
					recentRuns: t('platform.dashboard.recentRuns'),
					recentRunsDescription: t('platform.dashboard.recentRunsDescription'),
					emptyRuns: t('platform.dashboard.emptyRuns'),
					workflowStatusLabel: (labelKey) => t(`platform.workflowRunner.${labelKey}`),
					openWorkflows: t('platform.dashboard.openWorkflows'),
					riskActions: t('platform.dashboard.riskActions'),
					riskActionsDescription: t('platform.dashboard.riskActionsDescription'),
					emptyRiskActions: t('platform.dashboard.emptyRiskActions'),
					policyReviewWorkflow: t('platform.dashboard.policyReviewWorkflow'),
					approvalGate: t('platform.dashboard.approvalGate'),
					openTools: t('platform.dashboard.openTools'),
					auditTrail: t('platform.dashboard.auditTrail'),
					auditTrailDescription: t('platform.dashboard.auditTrailDescription'),
					emptyAudit: t('platform.dashboard.emptyAudit'),
					auditFailure: t('platform.audit.failure'),
					auditSuccess: t('platform.audit.success'),
					todo: t('platform.dashboard.todo'),
					todoReady: t('platform.dashboard.todoReady'),
					nextStepAction: (mode) => t(`platform.nextStep.${mode}.action`),
				}}
			/>

			<PlatformConsolePanel
				items={platformConsoleItems}
				labels={{
					title: t('platform.console.title'),
					description: t('platform.console.description'),
				}}
			/>
		</>
	);
}
