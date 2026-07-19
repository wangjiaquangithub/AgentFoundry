import type { ComponentType } from 'react';
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
import { appCenterDetailResourcesForSelection } from './app-center-detail-resources';
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
import type { HealthState } from './components/common';
import { DashboardViewPage } from './components/DashboardViewPage';
import { usePlatformPageRefs } from './platform-page-refs';
import {
	agentWorkflowPrimeInputs,
	agentConversationTurnFromRunResponse,
	clearAgentRunsParams,
	enterpriseAgentRunPayload,
	enterpriseToolRunPayload,
	enterpriseWorkflowRunPayload,
	latestAgentRunResponse,
	mergeAgentConversationTurn,
	scenarioWorkflowRunTarget,
	selectedToolInputs,
	type AgentConversationMap,
} from './platform-agent-runner';
import {
	approvalContinuationState,
	approvalCreatePayloadFromForm,
	approvalCreatePayloadFromRun,
	approvalDecisionPayload,
	approvalAgentContinuationTarget,
	approvalAgentQuestionFromInputs,
	approvalInputForTool,
	approvalQueryFromFilters,
	approvalToolFormPatch,
	approvalToolContinuationTarget,
	approvalToolInputsPatch,
	approvalWorkflowContinuationTarget,
	prependApprovalRequest,
	replaceApprovalRequest,
	type PlatformApprovalRunType,
} from './platform-approval-helpers';
import {
	connectorFormPatchFromSavedConfig,
	connectorFormWithPlatformDefaults,
	connectorSavePayloadFromForm,
	connectorTestPayloadFromForm,
} from './platform-connector-helpers';
import {
	formatPlatformConfigExport,
	parsePlatformConfigImportText,
	platformConfigImportErrorMessage,
	platformConfigImportSuccessMessage,
	platformConfigImportTextForExport,
	platformConfigLoadErrorMessage,
} from './platform-config-management';
import {
	toolPolicyDraftFromDecisions,
	toolPolicyPayloadFromDraft,
} from './platform-tool-policy-helpers';
import {
	memberCreatePayloadFromForm,
	memberFormFromMember,
	memberShouldActivate,
} from './platform-member-helpers';
import {
	approvalFiltersForIdentity,
	approvalFiltersForTenant,
	auditFiltersForAgentRunEvidence,
	auditFiltersForIdentity,
	auditFiltersForMemoryOperation,
	auditFiltersForTenant,
	failedAuditFiltersForIdentity,
} from './platform-filter-builders';
import {
	capabilityNavigationActions,
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
import { runPlatformOperationAction } from './platform-operation-actions';
import {
	agentDefaultModelPatch,
	agentKnowledgeBasesPatch,
	agentMemoryEnabledPatch,
	agentPublishPayloadFromForm,
	agentTemplateToolsPatch,
	agentWorkflowEnabledPatch,
	buildAgentConfigurationPayloadFromForm,
	defaultPublishFormForTemplate,
	publishFormFromPublishedAgent,
	publishFormForListToggle,
	publishFormForPreparedTenant,
	publishFormForTenantChange,
	publishFormWithPatch,
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
import {
	agentAccessAllowed,
	agentRoutingDisplayStateForResult,
	agentRunnerStateForStatus,
	approvalRequiredDetail,
	appCenterDetailHealthState,
	appCenterAgentDisplayStateForStatus,
	activePlatformMemberCountForMembers,
	agentIsReady,
	agentReadinessIssues,
	agentReadinessState,
	agentReleasePipelineForStatus,
	agentSetupStepsForStatus,
	appCenterDetailResourceValuesForSelection,
	appCenterOperationsStateForStatus,
	auditStatsForSummary,
	capabilityItemsForStatus,
	connectorOperationsStateForStatus,
	dashboardFallbackStateForStatus,
	dashboardOperationsStateForStatus,
	dashboardTodoItemsForStatus,
	firstAgentGuidePrimaryStepForSteps,
	firstAgentGuideStepsForStatus,
	governanceOperationsStateForStatus,
	launchpadPrimaryStepForSteps,
	launchpadStateForCounts,
	launchpadStepsForStatus,
	launchpadTargetActionsForNavigation,
	mapAgentRunToConversationTurn,
	memoryOperationsStateForConversations,
	nextAgentSetupStepForSteps,
	normalizeWorkflowInputs,
	monitoringActivitySummaryForStatus,
	monitoringStatsForSummary,
	operationsHeadlineText,
	orchestrationPrimaryStepForSteps,
	orchestrationWorkbenchStepsForStatus,
	publishAccessStateForStatus,
	publishDraftStateForStatus,
	platformDashboardSourceStateForStatus,
	platformOverviewStatsForSummary,
	platformAgentInventoryStateForStatus,
	platformConnectionStateForStatus,
	platformConsoleItemsForDisplay,
	platformResourceLookupStateForStatus,
	platformRuntimeConfigStateForStatus,
	readyLaunchpadStepCountForSteps,
	readyOrchestrationWorkbenchStepCountForSteps,
	rolloutPathStepsForStatus,
	runtimeStatusItemsForStatus,
	selectedIdentityGovernanceDisplayStateForStatus,
	selectedIdentityStateForStatus,
	selectedToolRunnerStateForStatus,
	summarizeAuditObject,
	tenantWorkspaceOperationsStateForStatus,
	toolCatalogStateForStatus,
	triggerOperationsStateForStatus,
	workbenchActionsForStatus,
	workbenchIndicatorsForStatus,
	workbenchQuickActionsForStatus,
	workbenchReadinessItemsForStatus,
	workbenchRiskItemsForStatus,
	workflowSelectionStateForTemplates,
	workflowOperationsStateForStatus,
	type AgentWizardStep,
	type EnterpriseAgentConversationTurn,
} from './platform-utils';
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

	const platformConnectionState = platformConnectionStateForStatus({
		currentUserId: platformStatus?.current_user.user_id,
		storedServerUrl: localStorage.getItem('server_url'),
		storedUsername: localStorage.getItem('username'),
		labels: platformConnectionLabels(t),
	});
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
	const platformAgentInventoryState = platformAgentInventoryStateForStatus({
		agents,
		agentTemplates,
		publishedPlatformAgents,
		selectedRunAgentId,
		lastPublishedAgentId,
		selectedTemplateId,
	});
	const featuredAgents = platformAgentInventoryState.featuredAgents;
	const activePlatformAgents = platformAgentInventoryState.activePlatformAgents;
	const archivedPlatformAgents = platformAgentInventoryState.archivedPlatformAgents;
	const readyPlatformAgents = platformAgentInventoryState.readyPlatformAgents;
	const selectedRunAgent = platformAgentInventoryState.selectedRunAgent;
	const lastPublishedAgent = platformAgentInventoryState.lastPublishedAgent;
	const selectedAgentConversation = agentConversations[selectedRunAgentId] ?? [];
	const selectedTemplate = platformAgentInventoryState.selectedTemplate;
	const defaultAgentTemplate = platformAgentInventoryState.defaultAgentTemplate;
	const platformResourceLookupState = platformResourceLookupStateForStatus({
		credentials,
		knowledgeBases,
	});
	const credentialById = platformResourceLookupState.credentialById;
	const knowledgeBaseById = platformResourceLookupState.knowledgeBaseById;
	const agentSetupSteps: AgentWizardStep[] = agentSetupStepsForStatus(
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
	const nextAgentSetupStep = nextAgentSetupStepForSteps(agentSetupSteps);
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
	} = agentRunnerStateForStatus(
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
	);
	const platformRuntimeConfigState = platformRuntimeConfigStateForStatus({
		platformStatus,
		governance,
		connectors,
		labels: platformRuntimeConfigLabels(t),
	});
	const enterpriseIdentities = platformRuntimeConfigState.enterpriseIdentities;
	const {
		publishTenant,
		publishAccessMembers,
		publishRoleOptions,
	} = publishAccessStateForStatus({
		tenant: publishForm.tenant,
		currentUserTenant: platformStatus?.current_user.tenant,
		members: platformMembers?.members ?? [],
		configuredRoles: platformMembers?.roles ?? [],
		allowedUserIds: publishForm.allowed_user_ids,
		allowedRoles: publishForm.allowed_roles,
	});
	const {
		publishSelectedModelLabel,
		publishAccessScopeSummary,
		publishRuntimeSummary,
		publishReleaseIssues,
		publishBlocked,
	} = publishDraftStateForStatus(
		{
			modelConfigId: publishForm.model_config_id,
			knowledgeBaseCount: publishForm.knowledge_base_ids.length,
			allowedUserCount: publishForm.allowed_user_ids.length,
			allowedRoleCount: publishForm.allowed_roles.length,
			memoryEnabled: publishForm.memory_enabled,
			workflowEnabled: publishForm.workflow_enabled,
			hasSelectedTemplate: Boolean(selectedTemplate),
			credentialById,
		},
		publishDraftLabels(t),
	);
	const selectedIdentityState = selectedIdentityStateForStatus({
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

	const stats = platformOverviewStatsForSummary(
		{
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
		{
			icons: platformOverviewStatIcons,
			labels: platformOverviewStatLabels(t),
		},
	);

	const runtimeItems = runtimeStatusItemsForStatus(
		{
			platformStatus,
			currentIdentityLabel,
		},
		{
			icons: runtimeStatusIcons,
			labels: runtimeStatusLabels(t),
		},
	);

	const subagentTemplates = platformRuntimeConfigState.subagentTemplates;
	const toolPolicyMode = platformRuntimeConfigState.toolPolicyMode;
	const {
		policyDecisions,
		availableToolItems,
	} = toolCatalogStateForStatus({
		platformStatus,
		toolCatalog,
		toolInputConfig: enterpriseToolInputConfig,
	});
	const selectedToolRunnerState = selectedToolRunnerStateForStatus({
		availableToolItems,
		selectedToolName,
		toolInputs,
		toolInputConfig: enterpriseToolInputConfig,
		policyDecisions,
		labels: selectedToolRunnerLabels(t),
	});
	const selectedToolCatalogItem = selectedToolRunnerState.selectedToolCatalogItem;
	const selectedToolConfig = selectedToolRunnerState.selectedToolConfig;
	const selectedToolDecision = selectedToolRunnerState.selectedToolDecision;
	const selectedToolInputKey = selectedToolRunnerState.selectedToolInputKey;
	const selectedToolInputValue = selectedToolRunnerState.selectedToolInputValue;
	const selectedToolAllowed = selectedToolRunnerState.selectedToolAllowed;
	const selectedToolReason = selectedToolRunnerState.selectedToolReason;
	const { agentRoutingLabel, agentRoutingText } = agentRoutingDisplayStateForResult(
		agentRunResult,
		agentRoutingLabels(t),
	);
	const connectorOperationsState = connectorOperationsStateForStatus({
		connectors,
		form: connectorTestForm,
		testResult: connectorTestResult,
		labels: connectorOperationsLabels(t),
	});
	const connectorState = connectorOperationsState.connectorState;
	const savedConnectorConfigs = connectorOperationsState.savedConnectorConfigs;
	const activeConnectorTenant = connectorOperationsState.activeConnectorTenant;
	const activeSavedConnectorConfig = connectorOperationsState.activeSavedConnectorConfig;
	const connectorDraftIssues = connectorOperationsState.connectorDraftIssues;
	const connectorDraftState = connectorOperationsState.connectorDraftState;
	const connectorTestPassed = connectorOperationsState.connectorTestPassed;
	const connectorRuntimeState = connectorOperationsState.connectorRuntimeState;
	const connectorRuntimeSourceText = connectorOperationsState.connectorRuntimeSourceText;
	const workflowSelectionState = workflowSelectionStateForTemplates(
		{ workflowTemplates, selectedWorkflowType },
		workflowSelectionLabels(t),
	);
	const selectedWorkflowTemplate = workflowSelectionState.selectedWorkflowTemplate;
	const workflowOptions = workflowSelectionState.workflowOptions;
	const selectedWorkflowDisabled = workflowSelectionState.selectedWorkflowDisabled;
	const dashboardSourceState = platformDashboardSourceStateForStatus({ platformStatus });
	const dashboard = dashboardSourceState.dashboard;
	const dashboardOperations = dashboardSourceState.dashboardOperations;
	const dashboardRiskTools = dashboardSourceState.dashboardRiskTools;
	const {
		pendingApprovals,
		approvedApprovalCount,
		approvalSummary,
		recentWorkflowRuns,
		workflowRunCount,
		recentAuditEvents,
		auditEventCount,
	} = dashboardFallbackStateForStatus({
		dashboard,
		governance,
		approvalRequests,
		workflowRuns,
		auditEvents,
	});
	const tenantWorkspaceOperationsState = tenantWorkspaceOperationsStateForStatus(
		{
			connectors,
			enterpriseIdentities,
			activePlatformAgents,
			pendingApprovals,
			auditEvents,
			workflowRuns,
			members: platformMembers?.members ?? [],
		},
		tenantWorkspaceOperationsLabels(t),
	);
	const tenantWorkspaces = tenantWorkspaceOperationsState.tenantWorkspaces;
	const tenantOverviewItems = tenantWorkspaceOperationsState.tenantOverviewItems;
	const platformMemberTenantSummaries =
		tenantWorkspaceOperationsState.platformMemberTenantSummaries;
	const memoryOperationsState = memoryOperationsStateForConversations({
		activePlatformAgents,
		agentConversations,
	});
	const memoryOperationsItems = memoryOperationsState.items;
	const memoryOperationsRunCount = memoryOperationsState.runCount;
	const memoryOperationsHitCount = memoryOperationsState.hitCount;
	const memoryOperationsSavedCount = memoryOperationsState.savedCount;
	const dashboardOperationsState = dashboardOperationsStateForStatus({
		dashboardOperations,
		dashboardRiskTools,
		availableToolItems,
	});
	const riskToolItems = dashboardOperationsState.riskToolItems;
	const completedWorkflowRunCount = dashboardOperationsState.completedWorkflowRunCount;
	const partialWorkflowRunCount = dashboardOperationsState.partialWorkflowRunCount;
	const failedWorkflowRunCount = dashboardOperationsState.failedWorkflowRunCount;
	const governedWorkflowItems = dashboardOperationsState.governedWorkflowItems;
	const recommendedOperationActions = dashboardOperationsState.recommendedOperationActions;
	const dashboardTodoItems = dashboardTodoItemsForStatus(
		{
			credentialCount: credentials.length,
			activeAgentCount: activePlatformAgents.length,
			readyAgentCount: readyPlatformAgents.length,
			pendingApprovalCount: pendingApprovals.length,
			hasErrors,
		},
		dashboardTodoLabels(t),
	);
	const appCenterOperationsState = appCenterOperationsStateForStatus({
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
	});
	const blockedOrPartialPlatformAgents = appCenterOperationsState.blockedOrPartialAgents;
	const appCenterAgents = appCenterOperationsState.appCenterAgents;
	const inspectedAppCenterAgent = appCenterOperationsState.inspectedAgent;
	const inspectedAppCenterTemplate = appCenterOperationsState.inspectedTemplate;
	const appCenterPrimaryDisabled = appCenterOperationsState.primaryDisabled;
	const agentOpsSummary = appCenterOperationsState.agentOpsSummary;
	const topOperationsAgents = appCenterOperationsState.topOperationsAgents;
	const { operationsAgentIssueText, agentResourceText } = appCenterAgentDisplayStateForStatus({
		credentialById,
		labels: appCenterAgentDisplayLabels(t),
	});
	const inspectedAppCenterAgentReadiness = agentReadinessState(inspectedAppCenterAgent);
	const inspectedAppCenterAgentIssues = agentReadinessIssues(inspectedAppCenterAgent);
	const inspectedAppCenterResourceValues = appCenterDetailResourceValuesForSelection({
		agent: inspectedAppCenterAgent,
		template: inspectedAppCenterTemplate,
		credentialById,
		knowledgeBaseById,
		modelCount: credentials.length,
		knowledgeBaseCount: knowledgeBases.length,
		labels: appCenterDetailResourceValueLabels(t),
	});
	const appCenterDetailResources = appCenterDetailResourcesForSelection(
		{
			agent: inspectedAppCenterResourceValues.agent,
			template: inspectedAppCenterResourceValues.template,
		},
		appCenterDetailResourcesLabels(t),
	);
	const appCenterDetailHealth = appCenterDetailHealthState({
		hasAgent: Boolean(inspectedAppCenterAgent),
		agentReadiness: inspectedAppCenterAgentReadiness,
		agentIssues: inspectedAppCenterAgentIssues,
		hasTemplate: Boolean(inspectedAppCenterTemplate),
		hasCredentials: credentials.length > 0,
		hasKnowledgeBases: knowledgeBases.length > 0,
		labels: appCenterDetailHealthLabels(t),
	});
	const appCenterDetailIssues = appCenterDetailHealth.issues;
	const appCenterDetailStatus = appCenterDetailHealth.status;
	const operationsHeadline = operationsHeadlineText(
		{
			activeAgentCount: activePlatformAgents.length,
			blockedOrPartialAgentCount: blockedOrPartialPlatformAgents.length,
			pendingApprovalCount: pendingApprovals.length,
		},
		operationsHeadlineLabels(t),
	);
	const agentReleasePipeline = agentReleasePipelineForStatus(
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
	) satisfies Array<{
		key: string;
		title: string;
		detail: string;
		state: HealthState;
		icon: ComponentType<{ className?: string }>;
	}>;
	const selectedIdentityGovernanceDisplayState =
		selectedIdentityGovernanceDisplayStateForStatus({
			selectedIdentity,
			pendingApprovals,
			auditEvents,
			availableToolItems,
			toolPolicyDraft,
		});
	const selectedIdentityPendingApprovals =
		selectedIdentityGovernanceDisplayState.selectedIdentityPendingApprovals;
	const selectedIdentityPendingToolNames =
		selectedIdentityGovernanceDisplayState.selectedIdentityPendingToolNames;
	const governanceOperationsState = governanceOperationsStateForStatus({
		enterpriseIdentities,
		pendingApprovals,
		governance,
		auditEventCount,
		selectedIdentityPendingApprovalCount: selectedIdentityPendingApprovals.length,
		accessLabels: governanceAccessLabels(t),
		healthLabels: governanceHealthLabels(t),
		icons: governanceHealthIcons,
	});
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
	const workflowOperationsState = workflowOperationsStateForStatus({
		workflowTemplates,
		workflowOptions,
		selectedWorkflowType,
		selectedWorkflowTemplate,
		recentWorkflowRuns,
		workflowRunCount,
		pendingApprovals,
		labels: workflowOperationsLabels(t),
	});
	const workflowPendingApprovals = workflowOperationsState.workflowPendingApprovals;
	const selectedWorkflowName = workflowOperationsState.selectedWorkflowName;
	const selectedWorkflowSteps = workflowOperationsState.selectedWorkflowSteps;
	const selectedWorkflowLastRun = workflowOperationsState.selectedWorkflowLastRun;
	const workflowOpsStats = workflowOperationsState.workflowOpsStats;
	const triggerOperationsState = triggerOperationsStateForStatus({
		schedules,
		statLabels: triggerOperationsStatLabels(t),
		summaryLabels: triggerOperationsSummaryLabels(t),
	});
	const recentSchedules = triggerOperationsState.recentSchedules;
	const triggerOpsStats = triggerOperationsState.triggerOpsStats;
	const triggerOpsSummary = triggerOperationsState.triggerOpsSummary;
	const auditStats = auditStatsForSummary(
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
		if (activePlatformAgents.length === 0) {
			if (selectedRunAgentId) {
				setSelectedRunAgentId('');
			}
			return;
		}

		if (
			!selectedRunAgentId ||
			!activePlatformAgents.some((agent) => agent.id === selectedRunAgentId)
		) {
			setSelectedRunAgentId((readyPlatformAgents[0] ?? activePlatformAgents[0]).id);
		}
	}, [activePlatformAgents, readyPlatformAgents, selectedRunAgentId]);

	useEffect(() => {
		if (!selectedRunAgentId) {
			setAgentRunResult(null);
			return;
		}

		setAgentRunResult((current) => {
			if (current?.agent_id === selectedRunAgentId) {
				return current;
			}
			return latestAgentRunResponse(agentConversations, selectedRunAgentId);
		});
	}, [selectedRunAgentId]);

	useEffect(() => {
		void refetchAgentRuns();
	}, [selectedRunAgentId, selectedIdentityUserId]);

	useEffect(() => {
		if (workflowTemplates.length === 0) {
			return;
		}

		if (!workflowTemplates.some((template) => template.workflow_type === selectedWorkflowType)) {
			const firstTemplate = workflowTemplates[0];
			setSelectedWorkflowType(firstTemplate.workflow_type);
			setWorkflowInputs(normalizeWorkflowInputs(firstTemplate.default_inputs));
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
		if (!platformConfigExport) {
			return;
		}

		const text = formatPlatformConfigExport(platformConfigExport);
		setPlatformConfigImportText(text);
		if (navigator.clipboard) {
			await navigator.clipboard.writeText(text);
		}
	}

	async function handleImportPlatformConfig() {
		setImportingPlatformConfig(true);
		setPlatformConfigError(null);
		setPlatformConfigImportResult(null);
		try {
			const parsed = parsePlatformConfigImportText(platformConfigImportText);
			const response = await platformApi.importConfig({
				mode: platformConfigImportMode,
				config: parsed,
			});
			setPlatformConfigImportResult(
				platformConfigImportSuccessMessage(response, configManagementRequestText),
			);
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
		} catch (error) {
			setPlatformConfigError(
				platformConfigImportErrorMessage(error, configManagementRequestText),
			);
		} finally {
			setImportingPlatformConfig(false);
		}
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
		const userId = memberForm.user_id.trim();
		if (!userId) {
			setPlatformMembersError(memberRequestText.userRequired);
			return;
		}

		setSavingMember(true);
		setPlatformMembersError(null);
		try {
			await platformApi.createMember(memberCreatePayloadFromForm(memberForm, userId));
			setMemberForm(defaultMemberForm);
			await refreshMemberDependentViews();
		} catch (error) {
			setPlatformMembersError(
				error instanceof Error ? error.message : memberRequestText.saveError,
			);
		} finally {
			setSavingMember(false);
		}
	}

	function handleEditMember(member: EnterprisePlatformMember) {
		setMemberForm(memberFormFromMember(member));
	}

	async function handleToggleMemberStatus(member: EnterprisePlatformMember) {
		setUpdatingMemberId(member.user_id);
		setPlatformMembersError(null);
		try {
			if (memberShouldActivate(member)) {
				await platformApi.updateMember(member.user_id, { status: 'active' });
			} else {
				await platformApi.deactivateMember(member.user_id);
			}
			await refreshMemberDependentViews();
		} catch (error) {
			setPlatformMembersError(
				error instanceof Error ? error.message : memberRequestText.saveError,
			);
		} finally {
			setUpdatingMemberId(null);
		}
	}

	function loadSavedConnectorConfig(config: EnterpriseConnectorSavedConfig) {
		setConnectorTestForm((previous) =>
			connectorFormPatchFromSavedConfig(previous, config),
		);
		setConnectorTestResult(null);
		setConnectorTestError(null);
		setConnectorSaveError(null);
		setConnectorSaveSuccess(null);
	}

	async function handleSaveConnectorConfig() {
		const baseUrl = connectorTestForm.base_url.trim();
		if (!baseUrl) {
			setConnectorSaveError(connectorRequestText.saveBaseUrlRequired);
			setConnectorSaveSuccess(null);
			return;
		}
		if (connectorDraftIssues.length > 0) {
			setConnectorSaveError(connectorDraftIssues[0]);
			setConnectorSaveSuccess(null);
			return;
		}

		setSavingConnectorConfig(true);
		setConnectorSaveError(null);
		setConnectorSaveSuccess(null);
		try {
			const response = await platformApi.saveConnectorConfig(
				connectorSavePayloadFromForm(connectorTestForm, baseUrl),
			);
			setConnectors((previous) =>
				previous
					? {
							...previous,
							saved_configs: response.saved_configs,
						}
					: previous,
			);
			setConnectorTestForm((previous) => ({
				...previous,
				token: '',
			}));
			setConnectorSaveSuccess(
				connectorRequestText.saveSuccessWithTenant(response.config.tenant),
			);
			await refetchConnectors();
			await refetchGovernance();
			await refetchOpsTasks();
		} catch (error) {
			setConnectorSaveError(
				error instanceof Error ? error.message : connectorRequestText.saveError,
			);
		} finally {
			setSavingConnectorConfig(false);
		}
	}

	async function handleTestConnector() {
		const baseUrl = connectorTestForm.base_url.trim();
		if (!baseUrl) {
			setConnectorTestError(connectorRequestText.testBaseUrlRequired);
			return null;
		}
		if (connectorDraftIssues.length > 0) {
			setConnectorTestError(connectorDraftIssues[0]);
			return null;
		}

		setTestingConnector(true);
		setConnectorTestError(null);
		try {
			const response = await platformApi.testConnector(
				connectorTestPayloadFromForm(connectorTestForm, baseUrl),
			);
			setConnectorTestResult(response);
			return response;
		} catch (error) {
			setConnectorTestError(
				error instanceof Error ? error.message : connectorRequestText.testError,
			);
			return null;
		} finally {
			setTestingConnector(false);
		}
	}

	async function handleTestAndSaveConnectorConfig() {
		const response = await handleTestConnector();
		if (!response) {
			return;
		}
		if (response.status !== 'success') {
			setConnectorSaveSuccess(null);
			setConnectorSaveError(connectorRequestText.testBeforeSaveRequired);
			return;
		}
		await handleSaveConnectorConfig();
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
		if (!selectedIdentity) {
			setToolPolicySaveError(tenantGovernanceRequestText.noIdentity);
			setToolPolicySaveSuccess(null);
			return;
		}

		setSavingToolPolicy(true);
		setToolPolicySaveError(null);
		setToolPolicySaveSuccess(null);
		try {
			await platformApi.updateToolPolicy(toolPolicyPayloadFromDraft({
				tenant: selectedIdentity.tenant,
				userId: selectedIdentity.user_id,
				draft: toolPolicyDraft,
			}));

			setToolPolicySaveSuccess(tenantGovernanceRequestText.policySaved);
			await Promise.all([refetchPlatform(), refetchGovernance(), refetchToolCatalog()]);
			await refetchOpsTasks();
		} catch (error) {
			setToolPolicySaveError(
				error instanceof Error
					? error.message
					: tenantGovernanceRequestText.policySaveError,
			);
		} finally {
			setSavingToolPolicy(false);
		}
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
			const turns = response.runs.map(mapAgentRunToConversationTurn);
			setAgentConversations((current) => ({
				...current,
				[agentId]: turns,
			}));
			setAgentRunResult((current) => {
				if (
					current?.agent_id === agentId &&
					turns.some((turn) => turn.response.turn_id === current.turn_id)
				) {
					return current;
				}
				return turns[0]?.response ?? null;
			});
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
			const limitValue = Number.parseInt(filters.limit, 10);
			const response = await platformApi.audit({
				tenant: filters.tenant || undefined,
				user_id: filters.user_id || undefined,
				agent_id: filters.agent_id || undefined,
				tool_name: filters.tool_name || undefined,
				success:
					filters.success === 'true'
						? true
						: filters.success === 'false'
							? false
							: undefined,
				limit: Number.isFinite(limitValue) ? limitValue : 50,
			});
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
		setCreatingApproval(true);
		setApprovalError(null);
		try {
			const response = await platformApi.createApproval(
				approvalCreatePayloadFromForm(approvalForm, {
					selectedIdentityUserId,
					selectedRunAgentId,
					username,
				}),
			);
			setApprovalRequests((current) =>
				prependApprovalRequest(current, response.approval),
			);
			await refetchGovernance();
			await refetchOpsTasks();
			setApprovalForm((current) => ({
				...current,
				reason: defaultApprovalForm.reason,
			}));
		} catch (error) {
			setApprovalError(
				error instanceof Error ? error.message : approvalRequestText.createError,
			);
		} finally {
			setCreatingApproval(false);
		}
	}

	async function handleCreateRunApproval(
		requestType: PlatformApprovalRunType,
		reason?: string,
	): Promise<boolean> {
		if (requestType === 'tool_run' && !selectedToolInputKey) {
			return false;
		}

		const inputs =
			requestType === 'tool_run'
				? { [selectedToolInputKey!]: selectedToolInputValue }
				: workflowInputs;

		setCreatingRunApproval(requestType);
		setApprovalError(null);
		try {
			const response = await platformApi.createApproval(
				approvalCreatePayloadFromRun(requestType, {
					inputs,
					reason: reason || approvalRequestText.runApprovalReason,
					selectedIdentityUserId,
					selectedRunAgentId,
					selectedToolName,
					selectedWorkflowType,
					username,
				}),
			);
			setApprovalRequests((current) =>
				prependApprovalRequest(current, response.approval),
			);
			if (requestType === 'tool_run') {
				setToolRunError(null);
			} else {
				setWorkflowRunError(null);
			}
			await refetchGovernance();
			await refetchOpsTasks();
			window.setTimeout(scrollToGovernance, 0);
			return true;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : approvalRequestText.createError;
			if (requestType === 'tool_run') {
				setToolRunError(message);
			} else {
				setWorkflowRunError(message);
			}
			return false;
		} finally {
			setCreatingRunApproval(null);
		}
	}

	async function handleDecideApproval(
		approvalId: string,
		decision: 'approved' | 'rejected',
	) {
		setDecidingApprovalId(approvalId);
		setApprovalError(null);
		try {
			const request = approvalDecisionPayload(decision, {
				username,
				labels: {
					approved: approvalRequestText.approved,
					rejected: approvalRequestText.rejected,
				},
			});
			const response =
				decision === 'approved'
					? await platformApi.approveApproval(approvalId, request)
					: await platformApi.rejectApproval(approvalId, request);
			setApprovalRequests((current) =>
				replaceApprovalRequest(current, response.approval),
			);
			await refetchGovernance();
			await refetchOpsTasks();
		} catch (error) {
			setApprovalError(
				error instanceof Error ? error.message : approvalRequestText.decisionError,
			);
		} finally {
			setDecidingApprovalId(null);
		}
	}

	async function handleApproveAndRun(approval: EnterpriseApprovalRequestItem) {
		const { canContinue, canContinueAgentRun, canContinueToolRun, canContinueWorkflowRun } =
			approvalContinuationState(approval);

		if (!canContinue) {
			return;
		}

		setContinuingApprovalId(approval.approval_id);
		setApprovalError(null);
		try {
			const response = await platformApi.approveApproval(
				approval.approval_id,
				approvalDecisionPayload('approved', {
					username,
					labels: {
						approved: approvalRequestText.approved,
						rejected: approvalRequestText.rejected,
					},
				}),
			);
			setApprovalRequests((current) =>
				replaceApprovalRequest(current, response.approval),
			);
			await refetchGovernance();
			await refetchOpsTasks();

			if (canContinueAgentRun && approval.tool_name) {
				const target = approvalAgentContinuationTarget(approval, agentQuestion);

				setSelectedIdentityUserId(target.userId);
				setSelectedRunAgentId(target.agentId);
				setAgentApprovalId(target.approvalId);
				setAgentQuestion(target.question);
				window.setTimeout(scrollToAgentRunner, 0);
				await runEnterpriseAgent(target);
				return;
			}

			if (canContinueToolRun && approval.tool_name) {
				const target = approvalToolContinuationTarget(
					approval,
					enterpriseToolInputConfig[approval.tool_name],
				);

				setSelectedIdentityUserId(target.userId);
				setSelectedRunAgentId(target.agentId);
				setSelectedToolName(target.toolName);
				setToolInputs((current) =>
					approvalToolInputsPatch(current, target.toolName, target.inputValue),
				);
				setToolApprovalId(target.approvalId);
				window.setTimeout(scrollToToolRunner, 0);
				await runEnterpriseTool(target);
				return;
			}

			if (canContinueWorkflowRun && approval.workflow_type) {
				const target = approvalWorkflowContinuationTarget(approval);

				setSelectedIdentityUserId(target.userId);
				setSelectedRunAgentId(target.agentId);
				setSelectedWorkflowType(target.workflowType);
				setWorkflowInputs(target.inputs);
				setWorkflowApprovalId(target.approvalId);
				window.setTimeout(scrollToWorkflowRunner, 0);
				await runEnterpriseWorkflow(target);
			}
		} catch (error) {
			setApprovalError(
				error instanceof Error ? error.message : approvalRequestText.approveAndRunError,
			);
		} finally {
			setContinuingApprovalId(null);
		}
	}

	async function handleToggleWorkflowTemplate(
		template: EnterpriseWorkflowTemplate,
		enabled: boolean,
	) {
		setSavingWorkflowType(template.workflow_type);
		setWorkflowTemplatesError(null);
		try {
			const response = await platformApi.updateWorkflow(template.workflow_type, {
				enabled,
			});
			setWorkflowTemplates(response.workflows);
			await refetchPlatform();
			await refetchScenarios();
			await refetchOpsTasks();
		} catch (error) {
			setWorkflowTemplatesError(
				error instanceof Error ? error.message : workflowRunnerRequestText.templatesLoadError,
			);
		} finally {
			setSavingWorkflowType(null);
		}
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
		setEditingAgentId(null);
		setSelectedTemplateId(template.id);
		setPublishForm(buildDefaultPublishForm(template));
	}

	function handlePublishTenantChange(value: string) {
		setPublishForm((current) =>
			publishFormForTenantChange({
				current,
				tenant: value,
				currentUserTenant: platformStatus?.current_user.tenant,
				members: platformMembers?.members ?? [],
			}),
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
		if (task.action?.type !== 'resolve') {
			handleOperationAction(task.target);
			return;
		}

		setResolvingOpsTaskCode(task.code);
		setOpsTasksError(null);
		try {
			const response = await platformApi.resolveOpsTask(task.code);
			if (response.workflows) {
				setWorkflowTemplates(response.workflows);
			}
			setOpsTasks(response.ops_tasks.tasks);
			setOpsTasksSummary(response.ops_tasks.summary);
			await refetchPlatform();
			await refetchScenarios();
		} catch (error) {
			setOpsTasksError(
				error instanceof Error ? error.message : opsTasksRequestText.resolveError,
			);
		} finally {
			setResolvingOpsTaskCode(null);
		}
	}

	function handlePrimeToolApproval(agent: EnterprisePublishedAgent, toolName: string) {
		const toolConfig = enterpriseToolInputConfig[toolName];
		const catalogItem = availableToolItems.find((tool) => tool.name === toolName);

		setSelectedIdentityUserId(selectedIdentityUserId || username);
		setApprovalForm((current) =>
			approvalToolFormPatch(current, {
				agentId: agent.id,
				inputConfig: toolConfig,
				catalogItem,
				toolName,
				reason: approvalRequestText.agentToolApprovalReason({
					agent: agent.name,
					tool: toolName,
				}),
				defaults: {
					defaultInputValue: defaultApprovalForm.input_value,
					selectedIdentityUserId,
					username,
				},
			}),
		);
		setApprovalError(null);
		window.setTimeout(scrollToGovernance, 0);
	}

	function handlePrimeAgentWorkflow(agent: EnterprisePublishedAgent) {
		setSelectedRunAgentId(agent.id);
		setSelectedIdentityUserId(selectedIdentityUserId || username);
		setWorkflowInputs(agentWorkflowPrimeInputs({
			selectedWorkflowTemplate,
			workflowOptions,
			selectedWorkflowType,
		}));
		setWorkflowApprovalId('');
		setWorkflowRunError(null);
		window.setTimeout(scrollToWorkflowRunner, 0);
	}

	function handleUseApproval(approval: EnterpriseApprovalRequestItem) {
		setSelectedIdentityUserId(approval.user_id);

		if (approval.request_type === 'tool_run' && approval.tool_name) {
			if (approval.agent_id && approval.agent_id !== 'platform-console') {
				setSelectedRunAgentId(approval.agent_id);
				setAgentApprovalId(approval.approval_id);
				setAgentQuestion((current) =>
					approvalAgentQuestionFromInputs(approval.inputs, current),
				);
				setAgentRunError(null);
				window.setTimeout(scrollToAgentRunner, 0);
				return;
			}

			const toolConfig = enterpriseToolInputConfig[approval.tool_name];
			const { inputValue } = approvalInputForTool(
				approval.inputs,
				toolConfig?.inputKey,
			);

			setSelectedToolName(approval.tool_name);
			setToolInputs((current) =>
				approvalToolInputsPatch(current, approval.tool_name!, inputValue),
			);
			setToolApprovalId(approval.approval_id);
			setToolRunError(null);
			window.setTimeout(scrollToToolRunner, 0);
			return;
		}

		if (approval.request_type === 'workflow_run' && approval.workflow_type) {
			setSelectedWorkflowType(approval.workflow_type);
			setWorkflowInputs(normalizeWorkflowInputs(approval.inputs));
			setWorkflowApprovalId(approval.approval_id);
			setWorkflowRunError(null);
			window.setTimeout(scrollToWorkflowRunner, 0);
		}
	}

	function handlePrimeAgentRunner(sample = primaryAgentSampleQuestion) {
		setAgentQuestion(sample);
		setAgentRunError(null);
		window.setTimeout(scrollToAgentRunner, 0);
	}

	function handlePrimePublishedAgent(agentId: string, sample = primaryAgentSampleQuestion) {
		setSelectedRunAgentId(agentId);
		setAgentQuestion((current) => current.trim() || sample);
		setAgentRunResult(latestAgentRunResponse(agentConversations, agentId));
		setAgentRunError(null);
		window.setTimeout(scrollToAgentRunner, 0);
	}

	function handleSelectRunAgent(agentId: string) {
		setSelectedRunAgentId(agentId);
		setAgentRunResult(latestAgentRunResponse(agentConversations, agentId));
		setAgentRunError(null);
	}

	async function handleSelectAgentRun(turn: EnterpriseAgentConversationTurn) {
		setAgentQuestion(turn.question);
		setAgentRunError(null);
		setAgentRunsError(null);
		setAgentRunResult(turn.response);
		setAgentRunsLoading(true);

		try {
			const run = await platformApi.agentRun(turn.id);
			const detailedTurn = mapAgentRunToConversationTurn(run);
			setAgentConversations((current) =>
				mergeAgentConversationTurn(current, detailedTurn),
			);
			setAgentRunResult(run.response);
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
		if (!selectedRunAgentId) {
			return;
		}

		const agentId = selectedRunAgentId;
		const userId = selectedIdentityUserId || username;

		setAgentRunsLoading(true);
		setAgentRunsError(null);
		try {
			await platformApi.clearAgentRuns(clearAgentRunsParams({ agentId, userId }));
			setAgentConversations((current) => ({
				...current,
				[agentId]: [],
			}));
			setAgentRunResult(null);
			setAgentRunError(null);
		} catch (error) {
			setAgentRunsError(
				error instanceof Error ? error.message : agentRunnerRequestText.historyClearError,
			);
		} finally {
			setAgentRunsLoading(false);
		}
	}

	function handleUseIdentity(identity: EnterpriseIdentity) {
		setSelectedIdentityUserId(identity.user_id);
		setAgentQuestion(identity.sample_questions[0] ?? primaryAgentSampleQuestion);
		setAgentRunError(null);
		window.setTimeout(scrollToAgentRunner, 0);
	}

	function handleInspectIdentityAudit(identity: EnterpriseIdentity) {
		const filters = auditFiltersForIdentity(identity);
		setAuditFilters((previous) => ({ ...previous, ...filters }));
		void refetchAuditEvents(filters);
		window.setTimeout(scrollToGovernance, 0);
	}

	function handleInspectIdentityApprovals(identity: EnterpriseIdentity) {
		const filters = approvalFiltersForIdentity(identity);
		setApprovalFilters((previous) => ({ ...previous, ...filters }));
		void refetchApprovals(filters);
		window.setTimeout(scrollToGovernance, 0);
	}

	function handleInspectIdentityFailures(identity: EnterpriseIdentity) {
		const filters = failedAuditFiltersForIdentity(identity);
		setAuditFilters((previous) => ({ ...previous, ...filters }));
		void refetchAuditEvents(filters);
		window.setTimeout(scrollToGovernance, 0);
	}

	function handleUseTenant(tenant: string) {
		const identity =
			enterpriseIdentities.find((item) => item.tenant === tenant) ?? selectedIdentity;

		if (identity) {
			handleUseIdentity(identity);
			return;
		}

		setAgentRunError(null);
		window.setTimeout(scrollToAgentRunner, 0);
	}

	function handleInspectTenantAudit(tenant: string) {
		const filters = auditFiltersForTenant(tenant);
		setAuditFilters((previous) => ({ ...previous, ...filters }));
		void refetchAuditEvents(filters);
		window.setTimeout(scrollToGovernance, 0);
	}

	function handleOpenMemoryOperation(item: MemoryOperationsItem) {
		const identity = enterpriseIdentities.find(
			(candidate) =>
				candidate.tenant === item.tenant && candidate.user_id === item.userId,
		);

		if (identity) {
			setSelectedIdentityUserId(identity.user_id);
		}

		setSelectedRunAgentId(item.agentId);
		setAgentRunResult(item.latestResponse);
		setAgentQuestion(item.latestQuestion || primaryAgentSampleQuestion);
		setAgentRunError(null);
		window.setTimeout(scrollToAgentRunner, 0);
	}

	function handleInspectMemoryOperationAudit(item: MemoryOperationsItem) {
		const filters = auditFiltersForMemoryOperation(item);
		setAuditFilters((previous) => ({ ...previous, ...filters }));
		void refetchAuditEvents(filters);
		window.setTimeout(scrollToGovernance, 0);
	}

	function handleInspectTenantApprovals(tenant: string) {
		const filters = approvalFiltersForTenant(tenant);
		setApprovalFilters((previous) => ({ ...previous, ...filters }));
		void refetchApprovals(filters);
		window.setTimeout(scrollToGovernance, 0);
	}

	function handlePrepareTenantAgent(tenant: string) {
		if (defaultAgentTemplate) {
			setEditingAgentId(null);
			setSelectedTemplateId(defaultAgentTemplate.id);
		}

		setPublishForm((current) =>
			publishFormForPreparedTenant({
				current,
				tenant,
				templateForm: defaultAgentTemplate
					? buildDefaultPublishForm(defaultAgentTemplate)
					: null,
			}),
		);

		window.setTimeout(scrollToAgentManagement, 0);
	}

	function handleInspectAgentRunAudit() {
		if (!agentRunEvidence) {
			return;
		}

		const filters = auditFiltersForAgentRunEvidence(agentRunEvidence);
		setAuditFilters((previous) => ({ ...previous, ...filters }));
		void refetchAuditEvents(filters);
		window.setTimeout(scrollToGovernance, 0);
	}

	function handleStartPublishing() {
		if (!selectedTemplateId && agentTemplates.length > 0) {
			handleConfigureTemplate(agentTemplates[0]);
		}
		window.setTimeout(scrollToAgentManagement, 0);
	}

	function handleNextAgentSetupStep() {
		if (!nextAgentSetupStep) {
			return;
		}

		if (nextAgentSetupStep.key === 'template') {
			if (!selectedTemplate && defaultAgentTemplate) {
				handleConfigureTemplate(defaultAgentTemplate);
			}
			window.setTimeout(scrollToAgentManagement, 0);
			return;
		}

		if (nextAgentSetupStep.key === 'model' && credentials.length === 0) {
			navigate('/credential');
			return;
		}

		if (nextAgentSetupStep.key === 'knowledge' && knowledgeBases.length === 0) {
			navigate('/knowledge');
			return;
		}

		nextAgentSetupStep.ref.current?.scrollIntoView({
			behavior: 'smooth',
			block: 'center',
		});
	}

	function buildAgentConfigurationPayload() {
		return buildAgentConfigurationPayloadFromForm(publishForm);
	}

	function handleEditAgent(agent: EnterprisePublishedAgent) {
		setSelectedTemplateId(agent.template_id);
		setEditingAgentId(agent.id);
		setPublishForm(publishFormFromPublishedAgent(agent));
	}

	function handleCancelEdit() {
		const template = selectedTemplate;
		setEditingAgentId(null);
		if (template) {
			handleConfigureTemplate(template);
		}
	}

	function handleTogglePublishList(
		key: PublishListFormKey,
		value: string,
		checked: boolean,
	) {
		setPublishForm((current) =>
			publishFormForListToggle({
				current,
				key,
				value,
				checked,
			}),
		);
	}

	async function handlePublishAgent() {
		if (!selectedTemplateId) {
			return;
		}

		setPublishingTemplateId(selectedTemplateId);
		setPlatformAgentsError(null);
		try {
			const payload = buildAgentConfigurationPayload();
			const response = editingAgentId
				? await platformApi.updateAgent(editingAgentId, payload)
				: await platformApi.publishAgent(
						agentPublishPayloadFromForm({
							templateId: selectedTemplateId,
							form: publishForm,
						}),
					);
			if (response.agent.status === 'published') {
				setLastPublishedAgentId(response.agent.id);
				handlePrimePublishedAgent(response.agent.id);
			}
			setEditingAgentId(null);
			await refetchPlatformAgents();
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchOpsTasks();
		} catch (error) {
			setPlatformAgentsError(
				error instanceof Error
					? error.message
					: editingAgentId
						? agentManagementRequestText.updateError
						: agentManagementRequestText.publishError,
			);
		} finally {
			setPublishingTemplateId(null);
		}
	}

	async function handleQuickPublishAgent() {
		if (credentials.length === 0) {
			navigate('/credential');
			return;
		}

		const template = selectedTemplate ?? defaultAgentTemplate;
		if (!template) {
			handleStartPublishing();
			return;
		}

		const defaultForm = buildDefaultPublishForm(template);
		setEditingAgentId(null);
		setSelectedTemplateId(template.id);
		setPublishForm(defaultForm);
		setPublishingTemplateId(template.id);
		setPlatformAgentsError(null);

		try {
			const response = await platformApi.publishAgent(
				agentPublishPayloadFromForm({
					templateId: template.id,
					form: defaultForm,
				}),
			);
			if (response.agent.status === 'published') {
				setLastPublishedAgentId(response.agent.id);
				handlePrimePublishedAgent(response.agent.id);
			}
			await refetchPlatformAgents();
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchOpsTasks();
		} catch (error) {
			setPlatformAgentsError(
				error instanceof Error
					? error.message
					: agentManagementRequestText.publishError,
			);
			window.setTimeout(scrollToAgentManagement, 0);
		} finally {
			setPublishingTemplateId(null);
		}
	}

	function handleNextStepPrimaryAction() {
		if (nextStepMode === 'model') {
			navigate('/credential');
			return;
		}
		if (nextStepMode === 'publish') {
			void handleQuickPublishAgent();
			return;
		}
		if (nextStepMode === 'configure') {
			scrollToAgentManagement();
			return;
		}
		if (nextStepMode === 'governance') {
			scrollToGovernance();
			return;
		}
		handlePrimeAgentRunner();
	}

	function handleAppCenterPrimaryAction() {
		if (credentials.length === 0) {
			navigate('/credential');
			return;
		}

		const readyAgent = readyPlatformAgents[0];
		if (readyAgent) {
			setSelectedRunAgentId(readyAgent.id);
			handlePrimeAgentRunner();
			return;
		}

		if (activePlatformAgents.length === 0) {
			void handleQuickPublishAgent();
			return;
		}

		scrollToAgentManagement();
	}

	function handleAppCenterDetailPrimaryAction() {
		if (inspectedAppCenterAgent) {
			if (agentIsReady(inspectedAppCenterAgent)) {
				setSelectedRunAgentId(inspectedAppCenterAgent.id);
				handlePrimeAgentRunner();
				return;
			}

			handleEditAgent(inspectedAppCenterAgent);
			window.setTimeout(scrollToAgentManagement, 0);
			return;
		}

		if (inspectedAppCenterTemplate) {
			handleConfigureTemplate(inspectedAppCenterTemplate);
			window.setTimeout(scrollToAgentManagement, 0);
		}
	}

	function handleAppCenterDetailSecondaryAction() {
		if (inspectedAppCenterAgent) {
			handleEditAgent(inspectedAppCenterAgent);
			window.setTimeout(scrollToAgentManagement, 0);
			return;
		}

		scrollToGovernance();
	}

	async function handleArchiveAgent(agent: EnterprisePublishedAgent) {
		if (agent.status !== 'published') {
			return;
		}

		setArchivingAgentId(agent.id);
		setPlatformAgentsError(null);
		try {
			const response = await platformApi.archiveAgent(agent.id);
			const nextActiveAgent = response.agents.find(
				(item) => item.status === 'published' && item.id !== agent.id,
			);
			if (selectedRunAgentId === agent.id) {
				setSelectedRunAgentId(nextActiveAgent?.id ?? '');
				setAgentRunResult(null);
				setAgentRunError(null);
			}
			if (editingAgentId === agent.id) {
				setEditingAgentId(null);
			}
			await refetchPlatformAgents();
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchOpsTasks();
		} catch (error) {
			setPlatformAgentsError(
				error instanceof Error ? error.message : agentManagementRequestText.archiveError,
			);
		} finally {
			setArchivingAgentId(null);
		}
	}

	async function handleBindDefaultModel(agent: EnterprisePublishedAgent) {
		const modelConfigId = credentials[0]?.id;
		if (!modelConfigId) {
			navigate('/credential');
			return;
		}

		setBindingAgentModelId(agent.id);
		setPlatformAgentsError(null);
		try {
			const patch = agentDefaultModelPatch(modelConfigId);
			const response = await platformApi.updateAgent(agent.id, patch);
			if (selectedRunAgentId === agent.id || !selectedRunAgentId) {
				setSelectedRunAgentId(response.agent.id);
			}
			if (editingAgentId === agent.id) {
				setPublishForm((current) => publishFormWithPatch(current, patch));
			}
			await refetchPlatformAgents();
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchOpsTasks();
		} catch (error) {
			setPlatformAgentsError(
				error instanceof Error ? error.message : agentManagementRequestText.bindModelError,
			);
		} finally {
			setBindingAgentModelId(null);
		}
	}

	async function handleBindAvailableKnowledge(agent: EnterprisePublishedAgent) {
		const knowledgeBaseIds = knowledgeBases.map((knowledgeBase) => knowledgeBase.id);
		if (knowledgeBaseIds.length === 0) {
			navigate('/knowledge');
			return;
		}

		setBindingAgentKnowledgeId(agent.id);
		setPlatformAgentsError(null);
		try {
			const patch = agentKnowledgeBasesPatch(knowledgeBaseIds);
			const response = await platformApi.updateAgent(agent.id, patch);
			if (selectedRunAgentId === agent.id || !selectedRunAgentId) {
				setSelectedRunAgentId(response.agent.id);
			}
			if (editingAgentId === agent.id) {
				setPublishForm((current) => publishFormWithPatch(current, patch));
			}
			await refetchPlatformAgents();
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchOpsTasks();
		} catch (error) {
			setPlatformAgentsError(
				error instanceof Error
					? error.message
					: agentManagementRequestText.bindKnowledgeError,
			);
		} finally {
			setBindingAgentKnowledgeId(null);
		}
	}

	async function handleBindTemplateTools(agent: EnterprisePublishedAgent) {
		const template = agentTemplates.find((item) => item.id === agent.template_id);
		const templateTools = template?.tools ?? [];
		if (!template || templateTools.length === 0) {
			setPlatformAgentsError(agentManagementRequestText.bindToolsError);
			return;
		}

		setBindingAgentToolsId(agent.id);
		setPlatformAgentsError(null);
		try {
			const patch = agentTemplateToolsPatch(templateTools);
			const response = await platformApi.updateAgent(agent.id, patch);
			if (selectedRunAgentId === agent.id || !selectedRunAgentId) {
				setSelectedRunAgentId(response.agent.id);
			}
			if (editingAgentId === agent.id) {
				setPublishForm((current) => publishFormWithPatch(current, patch));
			}
			await refetchPlatformAgents();
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchOpsTasks();
		} catch (error) {
			setPlatformAgentsError(
				error instanceof Error ? error.message : agentManagementRequestText.bindToolsError,
			);
		} finally {
			setBindingAgentToolsId(null);
		}
	}

	async function handleEnableAgentMemory(agent: EnterprisePublishedAgent) {
		setEnablingAgentMemoryId(agent.id);
		setPlatformAgentsError(null);
		try {
			const patch = agentMemoryEnabledPatch();
			const response = await platformApi.updateAgent(agent.id, patch);
			if (selectedRunAgentId === agent.id || !selectedRunAgentId) {
				setSelectedRunAgentId(response.agent.id);
			}
			if (editingAgentId === agent.id) {
				setPublishForm((current) => publishFormWithPatch(current, patch));
			}
			await refetchPlatformAgents();
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchOpsTasks();
		} catch (error) {
			setPlatformAgentsError(
				error instanceof Error
					? error.message
					: agentManagementRequestText.enableMemoryError,
			);
		} finally {
			setEnablingAgentMemoryId(null);
		}
	}

	async function handleEnableAgentWorkflow(agent: EnterprisePublishedAgent) {
		setEnablingAgentWorkflowId(agent.id);
		setPlatformAgentsError(null);
		try {
			const patch = agentWorkflowEnabledPatch();
			const response = await platformApi.updateAgent(agent.id, patch);
			if (selectedRunAgentId === agent.id || !selectedRunAgentId) {
				setSelectedRunAgentId(response.agent.id);
			}
			if (editingAgentId === agent.id) {
				setPublishForm((current) => publishFormWithPatch(current, patch));
			}
			await refetchPlatformAgents();
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchOpsTasks();
		} catch (error) {
			setPlatformAgentsError(
				error instanceof Error
					? error.message
					: agentManagementRequestText.enableWorkflowError,
			);
		} finally {
			setEnablingAgentWorkflowId(null);
		}
	}

	async function runEnterpriseAgent(options?: {
		agentId?: string;
		question?: string;
		userId?: string;
		approvalId?: string;
	}) {
		const agentId = options?.agentId ?? selectedRunAgentId;
		const question = (options?.question ?? agentQuestion).trim();
		const userId = options?.userId ?? selectedIdentityUserId;
		const explicitApprovalId = options?.approvalId ?? agentApprovalId.trim();
		const targetAgent =
			activePlatformAgents.find((agent) => agent.id === agentId) ??
			(agentId === selectedRunAgentId ? selectedRunAgent : null);
		const targetIdentity =
			enterpriseIdentities.find((identity) => identity.user_id === userId) ??
			selectedIdentity;
		if (!question || !agentId) {
			return;
		}
		if (targetAgent && !agentAccessAllowed(targetAgent, targetIdentity)) {
			setAgentRunError(agentRunnerRequestText.accessDenied);
			return;
		}

		setRunningAgent(true);
		setAgentRunError(null);
		try {
			const response = await platformApi.runAgent(enterpriseAgentRunPayload({
				agentId,
				question,
				userId,
				approvalId: explicitApprovalId,
			}));
			const turn = agentConversationTurnFromRunResponse({
				response,
				agentId,
				question,
				createdAt: new Date().toISOString(),
				fallbackId: `${agentId}-${Date.now()}`,
			});
			setAgentRunResult(response);
			setAgentConversations((current) => mergeAgentConversationTurn(current, turn, 20));
			const approvalRequired = response.tool_calls?.some(
				(toolCall) => toolCall.approval_required,
			);
			if (approvalRequired) {
				setAgentRunError(agentRunnerRequestText.approvalRequiredCreated);
				await refetchApprovals();
			}
			await refetchAgentRuns(agentId, userId || username);
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchAuditEvents();
			await refetchOpsTasks();
		} catch (error) {
			setAgentRunError(error instanceof Error ? error.message : String(error));
		} finally {
			setRunningAgent(false);
		}
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
		const toolName = options?.toolName ?? selectedToolName;
		const inputs =
			options?.inputs ??
			selectedToolInputs({
				inputKey: selectedToolInputKey,
				inputValue: selectedToolInputValue,
			});
		const userId = options?.userId ?? selectedIdentityUserId;
		const agentId = options?.agentId ?? selectedRunAgentId;
		const approvalId = options?.approvalId ?? toolApprovalId.trim();

		if (!inputs) {
			return;
		}

		setRunningTool(true);
		setToolRunError(null);
		try {
			const response = await platformApi.runTool(enterpriseToolRunPayload({
				toolName,
				inputs,
				userId,
				agentId,
				approvalId,
			}));
			setToolRunResult(response);
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchAuditEvents();
			await refetchOpsTasks();
		} catch (error) {
			const approvalRequired = approvalRequiredDetail(error, 'tool_run');
			if (approvalRequired) {
				const created = await handleCreateRunApproval(
					'tool_run',
					approvalRequired.message,
				);
				if (created) {
					setToolRunError(toolRunnerRequestText.approvalRequiredCreated);
				}
				return;
			}
			setToolRunError(error instanceof Error ? error.message : String(error));
		} finally {
			setRunningTool(false);
		}
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
		const workflowType = options?.workflowType ?? selectedWorkflowType;
		const inputs = options?.inputs ?? workflowInputs;
		const userId = options?.userId ?? selectedIdentityUserId;
		const agentId = options?.agentId ?? selectedRunAgentId;
		const approvalId = options?.approvalId ?? workflowApprovalId.trim();

		setRunningWorkflow(true);
		setWorkflowRunError(null);
		try {
			const response = await platformApi.runWorkflow(enterpriseWorkflowRunPayload({
				workflowType,
				inputs,
				agentId,
				userId,
				approvalId,
			}));
			setWorkflowRunResult(response);
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchAuditEvents();
			await refetchWorkflowRuns();
			await refetchScenarios();
			await refetchOpsTasks();
		} catch (error) {
			const approvalRequired = approvalRequiredDetail(error, 'workflow_run');
			if (approvalRequired) {
				const created = await handleCreateRunApproval(
					'workflow_run',
					approvalRequired.message,
				);
				if (created) {
					setWorkflowRunError(workflowRunnerRequestText.approvalRequiredCreated);
				}
				return;
			}
			setWorkflowRunError(error instanceof Error ? error.message : String(error));
		} finally {
			setRunningWorkflow(false);
		}
	}

	async function handleRunEnterpriseWorkflow() {
		await runEnterpriseWorkflow();
	}

	async function handleRunScenario(scenario: EnterprisePlatformScenario) {
		const target = scenarioWorkflowRunTarget({
			scenario,
			workflowTemplates,
			currentInputs: workflowInputs,
		});
		setSelectedWorkflowType(target.workflowType);
		setWorkflowInputs(target.inputs);
		window.setTimeout(scrollToWorkflowRunner, 0);
		await runEnterpriseWorkflow({
			workflowType: target.workflowType,
			inputs: target.inputs,
		});
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
	const capabilities = capabilityItemsForStatus({
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

	const launchpadTargetActions = launchpadTargetActionsForNavigation(
		launchpadNavigationActions(platformNavigationHandlers),
	);
	const activeMemberCount =
		activePlatformMemberCountForMembers(platformMembers?.members ?? []);
	const launchpadSteps = launchpadStepsForStatus(
		{
			activeMemberCount,
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
			actions: launchpadTargetActions,
			fallbackAction: scrollToGovernance,
			labels: launchpadStepLabels(t),
		},
	);
	const launchpadReadyCount = readyLaunchpadStepCountForSteps(launchpadSteps);
	const launchpadTotalCount = launchpadSteps.length;
	const launchpadState = launchpadStateForCounts({
		readyCount: launchpadReadyCount,
		totalCount: launchpadTotalCount,
	});
	const launchpadPrimaryStep = launchpadPrimaryStepForSteps(launchpadSteps);

	const platformConsoleItems = platformConsoleItemsForDisplay({
		icons: platformConsoleIcons,
		actions: platformConsoleNavigationActions(platformNavigationHandlers),
		labels: platformConsoleItemLabels(t),
	});
	const workbenchIndicators = workbenchIndicatorsForStatus(
		{
			activeAgentCount: activePlatformAgents.length,
			readyAgentCount: readyPlatformAgents.length,
			pendingApprovalCount: pendingApprovals.length,
			recentWorkflowRunCount: recentWorkflowRuns.length,
			failedWorkflowRunCount,
			memoryOperationsSavedCount,
			memoryOperationsHitCount,
			memoryOperationsItemCount: memoryOperationsItems.length,
		},
		{
			icons: workbenchIndicatorIcons,
			actions: workbenchIndicatorNavigationActions(platformNavigationHandlers),
			labels: workbenchIndicatorLabels(t, {
				memoryOperationsSavedCount,
				memoryOperationsHitCount,
			}),
		},
	);
	const workbenchActions = workbenchActionsForStatus(
		{
			selectedRunAgentName: selectedRunAgent?.name,
			workflowTemplateCount: workflowTemplates.length,
			pendingApprovalCount: pendingApprovals.length,
			memoryOperationsRunCount,
		},
		{
			icons: workbenchPrimaryActionIcons,
			actions: workbenchPrimaryNavigationActions(platformNavigationHandlers),
			labels: workbenchPrimaryActionLabels(t),
		},
	);
	const workbenchReadinessItems = workbenchReadinessItemsForStatus(
		{
			credentialCount: credentials.length,
			knowledgeBaseCount: knowledgeBases.length,
			savedConnectorConfigCount: savedConnectorConfigs.length,
			connectorDraftIssueCount: connectorDraftIssues.length,
			savedConnectorConfigEnabled: Boolean(connectors?.runtime.saved_config_enabled),
			activeMemberCount,
			readyAgentCount: readyPlatformAgents.length,
			activeAgentCount: activePlatformAgents.length,
			workflowTemplateCount: workflowTemplates.length,
		},
		{
			icons: workbenchReadinessIcons,
			actions: workbenchReadinessNavigationActions(platformNavigationHandlers),
			labels: workbenchReadinessLabels(t),
		},
	);
	const workbenchRiskItems = workbenchRiskItemsForStatus(
		{
			hasErrors,
			connectorDraftIssueCount: connectorDraftIssues.length,
			pendingApprovalCount: pendingApprovals.length,
			failedWorkflowRunCount,
			readyAgentCount: readyPlatformAgents.length,
		},
		{
			actions: workbenchRiskNavigationActions(platformNavigationHandlers),
			labels: workbenchRiskLabels(t),
		},
	);
	const workbenchQuickActions = workbenchQuickActionsForStatus({
		icons: workbenchQuickActionIcons,
		actions: workbenchQuickNavigationActions(platformNavigationHandlers),
		labels: workbenchQuickActionLabels(t),
	});
	const rolloutPathSteps = rolloutPathStepsForStatus(
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
			icons: rolloutPathIcons,
			actions: rolloutPathNavigationActions(platformNavigationHandlers),
			labels: rolloutPathStepLabels(t),
		},
	);
	const firstAgentGuideSteps = firstAgentGuideStepsForStatus(
		{
			credentialCount: credentials.length,
			readyAgentCount: readyPlatformAgents.length,
			activeAgentCount: activePlatformAgents.length,
			hasAgentRunResult: Boolean(agentRunResult),
			hasSelectedRunAgent: Boolean(selectedRunAgent),
			auditEventCount,
			pendingApprovalCount: pendingApprovals.length,
		},
		{
			icons: firstAgentGuideIcons,
			actions: firstAgentGuideNavigationActions(platformNavigationHandlers),
			labels: firstAgentGuideStepLabels(t),
		},
	);
	const firstAgentGuidePrimaryStep =
		firstAgentGuidePrimaryStepForSteps(firstAgentGuideSteps);
	const orchestrationWorkbenchSteps = orchestrationWorkbenchStepsForStatus(
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
	const orchestrationReadyCount = readyOrchestrationWorkbenchStepCountForSteps(
		orchestrationWorkbenchSteps,
	);
	const orchestrationPrimaryStep =
		orchestrationPrimaryStepForSteps(orchestrationWorkbenchSteps);
	const monitoringActivitySummary = monitoringActivitySummaryForStatus({
		agentConversations,
		auditSummary,
		auditEvents,
		failedWorkflowRunCount,
		pendingApprovalCount: pendingApprovals.length,
		partialWorkflowRunCount,
		workflowRunCount,
		auditEventCount,
	});
	const monitoringLoading =
		platformLoading ||
		agentRunsLoading ||
		workflowRunsLoading ||
		auditLoading ||
		approvalLoading ||
		governanceLoading;
	const monitoringStats = monitoringStatsForSummary(
		{
			recentAgentTurnCount: monitoringActivitySummary.recentAgentTurns.length,
			workflowRunCount,
			completedWorkflowRunCount,
			partialWorkflowRunCount,
			failedWorkflowRunCount,
			auditEventCount,
			auditSuccessCount: monitoringActivitySummary.auditSuccessCount,
			auditFailureCount: monitoringActivitySummary.auditFailureCount,
			pendingApprovalCount: pendingApprovals.length,
		},
		{
			icons: monitoringStatIcons,
			labels: monitoringStatLabels(t),
		},
	);

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
				summarizeAuditObject={summarizeAuditObject}
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
				summarizeAuditObject={summarizeAuditObject}
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
					const nextWorkflow = workflowOptions.find(
						(workflow) => workflow.value === value,
					);
					setWorkflowInputs(normalizeWorkflowInputs(nextWorkflow?.defaultInputs));
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
				summarizeAuditObject={summarizeAuditObject}
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
			agentAccessAllowed={agentAccessAllowed}
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
			summarizeAuditObject={summarizeAuditObject}
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
