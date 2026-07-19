import type { ComponentProps } from 'react';

import { DashboardViewPage } from './components/DashboardViewPage';

type DashboardViewPageProps = ComponentProps<typeof DashboardViewPage>;

type DashboardTenantAccessViewProps = Pick<
	DashboardViewPageProps,
	| 'accessControlStats'
	| 'accessTenantSummaries'
	| 'activeMemberCount'
	| 'identityAccessRows'
	| 'platformMemberTenantSummaries'
	| 'tenantOverviewItems'
	| 'tenantWorkspaces'
>;

type DashboardAgentRunnerViewProps = Pick<
	DashboardViewPageProps,
	| 'agentAccessAllowed'
	| 'agentApprovalId'
	| 'agentQuestion'
	| 'agentRunConnectorSourceText'
	| 'agentRunError'
	| 'agentRunKnowledgeLabels'
	| 'agentRunModelLabel'
	| 'agentRunResult'
	| 'agentRunnerRef'
	| 'agentToolCallBadgeText'
	| 'agentToolCalls'
	| 'handleApproveAndRun'
	| 'handleClearAgentConversation'
	| 'handleInspectAgentRunAudit'
	| 'handleRunEnterpriseAgent'
	| 'handleSelectAgentRun'
	| 'refetchAgentRuns'
	| 'runningAgent'
	| 'selectedAgentConversation'
	| 'setAgentApprovalId'
	| 'setAgentQuestion'
	| 'setAgentRunError'
	| 'setAgentRunResult'
>;

type DashboardAppCenterViewProps = Pick<
	DashboardViewPageProps,
	| 'agentResourceText'
	| 'appCenterAgents'
	| 'appCenterDetailIssues'
	| 'appCenterDetailResources'
	| 'appCenterDetailStatus'
	| 'appCenterPrimaryDisabled'
	| 'handleAppCenterDetailPrimaryAction'
	| 'handleAppCenterDetailSecondaryAction'
	| 'handleAppCenterPrimaryAction'
	| 'inspectedAppCenterAgent'
	| 'inspectedAppCenterTemplate'
	| 'setSelectedAppCenterItem'
>;

type DashboardApprovalsViewProps = Pick<
	DashboardViewPageProps,
	| 'approvalError'
	| 'approvalFilters'
	| 'approvalForm'
	| 'approvalLoading'
	| 'approvalRequests'
	| 'approvalSummary'
	| 'approvedApprovalCount'
	| 'continuingApprovalId'
	| 'creatingApproval'
	| 'creatingRunApproval'
	| 'decidingApprovalId'
	| 'handleCreateApproval'
	| 'handleCreateRunApproval'
	| 'handleDecideApproval'
	| 'handleInspectIdentityApprovals'
	| 'handleInspectTenantApprovals'
	| 'handlePrimeToolApproval'
	| 'handleUseApproval'
	| 'pendingApprovals'
	| 'refetchApprovals'
	| 'selectedIdentityPendingApprovals'
	| 'setApprovalFilters'
	| 'setApprovalForm'
	| 'setToolApprovalId'
	| 'setWorkflowApprovalId'
	| 'toolApprovalId'
	| 'workflowApprovalId'
	| 'workflowPendingApprovals'
>;

type DashboardConnectorsViewProps = Pick<
	DashboardViewPageProps,
	| 'activeConnectorTenant'
	| 'activeSavedConnectorConfig'
	| 'connectorCenterRef'
	| 'connectorDraftIssues'
	| 'connectorDraftState'
	| 'connectorRuntimeSourceText'
	| 'connectorRuntimeState'
	| 'connectorSaveError'
	| 'connectorSaveSuccess'
	| 'connectorState'
	| 'connectorTestError'
	| 'connectorTestForm'
	| 'connectorTestPassed'
	| 'connectorTestResult'
	| 'connectors'
	| 'connectorsError'
	| 'connectorsLoading'
	| 'handleSaveConnectorConfig'
	| 'handleTestAndSaveConnectorConfig'
	| 'handleTestConnector'
	| 'loadSavedConnectorConfig'
	| 'refetchConnectors'
	| 'savedConnectorConfigs'
	| 'savingConnectorConfig'
	| 'scrollToConnectorCenter'
	| 'setConnectorTestForm'
	| 'testingConnector'
