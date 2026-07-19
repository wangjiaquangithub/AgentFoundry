// @ts-nocheck

import {
	AlertTriangle,
	BotMessageSquare,
	CheckCircle2,
	Database,
	KeyRound,
	ListChecks,
	Play,
	RefreshCcw,
	Save,
	ShieldCheck,
	XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { AgentManagementPanel } from './AgentManagementPanel';
import { AgentQuickStartPanel } from './AgentQuickStartPanel';
import { AgentRunnerPanel } from './AgentRunnerPanel';
import { ApprovalsPanel } from './ApprovalsPanel';
import { AuditEventsPanel } from './AuditEventsPanel';
import { CapabilitiesPanel } from './CapabilitiesPanel';
import { ConfigManagementPanel } from './ConfigManagementPanel';
import { DashboardAgentRunNowSection } from './DashboardAgentRunNowSection';
import { DashboardApplicationSection } from './DashboardApplicationSection';
import { DashboardLaunchOrchestrationSection } from './DashboardLaunchOrchestrationSection';
import { DashboardMembersSection } from './DashboardMembersSection';
import { DashboardOperationalHealthSection } from './DashboardOperationalHealthSection';
import { DashboardOperationsConsoleSection } from './DashboardOperationsConsoleSection';
import { DashboardOperationsSnapshotSection } from './DashboardOperationsSnapshotSection';
import { DashboardTenantAccessSection } from './DashboardTenantAccessSection';
import { DashboardTenantGovernancePanelSection } from './DashboardTenantGovernancePanelSection';
import { DashboardWorkflowAutomationSection } from './DashboardWorkflowAutomationSection';
import { DashboardWorkbenchSection } from './DashboardWorkbenchSection';
import { PlatformDashboardOverview } from './PlatformDashboardOverview';
import { PolicySubagentsPanel } from './PolicySubagentsPanel';
import { RuntimeStatusPanel } from './RuntimeStatusPanel';
import { ToolCatalogPanel } from './ToolCatalogPanel';
import { ToolRunnerPanel } from './ToolRunnerPanel';
import { WorkflowRunnerPanel } from './WorkflowRunnerPanel';
import { PlatformNotice, StateBadge } from './common';
import {
	countArrayField,
	credentialLabel,
	formatTimestamp,
	knowledgeBaseLabel,
	normalizeWorkflowInputs,
} from '../platform-utils';
import { workflowInputsWithValue } from '../platform-agent-runner';

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
	const connectorDraftStatusLabel =
		connectorDraftIssues.length > 0
			? t('platform.connectors.draftInvalid')
			: connectorDraftState === 'ready'
				? t('platform.connectors.draftSaved')
				: activeSavedConnectorConfig
					? t('platform.connectors.draftChanged')
					: t('platform.connectors.draftNew');
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

				<section
					ref={connectorCenterRef}
					className="grid gap-4 rounded-lg border bg-muted/10 p-4"
				>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<h2 className="text-base font-semibold">
								{t('platform.connectors.title')}
							</h2>
							<p className="text-sm text-muted-foreground">
								{t('platform.connectors.description')}
							</p>
						</div>
						<Button
							size="sm"
							variant="outline"
							onClick={() => void refetchConnectors()}
							disabled={connectorsLoading}
						>
							<RefreshCcw className={cn(connectorsLoading && 'animate-spin')} />
							{t('platform.actions.refreshStatus')}
						</Button>
					</div>

					{connectorsError ? (
						<PlatformNotice>{t('platform.connectors.loadError')}</PlatformNotice>
					) : null}

					{connectorsLoading && !connectors ? (
						<div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
							<Skeleton className="h-48 w-full" />
							<Skeleton className="h-48 w-full" />
						</div>
					) : connectors ? (
						<>
							<div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
								<div className="grid gap-3 rounded-lg border bg-background p-3">
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-center gap-2">
											<div className="flex size-9 items-center justify-center rounded-lg border bg-muted/30">
												<Database className="size-4 text-muted-foreground" />
											</div>
											<div className="min-w-0">
												<h3 className="text-sm font-medium">
													{t('platform.connectors.current')}
												</h3>
												<p className="truncate font-mono text-xs text-muted-foreground">
													{connectors.current.name}
												</p>
											</div>
										</div>
										<StateBadge
											state={connectorState}
											label={connectors.current.status}
										/>
									</div>
									<div className="grid gap-2 text-sm">
										<div className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2">
											<span className="text-muted-foreground">
												{t('platform.connectors.mode')}
											</span>
											<span className="font-mono text-xs">
												{connectors.current.mode}
											</span>
										</div>
										<div className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2">
											<span className="text-muted-foreground">
												{t('platform.connectors.status')}
											</span>
											<span className="font-mono text-xs">
												{connectors.current.status}
											</span>
										</div>
									</div>
									<p className="text-sm leading-6 text-muted-foreground">
										{connectors.current.message}
									</p>
									<div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-sm">
										<div className="flex items-center justify-between gap-3">
											<div>
												<p className="font-medium">
													{t('platform.connectors.runtime')}
												</p>
												<p className="text-xs text-muted-foreground">
													{t('platform.connectors.runtimeDescription')}
												</p>
											</div>
											<StateBadge
												state={connectorRuntimeState}
												label={
													connectors.runtime.saved_config_enabled
														? t('platform.connectors.runtimeSavedConfigEnabled')
														: t('platform.connectors.runtimeSavedConfigDisabled')
												}
											/>
										</div>
										<div className="grid gap-2 sm:grid-cols-3">
											<div className="rounded-md bg-background px-3 py-2">
												<p className="text-xs text-muted-foreground">
													{t('platform.connectors.runtimeTenant')}
												</p>
												<p className="truncate font-mono text-xs">
													{connectors.runtime.tenant}
												</p>
											</div>
											<div className="rounded-md bg-background px-3 py-2">
												<p className="text-xs text-muted-foreground">
													{t('platform.connectors.runtimeConnector')}
												</p>
												<p className="truncate font-mono text-xs">
													{connectors.runtime.connector}
												</p>
											</div>
											<div className="rounded-md bg-background px-3 py-2">
												<p className="text-xs text-muted-foreground">
													{t('platform.connectors.runtimeSource')}
												</p>
												<p className="truncate text-xs">
													{connectorRuntimeSourceText}
												</p>
											</div>
										</div>
									</div>
								</div>

								<div className="grid gap-3 rounded-lg border bg-background p-3">
									<div className="flex items-center justify-between gap-3">
										<h3 className="text-sm font-medium">
											{t('platform.connectors.environment')}
										</h3>
										<Badge variant="outline">{connectors.env.length}</Badge>
									</div>
									<div className="grid gap-2">
										{connectors.env.map((envVar) => (
											<div
												key={envVar.name}
												className="grid gap-2 rounded-md border bg-muted/10 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
											>
												<div className="min-w-0">
													<div className="flex flex-wrap items-center gap-2">
														<span className="break-all font-mono text-xs">
															{envVar.name}
														</span>
														<Badge
															variant="outline"
															className={cn(
																envVar.configured
																	? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
																	: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
															)}
														>
															{envVar.configured
																? t('platform.connectors.configured')
																: t('platform.connectors.missing')}
														</Badge>
														<Badge variant="secondary">
															{envVar.required
																? t('platform.connectors.required')
																: t('platform.connectors.optional')}
														</Badge>
														{envVar.secret ? (
															<Badge variant="outline">
																{t('platform.connectors.secret')}
															</Badge>
														) : null}
													</div>
													{envVar.description ? (
														<p className="mt-1 text-xs text-muted-foreground">
															{envVar.description}
														</p>
													) : null}
												</div>
											</div>
										))}
									</div>
								</div>
							</div>

							<div className="grid gap-3 rounded-lg border bg-background p-3">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<h3 className="text-sm font-medium">
											{t('platform.connectors.testTitle')}
										</h3>
										<p className="mt-1 text-xs text-muted-foreground">
											{t('platform.connectors.testDescription')}
										</p>
									</div>
									{connectorTestResult ? (
										<StateBadge
											state={
												connectorTestResult.status === 'success'
													? 'ready'
													: connectorTestResult.status === 'partial'
														? 'partial'
														: 'todo'
											}
											label={connectorTestResult.status}
										/>
									) : null}
								</div>

								<div className="grid gap-3 rounded-md border bg-muted/10 p-3">
									<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
										<div>
											<h4 className="text-sm font-medium">
												{t('platform.connectors.savedConfigs')}
											</h4>
											<p className="mt-1 text-xs text-muted-foreground">
												{t('platform.connectors.savedConfigsDescription')}
											</p>
										</div>
										<Badge variant="outline">{savedConnectorConfigs.length}</Badge>
									</div>
									{savedConnectorConfigs.length > 0 ? (
										<div className="grid gap-2">
											{savedConnectorConfigs.map((config) => (
												<div
													key={config.tenant}
													className="grid gap-3 rounded-md border bg-background p-3 lg:grid-cols-[minmax(0,1fr)_auto]"
												>
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2">
															<Badge variant="secondary">{config.tenant}</Badge>
															<Badge
																variant="outline"
																className={cn(
																	config.enabled
																		? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
																		: 'border-slate-500/30 bg-slate-500/10 text-slate-700',
																)}
															>
																{config.enabled
																	? t('platform.connectors.enabled')
																	: t('platform.connectors.disabled')}
															</Badge>
															<Badge
																variant="outline"
																className={cn(
																	config.token_configured
																		? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
																		: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
																)}
															>
																{config.token_configured
																	? t('platform.connectors.tokenConfigured')
																	: t('platform.connectors.tokenNotConfigured')}
															</Badge>
														</div>
														<div className="mt-2 truncate font-mono text-xs text-muted-foreground">
															{config.base_url}
														</div>
														<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
															<span>
																{t('platform.connectors.updatedAt')}:{' '}
																{formatTimestamp(config.updated_at)}
															</span>
															<span>
																{t('platform.connectors.updatedBy')}:{' '}
																{config.updated_by || '-'}
															</span>
														</div>
													</div>
													<div className="flex items-center justify-end">
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() => loadSavedConnectorConfig(config)}
														>
															{t('platform.connectors.loadSavedConfig')}
														</Button>
													</div>
												</div>
											))}
										</div>
									) : (
										<div className="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
											{t('platform.connectors.savedConfigsEmpty')}
										</div>
									)}
								</div>

								<div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
									<div className="grid gap-3 rounded-md border bg-muted/10 p-3 lg:col-span-2">
										<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
											<div>
												<h4 className="text-sm font-medium">
													{t('platform.connectors.draftTitle')}
												</h4>
												<p className="mt-1 text-xs text-muted-foreground">
													{t('platform.connectors.draftDescription', {
														tenant: activeConnectorTenant,
													})}
												</p>
											</div>
											<StateBadge
												state={connectorDraftState}
												label={connectorDraftStatusLabel}
											/>
										</div>
										<div className="grid gap-2 sm:grid-cols-3">
											<div className="rounded-md bg-background px-3 py-2">
												<p className="text-xs text-muted-foreground">
													{t('platform.connectors.draftTenant')}
												</p>
												<p className="truncate font-mono text-xs">
													{activeConnectorTenant}
												</p>
											</div>
											<div className="rounded-md bg-background px-3 py-2">
												<p className="text-xs text-muted-foreground">
													{t('platform.connectors.draftToken')}
												</p>
												<p className="truncate text-xs">
													{connectorTestForm.token.trim()
														? t('platform.connectors.tokenWillUpdate')
														: activeSavedConnectorConfig?.token_configured
															? t('platform.connectors.tokenConfigured')
															: t('platform.connectors.tokenNotConfigured')}
												</p>
											</div>
											<div className="rounded-md bg-background px-3 py-2">
												<p className="text-xs text-muted-foreground">
													{t('platform.connectors.draftTest')}
												</p>
												<p className="truncate text-xs">
													{connectorTestPassed
														? t('platform.connectors.testPassed')
														: connectorTestResult
															? t('platform.connectors.testNotPassed')
															: t('platform.connectors.testNotRun')}
												</p>
											</div>
										</div>
										{connectorDraftIssues.length > 0 ? (
											<div className="grid gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
												{connectorDraftIssues.map((issue) => (
													<div key={issue} className="flex items-start gap-2">
														<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
														<span>{issue}</span>
													</div>
												))}
											</div>
										) : null}
									</div>

									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.baseUrl')}
										</span>
										<Input
											value={connectorTestForm.base_url}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													base_url: event.target.value,
												}))
											}
											placeholder="https://api.example.com"
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.token')}
										</span>
										<Input
											type="password"
											value={connectorTestForm.token}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													token: event.target.value,
												}))
											}
											placeholder="Bearer token"
										/>
									</label>
								</div>

								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.tenant')}
										</span>
										<Input
											value={connectorTestForm.tenant}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													tenant: event.target.value,
												}))
											}
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.policyKeyword')}
										</span>
										<Input
											value={connectorTestForm.policy_keyword}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													policy_keyword: event.target.value,
												}))
											}
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.ticketId')}
										</span>
										<Input
											value={connectorTestForm.ticket_id}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													ticket_id: event.target.value,
												}))
											}
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.department')}
										</span>
										<Input
											value={connectorTestForm.department}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													department: event.target.value,
												}))
											}
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.timeoutSeconds')}
										</span>
										<Input
											type="number"
											min="1"
											step="0.5"
											value={connectorTestForm.timeout_seconds}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													timeout_seconds: event.target.value,
												}))
											}
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.status')}
										</span>
										<div className="flex h-9 items-center justify-between gap-3 rounded-md border bg-background px-3">
											<span className="text-xs text-muted-foreground">
												{connectorTestForm.enabled
													? t('platform.connectors.enabled')
													: t('platform.connectors.disabled')}
											</span>
											<Switch
												size="sm"
												checked={connectorTestForm.enabled}
												onCheckedChange={(checked) =>
													setConnectorTestForm((previous) => ({
														...previous,
														enabled: checked,
													}))
												}
											/>
										</div>
									</label>
								</div>

								<div className="grid gap-3 lg:grid-cols-3">
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.policyPath')}
										</span>
										<Input
											value={connectorTestForm.policy_path}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													policy_path: event.target.value,
												}))
											}
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.ticketPath')}
										</span>
										<Input
											value={connectorTestForm.ticket_path}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													ticket_path: event.target.value,
												}))
											}
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.metricsPath')}
										</span>
										<Input
											value={connectorTestForm.metrics_path}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													metrics_path: event.target.value,
												}))
											}
										/>
									</label>
								</div>

								<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<p className="text-xs text-muted-foreground">
										{t('platform.connectors.applyEnvHint')}
									</p>
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={() => void handleSaveConnectorConfig()}
											disabled={savingConnectorConfig || connectorDraftIssues.length > 0}
										>
											<Save
												className={cn(savingConnectorConfig && 'animate-pulse')}
											/>
											{savingConnectorConfig
												? t('platform.connectors.saving')
												: t('platform.connectors.save')}
										</Button>
										<Button
											type="button"
											size="sm"
											onClick={() => void handleTestConnector()}
											disabled={testingConnector || connectorDraftIssues.length > 0}
										>
											<Play className={cn(testingConnector && 'animate-pulse')} />
											{testingConnector
												? t('platform.connectors.testing')
												: t('platform.connectors.test')}
										</Button>
										<Button
											type="button"
											size="sm"
											onClick={() => void handleTestAndSaveConnectorConfig()}
											disabled={
												testingConnector ||
												savingConnectorConfig ||
												connectorDraftIssues.length > 0
											}
										>
											<CheckCircle2
												className={cn(
													(testingConnector || savingConnectorConfig) &&
														'animate-pulse',
												)}
											/>
											{t('platform.connectors.testAndSave')}
										</Button>
									</div>
								</div>

								{connectorSaveError ? (
									<PlatformNotice>{connectorSaveError}</PlatformNotice>
								) : null}

								{connectorSaveSuccess ? (
									<div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800">
										<CheckCircle2 className="mt-0.5 size-4 shrink-0" />
										<span className="min-w-0 break-words">
											{connectorSaveSuccess}
										</span>
									</div>
								) : null}

								{connectorTestError ? (
									<PlatformNotice>{connectorTestError}</PlatformNotice>
								) : null}

								{connectorTestResult ? (
									<div className="grid gap-2">
										<div className="text-xs font-medium text-muted-foreground">
											{t('platform.connectors.testStatus')}
										</div>
										{connectorTestResult.checks.map((check) => {
											const succeeded = check.status === 'success';
											const Icon = succeeded ? CheckCircle2 : XCircle;
											return (
												<div
													key={check.name}
													className="grid gap-2 rounded-md border bg-muted/10 p-3"
												>
													<div className="flex flex-wrap items-center justify-between gap-2">
														<div className="flex min-w-0 items-center gap-2">
															<Icon
																className={cn(
																	'size-4 shrink-0',
																	succeeded
																		? 'text-emerald-600'
																		: 'text-red-600',
																)}
															/>
															<span className="font-medium">{check.label}</span>
														</div>
														<div className="flex flex-wrap items-center gap-2">
															<StateBadge
																state={succeeded ? 'ready' : 'todo'}
																label={check.status}
															/>
															<Badge variant="outline" className="font-mono">
																{t('platform.connectors.latency')}: {check.latency_ms}ms
															</Badge>
														</div>
													</div>
													<p className="text-xs text-muted-foreground">
														{check.message}
													</p>
													{check.preview ? (
														<div className="grid gap-1">
															<span className="text-xs text-muted-foreground">
																{t('platform.connectors.preview')}
															</span>
															<pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 font-mono text-xs">
																{check.preview}
															</pre>
														</div>
													) : null}
												</div>
											);
										})}
									</div>
								) : null}
							</div>

							<div className="grid gap-3 xl:grid-cols-2">
								<div className="grid gap-3 rounded-lg border bg-background p-3">
									<div className="flex items-center justify-between gap-3">
										<h3 className="text-sm font-medium">
											{t('platform.connectors.supported')}
										</h3>
										<Badge variant="outline">
											{connectors.supported.length}
										</Badge>
									</div>
									<div className="grid gap-2">
										{connectors.supported.map((connector) => (
											<div
												key={connector.name}
												className="grid gap-2 rounded-md border bg-muted/10 p-3"
											>
												<div className="flex flex-wrap items-center justify-between gap-2">
													<div className="min-w-0">
														<div className="font-mono text-xs">
															{connector.name}
														</div>
														<p className="mt-1 text-xs text-muted-foreground">
															{connector.description}
														</p>
													</div>
													<Badge variant="secondary">
														{connector.mode}
													</Badge>
												</div>
												{connector.env_vars.length > 0 ? (
													<div className="flex flex-wrap gap-1">
														{connector.env_vars.map((name) => (
															<Badge
																key={name}
																variant="outline"
																className="font-mono text-[10px]"
															>
																{name}
															</Badge>
														))}
													</div>
												) : null}
											</div>
										))}
									</div>
								</div>

								<div className="grid gap-3 rounded-lg border bg-background p-3">
									<div className="flex items-center justify-between gap-3">
										<h3 className="text-sm font-medium">
											{t('platform.connectors.httpPaths')}
										</h3>
										<Badge variant="outline">
											{Object.keys(connectors.http_paths).length}
										</Badge>
									</div>
									<div className="grid gap-2">
										{Object.entries(connectors.http_paths).map(([name, path]) => (
											<div
												key={name}
												className="grid gap-1 rounded-md border bg-muted/10 p-3"
											>
												<span className="text-xs text-muted-foreground">
													{name}
												</span>
												<span className="break-all font-mono text-xs">
													{path}
												</span>
											</div>
										))}
									</div>
								</div>
							</div>

							<div className="grid gap-3 xl:grid-cols-2">
								<div className="grid gap-3 rounded-lg border bg-background p-3">
									<div className="flex items-center justify-between gap-3">
										<h3 className="text-sm font-medium">
											{t('platform.connectors.tenantPreview')}
										</h3>
										<Badge variant="outline">{tenantWorkspaces.length}</Badge>
									</div>
									<div className="grid gap-2">
										{tenantWorkspaces.map(([tenant, workspace]) => (
											<div
												key={tenant}
												className="grid gap-3 rounded-md border bg-muted/10 p-3"
											>
												<div className="flex flex-wrap items-center gap-2">
													<Badge variant="secondary">{tenant}</Badge>
													<span className="font-mono text-xs text-muted-foreground">
														{workspace.source}
													</span>
												</div>
												<div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
													<div className="rounded-md bg-background px-3 py-2">
														<div className="text-muted-foreground">
															{t('platform.connectors.policies')}
														</div>
														<div className="mt-1 font-semibold tabular-nums">
															{countArrayField(workspace, 'policies')}
														</div>
													</div>
													<div className="rounded-md bg-background px-3 py-2">
														<div className="text-muted-foreground">
															{t('platform.connectors.tickets')}
														</div>
														<div className="mt-1 font-semibold tabular-nums">
															{countArrayField(workspace, 'tickets')}
														</div>
													</div>
													<div className="rounded-md bg-background px-3 py-2">
														<div className="text-muted-foreground">
															{t('platform.connectors.departments')}
														</div>
														<div className="mt-1 font-semibold tabular-nums">
															{countArrayField(workspace, 'departments')}
														</div>
													</div>
													<div className="rounded-md bg-background px-3 py-2">
														<div className="text-muted-foreground">
															{t('platform.connectors.knowledgeBases')}
														</div>
														<div className="mt-1 font-semibold tabular-nums">
															{countArrayField(workspace, 'knowledge_bases')}
														</div>
													</div>
													<div className="rounded-md bg-background px-3 py-2">
														<div className="text-muted-foreground">
															{t('platform.connectors.tools')}
														</div>
														<div className="mt-1 font-semibold tabular-nums">
															{countArrayField(workspace, 'tools')}
														</div>
													</div>
													<div className="rounded-md bg-background px-3 py-2">
														<div className="text-muted-foreground">
															{t('platform.connectors.sampleQuestions')}
														</div>
														<div className="mt-1 font-semibold tabular-nums">
															{workspace.sample_questions.length}
														</div>
													</div>
												</div>
												{workspace.sample_questions.length > 0 ? (
													<div className="grid gap-1">
														<span className="text-xs text-muted-foreground">
															{t('platform.connectors.sampleQuestions')}
														</span>
														<div className="flex flex-wrap gap-1">
															{workspace.sample_questions
																.slice(0, 3)
																.map((question) => (
																	<Badge
																		key={question}
																		variant="outline"
																		className="max-w-full truncate"
																		title={question}
																	>
																		{question}
																	</Badge>
																))}
														</div>
													</div>
												) : null}
											</div>
										))}
									</div>
								</div>

								<div className="grid gap-3 rounded-lg border bg-background p-3">
									<div className="flex items-center justify-between gap-3">
										<h3 className="text-sm font-medium">
											{t('platform.connectors.identities')}
										</h3>
										<Badge variant="outline">
											{connectors.identities.length}
										</Badge>
									</div>
									<div className="grid gap-2">
										{connectors.identities.map((identity) => (
											<div
												key={identity.user_id}
												className="grid gap-2 rounded-md border bg-muted/10 p-3"
											>
												<div className="flex flex-wrap items-center justify-between gap-2">
													<div className="min-w-0">
														<div className="truncate text-sm font-medium">
															{identity.display_name}
														</div>
														<div className="font-mono text-xs text-muted-foreground">
															{identity.user_id}
														</div>
													</div>
													<div className="flex flex-wrap gap-1">
														<Badge variant="secondary">
															{identity.tenant}
														</Badge>
														<Badge variant="outline">
															{identity.role}
														</Badge>
													</div>
												</div>
												{identity.sample_questions.length > 0 ? (
													<div className="flex flex-wrap gap-1">
														{identity.sample_questions
															.slice(0, 2)
															.map((question) => (
																<Badge
																	key={question}
																	variant="outline"
																	className="max-w-full truncate"
																	title={question}
																>
																	{question}
																</Badge>
															))}
													</div>
												) : null}
											</div>
										))}
									</div>
								</div>
							</div>
						</>
					) : (
						<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
							{t('platform.connectors.empty')}
						</div>
					)}
				</section>

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
				<AgentManagementPanel
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

				<RuntimeStatusPanel
					governanceRef={governanceRef}
					platformLoading={platformLoading}
					hasPlatformStatus={Boolean(platformStatus)}
					platformError={platformError}
					runtimeItems={runtimeItems}
					onRefreshPlatform={refetchPlatform}
					labels={{
						title: t('platform.runtime.title'),
						description: t('platform.runtime.description'),
						refreshStatus: t('platform.actions.refreshStatus'),
						error: t('platform.runtime.error'),
					}}
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

				<section ref={workflowRunnerRef}>
					<WorkflowRunnerPanel
						selectedWorkflowType={selectedWorkflowType}
						workflowOptions={workflowOptions}
						selectedWorkflowTemplate={selectedWorkflowTemplate}
						workflowInputs={workflowInputs}
						workflowApprovalId={workflowApprovalId}
						workflowRunError={workflowRunError}
						workflowRunResult={workflowRunResult}
						runningWorkflow={runningWorkflow}
						workflowTemplatesLoading={workflowTemplatesLoading}
						workflowTemplatesError={workflowTemplatesError}
						workflowTemplates={workflowTemplates}
						selectedWorkflowDisabled={selectedWorkflowDisabled}
						savingWorkflowType={savingWorkflowType}
						creatingRunApproval={creatingRunApproval}
						platformError={platformError ? String(platformError) : null}
						workflowRunsLoading={workflowRunsLoading}
						workflowRunsError={workflowRunsError}
						workflowRuns={workflowRuns}
						onWorkflowTypeChange={(value) => {
							setSelectedWorkflowType(value);
							setWorkflowRunError(null);
							const nextWorkflow = workflowOptions.find(
								(workflow) => workflow.value === value,
							);
							setWorkflowInputs(
								normalizeWorkflowInputs(nextWorkflow?.defaultInputs),
							);
						}}
						onWorkflowInputChange={(key, value) =>
							setWorkflowInputs((current) =>
								workflowInputsWithValue(current, key, value),
							)
						}
						onWorkflowApprovalIdChange={setWorkflowApprovalId}
						onRequestApproval={() => void handleCreateRunApproval('workflow_run')}
						onRunWorkflow={() => void handleRunEnterpriseWorkflow()}
						onToggleWorkflowTemplate={(template, checked) =>
							void handleToggleWorkflowTemplate(template, checked)
						}
						summarizeAuditObject={summarizeAuditObject}
						t={t}
					/>
				</section>

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
