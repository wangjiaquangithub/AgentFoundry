// @ts-nocheck

import {
	AlertTriangle,
	BotMessageSquare,
	Building2,
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
import { AccessControlPanel } from './AccessControlPanel';
import { AgentManagementPanel } from './AgentManagementPanel';
import { AgentQuickStartPanel } from './AgentQuickStartPanel';
import { AgentRunNowPanel } from './AgentRunNowPanel';
import { AgentRunnerPanel } from './AgentRunnerPanel';
import { AppCenterPanel } from './AppCenterPanel';
import { ApprovalsPanel } from './ApprovalsPanel';
import { AuditEventsPanel } from './AuditEventsPanel';
import { CapabilitiesPanel } from './CapabilitiesPanel';
import { ConfigManagementPanel } from './ConfigManagementPanel';
import { DashboardOpsPanel } from './DashboardOpsPanel';
import { FirstAgentGuide } from './FirstAgentGuide';
import { GovernanceHealthPanel } from './GovernanceHealthPanel';
import { LaunchpadPanel } from './LaunchpadPanel';
import { MembersPanel } from './MembersPanel';
import { MemoryOperationsPanel } from './MemoryOperationsPanel';
import { MonitoringSnapshotPanel } from './MonitoringSnapshotPanel';
import { OperationsPanel } from './OperationsPanel';
import { OpsTasksPanel } from './OpsTasksPanel';
import { OrchestrationWorkbenchPanel } from './OrchestrationWorkbenchPanel';
import { PlatformConsolePanel } from './PlatformConsolePanel';
import { PlatformDashboardOverview } from './PlatformDashboardOverview';
import { PolicySubagentsPanel } from './PolicySubagentsPanel';
import { RolloutPath } from './RolloutPath';
import { RuntimeStatusPanel } from './RuntimeStatusPanel';
import { ScenariosPanel } from './ScenariosPanel';
import { TenantGovernancePanel } from './TenantGovernancePanel';
import { TenantWorkspacePanel } from './TenantWorkspacePanel';
import { ToolCatalogPanel } from './ToolCatalogPanel';
import { ToolRunnerPanel } from './ToolRunnerPanel';
import { TriggerOpsPanel } from './TriggerOpsPanel';
import { WorkbenchReadinessPanel } from './WorkbenchReadinessPanel';
import { WorkbenchStatusPanel } from './WorkbenchStatusPanel';
import { WorkflowOpsPanel } from './WorkflowOpsPanel';
import { WorkflowRunnerPanel } from './WorkflowRunnerPanel';
import { PlatformNotice, StateBadge } from './common';

interface DashboardViewPageProps {
	[key: string]: any;
}

function countArrayField(record: Record<string, unknown>, key: string) {
	const value = record[key];
	return Array.isArray(value) ? value.length : 0;
}

function operationSeverityClassName(severity?: string) {
	if (severity === 'error') {
		return 'border-red-500/30 bg-red-500/10 text-red-700';
	}

	if (severity === 'warning') {
		return 'border-amber-500/30 bg-amber-500/10 text-amber-700';
	}

	return 'border-sky-500/30 bg-sky-500/10 text-sky-700';
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
	agentsLoading,
	appCenterAgents,
	appCenterDetailIssues,
	appCenterDetailResources,
	appCenterDetailStatus,
	appCenterPrimaryDisabled,
	appCenterPrimaryLabel,
	approvalError,
	approvalFilters,
	approvalForm,
	approvalLoading,
	approvalRequests,
	approvalStatusClassName,
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
	connectorDraftStatusLabel,
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
	credentialLabel,
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
	formatTimestamp,
	getFrequencyLabel,
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
	knowledgeBaseLabel,
	knowledgeBases,
	lastPublishedAgent,
	launchpadPrimaryStep,
	launchpadReadyCount,
	launchpadState,
	launchpadStateLabel,
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
	normalizeWorkflowInputs,
	operationsAgentIssueText,
	operationsHeadline,
	opsTasks,
	opsTasksError,
	opsTasksLoading,
	opsTasksSummary,
	orchestrationPrimaryStep,
	orchestrationReadyCount,
	orchestrationWorkbenchSteps,
	parseCronExpression,
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
	scheduleAgentLabel,
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
	shortResourceId,
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
	workflowInputLabel,
	workflowInputLabelKeys,
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
	workflowStatusClassName,
	workflowStatusLabelKey,
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

				<section className="grid gap-4 rounded-lg border bg-background p-4">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0">
							<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
								<Building2 className="size-4" />
								<span>{t('platform.workbench.eyebrow')}</span>
							</div>
							<h2 className="text-base font-semibold">
								{t('platform.workbench.title')}
							</h2>
							<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
								{t('platform.workbench.description')}
							</p>
						</div>
						<div className="flex flex-wrap gap-2 lg:justify-end">
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={handleNextStepPrimaryAction}
								disabled={nextStepPrimaryDisabled}
							>
								<NextStepIcon className="size-4" />
								{t(`platform.nextStep.${nextStepMode}.action`)}
							</Button>
							<Button
								type="button"
								size="sm"
								onClick={selectedRunAgent ? scrollToAgentRunner : handleStartPublishing}
							>
								{selectedRunAgent ? (
									<Play className="size-4" />
								) : (
									<BotMessageSquare className="size-4" />
								)}
								{selectedRunAgent
									? t('platform.workbench.runPrimary')
									: t('platform.workbench.publishPrimary')}
							</Button>
						</div>
					</div>

					<FirstAgentGuide
						steps={firstAgentGuideSteps}
						primaryStep={firstAgentGuidePrimaryStep}
						publishingTemplateId={publishingTemplateId}
						labels={{
							title: t('platform.workbench.firstAgentGuide.title'),
							description: t('platform.workbench.firstAgentGuide.description'),
							publishing: t('platform.agentManagement.publishing'),
							states: {
								ready: t('platform.launchpad.ready'),
								partial: t('platform.launchpad.partial'),
								todo: t('platform.launchpad.todo'),
								blocked: t('platform.launchpad.blocked'),
							},
						}}
					/>

					<RolloutPath
						steps={rolloutPathSteps}
						labels={{
							title: t('platform.workbench.rolloutPath.title'),
							description: t('platform.workbench.rolloutPath.description'),
							progress: t('platform.launchpad.progress', {
								ready: rolloutPathSteps.filter((step) => step.state === 'ready')
									.length,
								total: rolloutPathSteps.length,
							}),
							states: {
								ready: t('platform.launchpad.ready'),
								partial: t('platform.launchpad.partial'),
								todo: t('platform.launchpad.todo'),
								blocked: t('platform.launchpad.blocked'),
							},
						}}
					/>

					<WorkbenchReadinessPanel
						readinessItems={workbenchReadinessItems}
						quickActions={workbenchQuickActions}
						riskItems={workbenchRiskItems}
						labels={{
							readinessTitle: t('platform.workbench.readinessTitle'),
							readinessDescription: t('platform.workbench.readinessDescription'),
							readinessProgress: t('platform.launchpad.progress', {
								ready: workbenchReadinessItems.filter(
									(item) => item.state === 'ready',
								).length,
								total: workbenchReadinessItems.length,
							}),
							quickActionsTitle: t('platform.workbench.quickActionsTitle'),
							riskTitle: t('platform.workbench.riskTitle'),
							riskEmpty: t('platform.workbench.riskEmpty'),
							states: {
								ready: t('platform.launchpad.ready'),
								partial: t('platform.launchpad.partial'),
								todo: t('platform.launchpad.todo'),
								blocked: t('platform.launchpad.blocked'),
							},
						}}
					/>

					<WorkbenchStatusPanel
						indicators={workbenchIndicators}
						actions={workbenchActions}
						labels={{
							statusTitle: t('platform.workbench.statusTitle'),
							statusDescription:
								dashboardTodoItems.length > 0
									? dashboardTodoItems.join(' · ')
									: t('platform.dashboard.todoReady'),
							statusState: dashboardTodoItems.length > 0 ? 'partial' : 'ready',
							statusStateLabel:
								dashboardTodoItems.length > 0
									? t('platform.workbench.needsAction')
									: t('platform.workbench.ready'),
							states: {
								ready: t('platform.launchpad.ready'),
								partial: t('platform.launchpad.partial'),
								todo: t('platform.launchpad.todo'),
								blocked: t('platform.launchpad.blocked'),
							},
						}}
					/>
				</section>

				<LaunchpadPanel
					steps={launchpadSteps}
					primaryStep={launchpadPrimaryStep}
					labels={{
						title: t('platform.launchpad.title'),
						description: t('platform.launchpad.description'),
						state: launchpadState,
						stateLabel: launchpadStateLabel,
						progress: t('platform.launchpad.progress', {
							ready: launchpadReadyCount,
							total: launchpadTotalCount,
						}),
						primaryAction: t('platform.launchpad.primaryAction', {
							action: launchpadPrimaryStep.actionLabel,
						}),
						states: {
							ready: t('platform.launchpad.ready'),
							partial: t('platform.launchpad.partial'),
							todo: t('platform.launchpad.todo'),
							blocked: t('platform.launchpad.blocked'),
						},
					}}
				/>

				<OrchestrationWorkbenchPanel
					sectionRef={memoryOperationsRef}
					steps={orchestrationWorkbenchSteps}
					primaryStep={orchestrationPrimaryStep}
					labels={{
						eyebrow: t('platform.orchestration.eyebrow'),
						title: t('platform.orchestration.title'),
						description: t('platform.orchestration.description'),
						progress: t('platform.orchestration.progress', {
							ready: orchestrationReadyCount,
							total: orchestrationWorkbenchSteps.length,
						}),
						agents: t('platform.orchestration.agents', {
							count: activePlatformAgents.length,
						}),
						approvals: t('platform.orchestration.approvals', {
							count: pendingApprovals.length,
						}),
						primaryAction: t('platform.orchestration.primaryAction', {
							action: orchestrationPrimaryStep.actionLabel,
						}),
						step: (index) => t('platform.orchestration.step', { index }),
						states: {
							ready: t('platform.agentManagement.wizard.states.ready'),
							partial: t('platform.agentManagement.wizard.states.partial'),
							todo: t('platform.agentManagement.wizard.states.todo'),
							blocked: t('platform.agentManagement.wizard.states.blocked'),
						},
					}}
				/>

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
					formatTimestamp={formatTimestamp}
					workflowStatusLabelKey={workflowStatusLabelKey}
					workflowStatusClassName={workflowStatusClassName}
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
					formatTimestamp={formatTimestamp}
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

				<ScenariosPanel
					scenarios={scenarios}
					loading={scenariosLoading}
					error={scenariosError}
					runningWorkflow={runningWorkflow}
					onRefresh={() => void refetchScenarios()}
					onRunScenario={(scenario) => void handleRunScenario(scenario)}
					formatTimestamp={formatTimestamp}
					labels={{
						eyebrow: t('platform.scenarios.eyebrow'),
						title: t('platform.scenarios.title'),
						description: t('platform.scenarios.description'),
						total: (count) => t('platform.scenarios.total', { count }),
						readyCount: (count) => t('platform.scenarios.readyCount', { count }),
						refresh: t('platform.scenarios.refresh'),
						empty: t('platform.scenarios.empty'),
						ready: t('platform.scenarios.ready'),
						partial: t('platform.scenarios.partial'),
						blocked: t('platform.scenarios.blocked'),
						lastRun: (status, time) =>
							t('platform.scenarios.lastRun', { status, time }),
						neverRun: t('platform.scenarios.neverRun'),
						toolCount: (count) => t('platform.scenarios.toolCount', { count }),
						runCount: (count) => t('platform.scenarios.runCount', { count }),
						approvalRequired: t('platform.scenarios.approvalRequired'),
						noApproval: t('platform.scenarios.noApproval'),
						pendingApprovals: (count) =>
							t('platform.scenarios.pendingApprovals', { count }),
						running: t('platform.scenarios.running'),
						run: t('platform.scenarios.run'),
					}}
				/>

				<AppCenterPanel
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
					onOpenGovernance={scrollToGovernance}
					onPrimaryAction={handleAppCenterPrimaryAction}
					setSelectedAppCenterItem={setSelectedAppCenterItem}
					onConfigureTemplate={handleConfigureTemplate}
					onOpenAgentManagement={scrollToAgentManagement}
					setSelectedRunAgentId={setSelectedRunAgentId}
					onPrimeAgentRunner={handlePrimeAgentRunner}
					onEditAgent={handleEditAgent}
					onUseApproval={handleUseApproval}
					onDetailPrimaryAction={handleAppCenterDetailPrimaryAction}
					onDetailSecondaryAction={handleAppCenterDetailSecondaryAction}
					labels={{
						eyebrow: t('platform.appCenter.eyebrow'),
						title: t('platform.appCenter.title'),
						description: t('platform.appCenter.description'),
						reviewApprovals: t('platform.appCenter.reviewApprovals'),
						templates: t('platform.appCenter.templates'),
						emptyTemplates: t('platform.appCenter.emptyTemplates'),
						templateTools: (count) =>
							t('platform.appCenter.templateTools', { count }),
						configureTemplate: t('platform.appCenter.configureTemplate'),
						published: t('platform.appCenter.published'),
						emptyAgents: t('platform.appCenter.emptyAgents'),
						run: t('platform.appCenter.run'),
						fix: t('platform.appCenter.fix'),
						governance: t('platform.appCenter.governance'),
						loopReady: t('platform.appCenter.loopReady'),
						loopNeedsWork: t('platform.appCenter.loopNeedsWork'),
						readyApps: t('platform.appCenter.readyApps'),
						pendingApprovals: t('platform.appCenter.pendingApprovals'),
						emptyApprovals: t('platform.operations.emptyApprovals'),
						selectedAgent: t('platform.appCenter.selectedAgent'),
						selectedTemplate: t('platform.appCenter.selectedTemplate'),
						details: t('platform.appCenter.details'),
						readinessLabel: (state) =>
							t(`platform.agentManagement.readiness.${state}`),
						readyToPublish: t('platform.appCenter.readyToPublish'),
						needsConfiguration: t('platform.appCenter.needsConfiguration'),
						selectToInspect: t('platform.appCenter.selectToInspect'),
						selectToInspectHelper: t(
							'platform.appCenter.selectToInspectHelper',
						),
						readiness: t('platform.appCenter.readiness'),
						noIssues: t('platform.appCenter.noIssues'),
						runSelected: t('platform.appCenter.runSelected'),
						editConfiguration: t('platform.appCenter.editConfiguration'),
						publishFromTemplate: t('platform.appCenter.publishFromTemplate'),
						viewInManagement: t('platform.appCenter.viewInManagement'),
					}}
				/>

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

				<TenantWorkspacePanel
					tenantOverviewItems={tenantOverviewItems}
					selectedIdentity={selectedIdentity}
					selectedIdentityWorkspace={selectedIdentityWorkspace}
					selectedIdentityAllowedTools={selectedIdentityAllowedTools}
					selectedIdentityDeniedTools={selectedIdentityDeniedTools}
					enterpriseIdentityCount={enterpriseIdentities.length}
					onConfigureSources={scrollToConnectorCenter}
					onUseIdentity={handleUseIdentity}
					onUseTenant={handleUseTenant}
					onPrepareTenantAgent={handlePrepareTenantAgent}
					onInspectTenantApprovals={handleInspectTenantApprovals}
					onInspectTenantAudit={handleInspectTenantAudit}
					onInspectIdentityAudit={handleInspectIdentityAudit}
					onOpenGovernance={scrollToGovernance}
					labels={{
						eyebrow: t('platform.tenantWorkspace.eyebrow'),
						title: t('platform.tenantWorkspace.title'),
						description: t('platform.tenantWorkspace.description'),
						configureSources: t('platform.tenantWorkspace.configureSources'),
						runAsCurrent: t('platform.tenantWorkspace.runAsCurrent'),
						emptyTenants: t('platform.tenantWorkspace.emptyTenants'),
						tenant: t('platform.tenantWorkspace.tenant'),
						roleCount: (count) =>
							t('platform.tenantWorkspace.roleCount', { count }),
						identities: t('platform.tenantWorkspace.identities'),
						agents: t('platform.tenantWorkspace.agents'),
						pendingApprovals: t('platform.tenantWorkspace.pendingApprovals'),
						auditEvents: t('platform.tenantWorkspace.auditEvents'),
						workflowRuns: t('platform.tenantWorkspace.workflowRuns'),
						roles: t('platform.tenantWorkspace.roles'),
						sampleQuestion: t('platform.tenantWorkspace.sampleQuestion'),
						noSample: t('platform.tenantWorkspace.noSample'),
						useTenant: t('platform.tenantWorkspace.useTenant'),
						publishForTenant: t('platform.tenantWorkspace.publishForTenant'),
						openTenantApprovals: t(
							'platform.tenantWorkspace.openTenantApprovals',
						),
						openTenantAudit: t('platform.tenantWorkspace.openTenantAudit'),
						activeIdentity: t('platform.tenantWorkspace.activeIdentity'),
						runSample: t('platform.tenantWorkspace.runSample'),
						viewAudit: t('platform.tenantWorkspace.viewAudit'),
						workspace: t('platform.tenantWorkspace.workspace'),
						localSource: t('platform.tenantWorkspace.localSource'),
						policies: t('platform.tenantGovernance.policies'),
						tickets: t('platform.tenantGovernance.tickets'),
						departments: t('platform.tenantGovernance.departments'),
						knowledgeBases: t('platform.tenantGovernance.knowledgeBases'),
						tools: t('platform.tenantGovernance.tools'),
						policy: t('platform.tenantWorkspace.policy'),
						allowedTools: t('platform.tenantGovernance.allowedTools'),
						deniedTools: t('platform.tenantGovernance.deniedTools'),
						none: t('platform.tenantWorkspace.none'),
						openGovernance: t('platform.tenantWorkspace.openGovernance'),
						noIdentity: t('platform.tenantWorkspace.noIdentity'),
					}}
				/>

				<AccessControlPanel
					stats={accessControlStats}
					governance={governance}
					governanceLoading={governanceLoading}
					governanceError={governanceError}
					enterpriseIdentities={enterpriseIdentities}
					accessTenantSummaries={accessTenantSummaries}
					identityAccessRows={identityAccessRows}
					toolPolicyMode={toolPolicyMode}
					selectedIdentity={selectedIdentity}
					selectedIdentityAllowedTools={selectedIdentityAllowedTools}
					selectedIdentityDeniedTools={selectedIdentityDeniedTools}
					selectedIdentityPendingApprovals={selectedIdentityPendingApprovals}
					selectedIdentityFailedAuditEvents={selectedIdentityFailedAuditEvents}
					selectedIdentityRecentAuditEvents={selectedIdentityRecentAuditEvents}
					creatingRunApproval={creatingRunApproval}
					onRefreshGovernance={() => void refetchGovernance()}
					onCreateRunApproval={handleCreateRunApproval}
					onSelectIdentity={setSelectedIdentityUserId}
					onUseApproval={handleUseApproval}
					onInspectIdentityApprovals={handleInspectIdentityApprovals}
					onInspectIdentityFailures={handleInspectIdentityFailures}
					onUseIdentity={handleUseIdentity}
					onInspectIdentityAudit={handleInspectIdentityAudit}
					labels={{
						eyebrow: t('platform.accessControl.eyebrow'),
						title: t('platform.accessControl.title'),
						description: t('platform.accessControl.description'),
						refreshStatus: t('platform.actions.refreshStatus'),
						requestingApproval: t('platform.accessControl.requestingApproval'),
						requestToolApproval: t('platform.accessControl.requestToolApproval'),
						tenantMatrix: t('platform.accessControl.tenantMatrix'),
						roleCount: (count) => t('platform.accessControl.roleCount', { count }),
						identityCount: (count) =>
							t('platform.accessControl.identityCount', { count }),
						allowed: t('platform.accessControl.allowed'),
						denied: t('platform.accessControl.denied'),
						pending: t('platform.accessControl.pending'),
						identityDirectory: t('platform.accessControl.identityDirectory'),
						allowedCount: (count) =>
							t('platform.accessControl.allowedCount', { count }),
						deniedCount: (count) => t('platform.accessControl.deniedCount', { count }),
						pendingCount: (count) =>
							t('platform.accessControl.pendingCount', { count }),
						selectedPolicy: t('platform.accessControl.selectedPolicy'),
						needsReview: t('platform.accessControl.needsReview'),
						normal: t('platform.accessControl.normal'),
						identityOps: t('platform.accessControl.identityOps'),
						actionNeeded: t('platform.accessControl.actionNeeded'),
						pendingApprovalsShort: t('platform.accessControl.pendingApprovalsShort'),
						failedAudits: t('platform.accessControl.failedAudits'),
						recentAudit: t('platform.accessControl.recentAudit'),
						pendingQueue: t('platform.accessControl.pendingQueue'),
						noPendingQueue: t('platform.accessControl.noPendingQueue'),
						reviewApprovals: t('platform.accessControl.reviewApprovals'),
						viewFailures: t('platform.accessControl.viewFailures'),
						allowedTools: t('platform.accessControl.allowedTools'),
						deniedTools: t('platform.accessControl.deniedTools'),
						none: t('platform.accessControl.none'),
						runAsIdentity: t('platform.accessControl.runAsIdentity'),
						viewAudit: t('platform.accessControl.viewAudit'),
						noIdentity: t('platform.accessControl.noIdentity'),
					}}
				/>

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
					workflowStatusLabelKey={workflowStatusLabelKey}
					workflowStatusClassName={workflowStatusClassName}
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
					scheduleAgentLabel={scheduleAgentLabel}
					formatTimestamp={formatTimestamp}
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
					operationSeverityClassName={operationSeverityClassName}
					workflowStatusClassName={workflowStatusClassName}
					workflowStatusLabelKey={workflowStatusLabelKey}
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

				<AgentRunNowPanel
					loading={platformAgentsLoading && !platformAgents}
					selectedRunAgent={selectedRunAgent}
					currentIdentityLabel={currentIdentityLabel}
					selectedRunAgentModelLabel={selectedRunAgentModelLabel}
					selectedRunAgentKnowledgeCount={selectedRunAgentKnowledgeCount}
					selectedRunAgentToolCount={selectedRunAgentToolCount}
					primaryAgentSampleQuestion={primaryAgentSampleQuestion}
					connectorName={platformStatus?.connector.name}
					hasDefaultAgentTemplate={Boolean(defaultAgentTemplate)}
					isPublishingTemplate={Boolean(publishingTemplateId)}
					onPrimeAgentRunner={handlePrimeAgentRunner}
					onScrollToAgentRunner={scrollToAgentRunner}
					onStartPublishing={handleStartPublishing}
					onQuickPublishAgent={() => void handleQuickPublishAgent()}
					labels={{
						eyebrow: t('platform.now.eyebrow'),
						title: t('platform.now.title'),
						description: t('platform.now.description'),
						fillSample: t('platform.now.fillSample'),
						run: t('platform.now.run'),
						publishAgent: t('platform.now.publishAgent'),
						currentAgent: t('platform.now.currentAgent'),
						publishedStatus: t('platform.agentManagement.publishedStatus'),
						sample: t('platform.now.sample'),
						currentUser: t('platform.now.currentUser'),
						model: t('platform.now.model'),
						knowledge: t('platform.now.knowledge'),
						knowledgeCount: (count) =>
							t('platform.agentRunner.knowledgeCount', { count }),
						tools: t('platform.now.tools'),
						toolsCount: (count) => t('platform.agentRunner.toolsCount', { count }),
						memory: t('platform.now.memory'),
						workflow: t('platform.now.workflow'),
						enabled: t('platform.runtime.enabled'),
						disabled: t('platform.runtime.disabled'),
						connector: t('platform.now.connector'),
						unavailable: t('platform.runtime.unavailable'),
						noAgent: t('platform.now.noAgent'),
						noAgentDescription: t('platform.now.noAgentDescription'),
						manualPublish: t('platform.now.manualPublish'),
						publishing: t('platform.agentManagement.publishing'),
						quickPublish: t('platform.now.quickPublish'),
					}}
				/>

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

				<MembersPanel
					membersRef={membersRef}
					platformMembers={platformMembers}
					platformMembersLoading={platformMembersLoading}
					platformMembersError={platformMembersError}
					platformMemberTenantSummaries={platformMemberTenantSummaries}
					activeMemberCount={activeMemberCount}
					activePlatformAgentCount={activePlatformAgents.length}
					pendingApprovalCount={pendingApprovals.length}
					memberForm={memberForm}
					setMemberForm={setMemberForm}
					savingMember={savingMember}
					updatingMemberId={updatingMemberId}
					onRefreshMembers={() => void refetchMembers()}
					onSaveMember={() => void handleSaveMember()}
					onEditMember={handleEditMember}
					onToggleMemberStatus={(member) => void handleToggleMemberStatus(member)}
					formatTimestamp={formatTimestamp}
					t={t}
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
					credentialLabel={credentialLabel}
					shortResourceId={shortResourceId}
					knowledgeBaseLabel={knowledgeBaseLabel}
					formatTimestamp={formatTimestamp}
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
						workflowInputLabelKeys={workflowInputLabelKeys}
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
							setWorkflowInputs((current) => ({
								...current,
								[key]: value,
							}))
						}
						onWorkflowApprovalIdChange={setWorkflowApprovalId}
						onRequestApproval={() => void handleCreateRunApproval('workflow_run')}
						onRunWorkflow={() => void handleRunEnterpriseWorkflow()}
						onToggleWorkflowTemplate={(template, checked) =>
							void handleToggleWorkflowTemplate(template, checked)
						}
						workflowInputLabel={workflowInputLabel}
						workflowStatusLabelKey={workflowStatusLabelKey}
						workflowStatusClassName={workflowStatusClassName}
						formatTimestamp={formatTimestamp}
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
					approvalStatusClassName={approvalStatusClassName}
					summarizeAuditObject={summarizeAuditObject}
					formatTimestamp={formatTimestamp}
					t={t}
				/>

				<ToolCatalogPanel
					sectionRef={configManagementRef}
					availableToolItems={availableToolItems}
					publishedPlatformAgents={publishedPlatformAgents}
					toolCatalogLoading={toolCatalogLoading}
					toolCatalogError={toolCatalogError}
					onRefetchToolCatalog={refetchToolCatalog}
					formatTimestamp={formatTimestamp}
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
					formatTimestamp={formatTimestamp}
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
					formatTimestamp={formatTimestamp}
					t={t}
				/>

				<CapabilitiesPanel capabilities={capabilities} t={t} />
			</div>
		</main>
	);
}
