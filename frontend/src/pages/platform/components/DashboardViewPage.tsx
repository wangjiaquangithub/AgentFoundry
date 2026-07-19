// @ts-nocheck

import {
	BotMessageSquare,
	KeyRound,
	ListChecks,
	Play,
	ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { AgentQuickStartPanel } from './AgentQuickStartPanel';
import { AgentRunnerPanel } from './AgentRunnerPanel';
import { ApprovalsPanel } from './ApprovalsPanel';
import { AuditEventsPanel } from './AuditEventsPanel';
import { CapabilitiesPanel } from './CapabilitiesPanel';
import { ConfigManagementPanel } from './ConfigManagementPanel';
import { DashboardAgentManagementSection } from './DashboardAgentManagementSection';
import { DashboardAgentRunNowSection } from './DashboardAgentRunNowSection';
import { DashboardApplicationSection } from './DashboardApplicationSection';
import { DashboardConnectorsSection } from './DashboardConnectorsSection';
import { DashboardLaunchOrchestrationSection } from './DashboardLaunchOrchestrationSection';
import { DashboardMembersSection } from './DashboardMembersSection';
import { DashboardOperationalHealthSection } from './DashboardOperationalHealthSection';
import { DashboardOperationsConsoleSection } from './DashboardOperationsConsoleSection';
import { DashboardOperationsSnapshotSection } from './DashboardOperationsSnapshotSection';
import { DashboardRuntimeStatusSection } from './DashboardRuntimeStatusSection';
import { DashboardTenantAccessSection } from './DashboardTenantAccessSection';
import { DashboardTenantGovernancePanelSection } from './DashboardTenantGovernancePanelSection';
import { DashboardWorkbenchSection } from './DashboardWorkbenchSection';
import { DashboardWorkflowAutomationSection } from './DashboardWorkflowAutomationSection';
import { DashboardWorkflowRunnerSection } from './DashboardWorkflowRunnerSection';
import { PlatformDashboardOverview } from './PlatformDashboardOverview';
import { PolicySubagentsPanel } from './PolicySubagentsPanel';
import { ToolCatalogPanel } from './ToolCatalogPanel';
import { ToolRunnerPanel } from './ToolRunnerPanel';
import { cn } from '@/lib/utils';

interface DashboardViewPageProps {
	[key: string]: any;
}

export function DashboardViewPage({
	accessControlStats,
	accessTenantSummaries,
	activeConnectorTenant,
	activeMemberCount,
	activePlatformAgents,
	activeSavedConnectorConfig,
	agentAccessAllowed,
	agentApprovalId,
	agentKnowledgeStepRef,
	agentManagementRef,
	agentModelStepRef,
	agentOpsSummary,
	agentQuestion,
	agentReleasePipeline,
	agentResourceText,
	agentRoutingLabel,
	agentRoutingText,
	agentRunConnectorSourceText,
	agentRunError,
	agentRunKnowledgeLabels,
	agentRunModelLabel,
	agentRunResult,
	agentRunnerRef,
	agentRunsError,
	agentRunsLoading,
	agentRuntimeStepRef,
	agentSampleQuestions,
	agentSetupSteps,
	agentTemplateStepRef,
	agentTemplates,
	agentToolCallBadgeText,
	agentToolCalls,
	agentToolsStepRef,
	agents,
	agentsLoading,
	appCenterAgents,
	appCenterDetailIssues,
	appCenterDetailResources,
	appCenterDetailStatus,
	appCenterPrimaryDisabled,
	approvalError,
	approvalFilters,
	approvalForm,
	approvalLoading,
	approvalRequests,
	approvalSummary,
	approvedApprovalCount,
	archivingAgentId,
	auditError,
	auditEventCount,
	auditEvents,
	auditFilters,
	auditLoading,
	auditStats,
	availableToolItems,
	bindingAgentKnowledgeId,
	bindingAgentModelId,
	bindingAgentToolsId,
	blockedOrPartialPlatformAgents,
	capabilities,
	completedWorkflowRunCount,
	configManagementRef,
	connectorCenterRef,
	connectorDraftIssues,
	connectorDraftState,
	connectorRuntimeSourceText,
	connectorRuntimeState,
	connectorSaveError,
	connectorSaveSuccess,
	connectorState,
	connectorTestError,
	connectorTestForm,
	connectorTestPassed,
	connectorTestResult,
	connectors,
	connectorsError,
	connectorsLoading,
	continuingApprovalId,
	creatingApproval,
	creatingRunApproval,
	credentialById,
	credentials,
	credentialsLoading,
	currentIdentityLabel,
	dashboardOperations,
	dashboardTodoItems,
	decidingApprovalId,
	defaultAgentTemplate,
	editingAgentId,
	enablingAgentMemoryId,
	enablingAgentWorkflowId,
	enterpriseIdentities,
	enterpriseToolInputConfig,
	failedWorkflowRunCount,
	featuredAgents,
	firstAgentGuidePrimaryStep,
	firstAgentGuideSteps,
	governance,
	governanceError,
	governanceHealthItems,
	governanceLoading,
	governanceRef,
	governedWorkflowItems,
	handleAppCenterDetailPrimaryAction,
	handleAppCenterDetailSecondaryAction,
	handleAppCenterPrimaryAction,
	handleApproveAndRun,
	handleArchiveAgent,
	handleBindAvailableKnowledge,
	handleBindDefaultModel,
	handleBindTemplateTools,
	handleCancelEdit,
	handleClearAgentConversation,
	handleConfigureTemplate,
	handleCopyPlatformConfig,
	handleCreateApproval,
	handleCreateRunApproval,
	handleDecideApproval,
	handleEditAgent,
	handleEditMember,
	handleEnableAgentMemory,
	handleEnableAgentWorkflow,
	handleImportPlatformConfig,
	handleInspectAgentRunAudit,
	handleInspectIdentityApprovals,
	handleInspectIdentityAudit,
	handleInspectIdentityFailures,
	handleInspectMemoryOperationAudit,
	handleInspectTenantApprovals,
	handleInspectTenantAudit,
	handleNextAgentSetupStep,
	handleNextStepPrimaryAction,
	handleOpenMemoryOperation,
	handleOperationAction,
	handlePrepareTenantAgent,
	handlePrimeAgentRunner,
	handlePrimeAgentWorkflow,
	handlePrimePublishedAgent,
	handlePrimeToolApproval,
	handlePublishAgent,
	handlePublishTenantChange,
	handleQuickPublishAgent,
	handleResolveOpsTask,
	handleRunEnterpriseAgent,
	handleRunEnterpriseTool,
	handleRunEnterpriseWorkflow,
	handleRunScenario,
	handleSaveConnectorConfig,
	handleSaveMember,
	handleSaveToolPolicy,
	handleSelectAgentRun,
	handleSelectRunAgent,
	handleStartPublishing,
	handleTestAndSaveConnectorConfig,
	handleTestConnector,
	handleToggleMemberStatus,
	handleTogglePublishList,
	handleToggleWorkflowTemplate,
	handleUseApproval,
	handleUseIdentity,
	handleUseTenant,
	hasErrors,
	identityAccessRows,
	importingPlatformConfig,
	inspectedAppCenterAgent,
	inspectedAppCenterTemplate,
	knowledgeBaseById,
	knowledgeBases,
	lastPublishedAgent,
	launchpadPrimaryStep,
	launchpadReadyCount,
	launchpadState,
	launchpadSteps,
	launchpadTotalCount,
	loadSavedConnectorConfig,
	memberForm,
	membersRef,
	memoryOperationsHitCount,
	memoryOperationsItems,
	memoryOperationsRef,
	memoryOperationsRunCount,
	memoryOperationsSavedCount,
	monitoringHealthState,
	monitoringLoading,
	monitoringStats,
	nextAgentSetupStep,
	nextStepMode,
	nextStepPrimaryDisabled,
	operationsAgentIssueText,
	operationsHeadline,
	opsTasks,
	opsTasksError,
	opsTasksLoading,
	opsTasksSummary,
	orchestrationPrimaryStep,
	orchestrationReadyCount,
	orchestrationWorkbenchSteps,
	partialWorkflowRunCount,
	pendingApprovals,
	platformAgents,
	platformAgentsError,
	platformAgentsLoading,
	platformConfigError,
	platformConfigExport,
	platformConfigImportMode,
	platformConfigImportResult,
	platformConfigImportText,
	platformConfigLoading,
	platformConsoleItems,
	platformError,
	platformLoading,
	platformMemberTenantSummaries,
	platformMembers,
	platformMembersError,
	platformMembersLoading,
	platformStatus,
	policyDecisions,
	primaryAgentSampleQuestion,
	publishAccessMembers,
	publishAccessScopeSummary,
	publishBlocked,
	publishForm,
	publishReleaseIssues,
	publishRoleOptions,
	publishRuntimeSummary,
	publishSelectedModelLabel,
	publishTenant,
	publishedPlatformAgents,
	publishingTemplateId,
	readyPlatformAgents,
	recentAgentTurns,
	recentAuditEvents,
	recentSchedules,
	recentWorkflowRuns,
	recommendedOperationActions,
	refetchAgentRuns,
	refetchApprovals,
	refetchAuditEvents,
	refetchConnectors,
	refetchGovernance,
	refetchMembers,
	refetchOpsTasks,
	refetchPlatform,
	refetchPlatformAgents,
	refetchPlatformConfigExport,
	refetchScenarios,
	refetchToolCatalog,
	refetchWorkflowRuns,
	resolvingOpsTaskCode,
	riskToolItems,
	rolloutPathSteps,
	runningAgent,
	runningTool,
	runningWorkflow,
	runtimeItems,
	savedConnectorConfigs,
	savingConnectorConfig,
	savingMember,
	savingToolPolicy,
	savingWorkflowType,
	scenarios,
	scenariosError,
	scenariosLoading,
	schedulesError,
	schedulesLoading,
	scrollToAgentManagement,
	scrollToAgentRunner,
	scrollToConnectorCenter,
	scrollToGovernance,
	scrollToToolRunner,
	scrollToWorkflowRunner,
	selectedAgentConversation,
	selectedIdentity,
	selectedIdentityAllowedTools,
	selectedIdentityDeniedTools,
	selectedIdentityFailedAuditEvents,
	selectedIdentityPendingApprovals,
	selectedIdentityPendingToolNames,
	selectedIdentityRecentAuditEvents,
	selectedIdentityUserId,
	selectedIdentityWorkspace,
	selectedRunAgent,
	selectedRunAgentAccessAllowed,
	selectedRunAgentAccessLabel,
	selectedRunAgentId,
	selectedRunAgentKnowledgeCount,
	selectedRunAgentKnowledgeLabels,
	selectedRunAgentModelLabel,
	selectedRunAgentReadinessLabel,
	selectedRunAgentReadinessState,
	selectedRunAgentToolCount,
	selectedTemplate,
	selectedTemplateId,
	selectedToolAllowed,
	selectedToolCatalogItem,
	selectedToolConfig,
	selectedToolDecision,
	selectedToolInputKey,
	selectedToolInputValue,
	selectedToolName,
	selectedToolReason,
	selectedWorkflowDisabled,
	selectedWorkflowLastRun,
	selectedWorkflowName,
	selectedWorkflowSteps,
	selectedWorkflowTemplate,
	selectedWorkflowType,
	serverUrl,
	setAgentApprovalId,
	setAgentQuestion,
	setAgentRunError,
	setAgentRunResult,
	setApprovalFilters,
	setApprovalForm,
	setAuditFilters,
	setConnectorTestForm,
	setMemberForm,
	setPlatformConfigImportMode,
	setPlatformConfigImportText,
	setPublishForm,
	setSelectedAppCenterItem,
	setSelectedIdentityUserId,
	setSelectedRunAgentId,
	setSelectedToolName,
	setSelectedWorkflowType,
	setToolApprovalId,
	setToolInputs,
	setToolPolicyDraft,
	setToolPolicySaveError,
	setToolPolicySaveSuccess,
	setToolRunError,
	setWorkflowApprovalId,
	setWorkflowInputs,
	setWorkflowRunError,
	stats,
	subagentTemplates,
	summarizeAuditObject,
	t,
	tenantOverviewItems,
	tenantWorkspaces,
	testingConnector,
	toolApprovalId,
	toolCatalogError,
	toolCatalogLoading,
	toolPolicyDraft,
	toolPolicyMode,
	toolPolicySaveError,
	toolPolicySaveSuccess,
	toolPolicySummary,
	toolRunError,
	toolRunResult,
	toolRunnerRef,
	topOperationsAgents,
	triggerOpsStats,
	triggerOpsSummary,
	updatingMemberId,
	username,
	workbenchActions,
	workbenchIndicators,
	workbenchQuickActions,
	workbenchReadinessItems,
	workbenchRiskItems,
	workflowApprovalId,
	workflowInputs,
	workflowOpsStats,
	workflowOptions,
	workflowPendingApprovals,
	workflowRunCount,
	workflowRunError,
	workflowRunResult,
	workflowRunnerRef,
	workflowRuns,
	workflowRunsError,
	workflowRunsLoading,
	workflowTemplates,
	workflowTemplatesError,
	workflowTemplatesLoading,
}: DashboardViewPageProps) {
	const navigate = useNavigate();
	const NextStepIcon =
		nextStepMode === 'model'
			? KeyRound
			: nextStepMode === 'publish'
				? BotMessageSquare
				: nextStepMode === 'configure'
					? ListChecks
					: nextStepMode === 'governance'
						? ShieldCheck
						: Play;
	const appCenterPrimaryLabel =
		credentials.length === 0
			? t('platform.appCenter.configureModel')
			: readyPlatformAgents.length > 0
				? t('platform.appCenter.runReadyAgent')
				: activePlatformAgents.length === 0
					? t('platform.appCenter.quickPublish')
					: t('platform.appCenter.fixAgents');

	return (
		<main className="h-full overflow-y-auto bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
				<PlatformDashboardOverview
					serverUrl={serverUrl}
					username={username}
					connectionState={hasErrors ? 'partial' : 'ready'}
					stats={stats}
					nextStepMode={nextStepMode}
					nextStepIcon={NextStepIcon}
					nextStepPrimaryDisabled={nextStepPrimaryDisabled}
					publishingTemplateId={publishingTemplateId}
					labels={{
						eyebrow: t('platform.eyebrow'),
						title: t('platform.title'),
						subtitle: t('platform.subtitle'),
						server: t('platform.connection.server'),
						user: t('platform.connection.user'),
						health: t('platform.connection.health'),
						connectionState: hasErrors
							? t('platform.connection.partial')
							: t('platform.connection.connected'),
						nextStepEyebrow: t('platform.nextStep.eyebrow'),
						nextStepTitle: t(`platform.nextStep.${nextStepMode}.title`),
						nextStepDescription: t(
							`platform.nextStep.${nextStepMode}.description`,
						),
						nextStepManual: t('platform.nextStep.publish.manual'),
						nextStepAction: t(`platform.nextStep.${nextStepMode}.action`),
						publishing: t('platform.agentManagement.publishing'),
					}}
					onStartPublishing={handleStartPublishing}
					onPrimaryAction={handleNextStepPrimaryAction}
				/>

				<DashboardWorkbenchSection
					t={t}
					NextStepIcon={NextStepIcon}
					dashboardTodoItems={dashboardTodoItems}
					firstAgentGuidePrimaryStep={firstAgentGuidePrimaryStep}
					firstAgentGuideSteps={firstAgentGuideSteps}
					handleNextStepPrimaryAction={handleNextStepPrimaryAction}
					handleStartPublishing={handleStartPublishing}
					nextStepMode={nextStepMode}
					nextStepPrimaryDisabled={nextStepPrimaryDisabled}
					publishingTemplateId={publishingTemplateId}
					rolloutPathSteps={rolloutPathSteps}
					scrollToAgentRunner={scrollToAgentRunner}
					selectedRunAgent={selectedRunAgent}
					workbenchActions={workbenchActions}
					workbenchIndicators={workbenchIndicators}
					workbenchQuickActions={workbenchQuickActions}
					workbenchReadinessItems={workbenchReadinessItems}
					workbenchRiskItems={workbenchRiskItems}
				/>

				<DashboardLaunchOrchestrationSection
					t={t}
					activePlatformAgents={activePlatformAgents}
					launchpadPrimaryStep={launchpadPrimaryStep}
					launchpadReadyCount={launchpadReadyCount}
					launchpadState={launchpadState}
					launchpadSteps={launchpadSteps}
					launchpadTotalCount={launchpadTotalCount}
					memoryOperationsRef={memoryOperationsRef}
					orchestrationPrimaryStep={orchestrationPrimaryStep}
					orchestrationReadyCount={orchestrationReadyCount}
					orchestrationWorkbenchSteps={orchestrationWorkbenchSteps}
					pendingApprovals={pendingApprovals}
				/>

				<DashboardOperationsSnapshotSection
					t={t}
					handleInspectMemoryOperationAudit={handleInspectMemoryOperationAudit}
					handleOpenMemoryOperation={handleOpenMemoryOperation}
					handleResolveOpsTask={handleResolveOpsTask}
					memoryOperationsHitCount={memoryOperationsHitCount}
					memoryOperationsItems={memoryOperationsItems}
					memoryOperationsRunCount={memoryOperationsRunCount}
					memoryOperationsSavedCount={memoryOperationsSavedCount}
					monitoringHealthState={monitoringHealthState}
					monitoringLoading={monitoringLoading}
					monitoringStats={monitoringStats}
					opsTasks={opsTasks}
					opsTasksError={opsTasksError}
					opsTasksLoading={opsTasksLoading}
					opsTasksSummary={opsTasksSummary}
					recentAgentTurns={recentAgentTurns}
					recentAuditEvents={recentAuditEvents}
					recentWorkflowRuns={recentWorkflowRuns}
					refetchAgentRuns={refetchAgentRuns}
					refetchApprovals={refetchApprovals}
					refetchAuditEvents={refetchAuditEvents}
					refetchGovernance={refetchGovernance}
					refetchOpsTasks={refetchOpsTasks}
					refetchPlatform={refetchPlatform}
					refetchWorkflowRuns={refetchWorkflowRuns}
					resolvingOpsTaskCode={resolvingOpsTaskCode}
					scrollToAgentRunner={scrollToAgentRunner}
					scrollToGovernance={scrollToGovernance}
					scrollToWorkflowRunner={scrollToWorkflowRunner}
					setAgentRunResult={setAgentRunResult}
					setSelectedRunAgentId={setSelectedRunAgentId}
					summarizeAuditObject={summarizeAuditObject}
				/>

				<DashboardApplicationSection
					t={t}
					agentTemplates={agentTemplates}
					activePlatformAgents={activePlatformAgents}
					readyPlatformAgents={readyPlatformAgents}
					pendingApprovals={pendingApprovals}
					appCenterAgents={appCenterAgents}
					inspectedAppCenterAgent={inspectedAppCenterAgent}
					inspectedAppCenterTemplate={inspectedAppCenterTemplate}
					appCenterPrimaryLabel={appCenterPrimaryLabel}
					appCenterPrimaryDisabled={appCenterPrimaryDisabled}
					appCenterDetailResources={appCenterDetailResources}
					appCenterDetailIssues={appCenterDetailIssues}
					appCenterDetailStatus={appCenterDetailStatus}
					agentResourceText={agentResourceText}
					handleAppCenterPrimaryAction={handleAppCenterPrimaryAction}
					setSelectedAppCenterItem={setSelectedAppCenterItem}
					handleConfigureTemplate={handleConfigureTemplate}
					scrollToAgentManagement={scrollToAgentManagement}
					setSelectedRunAgentId={setSelectedRunAgentId}
					handlePrimeAgentRunner={handlePrimeAgentRunner}
					handleEditAgent={handleEditAgent}
					handleUseApproval={handleUseApproval}
					handleAppCenterDetailPrimaryAction={handleAppCenterDetailPrimaryAction}
					handleAppCenterDetailSecondaryAction={
						handleAppCenterDetailSecondaryAction
					}
					scrollToGovernance={scrollToGovernance}
					scenarios={scenarios}
					scenariosLoading={scenariosLoading}
					scenariosError={scenariosError}
					runningWorkflow={runningWorkflow}
					refetchScenarios={refetchScenarios}
					handleRunScenario={handleRunScenario}
				/>

				<DashboardOperationalHealthSection
					t={t}
					governanceHealthItems={governanceHealthItems}
					governanceError={governanceError}
					governanceLoading={governanceLoading}
					refetchGovernance={refetchGovernance}
					scrollToGovernance={scrollToGovernance}
					activePlatformAgents={activePlatformAgents}
					readyPlatformAgents={readyPlatformAgents}
					blockedOrPartialPlatformAgents={blockedOrPartialPlatformAgents}
					topOperationsAgents={topOperationsAgents}
					pendingApprovals={pendingApprovals}
					operationsHeadline={operationsHeadline}
					operationsAgentIssueText={operationsAgentIssueText}
					scrollToAgentManagement={scrollToAgentManagement}
					handlePrimeAgentRunner={handlePrimeAgentRunner}
					handleStartPublishing={handleStartPublishing}
					setSelectedRunAgentId={setSelectedRunAgentId}
					handleEditAgent={handleEditAgent}
					handleUseApproval={handleUseApproval}
				/>

				<DashboardTenantAccessSection
					t={t}
					tenantOverviewItems={tenantOverviewItems}
					selectedIdentity={selectedIdentity}
					selectedIdentityWorkspace={selectedIdentityWorkspace}
					selectedIdentityAllowedTools={selectedIdentityAllowedTools}
					selectedIdentityDeniedTools={selectedIdentityDeniedTools}
					enterpriseIdentities={enterpriseIdentities}
					scrollToConnectorCenter={scrollToConnectorCenter}
					handleUseIdentity={handleUseIdentity}
					handleUseTenant={handleUseTenant}
					handlePrepareTenantAgent={handlePrepareTenantAgent}
					handleInspectTenantApprovals={handleInspectTenantApprovals}
					handleInspectTenantAudit={handleInspectTenantAudit}
					handleInspectIdentityAudit={handleInspectIdentityAudit}
					scrollToGovernance={scrollToGovernance}
					accessControlStats={accessControlStats}
					governance={governance}
					governanceLoading={governanceLoading}
					governanceError={governanceError}
					accessTenantSummaries={accessTenantSummaries}
					identityAccessRows={identityAccessRows}
					toolPolicyMode={toolPolicyMode}
					selectedIdentityPendingApprovals={selectedIdentityPendingApprovals}
					selectedIdentityFailedAuditEvents={selectedIdentityFailedAuditEvents}
					selectedIdentityRecentAuditEvents={selectedIdentityRecentAuditEvents}
					creatingRunApproval={creatingRunApproval}
					refetchGovernance={refetchGovernance}
					handleCreateRunApproval={handleCreateRunApproval}
					setSelectedIdentityUserId={setSelectedIdentityUserId}
					handleUseApproval={handleUseApproval}
					handleInspectIdentityApprovals={handleInspectIdentityApprovals}
					handleInspectIdentityFailures={handleInspectIdentityFailures}
				/>

				<DashboardWorkflowAutomationSection
					t={t}
					activePlatformAgents={activePlatformAgents}
					agents={agents}
					creatingRunApproval={creatingRunApproval}
					handleCreateRunApproval={handleCreateRunApproval}
					handleRunEnterpriseWorkflow={handleRunEnterpriseWorkflow}
					handleUseApproval={handleUseApproval}
					navigate={navigate}
					recentSchedules={recentSchedules}
					runningWorkflow={runningWorkflow}
					schedulesError={schedulesError}
					schedulesLoading={schedulesLoading}
					scrollToGovernance={scrollToGovernance}
					scrollToWorkflowRunner={scrollToWorkflowRunner}
					selectedWorkflowDisabled={selectedWorkflowDisabled}
					selectedWorkflowLastRun={selectedWorkflowLastRun}
					selectedWorkflowName={selectedWorkflowName}
					selectedWorkflowSteps={selectedWorkflowSteps}
					selectedWorkflowTemplate={selectedWorkflowTemplate}
					triggerOpsStats={triggerOpsStats}
					triggerOpsSummary={triggerOpsSummary}
					workflowOpsStats={workflowOpsStats}
					workflowPendingApprovals={workflowPendingApprovals}
				/>

				<DashboardOperationsConsoleSection
					t={t}
					NextStepIcon={NextStepIcon}
					approvedApprovalCount={approvedApprovalCount}
					auditEventCount={auditEventCount}
					completedWorkflowRunCount={completedWorkflowRunCount}
					dashboardOperations={dashboardOperations}
					dashboardTodoItems={dashboardTodoItems}
					failedWorkflowRunCount={failedWorkflowRunCount}
					governedWorkflowItems={governedWorkflowItems}
					handleNextStepPrimaryAction={handleNextStepPrimaryAction}
					handleOperationAction={handleOperationAction}
					nextStepMode={nextStepMode}
					nextStepPrimaryDisabled={nextStepPrimaryDisabled}
					partialWorkflowRunCount={partialWorkflowRunCount}
					pendingApprovals={pendingApprovals}
					platformConsoleItems={platformConsoleItems}
					recentAuditEvents={recentAuditEvents}
					recentWorkflowRuns={recentWorkflowRuns}
					recommendedOperationActions={recommendedOperationActions}
					riskToolItems={riskToolItems}
					scrollToAgentRunner={scrollToAgentRunner}
					scrollToGovernance={scrollToGovernance}
					scrollToToolRunner={scrollToToolRunner}
					scrollToWorkflowRunner={scrollToWorkflowRunner}
					workflowRunCount={workflowRunCount}
					workflowTemplates={workflowTemplates}
				/>

				<DashboardAgentRunNowSection
					t={t}
					currentIdentityLabel={currentIdentityLabel}
					defaultAgentTemplate={defaultAgentTemplate}
					handlePrimeAgentRunner={handlePrimeAgentRunner}
					handleQuickPublishAgent={handleQuickPublishAgent}
					handleStartPublishing={handleStartPublishing}
					platformAgents={platformAgents}
					platformAgentsLoading={platformAgentsLoading}
					platformStatus={platformStatus}
					primaryAgentSampleQuestion={primaryAgentSampleQuestion}
					publishingTemplateId={publishingTemplateId}
					scrollToAgentRunner={scrollToAgentRunner}
					selectedRunAgent={selectedRunAgent}
					selectedRunAgentKnowledgeCount={selectedRunAgentKnowledgeCount}
					selectedRunAgentModelLabel={selectedRunAgentModelLabel}
					selectedRunAgentToolCount={selectedRunAgentToolCount}
				/>

				<DashboardTenantGovernancePanelSection
					t={t}
					availableToolItems={availableToolItems}
					connectors={connectors}
					connectorsLoading={connectorsLoading}
					currentIdentityLabel={currentIdentityLabel}
					enterpriseIdentities={enterpriseIdentities}
					handleInspectIdentityAudit={handleInspectIdentityAudit}
					handleSaveToolPolicy={handleSaveToolPolicy}
					handleUseIdentity={handleUseIdentity}
					savingToolPolicy={savingToolPolicy}
					scrollToAgentRunner={scrollToAgentRunner}
					selectedIdentity={selectedIdentity}
					selectedIdentityAllowedTools={selectedIdentityAllowedTools}
					selectedIdentityDeniedTools={selectedIdentityDeniedTools}
					selectedIdentityPendingToolNames={selectedIdentityPendingToolNames}
					selectedIdentityWorkspace={selectedIdentityWorkspace}
					setAgentQuestion={setAgentQuestion}
					setSelectedIdentityUserId={setSelectedIdentityUserId}
					setToolPolicyDraft={setToolPolicyDraft}
					setToolPolicySaveError={setToolPolicySaveError}
					setToolPolicySaveSuccess={setToolPolicySaveSuccess}
					toolPolicyDraft={toolPolicyDraft}
					toolPolicyMode={toolPolicyMode}
					toolPolicySaveError={toolPolicySaveError}
					toolPolicySaveSuccess={toolPolicySaveSuccess}
					toolPolicySummary={toolPolicySummary}
				/>

				<DashboardConnectorsSection
					t={t}
					activeConnectorTenant={activeConnectorTenant}
					activeSavedConnectorConfig={activeSavedConnectorConfig}
					connectorCenterRef={connectorCenterRef}
					connectorDraftIssues={connectorDraftIssues}
					connectorDraftState={connectorDraftState}
					connectorRuntimeSourceText={connectorRuntimeSourceText}
					connectorRuntimeState={connectorRuntimeState}
					connectorSaveError={connectorSaveError}
					connectorSaveSuccess={connectorSaveSuccess}
					connectorState={connectorState}
					connectorTestError={connectorTestError}
					connectorTestForm={connectorTestForm}
					connectorTestPassed={connectorTestPassed}
					connectorTestResult={connectorTestResult}
					connectors={connectors}
					connectorsError={connectorsError}
					connectorsLoading={connectorsLoading}
					handleSaveConnectorConfig={handleSaveConnectorConfig}
					handleTestAndSaveConnectorConfig={handleTestAndSaveConnectorConfig}
					handleTestConnector={handleTestConnector}
					loadSavedConnectorConfig={loadSavedConnectorConfig}
					refetchConnectors={refetchConnectors}
					savedConnectorConfigs={savedConnectorConfigs}
					savingConnectorConfig={savingConnectorConfig}
					setConnectorTestForm={setConnectorTestForm}
					tenantWorkspaces={tenantWorkspaces}
					testingConnector={testingConnector}
				/>

				<DashboardMembersSection
					t={t}
					activeMemberCount={activeMemberCount}
					activePlatformAgents={activePlatformAgents}
					handleEditMember={handleEditMember}
					handleSaveMember={handleSaveMember}
					handleToggleMemberStatus={handleToggleMemberStatus}
					memberForm={memberForm}
					membersRef={membersRef}
					pendingApprovals={pendingApprovals}
					platformMemberTenantSummaries={platformMemberTenantSummaries}
					platformMembers={platformMembers}
					platformMembersError={platformMembersError}
					platformMembersLoading={platformMembersLoading}
					refetchMembers={refetchMembers}
					savingMember={savingMember}
					setMemberForm={setMemberForm}
					updatingMemberId={updatingMemberId}
				/>
				<DashboardAgentManagementSection
					agentManagementRef={agentManagementRef}
					agentTemplateStepRef={agentTemplateStepRef}
					agentModelStepRef={agentModelStepRef}
					agentKnowledgeStepRef={agentKnowledgeStepRef}
					agentToolsStepRef={agentToolsStepRef}
					agentRuntimeStepRef={agentRuntimeStepRef}
					platformAgents={platformAgents}
					platformAgentsLoading={platformAgentsLoading}
					platformAgentsError={platformAgentsError}
					agentOpsSummary={agentOpsSummary}
					agentReleasePipeline={agentReleasePipeline}
					selectedRunAgent={selectedRunAgent}
					selectedRunAgentReadinessState={selectedRunAgentReadinessState}
					selectedRunAgentReadinessLabel={selectedRunAgentReadinessLabel}
					selectedRunAgentModelLabel={selectedRunAgentModelLabel}
					selectedRunAgentKnowledgeCount={selectedRunAgentKnowledgeCount}
					selectedRunAgentToolCount={selectedRunAgentToolCount}
					agentTemplates={agentTemplates}
					selectedTemplateId={selectedTemplateId}
					selectedTemplate={selectedTemplate}
					publishingTemplateId={publishingTemplateId}
					editingAgentId={editingAgentId}
					agentSetupSteps={agentSetupSteps}
					nextAgentSetupStep={nextAgentSetupStep}
					publishForm={publishForm}
					platformStatus={platformStatus}
					credentials={credentials}
					credentialsLoading={credentialsLoading}
					credentialById={credentialById}
					knowledgeBases={knowledgeBases}
					knowledgeBaseById={knowledgeBaseById}
					publishTenant={publishTenant}
					publishAccessMembers={publishAccessMembers}
					publishRoleOptions={publishRoleOptions}
					publishBlocked={publishBlocked}
					publishSelectedModelLabel={publishSelectedModelLabel}
					publishAccessScopeSummary={publishAccessScopeSummary}
					publishRuntimeSummary={publishRuntimeSummary}
					publishReleaseIssues={publishReleaseIssues}
					publishedPlatformAgents={publishedPlatformAgents}
					activePlatformAgents={activePlatformAgents}
					selectedRunAgentId={selectedRunAgentId}
					selectedIdentity={selectedIdentity}
					archivingAgentId={archivingAgentId}
					bindingAgentModelId={bindingAgentModelId}
					bindingAgentKnowledgeId={bindingAgentKnowledgeId}
					bindingAgentToolsId={bindingAgentToolsId}
					enablingAgentMemoryId={enablingAgentMemoryId}
					enablingAgentWorkflowId={enablingAgentWorkflowId}
					setPublishForm={setPublishForm}
					refetchPlatformAgents={refetchPlatformAgents}
					handleNextAgentSetupStep={handleNextAgentSetupStep}
					scrollToAgentRunner={scrollToAgentRunner}
					handlePrimeAgentWorkflow={handlePrimeAgentWorkflow}
					handleEditAgent={handleEditAgent}
					scrollToGovernance={scrollToGovernance}
					handleConfigureTemplate={handleConfigureTemplate}
					handleCancelEdit={handleCancelEdit}
					handlePublishTenantChange={handlePublishTenantChange}
					handleTogglePublishList={handleTogglePublishList}
					handlePublishAgent={handlePublishAgent}
					handleBindDefaultModel={handleBindDefaultModel}
					handleBindAvailableKnowledge={handleBindAvailableKnowledge}
					handleBindTemplateTools={handleBindTemplateTools}
					handlePrimeToolApproval={handlePrimeToolApproval}
					handleEnableAgentMemory={handleEnableAgentMemory}
					handleEnableAgentWorkflow={handleEnableAgentWorkflow}
					handleArchiveAgent={handleArchiveAgent}
					handlePrimePublishedAgent={handlePrimePublishedAgent}
					agentAccessAllowed={agentAccessAllowed}
					t={t}
					cn={cn}
				/>

				<DashboardRuntimeStatusSection
					t={t}
					governanceRef={governanceRef}
					platformLoading={platformLoading}
					platformStatus={platformStatus}
					platformError={platformError}
					runtimeItems={runtimeItems}
					refetchPlatform={refetchPlatform}
				/>

				<AgentQuickStartPanel
					agentsLoading={agentsLoading}
					featuredAgents={featuredAgents}
					onNavigate={navigate}
					labels={{
						agentsTitle: t('platform.agents.title'),
						agentsDescription: t('platform.agents.description'),
						openChat: t('platform.actions.openChat'),
						emptyAgents: t('platform.agents.empty'),
						noPrompt: t('platform.agents.noPrompt'),
						openAgent: t('platform.actions.openAgent'),
						editable: t('platform.agents.editable'),
						readOnly: t('common.readOnly'),
						invitable: t('platform.agents.invitable'),
						quickActionsTitle: t('platform.quickActions.title'),
						quickActionsDescription: t('platform.quickActions.description'),
						configureModel: t('platform.actions.configureModel'),
						manageKnowledge: t('platform.actions.manageKnowledge'),
						manageWorkflow: t('platform.actions.manageWorkflow'),
					}}
				/>

				<PolicySubagentsPanel
					platformLoading={platformLoading}
					hasPlatformStatus={Boolean(platformStatus)}
					platformError={platformError}
					toolPolicyMode={toolPolicyMode}
					policyDecisions={policyDecisions}
					subagentTemplates={subagentTemplates}
					labels={{
						policyTitle: t('platform.policy.title'),
						policyDescription: t('platform.policy.description'),
						policyMode: t('platform.policy.mode'),
						policyError: t('platform.policy.error'),
						policyEmpty: t('platform.policy.empty'),
						policyAllowed: t('platform.policy.allowed'),
						policyDenied: t('platform.policy.denied'),
						subagentsTitle: t('platform.subagents.title'),
						subagentsDescription: t('platform.subagents.description'),
						subagentsError: t('platform.subagents.error'),
						subagentsEmpty: t('platform.subagents.empty'),
						subagentPermission: t('platform.subagents.permission'),
						subagentOverrideEnabled: t('platform.subagents.overrideEnabled'),
						subagentOverrideDisabled: t('platform.subagents.overrideDisabled'),
					}}
				/>

				<AgentRunnerPanel
					sectionRef={agentRunnerRef}
					agents={activePlatformAgents}
					selectedAgent={selectedRunAgent}
					selectedAgentId={selectedRunAgentId}
					selectedAgentModelLabel={selectedRunAgentModelLabel}
					selectedAgentKnowledgeLabels={selectedRunAgentKnowledgeLabels}
					selectedAgentToolCount={selectedRunAgentToolCount}
					selectedAgentAccessAllowed={selectedRunAgentAccessAllowed}
					selectedAgentAccessLabel={selectedRunAgentAccessLabel}
					lastPublishedAgent={lastPublishedAgent}
					question={agentQuestion}
					approvalId={agentApprovalId}
					sampleQuestions={agentSampleQuestions}
					conversation={selectedAgentConversation}
					activeResult={agentRunResult}
					conversationLoading={agentRunsLoading}
					conversationError={agentRunsError}
					running={runningAgent}
					runError={agentRunError}
					resultToolCalls={agentToolCalls}
					resultToolCallBadgeText={agentToolCallBadgeText}
					resultRoutingLabel={agentRoutingLabel}
					resultRoutingText={agentRoutingText}
					resultConnectorSourceText={agentRunConnectorSourceText}
					resultModelLabel={agentRunModelLabel}
					resultKnowledgeLabels={agentRunKnowledgeLabels}
					knowledgeBaseById={knowledgeBaseById}
					onSelectAgent={handleSelectRunAgent}
					onQuestionChange={(value) => {
						setAgentQuestion(value);
						setAgentRunError(null);
					}}
					onApprovalIdChange={(value) => {
						setAgentApprovalId(value);
						setAgentRunError(null);
					}}
					onRun={handleRunEnterpriseAgent}
					onClearConversation={handleClearAgentConversation}
					onSelectConversationTurn={(turn) => {
						void handleSelectAgentRun(turn as never);
					}}
					onInspectAudit={handleInspectAgentRunAudit}
					onOpenGovernance={scrollToGovernance}
					t={t}
				/>

				<DashboardWorkflowRunnerSection
					t={t}
					creatingRunApproval={creatingRunApproval}
					handleCreateRunApproval={handleCreateRunApproval}
					handleRunEnterpriseWorkflow={handleRunEnterpriseWorkflow}
					handleToggleWorkflowTemplate={handleToggleWorkflowTemplate}
					platformError={platformError}
					runningWorkflow={runningWorkflow}
					savingWorkflowType={savingWorkflowType}
					selectedWorkflowDisabled={selectedWorkflowDisabled}
					selectedWorkflowTemplate={selectedWorkflowTemplate}
					selectedWorkflowType={selectedWorkflowType}
					setSelectedWorkflowType={setSelectedWorkflowType}
					setWorkflowApprovalId={setWorkflowApprovalId}
					setWorkflowInputs={setWorkflowInputs}
					setWorkflowRunError={setWorkflowRunError}
					summarizeAuditObject={summarizeAuditObject}
					workflowApprovalId={workflowApprovalId}
					workflowInputs={workflowInputs}
					workflowOptions={workflowOptions}
					workflowRunError={workflowRunError}
					workflowRunResult={workflowRunResult}
					workflowRunnerRef={workflowRunnerRef}
					workflowRuns={workflowRuns}
					workflowRunsError={workflowRunsError}
					workflowRunsLoading={workflowRunsLoading}
					workflowTemplates={workflowTemplates}
					workflowTemplatesError={workflowTemplatesError}
					workflowTemplatesLoading={workflowTemplatesLoading}
				/>

				<ApprovalsPanel
					approvalForm={approvalForm}
					onApprovalFormChange={setApprovalForm}
					approvalFilters={approvalFilters}
					onApprovalFiltersChange={setApprovalFilters}
					approvalSummary={approvalSummary}
					approvalRequests={approvalRequests}
					approvalLoading={approvalLoading}
					approvalError={approvalError}
					creatingApproval={creatingApproval}
					decidingApprovalId={decidingApprovalId}
					continuingApprovalId={continuingApprovalId}
					workflowOptions={workflowOptions}
					availableToolItems={availableToolItems}
					activePlatformAgents={activePlatformAgents}
					selectedRunAgentId={selectedRunAgentId}
					selectedIdentityUserId={selectedIdentityUserId}
					username={username}
					currentTenant={platformStatus?.current_user.tenant}
					currentUserId={platformStatus?.current_user.user_id}
					toolInputConfig={enterpriseToolInputConfig}
					onCreateApproval={handleCreateApproval}
					onRefetchApprovals={refetchApprovals}
					onApproveAndRun={handleApproveAndRun}
					onDecideApproval={handleDecideApproval}
					onUseApproval={handleUseApproval}
					summarizeAuditObject={summarizeAuditObject}
					t={t}
				/>

				<ToolCatalogPanel
					sectionRef={configManagementRef}
					availableToolItems={availableToolItems}
					publishedPlatformAgents={publishedPlatformAgents}
					toolCatalogLoading={toolCatalogLoading}
					toolCatalogError={toolCatalogError}
					onRefetchToolCatalog={refetchToolCatalog}
					t={t}
				/>

				<ToolRunnerPanel
					sectionRef={toolRunnerRef}
					selectedToolName={selectedToolName}
					availableToolItems={availableToolItems}
					toolCatalogLoading={toolCatalogLoading}
					selectedToolConfig={selectedToolConfig}
					selectedToolCatalogItem={selectedToolCatalogItem}
					selectedToolInputValue={selectedToolInputValue}
					selectedToolInputKey={selectedToolInputKey}
					toolApprovalId={toolApprovalId}
					selectedToolDecision={selectedToolDecision}
					selectedToolAllowed={selectedToolAllowed}
					selectedToolReason={selectedToolReason}
					creatingRunApproval={creatingRunApproval}
					platformError={platformError}
					runningTool={runningTool}
					toolRunError={toolRunError}
					toolRunResult={toolRunResult}
					onSelectedToolNameChange={setSelectedToolName}
					onToolRunErrorChange={setToolRunError}
					onToolInputsChange={setToolInputs}
					onToolApprovalIdChange={setToolApprovalId}
					onCreateRunApproval={handleCreateRunApproval}
					onRunEnterpriseTool={handleRunEnterpriseTool}
					t={t}
				/>

				<AuditEventsPanel
					auditFilters={auditFilters}
					activePlatformAgents={activePlatformAgents}
					availableToolItems={availableToolItems}
					currentTenant={platformStatus?.current_user.tenant}
					currentUserId={platformStatus?.current_user.user_id}
					username={username}
					auditLoading={auditLoading}
					auditError={auditError}
					auditEvents={auditEvents}
					auditStats={auditStats}
					onAuditFiltersChange={setAuditFilters}
					onRefetchAuditEvents={refetchAuditEvents}
					summarizeAuditObject={summarizeAuditObject}
					t={t}
				/>

				<ConfigManagementPanel
					platformConfigExport={platformConfigExport}
					platformConfigLoading={platformConfigLoading}
					platformConfigError={platformConfigError}
					platformConfigImportResult={platformConfigImportResult}
					platformConfigImportMode={platformConfigImportMode}
					platformConfigImportText={platformConfigImportText}
					importingPlatformConfig={importingPlatformConfig}
					onRefetchPlatformConfigExport={refetchPlatformConfigExport}
					onCopyPlatformConfig={handleCopyPlatformConfig}
					onImportPlatformConfig={handleImportPlatformConfig}
					onPlatformConfigImportModeChange={setPlatformConfigImportMode}
					onPlatformConfigImportTextChange={setPlatformConfigImportText}
					t={t}
				/>

				<CapabilitiesPanel capabilities={capabilities} t={t} />
			</div>
		</main>
	);
}
