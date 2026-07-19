import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
	platformApi,
	type EnterpriseIdentity,
	type EnterpriseAgentTemplate,
	type EnterpriseAgentRunResponse,
	type EnterpriseApprovalRequestItem,
	type EnterpriseApprovalRequestType,
	type EnterpriseAuditEvent,
	type EnterpriseAuditQueryResponse,
	type EnterpriseConnectorSavedConfig,
	type EnterpriseConnectorTestResponse,
	type EnterprisePublishedAgent,
	type EnterprisePlatformAgentsResponse,
	type EnterprisePlatformConfigExportResponse,
	type EnterprisePlatformConnectorsResponse,
	type EnterprisePlatformGovernanceResponse,
	type EnterprisePlatformMember,
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
import type { MemoryOperationsItem } from './components/MemoryOperationsPanel';
import { MemoryViewPage } from './components/MemoryViewPage';
import { RunsViewPage } from './components/RunsViewPage';
import type { ToolPolicyDraftValue } from './components/TenantGovernancePanel';
import { SettingsViewPage } from './components/SettingsViewPage';
import { TenantsViewPage } from './components/TenantsViewPage';
import { ToolsViewPage } from './components/ToolsViewPage';
import { WorkflowsViewPage } from './components/WorkflowsViewPage';
import { DashboardViewPage } from './components/DashboardViewPage';
import { usePlatformPageRefs } from './platform-page-refs';
import {
	agentRunResultForSelectedAgent,
	agentRunResultAfterHistoryRefresh,
	agentConversationTurnFromRunHistoryItem,
	runEnterpriseAgentRequestAction,
	replaceAgentConversationTurns,
	runAgentRunnerPrimeTargetAction,
	runAgentRunHistoryDetailAction,
	runAgentRunHistorySelectionRequestAction,
	runClearAgentConversationRequestAction,
	runEnterpriseToolRequestAction,
	runEnterpriseWorkflowRequestAction,
	runOpenMemoryOperationAgentAction,
	runPrimeAgentWorkflowAction,
	runPrimePublishedAgentAction,
	runScenarioWorkflowRequestAction,
	runSelectAgentForRunAction,
	runUseIdentityAgentRunnerAction,
	runUseTenantAgentRunnerAction,
	platformAgentAccessAllowedForDisplay,
	selectedRunAgentIdForAvailableAgents,
	workflowInputsForSelectedOption,
	workflowSelectionForAvailableTemplates,
	workflowInputsWithValue,
	type AgentConversationMap,
} from './platform-agent-runner';
import {
	approvalQueryFromFilters,
	runApprovalApproveAndContinueAction,
	runApprovalCreateAction,
	runApprovalDecisionAction,
	runApprovalRunCreateAction,
	runApprovalUsageTargetAction,
	runPrimeToolApprovalAction,
	type PlatformApprovalRunType,
} from './platform-approval-helpers';
import {
	connectorFormWithPlatformDefaults,
	runConnectorSavedConfigLoadAction,
	runConnectorSaveAction,
	runConnectorTestAndSaveAction,
	runConnectorTestAction,
} from './platform-connector-helpers';
import {
	platformConfigImportErrorMessage,
	platformConfigImportTextForExport,
	platformConfigLoadErrorMessage,
	runPlatformConfigCopyAction,
	runPlatformConfigImportAction,
} from './platform-config-management';
import {
	toolPolicyDraftFromDecisions,
	runToolPolicySaveAction,
} from './platform-tool-policy-helpers';
import {
	runMemberEditAction,
	runMemberSaveAction,
	runMemberStatusToggleRequestAction,
} from './platform-member-helpers';
import {
	runOpsTaskResolveAction,
} from './platform-ops-task-helpers';
import { runWorkflowTemplateToggleAction } from './platform-workflow-template-helpers';
import {
	approvalFiltersForIdentity,
	approvalFiltersForTenant,
	auditFiltersForIdentity,
	auditFiltersForMemoryOperation,
	auditFiltersForTenant,
	auditQueryFromFilters,
	failedAuditFiltersForIdentity,
	runApprovalFilterTargetAction,
	runAuditFilterTargetAction,
	runInspectAgentRunEvidenceAuditAction,
} from './platform-filter-builders';
import {
	capabilityNavigationActions,
	firstAgentGuideNavigationActions,
	launchpadNavigationActions,
	orchestrationWorkbenchNavigationActions,
	platformConsoleNavigationActions,
	rolloutPathNavigationActions,
	runAgentSetupStepRequestAction,
	runAppCenterDetailPrimaryRequestAction,
	runAppCenterDetailSecondaryRequestAction,
	runAppCenterPrimaryRequestAction,
	runNextStepPrimaryRequestAction,
	workbenchIndicatorNavigationActions,
	workbenchPrimaryNavigationActions,
	workbenchQuickNavigationActions,
	workbenchReadinessNavigationActions,
	workbenchRiskNavigationActions,
} from './platform-navigation-actions';
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
	agentManagementRequestLabels,
	agentRoutingLabels,
	agentRunnerLabels,
	agentRunnerRequestLabels,
	agentSetupStepLabels,
	approvalRequestLabels,
	appCenterAgentDisplayLabels,
	appCenterDetailHealthLabels,
	appCenterDetailResourcesLabels,
	appCenterDetailResourceValueLabels,
	appCenterOperationsLabels,
	auditRequestLabels,
	auditStatsLabels,
	configManagementRequestLabels,
	connectorOperationsLabels,
	connectorRequestLabels,
	dashboardTodoLabels,
	firstAgentGuideStepLabels,
	governanceAccessLabels,
	governanceHealthLabels,
	memberRequestLabels,
	monitoringStatLabels,
	opsTasksRequestLabels,
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
	scenarioRequestLabels,
	selectedIdentityLabels,
	selectedToolRunnerLabels,
	tenantGovernanceRequestLabels,
	tenantWorkspaceOperationsLabels,
	toolCatalogRequestLabels,
	toolRunnerRequestLabels,
	triggerOperationsStatLabels,
	triggerOperationsSummaryLabels,
	workbenchIndicatorLabels,
	workbenchPrimaryActionLabels,
	workbenchQuickActionLabels,
	workbenchReadinessLabels,
	workbenchRiskLabels,
	workflowOperationsLabels,
	workflowRunnerRequestLabels,
	workflowSelectionLabels,
} from './platform-labels';
import { platformDashboardDisplayStateForStatus } from './platform-dashboard-display';
import {
	platformCapabilityItemsDisplayStateForStatus,
	platformLaunchpadDisplayStateForStatus,
} from './platform-launchpad-display';
import { platformMonitoringDisplayStateForStatus } from './platform-monitoring-display';
import { platformOnboardingDisplayStateForStatus } from './platform-onboarding-display';
import { platformOrchestrationDisplayStateForStatus } from './platform-orchestration-display';
import {
	platformWorkbenchConsoleItemsDisplayState,
	platformWorkbenchDisplayStateForStatus,
} from './platform-workbench-display';
import { platformWorkflowDisplayStateForStatus } from './platform-workflow-display';
import { runPlatformOperationAction } from './platform-operation-actions';
import {
	agentQuickConfigurationSyncResult,
	runAgentCapabilityEnableRequestAction,
	runAgentDefaultModelBindRequestAction,
	runAgentKnowledgeBasesBindRequestAction,
	runAgentTemplateToolsBindRequestAction,
	type AgentQuickConfigurationPatch,
} from './platform-agent-quick-config';
import {
	agentEditDraft,
	defaultPublishFormForTemplate,
	publishFormWithPatch,
	runAgentArchiveRequestAction,
	runAgentEditCancelAction,
	runAgentEditDraftAction,
	runAgentPublishRequestAction,
	runPrepareTenantAgentAction,
	runPublishListToggleAction,
	runPublishTenantChangeAction,
	runQuickPublishRequestAction,
	runStartPublishingAction,
	runTemplateConfigureAction,
	type PublishListFormKey,
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
import { platformAgentInventoryDisplayStateForStatus } from './platform-agent-inventory-display';
import {
	platformAgentRoutingDisplayStateForResult,
	platformAgentRunnerDisplayStateForStatus,
	platformAgentSetupStepsDisplayStateForStatus,
	platformNextAgentSetupStepDisplayStateForSteps,
} from './platform-agent-runner-display';
import { platformAppCenterDisplayStateForStatus } from './platform-app-center-display';
import { platformConnectorDisplayStateForStatus } from './platform-connector-display';
import { platformConnectionDisplayStateForStatus } from './platform-connection-display';
import {
	platformAuditStatsDisplayStateForSummary,
	platformGovernanceDisplayStateForStatus,
	platformSelectedIdentityDisplayStateForStatus,
	platformSummarizeAuditObject,
} from './platform-governance-display';
import {
	platformAgentIsReadyForDisplay,
	platformAgentReleasePipelineDisplayStateForStatus,
	platformPublishDisplayStateForStatus,
} from './platform-publish-display';
import { platformResourceDisplayStateForStatus } from './platform-resource-display';
import { platformRuntimeDisplayStateForStatus } from './platform-runtime-display';
import { platformToolRunnerDisplayStateForStatus } from './platform-tool-runner-display';
import { platformOverviewDisplayStateForStatus } from './platform-overview-display';
import type { EnterpriseAgentConversationTurn } from './platform-utils';
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

	const platformConnectionDisplay = platformConnectionDisplayStateForStatus({
		currentUserId: platformStatus?.current_user.user_id,
		storedServerUrl: localStorage.getItem('server_url'),
		storedUsername: localStorage.getItem('username'),
		labels: platformConnectionLabels(t),
	});
	const platformConnectionState = platformConnectionDisplay.connectionState;
	const serverUrl = platformConnectionState.serverUrl;
	const username = platformConnectionState.username;
	const auditRequestText = auditRequestLabels(t);
	const configManagementRequestText = configManagementRequestLabels(t);
	const connectorRequestText = connectorRequestLabels(t);
	const agentRunnerRequestText = agentRunnerRequestLabels(t);
	const agentManagementRequestText = agentManagementRequestLabels(t);
	const approvalRequestText = approvalRequestLabels(t);
	const memberRequestText = memberRequestLabels(t);
	const tenantGovernanceRequestText = tenantGovernanceRequestLabels(t);
	const toolCatalogRequestText = toolCatalogRequestLabels(t);
	const scenarioRequestText = scenarioRequestLabels(t);
	const opsTasksRequestText = opsTasksRequestLabels(t);
	const toolRunnerRequestText = toolRunnerRequestLabels(t);
	const workflowRunnerRequestText = workflowRunnerRequestLabels(t);
	const hasErrors = Boolean(
		agentsError ||
		credentialsError ||
		knowledgeError ||
		schedulesError ||
		platformError ||
		connectorsError ||
		governanceError ||
		platformMembersError ||
		platformAgentsError ||
		toolCatalogError ||
		auditError ||
		workflowTemplatesError ||
		workflowRunsError ||
		scenariosError ||
		opsTasksError ||
		approvalError ||
		platformConfigError ||
		agentRunsError,
	);

	const agentTemplates = platformAgents?.templates ?? [];
	const publishedPlatformAgents = platformAgents?.agents ?? [];
	const platformAgentInventoryDisplay = platformAgentInventoryDisplayStateForStatus({
		agents,
		agentTemplates,
		publishedPlatformAgents,
		selectedRunAgentId,
		lastPublishedAgentId,
		selectedTemplateId,
	});
	const platformAgentInventoryState = platformAgentInventoryDisplay.inventoryState;
	const featuredAgents = platformAgentInventoryState.featuredAgents;
	const activePlatformAgents = platformAgentInventoryState.activePlatformAgents;
	const archivedPlatformAgents = platformAgentInventoryState.archivedPlatformAgents;
	const readyPlatformAgents = platformAgentInventoryState.readyPlatformAgents;
	const selectedRunAgent = platformAgentInventoryState.selectedRunAgent;
	const lastPublishedAgent = platformAgentInventoryState.lastPublishedAgent;
	const selectedAgentConversation = agentConversations[selectedRunAgentId] ?? [];
	const selectedTemplate = platformAgentInventoryState.selectedTemplate;
	const defaultAgentTemplate = platformAgentInventoryState.defaultAgentTemplate;
	const platformResourceDisplay = platformResourceDisplayStateForStatus({
		credentials,
		knowledgeBases,
	});
	const platformResourceLookupState = platformResourceDisplay.lookupState;
	const credentialById = platformResourceLookupState.credentialById;
	const knowledgeBaseById = platformResourceLookupState.knowledgeBaseById;
	const agentSetupSteps = platformAgentSetupStepsDisplayStateForStatus(
		{
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
		agentSetupStepLabels(t),
	);
	const nextAgentSetupStep = platformNextAgentSetupStepDisplayStateForSteps(agentSetupSteps);
	const primaryAgentSampleQuestion = agentSampleQuestions[0];
	const {
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
	} = platformAgentRunnerDisplayStateForStatus(
		{
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
		agentRunnerLabels(t),
	).runnerState;
	const platformRuntimeDisplay = platformRuntimeDisplayStateForStatus({
		platformStatus,
		governance,
		connectors,
		labels: platformRuntimeConfigLabels(t),
	});
	const platformRuntimeConfigState = platformRuntimeDisplay.configState;
	const enterpriseIdentities = platformRuntimeConfigState.enterpriseIdentities;
	const publishDisplay = platformPublishDisplayStateForStatus({
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
		publishTenant,
		publishAccessMembers,
		publishRoleOptions,
	} = publishDisplay.accessState;
	const {
		publishSelectedModelLabel,
		publishAccessScopeSummary,
		publishRuntimeSummary,
		publishReleaseIssues,
		publishBlocked,
	} = publishDisplay.draftState;
	const selectedIdentityState = platformSelectedIdentityDisplayStateForStatus({
		enterpriseIdentities,
		selectedIdentityUserId,
		selectedRunAgent,
		governanceWorkspaces: governance?.tenant_workspaces,
		connectorWorkspaces: connectors?.tenant_workspaces,
		username,
		...selectedIdentityLabels(t),
	});
	const selectedIdentity = selectedIdentityState.selectedIdentity;
	const selectedRunAgentAccessAllowed = selectedIdentityState.selectedRunAgentAccessAllowed;
	const selectedRunAgentAccessLabel = selectedIdentityState.selectedRunAgentAccessLabel;
	const selectedIdentityAllowedTools = selectedIdentityState.selectedIdentityAllowedTools;
	const selectedIdentityDeniedTools = selectedIdentityState.selectedIdentityDeniedTools;
	const selectedIdentityWorkspace = selectedIdentityState.selectedIdentityWorkspace;
	const currentIdentityLabel = selectedIdentityState.currentIdentityLabel;

	const overviewDisplay = platformOverviewDisplayStateForStatus({
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
	const stats = overviewDisplay.stats;
	const runtimeItems = overviewDisplay.runtimeItems;

	const subagentTemplates = platformRuntimeConfigState.subagentTemplates;
	const toolPolicyMode = platformRuntimeConfigState.toolPolicyMode;
	const toolRunnerDisplay = platformToolRunnerDisplayStateForStatus({
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
	const {
		policyDecisions,
		availableToolItems,
	} = toolRunnerDisplay.catalogState;
	const selectedToolRunnerState = toolRunnerDisplay.selectedToolRunnerState;
	const selectedToolCatalogItem = selectedToolRunnerState.selectedToolCatalogItem;
	const selectedToolConfig = selectedToolRunnerState.selectedToolConfig;
	const selectedToolDecision = selectedToolRunnerState.selectedToolDecision;
	const selectedToolInputKey = selectedToolRunnerState.selectedToolInputKey;
	const selectedToolInputValue = selectedToolRunnerState.selectedToolInputValue;
	const selectedToolAllowed = selectedToolRunnerState.selectedToolAllowed;
	const selectedToolReason = selectedToolRunnerState.selectedToolReason;
	const { agentRoutingLabel, agentRoutingText } = platformAgentRoutingDisplayStateForResult(
		agentRunResult,
		agentRoutingLabels(t),
	);
	const connectorDisplay = platformConnectorDisplayStateForStatus({
		connectors,
		form: connectorTestForm,
		testResult: connectorTestResult,
		labels: connectorOperationsLabels(t),
	});
	const connectorOperationsState = connectorDisplay.operationsState;
	const connectorState = connectorOperationsState.connectorState;
	const savedConnectorConfigs = connectorOperationsState.savedConnectorConfigs;
	const activeConnectorTenant = connectorOperationsState.activeConnectorTenant;
	const activeSavedConnectorConfig = connectorOperationsState.activeSavedConnectorConfig;
	const connectorDraftIssues = connectorOperationsState.connectorDraftIssues;
	const connectorDraftState = connectorOperationsState.connectorDraftState;
	const connectorTestPassed = connectorOperationsState.connectorTestPassed;
	const connectorRuntimeState = connectorOperationsState.connectorRuntimeState;
	const connectorRuntimeSourceText = connectorOperationsState.connectorRuntimeSourceText;
	const dashboardDisplay = platformDashboardDisplayStateForStatus({
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
	const dashboardSourceState = dashboardDisplay.sourceState;
	const dashboardOperations = dashboardSourceState.dashboardOperations;
	const {
		pendingApprovals,
		approvedApprovalCount,
		approvalSummary,
		recentWorkflowRuns,
		workflowRunCount,
		recentAuditEvents,
		auditEventCount,
	} = dashboardDisplay.fallbackState;
	const tenantWorkspaceOperationsState = dashboardDisplay.tenantWorkspaceState;
	const tenantWorkspaces = tenantWorkspaceOperationsState.tenantWorkspaces;
	const tenantOverviewItems = tenantWorkspaceOperationsState.tenantOverviewItems;
	const platformMemberTenantSummaries =
		tenantWorkspaceOperationsState.platformMemberTenantSummaries;
	const memoryOperationsState = dashboardDisplay.memoryOperationsState;
	const memoryOperationsItems = memoryOperationsState.items;
	const memoryOperationsRunCount = memoryOperationsState.runCount;
	const memoryOperationsHitCount = memoryOperationsState.hitCount;
	const memoryOperationsSavedCount = memoryOperationsState.savedCount;
	const dashboardOperationsState = dashboardDisplay.operationsState;
	const riskToolItems = dashboardOperationsState.riskToolItems;
	const completedWorkflowRunCount = dashboardOperationsState.completedWorkflowRunCount;
	const partialWorkflowRunCount = dashboardOperationsState.partialWorkflowRunCount;
	const failedWorkflowRunCount = dashboardOperationsState.failedWorkflowRunCount;
	const governedWorkflowItems = dashboardOperationsState.governedWorkflowItems;
	const recommendedOperationActions = dashboardOperationsState.recommendedOperationActions;
	const dashboardTodoItems = dashboardDisplay.todoItems;
	const appCenterDisplay = platformAppCenterDisplayStateForStatus({
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
	const appCenterOperationsState = appCenterDisplay.operationsState;
	const blockedOrPartialPlatformAgents = appCenterOperationsState.blockedOrPartialAgents;
	const appCenterAgents = appCenterOperationsState.appCenterAgents;
	const inspectedAppCenterAgent = appCenterOperationsState.inspectedAgent;
	const inspectedAppCenterTemplate = appCenterOperationsState.inspectedTemplate;
	const appCenterPrimaryDisabled = appCenterOperationsState.primaryDisabled;
	const agentOpsSummary = appCenterOperationsState.agentOpsSummary;
	const topOperationsAgents = appCenterOperationsState.topOperationsAgents;
	const { operationsAgentIssueText, agentResourceText } =
		appCenterDisplay.agentDisplayState;
	const appCenterDetailState = appCenterDisplay.detailState;
	const appCenterDetailResources = appCenterDetailState.detailResources;
	const appCenterDetailIssues = appCenterDetailState.detailIssues;
	const appCenterDetailStatus = appCenterDetailState.detailStatus;
	const operationsHeadline = appCenterDetailState.operationsHeadline;
	const agentReleasePipeline = platformAgentReleasePipelineDisplayStateForStatus(
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
	const governanceDisplay = platformGovernanceDisplayStateForStatus({
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
	const selectedIdentityGovernanceDisplayState = governanceDisplay.selectedIdentityState;
	const selectedIdentityPendingApprovals =
		selectedIdentityGovernanceDisplayState.selectedIdentityPendingApprovals;
	const selectedIdentityPendingToolNames =
		selectedIdentityGovernanceDisplayState.selectedIdentityPendingToolNames;
	const governanceOperationsState = governanceDisplay.operationsState;
	const identityAccessRows = governanceOperationsState.identityAccessRows;
	const accessTenantSummaries = governanceOperationsState.accessTenantSummaries;
	const accessControlStats = governanceOperationsState.accessControlStats;
	const governanceHealthItems = governanceOperationsState.governanceHealthItems;
	const toolPolicySummary =
		selectedIdentityGovernanceDisplayState.toolPolicySummary;
	const selectedIdentityFailedAuditEvents =
		selectedIdentityGovernanceDisplayState.selectedIdentityFailedAuditEvents;
	const selectedIdentityRecentAuditEvents =
		selectedIdentityGovernanceDisplayState.selectedIdentityRecentAuditEvents;
	const workflowDisplay = platformWorkflowDisplayStateForStatus({
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
	const workflowSelectionState = workflowDisplay.selectionState;
	const selectedWorkflowTemplate = workflowSelectionState.selectedWorkflowTemplate;
	const workflowOptions = workflowSelectionState.workflowOptions;
	const selectedWorkflowDisabled = workflowSelectionState.selectedWorkflowDisabled;
	const workflowOperationsState = workflowDisplay.operationsState;
	const workflowPendingApprovals = workflowOperationsState.workflowPendingApprovals;
	const selectedWorkflowName = workflowOperationsState.selectedWorkflowName;
	const selectedWorkflowSteps = workflowOperationsState.selectedWorkflowSteps;
	const selectedWorkflowLastRun = workflowOperationsState.selectedWorkflowLastRun;
	const workflowOpsStats = workflowOperationsState.workflowOpsStats;
	const triggerOperationsState = workflowDisplay.triggerState;
	const recentSchedules = triggerOperationsState.recentSchedules;
	const triggerOpsStats = triggerOperationsState.triggerOpsStats;
	const triggerOpsSummary = triggerOperationsState.triggerOpsSummary;
	const auditStats = platformAuditStatsDisplayStateForSummary(
		{
			auditSummary,
			auditEvents,
		},
		auditStatsLabels(t),
	);
	useEffect(() => {
		void refetchConnectors();
		void refetchGovernance();
		void refetchMembers();
		void refetchPlatformAgents();
		void refetchAuditEvents();
		void refetchWorkflowTemplates();
		void refetchWorkflowRuns();
		void refetchScenarios();
		void refetchOpsTasks();
		void refetchApprovals();
		void refetchPlatformConfigExport();
	}, []);

	useEffect(() => {
		void refetchToolCatalog();
	}, [selectedRunAgentId, selectedIdentityUserId]);

	useEffect(() => {
		setToolPolicyDraft(
			toolPolicyDraftFromDecisions({
				tools: availableToolItems,
				allowedTools: selectedIdentityAllowedTools,
				deniedTools: selectedIdentityDeniedTools,
			}),
		);
		setToolPolicySaveError(null);
		setToolPolicySaveSuccess(null);
	}, [availableToolItems, selectedIdentityAllowedTools, selectedIdentityDeniedTools]);

	useEffect(() => {
		if (!selectedIdentityUserId && enterpriseIdentities.length) {
			setSelectedIdentityUserId(enterpriseIdentities[0].user_id);
		}
	}, [enterpriseIdentities, selectedIdentityUserId]);

	useEffect(() => {
		if (!connectors || connectorDefaultsAppliedRef.current) {
			return;
		}

		connectorDefaultsAppliedRef.current = true;
		setConnectorTestForm((previous) =>
			connectorFormWithPlatformDefaults({
				current: previous,
				connectors,
			}),
		);
	}, [connectors]);

	useEffect(() => {
		const nextAgentId = selectedRunAgentIdForAvailableAgents({
			currentAgentId: selectedRunAgentId,
			activeAgents: activePlatformAgents,
			readyAgents: readyPlatformAgents,
		});

		if (nextAgentId !== selectedRunAgentId) {
			setSelectedRunAgentId(nextAgentId);
		}
	}, [activePlatformAgents, readyPlatformAgents, selectedRunAgentId]);

	useEffect(() => {
		if (!selectedRunAgentId) {
			setAgentRunResult(null);
			return;
		}

		setAgentRunResult((current) =>
			agentRunResultForSelectedAgent({
				current,
				agentConversations,
				agentId: selectedRunAgentId,
			}),
		);
	}, [selectedRunAgentId]);

	useEffect(() => {
		void refetchAgentRuns();
	}, [selectedRunAgentId, selectedIdentityUserId]);

	useEffect(() => {
		const nextSelection = workflowSelectionForAvailableTemplates({
			workflowTemplates,
			selectedWorkflowType,
		});

		if (nextSelection) {
			setSelectedWorkflowType(nextSelection.workflowType);
			setWorkflowInputs(nextSelection.inputs);
		}
	}, [selectedWorkflowType, workflowTemplates]);

	async function refetchConnectors() {
		setConnectorsLoading(true);
		setConnectorsError(null);
		try {
			const response = await platformApi.connectors();
			setConnectors(response);
		} catch (error) {
			setConnectorsError(
				error instanceof Error ? error.message : connectorRequestText.loadError,
			);
		} finally {
			setConnectorsLoading(false);
		}
	}

	async function refetchGovernance() {
		setGovernanceLoading(true);
		setGovernanceError(null);
		try {
			const response = await platformApi.governance();
			setGovernance(response);
		} catch (error) {
			setGovernanceError(
				error instanceof Error ? error.message : auditRequestText.loadError,
			);
		} finally {
			setGovernanceLoading(false);
		}
	}

	async function refetchPlatformConfigExport() {
		setPlatformConfigLoading(true);
		setPlatformConfigError(null);
		try {
			const response = await platformApi.exportConfig();
			setPlatformConfigExport(response);
			setPlatformConfigImportText((current) =>
				platformConfigImportTextForExport({
					exportResponse: response,
					currentImportText: current,
				}),
			);
		} catch (error) {
			setPlatformConfigError(
				platformConfigLoadErrorMessage(error, configManagementRequestText),
			);
		} finally {
			setPlatformConfigLoading(false);
		}
	}

	async function handleCopyPlatformConfig() {
		await runPlatformConfigCopyAction(platformConfigExport, {
			setImportText: setPlatformConfigImportText,
			copyText: async (text) => {
				if (navigator.clipboard) {
					await navigator.clipboard.writeText(text);
				}
			},
		});
	}

	async function handleImportPlatformConfig() {
		await runPlatformConfigImportAction(
			{
				importText: platformConfigImportText,
				importMode: platformConfigImportMode,
				text: configManagementRequestText,
			},
			{
				setImporting: setImportingPlatformConfig,
				clearError: () => setPlatformConfigError(null),
				clearResult: () => setPlatformConfigImportResult(null),
				importConfig: platformApi.importConfig,
				setResult: setPlatformConfigImportResult,
				refreshDependentViews: async () => {
					await Promise.all([
						refetchPlatform(),
						refetchMembers(),
						refetchConnectors(),
						refetchGovernance(),
						refetchPlatformAgents(),
						refetchToolCatalog(),
						refetchWorkflowTemplates(),
						refetchPlatformConfigExport(),
					]);
				},
				handleError: (error) =>
					setPlatformConfigError(
						platformConfigImportErrorMessage(
							error,
							configManagementRequestText,
						),
					),
			},
		);
	}

	async function refetchMembers() {
		setPlatformMembersLoading(true);
		setPlatformMembersError(null);
		try {
			const response = await platformApi.members();
			setPlatformMembers(response);
		} catch (error) {
			setPlatformMembersError(
				error instanceof Error ? error.message : memberRequestText.loadError,
			);
		} finally {
			setPlatformMembersLoading(false);
		}
	}

	async function refreshMemberDependentViews() {
		await Promise.all([
			refetchMembers(),
			refetchGovernance(),
			refetchToolCatalog(),
			refetchPlatformAgents(),
		]);
	}

	async function handleSaveMember() {
		await runMemberSaveAction(memberForm, {
			setSavingMember,
			clearError: () => setPlatformMembersError(null),
			handleValidationError: () =>
				setPlatformMembersError(memberRequestText.userRequired),
			createMember: async (payload) => {
				await platformApi.createMember(payload);
			},
			resetForm: () => setMemberForm(defaultMemberForm),
			refreshDependentViews: refreshMemberDependentViews,
			handleError: (error) =>
				setPlatformMembersError(
					error instanceof Error ? error.message : memberRequestText.saveError,
				),
		});
	}

	function handleEditMember(member: EnterprisePlatformMember) {
		runMemberEditAction(member, { setMemberForm });
	}

	async function handleToggleMemberStatus(member: EnterprisePlatformMember) {
		await runMemberStatusToggleRequestAction(member, {
			setUpdatingMember: setUpdatingMemberId,
			clearError: () => setPlatformMembersError(null),
			activateMember: async (userId, patch) => {
				await platformApi.updateMember(userId, patch);
			},
			deactivateMember: async (userId) => {
				await platformApi.deactivateMember(userId);
			},
			refreshDependentViews: refreshMemberDependentViews,
			handleError: (error) =>
				setPlatformMembersError(
					error instanceof Error ? error.message : memberRequestText.saveError,
				),
		});
	}

	function loadSavedConnectorConfig(config: EnterpriseConnectorSavedConfig) {
		runConnectorSavedConfigLoadAction(config, {
			setConnectorTestForm,
			setConnectorTestResult,
			setConnectorTestError,
			setConnectorSaveError,
			setConnectorSaveSuccess,
		});
	}

	async function handleSaveConnectorConfig() {
		await runConnectorSaveAction(
			{
				form: connectorTestForm,
				draftIssues: connectorDraftIssues,
				baseUrlRequiredMessage: connectorRequestText.saveBaseUrlRequired,
			},
			{
				setSavingConnectorConfig,
				clearMessages: () => {
					setConnectorSaveError(null);
					setConnectorSaveSuccess(null);
				},
				handleValidationError: (error) => {
					setConnectorSaveError(error);
					setConnectorSaveSuccess(null);
				},
				saveConnectorConfig: async (payload) =>
					platformApi.saveConnectorConfig(payload),
				setConnectors,
				setConnectorTestForm,
				setConnectorSaveSuccess,
				saveSuccessMessage: connectorRequestText.saveSuccessWithTenant,
				refreshDependentViews: async () => {
					await refetchConnectors();
					await refetchGovernance();
					await refetchOpsTasks();
				},
				handleError: (error) =>
					setConnectorSaveError(
						error instanceof Error
							? error.message
							: connectorRequestText.saveError,
					),
			},
		);
	}

	async function handleTestConnector() {
		return runConnectorTestAction(
			{
				form: connectorTestForm,
				draftIssues: connectorDraftIssues,
				baseUrlRequiredMessage: connectorRequestText.testBaseUrlRequired,
			},
			{
				setTestingConnector,
				clearError: () => setConnectorTestError(null),
				handleValidationError: setConnectorTestError,
				testConnector: async (payload) => platformApi.testConnector(payload),
				setConnectorTestResult,
				handleError: (error) =>
					setConnectorTestError(
						error instanceof Error
							? error.message
							: connectorRequestText.testError,
					),
			},
		);
	}

	async function handleTestAndSaveConnectorConfig() {
		await runConnectorTestAndSaveAction(
			{
				testBeforeSaveRequiredMessage:
					connectorRequestText.testBeforeSaveRequired,
			},
			{
				testConnector: handleTestConnector,
				saveConnectorConfig: handleSaveConnectorConfig,
				clearSaveSuccess: () => setConnectorSaveSuccess(null),
				setSaveError: setConnectorSaveError,
			},
		);
	}

	async function refetchToolCatalog() {
		setToolCatalogLoading(true);
		setToolCatalogError(null);
		try {
			const response = await platformApi.tools({
				agent_id: selectedRunAgentId || undefined,
				user_id: selectedIdentityUserId || undefined,
			});
			setToolCatalog(response);
		} catch (error) {
			setToolCatalogError(
				error instanceof Error ? error.message : toolCatalogRequestText.loadError,
			);
		} finally {
			setToolCatalogLoading(false);
		}
	}

	async function handleSaveToolPolicy() {
		await runToolPolicySaveAction(
			{ identity: selectedIdentity, draft: toolPolicyDraft },
			{
				setSavingToolPolicy,
				clearMessages: () => {
					setToolPolicySaveError(null);
					setToolPolicySaveSuccess(null);
				},
				handleValidationError: () => {
					setToolPolicySaveError(tenantGovernanceRequestText.noIdentity);
					setToolPolicySaveSuccess(null);
				},
				updateToolPolicy: async (payload) => {
					await platformApi.updateToolPolicy(payload);
				},
				setToolPolicySaveSuccess: () =>
					setToolPolicySaveSuccess(tenantGovernanceRequestText.policySaved),
				refreshDependentViews: async () => {
					await Promise.all([
						refetchPlatform(),
						refetchGovernance(),
						refetchToolCatalog(),
					]);
					await refetchOpsTasks();
				},
				handleError: (error) =>
					setToolPolicySaveError(
						error instanceof Error
							? error.message
							: tenantGovernanceRequestText.policySaveError,
					),
			},
		);
	}

	async function refetchAgentRuns(
		agentId = selectedRunAgentId,
		userId = selectedIdentityUserId || username,
	) {
		if (!agentId) {
			setAgentRunsError(null);
			setAgentRunResult(null);
			return;
		}

		setAgentRunsLoading(true);
		setAgentRunsError(null);
		try {
			const response = await platformApi.agentRuns({
				agent_id: agentId,
				user_id: userId || undefined,
				limit: 20,
			});
			const turns = response.runs.map(agentConversationTurnFromRunHistoryItem);
			setAgentConversations((current) =>
				replaceAgentConversationTurns({
					agentConversations: current,
					agentId,
					turns,
				}),
			);
			setAgentRunResult((current) =>
				agentRunResultAfterHistoryRefresh({ current, agentId, turns }),
			);
		} catch (error) {
			setAgentRunsError(
				error instanceof Error ? error.message : agentRunnerRequestText.historyLoadError,
			);
		} finally {
			setAgentRunsLoading(false);
		}
	}

	async function refetchAuditEvents(overrides: Partial<typeof auditFilters> = {}) {
		setAuditLoading(true);
		setAuditError(null);
		try {
			const filters = { ...auditFilters, ...overrides };
			const response = await platformApi.audit(auditQueryFromFilters(filters));
			setAuditEvents(response.events);
			setAuditSummary(response.summary);
		} catch (error) {
			setAuditError(error instanceof Error ? error.message : auditRequestText.loadError);
		} finally {
			setAuditLoading(false);
		}
	}

	async function refetchPlatformAgents() {
		setPlatformAgentsLoading(true);
		setPlatformAgentsError(null);
		try {
			const response = await platformApi.agents();
			setPlatformAgents(response);
		} catch (error) {
			setPlatformAgentsError(
				error instanceof Error ? error.message : agentManagementRequestText.loadError,
			);
		} finally {
			setPlatformAgentsLoading(false);
		}
	}

	async function refetchWorkflowTemplates() {
		setWorkflowTemplatesLoading(true);
		setWorkflowTemplatesError(null);
		try {
			const response = await platformApi.workflows();
			setWorkflowTemplates(response.workflows);
		} catch (error) {
			setWorkflowTemplatesError(
				error instanceof Error ? error.message : workflowRunnerRequestText.templatesLoadError,
			);
		} finally {
			setWorkflowTemplatesLoading(false);
		}
	}

	async function refetchWorkflowRuns() {
		setWorkflowRunsLoading(true);
		setWorkflowRunsError(null);
		try {
			const response = await platformApi.workflowRuns({ limit: 10 });
			setWorkflowRuns(response.runs);
		} catch (error) {
			setWorkflowRunsError(
				error instanceof Error ? error.message : workflowRunnerRequestText.historyLoadError,
			);
		} finally {
			setWorkflowRunsLoading(false);
		}
	}

	async function refetchScenarios() {
		setScenariosLoading(true);
		setScenariosError(null);
		try {
			const response = await platformApi.scenarios();
			setScenarios(response.scenarios);
		} catch (error) {
			setScenariosError(
				error instanceof Error ? error.message : scenarioRequestText.loadError,
			);
		} finally {
			setScenariosLoading(false);
		}
	}

	async function refetchOpsTasks() {
		setOpsTasksLoading(true);
		setOpsTasksError(null);
		try {
			const response = await platformApi.opsTasks();
			setOpsTasks(response.tasks);
			setOpsTasksSummary(response.summary);
		} catch (error) {
			setOpsTasksError(
				error instanceof Error ? error.message : opsTasksRequestText.loadError,
			);
		} finally {
			setOpsTasksLoading(false);
		}
	}

	async function refetchApprovals(overrides: Partial<typeof approvalFilters> = {}) {
		setApprovalLoading(true);
		setApprovalError(null);
		try {
			const filters = { ...approvalFilters, ...overrides };
			const response = await platformApi.approvals(approvalQueryFromFilters(filters));
			setApprovalRequests(response.approvals);
		} catch (error) {
			setApprovalError(
				error instanceof Error ? error.message : approvalRequestText.loadError,
			);
		} finally {
			setApprovalLoading(false);
		}
	}

	async function handleCreateApproval() {
		await runApprovalCreateAction(
			{
				form: approvalForm,
				defaults: {
					selectedIdentityUserId,
					selectedRunAgentId,
					username,
				},
				defaultReason: defaultApprovalForm.reason,
			},
			{
				setCreatingApproval,
				clearApprovalError: () => setApprovalError(null),
				createApproval: platformApi.createApproval,
				setApprovalRequests,
				refreshDependentViews: async () => {
					await refetchGovernance();
					await refetchOpsTasks();
				},
				resetApprovalReason: setApprovalForm,
				handleError: (error) =>
					setApprovalError(
						error instanceof Error
							? error.message
							: approvalRequestText.createError,
					),
			},
		);
	}

	async function handleCreateRunApproval(
		requestType: PlatformApprovalRunType,
		reason?: string,
	): Promise<boolean> {
		return runApprovalRunCreateAction(
			{
				requestType,
				reason,
				runApprovalReason: approvalRequestText.runApprovalReason,
				selectedToolInputKey,
				selectedToolInputValue,
				workflowInputs,
				selectedIdentityUserId,
				selectedRunAgentId,
				selectedToolName,
				selectedWorkflowType,
				username,
			},
			{
				setCreatingRunApproval,
				clearApprovalError: () => setApprovalError(null),
				createApproval: platformApi.createApproval,
				setApprovalRequests,
				clearRunError: (type) => {
					if (type === 'tool_run') {
						setToolRunError(null);
					} else {
						setWorkflowRunError(null);
					}
				},
				refreshDependentViews: async () => {
					await refetchGovernance();
					await refetchOpsTasks();
				},
				scrollToGovernance: () => window.setTimeout(scrollToGovernance, 0),
				handleError: (type, error) => {
					const message =
						error instanceof Error
							? error.message
							: approvalRequestText.createError;
					if (type === 'tool_run') {
						setToolRunError(message);
					} else {
						setWorkflowRunError(message);
					}
				},
			},
		);
	}

	async function handleDecideApproval(
		approvalId: string,
		decision: 'approved' | 'rejected',
	) {
		await runApprovalDecisionAction(
			{
				approvalId,
				decision,
				username,
				text: approvalRequestText,
			},
			{
				setDecidingApprovalId,
				clearApprovalError: () => setApprovalError(null),
				approveApproval: platformApi.approveApproval,
				rejectApproval: platformApi.rejectApproval,
				setApprovalRequests,
				refreshDependentViews: async () => {
					await refetchGovernance();
					await refetchOpsTasks();
				},
				handleError: (error) =>
					setApprovalError(
						error instanceof Error
							? error.message
							: approvalRequestText.decisionError,
					),
			},
		);
	}

	async function handleApproveAndRun(approval: EnterpriseApprovalRequestItem) {
		await runApprovalApproveAndContinueAction(
			{
				approval,
				agentQuestion,
				inputConfig: approval.tool_name
					? enterpriseToolInputConfig[approval.tool_name]
					: undefined,
				username,
				text: approvalRequestText,
			},
			{
				setContinuingApprovalId,
				clearApprovalError: () => setApprovalError(null),
				approveApproval: platformApi.approveApproval,
				setApprovalRequests,
				refreshDependentViews: async () => {
					await refetchGovernance();
					await refetchOpsTasks();
				},
				selectIdentityUser: setSelectedIdentityUserId,
				selectRunAgent: setSelectedRunAgentId,
				setAgentApprovalId,
				setAgentQuestion,
				scrollToAgentRunner: () => window.setTimeout(scrollToAgentRunner, 0),
				runAgent: runEnterpriseAgent,
				selectToolName: setSelectedToolName,
				patchToolInputs: setToolInputs,
				setToolApprovalId,
				scrollToToolRunner: () => window.setTimeout(scrollToToolRunner, 0),
				runTool: runEnterpriseTool,
				selectWorkflowType: setSelectedWorkflowType,
				setWorkflowInputs,
				setWorkflowApprovalId,
				scrollToWorkflowRunner: () =>
					window.setTimeout(scrollToWorkflowRunner, 0),
				runWorkflow: runEnterpriseWorkflow,
				handleError: (error) =>
					setApprovalError(
						error instanceof Error
							? error.message
							: approvalRequestText.approveAndRunError,
					),
			},
		);
	}

	async function handleToggleWorkflowTemplate(
		template: EnterpriseWorkflowTemplate,
		enabled: boolean,
	) {
		await runWorkflowTemplateToggleAction(
			{ template, enabled },
			{
				setSavingWorkflowType,
				clearError: () => setWorkflowTemplatesError(null),
				updateWorkflow: (workflowType, values) =>
					platformApi.updateWorkflow(workflowType, values),
				setWorkflowTemplates,
				refreshDependentViews: async () => {
					await refetchPlatform();
					await refetchScenarios();
					await refetchOpsTasks();
				},
				handleError: (error) =>
					setWorkflowTemplatesError(
						error instanceof Error
							? error.message
							: workflowRunnerRequestText.templatesLoadError,
					),
			},
		);
	}

	function buildDefaultPublishForm(template: EnterpriseAgentTemplate): PublishFormState {
		return defaultPublishFormForTemplate({
			template,
			currentUserTenant: platformStatus?.current_user.tenant,
			credentials,
			knowledgeBases,
		});
	}

	function handleConfigureTemplate(template: EnterpriseAgentTemplate) {
		runTemplateConfigureAction(
			{
				template,
				form: buildDefaultPublishForm(template),
			},
			{
				clearEditingAgent: () => setEditingAgentId(null),
				selectTemplate: setSelectedTemplateId,
				setPublishForm,
			},
		);
	}

	function handlePublishTenantChange(value: string) {
		runPublishTenantChangeAction(
			{
				tenant: value,
				currentUserTenant: platformStatus?.current_user.tenant,
				members: platformMembers?.members ?? [],
			},
			{ setPublishForm },
		);
	}

	function handleOperationAction(target?: string) {
		runPlatformOperationAction(target, {
			scrollToAgentManagement,
			scrollToConnectorCenter,
			scrollToGovernance,
			scrollToWorkflowRunner,
			scrollToToolRunner,
			scrollToMemoryOperations,
			navigate,
		});
	}

	async function handleResolveOpsTask(task: EnterprisePlatformOpsTask) {
		await runOpsTaskResolveAction(task, {
			runOperationAction: handleOperationAction,
			setResolvingOpsTaskCode,
			clearError: () => setOpsTasksError(null),
			resolveOpsTask: (code) => platformApi.resolveOpsTask(code),
			setWorkflowTemplates,
			setOpsTasks,
			setOpsTasksSummary,
			refreshDependentViews: async () => {
				await refetchPlatform();
				await refetchScenarios();
			},
			handleError: (error) =>
				setOpsTasksError(
					error instanceof Error ? error.message : opsTasksRequestText.resolveError,
				),
		});
	}

	function handlePrimeToolApproval(agent: EnterprisePublishedAgent, toolName: string) {
		runPrimeToolApprovalAction({
			agent,
			inputConfig: enterpriseToolInputConfig[toolName],
			catalogItems: availableToolItems,
			toolName,
			reason: approvalRequestText.agentToolApprovalReason({
				agent: agent.name,
				tool: toolName,
			}),
			defaultInputValue: defaultApprovalForm.input_value,
			selectedIdentityUserId,
			username,
		}, {
			selectIdentityUser: setSelectedIdentityUserId,
			patchApprovalForm: setApprovalForm,
			clearApprovalError: () => setApprovalError(null),
			scrollToGovernance: () => window.setTimeout(scrollToGovernance, 0),
		});
	}

	function handlePrimeAgentWorkflow(agent: EnterprisePublishedAgent) {
		runPrimeAgentWorkflowAction({
			agent,
			selectedIdentityUserId,
			username,
			selectedWorkflowTemplate,
			workflowOptions,
			selectedWorkflowType,
		}, {
			selectRunAgent: setSelectedRunAgentId,
			selectIdentityUser: setSelectedIdentityUserId,
			setWorkflowInputs,
			setWorkflowApprovalId,
			clearWorkflowRunError: () => setWorkflowRunError(null),
			scrollToWorkflowRunner: () => window.setTimeout(scrollToWorkflowRunner, 0),
		});
	}

	function handleUseApproval(approval: EnterpriseApprovalRequestItem) {
		runApprovalUsageTargetAction(
			approval,
			approval.tool_name ? enterpriseToolInputConfig[approval.tool_name] : undefined,
			{
				selectIdentityUser: setSelectedIdentityUserId,
				selectRunAgent: setSelectedRunAgentId,
				setAgentApprovalId,
				setAgentQuestion,
				clearAgentRunError: () => setAgentRunError(null),
				scrollToAgentRunner: () => window.setTimeout(scrollToAgentRunner, 0),
				selectToolName: setSelectedToolName,
				patchToolInputs: setToolInputs,
				setToolApprovalId,
				clearToolRunError: () => setToolRunError(null),
				scrollToToolRunner: () => window.setTimeout(scrollToToolRunner, 0),
				selectWorkflowType: setSelectedWorkflowType,
				setWorkflowInputs,
				setWorkflowApprovalId,
				clearWorkflowRunError: () => setWorkflowRunError(null),
				scrollToWorkflowRunner: () => window.setTimeout(scrollToWorkflowRunner, 0),
			},
		);
	}

	function handlePrimeAgentRunner(sample = primaryAgentSampleQuestion) {
		runAgentRunnerPrimeTargetAction(sample, {
			setQuestion: setAgentQuestion,
			clearError: () => setAgentRunError(null),
			scrollToAgentRunner: () => window.setTimeout(scrollToAgentRunner, 0),
		});
	}

	function handlePrimePublishedAgent(agentId: string, sample = primaryAgentSampleQuestion) {
		runPrimePublishedAgentAction({
			agentConversations,
			agentId,
			currentQuestion: agentQuestion,
			sampleQuestion: sample,
		}, {
			selectRunAgent: setSelectedRunAgentId,
			setQuestion: setAgentQuestion,
			setResult: setAgentRunResult,
			clearError: () => setAgentRunError(null),
			scrollToAgentRunner: () => window.setTimeout(scrollToAgentRunner, 0),
		});
	}

	function handleSelectRunAgent(agentId: string) {
		runSelectAgentForRunAction({ agentConversations, agentId }, {
			selectRunAgent: setSelectedRunAgentId,
			setResult: setAgentRunResult,
			clearError: () => setAgentRunError(null),
		});
	}

	async function handleSelectAgentRun(turn: EnterpriseAgentConversationTurn) {
		const target = runAgentRunHistorySelectionRequestAction(turn, {
			setQuestion: setAgentQuestion,
			clearRunError: () => setAgentRunError(null),
			clearRunsError: () => setAgentRunsError(null),
			setResult: setAgentRunResult,
			setRunsLoading: setAgentRunsLoading,
		});

		try {
			const run = await platformApi.agentRun(target.runId);
			const detailedTurn = agentConversationTurnFromRunHistoryItem(run);
			runAgentRunHistoryDetailAction(detailedTurn, {
				setAgentConversations,
				setResult: setAgentRunResult,
			});
		} catch (error) {
			setAgentRunsError(
				error instanceof Error ? error.message : agentRunnerRequestText.historyLoadError,
			);
			setAgentRunResult(turn.response);
		} finally {
			setAgentRunsLoading(false);
		}
	}

	async function handleClearAgentConversation() {
		await runClearAgentConversationRequestAction(
			{
				selectedRunAgentId,
				selectedIdentityUserId,
				username,
			},
			{
				setRunsLoading: setAgentRunsLoading,
				clearRunsError: () => setAgentRunsError(null),
				clearRuns: platformApi.clearAgentRuns,
				setAgentConversations,
				clearRunResult: () => setAgentRunResult(null),
				clearRunError: () => setAgentRunError(null),
				setRunsError: setAgentRunsError,
				historyClearErrorMessage: agentRunnerRequestText.historyClearError,
			},
		);
	}

	function handleUseIdentity(identity: EnterpriseIdentity) {
		runUseIdentityAgentRunnerAction(
			identity,
			primaryAgentSampleQuestion,
			{
				selectIdentityUser: setSelectedIdentityUserId,
				setQuestion: setAgentQuestion,
				clearError: () => setAgentRunError(null),
				scrollToAgentRunner: () => window.setTimeout(scrollToAgentRunner, 0),
			},
		);
	}

	function handleInspectIdentityAudit(identity: EnterpriseIdentity) {
		const filters = auditFiltersForIdentity(identity);
		runAuditFilterTargetAction(filters, {
			patchAuditFilters: setAuditFilters,
			refetchAuditEvents,
			scrollToGovernance: () => window.setTimeout(scrollToGovernance, 0),
		});
	}

	function handleInspectIdentityApprovals(identity: EnterpriseIdentity) {
		const filters = approvalFiltersForIdentity(identity);
		runApprovalFilterTargetAction(filters, {
			patchApprovalFilters: setApprovalFilters,
			refetchApprovals,
			scrollToGovernance: () => window.setTimeout(scrollToGovernance, 0),
		});
	}

	function handleInspectIdentityFailures(identity: EnterpriseIdentity) {
		const filters = failedAuditFiltersForIdentity(identity);
		runAuditFilterTargetAction(filters, {
			patchAuditFilters: setAuditFilters,
			refetchAuditEvents,
			scrollToGovernance: () => window.setTimeout(scrollToGovernance, 0),
		});
	}

	function handleUseTenant(tenant: string) {
		runUseTenantAgentRunnerAction(
			{
				enterpriseIdentities,
				tenant,
				fallbackIdentity: selectedIdentity,
			},
			{
				useIdentity: handleUseIdentity,
				clearError: () => setAgentRunError(null),
				scrollToAgentRunner: () => window.setTimeout(scrollToAgentRunner, 0),
			},
		);
	}

	function handleInspectTenantAudit(tenant: string) {
		const filters = auditFiltersForTenant(tenant);
		runAuditFilterTargetAction(filters, {
			patchAuditFilters: setAuditFilters,
			refetchAuditEvents,
			scrollToGovernance: () => window.setTimeout(scrollToGovernance, 0),
		});
	}

	function handleOpenMemoryOperation(item: MemoryOperationsItem) {
		runOpenMemoryOperationAgentAction(
			{
				enterpriseIdentities,
				item,
				fallbackQuestion: primaryAgentSampleQuestion,
			},
			{
				selectIdentityUser: setSelectedIdentityUserId,
				selectRunAgent: setSelectedRunAgentId,
				setResult: setAgentRunResult,
				setQuestion: setAgentQuestion,
				clearError: () => setAgentRunError(null),
				scrollToAgentRunner: () => window.setTimeout(scrollToAgentRunner, 0),
			},
		);
	}

	function handleInspectMemoryOperationAudit(item: MemoryOperationsItem) {
		const filters = auditFiltersForMemoryOperation(item);
		runAuditFilterTargetAction(filters, {
			patchAuditFilters: setAuditFilters,
			refetchAuditEvents,
			scrollToGovernance: () => window.setTimeout(scrollToGovernance, 0),
		});
	}

	function handleInspectTenantApprovals(tenant: string) {
		const filters = approvalFiltersForTenant(tenant);
		runApprovalFilterTargetAction(filters, {
			patchApprovalFilters: setApprovalFilters,
			refetchApprovals,
			scrollToGovernance: () => window.setTimeout(scrollToGovernance, 0),
		});
	}

	function handlePrepareTenantAgent(tenant: string) {
		runPrepareTenantAgentAction(
			{
				defaultTemplate: defaultAgentTemplate,
				currentUserTenant: platformStatus?.current_user.tenant,
				credentials,
				knowledgeBases,
				tenant,
			},
			{
				clearEditingAgent: () => setEditingAgentId(null),
				selectTemplate: setSelectedTemplateId,
				setPublishForm,
				scrollToAgentManagement: () => window.setTimeout(scrollToAgentManagement, 0),
			},
		);
	}

	function handleInspectAgentRunAudit() {
		runInspectAgentRunEvidenceAuditAction(agentRunEvidence, {
			patchAuditFilters: setAuditFilters,
			refetchAuditEvents,
			scrollToGovernance: () => window.setTimeout(scrollToGovernance, 0),
		});
	}

	function handleStartPublishing() {
		runStartPublishingAction({
			selectedTemplateId,
			templates: agentTemplates,
		}, {
			configureTemplate: handleConfigureTemplate,
			scrollToAgentManagement: () => window.setTimeout(scrollToAgentManagement, 0),
		});
	}

	function handleNextAgentSetupStep() {
		runAgentSetupStepRequestAction({
			nextStep: nextAgentSetupStep,
			hasSelectedTemplate: Boolean(selectedTemplate),
			hasDefaultTemplate: Boolean(defaultAgentTemplate),
			credentialCount: credentials.length,
			knowledgeBaseCount: knowledgeBases.length,
		}, {
			configureDefaultTemplate: () => {
				if (defaultAgentTemplate) {
					handleConfigureTemplate(defaultAgentTemplate);
				}
			},
			navigate,
			scrollToAgentManagement: () => window.setTimeout(scrollToAgentManagement, 0),
			scrollToCurrentStep: () => {
				nextAgentSetupStep?.ref.current?.scrollIntoView({
					behavior: 'smooth',
					block: 'center',
				});
			},
		});
	}

	function handleEditAgent(agent: EnterprisePublishedAgent) {
		const draft = agentEditDraft(agent);
		runAgentEditDraftAction(draft, {
			selectTemplate: setSelectedTemplateId,
			setEditingAgent: setEditingAgentId,
			setPublishForm,
		});
	}

	function handleCancelEdit() {
		runAgentEditCancelAction(selectedTemplate, {
			clearEditingAgent: () => setEditingAgentId(null),
			configureTemplate: handleConfigureTemplate,
		});
	}

	function handleTogglePublishList(
		key: PublishListFormKey,
		value: string,
		checked: boolean,
	) {
		runPublishListToggleAction(
			{
				key,
				value,
				checked,
			},
			{ setPublishForm },
		);
	}

	async function handlePublishAgent() {
		await runAgentPublishRequestAction({
			selectedTemplateId,
			editingAgentId,
			form: publishForm,
		}, {
			setPublishingTemplate: setPublishingTemplateId,
			clearError: () => setPlatformAgentsError(null),
			publishAgent: platformApi.publishAgent,
			updateAgent: platformApi.updateAgent,
			setLastPublishedAgent: setLastPublishedAgentId,
			primePublishedAgent: handlePrimePublishedAgent,
			clearEditingAgent: () => setEditingAgentId(null),
			refreshDependentViews: async () => {
				await refetchPlatformAgents();
				await refetchPlatform();
				await refetchToolCatalog();
				await refetchOpsTasks();
			},
			handleError: (error, publishTarget) => {
				setPlatformAgentsError(
					error instanceof Error
						? error.message
						: publishTarget.type === 'update'
							? agentManagementRequestText.updateError
							: agentManagementRequestText.publishError,
				);
			},
		});
	}

	async function handleQuickPublishAgent() {
		await runQuickPublishRequestAction({
			credentialCount: credentials.length,
			selectedTemplate,
			defaultTemplate: defaultAgentTemplate,
			currentUserTenant: platformStatus?.current_user.tenant,
			credentials,
			knowledgeBases,
		}, {
			navigateToPath: navigate,
			startPublishing: handleStartPublishing,
			clearEditingAgent: () => setEditingAgentId(null),
			selectTemplate: setSelectedTemplateId,
			setPublishForm,
			setPublishingTemplate: setPublishingTemplateId,
			clearError: () => setPlatformAgentsError(null),
			publishAgent: platformApi.publishAgent,
			setLastPublishedAgent: setLastPublishedAgentId,
			primePublishedAgent: handlePrimePublishedAgent,
			refreshDependentViews: async () => {
				await refetchPlatformAgents();
				await refetchPlatform();
				await refetchToolCatalog();
				await refetchOpsTasks();
			},
			handleError: (error) => {
				setPlatformAgentsError(
					error instanceof Error
						? error.message
						: agentManagementRequestText.publishError,
				);
			},
			focusAgentManagement: () => window.setTimeout(scrollToAgentManagement, 0),
		});
	}

	function handleNextStepPrimaryAction() {
		runNextStepPrimaryRequestAction(nextStepMode, {
			navigate,
			handleQuickPublishAgent,
			scrollToAgentManagement,
			scrollToGovernance,
			handlePrimeAgentRunner,
		});
	}

	function handleAppCenterPrimaryAction() {
		runAppCenterPrimaryRequestAction({
			credentialCount: credentials.length,
			readyAgentId: readyPlatformAgents[0]?.id,
			activeAgentCount: activePlatformAgents.length,
		}, {
			navigate,
			selectAndPrimeAgent: (agentId) => {
				setSelectedRunAgentId(agentId);
				handlePrimeAgentRunner();
			},
			handleQuickPublishAgent,
			scrollToAgentManagement,
		});
	}

	function handleAppCenterDetailPrimaryAction() {
		runAppCenterDetailPrimaryRequestAction({
			agentId: inspectedAppCenterAgent?.id,
			agentIsReady: Boolean(
				inspectedAppCenterAgent &&
					platformAgentIsReadyForDisplay(inspectedAppCenterAgent),
			),
			hasTemplate: Boolean(inspectedAppCenterTemplate),
		}, {
			selectAndPrimeAgent: (agentId) => {
				setSelectedRunAgentId(agentId);
				handlePrimeAgentRunner();
			},
			editAgent: () => {
				if (inspectedAppCenterAgent) {
					handleEditAgent(inspectedAppCenterAgent);
				}
			},
			configureTemplate: () => {
				if (inspectedAppCenterTemplate) {
					handleConfigureTemplate(inspectedAppCenterTemplate);
				}
			},
			scrollToAgentManagement: () => window.setTimeout(scrollToAgentManagement, 0),
		});
	}

	function handleAppCenterDetailSecondaryAction() {
		runAppCenterDetailSecondaryRequestAction({
			hasAgent: Boolean(inspectedAppCenterAgent),
		}, {
			editAgent: () => {
				if (inspectedAppCenterAgent) {
					handleEditAgent(inspectedAppCenterAgent);
				}
			},
			scrollToAgentManagement: () => window.setTimeout(scrollToAgentManagement, 0),
			scrollToGovernance,
		});
	}

	async function handleArchiveAgent(agent: EnterprisePublishedAgent) {
		await runAgentArchiveRequestAction(
			agent,
			{
				selectedRunAgentId,
				editingAgentId,
			},
			{
				setArchivingAgent: setArchivingAgentId,
				clearError: () => setPlatformAgentsError(null),
				archiveAgent: platformApi.archiveAgent,
				setSelectedRunAgent: setSelectedRunAgentId,
				clearRunResult: () => {
					setAgentRunResult(null);
					setAgentRunError(null);
				},
				clearEditingAgent: () => setEditingAgentId(null),
				refreshDependentViews: async () => {
					await refetchPlatformAgents();
					await refetchPlatform();
					await refetchToolCatalog();
					await refetchOpsTasks();
				},
				handleError: (error) => {
					setPlatformAgentsError(
						error instanceof Error
							? error.message
							: agentManagementRequestText.archiveError,
					);
				},
			},
		);
	}

	function syncAgentQuickConfiguration(
		agentId: string,
		updatedAgentId: string,
		patch: AgentQuickConfigurationPatch,
	) {
		const syncResult = agentQuickConfigurationSyncResult({
			agentId,
			editingAgentId,
			patch,
			selectedRunAgentId,
			updatedAgentId,
		});
		if (syncResult.selectedRunAgentId) {
			setSelectedRunAgentId(syncResult.selectedRunAgentId);
		}
		const publishFormPatch = syncResult.publishFormPatch;
		if (publishFormPatch) {
			setPublishForm((current) => publishFormWithPatch(current, publishFormPatch));
		}
	}

	async function handleBindDefaultModel(agent: EnterprisePublishedAgent) {
		await runAgentDefaultModelBindRequestAction({
			agent,
			modelConfigId: credentials[0]?.id,
		}, {
			navigateToPath: navigate,
			setBindingAgent: setBindingAgentModelId,
			clearError: () => setPlatformAgentsError(null),
			updateAgent: platformApi.updateAgent,
			syncQuickConfiguration: syncAgentQuickConfiguration,
			refreshDependentViews: async () => {
				await refetchPlatformAgents();
				await refetchPlatform();
				await refetchToolCatalog();
				await refetchOpsTasks();
			},
			handleError: (error) =>
				setPlatformAgentsError(
					error instanceof Error
						? error.message
						: agentManagementRequestText.bindModelError,
				),
		});
	}

	async function handleBindAvailableKnowledge(agent: EnterprisePublishedAgent) {
		await runAgentKnowledgeBasesBindRequestAction({ agent, knowledgeBases }, {
			navigateToPath: navigate,
			setBindingAgent: setBindingAgentKnowledgeId,
			clearError: () => setPlatformAgentsError(null),
			updateAgent: platformApi.updateAgent,
			syncQuickConfiguration: syncAgentQuickConfiguration,
			refreshDependentViews: async () => {
				await refetchPlatformAgents();
				await refetchPlatform();
				await refetchToolCatalog();
				await refetchOpsTasks();
			},
			handleError: (error) =>
				setPlatformAgentsError(
					error instanceof Error
						? error.message
						: agentManagementRequestText.bindKnowledgeError,
				),
		});
	}

	async function handleBindTemplateTools(agent: EnterprisePublishedAgent) {
		await runAgentTemplateToolsBindRequestAction(
			{
				agent,
				templates: agentTemplates,
			},
			{
				setBindingAgent: setBindingAgentToolsId,
				clearError: () => setPlatformAgentsError(null),
				updateAgent: platformApi.updateAgent,
				syncQuickConfiguration: syncAgentQuickConfiguration,
				refreshDependentViews: async () => {
					await refetchPlatformAgents();
					await refetchPlatform();
					await refetchToolCatalog();
					await refetchOpsTasks();
				},
				handleEmptyTemplateTools: () =>
					setPlatformAgentsError(agentManagementRequestText.bindToolsError),
				handleError: (error) =>
					setPlatformAgentsError(
						error instanceof Error
							? error.message
							: agentManagementRequestText.bindToolsError,
					),
			},
		);
	}

	async function handleEnableAgentMemory(agent: EnterprisePublishedAgent) {
		await runAgentCapabilityEnableRequestAction(
			{
				agent,
				capability: 'memory',
			},
			{
				setEnablingAgent: setEnablingAgentMemoryId,
				clearError: () => setPlatformAgentsError(null),
				updateAgent: platformApi.updateAgent,
				syncQuickConfiguration: syncAgentQuickConfiguration,
				refreshDependentViews: async () => {
					await refetchPlatformAgents();
					await refetchPlatform();
					await refetchToolCatalog();
					await refetchOpsTasks();
				},
				handleError: (error) =>
					setPlatformAgentsError(
						error instanceof Error
							? error.message
							: agentManagementRequestText.enableMemoryError,
					),
			},
		);
	}

	async function handleEnableAgentWorkflow(agent: EnterprisePublishedAgent) {
		await runAgentCapabilityEnableRequestAction(
			{
				agent,
				capability: 'workflow',
			},
			{
				setEnablingAgent: setEnablingAgentWorkflowId,
				clearError: () => setPlatformAgentsError(null),
				updateAgent: platformApi.updateAgent,
				syncQuickConfiguration: syncAgentQuickConfiguration,
				refreshDependentViews: async () => {
					await refetchPlatformAgents();
					await refetchPlatform();
					await refetchToolCatalog();
					await refetchOpsTasks();
				},
				handleError: (error) =>
					setPlatformAgentsError(
						error instanceof Error
							? error.message
							: agentManagementRequestText.enableWorkflowError,
					),
			},
		);
	}

	async function runEnterpriseAgent(options?: {
		agentId?: string;
		question?: string;
		userId?: string;
		approvalId?: string;
	}) {
		await runEnterpriseAgentRequestAction(
			{
				options,
				selectedRunAgentId,
				agentQuestion,
				selectedIdentityUserId,
				agentApprovalId,
				activeAgents: activePlatformAgents,
				selectedRunAgent,
				enterpriseIdentities,
				selectedIdentity,
			},
			{
				setRunning: setRunningAgent,
				clearError: () => setAgentRunError(null),
				setAccessDeniedError: () =>
					setAgentRunError(agentRunnerRequestText.accessDenied),
				runAgent: platformApi.runAgent,
				setResult: setAgentRunResult,
				setAgentConversations,
				setApprovalRequiredError: () =>
					setAgentRunError(agentRunnerRequestText.approvalRequiredCreated),
				refreshApprovals: refetchApprovals,
				refreshAgentRuns: (agentId, userId) =>
					refetchAgentRuns(agentId, userId || username),
				refreshDependentViews: async () => {
					await refetchPlatform();
					await refetchToolCatalog();
					await refetchAuditEvents();
					await refetchOpsTasks();
				},
				setError: setAgentRunError,
				now: () => new Date().toISOString(),
				fallbackId: (agentId) => `${agentId}-${Date.now()}`,
			},
		);
	}

	async function handleRunEnterpriseAgent() {
		await runEnterpriseAgent();
	}

	async function runEnterpriseTool(options?: {
		toolName?: string;
		inputs?: Record<string, unknown>;
		userId?: string;
		agentId?: string;
		approvalId?: string;
	}) {
		await runEnterpriseToolRequestAction(
			{
				options,
				selectedToolName,
				selectedToolInputKey,
				selectedToolInputValue,
				selectedIdentityUserId,
				selectedRunAgentId,
				toolApprovalId,
			},
			{
				setRunning: setRunningTool,
				clearError: () => setToolRunError(null),
				runTool: platformApi.runTool,
				setResult: setToolRunResult,
				refreshDependentViews: async () => {
					await refetchPlatform();
					await refetchToolCatalog();
					await refetchAuditEvents();
					await refetchOpsTasks();
				},
				createApproval: (message) => handleCreateRunApproval('tool_run', message),
				setApprovalRequiredError: () =>
					setToolRunError(toolRunnerRequestText.approvalRequiredCreated),
				setError: setToolRunError,
			},
		);
	}

	async function handleRunEnterpriseTool() {
		await runEnterpriseTool();
	}

	async function runEnterpriseWorkflow(options?: {
		workflowType?: string;
		inputs?: Record<string, unknown>;
		userId?: string;
		agentId?: string;
		approvalId?: string;
	}) {
		await runEnterpriseWorkflowRequestAction(
			{
				options,
				selectedWorkflowType,
				workflowInputs,
				selectedIdentityUserId,
				selectedRunAgentId,
				workflowApprovalId,
			},
			{
				setRunning: setRunningWorkflow,
				clearError: () => setWorkflowRunError(null),
				runWorkflow: platformApi.runWorkflow,
				setResult: setWorkflowRunResult,
				refreshDependentViews: async () => {
					await refetchPlatform();
					await refetchToolCatalog();
					await refetchAuditEvents();
					await refetchWorkflowRuns();
					await refetchScenarios();
					await refetchOpsTasks();
				},
				createApproval: (message) =>
					handleCreateRunApproval('workflow_run', message),
				setApprovalRequiredError: () =>
					setWorkflowRunError(workflowRunnerRequestText.approvalRequiredCreated),
				setError: setWorkflowRunError,
			},
		);
	}

	async function handleRunEnterpriseWorkflow() {
		await runEnterpriseWorkflow();
	}

	async function handleRunScenario(scenario: EnterprisePlatformScenario) {
		await runScenarioWorkflowRequestAction(
			{
				scenario,
				workflowTemplates,
				currentInputs: workflowInputs,
			},
			{
				setWorkflowType: setSelectedWorkflowType,
				setWorkflowInputs,
				scheduleWorkflowRunnerFocus: () =>
					window.setTimeout(scrollToWorkflowRunner, 0),
				runWorkflow: runEnterpriseWorkflow,
			},
		);
	}

	const platformNavigationHandlers = {
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
	};
	const capabilities = platformCapabilityItemsDisplayStateForStatus({
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
	});

	const launchpadDisplay = platformLaunchpadDisplayStateForStatus(
		{
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
		{
			icons: launchpadStepIcons,
			navigationActions: launchpadNavigationActions(platformNavigationHandlers),
			fallbackAction: scrollToGovernance,
			labels: launchpadStepLabels(t),
		},
	);
	const {
		activeMemberCount,
		primaryStep: launchpadPrimaryStep,
		readyCount: launchpadReadyCount,
		state: launchpadState,
		steps: launchpadSteps,
		totalCount: launchpadTotalCount,
	} = launchpadDisplay;

	const platformConsoleItems = platformWorkbenchConsoleItemsDisplayState({
		icons: platformConsoleIcons,
		actions: platformConsoleNavigationActions(platformNavigationHandlers),
		labels: platformConsoleItemLabels(t),
	});
	const workbenchDisplay = platformWorkbenchDisplayStateForStatus(
		{
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
		{
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
	);
	const {
		actions: workbenchActions,
		indicators: workbenchIndicators,
		quickActions: workbenchQuickActions,
		readinessItems: workbenchReadinessItems,
		riskItems: workbenchRiskItems,
	} = workbenchDisplay;
	const onboardingDisplay = platformOnboardingDisplayStateForStatus(
		{
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
		{
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
	);
	const {
		firstAgentGuidePrimaryStep,
		firstAgentGuideSteps,
		rolloutPathSteps,
	} = onboardingDisplay;
	const orchestrationDisplay = platformOrchestrationDisplayStateForStatus(
		{
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
		{
			icons: orchestrationWorkbenchIcons,
			actions: orchestrationWorkbenchNavigationActions(platformNavigationHandlers, {
				handleNextAgentSetupStep,
				hasKnowledgeBases: knowledgeBases.length > 0,
				hasSelectedRunAgent: Boolean(selectedRunAgent),
			}),
			labels: orchestrationWorkbenchStepLabels(t),
		},
	);
	const {
		primaryStep: orchestrationPrimaryStep,
		readyCount: orchestrationReadyCount,
		steps: orchestrationWorkbenchSteps,
	} = orchestrationDisplay;
	const monitoringDisplay = platformMonitoringDisplayStateForStatus(
		{
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
		{
			icons: monitoringStatIcons,
			labels: monitoringStatLabels(t),
		},
	);
	const {
		activitySummary: monitoringActivitySummary,
		loading: monitoringLoading,
		stats: monitoringStats,
	} = monitoringDisplay;

	if (view === 'tenants') {
		return (
			<TenantsViewPage
				platformMemberTenantSummaries={platformMemberTenantSummaries}
				platformMembersLoading={platformMembersLoading}
				platformMembersLoaded={Boolean(platformMembers)}
				platformMembersError={platformMembersError}
				connectorsLoading={connectorsLoading}
				connectorsError={connectorsError}
				tenantWorkspaces={tenantWorkspaces}
				enterpriseIdentities={enterpriseIdentities}
				activeMemberCount={activeMemberCount}
				roleCount={platformMembers?.roles.length ?? 0}
				activePlatformAgentCount={activePlatformAgents.length}
				pendingApprovalCount={pendingApprovals.length}
				onRefreshMembers={() => void refetchMembers()}
				onRefreshConnectors={() => void refetchConnectors()}
				onNavigate={navigate}
				t={t}
			/>
		);
	}
	if (view === 'memory') {
		return (
			<MemoryViewPage
				memoryOperationsItems={memoryOperationsItems}
				memoryOperationsRunCount={memoryOperationsRunCount}
				memoryOperationsHitCount={memoryOperationsHitCount}
				memoryOperationsSavedCount={memoryOperationsSavedCount}
				onNavigate={navigate}
				t={t}
			/>
		);
	}

	if (view === 'settings') {
		return (
			<SettingsViewPage
				platformLoading={platformLoading}
				platformError={platformError}
				platformConfigExport={platformConfigExport}
				platformConfigLoading={platformConfigLoading}
				platformConfigError={platformConfigError}
				platformConfigImportResult={platformConfigImportResult}
				platformConfigImportMode={platformConfigImportMode}
				platformConfigImportText={platformConfigImportText}
				importingPlatformConfig={importingPlatformConfig}
				serverUrl={serverUrl}
				username={username}
				hasErrors={hasErrors}
				runtimeItems={runtimeItems}
				onRefreshPlatform={() => void refetchPlatform()}
				onRefetchPlatformConfigExport={refetchPlatformConfigExport}
				onCopyPlatformConfig={handleCopyPlatformConfig}
				onImportPlatformConfig={handleImportPlatformConfig}
				onPlatformConfigImportModeChange={setPlatformConfigImportMode}
				onPlatformConfigImportTextChange={setPlatformConfigImportText}
				t={t}
			/>
		);
	}

	if (view === 'tools') {
		return (
			<ToolsViewPage
				serverUrl={serverUrl}
				username={username}
				hasErrors={hasErrors}
				configManagementRef={configManagementRef}
				toolRunnerRef={toolRunnerRef}
				availableToolItems={availableToolItems}
				publishedPlatformAgents={publishedPlatformAgents}
				toolCatalogLoading={toolCatalogLoading}
				toolCatalogError={toolCatalogError}
				selectedToolName={selectedToolName}
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
				onRefetchToolCatalog={refetchToolCatalog}
				onSelectedToolNameChange={setSelectedToolName}
				onToolRunErrorChange={setToolRunError}
				onToolInputsChange={setToolInputs}
				onToolApprovalIdChange={setToolApprovalId}
				onCreateRunApproval={handleCreateRunApproval}
				onRunEnterpriseTool={handleRunEnterpriseTool}
				t={t}
			/>
		);
	}
	if (view === 'approvals') {
		return (
			<ApprovalsViewPage
				serverUrl={serverUrl}
				username={username}
				hasErrors={hasErrors}
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
				currentTenant={platformStatus?.current_user.tenant}
				currentUserId={platformStatus?.current_user.user_id}
				toolInputConfig={enterpriseToolInputConfig}
				onCreateApproval={handleCreateApproval}
				onRefetchApprovals={refetchApprovals}
				onApproveAndRun={handleApproveAndRun}
				onDecideApproval={handleDecideApproval}
				onUseApproval={handleUseApproval}
				summarizeAuditObject={platformSummarizeAuditObject}
				t={t}
			/>
		);
	}
	if (view === 'runs') {
		return (
			<RunsViewPage
				monitoringHealthState={monitoringActivitySummary.healthState}
				monitoringLoading={monitoringLoading}
				monitoringStats={monitoringStats}
				recentAgentTurns={monitoringActivitySummary.recentAgentTurns}
				recentWorkflowRuns={recentWorkflowRuns}
				recentAuditEvents={recentAuditEvents}
				auditFilters={auditFilters}
				auditLoading={auditLoading}
				auditError={auditError}
				auditEvents={auditEvents}
				auditStats={auditStats}
				activePlatformAgents={activePlatformAgents}
				availableToolItems={availableToolItems}
				currentTenant={platformStatus?.current_user.tenant}
				currentUserId={platformStatus?.current_user.user_id}
				username={username}
				onRefreshMonitoring={async () => {
					await Promise.all([
						refetchPlatform(),
						refetchAgentRuns(),
						refetchWorkflowRuns(),
						refetchAuditEvents(),
						refetchApprovals(),
						refetchGovernance(),
					]);
				}}
				onSelectAgentTurn={(turn) => {
					setSelectedRunAgentId(turn.agentId);
					setAgentRunResult(turn.response);
					navigate('/platform/agents');
				}}
				onRunAgent={() => navigate('/platform/agents')}
				onRunWorkflow={() => navigate('/platform/workflows')}
				onOpenGovernance={() => navigate('/platform/approvals')}
				onAuditFiltersChange={setAuditFilters}
				onRefetchAuditEvents={refetchAuditEvents}
				summarizeAuditObject={platformSummarizeAuditObject}
				t={t}
			/>
		);
	}
	if (view === 'workflows') {
		return (
			<WorkflowsViewPage
				serverUrl={serverUrl}
				username={username}
				hasErrors={hasErrors}
				workflowRunnerRef={workflowRunnerRef}
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
					setWorkflowInputs(
						workflowInputsForSelectedOption(workflowOptions, value),
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
				summarizeAuditObject={platformSummarizeAuditObject}
				t={t}
			/>
		);
	}

	if (view === 'agents') {
		return (
			<AgentsViewPage
				t={t}
				platformAgentsError={platformAgentsError}
				platformAgentsLoading={platformAgentsLoading}
				platformAgents={platformAgents}
				agentManagementRef={agentManagementRef}
				agentTemplateStepRef={agentTemplateStepRef}
				agentRunnerRef={agentRunnerRef}
				agentOpsSummary={agentOpsSummary}
				agentReleasePipeline={agentReleasePipeline}
				nextAgentSetupStep={nextAgentSetupStep}
				selectedRunAgent={selectedRunAgent}
				selectedRunAgentReadinessState={selectedRunAgentReadinessState}
				selectedRunAgentReadinessLabel={selectedRunAgentReadinessLabel}
				selectedRunAgentModelLabel={selectedRunAgentModelLabel}
				selectedRunAgentKnowledgeCount={selectedRunAgentKnowledgeCount}
				selectedRunAgentKnowledgeLabels={selectedRunAgentKnowledgeLabels}
				selectedRunAgentToolCount={selectedRunAgentToolCount}
				selectedRunAgentAccessAllowed={selectedRunAgentAccessAllowed}
				selectedRunAgentAccessLabel={selectedRunAgentAccessLabel}
				agentTemplates={agentTemplates}
				selectedTemplateId={selectedTemplateId}
				publishingTemplateId={publishingTemplateId}
				activePlatformAgents={activePlatformAgents}
				selectedRunAgentId={selectedRunAgentId}
				agentQuestion={agentQuestion}
				agentApprovalId={agentApprovalId}
				agentSampleQuestions={agentSampleQuestions}
				selectedAgentConversation={selectedAgentConversation}
				agentRunResult={agentRunResult}
				agentRunsLoading={agentRunsLoading}
				agentRunsError={agentRunsError}
				runningAgent={runningAgent}
				agentRunError={agentRunError}
				agentToolCalls={agentToolCalls}
				agentToolCallBadgeText={agentToolCallBadgeText}
				agentRoutingLabel={agentRoutingLabel}
				agentRoutingText={agentRoutingText}
				agentRunConnectorSourceText={agentRunConnectorSourceText}
				agentRunModelLabel={agentRunModelLabel}
				agentRunKnowledgeLabels={agentRunKnowledgeLabels}
				knowledgeBaseById={knowledgeBaseById}
				refetchPlatformAgents={refetchPlatformAgents}
				scrollToAgentRunner={scrollToAgentRunner}
				handleNextAgentSetupStep={handleNextAgentSetupStep}
				handlePrimeAgentWorkflow={handlePrimeAgentWorkflow}
				handleEditAgent={handleEditAgent}
				scrollToGovernance={scrollToGovernance}
				handleConfigureTemplate={handleConfigureTemplate}
				handleSelectRunAgent={handleSelectRunAgent}
				setAgentQuestion={setAgentQuestion}
				setAgentRunError={setAgentRunError}
				setAgentApprovalId={setAgentApprovalId}
				handleClearAgentConversation={handleClearAgentConversation}
				handleSelectAgentRun={handleSelectAgentRun}
				handleRunEnterpriseAgent={handleRunEnterpriseAgent}
				handleInspectAgentRunAudit={handleInspectAgentRunAudit}
			/>
		);
	}
	return (
		<DashboardViewPage
			accessControlStats={accessControlStats}
			accessTenantSummaries={accessTenantSummaries}
			activeConnectorTenant={activeConnectorTenant}
			activeMemberCount={activeMemberCount}
			activePlatformAgents={activePlatformAgents}
			activeSavedConnectorConfig={activeSavedConnectorConfig}
			agentAccessAllowed={platformAgentAccessAllowedForDisplay}
			agentApprovalId={agentApprovalId}
			agentKnowledgeStepRef={agentKnowledgeStepRef}
			agentManagementRef={agentManagementRef}
			agentModelStepRef={agentModelStepRef}
			agentOpsSummary={agentOpsSummary}
			agentQuestion={agentQuestion}
			agentReleasePipeline={agentReleasePipeline}
			agentResourceText={agentResourceText}
			agentRoutingLabel={agentRoutingLabel}
			agentRoutingText={agentRoutingText}
			agentRunConnectorSourceText={agentRunConnectorSourceText}
			agentRunError={agentRunError}
			agentRunKnowledgeLabels={agentRunKnowledgeLabels}
			agentRunModelLabel={agentRunModelLabel}
			agentRunResult={agentRunResult}
			agentRunnerRef={agentRunnerRef}
			agentRunsError={agentRunsError}
			agentRunsLoading={agentRunsLoading}
			agents={agents}
			agentRuntimeStepRef={agentRuntimeStepRef}
			agentSampleQuestions={agentSampleQuestions}
			agentSetupSteps={agentSetupSteps}
			agentTemplateStepRef={agentTemplateStepRef}
			agentTemplates={agentTemplates}
			agentToolCallBadgeText={agentToolCallBadgeText}
			agentToolCalls={agentToolCalls}
			agentToolsStepRef={agentToolsStepRef}
			agentsLoading={agentsLoading}
			appCenterAgents={appCenterAgents}
			appCenterDetailIssues={appCenterDetailIssues}
			appCenterDetailResources={appCenterDetailResources}
			appCenterDetailStatus={appCenterDetailStatus}
			appCenterPrimaryDisabled={appCenterPrimaryDisabled}
			approvalError={approvalError}
			approvalFilters={approvalFilters}
			approvalForm={approvalForm}
			approvalLoading={approvalLoading}
			approvalRequests={approvalRequests}
			approvalSummary={approvalSummary}
			approvedApprovalCount={approvedApprovalCount}
			archivingAgentId={archivingAgentId}
			auditError={auditError}
			auditEventCount={auditEventCount}
			auditEvents={auditEvents}
			auditFilters={auditFilters}
			auditLoading={auditLoading}
			auditStats={auditStats}
			availableToolItems={availableToolItems}
			bindingAgentKnowledgeId={bindingAgentKnowledgeId}
			bindingAgentModelId={bindingAgentModelId}
			bindingAgentToolsId={bindingAgentToolsId}
			blockedOrPartialPlatformAgents={blockedOrPartialPlatformAgents}
			capabilities={capabilities}
			completedWorkflowRunCount={completedWorkflowRunCount}
			configManagementRef={configManagementRef}
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
			continuingApprovalId={continuingApprovalId}
			creatingApproval={creatingApproval}
			creatingRunApproval={creatingRunApproval}
			credentialById={credentialById}
			credentials={credentials}
			credentialsLoading={credentialsLoading}
			currentIdentityLabel={currentIdentityLabel}
			dashboardOperations={dashboardOperations}
			dashboardTodoItems={dashboardTodoItems}
			decidingApprovalId={decidingApprovalId}
			defaultAgentTemplate={defaultAgentTemplate}
			editingAgentId={editingAgentId}
			enablingAgentMemoryId={enablingAgentMemoryId}
			enablingAgentWorkflowId={enablingAgentWorkflowId}
			enterpriseIdentities={enterpriseIdentities}
			enterpriseToolInputConfig={enterpriseToolInputConfig}
			failedWorkflowRunCount={failedWorkflowRunCount}
			featuredAgents={featuredAgents}
			firstAgentGuidePrimaryStep={firstAgentGuidePrimaryStep}
			firstAgentGuideSteps={firstAgentGuideSteps}
			governance={governance}
			governanceError={governanceError}
			governanceHealthItems={governanceHealthItems}
			governanceLoading={governanceLoading}
			governanceRef={governanceRef}
			governedWorkflowItems={governedWorkflowItems}
			handleAppCenterDetailPrimaryAction={handleAppCenterDetailPrimaryAction}
			handleAppCenterDetailSecondaryAction={handleAppCenterDetailSecondaryAction}
			handleAppCenterPrimaryAction={handleAppCenterPrimaryAction}
			handleApproveAndRun={handleApproveAndRun}
			handleArchiveAgent={handleArchiveAgent}
			handleBindAvailableKnowledge={handleBindAvailableKnowledge}
			handleBindDefaultModel={handleBindDefaultModel}
			handleBindTemplateTools={handleBindTemplateTools}
			handleCancelEdit={handleCancelEdit}
			handleClearAgentConversation={handleClearAgentConversation}
			handleConfigureTemplate={handleConfigureTemplate}
			handleCopyPlatformConfig={handleCopyPlatformConfig}
			handleCreateApproval={handleCreateApproval}
			handleCreateRunApproval={handleCreateRunApproval}
			handleDecideApproval={handleDecideApproval}
			handleEditAgent={handleEditAgent}
			handleEditMember={handleEditMember}
			handleEnableAgentMemory={handleEnableAgentMemory}
			handleEnableAgentWorkflow={handleEnableAgentWorkflow}
			handleImportPlatformConfig={handleImportPlatformConfig}
			handleInspectAgentRunAudit={handleInspectAgentRunAudit}
			handleInspectIdentityApprovals={handleInspectIdentityApprovals}
			handleInspectIdentityAudit={handleInspectIdentityAudit}
			handleInspectIdentityFailures={handleInspectIdentityFailures}
			handleInspectMemoryOperationAudit={handleInspectMemoryOperationAudit}
			handleInspectTenantApprovals={handleInspectTenantApprovals}
			handleInspectTenantAudit={handleInspectTenantAudit}
			handleNextAgentSetupStep={handleNextAgentSetupStep}
			handleNextStepPrimaryAction={handleNextStepPrimaryAction}
			handleOpenMemoryOperation={handleOpenMemoryOperation}
			handleOperationAction={handleOperationAction}
			handlePrepareTenantAgent={handlePrepareTenantAgent}
			handlePrimeAgentRunner={handlePrimeAgentRunner}
			handlePrimeAgentWorkflow={handlePrimeAgentWorkflow}
			handlePrimePublishedAgent={handlePrimePublishedAgent}
			handlePrimeToolApproval={handlePrimeToolApproval}
			handlePublishAgent={handlePublishAgent}
			handlePublishTenantChange={handlePublishTenantChange}
			handleQuickPublishAgent={handleQuickPublishAgent}
			handleResolveOpsTask={handleResolveOpsTask}
			handleRunEnterpriseAgent={handleRunEnterpriseAgent}
			handleRunEnterpriseTool={handleRunEnterpriseTool}
			handleRunEnterpriseWorkflow={handleRunEnterpriseWorkflow}
			handleRunScenario={handleRunScenario}
			handleSaveConnectorConfig={handleSaveConnectorConfig}
			handleSaveMember={handleSaveMember}
			handleSaveToolPolicy={handleSaveToolPolicy}
			handleSelectAgentRun={handleSelectAgentRun}
			handleSelectRunAgent={handleSelectRunAgent}
			handleStartPublishing={handleStartPublishing}
			handleTestAndSaveConnectorConfig={handleTestAndSaveConnectorConfig}
			handleTestConnector={handleTestConnector}
			handleToggleMemberStatus={handleToggleMemberStatus}
			handleTogglePublishList={handleTogglePublishList}
			handleToggleWorkflowTemplate={handleToggleWorkflowTemplate}
			handleUseApproval={handleUseApproval}
			handleUseIdentity={handleUseIdentity}
			handleUseTenant={handleUseTenant}
			hasErrors={hasErrors}
			identityAccessRows={identityAccessRows}
			importingPlatformConfig={importingPlatformConfig}
			inspectedAppCenterAgent={inspectedAppCenterAgent}
			inspectedAppCenterTemplate={inspectedAppCenterTemplate}
			knowledgeBaseById={knowledgeBaseById}
			knowledgeBases={knowledgeBases}
			lastPublishedAgent={lastPublishedAgent}
			launchpadPrimaryStep={launchpadPrimaryStep}
			launchpadReadyCount={launchpadReadyCount}
			launchpadState={launchpadState}
			launchpadSteps={launchpadSteps}
			launchpadTotalCount={launchpadTotalCount}
			loadSavedConnectorConfig={loadSavedConnectorConfig}
			memberForm={memberForm}
			membersRef={membersRef}
			memoryOperationsHitCount={memoryOperationsHitCount}
			memoryOperationsItems={memoryOperationsItems}
			memoryOperationsRef={memoryOperationsRef}
			memoryOperationsRunCount={memoryOperationsRunCount}
			memoryOperationsSavedCount={memoryOperationsSavedCount}
			monitoringHealthState={monitoringActivitySummary.healthState}
			monitoringLoading={monitoringLoading}
			monitoringStats={monitoringStats}
			nextAgentSetupStep={nextAgentSetupStep}
			nextStepMode={nextStepMode}
			nextStepPrimaryDisabled={nextStepPrimaryDisabled}
			operationsAgentIssueText={operationsAgentIssueText}
			operationsHeadline={operationsHeadline}
			opsTasks={opsTasks}
			opsTasksError={opsTasksError}
			opsTasksLoading={opsTasksLoading}
			opsTasksSummary={opsTasksSummary}
			orchestrationPrimaryStep={orchestrationPrimaryStep}
			orchestrationReadyCount={orchestrationReadyCount}
			orchestrationWorkbenchSteps={orchestrationWorkbenchSteps}
			partialWorkflowRunCount={partialWorkflowRunCount}
			pendingApprovals={pendingApprovals}
			platformAgents={platformAgents}
			platformAgentsError={platformAgentsError}
			platformAgentsLoading={platformAgentsLoading}
			platformConfigError={platformConfigError}
			platformConfigExport={platformConfigExport}
			platformConfigImportMode={platformConfigImportMode}
			platformConfigImportResult={platformConfigImportResult}
			platformConfigImportText={platformConfigImportText}
			platformConfigLoading={platformConfigLoading}
			platformConsoleItems={platformConsoleItems}
			platformError={platformError}
			platformLoading={platformLoading}
			platformMemberTenantSummaries={platformMemberTenantSummaries}
			platformMembers={platformMembers}
			platformMembersError={platformMembersError}
			platformMembersLoading={platformMembersLoading}
			platformStatus={platformStatus}
			policyDecisions={policyDecisions}
			primaryAgentSampleQuestion={primaryAgentSampleQuestion}
			publishAccessMembers={publishAccessMembers}
			publishAccessScopeSummary={publishAccessScopeSummary}
			publishBlocked={publishBlocked}
			publishForm={publishForm}
			publishReleaseIssues={publishReleaseIssues}
			publishRoleOptions={publishRoleOptions}
			publishRuntimeSummary={publishRuntimeSummary}
			publishSelectedModelLabel={publishSelectedModelLabel}
			publishTenant={publishTenant}
			publishedPlatformAgents={publishedPlatformAgents}
			publishingTemplateId={publishingTemplateId}
			readyPlatformAgents={readyPlatformAgents}
			recentAgentTurns={monitoringActivitySummary.recentAgentTurns}
			recentAuditEvents={recentAuditEvents}
			recentSchedules={recentSchedules}
			recentWorkflowRuns={recentWorkflowRuns}
			recommendedOperationActions={recommendedOperationActions}
			refetchAgentRuns={refetchAgentRuns}
			refetchApprovals={refetchApprovals}
			refetchAuditEvents={refetchAuditEvents}
			refetchConnectors={refetchConnectors}
			refetchGovernance={refetchGovernance}
			refetchMembers={refetchMembers}
			refetchOpsTasks={refetchOpsTasks}
			refetchPlatform={refetchPlatform}
			refetchPlatformAgents={refetchPlatformAgents}
			refetchPlatformConfigExport={refetchPlatformConfigExport}
			refetchScenarios={refetchScenarios}
			refetchToolCatalog={refetchToolCatalog}
			refetchWorkflowRuns={refetchWorkflowRuns}
			resolvingOpsTaskCode={resolvingOpsTaskCode}
			riskToolItems={riskToolItems}
			rolloutPathSteps={rolloutPathSteps}
			runningAgent={runningAgent}
			runningTool={runningTool}
			runningWorkflow={runningWorkflow}
			runtimeItems={runtimeItems}
			savedConnectorConfigs={savedConnectorConfigs}
			savingConnectorConfig={savingConnectorConfig}
			savingMember={savingMember}
			savingToolPolicy={savingToolPolicy}
			savingWorkflowType={savingWorkflowType}
			scenarios={scenarios}
			scenariosError={scenariosError}
			scenariosLoading={scenariosLoading}
			schedulesError={schedulesError}
			schedulesLoading={schedulesLoading}
			scrollToAgentManagement={scrollToAgentManagement}
			scrollToAgentRunner={scrollToAgentRunner}
			scrollToConnectorCenter={scrollToConnectorCenter}
			scrollToGovernance={scrollToGovernance}
			scrollToToolRunner={scrollToToolRunner}
			scrollToWorkflowRunner={scrollToWorkflowRunner}
			selectedAgentConversation={selectedAgentConversation}
			selectedIdentity={selectedIdentity}
			selectedIdentityAllowedTools={selectedIdentityAllowedTools}
			selectedIdentityDeniedTools={selectedIdentityDeniedTools}
			selectedIdentityFailedAuditEvents={selectedIdentityFailedAuditEvents}
			selectedIdentityPendingApprovals={selectedIdentityPendingApprovals}
			selectedIdentityPendingToolNames={selectedIdentityPendingToolNames}
			selectedIdentityRecentAuditEvents={selectedIdentityRecentAuditEvents}
			selectedIdentityUserId={selectedIdentityUserId}
			selectedIdentityWorkspace={selectedIdentityWorkspace}
			selectedRunAgent={selectedRunAgent}
			selectedRunAgentAccessAllowed={selectedRunAgentAccessAllowed}
			selectedRunAgentAccessLabel={selectedRunAgentAccessLabel}
			selectedRunAgentId={selectedRunAgentId}
			selectedRunAgentKnowledgeCount={selectedRunAgentKnowledgeCount}
			selectedRunAgentKnowledgeLabels={selectedRunAgentKnowledgeLabels}
			selectedRunAgentModelLabel={selectedRunAgentModelLabel}
			selectedRunAgentReadinessLabel={selectedRunAgentReadinessLabel}
			selectedRunAgentReadinessState={selectedRunAgentReadinessState}
			selectedRunAgentToolCount={selectedRunAgentToolCount}
			selectedTemplate={selectedTemplate}
			selectedTemplateId={selectedTemplateId}
			selectedToolAllowed={selectedToolAllowed}
			selectedToolCatalogItem={selectedToolCatalogItem}
			selectedToolConfig={selectedToolConfig}
			selectedToolDecision={selectedToolDecision}
			selectedToolInputKey={selectedToolInputKey}
			selectedToolInputValue={selectedToolInputValue}
			selectedToolName={selectedToolName}
			selectedToolReason={selectedToolReason}
			selectedWorkflowDisabled={selectedWorkflowDisabled}
			selectedWorkflowLastRun={selectedWorkflowLastRun}
			selectedWorkflowName={selectedWorkflowName}
			selectedWorkflowSteps={selectedWorkflowSteps}
			selectedWorkflowTemplate={selectedWorkflowTemplate}
			selectedWorkflowType={selectedWorkflowType}
			serverUrl={serverUrl}
			setAgentApprovalId={setAgentApprovalId}
			setAgentQuestion={setAgentQuestion}
			setAgentRunError={setAgentRunError}
			setAgentRunResult={setAgentRunResult}
			setApprovalFilters={setApprovalFilters}
			setApprovalForm={setApprovalForm}
			setAuditFilters={setAuditFilters}
			setConnectorTestForm={setConnectorTestForm}
			setMemberForm={setMemberForm}
			setPlatformConfigImportMode={setPlatformConfigImportMode}
			setPlatformConfigImportText={setPlatformConfigImportText}
			setPublishForm={setPublishForm}
			setSelectedAppCenterItem={setSelectedAppCenterItem}
			setSelectedIdentityUserId={setSelectedIdentityUserId}
			setSelectedRunAgentId={setSelectedRunAgentId}
			setSelectedToolName={setSelectedToolName}
			setSelectedWorkflowType={setSelectedWorkflowType}
			setToolApprovalId={setToolApprovalId}
			setToolInputs={setToolInputs}
			setToolPolicyDraft={setToolPolicyDraft}
			setToolPolicySaveError={setToolPolicySaveError}
			setToolPolicySaveSuccess={setToolPolicySaveSuccess}
			setToolRunError={setToolRunError}
			setWorkflowApprovalId={setWorkflowApprovalId}
			setWorkflowInputs={setWorkflowInputs}
			setWorkflowRunError={setWorkflowRunError}
			stats={stats}
			subagentTemplates={subagentTemplates}
			summarizeAuditObject={platformSummarizeAuditObject}
			t={t}
			tenantOverviewItems={tenantOverviewItems}
			tenantWorkspaces={tenantWorkspaces}
			testingConnector={testingConnector}
			toolApprovalId={toolApprovalId}
			toolCatalogError={toolCatalogError}
			toolCatalogLoading={toolCatalogLoading}
			toolPolicyDraft={toolPolicyDraft}
			toolPolicyMode={toolPolicyMode}
			toolPolicySaveError={toolPolicySaveError}
			toolPolicySaveSuccess={toolPolicySaveSuccess}
			toolPolicySummary={toolPolicySummary}
			toolRunError={toolRunError}
			toolRunResult={toolRunResult}
			toolRunnerRef={toolRunnerRef}
			topOperationsAgents={topOperationsAgents}
			triggerOpsStats={triggerOpsStats}
			triggerOpsSummary={triggerOpsSummary}
			updatingMemberId={updatingMemberId}
			username={username}
			workbenchActions={workbenchActions}
			workbenchIndicators={workbenchIndicators}
			workbenchQuickActions={workbenchQuickActions}
			workbenchReadinessItems={workbenchReadinessItems}
			workbenchRiskItems={workbenchRiskItems}
			workflowApprovalId={workflowApprovalId}
			workflowInputs={workflowInputs}
			workflowOpsStats={workflowOpsStats}
			workflowOptions={workflowOptions}
			workflowPendingApprovals={workflowPendingApprovals}
			workflowRunCount={workflowRunCount}
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
	);
}
