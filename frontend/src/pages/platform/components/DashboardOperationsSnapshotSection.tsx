// @ts-nocheck

import { MemoryOperationsPanel } from './MemoryOperationsPanel';
import { MonitoringSnapshotPanel } from './MonitoringSnapshotPanel';
import { OpsTasksPanel } from './OpsTasksPanel';

interface DashboardOperationsSnapshotSectionProps {
	[key: string]: any;
}

export function DashboardOperationsSnapshotSection({
	t,
	handleInspectMemoryOperationAudit,
	handleOpenMemoryOperation,
	handleResolveOpsTask,
	memoryOperationsHitCount,
	memoryOperationsItems,
	memoryOperationsRunCount,
	memoryOperationsSavedCount,
	monitoringHealthState,
	monitoringLoading,
	monitoringStats,
	opsTasks,
	opsTasksError,
	opsTasksLoading,
	opsTasksSummary,
	recentAgentTurns,
	recentAuditEvents,
	recentWorkflowRuns,
	refetchAgentRuns,
	refetchApprovals,
	refetchAuditEvents,
	refetchGovernance,
	refetchOpsTasks,
	refetchPlatform,
	refetchWorkflowRuns,
	resolvingOpsTaskCode,
	scrollToAgentRunner,
	scrollToGovernance,
	scrollToWorkflowRunner,
	setAgentRunResult,
	setSelectedRunAgentId,
	summarizeAuditObject,
}: DashboardOperationsSnapshotSectionProps) {
	return (
		<>
			<MonitoringSnapshotPanel
				healthState={monitoringHealthState}
				loading={monitoringLoading}
				stats={monitoringStats}
				recentAgentTurns={recentAgentTurns}
				recentWorkflowRuns={recentWorkflowRuns}
				recentAuditEvents={recentAuditEvents}
				onRefresh={() =>
					void Promise.all([
						refetchPlatform(),
						refetchAgentRuns(),
						refetchWorkflowRuns(),
						refetchAuditEvents(),
						refetchApprovals(),
						refetchGovernance(),
					])
				}
				onSelectAgentTurn={(turn) => {
					setSelectedRunAgentId(turn.agentId);
					setAgentRunResult(turn.response);
					window.setTimeout(scrollToAgentRunner, 0);
				}}
				onRunAgent={scrollToAgentRunner}
				onRunWorkflow={scrollToWorkflowRunner}
				onOpenGovernance={scrollToGovernance}
				labels={{
					eyebrow: t('platform.monitoring.eyebrow'),
					title: t('platform.monitoring.title'),
					description: t('platform.monitoring.description'),
					state: t(
						`platform.agentManagement.wizard.states.${monitoringHealthState}`,
					),
					refresh: t('platform.monitoring.refresh'),
					runAgent: t('platform.monitoring.runAgent'),
					runWorkflow: t('platform.monitoring.runWorkflow'),
					openGovernance: t('platform.monitoring.openGovernance'),
					recentAgentRuns: t('platform.monitoring.recentAgentRuns'),
					recentAgentRunsHelper: t('platform.monitoring.recentAgentRunsHelper'),
					emptyAgentRuns: t('platform.monitoring.emptyAgentRuns'),
					recentWorkflowRuns: t('platform.monitoring.recentWorkflowRuns'),
					recentWorkflowRunsHelper: t(
						'platform.monitoring.recentWorkflowRunsHelper',
					),
					emptyWorkflowRuns: t('platform.monitoring.emptyWorkflowRuns'),
					recentAudit: t('platform.monitoring.recentAudit'),
					recentAuditHelper: t('platform.monitoring.recentAuditHelper'),
					emptyAudit: t('platform.monitoring.emptyAudit'),
					auditEvent: t('platform.monitoring.auditEvent'),
					failure: t('platform.monitoring.failure'),
					success: t('platform.monitoring.success'),
					workflowStatus: (key) => t(`platform.workflowRunner.${key}`),
				}}
			/>

			<OpsTasksPanel
				tasks={opsTasks}
				summary={opsTasksSummary}
				loading={opsTasksLoading}
				error={opsTasksError}
				resolvingTaskCode={resolvingOpsTaskCode}
				onRefresh={() => void refetchOpsTasks()}
				onResolveTask={(task) => void handleResolveOpsTask(task)}
				summarizeAuditObject={summarizeAuditObject}
				labels={{
					eyebrow: t('platform.opsTasks.eyebrow'),
					title: t('platform.opsTasks.title'),
					description: t('platform.opsTasks.description'),
					total: (count) => t('platform.opsTasks.total', { count }),
					errors: (count) => t('platform.opsTasks.errors', { count }),
					warnings: (count) => t('platform.opsTasks.warnings', { count }),
					refresh: t('platform.opsTasks.refresh'),
					empty: t('platform.opsTasks.empty'),
					resolve: t('platform.opsTasks.resolve'),
					action: t('platform.opsTasks.action'),
					resolving: t('platform.opsTasks.resolving'),
				}}
			/>

			<MemoryOperationsPanel
				items={memoryOperationsItems}
				runCount={memoryOperationsRunCount}
				hitCount={memoryOperationsHitCount}
				savedCount={memoryOperationsSavedCount}
				onRunAgent={scrollToAgentRunner}
				onOpenAudit={scrollToGovernance}
				onOpenRun={handleOpenMemoryOperation}
				onViewAudit={handleInspectMemoryOperationAudit}
				labels={{
					eyebrow: t('platform.memoryOps.eyebrow'),
					title: t('platform.memoryOps.title'),
					description: t('platform.memoryOps.description'),
					runAgent: t('platform.memoryOps.runAgent'),
					openAudit: t('platform.memoryOps.openAudit'),
					loadedRuns: t('platform.memoryOps.loadedRuns'),
					memoryHits: t('platform.memoryOps.memoryHits'),
					memoryWrites: t('platform.memoryOps.memoryWrites'),
					activeScopes: t('platform.memoryOps.activeScopes'),
					empty: t('platform.memoryOps.empty'),
					latestRun: t('platform.memoryOps.latestRun'),
					runs: t('platform.memoryOps.runs'),
					hits: t('platform.memoryOps.hits'),
					writes: t('platform.memoryOps.writes'),
					latestQuestion: t('platform.memoryOps.latestQuestion'),
					latestAnswer: t('platform.memoryOps.latestAnswer'),
					noQuestion: t('platform.memoryOps.noQuestion'),
					noAnswer: t('platform.memoryOps.noAnswer'),
					noSources: t('platform.memoryOps.noSources'),
					moreSources: (count) => t('platform.memoryOps.moreSources', { count }),
					openRun: t('platform.memoryOps.openRun'),
					viewAudit: t('platform.memoryOps.viewAudit'),
				}}
			/>
		</>
	);
}
