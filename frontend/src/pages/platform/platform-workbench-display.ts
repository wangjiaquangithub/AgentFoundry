import type {
	WorkbenchActionCard,
	WorkbenchIndicator,
} from './components/WorkbenchStatusPanel';
import type {
	WorkbenchQuickAction,
	WorkbenchReadinessItem,
	WorkbenchRiskItem,
} from './components/WorkbenchReadinessPanel';
import {
	platformConsoleItemsForDisplay,
	workbenchActionsForStatus,
	workbenchIndicatorsForStatus,
	workbenchQuickActionsForStatus,
	workbenchReadinessItemsForStatus,
	workbenchRiskItemsForStatus,
} from './platform-utils';

export function platformWorkbenchConsoleItemsDisplayState(
	options: Parameters<typeof platformConsoleItemsForDisplay>[0],
) {
	return platformConsoleItemsForDisplay(options);
}

export interface PlatformWorkbenchDisplayState {
	actions: WorkbenchActionCard[];
	indicators: WorkbenchIndicator[];
	quickActions: WorkbenchQuickAction[];
	readinessItems: WorkbenchReadinessItem[];
	riskItems: WorkbenchRiskItem[];
}

export function platformWorkbenchDisplayStateForStatus(
	values: {
		activeAgentCount: number;
		readyAgentCount: number;
		pendingApprovalCount: number;
		recentWorkflowRunCount: number;
		failedWorkflowRunCount: number;
		memoryOperationsSavedCount: number;
		memoryOperationsHitCount: number;
		memoryOperationsItemCount: number;
		memoryOperationsRunCount: number;
		selectedRunAgentName?: string;
		workflowTemplateCount: number;
		credentialCount: number;
		knowledgeBaseCount: number;
		savedConnectorConfigCount: number;
		connectorDraftIssueCount: number;
		savedConnectorConfigEnabled: boolean;
		activeMemberCount: number;
		hasErrors: boolean;
	},
	options: {
		indicator: Parameters<typeof workbenchIndicatorsForStatus>[1];
		primaryAction: Parameters<typeof workbenchActionsForStatus>[1];
		readiness: Parameters<typeof workbenchReadinessItemsForStatus>[1];
		risk: Parameters<typeof workbenchRiskItemsForStatus>[1];
		quickAction: Parameters<typeof workbenchQuickActionsForStatus>[0];
	},
): PlatformWorkbenchDisplayState {
	return {
		indicators: workbenchIndicatorsForStatus(
			{
				activeAgentCount: values.activeAgentCount,
				readyAgentCount: values.readyAgentCount,
				pendingApprovalCount: values.pendingApprovalCount,
				recentWorkflowRunCount: values.recentWorkflowRunCount,
				failedWorkflowRunCount: values.failedWorkflowRunCount,
				memoryOperationsSavedCount: values.memoryOperationsSavedCount,
				memoryOperationsHitCount: values.memoryOperationsHitCount,
				memoryOperationsItemCount: values.memoryOperationsItemCount,
			},
			options.indicator,
		),
		actions: workbenchActionsForStatus(
			{
				selectedRunAgentName: values.selectedRunAgentName,
				workflowTemplateCount: values.workflowTemplateCount,
				pendingApprovalCount: values.pendingApprovalCount,
				memoryOperationsRunCount: values.memoryOperationsRunCount,
			},
			options.primaryAction,
		),
		readinessItems: workbenchReadinessItemsForStatus(
			{
				credentialCount: values.credentialCount,
				knowledgeBaseCount: values.knowledgeBaseCount,
				savedConnectorConfigCount: values.savedConnectorConfigCount,
				connectorDraftIssueCount: values.connectorDraftIssueCount,
				savedConnectorConfigEnabled: values.savedConnectorConfigEnabled,
				activeMemberCount: values.activeMemberCount,
				readyAgentCount: values.readyAgentCount,
				activeAgentCount: values.activeAgentCount,
				workflowTemplateCount: values.workflowTemplateCount,
			},
			options.readiness,
		),
		riskItems: workbenchRiskItemsForStatus(
			{
				hasErrors: values.hasErrors,
				connectorDraftIssueCount: values.connectorDraftIssueCount,
				pendingApprovalCount: values.pendingApprovalCount,
				failedWorkflowRunCount: values.failedWorkflowRunCount,
				readyAgentCount: values.readyAgentCount,
			},
			options.risk,
		),
		quickActions: workbenchQuickActionsForStatus(options.quickAction),
	};
}
