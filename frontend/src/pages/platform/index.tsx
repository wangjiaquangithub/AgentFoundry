import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
	platformApi,
	type EnterpriseAgentRunResponse,
	type EnterpriseApprovalRequestItem,
	type EnterpriseApprovalRequestType,
	type EnterpriseAuditEvent,
	type EnterpriseAuditQueryResponse,
	type EnterpriseConnectorTestResponse,
	type EnterprisePlatformAgentsResponse,
	type EnterprisePlatformConfigExportResponse,
	type EnterprisePlatformConnectorsResponse,
	type EnterprisePlatformGovernanceResponse,
	type EnterprisePlatformMembersResponse,
	type EnterprisePlatformOpsTask,
	type EnterprisePlatformOpsTasksResponse,
	type EnterprisePlatformScenario,
	type EnterpriseToolCatalogResponse,
	type EnterpriseToolRunResponse,
	type EnterpriseWorkflowRunHistoryItem,
	type EnterpriseWorkflowRunResponse,
	type EnterpriseWorkflowTemplate,
} from '@/api';
import { useAgents } from '@/hooks/useAgents';
import { useCredentials } from '@/hooks/useCredentials';
import { useKnowledgeBases } from '@/hooks/useKnowledgeBases';
import { usePlatformStatus } from '@/hooks/usePlatformStatus';
import { useSchedules } from '@/hooks/useSchedules';
import { useTranslation } from '@/i18n/useI18n';
import { AgentsViewPage } from './components/AgentsViewPage';
import { ApprovalsViewPage } from './components/ApprovalsViewPage';
import type { AppCenterSelection } from './components/AppCenterPanel';
import { MemoryViewPage } from './components/MemoryViewPage';
import { RunsViewPage } from './components/RunsViewPage';
import type { ToolPolicyDraftValue } from './components/TenantGovernancePanel';
import { SettingsViewPage } from './components/SettingsViewPage';
import { TenantsViewPage } from './components/TenantsViewPage';
import { ToolsViewPage } from './components/ToolsViewPage';
import { WorkflowsViewPage } from './components/WorkflowsViewPage';
import { DashboardViewPage } from './components/DashboardViewPage';
import { usePlatformPageRefs } from './platform-page-refs';
import { platformPageHasErrors } from './platform-error-state';
import { createPlatformRequestTexts } from './platform-request-texts';
import {
	createPlatformAgentRunnerEntryHandlers,
	createPlatformRunnerHandlers,
	platformAgentAccessAllowedForDisplay,
	workflowInputsForSelectedOption,
	workflowInputsWithValue,
	type AgentConversationMap,
} from './platform-agent-runner';
import {
	createPlatformApprovalHandlers,
} from './platform-approval-helpers';
import { createPlatformAgentManagementHandlers } from './platform-agent-management-helpers';
import {
	createPlatformConnectorHandlers,
} from './platform-connector-helpers';
import {
	createPlatformConfigManagementHandlers,
} from './platform-config-management';
import {
	createPlatformToolPolicyHandlers,
} from './platform-tool-policy-helpers';
import { createPlatformToolCatalogHandlers } from './platform-tool-catalog-helpers';
import {
	createPlatformMemberHandlers,
} from './platform-member-helpers';
import {
	createPlatformGovernanceHandlers,
	createPlatformGovernanceInspectionHandlers,
} from './platform-governance-helpers';
import {
	createPlatformOpsTaskHandlers,
} from './platform-ops-task-helpers';
import { usePlatformDataLoadEffects } from './platform-data-load-effects';
import { createPlatformRefreshDependencyHandlers } from './platform-refresh-dependencies';
import { usePlatformSelectionSyncEffects } from './platform-selection-sync-effects';
import {
	createPlatformWorkflowTemplateHandlers,
} from './platform-workflow-template-helpers';
import { createPlatformWorkflowRunHandlers } from './platform-workflow-run-helpers';
import { createPlatformScenarioHandlers } from './platform-scenario-helpers';
import { createPlatformAuditHandlers } from './platform-audit-helpers';
import {
	capabilityNavigationActions,
	createPlatformNavigationRequestHandlers,
	firstAgentGuideNavigationActions,
	launchpadNavigationActions,
	orchestrationWorkbenchNavigationActions,
	platformConsoleNavigationActions,
	rolloutPathNavigationActions,
	workbenchIndicatorNavigationActions,
	workbenchPrimaryNavigationActions,
	workbenchQuickNavigationActions,
	workbenchReadinessNavigationActions,
	workbenchRiskNavigationActions,
} from './platform-navigation-actions';
import { createPlatformNavigationHandlers } from './platform-navigation-handlers';
import {
	agentReleasePipelineIcons,
	capabilityIcons,
	firstAgentGuideIcons,
	governanceHealthIcons,
	launchpadStepIcons,
	monitoringStatIcons,
	orchestrationWorkbenchIcons,
	platformConsoleIcons,
	platformOverviewStatIcons,
	rolloutPathIcons,
	runtimeStatusIcons,
	workbenchIndicatorIcons,
	workbenchPrimaryActionIcons,
	workbenchQuickActionIcons,
	workbenchReadinessIcons,
} from './platform-icons';
import {
	agentReleasePipelineLabels,
	agentRoutingLabels,
	agentRunnerLabels,
	agentSetupStepLabels,
	appCenterAgentDisplayLabels,
	appCenterDetailHealthLabels,
	appCenterDetailResourcesLabels,
	appCenterDetailResourceValueLabels,
	appCenterOperationsLabels,
	auditStatsLabels,
	connectorOperationsLabels,
	dashboardTodoLabels,
	firstAgentGuideStepLabels,
	governanceAccessLabels,
	governanceHealthLabels,
	monitoringStatLabels,
	orchestrationWorkbenchStepLabels,
	operationsHeadlineLabels,
	launchpadStepLabels,
	platformConnectionLabels,
	platformConsoleItemLabels,
	platformOverviewStatLabels,
	platformRuntimeConfigLabels,
	publishDraftLabels,
	rolloutPathStepLabels,
	runtimeStatusLabels,
	selectedIdentityLabels,
	selectedToolRunnerLabels,
	tenantWorkspaceOperationsLabels,
	triggerOperationsStatLabels,
	triggerOperationsSummaryLabels,
	workbenchIndicatorLabels,
	workbenchPrimaryActionLabels,
	workbenchQuickActionLabels,
	workbenchReadinessLabels,
	workbenchRiskLabels,
	workflowOperationsLabels,
	workflowSelectionLabels,
} from './platform-labels';
import { createPlatformDashboardPageState } from './platform-dashboard-state';
import {
	createPlatformDashboardAccessControlViewProps,
	createPlatformDashboardAgentManagementViewProps,
	createPlatformDashboardAgentRunNowViewProps,
	createPlatformDashboardAgentRunnerPanelViewProps,
	createPlatformDashboardAgentRunnerViewProps,
	createPlatformDashboardAgentQuickStartViewProps,
	createPlatformDashboardAppCenterViewProps,
	createPlatformDashboardApprovalsViewProps,
	createPlatformDashboardAuditEventsViewProps,
	createPlatformDashboardCapabilitiesViewProps,
	createPlatformDashboardConfigManagementViewProps,
	createPlatformDashboardConnectorsViewProps,
	createPlatformDashboardFirstAgentGuideViewProps,
	createPlatformDashboardGovernanceHealthViewProps,
	createPlatformDashboardLaunchpadViewProps,
	createPlatformDashboardMembersViewProps,
	createPlatformDashboardMemoryOperationsViewProps,
	createPlatformDashboardMonitoringSnapshotViewProps,
	createPlatformDashboardOrchestrationWorkbenchViewProps,
	createPlatformDashboardOpsPanelViewProps,
	createPlatformDashboardOpsTasksViewProps,
	createPlatformDashboardOperationsViewProps,
	createPlatformDashboardOverviewViewProps,
	createPlatformDashboardPolicySubagentsViewProps,
	createPlatformDashboardPlatformConsoleViewProps,
	createPlatformDashboardRolloutPathViewProps,
	createPlatformDashboardRuntimeStatusViewProps,
	createPlatformDashboardScenariosViewProps,
	createPlatformDashboardTenantAccessViewProps,
	createPlatformDashboardTenantGovernanceViewProps,
	createPlatformDashboardTenantWorkspaceViewProps,
	createPlatformDashboardToolsViewProps,
	createPlatformDashboardTriggerOpsViewProps,
	createPlatformDashboardViewProps,
	createPlatformDashboardWorkbenchReadinessViewProps,
	createPlatformDashboardWorkbenchStatusViewProps,
	createPlatformDashboardWorkflowsViewProps,
} from './platform-dashboard-view-props';
import { createPlatformLaunchpadPageState } from './platform-launchpad-state';
import { createPlatformMonitoringPageState } from './platform-monitoring-state';
import { createPlatformOnboardingPageState } from './platform-onboarding-state';
import { createPlatformOrchestrationPageState } from './platform-orchestration-state';
import { createPlatformWorkbenchPageState } from './platform-workbench-state';
import { createPlatformWorkflowPageState } from './platform-workflow-state';
import { createPlatformAgentsViewProps } from './platform-agents-view-props';
import { createPlatformApprovalsViewProps } from './platform-approvals-view-props';
import { createPlatformMemoryViewProps } from './platform-memory-view-props';
import { createPlatformRunsViewProps } from './platform-runs-view-props';
import { createPlatformSettingsViewProps } from './platform-settings-view-props';
import { createPlatformTenantsViewProps } from './platform-tenants-view-props';
import { createPlatformToolsViewProps } from './platform-tools-view-props';
import { createPlatformWorkflowsViewProps } from './platform-workflows-view-props';
import {
	createPlatformAgentQuickConfigurationHandlers,
	createPlatformAgentQuickConfigurationSyncHandler,
} from './platform-agent-quick-config';
import {
	createPlatformAgentPublishingHandlers,
} from './platform-publish-form';
import {
	agentSampleQuestions,
	defaultAgentQuestion,
	defaultApprovalFilters,
	defaultApprovalForm,
	defaultAuditFilters,
	defaultConnectorTestForm,
	defaultEnterpriseWorkflowInputs,
	defaultMemberForm,
	defaultPublishForm,
	defaultSelectedToolName,
	defaultSelectedWorkflowType,
	defaultToolInputs,
	enterpriseToolInputConfig,
	type ApprovalFiltersState,
	type ApprovalFormState,
	type AuditFiltersState,
	type ConnectorTestFormState,
	type MemberFormState,
	type PublishFormState,
} from './platform-defaults';
import { createPlatformAgentInventoryPageState } from './platform-agent-inventory-state';
import {
	createPlatformAgentRoutingPageState,
	createPlatformAgentRunnerPageState,
} from './platform-agent-runner-state';
import { createPlatformAppCenterPageState } from './platform-app-center-state';
import { createPlatformConnectorPageState } from './platform-connector-state';
import { createPlatformConnectionPageState } from './platform-connection-state';
import {
	platformSummarizeAuditObject,
} from './platform-governance-display';
import {
	createPlatformAuditStatsPageState,
	createPlatformGovernancePageState,
} from './platform-governance-state';
import { createPlatformSelectedIdentityPageState } from './platform-selected-identity-state';
import {
	createPlatformAgentReleasePipelinePageState,
	createPlatformPublishPageState,
} from './platform-publish-state';
import { createPlatformResourcePageState } from './platform-resource-state';
import { createPlatformRuntimePageState } from './platform-runtime-state';
import { createPlatformToolRunnerPageState } from './platform-tool-runner-state';
import { createPlatformOverviewPageState } from './platform-overview-state';
import type { PlatformView } from './platform-view';

