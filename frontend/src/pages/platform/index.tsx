import {
	AlertTriangle,
	BotMessageSquare,
	Boxes,
	Brain,
	Building2,
	Clock3,
	Database,
	FileClock,
	HardDrive,
	KeyRound,
	LibraryBig,
	ListChecks,
	Network,
	Play,
	Server,
	ShieldCheck,
	Upload,
	UserRound,
	Workflow,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
	platformApi,
	type EnterpriseIdentity,
	type EnterpriseAgentPublishRequest,
	type EnterpriseAgentTemplate,
	type EnterpriseAgentRunHistoryItem,
	type EnterpriseAgentRunResponse,
	type EnterpriseAgentToolCall,
	type EnterpriseApprovalRequiredDetail,
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
	type EnterpriseToolCatalogItem,
	type EnterpriseToolCatalogResponse,
	type EnterpriseToolRunResponse,
	type EnterpriseWorkflowRunHistoryItem,
	type EnterpriseWorkflowRunResponse,
	type EnterpriseWorkflowTemplate,
} from '@/api';
import { ApiError } from '@/api/client';
import { useAgents } from '@/hooks/useAgents';
import { useCredentials } from '@/hooks/useCredentials';
import { useKnowledgeBases } from '@/hooks/useKnowledgeBases';
import { usePlatformStatus } from '@/hooks/usePlatformStatus';
import { useSchedules } from '@/hooks/useSchedules';
import { useTranslation } from '@/i18n/useI18n';
import { appCenterDetailResourcesForSelection } from './app-center-detail-resources';
import { AgentsViewPage } from './components/AgentsViewPage';
import type { ApprovalFormState } from './components/ApprovalsPanel';
import { ApprovalsViewPage } from './components/ApprovalsViewPage';
import type { AppCenterSelection } from './components/AppCenterPanel';
import type { MonitoringAgentTurn } from './components/MonitoringSnapshotPanel';
import type { MemoryOperationsItem } from './components/MemoryOperationsPanel';
import { MemoryViewPage } from './components/MemoryViewPage';
import type { MemberFormState } from './components/MembersPanel';
import { RunsViewPage } from './components/RunsViewPage';
import type { ToolPolicyDraftValue } from './components/TenantGovernancePanel';
import { SettingsViewPage } from './components/SettingsViewPage';
import { TenantsViewPage } from './components/TenantsViewPage';
import { ToolsViewPage } from './components/ToolsViewPage';
import { WorkflowsViewPage } from './components/WorkflowsViewPage';
import type { HealthState } from './components/common';
import { DashboardViewPage } from './components/DashboardViewPage';
import {
	accessControlStatsForGovernance,
	accessTenantSummariesForGovernance,
	activePlatformAgentsForAgents,
	agentAccessAllowed,
	appCenterDetailHealthState,
	activePlatformMemberCountForMembers,
	activePlatformMembersForTenant,
	agentIsReady,
	agentReadinessIssues,
	agentReadinessState,
	agentReleasePipelineItems,
	archivedPlatformAgentsForAgents,
	identityAccessRowsForGovernance,
	agentOpsSummaryItems,
	agentResourceSummary,
	agentRunnerAccessLabelKey,
	agentSetupStepsForStatus,
	appCenterDetailResourceValuesForSelection,
	appCenterDerivedStateForStatus,
	auditStatsForSummary,
	capabilityItemsForStatus,
	connectorDraftIssuesForDraft,
	dashboardOperationsSummaryForOperations,
	dashboardRiskToolItemsForStatus,
	dashboardTodoItemsForStatus,
	defaultEnterpriseWorkflowInputs,
	enabledEnterpriseWorkflowTemplates,
	enabledTriggerSchedules,
	firstAgentGuidePrimaryStepForSteps,
	firstAgentGuideStepsForStatus,
	formatOperationsAgentIssueText,
	knowledgeBaseLabels,
	launchpadPrimaryStepForSteps,
	launchpadStateForCounts,
	launchpadStepsForStatus,
	launchpadTargetActionsForNavigation,
	memoryOperationsItemsForConversations,
	memoryOperationsSummaryForItems,
	modelCredentialLabel,
	nextAgentSetupStepForSteps,
	normalizeWorkflowInputs,
	governanceHealthItemsForSummary,
	monitoringActivitySummaryForStatus,
	monitoringStatsForSummary,
	operationsHeadlineText,
	orchestrationPrimaryStepForSteps,
	orchestrationWorkbenchStepsForStatus,
	pendingWorkflowRunApprovals,
	publishReleaseIssuesForDraft,
	platformMembersByUserId,
	platformOverviewStatsForSummary,
	platformMemberTenantSummariesForMembers,
	platformConsoleItemsForDisplay,
	publishAccessMembersForSelection,
	publishRoleOptionsForMembers,
	readyLaunchpadStepCountForSteps,
	readyOrchestrationWorkbenchStepCountForSteps,
	readyPlatformAgentsForAgents,
	recentTriggerSchedules,
	rolloutPathStepsForStatus,
	runtimeStatusItemsForStatus,
	selectedIdentityGovernanceActivityForIdentity,
	tenantWorkspaceByNameForEntries,
	tenantWorkspaceEntriesForWorkspaces,
	topOperationsAgentsForDisplay,
	tenantOverviewItemsForWorkspace,
	toolPolicySummaryForGovernance,
	triggerOpsStatsForSummary,
	triggerOpsSummaryText,
	triggerSchedulesBySource,
	workbenchActionsForStatus,
	workbenchIndicatorsForStatus,
	workbenchQuickActionsForStatus,
	workbenchReadinessItemsForStatus,
	workbenchRiskItemsForStatus,
	workflowTemplateByTypeForTemplates,
	workflowOpsStatsForSummary,
	type AgentWizardStep,
} from './platform-utils';

export type PlatformView =
	| 'dashboard'
	| 'agents'
	| 'tools'
	| 'workflows'
	| 'approvals'
	| 'runs'
	| 'tenants'
	| 'memory'
	| 'settings';

function approvalRequiredDetail(
	error: unknown,
	requestType: EnterpriseApprovalRequestType,
): EnterpriseApprovalRequiredDetail | null {
	if (!(error instanceof ApiError)) return null;
	const detail = error.detailData;
	if (!detail || typeof detail !== 'object') return null;
	if (!('approval_required' in detail) || detail.approval_required !== true) return null;
	if (!('request_type' in detail) || detail.request_type !== requestType) return null;
	if (!('message' in detail) || typeof detail.message !== 'string') return null;
	if (!('target' in detail) || typeof detail.target !== 'string') return null;
	return detail as EnterpriseApprovalRequiredDetail;
}

interface EnterpriseAgentConversationTurn extends MonitoringAgentTurn {}

function mapAgentRunToConversationTurn(
	run: EnterpriseAgentRunHistoryItem,
): EnterpriseAgentConversationTurn {
	return {
		id: run.turn_id,
		agentId: run.agent_id,
		question: run.question,
		answer: run.answer,
		createdAt: run.created_at,
		response: run.response,
	};
}

interface PublishFormState {
	name: string;
	description: string;
	tenant: string;
	model_config_id: string;
	knowledge_base_ids: string[];
	tools: string[];
	allowed_user_ids: string[];
	allowed_roles: string[];
	memory_enabled: boolean;
	workflow_enabled: boolean;
}


const enterpriseToolInputConfig: Record<
	string,
	{ inputKey: string; labelKey: string; defaultValue: string }
> = {
	enterprise_lookup_policy: {
		inputKey: 'keyword',
		labelKey: 'keyword',
		defaultValue: 'remote',
	},
	enterprise_get_ticket_status: {
		inputKey: 'ticket_id',
		labelKey: 'ticket_id',
		defaultValue: 'INC-1001',
	},
	enterprise_summarize_department_metrics: {
		inputKey: 'department',
		labelKey: 'department',
		defaultValue: 'engineering',
	},
};

const enterpriseWorkflowOptions = [
	{ value: 'daily_ops_brief', labelKey: 'dailyOpsBrief' },
	{ value: 'ticket_followup', labelKey: 'ticketFollowup' },
	{ value: 'policy_review', labelKey: 'policyReview' },
];

const agentSampleQuestions = [
	'请查询 remote 政策、INC-1001 工单状态，并总结 engineering 部门指标。',
	'帮我查一下 INC-1001 的工单状态',
	'远程办公制度怎么说？',
	'总结 engineering 部门指标',
];

const defaultApprovalForm: ApprovalFormState = {
	request_type: 'tool_run',
	tool_name: 'enterprise_lookup_policy',
	workflow_type: 'daily_ops_brief',
	input_key: 'keyword',
	input_value: 'remote',
	reason: '需要审批后调用企业工具',
	user_id: '',
	agent_id: '',
};

const defaultMemberForm: MemberFormState = {
	user_id: '',
	tenant: 'acme',
	display_name: '',
	role: '',
	status: 'active',
};

function summarizeAuditValue(value: unknown): string {
	if (value === null || value === undefined) {
		return '-';
	}

	if (typeof value === 'string') {
		return value.length > 64 ? `${value.slice(0, 61)}...` : value;
	}

	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}

	if (Array.isArray(value)) {
		return `[${value.length}]`;
	}

	if (typeof value === 'object') {
		const keys = Object.keys(value as Record<string, unknown>);
		return `{${keys.slice(0, 4).join(', ')}}`;
	}

	return String(value);
}

function summarizeAuditObject(value?: Record<string, unknown>) {
	if (!value) {
		return '';
	}

	return Object.entries(value)
		.slice(0, 4)
		.map(([key, item]) => `${key}: ${summarizeAuditValue(item)}`)
		.join(' | ');
}

function connectorHealthState(status?: string): HealthState {
	if (status === 'ready') {
		return 'ready';
	}

	if (status === 'error') {
		return 'todo';
	}

	return 'partial';
}