>;

type DashboardToolsViewProps = Pick<
	DashboardViewPageProps,
	| 'availableToolItems'
	| 'enterpriseToolInputConfig'
	| 'handleRunEnterpriseTool'
	| 'handleSaveToolPolicy'
	| 'riskToolItems'
	| 'runningTool'
	| 'scrollToToolRunner'
	| 'selectedToolAllowed'
	| 'selectedToolCatalogItem'
	| 'selectedToolConfig'
	| 'selectedToolDecision'
	| 'selectedToolInputKey'
	| 'selectedToolInputValue'
	| 'selectedToolName'
	| 'selectedToolReason'
	| 'setSelectedToolName'
	| 'setToolInputs'
	| 'setToolPolicyDraft'
	| 'setToolPolicySaveError'
	| 'setToolPolicySaveSuccess'
	| 'setToolRunError'
	| 'toolCatalogError'
	| 'toolCatalogLoading'
	| 'toolPolicyDraft'
	| 'toolPolicyMode'
	| 'toolPolicySaveError'
	| 'toolPolicySaveSuccess'
	| 'toolPolicySummary'
	| 'toolRunError'
	| 'toolRunResult'
	| 'toolRunnerRef'
>;

type DashboardWorkflowsViewProps = Pick<
	DashboardViewPageProps,
	| 'completedWorkflowRunCount'
	| 'failedWorkflowRunCount'
	| 'governedWorkflowItems'
	| 'handleRunEnterpriseWorkflow'
	| 'handleToggleWorkflowTemplate'
	| 'partialWorkflowRunCount'
	| 'recentWorkflowRuns'
	| 'refetchWorkflowRuns'
	| 'runningWorkflow'
	| 'savingWorkflowType'
	| 'scrollToWorkflowRunner'
	| 'selectedWorkflowDisabled'
	| 'selectedWorkflowLastRun'
	| 'selectedWorkflowName'
	| 'selectedWorkflowSteps'
	| 'selectedWorkflowTemplate'
	| 'selectedWorkflowType'
	| 'setSelectedWorkflowType'
	| 'setWorkflowInputs'
	| 'setWorkflowRunError'
	| 'workflowInputs'
	| 'workflowOpsStats'
	| 'workflowOptions'
	| 'workflowRunCount'
	| 'workflowRunError'
	| 'workflowRunResult'
	| 'workflowRunnerRef'
	| 'workflowRuns'
	| 'workflowRunsError'
	| 'workflowRunsLoading'
	| 'workflowTemplates'
	| 'workflowTemplatesError'
	| 'workflowTemplatesLoading'
>;

type DashboardMemoryOperationsViewProps = Pick<
	DashboardViewPageProps,
	| 'handleInspectMemoryOperationAudit'
	| 'handleOpenMemoryOperation'
	| 'memoryOperationsHitCount'
	| 'memoryOperationsItems'
	| 'memoryOperationsRef'
	| 'memoryOperationsRunCount'
	| 'memoryOperationsSavedCount'
>;

type DashboardMonitoringSnapshotViewProps = Pick<
	DashboardViewPageProps,
	| 'monitoringHealthState'
	| 'monitoringLoading'
	| 'monitoringStats'
	| 'recentAgentTurns'
>;

type DashboardPlatformConsoleViewProps = Pick<
	DashboardViewPageProps,
	'platformConsoleItems'
>;