export function PlatformPage({ view = 'dashboard' }: { view?: PlatformView }) {
	const navigate = useNavigate();
	const { t } = useTranslation();
	const {
		membersRef,
		agentManagementRef,
		agentRunnerRef,
		connectorCenterRef,
		governanceRef,
		workflowRunnerRef,
		toolRunnerRef,
		memoryOperationsRef,
		configManagementRef,
		agentTemplateStepRef,
		agentModelStepRef,
		agentKnowledgeStepRef,
		agentToolsStepRef,
		agentRuntimeStepRef,
		scrollToAgentManagement,
		scrollToMembers,
		scrollToAgentRunner,
		scrollToConnectorCenter,
		scrollToGovernance,
		scrollToWorkflowRunner,
		scrollToToolRunner,
		scrollToMemoryOperations,
		scrollToConfigManagement,
	} = usePlatformPageRefs();
	const connectorDefaultsAppliedRef = useRef(false);
	const [agentQuestion, setAgentQuestion] = useState(defaultAgentQuestion);
	const [runningAgent, setRunningAgent] = useState(false);
	const [agentRunResult, setAgentRunResult] = useState<EnterpriseAgentRunResponse | null>(null);
	const [agentRunError, setAgentRunError] = useState<string | null>(null);
	const [selectedRunAgentId, setSelectedRunAgentId] = useState('');
	const [lastPublishedAgentId, setLastPublishedAgentId] = useState('');
	const [agentApprovalId, setAgentApprovalId] = useState('');
	const [agentConversations, setAgentConversations] = useState<AgentConversationMap>({});
	const [agentRunsLoading, setAgentRunsLoading] = useState(false);
	const [agentRunsError, setAgentRunsError] = useState<string | null>(null);
	const [selectedToolName, setSelectedToolName] = useState(defaultSelectedToolName);
	const [toolInputs, setToolInputs] = useState<Record<string, string>>(defaultToolInputs);
	const [runningTool, setRunningTool] = useState(false);
	const [toolRunResult, setToolRunResult] = useState<EnterpriseToolRunResponse | null>(null);
	const [toolRunError, setToolRunError] = useState<string | null>(null);
	const [toolApprovalId, setToolApprovalId] = useState('');
	const [selectedWorkflowType, setSelectedWorkflowType] = useState(defaultSelectedWorkflowType);
	const [runningWorkflow, setRunningWorkflow] = useState(false);
	const [workflowRunResult, setWorkflowRunResult] =
		useState<EnterpriseWorkflowRunResponse | null>(null);
	const [workflowRunError, setWorkflowRunError] = useState<string | null>(null);
	const [workflowApprovalId, setWorkflowApprovalId] = useState('');
	const [workflowInputs, setWorkflowInputs] = useState<Record<string, string>>({
		...defaultEnterpriseWorkflowInputs,
	});
	const [workflowTemplates, setWorkflowTemplates] = useState<EnterpriseWorkflowTemplate[]>([]);
	const [workflowTemplatesLoading, setWorkflowTemplatesLoading] = useState(true);
	const [workflowTemplatesError, setWorkflowTemplatesError] = useState<string | null>(null);
	const [workflowRuns, setWorkflowRuns] = useState<EnterpriseWorkflowRunHistoryItem[]>([]);
	const [workflowRunsLoading, setWorkflowRunsLoading] = useState(true);
	const [workflowRunsError, setWorkflowRunsError] = useState<string | null>(null);
	const [scenarios, setScenarios] = useState<EnterprisePlatformScenario[]>([]);
	const [scenariosLoading, setScenariosLoading] = useState(true);
	const [scenariosError, setScenariosError] = useState<string | null>(null);
	const [opsTasks, setOpsTasks] = useState<EnterprisePlatformOpsTask[]>([]);
	const [opsTasksSummary, setOpsTasksSummary] =
		useState<EnterprisePlatformOpsTasksResponse['summary'] | null>(null);
	const [opsTasksLoading, setOpsTasksLoading] = useState(true);
	const [opsTasksError, setOpsTasksError] = useState<string | null>(null);
	const [resolvingOpsTaskCode, setResolvingOpsTaskCode] = useState<string | null>(null);
	const [savingWorkflowType, setSavingWorkflowType] = useState<string | null>(null);
	const [approvalRequests, setApprovalRequests] = useState<EnterpriseApprovalRequestItem[]>([]);
	const [approvalLoading, setApprovalLoading] = useState(true);
	const [approvalError, setApprovalError] = useState<string | null>(null);
	const [approvalForm, setApprovalForm] = useState<ApprovalFormState>(defaultApprovalForm);
	const [approvalFilters, setApprovalFilters] =
		useState<ApprovalFiltersState>(defaultApprovalFilters);
	const [creatingApproval, setCreatingApproval] = useState(false);
	const [creatingRunApproval, setCreatingRunApproval] =
		useState<EnterpriseApprovalRequestType | null>(null);
	const [decidingApprovalId, setDecidingApprovalId] = useState<string | null>(null);
	const [continuingApprovalId, setContinuingApprovalId] = useState<string | null>(null);
	const { agents, loading: agentsLoading, error: agentsError } = useAgents();
	const { credentials, loading: credentialsLoading, error: credentialsError } = useCredentials();
	const {
		knowledgeBases,
		loading: knowledgeLoading,
		error: knowledgeError,
	} = useKnowledgeBases();
	const { schedules, loading: schedulesLoading, error: schedulesError } = useSchedules();
	const {
		status: platformStatus,
		loading: platformLoading,
		error: platformError,
		refetch: refetchPlatform,
	} = usePlatformStatus();
	const [connectors, setConnectors] = useState<EnterprisePlatformConnectorsResponse | null>(
		null,
	);
	const [governance, setGovernance] =
		useState<EnterprisePlatformGovernanceResponse | null>(null);
	const [governanceLoading, setGovernanceLoading] = useState(true);
	const [governanceError, setGovernanceError] = useState<string | null>(null);
	const [selectedIdentityUserId, setSelectedIdentityUserId] = useState('');
	const [platformMembers, setPlatformMembers] =
		useState<EnterprisePlatformMembersResponse | null>(null);
	const [platformMembersLoading, setPlatformMembersLoading] = useState(true);
	const [platformMembersError, setPlatformMembersError] = useState<string | null>(null);
	const [memberForm, setMemberForm] = useState<MemberFormState>(defaultMemberForm);
	const [savingMember, setSavingMember] = useState(false);
	const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
	const [connectorsLoading, setConnectorsLoading] = useState(true);
	const [connectorsError, setConnectorsError] = useState<string | null>(null);
	const [connectorTestForm, setConnectorTestForm] =
		useState<ConnectorTestFormState>(defaultConnectorTestForm);
	const [testingConnector, setTestingConnector] = useState(false);
	const [connectorTestResult, setConnectorTestResult] =
		useState<EnterpriseConnectorTestResponse | null>(null);
	const [connectorTestError, setConnectorTestError] = useState<string | null>(null);
	const [savingConnectorConfig, setSavingConnectorConfig] = useState(false);
	const [connectorSaveError, setConnectorSaveError] = useState<string | null>(null);
	const [connectorSaveSuccess, setConnectorSaveSuccess] = useState<string | null>(null);
	const [platformAgents, setPlatformAgents] = useState<EnterprisePlatformAgentsResponse | null>(
		null,
	);
	const [platformAgentsLoading, setPlatformAgentsLoading] = useState(true);
	const [platformAgentsError, setPlatformAgentsError] = useState<string | null>(null);
	const [toolCatalog, setToolCatalog] = useState<EnterpriseToolCatalogResponse | null>(null);
	const [toolCatalogLoading, setToolCatalogLoading] = useState(true);
	const [toolCatalogError, setToolCatalogError] = useState<string | null>(null);
	const [toolPolicyDraft, setToolPolicyDraft] = useState<Record<string, ToolPolicyDraftValue>>(
		{},
	);
	const [savingToolPolicy, setSavingToolPolicy] = useState(false);
	const [toolPolicySaveError, setToolPolicySaveError] = useState<string | null>(null);
	const [toolPolicySaveSuccess, setToolPolicySaveSuccess] = useState<string | null>(null);
	const [auditEvents, setAuditEvents] = useState<EnterpriseAuditEvent[]>([]);
	const [auditSummary, setAuditSummary] = useState<
		EnterpriseAuditQueryResponse['summary'] | null
	>(null);
	const [auditLoading, setAuditLoading] = useState(true);
	const [auditError, setAuditError] = useState<string | null>(null);
	const [auditFilters, setAuditFilters] = useState<AuditFiltersState>(defaultAuditFilters);
	const [platformConfigExport, setPlatformConfigExport] =
		useState<EnterprisePlatformConfigExportResponse | null>(null);
	const [platformConfigLoading, setPlatformConfigLoading] = useState(true);
	const [platformConfigError, setPlatformConfigError] = useState<string | null>(null);
	const [platformConfigImportText, setPlatformConfigImportText] = useState('');
	const [platformConfigImportMode, setPlatformConfigImportMode] = useState<'merge' | 'replace'>(
		'merge',
	);
	const [importingPlatformConfig, setImportingPlatformConfig] = useState(false);
	const [platformConfigImportResult, setPlatformConfigImportResult] = useState<string | null>(
		null,
	);
	const [publishingTemplateId, setPublishingTemplateId] = useState<string | null>(null);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
	const [selectedAppCenterItem, setSelectedAppCenterItem] =
		useState<AppCenterSelection | null>(null);
	const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
	const [archivingAgentId, setArchivingAgentId] = useState<string | null>(null);
	const [bindingAgentModelId, setBindingAgentModelId] = useState<string | null>(null);
	const [bindingAgentKnowledgeId, setBindingAgentKnowledgeId] = useState<string | null>(null);
	const [bindingAgentToolsId, setBindingAgentToolsId] = useState<string | null>(null);
	const [enablingAgentMemoryId, setEnablingAgentMemoryId] = useState<string | null>(null);
	const [enablingAgentWorkflowId, setEnablingAgentWorkflowId] = useState<string | null>(null);
	const [publishForm, setPublishForm] = useState<PublishFormState>(defaultPublishForm);

	const {
		serverUrl,
		username,
	} = createPlatformConnectionPageState({
		currentUserId: platformStatus?.current_user.user_id,
		storedServerUrl: localStorage.getItem('server_url'),
		storedUsername: localStorage.getItem('username'),
		labels: platformConnectionLabels(t),
	});
	const {
		auditRequestText,
		configManagementRequestText,
		connectorRequestText,
		agentRunnerRequestText,
		agentManagementRequestText,
		approvalRequestText,
		memberRequestText,
		tenantGovernanceRequestText,
		toolCatalogRequestText,
		scenarioRequestText,
		opsTasksRequestText,
		toolRunnerRequestText,
		workflowRunnerRequestText,
	} = createPlatformRequestTexts(t);
	const hasErrors = platformPageHasErrors({
		agentsError,
		credentialsError,
		knowledgeError,
		schedulesError,
		platformError,
		connectorsError,
		governanceError,
		platformMembersError,
		platformAgentsError,
		toolCatalogError,
		auditError,
		workflowTemplatesError,
		workflowRunsError,
		scenariosError,
		opsTasksError,
		approvalError,
		platformConfigError,
		agentRunsError,
	});

	const {
		agentTemplates,
		publishedPlatformAgents,
		featuredAgents,
		activePlatformAgents,
		archivedPlatformAgents,
		readyPlatformAgents,
		selectedRunAgent,
		lastPublishedAgent,
		selectedAgentConversation,
		selectedTemplate,
		defaultAgentTemplate,
	} = createPlatformAgentInventoryPageState({
		agents,
		platformAgents,
		selectedRunAgentId,
		lastPublishedAgentId,
		selectedTemplateId,
		agentConversations,
	});
	const {
		credentialById,
		knowledgeBaseById,
	} = createPlatformResourcePageState({
		credentials,
		knowledgeBases,
	});
	const {
		agentSetupSteps,
		nextAgentSetupStep,
		primaryAgentSampleQuestion,
		selectedRunAgentModelLabel,
		selectedRunAgentKnowledgeLabels,
		selectedRunAgentToolCount,
		selectedRunAgentKnowledgeCount,
		selectedRunAgentReadinessState,
		selectedRunAgentReadinessLabel,
		nextStepMode,
		nextStepPrimaryDisabled,
		agentRunModelLabel,
		agentRunKnowledgeLabels,
		agentRunConnectorSourceText,
		agentToolCalls,
		agentToolCallBadgeText,
		agentRunEvidence,
	} = createPlatformAgentRunnerPageState({
		setup: {
			selectedTemplateName: selectedTemplate?.name,
			modelConfigId: publishForm.model_config_id,
			credentialById,
			credentialCount: credentials.length,
			selectedKnowledgeBaseCount: publishForm.knowledge_base_ids.length,
			knowledgeBaseCount: knowledgeBases.length,
			selectedToolCount: publishForm.tools.length,
			memoryEnabled: publishForm.memory_enabled,
			workflowEnabled: publishForm.workflow_enabled,
			refs: {
				template: agentTemplateStepRef,
				model: agentModelStepRef,
				knowledge: agentKnowledgeStepRef,
				tools: agentToolsStepRef,
				runtime: agentRuntimeStepRef,
			},
		},
		setupLabels: agentSetupStepLabels(t),
		runner: {
			selectedRunAgent,
			agentRunResult,
			credentialById,
			knowledgeBaseById,
			credentialCount: credentials.length,
			activePlatformAgentCount: activePlatformAgents.length,
			readyPlatformAgentCount: readyPlatformAgents.length,
			hasDefaultAgentTemplate: Boolean(defaultAgentTemplate),
			publishingTemplate: Boolean(publishingTemplateId),
		},
		runnerLabels: agentRunnerLabels(t),
		sampleQuestions: agentSampleQuestions,
	});
	const {
		enterpriseIdentities,
		subagentTemplates,
		toolPolicyMode,
	} = createPlatformRuntimePageState({
		platformStatus,
		governance,
		connectors,
		labels: platformRuntimeConfigLabels(t),
	});
	const {
		publishTenant,
		publishAccessMembers,
		publishRoleOptions,
		publishSelectedModelLabel,
		publishAccessScopeSummary,
		publishRuntimeSummary,
		publishReleaseIssues,
		publishBlocked,
	} = createPlatformPublishPageState({
		access: {
			tenant: publishForm.tenant,
			currentUserTenant: platformStatus?.current_user.tenant,
			members: platformMembers?.members ?? [],
			configuredRoles: platformMembers?.roles ?? [],
			allowedUserIds: publishForm.allowed_user_ids,
			allowedRoles: publishForm.allowed_roles,
		},
		draft: {
			modelConfigId: publishForm.model_config_id,
			knowledgeBaseCount: publishForm.knowledge_base_ids.length,
			allowedUserCount: publishForm.allowed_user_ids.length,
			allowedRoleCount: publishForm.allowed_roles.length,
			memoryEnabled: publishForm.memory_enabled,
			workflowEnabled: publishForm.workflow_enabled,
			hasSelectedTemplate: Boolean(selectedTemplate),
			credentialById,
		},
		draftLabels: publishDraftLabels(t),
	});
	const {
		selectedIdentity,
		selectedRunAgentAccessAllowed,
		selectedRunAgentAccessLabel,
		selectedIdentityAllowedTools,
		selectedIdentityDeniedTools,
		selectedIdentityWorkspace,
		currentIdentityLabel,
	} = createPlatformSelectedIdentityPageState({
		enterpriseIdentities,
		selectedIdentityUserId,
		selectedRunAgent,
		governanceWorkspaces: governance?.tenant_workspaces,
		connectorWorkspaces: connectors?.tenant_workspaces,
		username,
		...selectedIdentityLabels(t),
	});

	const { stats, runtimeItems } = createPlatformOverviewPageState({
		stats: {
			platformAgentCount: platformAgents?.agents.length,
			agentCount: agents.length,
			credentialCount: credentials.length,
			knowledgeBaseCount: knowledgeBases.length,
			workflowTemplateCount: workflowTemplates.length,
			scheduleCount: schedules.length,
			loading: {
				agents: platformAgentsLoading || agentsLoading,
				credentials: credentialsLoading,
				knowledgeBases: knowledgeLoading,
				workflows: workflowTemplatesLoading || schedulesLoading,
			},
		},
		runtime: {
			platformStatus,
			currentIdentityLabel,
		},
		options: {
			stats: {
				icons: platformOverviewStatIcons,
				labels: platformOverviewStatLabels(t),
			},
			runtime: {
				icons: runtimeStatusIcons,
				labels: runtimeStatusLabels(t),
			},
		},
	});

	const {
		policyDecisions,
		availableToolItems,
		selectedToolCatalogItem,
		selectedToolConfig,
		selectedToolDecision,
		selectedToolInputKey,
		selectedToolInputValue,
		selectedToolAllowed,
		selectedToolReason,
	} = createPlatformToolRunnerPageState({
		catalog: {
			platformStatus,
			toolCatalog,
			toolInputConfig: enterpriseToolInputConfig,
		},
		selectedTool: {
			selectedToolName,
			toolInputs,
			toolInputConfig: enterpriseToolInputConfig,
			labels: selectedToolRunnerLabels(t),
		},
	});
	const { agentRoutingLabel, agentRoutingText } = createPlatformAgentRoutingPageState({
		agentRunResult,
		labels: agentRoutingLabels(t),
	});
	const {
		connectorState,
		savedConnectorConfigs,
		activeConnectorTenant,
		activeSavedConnectorConfig,
		connectorDraftIssues,
		connectorDraftState,
		connectorTestPassed,
		connectorRuntimeState,
		connectorRuntimeSourceText,
	} = createPlatformConnectorPageState({
		connectors,
		form: connectorTestForm,
		testResult: connectorTestResult,
		labels: connectorOperationsLabels(t),
	});
	const {
		dashboardOperations,
		pendingApprovals,
		approvedApprovalCount,
		approvalSummary,
		recentWorkflowRuns,
		workflowRunCount,
		recentAuditEvents,
		auditEventCount,
		tenantWorkspaces,
		tenantOverviewItems,
		platformMemberTenantSummaries,
		memoryOperationsItems,
		memoryOperationsRunCount,
		memoryOperationsHitCount,
		memoryOperationsSavedCount,
		riskToolItems,
		completedWorkflowRunCount,
		partialWorkflowRunCount,
		failedWorkflowRunCount,
		governedWorkflowItems,
		recommendedOperationActions,
		dashboardTodoItems,
	} = createPlatformDashboardPageState({
		source: { platformStatus },
		fallback: {
			governance,
			approvalRequests,
			workflowRuns,
			auditEvents,
		},
		operations: {
			availableToolItems,
		},
		tenantWorkspace: {
			connectors,
			enterpriseIdentities,
			activePlatformAgents,
			auditEvents,
			workflowRuns,
			members: platformMembers?.members ?? [],
		},
		tenantWorkspaceLabels: tenantWorkspaceOperationsLabels(t),
		memoryOperations: {
			activePlatformAgents,
			agentConversations,
		},
		todo: {
			credentialCount: credentials.length,
			activeAgentCount: activePlatformAgents.length,
			readyAgentCount: readyPlatformAgents.length,
			hasErrors,
		},
		todoLabels: dashboardTodoLabels(t),
	});
	const {
		blockedOrPartialPlatformAgents,
		appCenterAgents,
		inspectedAppCenterAgent,
		inspectedAppCenterTemplate,
		appCenterPrimaryDisabled,
		agentOpsSummary,
		topOperationsAgents,
		operationsAgentIssueText,
		agentResourceText,
		appCenterDetailResources,
		appCenterDetailIssues,
		appCenterDetailStatus,
		operationsHeadline,
	} = createPlatformAppCenterPageState({
		operations: {
			selectedItem: selectedAppCenterItem,
			activeAgents: activePlatformAgents,
			readyAgents: readyPlatformAgents,
			publishedAgents: publishedPlatformAgents,
			archivedAgents: archivedPlatformAgents,
			templates: agentTemplates,
			defaultTemplate: defaultAgentTemplate,
			hasCredentials: credentials.length > 0,
			publishingTemplateId,
			labels: appCenterOperationsLabels(t),
		},
		agentDisplay: {
			credentialById,
			labels: appCenterAgentDisplayLabels(t),
		},
		detail: {
			selection: {
				credentialById,
				knowledgeBaseById,
				modelCount: credentials.length,
				knowledgeBaseCount: knowledgeBases.length,
				labels: appCenterDetailResourceValueLabels(t),
			},
			resourceLabels: appCenterDetailResourcesLabels(t),
			health: {
				hasCredentials: credentials.length > 0,
				hasKnowledgeBases: knowledgeBases.length > 0,
				labels: appCenterDetailHealthLabels(t),
			},
			headline: {
				activeAgentCount: activePlatformAgents.length,
				pendingApprovalCount: pendingApprovals.length,
			},
			headlineLabels: operationsHeadlineLabels(t),
		},
	});
	const agentReleasePipeline = createPlatformAgentReleasePipelinePageState(
		{
			selectedTemplate,
			publishForm,
			credentialById,
			activeAgents: activePlatformAgents,
			pendingApprovals,
			auditEventCount,
			selectedRunAgent,
			stepStates: agentSetupSteps,
		},
		agentReleasePipelineLabels(t),
		agentReleasePipelineIcons,
	);
	const {
		selectedIdentityPendingApprovals,
		selectedIdentityPendingToolNames,
		identityAccessRows,
		accessTenantSummaries,
		accessControlStats,
		governanceHealthItems,
		toolPolicySummary,
		selectedIdentityFailedAuditEvents,
		selectedIdentityRecentAuditEvents,
	} = createPlatformGovernancePageState({
		selectedIdentity: {
			selectedIdentity,
			pendingApprovals,
			auditEvents,
			availableToolItems,
			toolPolicyDraft,
		},
		operations: {
			enterpriseIdentities,
			pendingApprovals,
			governance,
			auditEventCount,
			accessLabels: governanceAccessLabels(t),
			healthLabels: governanceHealthLabels(t),
			icons: governanceHealthIcons,
		},
	});
	const {
		selectedWorkflowTemplate,
		workflowOptions,
		selectedWorkflowDisabled,
		workflowPendingApprovals,
		selectedWorkflowName,
		selectedWorkflowSteps,
		selectedWorkflowLastRun,
		workflowOpsStats,
		recentSchedules,
		triggerOpsStats,
		triggerOpsSummary,
	} = createPlatformWorkflowPageState({
		selection: {
			values: { workflowTemplates, selectedWorkflowType },
			labels: workflowSelectionLabels(t),
		},
		operations: {
			workflowTemplates,
			selectedWorkflowType,
			recentWorkflowRuns,
			workflowRunCount,
			pendingApprovals,
			labels: workflowOperationsLabels(t),
		},
		trigger: {
			schedules,
			statLabels: triggerOperationsStatLabels(t),
			summaryLabels: triggerOperationsSummaryLabels(t),
		},
	});
	const auditStats = createPlatformAuditStatsPageState({
		audit: {
			auditSummary,
			auditEvents,
		},
		labels: auditStatsLabels(t),
	});
	usePlatformDataLoadEffects(
		{
			selectedIdentityUserId,
			selectedRunAgentId,
		},
		{
			refetchApprovals: () => refetchApprovals(),
			refetchAuditEvents: () => refetchAuditEvents(),
			refetchConnectors: () => refetchConnectors(),
			refetchGovernance: () => refetchGovernance(),
			refetchMembers: () => refetchMembers(),
			refetchOpsTasks: () => refetchOpsTasks(),
			refetchPlatformAgents: () => refetchPlatformAgents(),
			refetchPlatformConfigExport: () => refetchPlatformConfigExport(),
			refetchScenarios: () => refetchScenarios(),
			refetchToolCatalog: () => refetchToolCatalog(),
			refetchWorkflowRuns: () => refetchWorkflowRuns(),
			refetchWorkflowTemplates: () => refetchWorkflowTemplates(),
		},
	);

	usePlatformSelectionSyncEffects(
		{
			activePlatformAgents,
			agentConversations,
			availableToolItems,
			connectorDefaultsAppliedRef,
			connectors,
			enterpriseIdentities,
			readyPlatformAgents,
			selectedIdentityAllowedTools,
			selectedIdentityDeniedTools,
			selectedIdentityUserId,
			selectedRunAgentId,
			selectedWorkflowType,
			workflowTemplates,
		},
		{
			refetchAgentRuns: () => refetchAgentRuns(),
			setAgentRunResult,
			setConnectorTestForm,
			setSelectedIdentityUserId,
			setSelectedRunAgentId,
			setSelectedWorkflowType,
			setToolPolicyDraft,
			setToolPolicySaveError,
			setToolPolicySaveSuccess,
			setWorkflowInputs,
		},
	);

	const { refetchGovernance } = createPlatformGovernanceHandlers(
		{
			loadErrorMessage: auditRequestText.loadError,
		},
		{
			setLoading: setGovernanceLoading,
			clearError: () => setGovernanceError(null),
			loadGovernance: platformApi.governance,
			setGovernance,
			setError: setGovernanceError,
		},
	);

	const {
		refetchAgentManagementDependencies,
		refetchApprovalDependencies,
		refetchConnectorConfigDependencies,
		refetchOpsTaskResolveDependencies,
		refetchPlatformConfigImportDependencies,
		refetchRuntimeRunDependencies,
		refetchToolPolicyDependencies,
		refetchWorkflowRunDependencies,
		refetchWorkflowTemplateDependencies,
		refreshMemberDependentViews,
	} = createPlatformRefreshDependencyHandlers({
		refetchPlatform: () => refetchPlatform(),
		refetchMembers: () => refetchMembers(),
		refetchConnectors: () => refetchConnectors(),
		refetchGovernance: () => refetchGovernance(),
		refetchPlatformAgents: () => refetchPlatformAgents(),
		refetchToolCatalog: () => refetchToolCatalog(),
		refetchWorkflowTemplates: () => refetchWorkflowTemplates(),
		refetchPlatformConfigExport: () => refetchPlatformConfigExport(),
		refetchOpsTasks: () => refetchOpsTasks(),
		refetchAuditEvents: () => refetchAuditEvents(),
		refetchWorkflowRuns: () => refetchWorkflowRuns(),
		refetchScenarios: () => refetchScenarios(),
	});

	const {
		refetchPlatformConfigExport,
		handleCopyPlatformConfig,
		handleImportPlatformConfig,
	} =
		createPlatformConfigManagementHandlers(
			{
				platformConfigExport,
				platformConfigImportText,
				platformConfigImportMode,
				text: configManagementRequestText,
			},
			{
				setImportText: setPlatformConfigImportText,
				setLoading: setPlatformConfigLoading,
				clearError: () => setPlatformConfigError(null),
				exportConfig: platformApi.exportConfig,
				setExport: setPlatformConfigExport,
				copyText: async (text) => {
					if (navigator.clipboard) {
						await navigator.clipboard.writeText(text);
					}
				},
				setImporting: setImportingPlatformConfig,
				clearResult: () => setPlatformConfigImportResult(null),
				importConfig: platformApi.importConfig,
				setResult: setPlatformConfigImportResult,
				refreshDependentViews: refetchPlatformConfigImportDependencies,
				setError: setPlatformConfigError,
		},
	);

	const {
		refetchMembers,
		handleSaveMember,
		handleEditMember,
		handleToggleMemberStatus,
	} = createPlatformMemberHandlers(
		{
			memberForm,
			text: memberRequestText,
		},
		{
			setLoading: setPlatformMembersLoading,
			clearLoadError: () => setPlatformMembersError(null),
			loadMembers: platformApi.members,
			setMembers: setPlatformMembers,
			setLoadError: setPlatformMembersError,
			setMemberForm,
			setSavingMember,
			clearError: () => setPlatformMembersError(null),
			setError: setPlatformMembersError,
			createMember: async (payload) => {
				await platformApi.createMember(payload);
			},
			resetForm: () => setMemberForm(defaultMemberForm),
			refreshDependentViews: refreshMemberDependentViews,
			setUpdatingMember: setUpdatingMemberId,
			activateMember: async (userId, patch) => {
				await platformApi.updateMember(userId, patch);
			},
			deactivateMember: async (userId) => {
				await platformApi.deactivateMember(userId);
			},
		},
	);

	const {
		refetchConnectors,
		loadSavedConnectorConfig,
		handleSaveConnectorConfig,
		handleTestConnector,
		handleTestAndSaveConnectorConfig,
	} = createPlatformConnectorHandlers(
		{
			connectorTestForm,
			connectorDraftIssues,
			text: connectorRequestText,
		},
		{
			setLoading: setConnectorsLoading,
			clearLoadError: () => setConnectorsError(null),
			loadConnectors: platformApi.connectors,
			setLoadedConnectors: setConnectors,
			setLoadError: setConnectorsError,
			setConnectorTestForm,
			setConnectorTestResult,
			setConnectorTestError,
			setConnectorSaveError,
			setConnectorSaveSuccess,
			setSavingConnectorConfig,
			saveConnectorConfig: platformApi.saveConnectorConfig,
			setConnectors,
			refreshDependentViews: refetchConnectorConfigDependencies,
			setTestingConnector,
			testConnector: platformApi.testConnector,
		},
	);

	const { refetchToolCatalog } = createPlatformToolCatalogHandlers(
		{
			loadErrorMessage: toolCatalogRequestText.loadError,
			params: {
				agentId: selectedRunAgentId,
				userId: selectedIdentityUserId,
			},
		},
		{
			setLoading: setToolCatalogLoading,
			clearError: () => setToolCatalogError(null),
			loadToolCatalog: platformApi.tools,
			setToolCatalog,
			setError: setToolCatalogError,
		},
	);

	const { handleSaveToolPolicy } = createPlatformToolPolicyHandlers(
		{
			selectedIdentity,
			toolPolicyDraft,
			text: tenantGovernanceRequestText,
		},
		{
			setSavingToolPolicy,
			setToolPolicySaveError,
			setToolPolicySaveSuccess,
			updateToolPolicy: async (payload) => {
				await platformApi.updateToolPolicy(payload);
			},
			refreshDependentViews: refetchToolPolicyDependencies,
		},
	);

	const { refetchAuditEvents } = createPlatformAuditHandlers(
		{
			filters: auditFilters,
			loadErrorMessage: auditRequestText.loadError,
		},
		{
			setLoading: setAuditLoading,
			clearError: () => setAuditError(null),
			loadAuditEvents: platformApi.audit,
			setAuditEvents,
			setAuditSummary,
			setError: setAuditError,
		},
	);

	const { refetchPlatformAgents } = createPlatformAgentManagementHandlers(
		{
			loadErrorMessage: agentManagementRequestText.loadError,
		},
		{
			setLoading: setPlatformAgentsLoading,
			clearError: () => setPlatformAgentsError(null),
			loadPlatformAgents: platformApi.agents,
			setPlatformAgents,
			setError: setPlatformAgentsError,
		},
	);

	const { refetchWorkflowRuns } = createPlatformWorkflowRunHandlers(
		{
			limit: 10,
			loadErrorMessage: workflowRunnerRequestText.historyLoadError,
		},
		{
			setLoading: setWorkflowRunsLoading,
			clearError: () => setWorkflowRunsError(null),
			loadWorkflowRuns: platformApi.workflowRuns,
			setWorkflowRuns,
			setError: setWorkflowRunsError,
		},
	);

	const { refetchScenarios } = createPlatformScenarioHandlers(
		{
			loadErrorMessage: scenarioRequestText.loadError,
		},
		{
			setLoading: setScenariosLoading,
			clearError: () => setScenariosError(null),
			loadScenarios: platformApi.scenarios,
			setScenarios,
			setError: setScenariosError,
		},
	);

	const {
		refetchApprovals,
		handleApproveAndRun,
		handleCreateApproval,
		handleCreateRunApproval,
		handleDecideApproval,
		handlePrimeToolApproval,
		handleUseApproval,
	} = createPlatformApprovalHandlers(
		{
			approvalForm,
			approvalFilters,
			agentQuestion,
			defaultApprovalReason: defaultApprovalForm.reason,
			defaultApprovalInputValue: defaultApprovalForm.input_value,
			selectedIdentityUserId,
			selectedRunAgentId,
			selectedToolInputKey,
			selectedToolInputValue,
			selectedToolName,
			selectedWorkflowType,
			username,
			availableToolItems,
			toolInputConfig: enterpriseToolInputConfig,
			workflowInputs,
			text: approvalRequestText,
		},
		{
			setApprovalLoading,
			setCreatingApproval,
			setCreatingRunApproval,
			setContinuingApprovalId,
			setApprovalError,
			loadApprovals: platformApi.approvals,
			createApproval: platformApi.createApproval,
			approveApproval: platformApi.approveApproval,
			rejectApproval: platformApi.rejectApproval,
			setApprovalRequests,
			refreshDependentViews: refetchApprovalDependencies,
			setApprovalForm,
			setDecidingApprovalId,
			selectIdentityUser: setSelectedIdentityUserId,
			selectRunAgent: setSelectedRunAgentId,
			setAgentApprovalId,
			setAgentQuestion,
			clearAgentRunError: () => setAgentRunError(null),
			scrollToAgentRunner,
			runAgent: (options) => runEnterpriseAgent(options),
			selectToolName: setSelectedToolName,
			patchToolInputs: setToolInputs,
			setToolApprovalId,
			clearToolRunError: () => setToolRunError(null),
			setToolRunError,
			scrollToToolRunner,
			runTool: (options) => runEnterpriseTool(options),
			selectWorkflowType: setSelectedWorkflowType,
			setWorkflowInputs,
			setWorkflowApprovalId,
			clearWorkflowRunError: () => setWorkflowRunError(null),
			setWorkflowRunError,
			scrollToWorkflowRunner,
			runWorkflow: (options) => runEnterpriseWorkflow(options),
			scrollToGovernance,
		},
	);

	const {
		handleUseIdentity,
		handleUseTenant,
		handleOpenMemoryOperation,
	} = createPlatformAgentRunnerEntryHandlers(
		{
			enterpriseIdentities,
			selectedIdentity,
			primaryAgentSampleQuestion,
		},
		{
			selectIdentityUser: setSelectedIdentityUserId,
			selectRunAgent: setSelectedRunAgentId,
			setResult: setAgentRunResult,
			setQuestion: setAgentQuestion,
			clearError: () => setAgentRunError(null),
			scrollToAgentRunner,
		},
	);

	const {
		handleInspectIdentityAudit,
		handleInspectIdentityApprovals,
		handleInspectIdentityFailures,
		handleInspectTenantAudit,
		handleInspectMemoryOperationAudit,
		handleInspectTenantApprovals,
		handleInspectAgentRunAudit,
	} = createPlatformGovernanceInspectionHandlers(
		{
			agentRunEvidence,
		},
		{
			patchAuditFilters: setAuditFilters,
			refetchAuditEvents,
			patchApprovalFilters: setApprovalFilters,
			refetchApprovals,
			scrollToGovernance,
		},
	);

	const syncAgentQuickConfiguration =
		createPlatformAgentQuickConfigurationSyncHandler(
			{
				editingAgentId,
				selectedRunAgentId,
			},
			{
				setSelectedRunAgent: setSelectedRunAgentId,
				setPublishForm,
			},
		);

	const {
		handleBindAvailableKnowledge,
		handleBindDefaultModel,
		handleBindTemplateTools,
		handleEnableAgentMemory,
		handleEnableAgentWorkflow,
	} = createPlatformAgentQuickConfigurationHandlers({
		credentials,
		knowledgeBases,
		templates: agentTemplates,
		requestText: agentManagementRequestText,
		navigateToPath: navigate,
		setPlatformAgentsError,
		setBindingAgentModel: setBindingAgentModelId,
		setBindingAgentKnowledge: setBindingAgentKnowledgeId,
		setBindingAgentTools: setBindingAgentToolsId,
		setEnablingAgentMemory: setEnablingAgentMemoryId,
		setEnablingAgentWorkflow: setEnablingAgentWorkflowId,
		updateAgent: platformApi.updateAgent,
		syncQuickConfiguration: syncAgentQuickConfiguration,
		refreshDependentViews: refetchAgentManagementDependencies,
	});

	const {
		refetchAgentRuns,
		handlePrimeAgentRunner,
		handlePrimePublishedAgent,
		handleSelectRunAgent,
		handleSelectAgentRun,
		handleClearAgentConversation,
		runEnterpriseAgent,
		handleRunEnterpriseAgent,
		runEnterpriseTool,
		handleRunEnterpriseTool,
		runEnterpriseWorkflow,
		handleRunEnterpriseWorkflow,
		handlePrimeAgentWorkflow,
		handleRunScenario,
	} = createPlatformRunnerHandlers(
		{
			agentConversations,
			agentQuestion,
			selectedRunAgentId,
			selectedIdentityUserId,
			username,
			agentApprovalId,
			activePlatformAgents,
			selectedRunAgent,
			enterpriseIdentities,
			selectedIdentity,
			primaryAgentSampleQuestion,
			selectedToolName,
			selectedToolInputKey,
			selectedToolInputValue,
			toolApprovalId,
			selectedWorkflowType,
			selectedWorkflowTemplate,
			workflowOptions,
			workflowInputs,
			workflowTemplates,
			workflowApprovalId,
			requestText: {
				agentHistoryLoadError: agentRunnerRequestText.historyLoadError,
				agentHistoryClearError: agentRunnerRequestText.historyClearError,
				agentAccessDenied: agentRunnerRequestText.accessDenied,
				agentApprovalRequiredCreated:
					agentRunnerRequestText.approvalRequiredCreated,
				toolApprovalRequiredCreated:
					toolRunnerRequestText.approvalRequiredCreated,
				workflowApprovalRequiredCreated:
					workflowRunnerRequestText.approvalRequiredCreated,
			},
		},
		{
			setAgentQuestion,
			setAgentRunError,
			setSelectedRunAgentId,
			setAgentRunResult,
			setAgentRunsLoading,
			setAgentRunsError,
			loadAgentRuns: platformApi.agentRuns,
			loadAgentRun: platformApi.agentRun,
			clearAgentRuns: platformApi.clearAgentRuns,
			setAgentConversations,
			setRunningAgent,
			runAgent: platformApi.runAgent,
			refreshApprovals: refetchApprovals,
			refreshRuntimeRunDependencies: refetchRuntimeRunDependencies,
			setRunningTool,
			setToolRunError,
			runTool: platformApi.runTool,
			setToolRunResult,
			createRunApproval: handleCreateRunApproval,
			setRunningWorkflow,
			setWorkflowRunError,
			runWorkflow: platformApi.runWorkflow,
			setWorkflowRunResult,
			refreshWorkflowRunDependencies: refetchWorkflowRunDependencies,
			setSelectedWorkflowType,
			setWorkflowInputs,
			setWorkflowApprovalId,
			setSelectedIdentityUserId,
			scrollToAgentRunner,
			scrollToWorkflowRunner,
			now: () => new Date().toISOString(),
			fallbackId: (agentId) => `${agentId}-${Date.now()}`,
		},
	);

	const { refetchWorkflowTemplates, handleToggleWorkflowTemplate } =
		createPlatformWorkflowTemplateHandlers(
			{
				text: {
					templatesLoadError: workflowRunnerRequestText.templatesLoadError,
				},
			},
			{
				setWorkflowTemplatesLoading,
				setSavingWorkflowType,
				setWorkflowTemplatesError,
				loadWorkflowTemplates: platformApi.workflows,
				updateWorkflow: platformApi.updateWorkflow,
				setWorkflowTemplates,
				refreshDependentViews: refetchWorkflowTemplateDependencies,
			},
		);

	const { refetchOpsTasks, handleOperationAction, handleResolveOpsTask } =
		createPlatformOpsTaskHandlers(
			{
				text: {
					loadError: opsTasksRequestText.loadError,
					resolveError: opsTasksRequestText.resolveError,
				},
			},
			{
				scrollToAgentManagement,
				scrollToConnectorCenter,
				scrollToGovernance,
				scrollToWorkflowRunner,
				scrollToToolRunner,
				scrollToMemoryOperations,
				navigate,
				setOpsTasksLoading,
				setResolvingOpsTaskCode,
				setOpsTasksError,
				loadOpsTasks: platformApi.opsTasks,
				resolveOpsTask: platformApi.resolveOpsTask,
				setWorkflowTemplates,
				setOpsTasks,
				setOpsTasksSummary,
				refreshDependentViews: refetchOpsTaskResolveDependencies,
			},
		);

	const {
		handleArchiveAgent,
		handleCancelEdit,
		handleConfigureTemplate,
		handleEditAgent,
		handlePrepareTenantAgent,
		handlePublishAgent,
		handlePublishTenantChange,
		handleQuickPublishAgent,
		handleStartPublishing,
		handleTogglePublishList,
	} = createPlatformAgentPublishingHandlers({
		credentials,
		knowledgeBases,
		templates: agentTemplates,
		selectedTemplateId,
		selectedTemplate,
		defaultTemplate: defaultAgentTemplate,
		currentUserTenant: platformStatus?.current_user.tenant,
		members: platformMembers?.members ?? [],
		selectedRunAgentId,
		editingAgentId,
		form: publishForm,
		requestText: agentManagementRequestText,
		navigateToPath: navigate,
		selectTemplate: setSelectedTemplateId,
		setEditingAgent: setEditingAgentId,
		setPublishForm,
		setPublishingTemplate: setPublishingTemplateId,
		setArchivingAgent: setArchivingAgentId,
		setPlatformAgentsError,
		publishAgent: platformApi.publishAgent,
		updateAgent: platformApi.updateAgent,
		archiveAgent: platformApi.archiveAgent,
		setLastPublishedAgent: setLastPublishedAgentId,
		primePublishedAgent: handlePrimePublishedAgent,
		setSelectedRunAgent: setSelectedRunAgentId,
		clearRunResult: () => {
			setAgentRunResult(null);
			setAgentRunError(null);
		},
		refreshDependentViews: refetchAgentManagementDependencies,
		scrollToAgentManagement,
		focusAgentManagement: () => window.setTimeout(scrollToAgentManagement, 0),
	});

	const {
		handleNextAgentSetupStep,
		handleNextStepPrimaryAction,
		handleAppCenterPrimaryAction,
		handleAppCenterDetailPrimaryAction,
		handleAppCenterDetailSecondaryAction,
	} = createPlatformNavigationRequestHandlers(
		{
			nextAgentSetupStep,
			selectedTemplate,
			defaultTemplate: defaultAgentTemplate,
			credentialCount: credentials.length,
			knowledgeBaseCount: knowledgeBases.length,
			nextStepMode,
			readyPlatformAgents,
			activePlatformAgents,
			inspectedAppCenterAgent,
			inspectedAppCenterTemplate,
		},
		{
			configureTemplate: handleConfigureTemplate,
			navigate,
			scrollToAgentManagement,
			scrollToGovernance,
			setSelectedRunAgentId,
			handlePrimeAgentRunner,
			handleQuickPublishAgent,
			handleEditAgent,
		},
	);

	const platformNavigationHandlers = createPlatformNavigationHandlers({
		navigate,
		handleStartPublishing,
		handleQuickPublishAgent,
		scrollToAgentRunner,
		scrollToConfigManagement,
		scrollToConnectorCenter,
		scrollToGovernance,
		scrollToMemoryOperations,
		scrollToMembers,
		scrollToToolRunner,
		scrollToWorkflowRunner,
	});
	const {
		capabilities,
		activeMemberCount,
		launchpadPrimaryStep,
		launchpadReadyCount,
		launchpadState,
		launchpadSteps,
		launchpadTotalCount,
	} = createPlatformLaunchpadPageState({
		capabilities: {
			t,
			counts: {
				credentials: credentials.length,
				knowledgeBases: knowledgeBases.length,
				activeAgents: activePlatformAgents.length,
				availableTools: availableToolItems.length,
				workflows: workflowTemplates.length || schedules.length,
				tenants: platformMemberTenantSummaries.length,
				pendingApprovals: pendingApprovals.length,
				auditEvents: auditEventCount,
				configMembers: platformConfigExport?.counts.members ?? 0,
				configAgents: platformConfigExport?.counts.agents ?? 0,
			},
			hasConfigExport: Boolean(platformConfigExport),
			icons: capabilityIcons,
			actions: capabilityNavigationActions(platformNavigationHandlers),
		},
		launchpad: {
			members: platformMembers?.members ?? [],
			credentialCount: credentials.length,
			knowledgeBaseCount: knowledgeBases.length,
			activeAgentCount: activePlatformAgents.length,
			readyAgentCount: readyPlatformAgents.length,
			hasAgentRunResult: Boolean(agentRunResult),
			hasSelectedRunAgent: Boolean(selectedRunAgent),
			auditEventCount,
			pendingApprovalCount: pendingApprovals.length,
		},
		launchpadOptions: {
			icons: launchpadStepIcons,
			navigationActions: launchpadNavigationActions(platformNavigationHandlers),
			fallbackAction: scrollToGovernance,
			labels: launchpadStepLabels(t),
		},
	});

	const {
		platformConsoleItems,
		workbenchActions,
		workbenchIndicators,
		workbenchQuickActions,
		workbenchReadinessItems,
		workbenchRiskItems,
	} = createPlatformWorkbenchPageState({
		consoleItems: {
			icons: platformConsoleIcons,
			actions: platformConsoleNavigationActions(platformNavigationHandlers),
			labels: platformConsoleItemLabels(t),
		},
		workbench: {
			activeAgentCount: activePlatformAgents.length,
			readyAgentCount: readyPlatformAgents.length,
			pendingApprovalCount: pendingApprovals.length,
			recentWorkflowRunCount: recentWorkflowRuns.length,
			failedWorkflowRunCount,
			memoryOperationsSavedCount,
			memoryOperationsHitCount,
			memoryOperationsItemCount: memoryOperationsItems.length,
			memoryOperationsRunCount,
			selectedRunAgentName: selectedRunAgent?.name,
			workflowTemplateCount: workflowTemplates.length,
			credentialCount: credentials.length,
			knowledgeBaseCount: knowledgeBases.length,
			savedConnectorConfigCount: savedConnectorConfigs.length,
			connectorDraftIssueCount: connectorDraftIssues.length,
			savedConnectorConfigEnabled: Boolean(connectors?.runtime.saved_config_enabled),
			activeMemberCount,
			hasErrors,
		},
		workbenchOptions: {
			indicator: {
				icons: workbenchIndicatorIcons,
				actions: workbenchIndicatorNavigationActions(platformNavigationHandlers),
				labels: workbenchIndicatorLabels(t, {
					memoryOperationsSavedCount,
					memoryOperationsHitCount,
				}),
			},
			primaryAction: {
				icons: workbenchPrimaryActionIcons,
				actions: workbenchPrimaryNavigationActions(platformNavigationHandlers),
				labels: workbenchPrimaryActionLabels(t),
			},
			readiness: {
				icons: workbenchReadinessIcons,
				actions: workbenchReadinessNavigationActions(platformNavigationHandlers),
				labels: workbenchReadinessLabels(t),
			},
			risk: {
				actions: workbenchRiskNavigationActions(platformNavigationHandlers),
				labels: workbenchRiskLabels(t),
			},
			quickAction: {
				icons: workbenchQuickActionIcons,
				actions: workbenchQuickNavigationActions(platformNavigationHandlers),
				labels: workbenchQuickActionLabels(t),
			},
		},
	});
	const {
		firstAgentGuidePrimaryStep,
		firstAgentGuideSteps,
		rolloutPathSteps,
	} = createPlatformOnboardingPageState({
		onboarding: {
			credentialCount: credentials.length,
			knowledgeBaseCount: knowledgeBases.length,
			readyAgentCount: readyPlatformAgents.length,
			activeAgentCount: activePlatformAgents.length,
			hasAgentRunResult: Boolean(agentRunResult),
			hasSelectedRunAgent: Boolean(selectedRunAgent),
			auditEventCount,
			pendingApprovalCount: pendingApprovals.length,
			hasPlatformConfigExport: Boolean(platformConfigExport),
		},
		onboardingOptions: {
			rolloutPath: {
				icons: rolloutPathIcons,
				actions: rolloutPathNavigationActions(platformNavigationHandlers),
				labels: rolloutPathStepLabels(t),
			},
			firstAgentGuide: {
				icons: firstAgentGuideIcons,
				actions: firstAgentGuideNavigationActions(platformNavigationHandlers),
				labels: firstAgentGuideStepLabels(t),
			},
		},
	});
	const {
		orchestrationPrimaryStep,
		orchestrationReadyCount,
		orchestrationWorkbenchSteps,
	} = createPlatformOrchestrationPageState({
		orchestration: {
			selectedTemplateName: selectedTemplate?.name,
			credentialCount: credentials.length,
			selectedKnowledgeBaseCount: publishForm.knowledge_base_ids.length,
			knowledgeBaseCount: knowledgeBases.length,
			selectedToolCount: publishForm.tools.length,
			availableToolCount: availableToolItems.length,
			allowedUserCount: publishForm.allowed_user_ids.length,
			allowedRoleCount: publishForm.allowed_roles.length,
			activeAgentCount: activePlatformAgents.length,
			hasSelectedTemplate: Boolean(selectedTemplate),
			auditEventCount,
			pendingApprovalCount: pendingApprovals.length,
			hasSelectedRunAgent: Boolean(selectedRunAgent),
			setupStates: {
				template: agentSetupSteps[0].state,
				model: agentSetupSteps[1].state,
				knowledge: agentSetupSteps[2].state,
				tools: agentSetupSteps[3].state,
				policy: agentSetupSteps[4].state,
			},
		},
		orchestrationOptions: {
			icons: orchestrationWorkbenchIcons,
			actions: orchestrationWorkbenchNavigationActions(platformNavigationHandlers, {
				handleNextAgentSetupStep,
				hasKnowledgeBases: knowledgeBases.length > 0,
				hasSelectedRunAgent: Boolean(selectedRunAgent),
			}),
			labels: orchestrationWorkbenchStepLabels(t),
		},
	});
	const {
		monitoringActivitySummary,
		monitoringLoading,
		monitoringStats,
	} = createPlatformMonitoringPageState({
		monitoring: {
			platformLoading,
			agentRunsLoading,
			workflowRunsLoading,
			auditLoading,
			approvalLoading,
			governanceLoading,
			agentConversations,
			auditSummary,
			auditEvents,
			workflowRunCount,
			completedWorkflowRunCount,
			partialWorkflowRunCount,
			failedWorkflowRunCount,
			auditEventCount,
			pendingApprovalCount: pendingApprovals.length,
		},
		monitoringOptions: {
			icons: monitoringStatIcons,
			labels: monitoringStatLabels(t),
		},
	});

	if (view === 'tenants') {
		return (
			<TenantsViewPage
				{...createPlatformTenantsViewProps({
					platformMemberTenantSummaries,
					platformMembersLoading,
					platformMembersLoaded: Boolean(platformMembers),
					platformMembersError,
					connectorsLoading,
					connectorsError,
					tenantWorkspaces,
					enterpriseIdentities,
					activeMemberCount,
					roleCount: platformMembers?.roles.length ?? 0,
					activePlatformAgentCount: activePlatformAgents.length,
					pendingApprovalCount: pendingApprovals.length,
					onRefreshMembers: () => void refetchMembers(),
					onRefreshConnectors: () => void refetchConnectors(),
					onNavigate: navigate,
					t,
				})}
			/>
		);
	}
	if (view === 'memory') {
		return (
			<MemoryViewPage
				{...createPlatformMemoryViewProps({
					memoryOperationsItems,
					memoryOperationsRunCount,
					memoryOperationsHitCount,
					memoryOperationsSavedCount,
					onNavigate: navigate,
					t,
				})}
			/>
		);
	}

	if (view === 'settings') {
		return (
			<SettingsViewPage
				{...createPlatformSettingsViewProps({
					platformLoading,
					platformError,
					platformConfigExport,
					platformConfigLoading,
					platformConfigError,
					platformConfigImportResult,
					platformConfigImportMode,
					platformConfigImportText,
					importingPlatformConfig,
					serverUrl,
					username,
					hasErrors,
					runtimeItems,
					onRefreshPlatform: () => void refetchPlatform(),
					onRefetchPlatformConfigExport: refetchPlatformConfigExport,
					onCopyPlatformConfig: handleCopyPlatformConfig,
					onImportPlatformConfig: handleImportPlatformConfig,
					onPlatformConfigImportModeChange: setPlatformConfigImportMode,
					onPlatformConfigImportTextChange: setPlatformConfigImportText,
					t,
				})}
			/>
		);
	}

	if (view === 'tools') {
		return (
			<ToolsViewPage
				{...createPlatformToolsViewProps({
					serverUrl,
					username,
					hasErrors,
					configManagementRef,
					toolRunnerRef,
					availableToolItems,
					publishedPlatformAgents,
					toolCatalogLoading,
					toolCatalogError,
					selectedToolName,
					selectedToolConfig,
					selectedToolCatalogItem,
					selectedToolInputValue,
					selectedToolInputKey,
					toolApprovalId,
					selectedToolDecision,
					selectedToolAllowed,
					selectedToolReason,
					creatingRunApproval,
					platformError,
					runningTool,
					toolRunError,
					toolRunResult,
					onRefetchToolCatalog: refetchToolCatalog,
					onSelectedToolNameChange: setSelectedToolName,
					onToolRunErrorChange: setToolRunError,
					onToolInputsChange: setToolInputs,
					onToolApprovalIdChange: setToolApprovalId,
					onCreateRunApproval: handleCreateRunApproval,
					onRunEnterpriseTool: handleRunEnterpriseTool,
					t,
				})}
			/>
		);
	}
	if (view === 'approvals') {
		return (
			<ApprovalsViewPage
				{...createPlatformApprovalsViewProps({
					serverUrl,
					username,
					hasErrors,
					approvalForm,
					onApprovalFormChange: setApprovalForm,
					approvalFilters,
					onApprovalFiltersChange: setApprovalFilters,
					approvalSummary,
					approvalRequests,
					approvalLoading,
					approvalError,
					creatingApproval,
					decidingApprovalId,
					continuingApprovalId,
					workflowOptions,
					availableToolItems,
					activePlatformAgents,
					selectedRunAgentId,
					selectedIdentityUserId,
					currentTenant: platformStatus?.current_user.tenant,
					currentUserId: platformStatus?.current_user.user_id,
					toolInputConfig: enterpriseToolInputConfig,
					onCreateApproval: handleCreateApproval,
					onRefetchApprovals: refetchApprovals,
					onApproveAndRun: handleApproveAndRun,
					onDecideApproval: handleDecideApproval,
					onUseApproval: handleUseApproval,
					summarizeAuditObject: platformSummarizeAuditObject,
					t,
				})}
			/>
		);
	}
	if (view === 'runs') {
		return (
			<RunsViewPage
				{...createPlatformRunsViewProps({
					monitoringHealthState: monitoringActivitySummary.healthState,
					monitoringLoading,
					monitoringStats,
					recentAgentTurns: monitoringActivitySummary.recentAgentTurns,
					recentWorkflowRuns,
					recentAuditEvents,
					auditFilters,
					auditLoading,
					auditError,
					auditEvents,
					auditStats,
					activePlatformAgents,
					availableToolItems,
					currentTenant: platformStatus?.current_user.tenant,
					currentUserId: platformStatus?.current_user.user_id,
					username,
					onRefreshMonitoring: async () => {
						await Promise.all([
							refetchPlatform(),
							refetchAgentRuns(),
							refetchWorkflowRuns(),
							refetchAuditEvents(),
							refetchApprovals(),
							refetchGovernance(),
						]);
					},
					onSelectAgentTurn: (turn) => {
						setSelectedRunAgentId(turn.agentId);
						setAgentRunResult(turn.response);
						navigate('/platform/agents');
					},
					onRunAgent: () => navigate('/platform/agents'),
					onRunWorkflow: () => navigate('/platform/workflows'),
					onOpenGovernance: () => navigate('/platform/approvals'),
					onAuditFiltersChange: setAuditFilters,
					onRefetchAuditEvents: refetchAuditEvents,
					summarizeAuditObject: platformSummarizeAuditObject,
					t,
				})}
			/>
		);
	}
	if (view === 'workflows') {
		return (
			<WorkflowsViewPage
				{...createPlatformWorkflowsViewProps({
					serverUrl,
					username,
					hasErrors,
					workflowRunnerRef,
					selectedWorkflowType,
					workflowOptions,
					selectedWorkflowTemplate,
					workflowInputs,
					workflowApprovalId,
					workflowRunError,
					workflowRunResult,
					runningWorkflow,
					workflowTemplatesLoading,
					workflowTemplatesError,
					workflowTemplates,
					selectedWorkflowDisabled,
					savingWorkflowType,
					creatingRunApproval,
					platformError: platformError ? String(platformError) : null,
					workflowRunsLoading,
					workflowRunsError,
					workflowRuns,
					onWorkflowTypeChange: (value) => {
						setSelectedWorkflowType(value);
						setWorkflowRunError(null);
						setWorkflowInputs(
							workflowInputsForSelectedOption(workflowOptions, value),
						);
					},
					onWorkflowInputChange: (key, value) =>
						setWorkflowInputs((current) =>
							workflowInputsWithValue(current, key, value),
						),
					onWorkflowApprovalIdChange: setWorkflowApprovalId,
					onRequestApproval: () => void handleCreateRunApproval('workflow_run'),
					onRunWorkflow: () => void handleRunEnterpriseWorkflow(),
					onToggleWorkflowTemplate: (template, checked) =>
						void handleToggleWorkflowTemplate(template, checked),
					summarizeAuditObject: platformSummarizeAuditObject,
					t,
				})}
			/>
		);
	}

	if (view === 'agents') {
		return (
			<AgentsViewPage
				{...createPlatformAgentsViewProps({
					t,
					platformAgentsError,
					platformAgentsLoading,
					platformAgents,
					agentManagementRef,
					agentTemplateStepRef,
					agentRunnerRef,
					agentOpsSummary,
					agentReleasePipeline,
					nextAgentSetupStep,
					selectedRunAgent,
					selectedRunAgentReadinessState,
					selectedRunAgentReadinessLabel,
					selectedRunAgentModelLabel,
					selectedRunAgentKnowledgeCount,
					selectedRunAgentKnowledgeLabels,
					selectedRunAgentToolCount,
					selectedRunAgentAccessAllowed,
					selectedRunAgentAccessLabel,
					agentTemplates,
					selectedTemplateId,
					publishingTemplateId,
					activePlatformAgents,
					selectedRunAgentId,
					agentQuestion,
					agentApprovalId,
					agentSampleQuestions,
					selectedAgentConversation,
					agentRunResult,
					agentRunsLoading,
					agentRunsError,
					runningAgent,
					agentRunError,
					agentToolCalls,
					agentToolCallBadgeText,
					agentRoutingLabel,
					agentRoutingText,
					agentRunConnectorSourceText,
					agentRunModelLabel,
					agentRunKnowledgeLabels,
					knowledgeBaseById,
					refetchPlatformAgents,
					scrollToAgentRunner,
					handleNextAgentSetupStep,
					handlePrimeAgentWorkflow,
					handleEditAgent,
					scrollToGovernance,
					handleConfigureTemplate,
					handleSelectRunAgent,
					setAgentQuestion,
					setAgentRunError,
					setAgentApprovalId,
					handleClearAgentConversation,
					handleSelectAgentRun,
					handleRunEnterpriseAgent,
					handleInspectAgentRunAudit,
				})}
			/>
		);
	}
	return (
		<DashboardViewPage
			{...createPlatformDashboardViewProps({
				...createPlatformDashboardTenantAccessViewProps({
					accessControlStats,
					accessTenantSummaries,
					activeMemberCount,
					identityAccessRows,
					platformMemberTenantSummaries,
					tenantOverviewItems,
					tenantWorkspaces,
				}),
				...createPlatformDashboardAgentRunnerViewProps({
					agentAccessAllowed: platformAgentAccessAllowedForDisplay,
					agentApprovalId,
					agentQuestion,
					agentRunConnectorSourceText,
					agentRunError,
					agentRunKnowledgeLabels,
					agentRunModelLabel,
					agentRunResult,
					agentRunnerRef,
					agentToolCallBadgeText,
					agentToolCalls,
					handleApproveAndRun,
					handleClearAgentConversation,
					handleInspectAgentRunAudit,
					handleRunEnterpriseAgent,
					handleSelectAgentRun,
					refetchAgentRuns,
					runningAgent,
					selectedAgentConversation,
					setAgentApprovalId,
					setAgentQuestion,
					setAgentRunError,
					setAgentRunResult,
				}),
				...createPlatformDashboardAgentRunnerPanelViewProps({
					activePlatformAgents,
					agentApprovalId,
					agentQuestion,
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
					agentSampleQuestions,
					agentToolCallBadgeText,
					agentToolCalls,
					handleClearAgentConversation,
					handleInspectAgentRunAudit,
					handleRunEnterpriseAgent,
					handleSelectAgentRun,
					handleSelectRunAgent,
					knowledgeBaseById,
					lastPublishedAgent,
					runningAgent,
					scrollToGovernance,
					selectedAgentConversation,
					selectedRunAgent,
					selectedRunAgentAccessAllowed,
					selectedRunAgentAccessLabel,
					selectedRunAgentId,
					selectedRunAgentKnowledgeLabels,
					selectedRunAgentModelLabel,
					selectedRunAgentToolCount,
					setAgentApprovalId,
					setAgentQuestion,
					setAgentRunError,
					t,
				}),
				...createPlatformDashboardApprovalsViewProps({
					approvalError,
					approvalFilters,
					approvalForm,
					approvalLoading,
					approvalRequests,
					approvalSummary,
					approvedApprovalCount,
					continuingApprovalId,
					creatingApproval,
					creatingRunApproval,
					decidingApprovalId,
					handleCreateApproval,
					handleCreateRunApproval,
					handleDecideApproval,
					handleInspectIdentityApprovals,
					handleInspectTenantApprovals,
					handlePrimeToolApproval,
					handleUseApproval,
					pendingApprovals,
					refetchApprovals,
					selectedIdentityUserId,
					selectedIdentityPendingApprovals,
					setApprovalFilters,
					setApprovalForm,
					setToolApprovalId,
					setWorkflowApprovalId,
					toolApprovalId,
					username,
					workflowApprovalId,
					workflowPendingApprovals,
				}),
				...createPlatformDashboardAccessControlViewProps({
					accessControlStats,
					accessTenantSummaries,
					creatingRunApproval,
					enterpriseIdentities,
					governance,
					governanceError,
					governanceLoading,
					handleCreateRunApproval,
					handleInspectIdentityApprovals,
					handleInspectIdentityAudit,
					handleInspectIdentityFailures,
					handleUseApproval,
					handleUseIdentity,
					identityAccessRows,
					refetchGovernance,
					selectedIdentity,
					selectedIdentityAllowedTools,
					selectedIdentityDeniedTools,
					selectedIdentityFailedAuditEvents,
					selectedIdentityPendingApprovals,
					selectedIdentityRecentAuditEvents,
					setSelectedIdentityUserId,
					toolPolicyMode,
				}),
				...createPlatformDashboardConnectorsViewProps({
					activeConnectorTenant,
					activeSavedConnectorConfig,
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
					handleSaveConnectorConfig,
					handleTestAndSaveConnectorConfig,
					handleTestConnector,
					loadSavedConnectorConfig,
					refetchConnectors,
					savedConnectorConfigs,
					savingConnectorConfig,
					scrollToConnectorCenter,
					setConnectorTestForm,
					testingConnector,
				}),
				...createPlatformDashboardToolsViewProps({
					availableToolItems,
					configManagementRef,
					enterpriseToolInputConfig,
					handleRunEnterpriseTool,
					handleSaveToolPolicy,
					refetchToolCatalog,
					riskToolItems,
					runningTool,
					scrollToToolRunner,
					selectedToolAllowed,
					selectedToolCatalogItem,
					selectedToolConfig,
					selectedToolDecision,
					selectedToolInputKey,
					selectedToolInputValue,
					selectedToolName,
					selectedToolReason,
					setSelectedToolName,
					setToolInputs,
					setToolPolicyDraft,
					setToolPolicySaveError,
					setToolPolicySaveSuccess,
					setToolRunError,
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
				}),
				...createPlatformDashboardWorkflowsViewProps({
					completedWorkflowRunCount,
					failedWorkflowRunCount,
					governedWorkflowItems,
					handleRunEnterpriseWorkflow,
					handleToggleWorkflowTemplate,
					partialWorkflowRunCount,
					recentWorkflowRuns,
					refetchWorkflowRuns,
					runningWorkflow,
					savingWorkflowType,
					scrollToWorkflowRunner,
					selectedWorkflowDisabled,
					selectedWorkflowLastRun,
					selectedWorkflowName,
					selectedWorkflowSteps,
					selectedWorkflowTemplate,
					selectedWorkflowType,
					setSelectedWorkflowType,
					setWorkflowInputs,
					setWorkflowRunError,
					workflowInputs,
					workflowOpsStats,
					workflowOptions,
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
				}),
				...createPlatformDashboardMemoryOperationsViewProps({
					handleInspectMemoryOperationAudit,
					handleOpenMemoryOperation,
					memoryOperationsHitCount,
					memoryOperationsItems,
					memoryOperationsRef,
					memoryOperationsRunCount,
					memoryOperationsSavedCount,
				}),
				...createPlatformDashboardMonitoringSnapshotViewProps({
					monitoringHealthState: monitoringActivitySummary.healthState,
					monitoringLoading,
					monitoringStats,
					recentAgentTurns: monitoringActivitySummary.recentAgentTurns,
				}),
				...createPlatformDashboardOpsTasksViewProps({
					handleResolveOpsTask,
					opsTasks,
					opsTasksError,
					opsTasksLoading,
					opsTasksSummary,
					refetchOpsTasks,
					resolvingOpsTaskCode,
					summarizeAuditObject: platformSummarizeAuditObject,
				}),
				...createPlatformDashboardOperationsViewProps({
					blockedOrPartialPlatformAgents,
					operationsAgentIssueText,
					operationsHeadline,
					readyPlatformAgents,
					scrollToAgentManagement,
					setSelectedRunAgentId,
					topOperationsAgents,
				}),
				...createPlatformDashboardPlatformConsoleViewProps({
					platformConsoleItems,
				}),
				...createPlatformDashboardTriggerOpsViewProps({
					agents,
					recentSchedules,
					schedulesError,
					schedulesLoading,
					triggerOpsStats,
					triggerOpsSummary,
				}),
				...createPlatformDashboardOpsPanelViewProps({
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
				}),
				...createPlatformDashboardAuditEventsViewProps({
					activePlatformAgents,
					auditError,
					auditEvents,
					auditFilters,
					auditLoading,
					auditStats,
					availableToolItems,
					platformStatus,
					refetchAuditEvents,
					setAuditFilters,
					summarizeAuditObject: platformSummarizeAuditObject,
					t,
					username,
				}),
				...createPlatformDashboardWorkbenchReadinessViewProps({
					workbenchQuickActions,
					workbenchReadinessItems,
					workbenchRiskItems,
				}),
				...createPlatformDashboardWorkbenchStatusViewProps({
					dashboardTodoItems,
					workbenchActions,
					workbenchIndicators,
				}),
				...createPlatformDashboardFirstAgentGuideViewProps({
					firstAgentGuidePrimaryStep,
					firstAgentGuideSteps,
				}),
				...createPlatformDashboardRolloutPathViewProps({
					rolloutPathSteps,
				}),
				...createPlatformDashboardLaunchpadViewProps({
					launchpadPrimaryStep,
					launchpadReadyCount,
					launchpadState,
					launchpadSteps,
					launchpadTotalCount,
				}),
				...createPlatformDashboardOrchestrationWorkbenchViewProps({
					orchestrationPrimaryStep,
					orchestrationReadyCount,
					orchestrationWorkbenchSteps,
				}),
				...createPlatformDashboardScenariosViewProps({
					handleRunScenario,
					refetchScenarios,
					scenarios,
					scenariosError,
					scenariosLoading,
				}),
				...createPlatformDashboardAppCenterViewProps({
					agentResourceText,
					appCenterAgents,
					appCenterDetailIssues,
					appCenterDetailResources,
					appCenterDetailStatus,
					appCenterPrimaryDisabled,
					handleAppCenterDetailPrimaryAction,
					handleAppCenterDetailSecondaryAction,
					handleAppCenterPrimaryAction,
					inspectedAppCenterAgent,
					inspectedAppCenterTemplate,
					readyPlatformAgents,
					scrollToAgentManagement,
					setSelectedAppCenterItem,
					setSelectedRunAgentId,
				}),
				...createPlatformDashboardCapabilitiesViewProps({
					capabilities,
				}),
				...createPlatformDashboardConfigManagementViewProps({
					handleCopyPlatformConfig,
					handleImportPlatformConfig,
					importingPlatformConfig,
					platformConfigError,
					platformConfigExport,
					platformConfigImportMode,
					platformConfigImportResult,
					platformConfigImportText,
					platformConfigLoading,
					refetchPlatformConfigExport,
					setPlatformConfigImportMode,
					setPlatformConfigImportText,
				}),
				...createPlatformDashboardAgentQuickStartViewProps({
					agentsLoading,
					featuredAgents,
				}),
				...createPlatformDashboardAgentRunNowViewProps({
					currentIdentityLabel,
					defaultAgentTemplate,
					handlePrimeAgentRunner,
					handleQuickPublishAgent,
					handleStartPublishing,
					platformAgents,
					platformAgentsLoading,
					platformStatus,
					primaryAgentSampleQuestion,
					publishingTemplateId,
					scrollToAgentRunner,
					selectedRunAgent,
					selectedRunAgentKnowledgeCount,
					selectedRunAgentModelLabel,
					selectedRunAgentToolCount,
					t,
				}),
				...createPlatformDashboardMembersViewProps({
					activeMemberCount,
					activePlatformAgents,
					handleEditMember,
					handleSaveMember,
					handleToggleMemberStatus,
					memberForm,
					membersRef,
					pendingApprovals,
					platformMemberTenantSummaries,
					platformMembers,
					platformMembersError,
					platformMembersLoading,
					refetchMembers,
					savingMember,
					setMemberForm,
					updatingMemberId,
				}),
				...createPlatformDashboardAgentManagementViewProps({
					activePlatformAgents,
					agentAccessAllowed: platformAgentAccessAllowedForDisplay,
					agentKnowledgeStepRef,
					agentManagementRef,
					agentModelStepRef,
					agentOpsSummary,
					agentReleasePipeline,
					agentRuntimeStepRef,
					agentSetupSteps,
					agentTemplateStepRef,
					agentTemplates,
					agentToolsStepRef,
					archivingAgentId,
					bindingAgentKnowledgeId,
					bindingAgentModelId,
					bindingAgentToolsId,
					credentialById,
					credentials,
					credentialsLoading,
					editingAgentId,
					enablingAgentMemoryId,
					enablingAgentWorkflowId,
					handleArchiveAgent,
					handleBindAvailableKnowledge,
					handleBindDefaultModel,
					handleBindTemplateTools,
					handleCancelEdit,
					handleConfigureTemplate,
					handleEditAgent,
					handleEnableAgentMemory,
					handleEnableAgentWorkflow,
					handleNextAgentSetupStep,
					handlePrimeAgentWorkflow,
					handlePrimePublishedAgent,
					handlePrimeToolApproval,
					handlePublishAgent,
					handlePublishTenantChange,
					handleTogglePublishList,
					knowledgeBaseById,
					knowledgeBases,
					nextAgentSetupStep,
					platformAgents,
					platformAgentsError,
					platformAgentsLoading,
					platformStatus,
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
					refetchPlatformAgents,
					scrollToAgentRunner,
					scrollToGovernance,
					selectedIdentity,
					selectedRunAgent,
					selectedRunAgentId,
					selectedRunAgentKnowledgeCount,
					selectedRunAgentModelLabel,
					selectedRunAgentReadinessLabel,
					selectedRunAgentReadinessState,
					selectedRunAgentToolCount,
					selectedTemplate,
					selectedTemplateId,
					setPublishForm,
				}),
				...createPlatformDashboardRuntimeStatusViewProps({
					governanceRef,
					platformError,
					platformLoading,
					platformStatus,
					refetchPlatform,
					runtimeItems,
				}),
				...createPlatformDashboardGovernanceHealthViewProps({
					governanceError,
					governanceHealthItems,
					governanceLoading,
					refetchGovernance,
					scrollToGovernance,
				}),
				...createPlatformDashboardTenantWorkspaceViewProps({
					enterpriseIdentities,
					handleInspectIdentityAudit,
					handleInspectTenantApprovals,
					handleInspectTenantAudit,
					handlePrepareTenantAgent,
					handleUseIdentity,
					handleUseTenant,
					scrollToConnectorCenter,
					scrollToGovernance,
					selectedIdentity,
					selectedIdentityAllowedTools,
					selectedIdentityDeniedTools,
					selectedIdentityWorkspace,
					tenantOverviewItems,
				}),
				...createPlatformDashboardTenantGovernanceViewProps({
					availableToolItems,
					connectors,
					connectorsLoading,
					currentIdentityLabel,
					enterpriseIdentities,
					handleInspectIdentityAudit,
					handleSaveToolPolicy,
					handleUseIdentity,
					savingToolPolicy,
					scrollToAgentRunner,
					selectedIdentity,
					selectedIdentityAllowedTools,
					selectedIdentityDeniedTools,
					selectedIdentityPendingToolNames,
					selectedIdentityWorkspace,
					setAgentQuestion,
					setSelectedIdentityUserId,
					setToolPolicyDraft,
					setToolPolicySaveError,
					setToolPolicySaveSuccess,
					t,
					toolPolicyDraft,
					toolPolicyMode,
					toolPolicySaveError,
					toolPolicySaveSuccess,
					toolPolicySummary,
				}),
				...createPlatformDashboardPolicySubagentsViewProps({
					platformError,
					platformLoading,
					platformStatus,
					policyDecisions,
					subagentTemplates,
					t,
					toolPolicyMode,
				}),
				...createPlatformDashboardOverviewViewProps({
					handleNextStepPrimaryAction,
					handleStartPublishing,
					hasErrors,
					nextStepMode,
					nextStepPrimaryDisabled,
					publishingTemplateId,
					serverUrl,
					stats,
					t,
					username,
				}),
				setSelectedIdentityUserId: setSelectedIdentityUserId,
				t: t,
				username: username,
			})}
		/>
	);
}
