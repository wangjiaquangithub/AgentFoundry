// @ts-nocheck

import { getFrequencyLabel, parseCronExpression } from '../../schedule/schedule-utils';
import { formatScheduleAgentLabel } from '../platform-utils';
import { TriggerOpsPanel } from './TriggerOpsPanel';
import { WorkflowOpsPanel } from './WorkflowOpsPanel';

interface DashboardWorkflowAutomationSectionProps {
	[key: string]: any;
}

export function DashboardWorkflowAutomationSection({
	t,
	activePlatformAgents,
	agents,
	creatingRunApproval,
	handleCreateRunApproval,
	handleRunEnterpriseWorkflow,
	handleUseApproval,
	navigate,
	recentSchedules,
	runningWorkflow,
	schedulesError,
	schedulesLoading,
	scrollToGovernance,
	scrollToWorkflowRunner,
	selectedWorkflowDisabled,
	selectedWorkflowLastRun,
	selectedWorkflowName,
	selectedWorkflowSteps,
	selectedWorkflowTemplate,
	triggerOpsStats,
	triggerOpsSummary,
	workflowOpsStats,
	workflowPendingApprovals,
}: DashboardWorkflowAutomationSectionProps) {
	return (
		<>
			<WorkflowOpsPanel
				stats={workflowOpsStats}
				selectedWorkflowName={selectedWorkflowName}
				selectedWorkflowTemplate={selectedWorkflowTemplate}
				selectedWorkflowSteps={selectedWorkflowSteps}
				selectedWorkflowDisabled={selectedWorkflowDisabled}
				selectedWorkflowLastRun={selectedWorkflowLastRun}
				workflowPendingApprovals={workflowPendingApprovals}
				creatingRunApproval={creatingRunApproval}
				runningWorkflow={runningWorkflow}
				onCreateRunApproval={handleCreateRunApproval}
				onRunWorkflow={handleRunEnterpriseWorkflow}
				onScrollToWorkflowRunner={scrollToWorkflowRunner}
				onScrollToGovernance={scrollToGovernance}
				onUseApproval={handleUseApproval}
				labels={{
					eyebrow: t('platform.workflowOps.eyebrow'),
					title: t('platform.workflowOps.title'),
					description: t('platform.workflowOps.description'),
					requestingApproval: t('platform.workflowOps.requestingApproval'),
					requestApproval: t('platform.workflowOps.requestApproval'),
					running: t('platform.workflowOps.running'),
					runCurrent: t('platform.workflowOps.runCurrent'),
					fallbackDescription: t('platform.workflowOps.fallbackDescription'),
					disabled: t('platform.workflowRunner.disabled'),
					enabled: t('platform.workflowRunner.enabled'),
					stepPreview: t('platform.workflowOps.stepPreview'),
					noSteps: t('platform.workflowOps.noSteps'),
					editInputs: t('platform.workflowOps.editInputs'),
					viewAudit: t('platform.workflowOps.viewAudit'),
					latestRun: t('platform.workflowOps.latestRun'),
					history: t('platform.workflowOps.history'),
					status: (key) => t(`platform.workflowRunner.${key}`),
					noRuns: t('platform.workflowOps.noRuns'),
					approvalQueue: t('platform.workflowOps.approvalQueue'),
					review: t('platform.workflowOps.review'),
					noApprovals: t('platform.workflowOps.noApprovals'),
				}}
			/>

			<TriggerOpsPanel
				stats={triggerOpsStats}
				triggerOpsSummary={triggerOpsSummary}
				selectedWorkflowName={selectedWorkflowName}
				recentSchedules={recentSchedules}
				schedulesLoading={schedulesLoading}
				schedulesError={schedulesError}
				creatingRunApproval={creatingRunApproval}
				runningWorkflow={runningWorkflow}
				selectedWorkflowDisabled={selectedWorkflowDisabled}
				onOpenSchedules={() => navigate('/schedule')}
				onCreateRunApproval={handleCreateRunApproval}
				onRunWorkflow={handleRunEnterpriseWorkflow}
				onScrollToWorkflowRunner={scrollToWorkflowRunner}
				onScrollToGovernance={scrollToGovernance}
				scheduleFrequencyLabel={(schedule) => {
					const parsed = parseCronExpression(
						schedule.data.cron_expression,
						schedule.data.started_at,
					);
					return `${getFrequencyLabel(parsed, t)} · ${parsed.time}`;
				}}
				scheduleAgentLabel={(schedule) =>
					formatScheduleAgentLabel(
						schedule,
						activePlatformAgents,
						agents,
						t('platform.triggerOps.unknownAgent'),
					)
				}
				labels={{
					eyebrow: t('platform.triggerOps.eyebrow'),
					title: t('platform.triggerOps.title'),
					description: t('platform.triggerOps.description'),
					createSchedule: t('platform.triggerOps.createSchedule'),
					requestApproval: t('platform.triggerOps.requestApproval'),
					running: t('platform.workflowOps.running'),
					runWorkflow: t('platform.triggerOps.runWorkflow'),
					triggerPlan: t('platform.triggerOps.triggerPlan'),
					manualTrigger: t('platform.triggerOps.manualTrigger'),
					configureWorkflow: t('platform.triggerOps.configureWorkflow'),
					approvalGate: t('platform.triggerOps.approvalGate'),
					viewGovernance: t('platform.triggerOps.viewGovernance'),
					recentSchedules: t('platform.triggerOps.recentSchedules'),
					openSchedules: t('platform.triggerOps.openSchedules'),
					loadFailed: t('platform.triggerOps.loadFailed'),
					noSchedules: t('platform.triggerOps.noSchedules'),
					enabledStatus: t('platform.triggerOps.enabledStatus'),
					disabled: t('common.disabled'),
					updatedAt: (time) => t('platform.triggerOps.updatedAt', { time }),
				}}
			/>
		</>
	);
}