type DashboardTriggerOpsViewProps = Pick<
	DashboardViewPageProps,
	| 'recentSchedules'
	| 'schedulesError'
	| 'schedulesLoading'
	| 'triggerOpsStats'
	| 'triggerOpsSummary'
>;

type DashboardWorkbenchReadinessViewProps = Pick<
	DashboardViewPageProps,
	| 'workbenchQuickActions'
	| 'workbenchReadinessItems'
	| 'workbenchRiskItems'
>;

type DashboardOpsTasksViewProps = Pick<
	DashboardViewPageProps,
	| 'handleResolveOpsTask'
	| 'opsTasks'
	| 'opsTasksError'
	| 'opsTasksLoading'
	| 'opsTasksSummary'
	| 'refetchOpsTasks'
	| 'resolvingOpsTaskCode'
	| 'summarizeAuditObject'
>;

type DashboardOperationsViewProps = Pick<
	DashboardViewPageProps,
	| 'blockedOrPartialPlatformAgents'
	| 'operationsAgentIssueText'
	| 'operationsHeadline'
	| 'topOperationsAgents'
>;

type DashboardScenariosViewProps = Pick<
	DashboardViewPageProps,
	| 'handleRunScenario'
	| 'refetchScenarios'
	| 'scenarios'
	| 'scenariosError'
	| 'scenariosLoading'
>;

export function createPlatformDashboardViewProps(
	props: DashboardViewPageProps,
): DashboardViewPageProps {
	return props;
}

export function createPlatformDashboardAgentRunnerViewProps(
	props: DashboardAgentRunnerViewProps,
): DashboardAgentRunnerViewProps {
	return props;
}

export function createPlatformDashboardAppCenterViewProps(
	props: DashboardAppCenterViewProps,
): DashboardAppCenterViewProps {
	return props;
}

export function createPlatformDashboardApprovalsViewProps(
	props: DashboardApprovalsViewProps,
): DashboardApprovalsViewProps {
	return props;
}

export function createPlatformDashboardConnectorsViewProps(
	props: DashboardConnectorsViewProps,
): DashboardConnectorsViewProps {
	return props;
}

export function createPlatformDashboardToolsViewProps(
	props: DashboardToolsViewProps,
): DashboardToolsViewProps {
	return props;
}

export function createPlatformDashboardWorkflowsViewProps(
	props: DashboardWorkflowsViewProps,
): DashboardWorkflowsViewProps {
	return props;
}

export function createPlatformDashboardMemoryOperationsViewProps(
	props: DashboardMemoryOperationsViewProps,
): DashboardMemoryOperationsViewProps {
	return props;
}

export function createPlatformDashboardMonitoringSnapshotViewProps(
	props: DashboardMonitoringSnapshotViewProps,
): DashboardMonitoringSnapshotViewProps {
	return props;
}

export function createPlatformDashboardPlatformConsoleViewProps(
	props: DashboardPlatformConsoleViewProps,
): DashboardPlatformConsoleViewProps {
	return props;
}

export function createPlatformDashboardTriggerOpsViewProps(
	props: DashboardTriggerOpsViewProps,
): DashboardTriggerOpsViewProps {
	return props;
}

export function createPlatformDashboardWorkbenchReadinessViewProps(
	props: DashboardWorkbenchReadinessViewProps,
): DashboardWorkbenchReadinessViewProps {
	return props;
}

export function createPlatformDashboardOpsTasksViewProps(
	props: DashboardOpsTasksViewProps,
): DashboardOpsTasksViewProps {
	return props;
}

export function createPlatformDashboardOperationsViewProps(
	props: DashboardOperationsViewProps,
): DashboardOperationsViewProps {
	return props;
}

export function createPlatformDashboardScenariosViewProps(
	props: DashboardScenariosViewProps,
): DashboardScenariosViewProps {
	return props;
}

export function createPlatformDashboardTenantAccessViewProps(
	props: DashboardTenantAccessViewProps,
): DashboardTenantAccessViewProps {
	return props;
}