export function PlatformPage({ view = 'dashboard' }: { view?: PlatformView }) {
	const navigate = useNavigate();
	const { t } = useTranslation();
	const membersRef = useRef<HTMLElement | null>(null);
	const agentManagementRef = useRef<HTMLElement | null>(null);
	const agentRunnerRef = useRef<HTMLElement | null>(null);
	const connectorCenterRef = useRef<HTMLElement | null>(null);
	const governanceRef = useRef<HTMLElement | null>(null);
	const workflowRunnerRef = useRef<HTMLElement | null>(null);
	const toolRunnerRef = useRef<HTMLElement | null>(null);
	const memoryOperationsRef = useRef<HTMLElement | null>(null);
	const configManagementRef = useRef<HTMLElement | null>(null);
	const agentTemplateStepRef = useRef<HTMLDivElement | null>(null);
	const agentModelStepRef = useRef<HTMLDivElement | null>(null);
	const agentKnowledgeStepRef = useRef<HTMLDivElement | null>(null);
	const agentToolsStepRef = useRef<HTMLDivElement | null>(null);
	const agentRuntimeStepRef = useRef<HTMLDivElement | null>(null);
	const connectorDefaultsAppliedRef = useRef(false);
	const [agentQuestion, setAgentQuestion] = useState('帮我查一下 INC-1001 的工单状态');
	const [runningAgent, setRunningAgent] = useState(false);
	const [agentRunResult, setAgentRunResult] = useState<EnterpriseAgentRunResponse | null>(null);
	const [agentRunError, setAgentRunError] = useState<string | null>(null);
	const [selectedRunAgentId, setSelectedRunAgentId] = useState('');
	const [lastPublishedAgentId, setLastPublishedAgentId] = useState('');
	const [agentApprovalId, setAgentApprovalId] = useState('');
	const [agentConversations, setAgentConversations] = useState<
		Record<string, EnterpriseAgentConversationTurn[]>
	>({});
	const [agentRunsLoading, setAgentRunsLoading] = useState(false);
	const [agentRunsError, setAgentRunsError] = useState<string | null>(null);
	const [selectedToolName, setSelectedToolName] = useState('enterprise_lookup_policy');
	const [toolInputs, setToolInputs] = useState<Record<string, string>>({
		enterprise_lookup_policy: 'remote',
		enterprise_get_ticket_status: 'INC-1001',
		enterprise_summarize_department_metrics: 'engineering',
	});
	const [runningTool, setRunningTool] = useState(false);
	const [toolRunResult, setToolRunResult] = useState<EnterpriseToolRunResponse | null>(null);
	const [toolRunError, setToolRunError] = useState<string | null>(null);
	const [toolApprovalId, setToolApprovalId] = useState('');
	const [selectedWorkflowType, setSelectedWorkflowType] = useState('daily_ops_brief');
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
	const [approvalFilters, setApprovalFilters] = useState({
		status: '',
		tenant: '',
		user_id: '',
		agent_id: '',
		limit: '20',
	});
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
	const [connectorTestForm, setConnectorTestForm] = useState({
		base_url: '',
		token: '',
		tenant: 'acme',
		policy_keyword: 'remote',
		ticket_id: 'INC-1001',
		department: 'engineering',
		policy_path: '/tenants/{tenant}/policies/search',
		ticket_path: '/tenants/{tenant}/tickets/{ticket_id}',
		metrics_path: '/tenants/{tenant}/departments/{department}/metrics',
		timeout_seconds: '5',
		enabled: true,
	});
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
	const [auditFilters, setAuditFilters] = useState({
		tenant: '',
		user_id: '',
		agent_id: '',
		tool_name: '',
		success: '',
		limit: '50',
	});
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
	const [publishForm, setPublishForm] = useState<PublishFormState>({
		name: '',
		description: '',
		tenant: '',
		model_config_id: '',
		knowledge_base_ids: [],
		tools: [],
		allowed_user_ids: [],
		allowed_roles: [],
		memory_enabled: true,
		workflow_enabled: false,
	});

	const serverUrl = localStorage.getItem('server_url') || t('platform.connection.notConfigured');
	const username =
		platformStatus?.current_user.user_id ||
		localStorage.getItem('username') ||
		t('platform.connection.anonymous');
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

	const featuredAgents = useMemo(() => {
		return [...agents]
			.sort(
				(a, b) =>
					Number(b.data.name.includes('企业知识助手')) -
					Number(a.data.name.includes('企业知识助手')),
			)
			.slice(0, 5);
	}, [agents]);
	const agentTemplates = platformAgents?.templates ?? [];
	const publishedPlatformAgents = platformAgents?.agents ?? [];
	const activePlatformAgents = useMemo(
		() => activePlatformAgentsForAgents(publishedPlatformAgents),
		[publishedPlatformAgents],
	);
	const archivedPlatformAgents = useMemo(
		() => archivedPlatformAgentsForAgents(publishedPlatformAgents),
		[publishedPlatformAgents],
	);
	const readyPlatformAgents = useMemo(
		() => readyPlatformAgentsForAgents(activePlatformAgents),
		[activePlatformAgents],
	);
	const selectedRunAgent =
		activePlatformAgents.find((agent) => agent.id === selectedRunAgentId) ?? null;
	const lastPublishedAgent =
		activePlatformAgents.find((agent) => agent.id === lastPublishedAgentId) ?? null;
	const selectedAgentConversation = agentConversations[selectedRunAgentId] ?? [];
	const selectedTemplate =
		agentTemplates.find((template) => template.id === selectedTemplateId) ?? null;
	const defaultAgentTemplate = agentTemplates[0] ?? null;
	const credentialById = useMemo(() => {
		return new Map(credentials.map((credential) => [credential.id, credential]));
	}, [credentials]);
	const knowledgeBaseById = useMemo(() => {
		return new Map(knowledgeBases.map((knowledgeBase) => [knowledgeBase.id, knowledgeBase]));
	}, [knowledgeBases]);
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
		{
			templateTitle: t('platform.agentManagement.wizard.template'),
			templateMissing: t('platform.agentManagement.wizard.templateMissing'),
			modelTitle: t('platform.agentManagement.wizard.model'),
			modelMissing: t('platform.agentManagement.wizard.modelMissing'),
			noModel: t('platform.agentManagement.noModel'),
			knowledgeTitle: t('platform.agentManagement.wizard.knowledge'),
			selectedKnowledge: (count) =>
				t('platform.agentManagement.selectedKnowledge', { count }),
			knowledgeMissing: t('platform.agentManagement.wizard.knowledgeMissing'),
			noKnowledge: t('platform.agentManagement.noKnowledge'),
			toolsTitle: t('platform.agentManagement.wizard.tools'),
			toolsSelected: (count) =>
				t('platform.agentManagement.wizard.toolsSelected', { count }),
			toolsMissing: t('platform.agentManagement.wizard.toolsMissing'),
			runtimeTitle: t('platform.agentManagement.wizard.runtime'),
			runtimeDetail: (values) =>
				t('platform.agentManagement.wizard.runtimeDetail', values),
			enabled: t('platform.agentManagement.enabled'),
			disabled: t('platform.agentManagement.disabled'),
		},
	);
	const nextAgentSetupStep = nextAgentSetupStepForSteps(agentSetupSteps);
	const selectedRunAgentModelLabel = modelCredentialLabel(
		selectedRunAgent?.model_config_id,
		credentialById,
		t('platform.agentManagement.noneConfigured'),
	);
	const selectedRunAgentKnowledgeLabels = knowledgeBaseLabels(
		selectedRunAgent?.knowledge_base_ids ?? [],
		knowledgeBaseById,
	);
	const selectedRunAgentToolCount = selectedRunAgent?.tools?.length ?? 0;
	const selectedRunAgentKnowledgeCount = selectedRunAgentKnowledgeLabels.length;
	const selectedRunAgentReadinessState = agentReadinessState(selectedRunAgent);
	const selectedRunAgentReadinessLabel = selectedRunAgent
		? t(`platform.agentManagement.readiness.${selectedRunAgentReadinessState}`)
		: t('platform.agentManagement.noSelectedAgent');
	const primaryAgentSampleQuestion = agentSampleQuestions[0];
	const nextStepMode =
		credentials.length === 0
			? 'model'
			: activePlatformAgents.length === 0
				? 'publish'
				: readyPlatformAgents.length === 0
					? 'configure'
					: agentRunResult
						? 'governance'
						: 'run';
	const nextStepPrimaryDisabled =
		(nextStepMode === 'publish' &&
			(!defaultAgentTemplate || Boolean(publishingTemplateId))) ||
		(nextStepMode === 'run' && !selectedRunAgent);
	const agentRunModelLabel = modelCredentialLabel(
		agentRunResult?.model_config_id,
		credentialById,
		t('platform.agentManagement.noneConfigured'),
	);
	const agentRunKnowledgeLabels = knowledgeBaseLabels(
		agentRunResult?.knowledge_base_ids ?? [],
		knowledgeBaseById,
	);
	const agentRunConnectorSourceText =
		agentRunResult?.connector_source === 'saved_config'
			? t('platform.agentRunner.connectorSourceSaved')
			: agentRunResult?.connector_source === 'global'
				? t('platform.agentRunner.connectorSourceGlobal')
				: agentRunResult?.connector_source;
	const agentToolCalls: EnterpriseAgentToolCall[] =
		agentRunResult?.tool_calls && agentRunResult.tool_calls.length > 0
			? agentRunResult.tool_calls
			: agentRunResult
				? [
						{
							tool_name: agentRunResult.tool_name || '',
							inputs: agentRunResult.inputs,
							allowed: agentRunResult.routed,
							tenant: agentRunResult.tenant,
							user_id: agentRunResult.user_id,
							connector: agentRunResult.connector,
							connector_source: agentRunResult.connector_source,
							routing_source: agentRunResult.routing_source,
							routing_reason: agentRunResult.routing_reason,
							decision: agentRunResult.decision,
							result: agentRunResult.result,
							answer: agentRunResult.answer,
						},
					]
				: [];
	const agentToolCallBadgeText =
		agentToolCalls.length > 1
			? t('platform.agentRunner.toolCallCount', { count: agentToolCalls.length })
			: agentRunResult?.routed
				? agentRunResult.tool_name || t('platform.agentRunner.notRouted')
				: t('platform.agentRunner.notRouted');
	const agentRunEvidence = agentRunResult?.evidence;
	const enterpriseIdentities = governance?.identities ?? connectors?.identities ?? [];
	const publishTenant =
		publishForm.tenant.trim() || platformStatus?.current_user.tenant || 'default';
	const activePlatformMembers = useMemo(
		() => activePlatformMembersForTenant(platformMembers?.members ?? [], publishTenant),
		[platformMembers?.members, publishTenant],
	);
	const platformMemberById = useMemo(
		() => platformMembersByUserId(platformMembers?.members ?? []),
		[platformMembers?.members],
	);
	const publishAccessMembers = useMemo(
		() =>
			publishAccessMembersForSelection({
				activeMembers: activePlatformMembers,
				memberByUserId: platformMemberById,
				allowedUserIds: publishForm.allowed_user_ids,
				tenant: publishTenant,
			}),
		[activePlatformMembers, platformMemberById, publishForm.allowed_user_ids, publishTenant],
	);
	const publishRoleOptions = useMemo(
		() =>
			publishRoleOptionsForMembers({
				activeMembers: activePlatformMembers,
				configuredRoles: platformMembers?.roles ?? [],
				selectedRoles: publishForm.allowed_roles,
			}),
		[activePlatformMembers, platformMembers?.roles, publishForm.allowed_roles],
	);
	const publishSelectedModelLabel = modelCredentialLabel(
		publishForm.model_config_id,
		credentialById,
		t('platform.agentManagement.noneConfigured'),
		{ shortenFallback: true },
	);
	const publishAccessScopeSummary =
		publishForm.allowed_user_ids.length === 0 && publishForm.allowed_roles.length === 0
			? t('platform.agentManagement.accessOpen')
			: t('platform.agentManagement.releaseAccessRestricted', {
					users: publishForm.allowed_user_ids.length,
					roles: publishForm.allowed_roles.length,
				});
	const publishRuntimeSummary = t('platform.agentManagement.releaseRuntimeSummary', {
		memory: publishForm.memory_enabled
			? t('platform.agentManagement.enabled')
			: t('platform.agentManagement.disabled'),
		workflow: publishForm.workflow_enabled
			? t('platform.agentManagement.enabled')
			: t('platform.agentManagement.disabled'),
	});
	const publishReleaseIssues = publishReleaseIssuesForDraft(
		{
			modelConfigId: publishForm.model_config_id,
			knowledgeBaseCount: publishForm.knowledge_base_ids.length,
		},
		{
			missingModel: t('platform.agentManagement.releaseMissingModel'),
			noKnowledge: t('platform.agentManagement.releaseNoKnowledge'),
		},
	);
	const publishBlocked = !selectedTemplate || !publishForm.model_config_id;
	const selectedIdentity =
		enterpriseIdentities.find((identity) => identity.user_id === selectedIdentityUserId) ??
		enterpriseIdentities[0] ??
		null;
	const selectedRunAgentAccessAllowed = selectedRunAgent
		? agentAccessAllowed(selectedRunAgent, selectedIdentity)
		: true;
	const selectedRunAgentAccessLabelKey = agentRunnerAccessLabelKey(
		selectedRunAgent,
		selectedRunAgentAccessAllowed,
	);
	const selectedRunAgentAccessLabel = selectedRunAgentAccessLabelKey
		? t(selectedRunAgentAccessLabelKey)
		: '';
	const selectedIdentityAllowedTools = useMemo(
		() => selectedIdentity?.tool_policy.decisions.filter((decision) => decision.allowed) ?? [],
		[selectedIdentity],
	);
	const selectedIdentityDeniedTools = useMemo(
		() =>
			selectedIdentity?.tool_policy.decisions.filter((decision) => !decision.allowed) ?? [],
		[selectedIdentity],
	);
	const selectedIdentityWorkspace = selectedIdentity
		? (governance?.tenant_workspaces[selectedIdentity.tenant] ??
			connectors?.tenant_workspaces[selectedIdentity.tenant] ??
			null)
		: null;
	const currentIdentityLabel = selectedIdentity
		? `${selectedIdentity.display_name} / ${selectedIdentity.tenant}`
		: username;

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
			icons: {
				agents: BotMessageSquare,
				credentials: KeyRound,
				knowledgeBases: LibraryBig,
				workflows: Workflow,
			},
			labels: {
				label: (key) => t(`platform.stats.${key}`),
				helper: (key) => t(`platform.stats.${key}Helper`),
			},
		},
	);

	const runtimeItems = runtimeStatusItemsForStatus(
		{
			platformStatus,
			currentIdentityLabel,
		},
		{
			icons: {
				platform: Server,
				userTenant: UserRound,
				connector: Network,
				dataDir: HardDrive,
				auditPath: FileClock,
				auditStatus: ShieldCheck,
			},
			labels: {
				label: (key) => t(`platform.runtime.${key}`),
				unavailable: t('platform.runtime.unavailable'),
				enabled: t('platform.runtime.enabled'),
				disabled: t('platform.runtime.disabled'),
			},
		},
	);

	const policyDecisions = useMemo(
		() => platformStatus?.tool_policy.decisions ?? [],
		[platformStatus],
	);
	const subagentTemplates = platformStatus?.subagent_templates ?? [];
	const toolPolicyMode = platformStatus?.tool_policy.mode || t('platform.runtime.unavailable');
	const toolCatalogItems = useMemo(() => toolCatalog?.tools ?? [], [toolCatalog]);
	const availableToolItems: EnterpriseToolCatalogItem[] = useMemo(
		() =>
			toolCatalogItems.length > 0
				? toolCatalogItems
				: policyDecisions.map((decision) => ({
						name: decision.name,
						description: decision.reason,
						input_key: enterpriseToolInputConfig[decision.name]?.inputKey ?? 'input',
						default_input: enterpriseToolInputConfig[decision.name]?.defaultValue ?? '',
						allowed: decision.allowed,
						reason: decision.reason,
						configured_by_agents: [],
						configured_for_agent: null,
						configured_agent_id: null,
						stats: {
							calls: 0,
							successes: 0,
							failures: 0,
						},
					})),
		[policyDecisions, toolCatalogItems],
	);
	const selectedToolCatalogItem =
		availableToolItems.find((item) => item.name === selectedToolName) ?? null;
	const selectedToolConfig = enterpriseToolInputConfig[selectedToolName];
	const selectedToolDecision = policyDecisions.find(
		(decision) => decision.name === selectedToolName,
	);
	const selectedToolConfigured =
		selectedToolCatalogItem?.configured_for_agent !== false;
	const selectedToolInputKey = selectedToolConfig?.inputKey ?? selectedToolCatalogItem?.input_key;
	const selectedToolInputValue =
		toolInputs[selectedToolName] ??
		selectedToolConfig?.defaultValue ??
		selectedToolCatalogItem?.default_input ??
		'';
	const selectedToolAllowed =
		selectedToolConfigured &&
		(selectedToolCatalogItem?.allowed ?? selectedToolDecision?.allowed ?? false);
	const selectedToolReason =
		selectedToolConfigured
			? (selectedToolCatalogItem?.reason ?? selectedToolDecision?.reason ?? '')
			: t('platform.toolRunner.notConfiguredForAgent');
	const agentRoutingLabel =
		agentRunResult?.routing_mode ||
		agentRunResult?.routing_source ||
		agentRunResult?.decision?.routing_mode ||
		agentRunResult?.decision?.routing_source;
	const agentRoutingText =
		agentRoutingLabel === 'model'
			? t('platform.agentRunner.routingModel')
			: agentRoutingLabel === 'rules'
				? t('platform.agentRunner.routingRules')
				: agentRoutingLabel;
	const connectorState = connectorHealthState(connectors?.current.status);
	const tenantWorkspaces = useMemo(
		() => tenantWorkspaceEntriesForWorkspaces(connectors?.tenant_workspaces),
		[connectors?.tenant_workspaces],
	);
	const tenantWorkspaceByName = useMemo(
		() => tenantWorkspaceByNameForEntries(tenantWorkspaces),
		[tenantWorkspaces],
	);
	const savedConnectorConfigs = connectors?.saved_configs ?? [];
	const activeConnectorTenant = connectorTestForm.tenant.trim() || 'acme';
	const activeSavedConnectorConfig =
		savedConnectorConfigs.find((config) => config.tenant === activeConnectorTenant) ?? null;
	const connectorTimeoutValue = Number.parseFloat(connectorTestForm.timeout_seconds);
	const connectorDraftIssues = connectorDraftIssuesForDraft(
		{
			baseUrl: connectorTestForm.base_url,
			timeoutSeconds: connectorTimeoutValue,
			policyPath: connectorTestForm.policy_path,
			ticketPath: connectorTestForm.ticket_path,
			metricsPath: connectorTestForm.metrics_path,
		},
		{
			baseUrlRequired: t('platform.connectors.validationBaseUrlRequired'),
			baseUrlProtocol: t('platform.connectors.validationBaseUrlProtocol'),
			timeout: t('platform.connectors.validationTimeout'),
			policyPath: t('platform.connectors.validationPolicyPath'),
			ticketPath: t('platform.connectors.validationTicketPath'),
			metricsPath: t('platform.connectors.validationMetricsPath'),
		},
	);
	const connectorDraftMatchesSaved = Boolean(
		activeSavedConnectorConfig &&
			connectorTestForm.base_url.trim() === activeSavedConnectorConfig.base_url &&
			connectorTestForm.policy_path.trim() === activeSavedConnectorConfig.policy_path &&
			connectorTestForm.ticket_path.trim() === activeSavedConnectorConfig.ticket_path &&
			connectorTestForm.metrics_path.trim() === activeSavedConnectorConfig.metrics_path &&
			Number.isFinite(connectorTimeoutValue) &&
			connectorTimeoutValue === activeSavedConnectorConfig.timeout_seconds &&
			connectorTestForm.enabled === activeSavedConnectorConfig.enabled &&
			!connectorTestForm.token.trim(),
	);
	const connectorDraftState: HealthState =
		connectorDraftIssues.length > 0
			? 'todo'
			: connectorDraftMatchesSaved
				? 'ready'
				: 'partial';
	const connectorTestPassed = connectorTestResult?.status === 'success';
	const connectorRuntimeState = connectors?.runtime.saved_config_enabled
		? 'ready'
		: connectorState;
	const connectorRuntimeSourceText =
		connectors?.runtime.source === 'saved_config'
			? t('platform.connectors.runtimeSavedConfig')
			: t('platform.connectors.runtimeGlobal');
	const workflowTemplateByType = useMemo(
		() => workflowTemplateByTypeForTemplates(workflowTemplates),
		[workflowTemplates],
	);
	const selectedWorkflowTemplate = workflowTemplateByType.get(selectedWorkflowType) ?? null;
	const workflowOptions = useMemo(() => {
		if (workflowTemplates.length > 0) {
			return workflowTemplates.map((template) => ({
				value: template.workflow_type,
				label: template.name,
				enabled: template.enabled,
				defaultInputs: template.default_inputs,
			}));
		}

		return enterpriseWorkflowOptions.map((workflow) => ({
			value: workflow.value,
			label: t(`platform.workflowRunner.${workflow.labelKey}`),
			enabled: true,
			defaultInputs: defaultEnterpriseWorkflowInputs,
		}));
	}, [t, workflowTemplates]);
	const selectedWorkflowDisabled = Boolean(
		selectedWorkflowTemplate && !selectedWorkflowTemplate.enabled,
	);
	const dashboard = platformStatus?.dashboard;
	const dashboardOperations = dashboard?.operations;
	const pendingApprovals =
		governance?.pending_approvals ??
		dashboard?.pending_approvals.items ??
		approvalRequests.filter((approval) => approval.status === 'pending');
	const approvedApprovalCount =
		dashboard?.approved_approval_count ??
		approvalRequests.filter((approval) => approval.status === 'approved').length;
	const approvalSummary = useMemo(
		() => ({
			total: approvalRequests.length,
			pending: approvalRequests.filter((approval) => approval.status === 'pending').length,
			approved: approvalRequests.filter((approval) => approval.status === 'approved').length,
			rejected: approvalRequests.filter((approval) => approval.status === 'rejected').length,
		}),
		[approvalRequests],
	);
	const recentWorkflowRuns =
		dashboard?.recent_workflow_runs ?? workflowRuns.slice(0, 3);
	const workflowRunCount = dashboard?.workflow_run_count ?? workflowRuns.length;
	const recentAuditEvents =
		dashboard?.recent_audit_events ?? auditEvents.slice(0, 4);
	const auditEventCount = dashboard?.audit_event_count ?? auditEvents.length;
	const tenantOverviewItems = useMemo(() => {
		return tenantOverviewItemsForWorkspace(
			{
				tenantWorkspaces,
				tenantWorkspaceByName,
				enterpriseIdentities,
				activePlatformAgents,
				pendingApprovals,
				auditEvents,
				workflowRuns,
			},
			{
				localSource: t('platform.tenantWorkspace.localSource'),
			},
		);
	}, [
		activePlatformAgents,
		auditEvents,
		enterpriseIdentities,
		pendingApprovals,
		t,
		tenantWorkspaceByName,
		tenantWorkspaces,
		workflowRuns,
	]);
	const platformMemberTenantSummaries = useMemo(() => {
		return platformMemberTenantSummariesForMembers({
			members: platformMembers?.members ?? [],
			activePlatformAgents,
			pendingApprovals,
			auditEvents,
		});
	}, [activePlatformAgents, auditEvents, pendingApprovals, platformMembers?.members]);
	const memoryOperationsItems = useMemo(() => {
		return memoryOperationsItemsForConversations({
			activePlatformAgents,
			agentConversations,
		});
	}, [activePlatformAgents, agentConversations]);
	const memoryOperationsSummary = memoryOperationsSummaryForItems(memoryOperationsItems);
	const memoryOperationsRunCount = memoryOperationsSummary.runCount;
	const memoryOperationsHitCount = memoryOperationsSummary.hitCount;
	const memoryOperationsSavedCount = memoryOperationsSummary.savedCount;
	const riskToolItems = dashboardRiskToolItemsForStatus({
		dashboardRiskTools: dashboard?.risk_tools,
		availableToolItems,
	});
	const dashboardOperationsSummary =
		dashboardOperationsSummaryForOperations(dashboardOperations);
	const completedWorkflowRunCount = dashboardOperationsSummary.completedWorkflowRunCount;
	const partialWorkflowRunCount = dashboardOperationsSummary.partialWorkflowRunCount;
	const failedWorkflowRunCount = dashboardOperationsSummary.failedWorkflowRunCount;
	const governedWorkflowItems = dashboardOperationsSummary.governedWorkflowItems;
	const recommendedOperationActions =
		dashboardOperationsSummary.recommendedOperationActions;
	const dashboardTodoItems = dashboardTodoItemsForStatus(
		{
			credentialCount: credentials.length,
			activeAgentCount: activePlatformAgents.length,
			readyAgentCount: readyPlatformAgents.length,
			pendingApprovalCount: pendingApprovals.length,
			hasErrors,
		},
		{
			model: t('platform.dashboard.todoModel'),
			agent: t('platform.dashboard.todoAgent'),
			agentReadiness: t('platform.dashboard.todoAgentReadiness'),
			approval: (count) => t('platform.dashboard.todoApproval', { count }),
			errors: t('platform.dashboard.todoErrors'),
		},
	);
	const appCenterDerivedState = appCenterDerivedStateForStatus({
		selectedItem: selectedAppCenterItem,
		activeAgents: activePlatformAgents,
		readyAgents: readyPlatformAgents,
		templates: agentTemplates,
		defaultTemplate: defaultAgentTemplate,
		hasCredentials: credentials.length > 0,
		publishingTemplateId,
	});
	const blockedOrPartialPlatformAgents = appCenterDerivedState.blockedOrPartialAgents;
	const appCenterAgents = appCenterDerivedState.appCenterAgents;
	const appCenterSelection = appCenterDerivedState.selection;
	const inspectedAppCenterAgent = appCenterSelection.inspectedAgent;
	const inspectedAppCenterTemplate = appCenterSelection.inspectedTemplate;
	const appCenterPrimaryDisabled = appCenterSelection.primaryDisabled;
	const agentOpsSummary = agentOpsSummaryItems(
		{
			published: publishedPlatformAgents.length,
			active: activePlatformAgents.length,
			ready: readyPlatformAgents.length,
			needsSetup: blockedOrPartialPlatformAgents.length,
			archived: archivedPlatformAgents.length,
		},
		{
			publishedTotal: t('platform.agentManagement.ops.publishedTotal'),
			publishedTotalHelper: t('platform.agentManagement.ops.publishedTotalHelper'),
			activeTotal: t('platform.agentManagement.ops.activeTotal'),
			activeTotalHelper: t('platform.agentManagement.ops.activeTotalHelper'),
			readyTotal: t('platform.agentManagement.ops.readyTotal'),
			readyTotalHelper: t('platform.agentManagement.ops.readyTotalHelper'),
			needsSetupTotal: t('platform.agentManagement.ops.needsSetupTotal'),
			needsSetupTotalHelper: ({ count }) =>
				t('platform.agentManagement.ops.needsSetupTotalHelper', { count }),
		},
	);
	const topOperationsAgents = topOperationsAgentsForDisplay(
		readyPlatformAgents,
		blockedOrPartialPlatformAgents,
		publishedPlatformAgents,
	);
	const operationsAgentIssueText = (agent: EnterprisePublishedAgent) => {
		return formatOperationsAgentIssueText(agent, {
			archived: t('platform.operations.archivedIssue'),
			missing: t('platform.operations.missingIssue'),
			ready: t('platform.operations.readyIssue'),
		});
	};
	const agentResourceText = (agent: EnterprisePublishedAgent) => {
		const resources = agentResourceSummary(
			agent,
			credentialById,
			t('platform.appCenter.noModel'),
		);

		return t('platform.appCenter.agentResources', {
			model: resources.model,
			knowledge: resources.knowledge,
			tools: resources.tools,
		});
	};
	const inspectedAppCenterAgentReadiness = agentReadinessState(inspectedAppCenterAgent);
	const inspectedAppCenterAgentIssues = agentReadinessIssues(inspectedAppCenterAgent);
	const inspectedAppCenterResourceValues = appCenterDetailResourceValuesForSelection({
		agent: inspectedAppCenterAgent,
		template: inspectedAppCenterTemplate,
		credentialById,
		knowledgeBaseById,
		modelCount: credentials.length,
		knowledgeBaseCount: knowledgeBases.length,
		labels: {
			noModel: t('platform.appCenter.noModel'),
			access: {
				restricted: ({ users, roles }) =>
					t('platform.appCenter.restrictedAccess', { users, roles }),
				open: t('platform.appCenter.tenantAccess'),
			},
			runtime: {
				value: ({ memory, workflow }) =>
					t('platform.appCenter.runtimeValue', { memory, workflow }),
				enabled: t('platform.agentManagement.enabled'),
				disabled: t('platform.agentManagement.disabled'),
			},
		},
	});
	const appCenterDetailResources = appCenterDetailResourcesForSelection(
		{
			agent: inspectedAppCenterResourceValues.agent,
			template: inspectedAppCenterResourceValues.template,
		},
		{
			model: t('platform.appCenter.model'),
			knowledgeBases: t('platform.appCenter.knowledgeBases'),
			tools: t('platform.appCenter.tools'),
			runtime: t('platform.appCenter.runtime'),
			access: t('platform.appCenter.access'),
			none: t('platform.appCenter.none'),
			availableModels: (count) => t('platform.appCenter.availableModels', { count }),
			noModel: t('platform.appCenter.noModel'),
			availableKnowledgeBases: (count) =>
				t('platform.appCenter.availableKnowledgeBases', { count }),
			templateRuntime: t('platform.appCenter.templateRuntime'),
		},
	);
	const appCenterDetailHealth = appCenterDetailHealthState({
		hasAgent: Boolean(inspectedAppCenterAgent),
		agentReadiness: inspectedAppCenterAgentReadiness,
		agentIssues: inspectedAppCenterAgentIssues,
		hasTemplate: Boolean(inspectedAppCenterTemplate),
		hasCredentials: credentials.length > 0,
		hasKnowledgeBases: knowledgeBases.length > 0,
		labels: {
			missingModel: t('platform.dashboard.todoModel'),
			missingKnowledge: t('platform.agentManagement.noKnowledge'),
		},
	});
	const appCenterDetailIssues = appCenterDetailHealth.issues;
	const appCenterDetailStatus = appCenterDetailHealth.status;
	const operationsHeadline = operationsHeadlineText(
		{
			activeAgentCount: activePlatformAgents.length,
			blockedOrPartialAgentCount: blockedOrPartialPlatformAgents.length,
			pendingApprovalCount: pendingApprovals.length,
		},
		{
			empty: t('platform.operations.headlineEmpty'),
			needsWork: ({ count }) => t('platform.operations.headlineNeedsWork', { count }),
			approvals: ({ count }) => t('platform.operations.headlineApprovals', { count }),
			ready: t('platform.operations.headlineReady'),
		},
	);
	const agentReleasePipeline = agentReleasePipelineItems(
		{
			selectedTemplate,
			modelConfigId: publishForm.model_config_id,
			credentialById,
			knowledgeBaseCount: publishForm.knowledge_base_ids.length,
			toolCount: publishForm.tools.length,
			memoryEnabled: publishForm.memory_enabled,
			workflowEnabled: publishForm.workflow_enabled,
			activeAgentCount: activePlatformAgents.length,
			pendingApprovalCount: pendingApprovals.length,
			auditEventCount,
			hasSelectedRunAgent: Boolean(selectedRunAgent),
			stepStates: agentSetupSteps,
		},
		{
			template: t('platform.agentManagement.pipeline.template'),
			templateDetail: t('platform.agentManagement.pipeline.templateDetail'),
			model: t('platform.agentManagement.pipeline.model'),
			modelDetail: t('platform.agentManagement.pipeline.modelDetail'),
			knowledge: t('platform.agentManagement.pipeline.knowledge'),
			selectedKnowledge: ({ count }) =>
				t('platform.agentManagement.selectedKnowledge', { count }),
			knowledgeDetail: t('platform.agentManagement.pipeline.knowledgeDetail'),
			tools: t('platform.agentManagement.pipeline.tools'),
			toolsSelected: ({ count }) =>
				t('platform.agentManagement.wizard.toolsSelected', { count }),
			toolsDetail: t('platform.agentManagement.pipeline.toolsDetail'),
			runtime: t('platform.agentManagement.pipeline.runtime'),
			runtimeDetail: ({ memory, workflow }) =>
				t('platform.agentManagement.wizard.runtimeDetail', { memory, workflow }),
			enabled: t('platform.agentManagement.enabled'),
			disabled: t('platform.agentManagement.disabled'),
			publish: t('platform.agentManagement.pipeline.publish'),
			publishDetailReady: ({ count }) =>
				t('platform.agentManagement.pipeline.publishDetailReady', { count }),
			publishDetail: t('platform.agentManagement.pipeline.publishDetail'),
			governance: t('platform.agentManagement.pipeline.governance'),
			governanceDetailPending: ({ count }) =>
				t('platform.agentManagement.pipeline.governanceDetailPending', { count }),
			governanceDetail: t('platform.agentManagement.pipeline.governanceDetail'),
		},
		{
			template: ListChecks,
			model: KeyRound,
			knowledge: LibraryBig,
			tools: Boxes,
			runtime: Brain,
			publish: BotMessageSquare,
			governance: ShieldCheck,
		},
	) satisfies Array<{
		key: string;
		title: string;
		detail: string;
		state: HealthState;
		icon: ComponentType<{ className?: string }>;
	}>;
	const identityAccessRows = identityAccessRowsForGovernance(
		enterpriseIdentities,
		pendingApprovals,
		governance,
	);
	const accessTenantSummaries = accessTenantSummariesForGovernance(
		enterpriseIdentities,
		pendingApprovals,
		governance,
	);
	const selectedIdentityGovernanceActivity = useMemo(
		() =>
			selectedIdentityGovernanceActivityForIdentity({
				selectedIdentity,
				pendingApprovals,
				auditEvents,
			}),
		[auditEvents, pendingApprovals, selectedIdentity],
	);
	const selectedIdentityPendingApprovals =
		selectedIdentityGovernanceActivity.selectedIdentityPendingApprovals;
	const selectedIdentityPendingToolNames =
		selectedIdentityGovernanceActivity.selectedIdentityPendingToolNames;
	const toolPolicySummary = useMemo(() => {
		return toolPolicySummaryForGovernance(
			availableToolItems,
			toolPolicyDraft,
			selectedIdentityPendingToolNames,
		);
	}, [availableToolItems, selectedIdentityPendingToolNames, toolPolicyDraft]);
	const selectedIdentityFailedAuditEvents =
		selectedIdentityGovernanceActivity.selectedIdentityFailedAuditEvents;
	const selectedIdentityRecentAuditEvents =
		selectedIdentityGovernanceActivity.selectedIdentityRecentAuditEvents;
	const riskyIdentityCount =
		governance?.summary.risky_identity_count ??
		identityAccessRows.filter((row) => row.risk > 0).length;
	const accessControlStats = accessControlStatsForGovernance(
		{
			identityCount: enterpriseIdentities.length,
			tenantCount: accessTenantSummaries.length,
			riskyIdentityCount,
			selectedIdentityPendingApprovalCount: selectedIdentityPendingApprovals.length,
		},
		{
			identities: t('platform.accessControl.identities'),
			tenants: t('platform.accessControl.tenants'),
			riskyIdentities: t('platform.accessControl.riskyIdentities'),
			pendingApprovals: t('platform.accessControl.pendingApprovals'),
		},
	);
	const governanceHealthItems = governanceHealthItemsForSummary(
		{
			governanceSummary: governance?.summary,
			tenantCount: accessTenantSummaries.length,
			identityCount: enterpriseIdentities.length,
			pendingApprovalCount: pendingApprovals.length,
			auditEventCount,
		},
		{
			tenants: t('platform.governanceHealth.tenants'),
			tenantsHelper: t('platform.governanceHealth.tenantsHelper'),
			identities: t('platform.governanceHealth.identities'),
			identitiesHelper: t('platform.governanceHealth.identitiesHelper'),
			pendingApprovals: t('platform.governanceHealth.pendingApprovals'),
			pendingApprovalsHelper: t('platform.governanceHealth.pendingApprovalsHelper'),
			auditEvents: t('platform.governanceHealth.auditEvents'),
			auditEventsHelper: t('platform.governanceHealth.auditEventsHelper'),
			auditEventsFailedHelper: ({ count }) =>
				t('platform.governanceHealth.auditEventsFailedHelper', { count }),
		},
		{
			tenants: Building2,
			identities: UserRound,
			pendingApprovals: AlertTriangle,
			auditEvents: FileClock,
		},
	);
	const workflowPendingApprovals = pendingWorkflowRunApprovals(pendingApprovals);
	const enabledWorkflowTemplates = enabledEnterpriseWorkflowTemplates(workflowTemplates);
	const selectedWorkflowOption = workflowOptions.find(
		(workflow) => workflow.value === selectedWorkflowType,
	);
	const selectedWorkflowName =
		selectedWorkflowTemplate?.name ??
		selectedWorkflowOption?.label ??
		selectedWorkflowType;
	const selectedWorkflowSteps = selectedWorkflowTemplate?.steps ?? [];
	const selectedWorkflowLastRun =
		recentWorkflowRuns.find((run) => run.workflow_type === selectedWorkflowType) ??
		recentWorkflowRuns[0] ??
		null;
	const workflowOpsStats = workflowOpsStatsForSummary(
		{
			workflowTemplateCount: workflowTemplates.length,
			workflowOptionCount: workflowOptions.length,
			enabledWorkflowTemplateCount: enabledWorkflowTemplates.length,
			workflowRunCount,
			workflowPendingApprovalCount: workflowPendingApprovals.length,
		},
		{
			templates: t('platform.workflowOps.templates'),
			enabled: t('platform.workflowOps.enabled'),
			runs: t('platform.workflowOps.runs'),
			approvals: t('platform.workflowOps.approvals'),
		},
	);
	const enabledSchedules = enabledTriggerSchedules(schedules);
	const agentSourceSchedules = triggerSchedulesBySource(schedules, 'AGENT');
	const userSourceSchedules = triggerSchedulesBySource(schedules, 'USER');
	const recentSchedules = recentTriggerSchedules(schedules);
	const triggerOpsStats = triggerOpsStatsForSummary(
		{
			scheduleCount: schedules.length,
			enabledScheduleCount: enabledSchedules.length,
			agentSourceScheduleCount: agentSourceSchedules.length,
			userSourceScheduleCount: userSourceSchedules.length,
		},
		{
			schedules: t('platform.triggerOps.schedules'),
			enabled: t('platform.triggerOps.enabled'),
			agentSource: t('platform.triggerOps.agentSource'),
			userSource: t('platform.triggerOps.userSource'),
		},
	);
	const triggerOpsSummary = triggerOpsSummaryText(
		{
			scheduleCount: schedules.length,
			enabledScheduleCount: enabledSchedules.length,
		},
		{
			manual: t('platform.triggerOps.summaryManual'),
			paused: t('platform.triggerOps.summaryPaused'),
			active: ({ count }) => t('platform.triggerOps.summaryActive', { count }),
		},
	);
	const auditStats = auditStatsForSummary(
		{
			auditSummary,
			auditEvents,
		},
		{
			returned: t('platform.audit.summaryReturned'),
			successes: t('platform.audit.summarySuccesses'),
			failures: t('platform.audit.summaryFailures'),
			avgDuration: t('platform.audit.summaryAvgDuration'),
		},
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
		const nextDraft: Record<string, ToolPolicyDraftValue> = {};
		const allowed = new Set(selectedIdentityAllowedTools.map((decision) => decision.name));
		const denied = new Set(selectedIdentityDeniedTools.map((decision) => decision.name));

		availableToolItems.forEach((tool) => {
			if (denied.has(tool.name)) {
				nextDraft[tool.name] = 'deny';
			} else if (allowed.has(tool.name)) {
				nextDraft[tool.name] = 'allow';
			} else {
				nextDraft[tool.name] = 'inherit';
			}
		});

		setToolPolicyDraft(nextDraft);
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
		const savedConfig = connectors.saved_configs[0];
		setConnectorTestForm((previous) => ({
			...previous,
			base_url: savedConfig?.base_url || previous.base_url,
			token: '',
			tenant:
				savedConfig?.tenant ||
				connectors.identities[0]?.tenant ||
				previous.tenant ||
				'acme',
			policy_path:
				savedConfig?.policy_path ||
				connectors.http_paths.policy ||
				previous.policy_path ||
				'/tenants/{tenant}/policies/search',
			ticket_path:
				savedConfig?.ticket_path ||
				connectors.http_paths.ticket ||
				previous.ticket_path ||
				'/tenants/{tenant}/tickets/{ticket_id}',
			metrics_path:
				savedConfig?.metrics_path ||
				connectors.http_paths.metrics ||
				previous.metrics_path ||
				'/tenants/{tenant}/departments/{department}/metrics',
			timeout_seconds: savedConfig
				? String(savedConfig.timeout_seconds)
				: previous.timeout_seconds,
			enabled: savedConfig?.enabled ?? previous.enabled,
		}));
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
			return agentConversations[selectedRunAgentId]?.[0]?.response ?? null;
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
				error instanceof Error ? error.message : t('platform.connectors.loadError'),
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
				error instanceof Error ? error.message : t('platform.audit.loadError'),
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
			if (!platformConfigImportText.trim()) {
				setPlatformConfigImportText(JSON.stringify(response, null, 2));
			}
		} catch (error) {
			setPlatformConfigError(
				error instanceof Error
					? error.message
					: t('platform.configManagement.loadError'),
			);
		} finally {
			setPlatformConfigLoading(false);
		}
	}

	async function handleCopyPlatformConfig() {
		if (!platformConfigExport) {
			return;
		}

		const text = JSON.stringify(platformConfigExport, null, 2);
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
			const parsed = JSON.parse(platformConfigImportText);
			const response = await platformApi.importConfig({
				mode: platformConfigImportMode,
				config: parsed,
			});
			setPlatformConfigImportResult(
				t('platform.configManagement.importSuccess', {
					members: response.counts.members,
					agents: response.counts.agents,
				}),
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
				error instanceof SyntaxError
					? t('platform.configManagement.parseError')
					: error instanceof Error
						? error.message
						: t('platform.configManagement.importError'),
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
				error instanceof Error ? error.message : t('platform.members.loadError'),
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
			setPlatformMembersError(t('platform.members.userRequired'));
			return;
		}

		setSavingMember(true);
		setPlatformMembersError(null);
		try {
			await platformApi.createMember({
				user_id: userId,
				tenant: memberForm.tenant.trim() || 'default',
				display_name: memberForm.display_name.trim() || userId,
				role: memberForm.role.trim() || 'Member',
				status: memberForm.status,
			});
			setMemberForm(defaultMemberForm);
			await refreshMemberDependentViews();
		} catch (error) {
			setPlatformMembersError(
				error instanceof Error ? error.message : t('platform.members.saveError'),
			);
		} finally {
			setSavingMember(false);
		}
	}

	function handleEditMember(member: EnterprisePlatformMember) {
		setMemberForm({
			user_id: member.user_id,
			tenant: member.tenant || 'acme',
			display_name: member.display_name || member.user_id,
			role: member.role || '',
			status: member.status === 'inactive' ? 'inactive' : 'active',
		});
	}

	async function handleToggleMemberStatus(member: EnterprisePlatformMember) {
		setUpdatingMemberId(member.user_id);
		setPlatformMembersError(null);
		try {
			if (member.status === 'inactive') {
				await platformApi.updateMember(member.user_id, { status: 'active' });
			} else {
				await platformApi.deactivateMember(member.user_id);
			}
			await refreshMemberDependentViews();
		} catch (error) {
			setPlatformMembersError(
				error instanceof Error ? error.message : t('platform.members.saveError'),
			);
		} finally {
			setUpdatingMemberId(null);
		}
	}

	function loadSavedConnectorConfig(config: EnterpriseConnectorSavedConfig) {
		setConnectorTestForm((previous) => ({
			...previous,
			base_url: config.base_url,
			token: '',
			tenant: config.tenant,
			policy_path: config.policy_path || previous.policy_path,
			ticket_path: config.ticket_path || previous.ticket_path,
			metrics_path: config.metrics_path || previous.metrics_path,
			timeout_seconds:
				Number.isFinite(config.timeout_seconds) && config.timeout_seconds > 0
					? String(config.timeout_seconds)
					: previous.timeout_seconds,
			enabled: config.enabled,
		}));
		setConnectorTestResult(null);
		setConnectorTestError(null);
		setConnectorSaveError(null);
		setConnectorSaveSuccess(null);
	}

	async function handleSaveConnectorConfig() {
		const baseUrl = connectorTestForm.base_url.trim();
		if (!baseUrl) {
			setConnectorSaveError(t('platform.connectors.saveBaseUrlRequired'));
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
			const timeout = Number.parseFloat(connectorTestForm.timeout_seconds);
			const response = await platformApi.saveConnectorConfig({
				base_url: baseUrl,
				token: connectorTestForm.token.trim() || undefined,
				tenant: connectorTestForm.tenant.trim() || 'acme',
				policy_path:
					connectorTestForm.policy_path.trim() ||
					'/tenants/{tenant}/policies/search',
				ticket_path:
					connectorTestForm.ticket_path.trim() ||
					'/tenants/{tenant}/tickets/{ticket_id}',
				metrics_path:
					connectorTestForm.metrics_path.trim() ||
					'/tenants/{tenant}/departments/{department}/metrics',
				timeout_seconds: Number.isFinite(timeout) && timeout > 0 ? timeout : 5,
				enabled: connectorTestForm.enabled,
			});
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
				t('platform.connectors.saveSuccessWithTenant', {
					tenant: response.config.tenant,
				}),
			);
			await refetchConnectors();
			await refetchGovernance();
			await refetchOpsTasks();
		} catch (error) {
			setConnectorSaveError(
				error instanceof Error ? error.message : t('platform.connectors.saveError'),
			);
		} finally {
			setSavingConnectorConfig(false);
		}
	}

	async function handleTestConnector() {
		const baseUrl = connectorTestForm.base_url.trim();
		if (!baseUrl) {
			setConnectorTestError(t('platform.connectors.testBaseUrlRequired'));
			return null;
		}
		if (connectorDraftIssues.length > 0) {
			setConnectorTestError(connectorDraftIssues[0]);
			return null;
		}

		setTestingConnector(true);
		setConnectorTestError(null);
		try {
			const timeout = Number.parseFloat(connectorTestForm.timeout_seconds);
			const response = await platformApi.testConnector({
				base_url: baseUrl,
				token: connectorTestForm.token.trim() || undefined,
				tenant: connectorTestForm.tenant.trim() || 'acme',
				policy_keyword: connectorTestForm.policy_keyword.trim() || 'remote',
				ticket_id: connectorTestForm.ticket_id.trim() || 'INC-1001',
				department: connectorTestForm.department.trim() || 'engineering',
				policy_path:
					connectorTestForm.policy_path.trim() ||
					'/tenants/{tenant}/policies/search',
				ticket_path:
					connectorTestForm.ticket_path.trim() ||
					'/tenants/{tenant}/tickets/{ticket_id}',
				metrics_path:
					connectorTestForm.metrics_path.trim() ||
					'/tenants/{tenant}/departments/{department}/metrics',
				timeout_seconds: Number.isFinite(timeout) && timeout > 0 ? timeout : 5,
			});
			setConnectorTestResult(response);
			return response;
		} catch (error) {
			setConnectorTestError(
				error instanceof Error ? error.message : t('platform.connectors.testError'),
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
			setConnectorSaveError(t('platform.connectors.testBeforeSaveRequired'));
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
				error instanceof Error ? error.message : t('platform.toolCatalog.loadError'),
			);
		} finally {
			setToolCatalogLoading(false);
		}
	}

	async function handleSaveToolPolicy() {
		if (!selectedIdentity) {
			setToolPolicySaveError(t('platform.tenantGovernance.noIdentity'));
			setToolPolicySaveSuccess(null);
			return;
		}

		setSavingToolPolicy(true);
		setToolPolicySaveError(null);
		setToolPolicySaveSuccess(null);
		try {
			const allow = Object.entries(toolPolicyDraft)
				.filter(([, value]) => value === 'allow')
				.map(([name]) => name);
			const deny = Object.entries(toolPolicyDraft)
				.filter(([, value]) => value === 'deny')
				.map(([name]) => name);

			await platformApi.updateToolPolicy({
				tenant: selectedIdentity.tenant,
				user_id: selectedIdentity.user_id,
				allow,
				deny,
			});

			setToolPolicySaveSuccess(t('platform.tenantGovernance.policySaved'));
			await Promise.all([refetchPlatform(), refetchGovernance(), refetchToolCatalog()]);
			await refetchOpsTasks();
		} catch (error) {
			setToolPolicySaveError(
				error instanceof Error
					? error.message
					: t('platform.tenantGovernance.policySaveError'),
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
				error instanceof Error ? error.message : t('platform.agentRunner.historyLoadError'),
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
			setAuditError(error instanceof Error ? error.message : t('platform.audit.loadError'));
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
				error instanceof Error ? error.message : t('platform.agentManagement.loadError'),
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
				error instanceof Error ? error.message : t('platform.workflowRunner.templatesLoadError'),
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
				error instanceof Error ? error.message : t('platform.workflowRunner.historyLoadError'),
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
				error instanceof Error ? error.message : t('platform.scenarios.loadError'),
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
				error instanceof Error ? error.message : t('platform.opsTasks.loadError'),
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
			const limitValue = Number.parseInt(filters.limit, 10);
			const response = await platformApi.approvals({
				status: filters.status || undefined,
				tenant: filters.tenant || undefined,
				user_id: filters.user_id || undefined,
				agent_id: filters.agent_id || undefined,
				limit: Number.isFinite(limitValue) ? limitValue : 20,
			});
			setApprovalRequests(response.approvals);
		} catch (error) {
			setApprovalError(
				error instanceof Error ? error.message : t('platform.approvals.loadError'),
			);
		} finally {
			setApprovalLoading(false);
		}
	}

	async function handleCreateApproval() {
		const inputKey = approvalForm.input_key.trim();
		const inputValue = approvalForm.input_value.trim();
		const inputs = inputKey ? { [inputKey]: inputValue } : {};

		setCreatingApproval(true);
		setApprovalError(null);
		try {
			const response = await platformApi.createApproval({
				request_type: approvalForm.request_type,
				tool_name:
					approvalForm.request_type === 'tool_run'
						? approvalForm.tool_name.trim()
						: undefined,
				workflow_type:
					approvalForm.request_type === 'workflow_run'
						? approvalForm.workflow_type.trim()
						: undefined,
				inputs,
				reason: approvalForm.reason.trim() || undefined,
				user_id:
					approvalForm.user_id.trim() || selectedIdentityUserId || username || undefined,
				agent_id: approvalForm.agent_id.trim() || selectedRunAgentId || undefined,
			});
			if (response.approval) {
				setApprovalRequests((current) => [response.approval!, ...current]);
			}
			await refetchGovernance();
			await refetchOpsTasks();
			setApprovalForm((current) => ({
				...current,
				reason: defaultApprovalForm.reason,
			}));
		} catch (error) {
			setApprovalError(
				error instanceof Error ? error.message : t('platform.approvals.createError'),
			);
		} finally {
			setCreatingApproval(false);
		}
	}

	async function handleCreateRunApproval(
		requestType: 'tool_run' | 'workflow_run',
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
			const response = await platformApi.createApproval({
				request_type: requestType,
				tool_name: requestType === 'tool_run' ? selectedToolName : undefined,
				workflow_type:
					requestType === 'workflow_run' ? selectedWorkflowType : undefined,
				inputs,
				reason: reason || t('platform.approvals.runApprovalReason'),
				user_id: selectedIdentityUserId || username || undefined,
				agent_id: selectedRunAgentId || undefined,
			});
			if (response.approval) {
				setApprovalRequests((current) => [response.approval!, ...current]);
			}
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
				error instanceof Error ? error.message : t('platform.approvals.createError');
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
			const request = {
				decided_by: username,
				decision_note:
					decision === 'approved'
						? t('platform.approvals.approved')
						: t('platform.approvals.rejected'),
			};
			const response =
				decision === 'approved'
					? await platformApi.approveApproval(approvalId, request)
					: await platformApi.rejectApproval(approvalId, request);
			setApprovalRequests((current) =>
				current.map((approval) =>
					approval.approval_id === approvalId ? response.approval : approval,
				),
			);
			await refetchGovernance();
			await refetchOpsTasks();
		} catch (error) {
			setApprovalError(
				error instanceof Error ? error.message : t('platform.approvals.decisionError'),
			);
		} finally {
			setDecidingApprovalId(null);
		}
	}

	async function handleApproveAndRun(approval: EnterpriseApprovalRequestItem) {
		const canContinueAgentRun =
			approval.request_type === 'tool_run' &&
			Boolean(approval.tool_name) &&
			Boolean(approval.agent_id) &&
			approval.agent_id !== 'platform-console';
		const canContinueToolRun =
			approval.request_type === 'tool_run' && Boolean(approval.tool_name);
		const canContinueWorkflowRun =
			approval.request_type === 'workflow_run' && Boolean(approval.workflow_type);

		if (!canContinueToolRun && !canContinueWorkflowRun) {
			return;
		}

		setContinuingApprovalId(approval.approval_id);
		setApprovalError(null);
		try {
			const response = await platformApi.approveApproval(approval.approval_id, {
				decided_by: username,
				decision_note: t('platform.approvals.approved'),
			});
			setApprovalRequests((current) =>
				current.map((item) =>
					item.approval_id === approval.approval_id ? response.approval : item,
				),
			);
			await refetchGovernance();
			await refetchOpsTasks();

			if (canContinueAgentRun && approval.tool_name) {
				const department = approval.inputs?.department;
				const question =
					department != null
						? `帮我看一下 ${String(department)} 部门指标`
						: agentQuestion.trim();

				setSelectedIdentityUserId(approval.user_id);
				setSelectedRunAgentId(approval.agent_id);
				setAgentApprovalId(approval.approval_id);
				setAgentQuestion(question);
				window.setTimeout(scrollToAgentRunner, 0);
				await runEnterpriseAgent({
					agentId: approval.agent_id,
					question,
					userId: approval.user_id,
					approvalId: approval.approval_id,
				});
				return;
			}

			if (canContinueToolRun && approval.tool_name) {
				const toolConfig = enterpriseToolInputConfig[approval.tool_name];
				const inputEntries = Object.entries(approval.inputs ?? {});
				const inputKey = toolConfig?.inputKey ?? inputEntries[0]?.[0];
				const inputValue =
					inputKey && approval.inputs?.[inputKey] != null
						? approval.inputs[inputKey]
						: inputEntries[0]?.[1];

				setSelectedIdentityUserId(approval.user_id);
				setSelectedRunAgentId(approval.agent_id);
				setSelectedToolName(approval.tool_name);
				setToolInputs((current) => ({
					...current,
					[approval.tool_name!]: inputValue == null ? '' : String(inputValue),
				}));
				setToolApprovalId(approval.approval_id);
				window.setTimeout(scrollToToolRunner, 0);
				await runEnterpriseTool({
					toolName: approval.tool_name,
					inputs: approval.inputs,
					userId: approval.user_id,
					agentId: approval.agent_id,
					approvalId: approval.approval_id,
				});
				return;
			}

			if (canContinueWorkflowRun && approval.workflow_type) {
				const inputs = normalizeWorkflowInputs(approval.inputs);

				setSelectedIdentityUserId(approval.user_id);
				setSelectedRunAgentId(approval.agent_id);
				setSelectedWorkflowType(approval.workflow_type);
				setWorkflowInputs(inputs);
				setWorkflowApprovalId(approval.approval_id);
				window.setTimeout(scrollToWorkflowRunner, 0);
				await runEnterpriseWorkflow({
					workflowType: approval.workflow_type,
					inputs,
					userId: approval.user_id,
					agentId: approval.agent_id,
					approvalId: approval.approval_id,
				});
			}
		} catch (error) {
			setApprovalError(
				error instanceof Error ? error.message : t('platform.approvals.approveAndRunError'),
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
				error instanceof Error ? error.message : t('platform.workflowRunner.templatesLoadError'),
			);
		} finally {
			setSavingWorkflowType(null);
		}
	}

	function buildDefaultPublishForm(template: EnterpriseAgentTemplate): PublishFormState {
		return {
			name: template.name,
			description: template.description,
			tenant: platformStatus?.current_user.tenant ?? '',
			model_config_id: credentials[0]?.id ?? '',
			knowledge_base_ids: knowledgeBases.map((knowledgeBase) => knowledgeBase.id),
			tools: [...template.tools],
			allowed_user_ids: [],
			allowed_roles: [],
			memory_enabled: true,
			workflow_enabled: false,
		};
	}

	function handleConfigureTemplate(template: EnterpriseAgentTemplate) {
		setEditingAgentId(null);
		setSelectedTemplateId(template.id);
		setPublishForm(buildDefaultPublishForm(template));
	}

	function handlePublishTenantChange(value: string) {
		const nextTenant = value.trim() || platformStatus?.current_user.tenant || 'default';
		const activeMembersForTenant = activePlatformMembersForTenant(
			platformMembers?.members ?? [],
			nextTenant,
		);
		const validUserIds = new Set(activeMembersForTenant.map((member) => member.user_id));
		const validRoles = new Set(activeMembersForTenant.map((member) => member.role).filter(Boolean));

		setPublishForm((current) => ({
			...current,
			tenant: value,
			allowed_user_ids: current.allowed_user_ids.filter((userId) => validUserIds.has(userId)),
			allowed_roles: current.allowed_roles.filter((role) => validRoles.has(role)),
		}));
	}

	function scrollToAgentManagement() {
		agentManagementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function scrollToMembers() {
		membersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function scrollToAgentRunner() {
		agentRunnerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function scrollToConnectorCenter() {
		connectorCenterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function scrollToGovernance() {
		governanceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function scrollToWorkflowRunner() {
		workflowRunnerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function scrollToToolRunner() {
		toolRunnerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function scrollToMemoryOperations() {
		memoryOperationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function scrollToConfigManagement() {
		configManagementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function handleOperationAction(target?: string) {
		if (target === 'agents') {
			scrollToAgentManagement();
			return;
		}

		if (target === 'connectors') {
			scrollToConnectorCenter();
			return;
		}

		if (target === 'governance' || target === 'approvals' || target === 'audit') {
			scrollToGovernance();
			return;
		}

		if (target === 'credentials') {
			navigate('/credential');
			return;
		}

		if (target === 'knowledge') {
			navigate('/knowledge');
			return;
		}

		if (target === 'workflows') {
			scrollToWorkflowRunner();
			return;
		}

		if (target === 'tools') {
			scrollToToolRunner();
			return;
		}

		if (target === 'memory') {
			scrollToMemoryOperations();
			return;
		}

		scrollToGovernance();
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
				error instanceof Error ? error.message : t('platform.opsTasks.resolveError'),
			);
		} finally {
			setResolvingOpsTaskCode(null);
		}
	}

	function handlePrimeToolApproval(agent: EnterprisePublishedAgent, toolName: string) {
		const toolConfig = enterpriseToolInputConfig[toolName];
		const catalogItem = availableToolItems.find((tool) => tool.name === toolName);
		const inputKey = toolConfig?.inputKey ?? catalogItem?.input_key ?? 'input';
		const inputValue =
			toolConfig?.defaultValue ?? catalogItem?.default_input ?? defaultApprovalForm.input_value;

		setSelectedIdentityUserId(selectedIdentityUserId || username);
		setApprovalForm((current) => ({
			...current,
			request_type: 'tool_run',
			tool_name: toolName,
			input_key: inputKey,
			input_value: inputValue,
			reason: t('platform.approvals.agentToolApprovalReason', {
				agent: agent.name,
				tool: toolName,
			}),
			user_id: current.user_id || selectedIdentityUserId || username,
			agent_id: agent.id,
		}));
		setApprovalError(null);
		window.setTimeout(scrollToGovernance, 0);
	}

	function handlePrimeAgentWorkflow(agent: EnterprisePublishedAgent) {
		const selectedDefaultInputs =
			selectedWorkflowTemplate?.default_inputs ??
			workflowOptions.find((workflow) => workflow.value === selectedWorkflowType)
				?.defaultInputs;

		setSelectedRunAgentId(agent.id);
		setSelectedIdentityUserId(selectedIdentityUserId || username);
		setWorkflowInputs(normalizeWorkflowInputs(selectedDefaultInputs));
		setWorkflowApprovalId('');
		setWorkflowRunError(null);
		window.setTimeout(scrollToWorkflowRunner, 0);
	}

	function handleUseApproval(approval: EnterpriseApprovalRequestItem) {
		setSelectedIdentityUserId(approval.user_id);

		if (approval.request_type === 'tool_run' && approval.tool_name) {
			if (approval.agent_id && approval.agent_id !== 'platform-console') {
				const department = approval.inputs?.department;
				setSelectedRunAgentId(approval.agent_id);
				setAgentApprovalId(approval.approval_id);
				if (department != null) {
					setAgentQuestion(`帮我看一下 ${String(department)} 部门指标`);
				}
				setAgentRunError(null);
				window.setTimeout(scrollToAgentRunner, 0);
				return;
			}

			const toolConfig = enterpriseToolInputConfig[approval.tool_name];
			const inputEntries = Object.entries(approval.inputs ?? {});
			const inputKey = toolConfig?.inputKey ?? inputEntries[0]?.[0];
			const inputValue =
				inputKey && approval.inputs?.[inputKey] != null
					? approval.inputs[inputKey]
					: inputEntries[0]?.[1];

			setSelectedToolName(approval.tool_name);
			setToolInputs((current) => ({
				...current,
				[approval.tool_name!]: inputValue == null ? '' : String(inputValue),
			}));
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
		setAgentRunResult(agentConversations[agentId]?.[0]?.response ?? null);
		setAgentRunError(null);
		window.setTimeout(scrollToAgentRunner, 0);
	}

	function handleSelectRunAgent(agentId: string) {
		setSelectedRunAgentId(agentId);
		setAgentRunResult(agentConversations[agentId]?.[0]?.response ?? null);
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
			setAgentConversations((current) => {
				const turns = current[detailedTurn.agentId] ?? [];
				const nextTurns = turns.some((item) => item.id === detailedTurn.id)
					? turns.map((item) => (item.id === detailedTurn.id ? detailedTurn : item))
					: [detailedTurn, ...turns];
				return {
					...current,
					[detailedTurn.agentId]: nextTurns,
				};
			});
			setAgentRunResult(run.response);
		} catch (error) {
			setAgentRunsError(
				error instanceof Error ? error.message : t('platform.agentRunner.historyLoadError'),
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
			await platformApi.clearAgentRuns({
				agent_id: agentId,
				user_id: userId || undefined,
			});
			setAgentConversations((current) => ({
				...current,
				[agentId]: [],
			}));
			setAgentRunResult(null);
			setAgentRunError(null);
		} catch (error) {
			setAgentRunsError(
				error instanceof Error ? error.message : t('platform.agentRunner.historyClearError'),
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
		const filters = { tenant: identity.tenant, user_id: identity.user_id };
		setAuditFilters((previous) => ({ ...previous, ...filters }));
		void refetchAuditEvents(filters);
		window.setTimeout(scrollToGovernance, 0);
	}

	function handleInspectIdentityApprovals(identity: EnterpriseIdentity) {
		const filters = {
			status: 'pending',
			tenant: identity.tenant,
			user_id: identity.user_id,
		};
		setApprovalFilters((previous) => ({ ...previous, ...filters }));
		void refetchApprovals(filters);
		window.setTimeout(scrollToGovernance, 0);
	}

	function handleInspectIdentityFailures(identity: EnterpriseIdentity) {
		const filters = {
			tenant: identity.tenant,
			user_id: identity.user_id,
			success: 'false',
		};
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
		const filters = { tenant, user_id: '', agent_id: '', tool_name: '', success: '' };
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
		const filters = {
			tenant: item.tenant,
			user_id: item.userId,
			agent_id: item.agentId,
			tool_name: '',
			success: '',
		};
		setAuditFilters((previous) => ({ ...previous, ...filters }));
		void refetchAuditEvents(filters);
		window.setTimeout(scrollToGovernance, 0);
	}

	function handleInspectTenantApprovals(tenant: string) {
		const filters = {
			status: 'pending',
			tenant,
			user_id: '',
			agent_id: '',
		};
		setApprovalFilters((previous) => ({ ...previous, ...filters }));
		void refetchApprovals(filters);
		window.setTimeout(scrollToGovernance, 0);
	}

	function handlePrepareTenantAgent(tenant: string) {
		if (defaultAgentTemplate) {
			const nextForm = buildDefaultPublishForm(defaultAgentTemplate);
			setEditingAgentId(null);
			setSelectedTemplateId(defaultAgentTemplate.id);
			setPublishForm({
				...nextForm,
				tenant,
			});
		} else {
			setPublishForm((current) => ({
				...current,
				tenant,
			}));
		}

		window.setTimeout(scrollToAgentManagement, 0);
	}

	function handleInspectAgentRunAudit() {
		if (!agentRunEvidence) {
			return;
		}

		const toolNames = agentRunEvidence.audit_filter.tool_names;
		const firstToolName = Array.isArray(toolNames) ? toolNames[0] : '';
		const filters = {
			tenant: agentRunEvidence.tenant,
			user_id: agentRunEvidence.user_id,
			agent_id: agentRunEvidence.agent_id,
			tool_name: firstToolName ? String(firstToolName) : '',
		};
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

	function buildAgentConfigurationPayloadFromForm(
		form: PublishFormState,
	): Omit<EnterpriseAgentPublishRequest, 'template_id'> {
		return {
			name: form.name.trim() || undefined,
			description: form.description.trim() || undefined,
			tenant: form.tenant.trim() || undefined,
			model_config_id: form.model_config_id || undefined,
			knowledge_base_ids: form.knowledge_base_ids,
			tools: form.tools,
			allowed_user_ids: form.allowed_user_ids,
			allowed_roles: form.allowed_roles,
			memory_enabled: form.memory_enabled,
			workflow_enabled: form.workflow_enabled,
		};
	}

	function buildAgentConfigurationPayload() {
		return buildAgentConfigurationPayloadFromForm(publishForm);
	}

	function handleEditAgent(agent: EnterprisePublishedAgent) {
		setSelectedTemplateId(agent.template_id);
		setEditingAgentId(agent.id);
		setPublishForm({
			name: agent.name,
			description: agent.description,
			tenant: agent.tenant,
			model_config_id: agent.model_config_id ?? '',
			knowledge_base_ids: agent.knowledge_base_ids ?? [],
			tools: agent.tools ?? [],
			allowed_user_ids: agent.allowed_user_ids ?? [],
			allowed_roles: agent.allowed_roles ?? [],
			memory_enabled: agent.memory_enabled,
			workflow_enabled: agent.workflow_enabled,
		});
	}

	function handleCancelEdit() {
		const template = selectedTemplate;
		setEditingAgentId(null);
		if (template) {
			handleConfigureTemplate(template);
		}
	}

	function handleTogglePublishList(
		key: 'knowledge_base_ids' | 'tools' | 'allowed_user_ids' | 'allowed_roles',
		value: string,
		checked: boolean,
	) {
		setPublishForm((current) => {
			const currentValues = current[key];
			const nextValues = checked
				? Array.from(new Set([...currentValues, value]))
				: currentValues.filter((item) => item !== value);

			return {
				...current,
				[key]: nextValues,
			};
		});
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
				: await platformApi.publishAgent({
						template_id: selectedTemplateId,
						...payload,
					});
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
						? t('platform.agentManagement.updateError')
						: t('platform.agentManagement.publishError'),
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
			const response = await platformApi.publishAgent({
				template_id: template.id,
				...buildAgentConfigurationPayloadFromForm(defaultForm),
			});
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
					: t('platform.agentManagement.publishError'),
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
				error instanceof Error ? error.message : t('platform.agentManagement.archiveError'),
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
			const response = await platformApi.updateAgent(agent.id, {
				model_config_id: modelConfigId,
			});
			if (selectedRunAgentId === agent.id || !selectedRunAgentId) {
				setSelectedRunAgentId(response.agent.id);
			}
			if (editingAgentId === agent.id) {
				setPublishForm((current) => ({
					...current,
					model_config_id: modelConfigId,
				}));
			}
			await refetchPlatformAgents();
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchOpsTasks();
		} catch (error) {
			setPlatformAgentsError(
				error instanceof Error ? error.message : t('platform.agentManagement.bindModelError'),
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
			const response = await platformApi.updateAgent(agent.id, {
				knowledge_base_ids: knowledgeBaseIds,
			});
			if (selectedRunAgentId === agent.id || !selectedRunAgentId) {
				setSelectedRunAgentId(response.agent.id);
			}
			if (editingAgentId === agent.id) {
				setPublishForm((current) => ({
					...current,
					knowledge_base_ids: knowledgeBaseIds,
				}));
			}
			await refetchPlatformAgents();
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchOpsTasks();
		} catch (error) {
			setPlatformAgentsError(
				error instanceof Error
					? error.message
					: t('platform.agentManagement.bindKnowledgeError'),
			);
		} finally {
			setBindingAgentKnowledgeId(null);
		}
	}

	async function handleBindTemplateTools(agent: EnterprisePublishedAgent) {
		const template = agentTemplates.find((item) => item.id === agent.template_id);
		const templateTools = template?.tools ?? [];
		if (!template || templateTools.length === 0) {
			setPlatformAgentsError(t('platform.agentManagement.bindToolsError'));
			return;
		}

		setBindingAgentToolsId(agent.id);
		setPlatformAgentsError(null);
		try {
			const response = await platformApi.updateAgent(agent.id, {
				tools: templateTools,
			});
			if (selectedRunAgentId === agent.id || !selectedRunAgentId) {
				setSelectedRunAgentId(response.agent.id);
			}
			if (editingAgentId === agent.id) {
				setPublishForm((current) => ({
					...current,
					tools: [...template.tools],
				}));
			}
			await refetchPlatformAgents();
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchOpsTasks();
		} catch (error) {
			setPlatformAgentsError(
				error instanceof Error ? error.message : t('platform.agentManagement.bindToolsError'),
			);
		} finally {
			setBindingAgentToolsId(null);
		}
	}

	async function handleEnableAgentMemory(agent: EnterprisePublishedAgent) {
		setEnablingAgentMemoryId(agent.id);
		setPlatformAgentsError(null);
		try {
			const response = await platformApi.updateAgent(agent.id, {
				memory_enabled: true,
			});
			if (selectedRunAgentId === agent.id || !selectedRunAgentId) {
				setSelectedRunAgentId(response.agent.id);
			}
			if (editingAgentId === agent.id) {
				setPublishForm((current) => ({
					...current,
					memory_enabled: true,
				}));
			}
			await refetchPlatformAgents();
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchOpsTasks();
		} catch (error) {
			setPlatformAgentsError(
				error instanceof Error
					? error.message
					: t('platform.agentManagement.enableMemoryError'),
			);
		} finally {
			setEnablingAgentMemoryId(null);
		}
	}

	async function handleEnableAgentWorkflow(agent: EnterprisePublishedAgent) {
		setEnablingAgentWorkflowId(agent.id);
		setPlatformAgentsError(null);
		try {
			const response = await platformApi.updateAgent(agent.id, {
				workflow_enabled: true,
			});
			if (selectedRunAgentId === agent.id || !selectedRunAgentId) {
				setSelectedRunAgentId(response.agent.id);
			}
			if (editingAgentId === agent.id) {
				setPublishForm((current) => ({
					...current,
					workflow_enabled: true,
				}));
			}
			await refetchPlatformAgents();
			await refetchPlatform();
			await refetchToolCatalog();
			await refetchOpsTasks();
		} catch (error) {
			setPlatformAgentsError(
				error instanceof Error
					? error.message
					: t('platform.agentManagement.enableWorkflowError'),
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
			setAgentRunError(t('platform.agentRunner.accessDenied'));
			return;
		}

		setRunningAgent(true);
		setAgentRunError(null);
		try {
			const response = await platformApi.runAgent({
				agent_id: agentId,
				question,
				user_id: userId || undefined,
				approval_id: explicitApprovalId || undefined,
			});
			const turn: EnterpriseAgentConversationTurn = {
				id: response.turn_id || `${agentId}-${Date.now()}`,
				agentId,
				question,
				answer: response.answer,
				createdAt: new Date().toISOString(),
				response,
			};
			setAgentRunResult(response);
			setAgentConversations((current) => {
				const existingTurns = current[agentId] ?? [];
				return {
					...current,
					[agentId]: [turn, ...existingTurns].slice(0, 20),
				};
			});
			const approvalRequired = response.tool_calls?.some(
				(toolCall) => toolCall.approval_required,
			);
			if (approvalRequired) {
				setAgentRunError(t('platform.agentRunner.approvalRequiredCreated'));
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
			(selectedToolInputKey
				? {
						[selectedToolInputKey]: selectedToolInputValue,
					}
				: null);
		const userId = options?.userId ?? selectedIdentityUserId;
		const agentId = options?.agentId ?? selectedRunAgentId;
		const approvalId = options?.approvalId ?? toolApprovalId.trim();

		if (!inputs) {
			return;
		}

		setRunningTool(true);
		setToolRunError(null);
		try {
			const response = await platformApi.runTool({
				tool_name: toolName,
				inputs,
				user_id: userId || undefined,
				agent_id: agentId || undefined,
				approval_id: approvalId || undefined,
			});
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
					setToolRunError(t('platform.toolRunner.approvalRequiredCreated'));
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
			const response = await platformApi.runWorkflow({
				workflow_type: workflowType,
				inputs,
				agent_id: agentId || undefined,
				user_id: userId || undefined,
				approval_id: approvalId || undefined,
			});
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
					setWorkflowRunError(t('platform.workflowRunner.approvalRequiredCreated'));
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
		const template = workflowTemplates.find(
			(item) => item.workflow_type === scenario.workflow_type,
		);
		const inputs = normalizeWorkflowInputs(template?.default_inputs ?? workflowInputs);
		setSelectedWorkflowType(scenario.workflow_type);
		setWorkflowInputs(inputs);
		window.setTimeout(scrollToWorkflowRunner, 0);
		await runEnterpriseWorkflow({
			workflowType: scenario.workflow_type,
			inputs,
		});
	}

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
		icons: {
			model: KeyRound,
			knowledge: Database,
			agent: BotMessageSquare,
			tools: Boxes,
			workflow: Clock3,
			tenant: ShieldCheck,
			audit: Network,
			config: Upload,
		},
		actions: {
			credentials: () => navigate('/credential'),
			knowledge: () => navigate('/knowledge'),
			agents: handleStartPublishing,
			tools: scrollToToolRunner,
			workflows: scrollToWorkflowRunner,
			tenants: scrollToMembers,
			governance: scrollToGovernance,
			config: scrollToConfigManagement,
		},
	});

	const launchpadTargetActions = launchpadTargetActionsForNavigation({
		members: scrollToMembers,
		credentials: () => navigate('/credential'),
		agents: handleStartPublishing,
		knowledge: () => navigate('/knowledge'),
		run: scrollToAgentRunner,
		tools: scrollToToolRunner,
		memory: scrollToMemoryOperations,
		connectors: scrollToConnectorCenter,
		governance: scrollToGovernance,
		workflows: scrollToWorkflowRunner,
	});
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
			icons: {
				members: UserRound,
				model: KeyRound,
				knowledge: LibraryBig,
				agent: BotMessageSquare,
				run: Play,
				governance: ShieldCheck,
			},
			actions: launchpadTargetActions,
			fallbackAction: scrollToGovernance,
			labels: {
				title: (key) => t(`platform.launchpad.${key}.title`),
				description: (key) => t(`platform.launchpad.${key}.description`),
				action: (key) => t(`platform.launchpad.${key}.action`),
			},
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
		icons: {
			agents: BotMessageSquare,
			resources: Network,
			run: Play,
			governance: ShieldCheck,
		},
		actions: {
			agents: handleStartPublishing,
			resources: scrollToConnectorCenter,
			run: scrollToAgentRunner,
			governance: scrollToGovernance,
		},
		labels: {
			title: (key) => t(`platform.console.${key}`),
			description: (key) => t(`platform.console.${key}Description`),
			action: (key) => t(`platform.console.${key}Action`),
		},
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
			icons: {
				agents: BotMessageSquare,
				approvals: ShieldCheck,
				workflows: Workflow,
				memory: Brain,
			},
			actions: {
				agents: scrollToAgentRunner,
				approvals: scrollToGovernance,
				workflows: scrollToWorkflowRunner,
				memory: scrollToMemoryOperations,
			},
			labels: {
				readyAgents: t('platform.workbench.indicators.readyAgents'),
				readyAgentsHelper: t('platform.workbench.indicators.readyAgentsHelper'),
				approvals: t('platform.workbench.indicators.approvals'),
				approvalsHelper: t('platform.workbench.indicators.approvalsHelper'),
				workflowRuns: t('platform.workbench.indicators.workflowRuns'),
				workflowRunsHelper: t('platform.workbench.indicators.workflowRunsHelper'),
				memory: t('platform.workbench.indicators.memory'),
				memoryHelper: t('platform.workbench.indicators.memoryHelper', {
					saved: memoryOperationsSavedCount,
					hits: memoryOperationsHitCount,
				}),
			},
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
			icons: {
				run: Play,
				workflow: Workflow,
				governance: ShieldCheck,
				memory: Brain,
			},
			actions: {
				run: scrollToAgentRunner,
				publish: handleStartPublishing,
				workflow: scrollToWorkflowRunner,
				governance: scrollToGovernance,
				memory: scrollToMemoryOperations,
			},
			labels: {
				runTitle: t('platform.workbench.actions.run.title'),
				runDescriptionReady: (agent) =>
					t('platform.workbench.actions.run.descriptionReady', { agent }),
				runDescriptionEmpty: t('platform.workbench.actions.run.descriptionEmpty'),
				runAction: t('platform.workbench.actions.run.action'),
				runPublishAction: t('platform.workbench.actions.run.publishAction'),
				workflowTitle: t('platform.workbench.actions.workflow.title'),
				workflowDescription: (count) =>
					t('platform.workbench.actions.workflow.description', { count }),
				workflowAction: t('platform.workbench.actions.workflow.action'),
				governanceTitle: t('platform.workbench.actions.governance.title'),
				governanceDescription: (count) =>
					t('platform.workbench.actions.governance.description', { count }),
				governanceAction: t('platform.workbench.actions.governance.action'),
				memoryTitle: t('platform.workbench.actions.memory.title'),
				memoryDescription: (count) =>
					t('platform.workbench.actions.memory.description', { count }),
				memoryAction: t('platform.workbench.actions.memory.action'),
			},
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
			icons: {
				model: KeyRound,
				knowledge: LibraryBig,
				connectors: Network,
				members: UserRound,
				agents: BotMessageSquare,
				workflows: Workflow,
			},
			actions: {
				credentials: () => navigate('/credential'),
				knowledge: () => navigate('/knowledge'),
				connectors: scrollToConnectorCenter,
				members: scrollToMembers,
				agents: handleStartPublishing,
				workflows: scrollToWorkflowRunner,
			},
			labels: {
				title: (key) => t(`platform.workbench.readiness.${key}.title`),
				modelDescription: (count) =>
					t('platform.workbench.readiness.model.description', { count }),
				knowledgeDescription: (count) =>
					t('platform.workbench.readiness.knowledge.description', { count }),
				connectorsDescription: (count) =>
					t('platform.workbench.readiness.connectors.description', { count }),
				membersDescription: (count) =>
					t('platform.workbench.readiness.members.description', { count }),
				agentsDescription: (ready, total) =>
					t('platform.workbench.readiness.agents.description', { ready, total }),
				workflowsDescription: (count) =>
					t('platform.workbench.readiness.workflows.description', { count }),
			},
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
			actions: {
				governance: scrollToGovernance,
				connectors: scrollToConnectorCenter,
				workflows: scrollToWorkflowRunner,
				agents: handleStartPublishing,
			},
			labels: {
				errors: t('platform.workbench.risks.errors'),
				connectorDraft: (count) =>
					t('platform.workbench.risks.connectorDraft', { count }),
				approvals: (count) => t('platform.workbench.risks.approvals', { count }),
				workflowFailures: (count) =>
					t('platform.workbench.risks.workflowFailures', { count }),
				agents: t('platform.workbench.risks.agents'),
			},
		},
	);
	const workbenchQuickActions = workbenchQuickActionsForStatus({
		icons: {
			connectors: Network,
			publish: BotMessageSquare,
			run: Play,
			workflow: Workflow,
			governance: ShieldCheck,
			tools: Boxes,
		},
		actions: {
			connectors: scrollToConnectorCenter,
			publish: handleStartPublishing,
			run: scrollToAgentRunner,
			workflow: scrollToWorkflowRunner,
			governance: scrollToGovernance,
			tools: scrollToToolRunner,
		},
		labels: {
			connectors: t('platform.workbench.quickActions.connectors'),
			publish: t('platform.workbench.quickActions.publish'),
			run: t('platform.workbench.quickActions.run'),
			workflow: t('platform.workbench.quickActions.workflow'),
			governance: t('platform.workbench.quickActions.governance'),
			tools: t('platform.workbench.quickActions.tools'),
		},
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
			icons: {
				model: KeyRound,
				knowledge: LibraryBig,
				agent: BotMessageSquare,
				run: Play,
				governance: ShieldCheck,
				config: Upload,
			},
			actions: {
				model: () => navigate('/credential'),
				knowledge: () => navigate('/knowledge'),
				agent: handleStartPublishing,
				run: scrollToAgentRunner,
				governance: scrollToGovernance,
				config: scrollToConfigManagement,
			},
			labels: {
				title: (key) => t(`platform.workbench.rolloutPath.steps.${key}.title`),
				description: (key) =>
					t(`platform.workbench.rolloutPath.steps.${key}.description`),
				action: (key) => t(`platform.workbench.rolloutPath.steps.${key}.action`),
			},
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
			icons: {
				model: KeyRound,
				agent: BotMessageSquare,
				run: Play,
				governance: ShieldCheck,
			},
			actions: {
				model: () => navigate('/credential'),
				agent: () => void handleQuickPublishAgent(),
				run: scrollToAgentRunner,
				governance: scrollToGovernance,
			},
			labels: {
				title: (key) => t(`platform.workbench.firstAgentGuide.steps.${key}.title`),
				action: (key) => t(`platform.workbench.firstAgentGuide.steps.${key}.action`),
				modelReady: (count) =>
					t('platform.workbench.firstAgentGuide.steps.model.ready', { count }),
				modelEmpty: t('platform.workbench.firstAgentGuide.steps.model.empty'),
				agentReady: (count) =>
					t('platform.workbench.firstAgentGuide.steps.agent.ready', { count }),
				agentPartial: (count) =>
					t('platform.workbench.firstAgentGuide.steps.agent.partial', { count }),
				agentEmpty: t('platform.workbench.firstAgentGuide.steps.agent.empty'),
				runReady: t('platform.workbench.firstAgentGuide.steps.run.ready'),
				runPartial: t('platform.workbench.firstAgentGuide.steps.run.partial'),
				runEmpty: t('platform.workbench.firstAgentGuide.steps.run.empty'),
				governanceReady: (count) =>
					t('platform.workbench.firstAgentGuide.steps.governance.ready', { count }),
				governancePending: (count) =>
					t('platform.workbench.firstAgentGuide.steps.governance.pending', { count }),
				governanceEmpty: t('platform.workbench.firstAgentGuide.steps.governance.empty'),
			},
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
			icons: {
				template: ListChecks,
				model: KeyRound,
				knowledge: LibraryBig,
				tools: Boxes,
				policy: ShieldCheck,
				publish: BotMessageSquare,
				operate: Workflow,
			},
			actions: {
				template: handleStartPublishing,
				model: () => navigate('/credential'),
				knowledge:
					knowledgeBases.length === 0
						? () => navigate('/knowledge')
						: handleNextAgentSetupStep,
				tools: handleNextAgentSetupStep,
				policy: handleNextAgentSetupStep,
				publish: handleStartPublishing,
				operate: selectedRunAgent ? scrollToAgentRunner : scrollToWorkflowRunner,
			},
			labels: {
				title: (key) => t(`platform.orchestration.${key}.title`),
				description: (key) => t(`platform.orchestration.${key}.description`),
				action: (key) => t(`platform.orchestration.${key}.action`),
				templateEmpty: t('platform.orchestration.template.empty'),
				modelReady: (count) => t('platform.orchestration.model.ready', { count }),
				modelEmpty: t('platform.orchestration.model.empty'),
				selectedKnowledge: (count) =>
					t('platform.agentManagement.selectedKnowledge', { count }),
				knowledgeReady: (count) =>
					t('platform.orchestration.knowledge.ready', { count }),
				toolsSelected: (count) =>
					t('platform.agentManagement.wizard.toolsSelected', { count }),
				toolsReady: (count) => t('platform.orchestration.tools.ready', { count }),
				policyDetail: (counts) =>
					t('platform.orchestration.policy.detail', {
						users: counts.users,
						roles: counts.roles,
					}),
				publishReady: (count) =>
					t('platform.orchestration.publish.ready', { count }),
				publishEmpty: t('platform.orchestration.publish.empty'),
				operateReady: (count) =>
					t('platform.orchestration.operate.ready', { count }),
				operatePending: (count) =>
					t('platform.orchestration.operate.pending', { count }),
				operateEmpty: t('platform.orchestration.operate.empty'),
			},
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
			icons: {
				agentRuns: BotMessageSquare,
				workflowRuns: Workflow,
				toolAudit: ShieldCheck,
				pendingApprovals: Clock3,
			},
			labels: {
				agentRuns: t('platform.monitoring.agentRuns'),
				agentRunsHelper: t('platform.monitoring.agentRunsHelper'),
				workflowRuns: t('platform.monitoring.workflowRuns'),
				workflowRunsHelper: (counts) =>
					t('platform.monitoring.workflowRunsHelper', counts),
				toolAudit: t('platform.monitoring.toolAudit'),
				toolAuditHelper: (counts) =>
					t('platform.monitoring.toolAuditHelper', counts),
				pendingApprovals: t('platform.monitoring.pendingApprovals'),
				pendingApprovalsHelper: t('platform.monitoring.pendingApprovalsHelper'),
			},
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
