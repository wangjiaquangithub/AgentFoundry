import type {
	MonitoringAgentTurn,
	MonitoringStat,
} from './components/MonitoringSnapshotPanel';
import type { HealthState } from './components/common';
import {
	monitoringActivitySummaryForStatus,
	monitoringStatsForSummary,
} from './platform-utils';

export interface PlatformMonitoringDisplayState {
	activitySummary: {
		auditFailureCount: number;
		auditSuccessCount: number;
		healthState: HealthState;
		recentAgentTurns: MonitoringAgentTurn[];
	};
	loading: boolean;
	stats: MonitoringStat[];
}

export function platformMonitoringDisplayStateForStatus(
	values: Parameters<typeof monitoringActivitySummaryForStatus>[0] & {
		agentRunsLoading: boolean;
		auditLoading: boolean;
		approvalLoading: boolean;
		completedWorkflowRunCount: number;
		governanceLoading: boolean;
		platformLoading: boolean;
		workflowRunsLoading: boolean;
	},
	options: Parameters<typeof monitoringStatsForSummary>[1],
): PlatformMonitoringDisplayState {
	const activitySummary = monitoringActivitySummaryForStatus(values);

	return {
		activitySummary,
		loading:
			values.platformLoading ||
			values.agentRunsLoading ||
			values.workflowRunsLoading ||
			values.auditLoading ||
			values.approvalLoading ||
			values.governanceLoading,
		stats: monitoringStatsForSummary(
			{
				recentAgentTurnCount: activitySummary.recentAgentTurns.length,
				workflowRunCount: values.workflowRunCount,
				completedWorkflowRunCount: values.completedWorkflowRunCount,
				partialWorkflowRunCount: values.partialWorkflowRunCount,
				failedWorkflowRunCount: values.failedWorkflowRunCount,
				auditEventCount: values.auditEventCount,
				auditSuccessCount: activitySummary.auditSuccessCount,
				auditFailureCount: activitySummary.auditFailureCount,
				pendingApprovalCount: values.pendingApprovalCount,
			},
			options,
		),
	};
}
