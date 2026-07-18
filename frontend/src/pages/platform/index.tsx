import {
	Activity,
	AlertTriangle,
	ArrowRight,
	BotMessageSquare,
	Boxes,
	Brain,
	Building2,
	CheckCircle2,
	Clock3,
	Code2,
	Copy,
	Database,
	FileClock,
	HardDrive,
	KeyRound,
	LibraryBig,
	ListChecks,
	Network,
	Play,
	RefreshCcw,
	Save,
	Server,
	ShieldCheck,
	Upload,
	UserRound,
	Workflow,
	XCircle,
} from 'lucide-react';
import type { ComponentType, RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
	platformApi,
	type CredentialView,
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
	type KnowledgeBaseView,
	type ScheduleRecord,
} from '@/api';
import { ApiError } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAgents } from '@/hooks/useAgents';
import { useCredentials } from '@/hooks/useCredentials';
import { useKnowledgeBases } from '@/hooks/useKnowledgeBases';
import { usePlatformStatus } from '@/hooks/usePlatformStatus';
import { useSchedules } from '@/hooks/useSchedules';
import { useTranslation } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import { getFrequencyLabel, parseCronExpression } from '../schedule/schedule-utils';
import { AccessControlPanel } from './components/AccessControlPanel';
import {
	AgentManagementOverview,
	AgentTemplateList,
} from './components/AgentManagementOverview';
import { AgentManagementPanel } from './components/AgentManagementPanel';
import { AgentQuickStartPanel } from './components/AgentQuickStartPanel';
import { AgentRunNowPanel } from './components/AgentRunNowPanel';
import { AgentRunnerConversation } from './components/AgentRunnerConversation';
import { AgentRunnerPanel } from './components/AgentRunnerPanel';
import { AgentRunnerResult } from './components/AgentRunnerResult';
import {
	AppCenterPanel,
	type AppCenterSelection,
} from './components/AppCenterPanel';
import { FirstAgentGuide, type FirstAgentGuideStep } from './components/FirstAgentGuide';
import {
	GovernanceHealthPanel,
	type GovernanceHealthItem,
} from './components/GovernanceHealthPanel';
import { LaunchpadPanel, type LaunchpadStep } from './components/LaunchpadPanel';
import {
	MonitoringSnapshotPanel,
	type MonitoringAgentTurn,
	type MonitoringStat,
} from './components/MonitoringSnapshotPanel';
import {
	MemoryOperationsPanel,
	type MemoryOperationsItem,
} from './components/MemoryOperationsPanel';
import {
	MembersPanel,
	type MemberFormState,
	type PlatformMemberTenantSummary,
} from './components/MembersPanel';
import {
	OrchestrationWorkbenchPanel,
	type OrchestrationWorkbenchStep,
} from './components/OrchestrationWorkbenchPanel';
import { OperationsPanel } from './components/OperationsPanel';
import { OpsTasksPanel } from './components/OpsTasksPanel';
import {
	PlatformConsolePanel,
	type PlatformConsoleItem,
} from './components/PlatformConsolePanel';
import { PlatformDashboardOverview } from './components/PlatformDashboardOverview';
import { PolicySubagentsPanel } from './components/PolicySubagentsPanel';
import { RolloutPath, type RolloutPathStep } from './components/RolloutPath';
import {
	RuntimeStatusPanel,
	type RuntimeStatusItem,
} from './components/RuntimeStatusPanel';
import { ScenariosPanel } from './components/ScenariosPanel';
import {
	TenantWorkspacePanel,
	type TenantOverviewItem,
} from './components/TenantWorkspacePanel';
import {
	TenantGovernancePanel,
	type ToolPolicyDraftValue,
} from './components/TenantGovernancePanel';
import {
	WorkbenchReadinessPanel,
	type WorkbenchQuickAction,
	type WorkbenchReadinessItem,
	type WorkbenchRiskItem,
} from './components/WorkbenchReadinessPanel';
import {
	WorkbenchStatusPanel,
	type WorkbenchActionCard,
	type WorkbenchIndicator,
} from './components/WorkbenchStatusPanel';
import {
	PlatformNotice,
	StateBadge,
	type HealthState,
} from './components/common';
import { WorkflowRunnerPanel } from './components/WorkflowRunnerPanel';
import { WorkflowOpsPanel } from './components/WorkflowOpsPanel';
import { TriggerOpsPanel } from './components/TriggerOpsPanel';
import { DashboardOpsPanel } from './components/DashboardOpsPanel';

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

interface Capability {
	title: string;
	description: string;
	metric: string;
	actionLabel: string;
	status: string;
	state: HealthState;
	icon: ComponentType<{ className?: string }>;
	onClick: () => void;
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

interface AgentWizardStep {
	key: string;
	title: string;
	detail: string;
	state: HealthState;
	ref: RefObject<HTMLDivElement | HTMLElement | null>;
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

interface ApprovalFormState {
	request_type: EnterpriseApprovalRequestType;
	tool_name: string;
	workflow_type: string;
	input_key: string;
	input_value: string;
	reason: string;
	user_id: string;
	agent_id: string;
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

const defaultEnterpriseWorkflowInputs: Record<string, string> = {
	policy_keyword: 'remote',
	ticket_id: 'INC-1001',
	department: 'engineering',
};

const workflowInputLabelKeys: Record<string, string> = {
	policy_keyword: 'policyKeyword',
	ticket_id: 'ticketId',
	department: 'department',
};

const agentSampleQuestions = [
	'请查询 remote 政策、INC-1001 工单状态，并总结 engineering 部门指标。',
	'帮我查一下 INC-1001 的工单状态',
	'远程办公制度怎么说？',
	'总结 engineering 部门指标',
];

function agentAccessAllowed(
	agent: EnterprisePublishedAgent,
	identity?: EnterpriseIdentity | null,
) {
	const allowedUsers = agent.allowed_user_ids ?? [];
	const allowedRoles = agent.allowed_roles ?? [];
	if (!identity) {
		return false;
	}
	if (agent.tenant && identity.tenant !== agent.tenant) {
		return false;
	}
	if (allowedUsers.length === 0 && allowedRoles.length === 0) {
		return true;
	}
	return allowedUsers.includes(identity.user_id) || allowedRoles.includes(identity.role);
}

const ALL_AGENTS_VALUE = '__all_agents__';
const ALL_TOOLS_VALUE = '__all_tools__';
const ALL_AUDIT_STATUSES_VALUE = '__all_statuses__';
const ALL_APPROVAL_STATUSES_VALUE = '__all_approval_statuses__';

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

function formatTimestamp(value?: string) {
	if (!value) {
		return '-';
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleString();
}

function credentialLabel(credential: CredentialView) {
	const name = credential.data.name;
	return typeof name === 'string' && name.trim() ? name : credential.id;
}

function knowledgeBaseLabel(knowledgeBase: KnowledgeBaseView) {
	return knowledgeBase.name || knowledgeBase.id;
}

function shortResourceId(id: string) {
	return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

function scheduleSortTime(schedule: ScheduleRecord) {
	const timestamp = Date.parse(schedule.updated_at || schedule.created_at || schedule.data.started_at);
	return Number.isNaN(timestamp) ? 0 : timestamp;
}

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

function countArrayField(record: Record<string, unknown>, key: string) {
	const value = record[key];
	return Array.isArray(value) ? value.length : 0;
}

function normalizeWorkflowInputs(inputs?: Record<string, unknown>): Record<string, string> {
	const source = inputs && Object.keys(inputs).length > 0 ? inputs : defaultEnterpriseWorkflowInputs;

	return Object.fromEntries(
		Object.entries(source).map(([key, value]) => [key, value == null ? '' : String(value)]),
	);
}

function workflowStatusLabelKey(status?: string) {
	if (status === 'completed') {
		return 'statusCompleted';
	}

	if (status === 'partial') {
		return 'statusPartial';
	}

	return 'statusWorkflowFailed';
}

function workflowStatusClassName(status?: string) {
	if (status === 'completed') {
		return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
	}

	if (status === 'partial') {
		return 'border-amber-500/30 bg-amber-500/10 text-amber-700';
	}

	return '';
}

function approvalStatusClassName(status?: string) {
	if (status === 'approved') {
		return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
	}

	if (status === 'pending') {
		return 'border-amber-500/30 bg-amber-500/10 text-amber-700';
	}

	return 'border-slate-500/30 bg-slate-500/10 text-slate-700';
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

function workflowInputLabel(key: string) {
	return key.replace(/_/g, ' ');
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
		() => publishedPlatformAgents.filter((agent) => agent.status === 'published'),
		[publishedPlatformAgents],
	);
	const archivedPlatformAgents = useMemo(
		() => publishedPlatformAgents.filter((agent) => agent.status !== 'published'),
		[publishedPlatformAgents],
	);
	const readyPlatformAgents = useMemo(
		() =>
			activePlatformAgents.filter(
				(agent) =>
					(agent.readiness?.status ?? 'partial') === 'ready' ||
					(Boolean(agent.model_config_id) &&
						!(agent.readiness?.issues ?? []).some(
							(issue) => issue.severity === 'blocking',
						)),
			),
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
	const agentSetupSteps: AgentWizardStep[] = [
		{
			key: 'template',
			title: t('platform.agentManagement.wizard.template'),
			detail: selectedTemplate
				? selectedTemplate.name
				: t('platform.agentManagement.wizard.templateMissing'),
			state: selectedTemplate ? 'ready' : 'todo',
			ref: agentTemplateStepRef,
		},
		{
			key: 'model',
			title: t('platform.agentManagement.wizard.model'),
			detail: publishForm.model_config_id
				? credentialById.get(publishForm.model_config_id)
					? credentialLabel(credentialById.get(publishForm.model_config_id)!)
					: publishForm.model_config_id
				: credentials.length > 0
					? t('platform.agentManagement.wizard.modelMissing')
					: t('platform.agentManagement.noModel'),
			state: publishForm.model_config_id
				? 'ready'
				: credentials.length > 0
					? 'todo'
					: 'blocked',
			ref: agentModelStepRef,
		},
		{
			key: 'knowledge',
			title: t('platform.agentManagement.wizard.knowledge'),
			detail:
				publishForm.knowledge_base_ids.length > 0
					? t('platform.agentManagement.selectedKnowledge', {
							count: publishForm.knowledge_base_ids.length,
						})
					: knowledgeBases.length > 0
						? t('platform.agentManagement.wizard.knowledgeMissing')
						: t('platform.agentManagement.noKnowledge'),
			state:
				publishForm.knowledge_base_ids.length > 0
					? 'ready'
					: knowledgeBases.length > 0
						? 'todo'
						: 'partial',
			ref: agentKnowledgeStepRef,
		},
		{
			key: 'tools',
			title: t('platform.agentManagement.wizard.tools'),
			detail:
				publishForm.tools.length > 0
					? t('platform.agentManagement.wizard.toolsSelected', {
							count: publishForm.tools.length,
						})
					: t('platform.agentManagement.wizard.toolsMissing'),
			state: publishForm.tools.length > 0 ? 'ready' : 'todo',
			ref: agentToolsStepRef,
		},
		{
			key: 'runtime',
			title: t('platform.agentManagement.wizard.runtime'),
			detail: t('platform.agentManagement.wizard.runtimeDetail', {
				memory: publishForm.memory_enabled
					? t('platform.agentManagement.enabled')
					: t('platform.agentManagement.disabled'),
				workflow: publishForm.workflow_enabled
					? t('platform.agentManagement.enabled')
					: t('platform.agentManagement.disabled'),
			}),
			state: publishForm.memory_enabled || publishForm.workflow_enabled ? 'ready' : 'partial',
			ref: agentRuntimeStepRef,
		},
	];
	const nextAgentSetupStep =
		agentSetupSteps.find((step) => step.state === 'blocked' || step.state === 'todo') ??
		agentSetupSteps.find((step) => step.state === 'partial') ??
		null;
	const selectedRunAgentModelLabel = selectedRunAgent?.model_config_id
		? credentialById.get(selectedRunAgent.model_config_id)
			? credentialLabel(credentialById.get(selectedRunAgent.model_config_id)!)
			: selectedRunAgent.model_config_id
		: t('platform.agentManagement.noneConfigured');
	const selectedRunAgentKnowledgeLabels =
		(selectedRunAgent?.knowledge_base_ids ?? []).map((knowledgeBaseId) => {
			const knowledgeBase = knowledgeBaseById.get(knowledgeBaseId);
			return knowledgeBase ? knowledgeBaseLabel(knowledgeBase) : knowledgeBaseId;
		});
	const selectedRunAgentToolCount = selectedRunAgent?.tools?.length ?? 0;
	const selectedRunAgentKnowledgeCount = selectedRunAgentKnowledgeLabels.length;
	const selectedRunAgentReadinessState: HealthState = selectedRunAgent
		? selectedRunAgent.readiness?.status ?? 'partial'
		: 'todo';
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
	const nextStepPrimaryDisabled =
		(nextStepMode === 'publish' &&
			(!defaultAgentTemplate || Boolean(publishingTemplateId))) ||
		(nextStepMode === 'run' && !selectedRunAgent);
	const agentRunModelLabel = agentRunResult?.model_config_id
		? credentialById.get(agentRunResult.model_config_id)
			? credentialLabel(credentialById.get(agentRunResult.model_config_id)!)
			: agentRunResult.model_config_id
		: t('platform.agentManagement.noneConfigured');
	const agentRunKnowledgeLabels =
		agentRunResult?.knowledge_base_ids?.map((knowledgeBaseId) => {
			const knowledgeBase = knowledgeBaseById.get(knowledgeBaseId);
			return knowledgeBase ? knowledgeBaseLabel(knowledgeBase) : knowledgeBaseId;
		}) ?? [];
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
		() =>
			(platformMembers?.members ?? []).filter(
				(member) => member.status !== 'inactive' && member.tenant === publishTenant,
			),
		[platformMembers?.members, publishTenant],
	);
	const platformMemberById = useMemo(
		() => new Map((platformMembers?.members ?? []).map((member) => [member.user_id, member])),
		[platformMembers?.members],
	);
	const publishAccessMembers = useMemo(() => {
		const memberById = new Map(activePlatformMembers.map((member) => [member.user_id, member]));
		publishForm.allowed_user_ids.forEach((userId) => {
			if (!memberById.has(userId)) {
				const existingMember = platformMemberById.get(userId);
				memberById.set(userId, {
					user_id: userId,
					tenant: existingMember?.tenant ?? publishTenant,
					display_name: existingMember?.display_name ?? userId,
					role: existingMember?.role ?? '',
					status: existingMember?.status ?? 'inactive',
					source: existingMember?.source,
					updated_at: existingMember?.updated_at,
					updated_by: existingMember?.updated_by,
				});
			}
		});
		return Array.from(memberById.values()).sort((left, right) =>
			(left.display_name || left.user_id).localeCompare(right.display_name || right.user_id),
		);
	}, [activePlatformMembers, platformMemberById, publishForm.allowed_user_ids, publishTenant]);
	const publishRoleOptions = useMemo(
		() =>
			Array.from(
				new Set([
					...activePlatformMembers.map((member) => member.role).filter(Boolean),
					...(platformMembers?.roles ?? []).filter((role) =>
						activePlatformMembers.some((member) => member.role === role),
					),
					...publishForm.allowed_roles,
				]),
			).sort(),
		[activePlatformMembers, platformMembers?.roles, publishForm.allowed_roles],
	);
	const publishSelectedModelLabel = publishForm.model_config_id
		? credentialById.get(publishForm.model_config_id)
			? credentialLabel(credentialById.get(publishForm.model_config_id)!)
			: shortResourceId(publishForm.model_config_id)
		: t('platform.agentManagement.noneConfigured');
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
	const publishReleaseIssues = [
		!publishForm.model_config_id ? t('platform.agentManagement.releaseMissingModel') : null,
		publishForm.knowledge_base_ids.length === 0
			? t('platform.agentManagement.releaseNoKnowledge')
			: null,
	].filter(Boolean) as string[];
	const publishBlocked = !selectedTemplate || !publishForm.model_config_id;
	const selectedIdentity =
		enterpriseIdentities.find((identity) => identity.user_id === selectedIdentityUserId) ??
		enterpriseIdentities[0] ??
		null;
	const selectedRunAgentAccessAllowed = selectedRunAgent
		? agentAccessAllowed(selectedRunAgent, selectedIdentity)
		: true;
	const selectedRunAgentAccessLabel = selectedRunAgent
		? selectedRunAgentAccessAllowed
			? (selectedRunAgent.allowed_user_ids?.length ?? 0) > 0 ||
				(selectedRunAgent.allowed_roles?.length ?? 0) > 0
				? t('platform.agentRunner.accessAllowed')
				: t('platform.agentRunner.accessOpen')
			: t('platform.agentRunner.accessDenied')
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

	const stats = [
		{
			label: t('platform.stats.agents'),
			value: platformAgents?.agents.length ?? agents.length,
			helper: t('platform.stats.agentsHelper'),
			icon: BotMessageSquare,
			loading: platformAgentsLoading || agentsLoading,
		},
		{
			label: t('platform.stats.credentials'),
			value: credentials.length,
			helper: t('platform.stats.credentialsHelper'),
			icon: KeyRound,
			loading: credentialsLoading,
		},
		{
			label: t('platform.stats.knowledgeBases'),
			value: knowledgeBases.length,
			helper: t('platform.stats.knowledgeBasesHelper'),
			icon: LibraryBig,
			loading: knowledgeLoading,
		},
		{
			label: t('platform.stats.workflows'),
			value: workflowTemplates.length || schedules.length,
			helper: t('platform.stats.workflowsHelper'),
			icon: Workflow,
			loading: workflowTemplatesLoading || schedulesLoading,
		},
	];

	const runtimeItems: RuntimeStatusItem[] = [
		{
			label: t('platform.runtime.platform'),
			value: platformStatus
				? `${platformStatus.platform.name} ${platformStatus.platform.version}`
				: t('platform.runtime.unavailable'),
			icon: Server,
		},
		{
			label: t('platform.runtime.userTenant'),
			value: currentIdentityLabel,
			icon: UserRound,
		},
		{
			label: t('platform.runtime.connector'),
			value: platformStatus?.connector.name || t('platform.runtime.unavailable'),
			icon: Network,
		},
		{
			label: t('platform.runtime.dataDir'),
			value: platformStatus?.storage.data_dir || t('platform.runtime.unavailable'),
			icon: HardDrive,
		},
		{
			label: t('platform.runtime.auditPath'),
			value: platformStatus?.storage.audit_log_path || t('platform.runtime.unavailable'),
			icon: FileClock,
		},
		{
			label: t('platform.runtime.auditStatus'),
			value: platformStatus
				? platformStatus.audit.enabled
					? t('platform.runtime.enabled')
					: t('platform.runtime.disabled')
				: t('platform.runtime.unavailable'),
			icon: ShieldCheck,
		},
	];

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
	const tenantWorkspaces = connectors
		? Object.entries(connectors.tenant_workspaces)
		: [];
	const tenantWorkspaceByName = useMemo(
		() => new Map(tenantWorkspaces.map(([tenant, workspace]) => [tenant, workspace])),
		[tenantWorkspaces],
	);
	const savedConnectorConfigs = connectors?.saved_configs ?? [];
	const activeConnectorTenant = connectorTestForm.tenant.trim() || 'acme';
	const activeSavedConnectorConfig =
		savedConnectorConfigs.find((config) => config.tenant === activeConnectorTenant) ?? null;
	const connectorTimeoutValue = Number.parseFloat(connectorTestForm.timeout_seconds);
	const connectorDraftIssues = [
		!connectorTestForm.base_url.trim()
			? t('platform.connectors.validationBaseUrlRequired')
			: null,
		connectorTestForm.base_url.trim() &&
		!/^https?:\/\//i.test(connectorTestForm.base_url.trim())
			? t('platform.connectors.validationBaseUrlProtocol')
			: null,
		!Number.isFinite(connectorTimeoutValue) || connectorTimeoutValue <= 0
			? t('platform.connectors.validationTimeout')
			: null,
		!connectorTestForm.policy_path.trim().startsWith('/')
			? t('platform.connectors.validationPolicyPath')
			: null,
		!connectorTestForm.ticket_path.trim().startsWith('/')
			? t('platform.connectors.validationTicketPath')
			: null,
		!connectorTestForm.metrics_path.trim().startsWith('/')
			? t('platform.connectors.validationMetricsPath')
			: null,
	].filter(Boolean) as string[];
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
	const connectorDraftStatusLabel =
		connectorDraftIssues.length > 0
			? t('platform.connectors.draftInvalid')
			: connectorDraftMatchesSaved
				? t('platform.connectors.draftSaved')
				: activeSavedConnectorConfig
					? t('platform.connectors.draftChanged')
					: t('platform.connectors.draftNew');
	const connectorTestPassed = connectorTestResult?.status === 'success';
	const connectorRuntimeState = connectors?.runtime.saved_config_enabled
		? 'ready'
		: connectorState;
	const connectorRuntimeSourceText =
		connectors?.runtime.source === 'saved_config'
			? t('platform.connectors.runtimeSavedConfig')
			: t('platform.connectors.runtimeGlobal');
	const workflowTemplateByType = useMemo(() => {
		return new Map(workflowTemplates.map((template) => [template.workflow_type, template]));
	}, [workflowTemplates]);
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
	const tenantOverviewItems = useMemo<TenantOverviewItem[]>(() => {
		const tenants = new Set<string>();
		tenantWorkspaces.forEach(([tenant]) => tenants.add(tenant));
		enterpriseIdentities.forEach((identity) => tenants.add(identity.tenant));
		activePlatformAgents.forEach((agent) => tenants.add(agent.tenant));
		pendingApprovals.forEach((approval) => tenants.add(approval.tenant));
		auditEvents.forEach((event) => {
			if (event.tenant) {
				tenants.add(event.tenant);
			}
		});
		workflowRuns.forEach((run) => tenants.add(run.tenant));

		return Array.from(tenants)
			.sort()
			.map((tenant) => {
				const workspace = tenantWorkspaceByName.get(tenant);
				const identities = enterpriseIdentities.filter(
					(identity) => identity.tenant === tenant,
				);
				const roles = new Set(identities.map((identity) => identity.role).filter(Boolean));
				const sampleQuestion =
					workspace?.sample_questions[0] ??
					identities.find((identity) => identity.sample_questions.length > 0)
						?.sample_questions[0] ??
					'';

				return {
					tenant,
					source: workspace?.source ?? t('platform.tenantWorkspace.localSource'),
					identityCount: identities.length,
					roleCount: roles.size,
					agentCount: activePlatformAgents.filter((agent) => agent.tenant === tenant)
						.length,
					pendingApprovalCount: pendingApprovals.filter(
						(approval) => approval.tenant === tenant,
					).length,
					auditEventCount: auditEvents.filter((event) => event.tenant === tenant).length,
					workflowRunCount: workflowRuns.filter((run) => run.tenant === tenant).length,
					sampleQuestion,
					representativeIdentity: identities[0] ?? null,
				};
			});
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
	const platformMemberTenantSummaries = useMemo<PlatformMemberTenantSummary[]>(() => {
		const members = platformMembers?.members ?? [];
		const tenants = new Set<string>();

		members.forEach((member) => tenants.add(member.tenant));
		activePlatformAgents.forEach((agent) => tenants.add(agent.tenant));
		pendingApprovals.forEach((approval) => tenants.add(approval.tenant));
		auditEvents.forEach((event) => {
			if (event.tenant) {
				tenants.add(event.tenant);
			}
		});

		return Array.from(tenants)
			.sort()
			.map((tenant) => {
				const tenantMembers = members.filter((member) => member.tenant === tenant);
				const roleNames = Array.from(
					new Set(tenantMembers.map((member) => member.role).filter(Boolean)),
				).sort();

				return {
					tenant,
					members: tenantMembers.sort((first, second) =>
						(first.display_name || first.user_id).localeCompare(
							second.display_name || second.user_id,
						),
					),
					activeMemberCount: tenantMembers.filter(
						(member) => member.status !== 'inactive',
					).length,
					inactiveMemberCount: tenantMembers.filter(
						(member) => member.status === 'inactive',
					).length,
					roleNames,
					agentCount: activePlatformAgents.filter((agent) => agent.tenant === tenant)
						.length,
					pendingApprovalCount: pendingApprovals.filter(
						(approval) => approval.tenant === tenant,
					).length,
					auditEventCount: auditEvents.filter((event) => event.tenant === tenant).length,
				};
			});
	}, [activePlatformAgents, auditEvents, pendingApprovals, platformMembers?.members]);
	const memoryOperationsItems = useMemo<MemoryOperationsItem[]>(() => {
		const grouped = new Map<string, MemoryOperationsItem>();
		const agentNameById = new Map(
			activePlatformAgents.map((agent) => [agent.id, agent.name || agent.id]),
		);

		Object.values(agentConversations)
			.flat()
			.forEach((turn) => {
				const response = turn.response;
				const tenant = response.memory_scope?.tenant || response.tenant || 'default';
				const userId = response.memory_scope?.user_id || response.user_id || '';
				const agentId = response.memory_scope?.agent_id || response.agent_id || turn.agentId;
				const key = `${tenant}:${userId}:${agentId}`;
				const hitCount =
					response.evidence?.memory_hit_count ?? response.memory_hits?.length ?? 0;
				const memorySaved =
					response.evidence?.memory_saved ?? response.memory_saved ?? false;
				const sources = Array.from(
					new Set(
						(response.memory_hits ?? [])
							.map((hit) => hit.source)
							.filter((source): source is string => Boolean(source)),
					),
				);
				const current = grouped.get(key);
				const latestAt = response.evidence?.created_at || turn.createdAt;
				const agentName =
					response.agent_name ||
					agentNameById.get(agentId) ||
					turn.response.agent_name ||
					agentId;

				if (!current) {
					grouped.set(key, {
						key,
						tenant,
						userId,
						agentId,
						agentName,
						runCount: 1,
						memoryHitCount: hitCount,
						memorySavedCount: memorySaved ? 1 : 0,
						latestAt,
						latestQuestion: turn.question,
						latestAnswer: turn.answer,
						latestResponse: response,
						sources,
					});
					return;
				}

				current.runCount += 1;
				current.memoryHitCount += hitCount;
				current.memorySavedCount += memorySaved ? 1 : 0;
				current.sources = Array.from(new Set([...current.sources, ...sources]));

				const currentLatest = Date.parse(current.latestAt);
				const nextLatest = Date.parse(latestAt);
				if (
					Number.isNaN(currentLatest) ||
					(!Number.isNaN(nextLatest) && nextLatest > currentLatest)
				) {
					current.latestAt = latestAt;
					current.latestQuestion = turn.question;
					current.latestAnswer = turn.answer;
					current.latestResponse = response;
				}
			});

		return Array.from(grouped.values()).sort((left, right) => {
			const rightTime = Date.parse(right.latestAt);
			const leftTime = Date.parse(left.latestAt);
			return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
		});
	}, [activePlatformAgents, agentConversations]);
	const memoryOperationsRunCount = memoryOperationsItems.reduce(
		(total, item) => total + item.runCount,
		0,
	);
	const memoryOperationsHitCount = memoryOperationsItems.reduce(
		(total, item) => total + item.memoryHitCount,
		0,
	);
	const memoryOperationsSavedCount = memoryOperationsItems.reduce(
		(total, item) => total + item.memorySavedCount,
		0,
	);
	const riskToolItems =
		dashboard?.risk_tools ??
		availableToolItems.filter(
			(item) =>
				item.name === 'enterprise_summarize_department_metrics' ||
				item.name.includes('summarize'),
		);
	const workflowStatusCounts = dashboardOperations?.workflow_status_counts ?? {};
	const completedWorkflowRunCount = workflowStatusCounts.completed ?? 0;
	const partialWorkflowRunCount = workflowStatusCounts.partial ?? 0;
	const failedWorkflowRunCount = workflowStatusCounts.failed ?? 0;
	const governedWorkflowItems = dashboardOperations?.governed_workflows ?? [];
	const recommendedOperationActions = dashboardOperations?.recommended_actions ?? [];
	const dashboardTodoItems = [
		credentials.length === 0 ? t('platform.dashboard.todoModel') : null,
		activePlatformAgents.length === 0 ? t('platform.dashboard.todoAgent') : null,
		activePlatformAgents.length > 0 && readyPlatformAgents.length === 0
			? t('platform.dashboard.todoAgentReadiness')
			: null,
		pendingApprovals.length > 0
			? t('platform.dashboard.todoApproval', { count: pendingApprovals.length })
			: null,
		hasErrors ? t('platform.dashboard.todoErrors') : null,
	].filter(Boolean) as string[];
	const blockedOrPartialPlatformAgents = activePlatformAgents.filter(
		(agent) =>
			!readyPlatformAgents.some((readyAgent) => readyAgent.id === agent.id),
	);
	const appCenterAgents = [
		...readyPlatformAgents,
		...blockedOrPartialPlatformAgents,
	].slice(0, 3);
	const selectedAppCenterAgent =
		selectedAppCenterItem?.type === 'agent'
			? activePlatformAgents.find((agent) => agent.id === selectedAppCenterItem.id) ?? null
			: null;
	const selectedAppCenterTemplate =
		selectedAppCenterItem?.type === 'template'
			? agentTemplates.find((template) => template.id === selectedAppCenterItem.id) ?? null
			: null;
	const inspectedAppCenterAgent =
		selectedAppCenterAgent ??
		(selectedAppCenterItem?.type ? null : readyPlatformAgents[0] ?? appCenterAgents[0] ?? null);
	const inspectedAppCenterTemplate =
		selectedAppCenterTemplate ??
		(!inspectedAppCenterAgent ? defaultAgentTemplate : null);
	const appCenterPrimaryLabel =
		credentials.length === 0
			? t('platform.appCenter.configureModel')
			: readyPlatformAgents.length > 0
				? t('platform.appCenter.runReadyAgent')
				: activePlatformAgents.length === 0
					? t('platform.appCenter.quickPublish')
					: t('platform.appCenter.fixAgents');
	const appCenterPrimaryDisabled =
		credentials.length > 0 &&
		activePlatformAgents.length === 0 &&
		(!defaultAgentTemplate || Boolean(publishingTemplateId));
	const agentOpsSummary = [
		{
			label: t('platform.agentManagement.ops.publishedTotal'),
			value: publishedPlatformAgents.length,
			helper: t('platform.agentManagement.ops.publishedTotalHelper'),
		},
		{
			label: t('platform.agentManagement.ops.activeTotal'),
			value: activePlatformAgents.length,
			helper: t('platform.agentManagement.ops.activeTotalHelper'),
		},
		{
			label: t('platform.agentManagement.ops.readyTotal'),
			value: readyPlatformAgents.length,
			helper: t('platform.agentManagement.ops.readyTotalHelper'),
		},
		{
			label: t('platform.agentManagement.ops.needsSetupTotal'),
			value: blockedOrPartialPlatformAgents.length,
			helper: t('platform.agentManagement.ops.needsSetupTotalHelper', {
				count: archivedPlatformAgents.length,
			}),
		},
	];
	const topOperationsAgents = [
		...readyPlatformAgents,
		...blockedOrPartialPlatformAgents,
		...publishedPlatformAgents.filter((agent) => agent.status !== 'published'),
	].slice(0, 4);
	const operationsAgentIssueText = (agent: EnterprisePublishedAgent) => {
		if (agent.status !== 'published') {
			return t('platform.operations.archivedIssue');
		}

		const issue = agent.readiness?.issues[0];
		if (issue?.message) {
			return issue.message;
		}

		if ((agent.readiness?.status ?? 'partial') === 'ready') {
			return t('platform.operations.readyIssue');
		}

		return t('platform.operations.missingIssue');
	};
	const agentResourceText = (agent: EnterprisePublishedAgent) => {
		const knowledgeBaseIds = agent.knowledge_base_ids ?? [];
		const tools = agent.tools ?? [];
		const model = agent.model_config_id
			? credentialById.get(agent.model_config_id)
				? credentialLabel(credentialById.get(agent.model_config_id)!)
				: agent.model_config_id
			: t('platform.appCenter.noModel');

		return t('platform.appCenter.agentResources', {
			model,
			knowledge: knowledgeBaseIds.length,
			tools: tools.length,
		});
	};
	const inspectedAppCenterAgentKnowledgeBaseIds =
		inspectedAppCenterAgent?.knowledge_base_ids ?? [];
	const inspectedAppCenterAgentTools = inspectedAppCenterAgent?.tools ?? [];
	const inspectedAppCenterAgentAllowedUserIds =
		inspectedAppCenterAgent?.allowed_user_ids ?? [];
	const inspectedAppCenterAgentAllowedRoles =
		inspectedAppCenterAgent?.allowed_roles ?? [];
	const inspectedAppCenterTemplateTools = inspectedAppCenterTemplate?.tools ?? [];
	const inspectedAppCenterAgentReadiness: HealthState =
		inspectedAppCenterAgent?.readiness?.status ?? 'partial';
	const inspectedAppCenterAgentIssues =
		inspectedAppCenterAgent?.readiness?.issues.map((issue) => issue.message).filter(Boolean) ??
		[];
	const inspectedAppCenterAgentModel = inspectedAppCenterAgent?.model_config_id
		? credentialById.get(inspectedAppCenterAgent.model_config_id)
			? credentialLabel(credentialById.get(inspectedAppCenterAgent.model_config_id)!)
			: inspectedAppCenterAgent.model_config_id
		: t('platform.appCenter.noModel');
	const inspectedAppCenterAgentKnowledge =
		inspectedAppCenterAgentKnowledgeBaseIds.map((knowledgeBaseId) => {
			const knowledgeBase = knowledgeBaseById.get(knowledgeBaseId);
			return knowledgeBase ? knowledgeBaseLabel(knowledgeBase) : knowledgeBaseId;
		});
	const inspectedAppCenterAgentAccess =
		inspectedAppCenterAgentAllowedUserIds.length > 0 ||
		inspectedAppCenterAgentAllowedRoles.length > 0
			? t('platform.appCenter.restrictedAccess', {
					users: inspectedAppCenterAgentAllowedUserIds.length,
					roles: inspectedAppCenterAgentAllowedRoles.length,
				})
			: t('platform.appCenter.tenantAccess');
	const appCenterDetailResources = inspectedAppCenterAgent
		? [
				{
					label: t('platform.appCenter.model'),
					value: inspectedAppCenterAgentModel,
					icon: KeyRound,
				},
				{
					label: t('platform.appCenter.knowledgeBases'),
					value:
						inspectedAppCenterAgentKnowledge.length > 0
							? inspectedAppCenterAgentKnowledge.join(', ')
							: t('platform.appCenter.none'),
					icon: LibraryBig,
				},
				{
					label: t('platform.appCenter.tools'),
					value:
						inspectedAppCenterAgentTools.length > 0
							? inspectedAppCenterAgentTools.join(', ')
							: t('platform.appCenter.none'),
					icon: Boxes,
				},
				{
					label: t('platform.appCenter.runtime'),
					value: t('platform.appCenter.runtimeValue', {
						memory: inspectedAppCenterAgent.memory_enabled
							? t('platform.agentManagement.enabled')
							: t('platform.agentManagement.disabled'),
						workflow: inspectedAppCenterAgent.workflow_enabled
							? t('platform.agentManagement.enabled')
							: t('platform.agentManagement.disabled'),
					}),
					icon: Brain,
				},
				{
					label: t('platform.appCenter.access'),
					value: inspectedAppCenterAgentAccess,
					icon: UserRound,
				},
			]
		: inspectedAppCenterTemplate
			? [
					{
						label: t('platform.appCenter.model'),
						value:
							credentials.length > 0
								? t('platform.appCenter.availableModels', {
										count: credentials.length,
									})
								: t('platform.appCenter.noModel'),
						icon: KeyRound,
					},
					{
						label: t('platform.appCenter.knowledgeBases'),
						value:
							knowledgeBases.length > 0
								? t('platform.appCenter.availableKnowledgeBases', {
										count: knowledgeBases.length,
									})
								: t('platform.appCenter.none'),
						icon: LibraryBig,
					},
					{
						label: t('platform.appCenter.tools'),
						value:
							inspectedAppCenterTemplateTools.length > 0
								? inspectedAppCenterTemplateTools.join(', ')
								: t('platform.appCenter.none'),
						icon: Boxes,
					},
					{
						label: t('platform.appCenter.runtime'),
						value: t('platform.appCenter.templateRuntime'),
						icon: Brain,
					},
				]
			: [];
	const appCenterDetailIssues = inspectedAppCenterAgent
		? inspectedAppCenterAgentIssues
		: inspectedAppCenterTemplate
			? [
					credentials.length === 0 ? t('platform.dashboard.todoModel') : null,
					knowledgeBases.length === 0 ? t('platform.agentManagement.noKnowledge') : null,
				].filter(Boolean) as string[]
			: [];
	const appCenterDetailStatus: HealthState = inspectedAppCenterAgent
		? inspectedAppCenterAgentReadiness
		: appCenterDetailIssues.length === 0
			? 'ready'
			: credentials.length === 0
				? 'blocked'
				: 'partial';
	const operationsHeadline =
		activePlatformAgents.length === 0
			? t('platform.operations.headlineEmpty')
			: blockedOrPartialPlatformAgents.length > 0
				? t('platform.operations.headlineNeedsWork', {
						count: blockedOrPartialPlatformAgents.length,
					})
				: pendingApprovals.length > 0
					? t('platform.operations.headlineApprovals', {
							count: pendingApprovals.length,
						})
					: t('platform.operations.headlineReady');
	const agentReleasePipeline = [
		{
			key: 'template',
			title: t('platform.agentManagement.pipeline.template'),
			detail: selectedTemplate
				? selectedTemplate.name
				: t('platform.agentManagement.pipeline.templateDetail'),
			state: agentSetupSteps[0].state,
			icon: ListChecks,
		},
		{
			key: 'model',
			title: t('platform.agentManagement.pipeline.model'),
			detail: publishForm.model_config_id
				? credentialById.get(publishForm.model_config_id)
					? credentialLabel(credentialById.get(publishForm.model_config_id)!)
					: publishForm.model_config_id
				: t('platform.agentManagement.pipeline.modelDetail'),
			state: agentSetupSteps[1].state,
			icon: KeyRound,
		},
		{
			key: 'knowledge',
			title: t('platform.agentManagement.pipeline.knowledge'),
			detail:
				publishForm.knowledge_base_ids.length > 0
					? t('platform.agentManagement.selectedKnowledge', {
							count: publishForm.knowledge_base_ids.length,
						})
					: t('platform.agentManagement.pipeline.knowledgeDetail'),
			state: agentSetupSteps[2].state,
			icon: LibraryBig,
		},
		{
			key: 'tools',
			title: t('platform.agentManagement.pipeline.tools'),
			detail:
				publishForm.tools.length > 0
					? t('platform.agentManagement.wizard.toolsSelected', {
							count: publishForm.tools.length,
						})
					: t('platform.agentManagement.pipeline.toolsDetail'),
			state: agentSetupSteps[3].state,
			icon: Boxes,
		},
		{
			key: 'runtime',
			title: t('platform.agentManagement.pipeline.runtime'),
			detail: t('platform.agentManagement.wizard.runtimeDetail', {
				memory: publishForm.memory_enabled
					? t('platform.agentManagement.enabled')
					: t('platform.agentManagement.disabled'),
				workflow: publishForm.workflow_enabled
					? t('platform.agentManagement.enabled')
					: t('platform.agentManagement.disabled'),
			}),
			state: agentSetupSteps[4].state,
			icon: Brain,
		},
		{
			key: 'publish',
			title: t('platform.agentManagement.pipeline.publish'),
			detail:
				activePlatformAgents.length > 0
					? t('platform.agentManagement.pipeline.publishDetailReady', {
							count: activePlatformAgents.length,
						})
					: t('platform.agentManagement.pipeline.publishDetail'),
			state:
				activePlatformAgents.length > 0 ? 'ready' : selectedTemplate ? 'todo' : 'blocked',
			icon: BotMessageSquare,
		},
		{
			key: 'governance',
			title: t('platform.agentManagement.pipeline.governance'),
			detail:
				pendingApprovals.length > 0
					? t('platform.agentManagement.pipeline.governanceDetailPending', {
							count: pendingApprovals.length,
						})
					: t('platform.agentManagement.pipeline.governanceDetail'),
			state:
				auditEventCount > 0 || pendingApprovals.length > 0
					? 'ready'
					: selectedRunAgent
						? 'partial'
						: 'todo',
			icon: ShieldCheck,
		},
	] satisfies Array<{
		key: string;
		title: string;
		detail: string;
		state: HealthState;
		icon: ComponentType<{ className?: string }>;
	}>;
	const governanceIdentitySummaries = new Map(
		governance?.identity_summaries.map((summary) => [summary.user_id, summary]) ?? [],
	);
	const identityAccessRows = enterpriseIdentities.map((identity) => {
		const governanceSummary = governanceIdentitySummaries.get(identity.user_id);
		const allowedCount =
			governanceSummary?.allowed_count ??
			identity.tool_policy.decisions.filter((decision) => decision.allowed).length;
		const deniedCount =
			governanceSummary?.denied_count ??
			identity.tool_policy.decisions.length - allowedCount;
		const pendingCount =
			governanceSummary?.pending_approvals ??
			pendingApprovals.filter((approval) => approval.user_id === identity.user_id).length;

		return {
			identity,
			allowedCount,
			deniedCount,
			pendingCount,
			risk: deniedCount + pendingCount,
		};
	});
	const accessTenantSummaries = Object.values(
		governance?.tenant_summaries.map((tenant) => ({
			tenant: tenant.tenant,
			identities: tenant.identity_count,
			roles: tenant.roles,
			allowed: tenant.allowed_count,
			denied: tenant.denied_count,
			pending: tenant.pending_approvals,
		})) ??
			enterpriseIdentities.reduce<
				Record<
					string,
					{
						tenant: string;
						identities: number;
						roles: string[];
						allowed: number;
						denied: number;
						pending: number;
					}
				>
			>((summary, identity) => {
				const tenantSummary =
					summary[identity.tenant] ??
					(summary[identity.tenant] = {
						tenant: identity.tenant,
						identities: 0,
						roles: [],
						allowed: 0,
						denied: 0,
						pending: 0,
					});
				const decisions = identity.tool_policy.decisions;
				const allowed = decisions.filter((decision) => decision.allowed).length;
				const pending = pendingApprovals.filter(
					(approval) => approval.user_id === identity.user_id,
				).length;

				tenantSummary.identities += 1;
				if (!tenantSummary.roles.includes(identity.role)) {
					tenantSummary.roles.push(identity.role);
				}
				tenantSummary.allowed += allowed;
				tenantSummary.denied += decisions.length - allowed;
				tenantSummary.pending += pending;
				return summary;
			}, {}),
	);
	const selectedIdentityPendingApprovals = selectedIdentity
		? pendingApprovals.filter((approval) => approval.user_id === selectedIdentity.user_id)
		: [];
	const selectedIdentityPendingToolNames = useMemo(
		() =>
			new Set(
				selectedIdentityPendingApprovals
					.filter((approval) => approval.request_type === 'tool_run')
					.map((approval) => approval.tool_name)
					.filter((toolName): toolName is string => Boolean(toolName)),
			),
		[selectedIdentityPendingApprovals],
	);
	const toolPolicySummary = useMemo(() => {
		const effectiveAllowed = availableToolItems.filter((tool) => tool.allowed).length;
		const effectiveDenied = availableToolItems.length - effectiveAllowed;
		const draftAllow = Object.values(toolPolicyDraft).filter((value) => value === 'allow').length;
		const draftDeny = Object.values(toolPolicyDraft).filter((value) => value === 'deny').length;
		const draftInherit = Math.max(availableToolItems.length - draftAllow - draftDeny, 0);
		const pending = availableToolItems.filter((tool) =>
			selectedIdentityPendingToolNames.has(tool.name),
		).length;

		return {
			effectiveAllowed,
			effectiveDenied,
			draftAllow,
			draftDeny,
			draftInherit,
			pending,
		};
	}, [availableToolItems, selectedIdentityPendingToolNames, toolPolicyDraft]);
	const selectedIdentityFailedAuditEvents = selectedIdentity
		? auditEvents.filter(
				(event) =>
					event.user_id === selectedIdentity.user_id &&
					event.tenant === selectedIdentity.tenant &&
					event.success === false,
			)
		: [];
	const selectedIdentityRecentAuditEvents = selectedIdentity
		? auditEvents.filter(
				(event) =>
					event.user_id === selectedIdentity.user_id &&
					event.tenant === selectedIdentity.tenant,
			)
		: [];
	const riskyIdentityCount =
		governance?.summary.risky_identity_count ??
		identityAccessRows.filter((row) => row.risk > 0).length;
	const accessControlStats = [
		{
			label: t('platform.accessControl.identities'),
			value: enterpriseIdentities.length,
		},
		{
			label: t('platform.accessControl.tenants'),
			value: accessTenantSummaries.length,
		},
		{
			label: t('platform.accessControl.riskyIdentities'),
			value: riskyIdentityCount,
		},
		{
			label: t('platform.accessControl.pendingApprovals'),
			value: selectedIdentityPendingApprovals.length,
		},
	];
	const governanceHealthItems = [
		{
			label: t('platform.governanceHealth.tenants'),
			value: governance?.summary.tenant_count ?? accessTenantSummaries.length,
			helper: t('platform.governanceHealth.tenantsHelper'),
			state: accessTenantSummaries.length > 0 ? 'ready' : 'todo',
			icon: Building2,
		},
		{
			label: t('platform.governanceHealth.identities'),
			value: governance?.summary.identity_count ?? enterpriseIdentities.length,
			helper: t('platform.governanceHealth.identitiesHelper'),
			state: enterpriseIdentities.length > 0 ? 'ready' : 'todo',
			icon: UserRound,
		},
		{
			label: t('platform.governanceHealth.pendingApprovals'),
			value: governance?.summary.pending_approval_count ?? pendingApprovals.length,
			helper: t('platform.governanceHealth.pendingApprovalsHelper'),
			state: pendingApprovals.length > 0 ? 'partial' : 'ready',
			icon: AlertTriangle,
		},
		{
			label: t('platform.governanceHealth.auditEvents'),
			value: governance?.summary.audit_event_count ?? auditEventCount,
			helper:
				(governance?.summary.failed_audit_event_count ?? 0) > 0
					? t('platform.governanceHealth.auditEventsFailedHelper', {
							count: governance?.summary.failed_audit_event_count ?? 0,
						})
					: t('platform.governanceHealth.auditEventsHelper'),
			state:
				(governance?.summary.failed_audit_event_count ?? 0) > 0
					? 'partial'
					: auditEventCount > 0
						? 'ready'
						: 'todo',
			icon: FileClock,
		},
	] satisfies GovernanceHealthItem[];
	const workflowPendingApprovals = pendingApprovals.filter(
		(approval) => approval.request_type === 'workflow_run',
	);
	const enabledWorkflowTemplates = workflowTemplates.filter(
		(template) => template.enabled,
	);
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
	const workflowOpsStats = [
		{
			label: t('platform.workflowOps.templates'),
			value: workflowTemplates.length || workflowOptions.length,
		},
		{
			label: t('platform.workflowOps.enabled'),
			value:
				workflowTemplates.length > 0
					? enabledWorkflowTemplates.length
					: workflowOptions.length,
		},
		{
			label: t('platform.workflowOps.runs'),
			value: workflowRunCount,
		},
		{
			label: t('platform.workflowOps.approvals'),
			value: workflowPendingApprovals.length,
		},
	];
	const enabledSchedules = schedules.filter((schedule) => schedule.data.enabled);
	const agentSourceSchedules = schedules.filter((schedule) => schedule.data.source === 'AGENT');
	const userSourceSchedules = schedules.filter((schedule) => schedule.data.source === 'USER');
	const recentSchedules = [...schedules]
		.sort((left, right) => scheduleSortTime(right) - scheduleSortTime(left))
		.slice(0, 4);
	const triggerOpsStats = [
		{
			label: t('platform.triggerOps.schedules'),
			value: schedules.length,
		},
		{
			label: t('platform.triggerOps.enabled'),
			value: enabledSchedules.length,
		},
		{
			label: t('platform.triggerOps.agentSource'),
			value: agentSourceSchedules.length,
		},
		{
			label: t('platform.triggerOps.userSource'),
			value: userSourceSchedules.length,
		},
	];
	const triggerOpsSummary =
		schedules.length === 0
			? t('platform.triggerOps.summaryManual')
			: enabledSchedules.length === 0
				? t('platform.triggerOps.summaryPaused')
				: t('platform.triggerOps.summaryActive', {
						count: enabledSchedules.length,
					});
	const auditStats = [
		{
			label: t('platform.audit.summaryReturned'),
			value: auditSummary?.total_returned ?? auditEvents.length,
		},
		{
			label: t('platform.audit.summarySuccesses'),
			value:
				auditSummary?.successes ??
				auditEvents.filter((event) => event.success === true).length,
		},
		{
			label: t('platform.audit.summaryFailures'),
			value:
				auditSummary?.failures ??
				auditEvents.filter((event) => event.success === false).length,
		},
		{
			label: t('platform.audit.summaryAvgDuration'),
			value:
				auditSummary?.avg_duration_ms === null ||
				auditSummary?.avg_duration_ms === undefined
					? '-'
					: `${Math.round(auditSummary.avg_duration_ms)} ms`,
		},
	];
	const scheduleAgentLabel = (schedule: ScheduleRecord) =>
		activePlatformAgents.find((agent) => agent.id === schedule.agent_id)?.name ||
		agents.find((agent) => agent.id === schedule.agent_id)?.data.name ||
		schedule.agent_id ||
		t('platform.triggerOps.unknownAgent');

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
		const activeMembersForTenant = (platformMembers?.members ?? []).filter(
			(member) => member.status !== 'inactive' && member.tenant === nextTenant,
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
			if ((inspectedAppCenterAgent.readiness?.status ?? 'partial') === 'ready') {
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

	const capabilities: Capability[] = [
		{
			title: t('platform.capabilities.model.title'),
			description: t('platform.capabilities.model.description'),
			metric: t('platform.capabilities.model.metric', { count: credentials.length }),
			actionLabel: t('platform.capabilities.model.action'),
			status: credentials.length > 0 ? t('platform.status.ready') : t('platform.status.toConfigure'),
			state: credentials.length > 0 ? 'ready' : 'partial',
			icon: KeyRound,
			onClick: () => navigate('/credential'),
		},
		{
			title: t('platform.capabilities.knowledge.title'),
			description: t('platform.capabilities.knowledge.description'),
			metric: t('platform.capabilities.knowledge.metric', { count: knowledgeBases.length }),
			actionLabel: t('platform.capabilities.knowledge.action'),
			status:
				knowledgeBases.length > 0 ? t('platform.status.ready') : t('platform.status.toConfigure'),
			state: knowledgeBases.length > 0 ? 'ready' : 'partial',
			icon: Database,
			onClick: () => navigate('/knowledge'),
		},
		{
			title: t('platform.capabilities.agent.title'),
			description: t('platform.capabilities.agent.description'),
			metric: t('platform.capabilities.agent.metric', {
				count: activePlatformAgents.length,
			}),
			actionLabel: t('platform.capabilities.agent.action'),
			status:
				activePlatformAgents.length > 0
					? t('platform.status.ready')
					: t('platform.status.toConfigure'),
			state: activePlatformAgents.length > 0 ? 'ready' : 'todo',
			icon: BotMessageSquare,
			onClick: handleStartPublishing,
		},
		{
			title: t('platform.capabilities.tools.title'),
			description: t('platform.capabilities.tools.description'),
			metric: t('platform.capabilities.tools.metric', { count: availableToolItems.length }),
			actionLabel: t('platform.capabilities.tools.action'),
			status:
				availableToolItems.length > 0
					? t('platform.status.demoReady')
					: t('platform.status.toConfigure'),
			state: availableToolItems.length > 0 ? 'ready' : 'partial',
			icon: Boxes,
			onClick: scrollToToolRunner,
		},
		{
			title: t('platform.capabilities.workflow.title'),
			description: t('platform.capabilities.workflow.description'),
			metric: t('platform.capabilities.workflow.metric', {
				count: workflowTemplates.length || schedules.length,
			}),
			actionLabel: t('platform.capabilities.workflow.action'),
			status:
				workflowTemplates.length > 0 || schedules.length > 0
					? t('platform.status.ready')
					: t('platform.status.toConfigure'),
			state: workflowTemplates.length > 0 || schedules.length > 0 ? 'ready' : 'todo',
			icon: Clock3,
			onClick: scrollToWorkflowRunner,
		},
		{
			title: t('platform.capabilities.tenant.title'),
			description: t('platform.capabilities.tenant.description'),
			metric: t('platform.capabilities.tenant.metric', {
				count: platformMemberTenantSummaries.length,
			}),
			actionLabel: t('platform.capabilities.tenant.action'),
			status:
				platformMemberTenantSummaries.length > 0
					? t('platform.status.ready')
					: t('platform.status.toConfigure'),
			state: platformMemberTenantSummaries.length > 0 ? 'ready' : 'partial',
			icon: ShieldCheck,
			onClick: scrollToMembers,
		},
		{
			title: t('platform.capabilities.audit.title'),
			description: t('platform.capabilities.audit.description'),
			metric: t('platform.capabilities.audit.metric', {
				count: pendingApprovals.length,
				auditCount: auditEventCount,
			}),
			actionLabel: t('platform.capabilities.audit.action'),
			status:
				pendingApprovals.length > 0 ? t('platform.status.next') : t('platform.status.ready'),
			state: pendingApprovals.length > 0 ? 'partial' : 'ready',
			icon: Network,
			onClick: scrollToGovernance,
		},
		{
			title: t('platform.capabilities.config.title'),
			description: t('platform.capabilities.config.description'),
			metric: t('platform.capabilities.config.metric', {
				members: platformConfigExport?.counts.members ?? 0,
				agents: platformConfigExport?.counts.agents ?? 0,
			}),
			actionLabel: t('platform.capabilities.config.action'),
			status: platformConfigExport ? t('platform.status.ready') : t('platform.status.toConfigure'),
			state: platformConfigExport ? 'ready' : 'partial',
			icon: Upload,
			onClick: scrollToConfigManagement,
		},
	];

	const launchpadTargetActions: Record<string, () => void> = {
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
		audit: scrollToGovernance,
	};
	const activeMemberCount =
		platformMembers?.members.filter((member) => member.status !== 'inactive').length ?? 0;
	const launchpadFallbackSteps = [
		{
			key: 'members',
			target: 'members',
			icon: UserRound,
			state: activeMemberCount > 0 ? 'ready' : 'blocked',
		},
		{
			key: 'model',
			target: 'credentials',
			icon: KeyRound,
			state: credentials.length > 0 ? 'ready' : 'blocked',
		},
		{
			key: 'knowledge',
			target: 'knowledge',
			icon: LibraryBig,
			state: knowledgeBases.length > 0 ? 'ready' : 'blocked',
		},
		{
			key: 'agent',
			target: 'agents',
			icon: BotMessageSquare,
			state:
				readyPlatformAgents.length > 0
					? 'ready'
					: activePlatformAgents.length > 0
						? 'partial'
						: 'blocked',
		},
		{
			key: 'run',
			target: 'run',
			icon: Play,
			state:
				agentRunResult
					? 'ready'
					: selectedRunAgent || readyPlatformAgents.length > 0
						? 'partial'
						: 'blocked',
		},
		{
			key: 'governance',
			target: 'governance',
			icon: ShieldCheck,
			state:
				auditEventCount > 0
					? 'ready'
					: agentRunResult || pendingApprovals.length > 0
						? 'partial'
						: 'blocked',
		},
	];
	const launchpadSteps = launchpadFallbackSteps.map((step) => ({
		key: step.key,
		title: t(`platform.launchpad.${step.key}.title`),
		description: t(`platform.launchpad.${step.key}.description`),
		actionLabel: t(`platform.launchpad.${step.key}.action`),
		icon: step.icon,
		state: step.state as HealthState,
		onClick: launchpadTargetActions[step.target] ?? scrollToGovernance,
	})) satisfies LaunchpadStep[];
	const launchpadReadyCount = launchpadSteps.filter((step) => step.state === 'ready').length;
	const launchpadTotalCount = launchpadSteps.length;
	const launchpadState: HealthState =
		launchpadReadyCount === launchpadTotalCount
			? 'ready'
			: launchpadReadyCount > 0
				? 'partial'
				: 'blocked';
	const launchpadStateLabel = t(`platform.launchpad.${launchpadState}`);
	const launchpadPrimaryStep =
		launchpadSteps.find((step) => step.state !== 'ready') ??
		launchpadSteps[launchpadSteps.length - 1];

	const platformConsoleItems = [
		{
			key: 'agents',
			title: t('platform.console.agents'),
			description: t('platform.console.agentsDescription'),
			actionLabel: t('platform.console.agentsAction'),
			icon: BotMessageSquare,
			onClick: handleStartPublishing,
		},
		{
			key: 'resources',
			title: t('platform.console.resources'),
			description: t('platform.console.resourcesDescription'),
			actionLabel: t('platform.console.resourcesAction'),
			icon: Network,
			onClick: scrollToConnectorCenter,
		},
		{
			key: 'run',
			title: t('platform.console.run'),
			description: t('platform.console.runDescription'),
			actionLabel: t('platform.console.runAction'),
			icon: Play,
			onClick: scrollToAgentRunner,
		},
		{
			key: 'governance',
			title: t('platform.console.governance'),
			description: t('platform.console.governanceDescription'),
			actionLabel: t('platform.console.governanceAction'),
			icon: ShieldCheck,
			onClick: scrollToGovernance,
		},
	] satisfies PlatformConsoleItem[];
	const workbenchIndicators = [
		{
			key: 'agents',
			label: t('platform.workbench.indicators.readyAgents'),
			value: `${readyPlatformAgents.length}/${activePlatformAgents.length}`,
			helper: t('platform.workbench.indicators.readyAgentsHelper'),
			icon: BotMessageSquare,
			state:
				readyPlatformAgents.length > 0
					? 'ready'
					: activePlatformAgents.length > 0
						? 'partial'
						: 'todo',
			onClick: scrollToAgentRunner,
		},
		{
			key: 'approvals',
			label: t('platform.workbench.indicators.approvals'),
			value: pendingApprovals.length,
			helper: t('platform.workbench.indicators.approvalsHelper'),
			icon: ShieldCheck,
			state: pendingApprovals.length > 0 ? 'partial' : 'ready',
			onClick: scrollToGovernance,
		},
		{
			key: 'workflows',
			label: t('platform.workbench.indicators.workflowRuns'),
			value: recentWorkflowRuns.length,
			helper: t('platform.workbench.indicators.workflowRunsHelper'),
			icon: Workflow,
			state:
				recentWorkflowRuns.length > 0
					? failedWorkflowRunCount > 0
						? 'partial'
						: 'ready'
					: 'todo',
			onClick: scrollToWorkflowRunner,
		},
		{
			key: 'memory',
			label: t('platform.workbench.indicators.memory'),
			value: memoryOperationsSavedCount + memoryOperationsHitCount,
			helper: t('platform.workbench.indicators.memoryHelper', {
				saved: memoryOperationsSavedCount,
				hits: memoryOperationsHitCount,
			}),
			icon: Brain,
			state: memoryOperationsItems.length > 0 ? 'ready' : 'todo',
			onClick: scrollToMemoryOperations,
		},
	] satisfies WorkbenchIndicator[];
	const workbenchActions = [
		{
			key: 'run',
			title: t('platform.workbench.actions.run.title'),
			description: selectedRunAgent
				? t('platform.workbench.actions.run.descriptionReady', {
						agent: selectedRunAgent.name,
					})
				: t('platform.workbench.actions.run.descriptionEmpty'),
			actionLabel: selectedRunAgent
				? t('platform.workbench.actions.run.action')
				: t('platform.workbench.actions.run.publishAction'),
			icon: Play,
			primary: true,
			onClick: selectedRunAgent ? scrollToAgentRunner : handleStartPublishing,
		},
		{
			key: 'workflow',
			title: t('platform.workbench.actions.workflow.title'),
			description: t('platform.workbench.actions.workflow.description', {
				count: workflowTemplates.length,
			}),
			actionLabel: t('platform.workbench.actions.workflow.action'),
			icon: Workflow,
			primary: false,
			onClick: scrollToWorkflowRunner,
		},
		{
			key: 'governance',
			title: t('platform.workbench.actions.governance.title'),
			description: t('platform.workbench.actions.governance.description', {
				count: pendingApprovals.length,
			}),
			actionLabel: t('platform.workbench.actions.governance.action'),
			icon: ShieldCheck,
			primary: false,
			onClick: scrollToGovernance,
		},
		{
			key: 'memory',
			title: t('platform.workbench.actions.memory.title'),
			description: t('platform.workbench.actions.memory.description', {
				count: memoryOperationsRunCount,
			}),
			actionLabel: t('platform.workbench.actions.memory.action'),
			icon: Brain,
			primary: false,
			onClick: scrollToMemoryOperations,
		},
	] satisfies WorkbenchActionCard[];
	const workbenchReadinessItems = [
		{
			key: 'model',
			title: t('platform.workbench.readiness.model.title'),
			description: t('platform.workbench.readiness.model.description', {
				count: credentials.length,
			}),
			state: credentials.length > 0 ? 'ready' : 'blocked',
			icon: KeyRound,
			onClick: () => navigate('/credential'),
		},
		{
			key: 'knowledge',
			title: t('platform.workbench.readiness.knowledge.title'),
			description: t('platform.workbench.readiness.knowledge.description', {
				count: knowledgeBases.length,
			}),
			state: knowledgeBases.length > 0 ? 'ready' : 'blocked',
			icon: LibraryBig,
			onClick: () => navigate('/knowledge'),
		},
		{
			key: 'connectors',
			title: t('platform.workbench.readiness.connectors.title'),
			description: t('platform.workbench.readiness.connectors.description', {
				count: savedConnectorConfigs.length,
			}),
			state:
				connectorDraftIssues.length > 0
					? 'blocked'
					: savedConnectorConfigs.length > 0 || connectors?.runtime.saved_config_enabled
						? 'ready'
						: 'partial',
			icon: Network,
			onClick: scrollToConnectorCenter,
		},
		{
			key: 'members',
			title: t('platform.workbench.readiness.members.title'),
			description: t('platform.workbench.readiness.members.description', {
				count: activeMemberCount,
			}),
			state: activeMemberCount > 0 ? 'ready' : 'blocked',
			icon: UserRound,
			onClick: scrollToMembers,
		},
		{
			key: 'agents',
			title: t('platform.workbench.readiness.agents.title'),
			description: t('platform.workbench.readiness.agents.description', {
				ready: readyPlatformAgents.length,
				total: activePlatformAgents.length,
			}),
			state:
				readyPlatformAgents.length > 0
					? 'ready'
					: activePlatformAgents.length > 0
						? 'partial'
						: 'blocked',
			icon: BotMessageSquare,
			onClick: handleStartPublishing,
		},
		{
			key: 'workflows',
			title: t('platform.workbench.readiness.workflows.title'),
			description: t('platform.workbench.readiness.workflows.description', {
				count: workflowTemplates.length,
			}),
			state: workflowTemplates.length > 0 ? 'ready' : 'partial',
			icon: Workflow,
			onClick: scrollToWorkflowRunner,
		},
	] satisfies WorkbenchReadinessItem[];
	const workbenchRiskItems = [
		hasErrors
			? {
					key: 'errors',
					label: t('platform.workbench.risks.errors'),
					state: 'blocked' as HealthState,
					onClick: scrollToGovernance,
				}
			: null,
		connectorDraftIssues.length > 0
			? {
					key: 'connectorDraft',
					label: t('platform.workbench.risks.connectorDraft', {
						count: connectorDraftIssues.length,
					}),
					state: 'blocked' as HealthState,
					onClick: scrollToConnectorCenter,
				}
			: null,
		pendingApprovals.length > 0
			? {
					key: 'approvals',
					label: t('platform.workbench.risks.approvals', {
						count: pendingApprovals.length,
					}),
					state: 'partial' as HealthState,
					onClick: scrollToGovernance,
				}
			: null,
		failedWorkflowRunCount > 0
			? {
					key: 'workflowFailures',
					label: t('platform.workbench.risks.workflowFailures', {
						count: failedWorkflowRunCount,
					}),
					state: 'partial' as HealthState,
					onClick: scrollToWorkflowRunner,
				}
			: null,
		readyPlatformAgents.length === 0
			? {
					key: 'agents',
					label: t('platform.workbench.risks.agents'),
					state: 'blocked' as HealthState,
					onClick: handleStartPublishing,
				}
			: null,
	].filter(Boolean) as WorkbenchRiskItem[];
	const workbenchQuickActions = [
		{
			key: 'connectors',
			label: t('platform.workbench.quickActions.connectors'),
			icon: Network,
			onClick: scrollToConnectorCenter,
		},
		{
			key: 'publish',
			label: t('platform.workbench.quickActions.publish'),
			icon: BotMessageSquare,
			onClick: handleStartPublishing,
		},
		{
			key: 'run',
			label: t('platform.workbench.quickActions.run'),
			icon: Play,
			onClick: scrollToAgentRunner,
		},
		{
			key: 'workflow',
			label: t('platform.workbench.quickActions.workflow'),
			icon: Workflow,
			onClick: scrollToWorkflowRunner,
		},
		{
			key: 'governance',
			label: t('platform.workbench.quickActions.governance'),
			icon: ShieldCheck,
			onClick: scrollToGovernance,
		},
		{
			key: 'tools',
			label: t('platform.workbench.quickActions.tools'),
			icon: Boxes,
			onClick: scrollToToolRunner,
		},
	] satisfies WorkbenchQuickAction[];
	const rolloutPathSteps = [
		{
			key: 'model',
			icon: KeyRound,
			state: credentials.length > 0 ? 'ready' : 'blocked',
			onClick: () => navigate('/credential'),
		},
		{
			key: 'knowledge',
			icon: LibraryBig,
			state: knowledgeBases.length > 0 ? 'ready' : 'blocked',
			onClick: () => navigate('/knowledge'),
		},
		{
			key: 'agent',
			icon: BotMessageSquare,
			state:
				readyPlatformAgents.length > 0
					? 'ready'
					: activePlatformAgents.length > 0
						? 'partial'
						: 'blocked',
			onClick: handleStartPublishing,
		},
		{
			key: 'run',
			icon: Play,
			state:
				agentRunResult
					? 'ready'
					: selectedRunAgent || readyPlatformAgents.length > 0
						? 'partial'
						: 'todo',
			onClick: scrollToAgentRunner,
		},
		{
			key: 'governance',
			icon: ShieldCheck,
			state:
				auditEventCount > 0
					? 'ready'
					: agentRunResult || pendingApprovals.length > 0
						? 'partial'
						: 'todo',
			onClick: scrollToGovernance,
		},
		{
			key: 'config',
			icon: Upload,
			state: platformConfigExport ? 'ready' : 'partial',
			onClick: scrollToConfigManagement,
		},
	].map((step) => ({
		...step,
		title: t(`platform.workbench.rolloutPath.steps.${step.key}.title`),
		description: t(`platform.workbench.rolloutPath.steps.${step.key}.description`),
		actionLabel: t(`platform.workbench.rolloutPath.steps.${step.key}.action`),
		state: step.state as HealthState,
	})) satisfies RolloutPathStep[];
	const firstAgentGuideSteps = [
		{
			key: 'model',
			icon: KeyRound,
			state: credentials.length > 0 ? 'ready' : 'blocked',
			detail:
				credentials.length > 0
					? t('platform.workbench.firstAgentGuide.steps.model.ready', {
							count: credentials.length,
						})
					: t('platform.workbench.firstAgentGuide.steps.model.empty'),
			onClick: () => navigate('/credential'),
		},
		{
			key: 'agent',
			icon: BotMessageSquare,
			state:
				readyPlatformAgents.length > 0
					? 'ready'
					: activePlatformAgents.length > 0
						? 'partial'
						: credentials.length > 0
							? 'todo'
							: 'blocked',
			detail:
				readyPlatformAgents.length > 0
					? t('platform.workbench.firstAgentGuide.steps.agent.ready', {
							count: readyPlatformAgents.length,
						})
					: activePlatformAgents.length > 0
						? t('platform.workbench.firstAgentGuide.steps.agent.partial', {
								count: activePlatformAgents.length,
							})
						: t('platform.workbench.firstAgentGuide.steps.agent.empty'),
			onClick: () => void handleQuickPublishAgent(),
		},
		{
			key: 'run',
			icon: Play,
			state: agentRunResult ? 'ready' : readyPlatformAgents.length > 0 ? 'todo' : 'blocked',
			detail: agentRunResult
				? t('platform.workbench.firstAgentGuide.steps.run.ready')
				: selectedRunAgent
					? t('platform.workbench.firstAgentGuide.steps.run.partial')
					: t('platform.workbench.firstAgentGuide.steps.run.empty'),
			onClick: scrollToAgentRunner,
		},
		{
			key: 'governance',
			icon: ShieldCheck,
			state:
				auditEventCount > 0
					? 'ready'
					: agentRunResult || pendingApprovals.length > 0
						? 'partial'
						: 'blocked',
			detail:
				auditEventCount > 0
					? t('platform.workbench.firstAgentGuide.steps.governance.ready', {
							count: auditEventCount,
						})
					: pendingApprovals.length > 0
						? t('platform.workbench.firstAgentGuide.steps.governance.pending', {
								count: pendingApprovals.length,
							})
						: t('platform.workbench.firstAgentGuide.steps.governance.empty'),
			onClick: scrollToGovernance,
		},
	].map((step) => ({
		...step,
		title: t(`platform.workbench.firstAgentGuide.steps.${step.key}.title`),
		actionLabel: t(`platform.workbench.firstAgentGuide.steps.${step.key}.action`),
		state: step.state as HealthState,
	})) satisfies FirstAgentGuideStep[];
	const firstAgentGuidePrimaryStep =
		firstAgentGuideSteps.find((step) => step.state === 'blocked') ??
		firstAgentGuideSteps.find((step) => step.state === 'todo') ??
		firstAgentGuideSteps.find((step) => step.state === 'partial') ??
		firstAgentGuideSteps[firstAgentGuideSteps.length - 1];
	const orchestrationWorkbenchSteps = [
		{
			key: 'template',
			title: t('platform.orchestration.template.title'),
			description: t('platform.orchestration.template.description'),
			detail: selectedTemplate
				? selectedTemplate.name
				: t('platform.orchestration.template.empty'),
			state: agentSetupSteps[0].state,
			icon: ListChecks,
			onClick: handleStartPublishing,
			actionLabel: t('platform.orchestration.template.action'),
		},
		{
			key: 'model',
			title: t('platform.orchestration.model.title'),
			description: t('platform.orchestration.model.description'),
			detail:
				credentials.length > 0
					? t('platform.orchestration.model.ready', { count: credentials.length })
					: t('platform.orchestration.model.empty'),
			state: credentials.length > 0 ? agentSetupSteps[1].state : 'blocked',
			icon: KeyRound,
			onClick: () => navigate('/credential'),
			actionLabel: t('platform.orchestration.model.action'),
		},
		{
			key: 'knowledge',
			title: t('platform.orchestration.knowledge.title'),
			description: t('platform.orchestration.knowledge.description'),
			detail:
				publishForm.knowledge_base_ids.length > 0
					? t('platform.agentManagement.selectedKnowledge', {
							count: publishForm.knowledge_base_ids.length,
						})
					: t('platform.orchestration.knowledge.ready', {
							count: knowledgeBases.length,
						}),
			state: agentSetupSteps[2].state,
			icon: LibraryBig,
			onClick:
				knowledgeBases.length === 0
					? () => navigate('/knowledge')
					: handleNextAgentSetupStep,
			actionLabel: t('platform.orchestration.knowledge.action'),
		},
		{
			key: 'tools',
			title: t('platform.orchestration.tools.title'),
			description: t('platform.orchestration.tools.description'),
			detail:
				publishForm.tools.length > 0
					? t('platform.agentManagement.wizard.toolsSelected', {
							count: publishForm.tools.length,
						})
					: t('platform.orchestration.tools.ready', {
							count: availableToolItems.length,
						}),
			state: agentSetupSteps[3].state,
			icon: Boxes,
			onClick: handleNextAgentSetupStep,
			actionLabel: t('platform.orchestration.tools.action'),
		},
		{
			key: 'policy',
			title: t('platform.orchestration.policy.title'),
			description: t('platform.orchestration.policy.description'),
			detail: t('platform.orchestration.policy.detail', {
				users: publishForm.allowed_user_ids.length,
				roles: publishForm.allowed_roles.length,
			}),
			state: agentSetupSteps[4].state,
			icon: ShieldCheck,
			onClick: handleNextAgentSetupStep,
			actionLabel: t('platform.orchestration.policy.action'),
		},
		{
			key: 'publish',
			title: t('platform.orchestration.publish.title'),
			description: t('platform.orchestration.publish.description'),
			detail:
				activePlatformAgents.length > 0
					? t('platform.orchestration.publish.ready', {
							count: activePlatformAgents.length,
						})
					: t('platform.orchestration.publish.empty'),
			state:
				activePlatformAgents.length > 0 ? 'ready' : selectedTemplate ? 'todo' : 'blocked',
			icon: BotMessageSquare,
			onClick: handleStartPublishing,
			actionLabel: t('platform.orchestration.publish.action'),
		},
		{
			key: 'operate',
			title: t('platform.orchestration.operate.title'),
			description: t('platform.orchestration.operate.description'),
			detail:
				auditEventCount > 0
					? t('platform.orchestration.operate.ready', { count: auditEventCount })
					: pendingApprovals.length > 0
						? t('platform.orchestration.operate.pending', {
								count: pendingApprovals.length,
							})
						: t('platform.orchestration.operate.empty'),
			state:
				auditEventCount > 0
					? 'ready'
					: selectedRunAgent || pendingApprovals.length > 0
						? 'partial'
						: 'todo',
			icon: Workflow,
			onClick: selectedRunAgent ? scrollToAgentRunner : scrollToWorkflowRunner,
			actionLabel: t('platform.orchestration.operate.action'),
		},
	] satisfies OrchestrationWorkbenchStep[];
	const orchestrationReadyCount = orchestrationWorkbenchSteps.filter(
		(step) => step.state === 'ready',
	).length;
	const orchestrationPrimaryStep =
		orchestrationWorkbenchSteps.find((step) => step.state === 'blocked') ??
		orchestrationWorkbenchSteps.find((step) => step.state === 'todo') ??
		orchestrationWorkbenchSteps.find((step) => step.state === 'partial') ??
		orchestrationWorkbenchSteps[orchestrationWorkbenchSteps.length - 1];
	const recentAgentTurns = Object.values(agentConversations)
		.flat()
		.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
		.slice(0, 3);
	const monitoringAuditSuccessCount =
		auditSummary?.successes ?? auditEvents.filter((event) => event.success === true).length;
	const monitoringAuditFailureCount =
		auditSummary?.failures ?? auditEvents.filter((event) => event.success === false).length;
	const monitoringHealthState: HealthState =
		monitoringAuditFailureCount > 0 || failedWorkflowRunCount > 0
			? 'blocked'
			: pendingApprovals.length > 0 || partialWorkflowRunCount > 0
				? 'partial'
				: recentAgentTurns.length > 0 || workflowRunCount > 0 || auditEventCount > 0
					? 'ready'
					: 'todo';
	const monitoringLoading =
		platformLoading ||
		agentRunsLoading ||
		workflowRunsLoading ||
		auditLoading ||
		approvalLoading ||
		governanceLoading;
	const monitoringStats = [
		{
			label: t('platform.monitoring.agentRuns'),
			value: recentAgentTurns.length,
			helper: t('platform.monitoring.agentRunsHelper'),
			icon: BotMessageSquare,
		},
		{
			label: t('platform.monitoring.workflowRuns'),
			value: workflowRunCount,
			helper: t('platform.monitoring.workflowRunsHelper', {
				completed: completedWorkflowRunCount,
				partial: partialWorkflowRunCount,
				failed: failedWorkflowRunCount,
			}),
			icon: Workflow,
		},
		{
			label: t('platform.monitoring.toolAudit'),
			value: auditEventCount,
			helper: t('platform.monitoring.toolAuditHelper', {
				success: monitoringAuditSuccessCount,
				failure: monitoringAuditFailureCount,
			}),
			icon: ShieldCheck,
		},
		{
			label: t('platform.monitoring.pendingApprovals'),
			value: pendingApprovals.length,
			helper: t('platform.monitoring.pendingApprovalsHelper'),
			icon: Clock3,
		},
	] satisfies MonitoringStat[];

	if (view === 'tenants') {
		return (
			<main className="h-full overflow-y-auto bg-background">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
					<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0">
							<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
								<Building2 className="size-4" />
								<span>{t('platform.members.organizationOverview')}</span>
							</div>
							<h1 className="text-2xl font-semibold tracking-normal">
								成员与租户治理
							</h1>
							<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
								按租户查看成员、角色、已绑定 Agent、审批和连接器工作区，先把多租户隔离关系管清楚。
							</p>
						</div>
						<div className="flex flex-wrap gap-2 lg:justify-end">
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => void refetchMembers()}
								disabled={platformMembersLoading}
							>
								<RefreshCcw
									className={cn(platformMembersLoading && 'animate-spin')}
								/>
								{t('platform.actions.refreshStatus')}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => void refetchConnectors()}
								disabled={connectorsLoading}
							>
								<Network className={cn(connectorsLoading && 'animate-pulse')} />
								{t('platform.connectors.title')}
							</Button>
						</div>
					</section>

					{platformMembersError ? <PlatformNotice>{platformMembersError}</PlatformNotice> : null}
					{connectorsError ? <PlatformNotice>{connectorsError}</PlatformNotice> : null}

					<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
						{[
							{
								label: t('platform.members.tenantGroups'),
								value: platformMemberTenantSummaries.length,
								icon: Building2,
							},
							{
								label: t('platform.members.activeMembers'),
								value: activeMemberCount,
								icon: UserRound,
							},
							{
								label: t('platform.members.roles'),
								value: platformMembers?.roles.length ?? 0,
								icon: ShieldCheck,
							},
							{
								label: t('platform.members.boundAgents'),
								value: activePlatformAgents.length,
								icon: BotMessageSquare,
							},
							{
								label: t('platform.members.pendingApprovals'),
								value: pendingApprovals.length,
								icon: Clock3,
							},
						].map((item) => {
							const Icon = item.icon;
							return (
								<Card key={item.label} size="sm" className="rounded-lg shadow-none">
									<CardHeader className="grid-cols-[1fr_auto] items-start gap-3">
										<CardTitle className="text-sm text-muted-foreground">
											{item.label}
										</CardTitle>
										<Icon className="size-4 text-muted-foreground" />
									</CardHeader>
									<CardContent>
										<div className="text-2xl font-semibold tabular-nums">
											{item.value}
										</div>
									</CardContent>
								</Card>
							);
						})}
					</section>

					<section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
						<Card className="rounded-lg shadow-none">
							<CardHeader>
								<CardTitle className="text-base">
									{t('platform.members.groupedListTitle')}
								</CardTitle>
							</CardHeader>
							<CardContent>
								{platformMembersLoading && !platformMembers ? (
									<div className="grid gap-3">
										<Skeleton className="h-24 rounded-lg" />
										<Skeleton className="h-24 rounded-lg" />
									</div>
								) : platformMemberTenantSummaries.length ? (
									<div className="grid gap-3">
										{platformMemberTenantSummaries.map((tenantSummary) => (
											<div
												key={tenantSummary.tenant}
												className="grid gap-3 rounded-lg border bg-muted/10 p-3"
											>
												<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2">
															<h3 className="text-sm font-semibold">
																{tenantSummary.tenant}
															</h3>
															<Badge variant="secondary">
																{tenantSummary.activeMemberCount}{' '}
																{t('platform.members.activeMembers')}
															</Badge>
															{tenantSummary.inactiveMemberCount > 0 ? (
																<Badge variant="outline">
																	{tenantSummary.inactiveMemberCount}{' '}
																	{t('platform.members.inactiveMembers')}
																</Badge>
															) : null}
														</div>
														<div className="mt-2 flex flex-wrap gap-1">
															<Badge variant="outline">
																{t('platform.members.roles')}:{' '}
																{tenantSummary.roleNames.length}
															</Badge>
															<Badge variant="outline">
																{t('platform.members.boundAgents')}:{' '}
																{tenantSummary.agentCount}
															</Badge>
															<Badge variant="outline">
																{t('platform.members.pendingApprovals')}:{' '}
																{tenantSummary.pendingApprovalCount}
															</Badge>
															<Badge variant="outline">
																{t('platform.members.auditEvents')}:{' '}
																{tenantSummary.auditEventCount}
															</Badge>
														</div>
													</div>
													<Button
														type="button"
														size="sm"
														variant="outline"
														onClick={() => navigate('/platform/agents')}
													>
														<BotMessageSquare className="size-4" />
														{t('platform.nav.agents')}
													</Button>
												</div>
												<div className="grid gap-2 md:grid-cols-2">
													{tenantSummary.members.slice(0, 6).map((member) => (
														<div
															key={`${tenantSummary.tenant}-${member.user_id}`}
															className="rounded-md border bg-background p-3"
														>
															<div className="truncate text-sm font-medium">
																{member.display_name || member.user_id}
															</div>
															<div className="mt-1 truncate font-mono text-xs text-muted-foreground">
																{member.user_id}
															</div>
															<div className="mt-2 flex flex-wrap gap-1">
																<Badge variant="outline">{member.role}</Badge>
																<Badge
																	variant={
																		member.status === 'inactive'
																			? 'outline'
																			: 'secondary'
																	}
																>
																	{member.status === 'inactive'
																		? t('platform.members.inactive')
																		: t('platform.members.active')}
																</Badge>
															</div>
														</div>
													))}
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
										{t('platform.members.empty')}
									</div>
								)}
							</CardContent>
						</Card>

						<Card className="rounded-lg shadow-none">
							<CardHeader>
								<CardTitle className="text-base">
									{t('platform.connectors.tenantPreview')}
								</CardTitle>
							</CardHeader>
							<CardContent className="grid gap-3">
								{tenantWorkspaces.length ? (
									tenantWorkspaces.map(([tenant, workspace]) => (
										<div key={tenant} className="rounded-lg border bg-muted/10 p-3">
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<div className="truncate text-sm font-semibold">
														{tenant}
													</div>
													<div className="mt-1 truncate text-xs text-muted-foreground">
														{workspace.source}
													</div>
												</div>
												<Badge variant="outline">
													{
														enterpriseIdentities.filter(
															(identity) => identity.tenant === tenant,
														).length
													}{' '}
													{t('platform.connectors.identities')}
												</Badge>
											</div>
											<div className="mt-3 grid grid-cols-2 gap-2 text-xs">
												<div className="rounded-md border bg-background p-2">
													{t('platform.connectors.policies')}:{' '}
													{workspace.policies.length}
												</div>
												<div className="rounded-md border bg-background p-2">
													{t('platform.connectors.tickets')}:{' '}
													{workspace.tickets.length}
												</div>
												<div className="rounded-md border bg-background p-2">
													{t('platform.connectors.departments')}:{' '}
													{workspace.departments.length}
												</div>
												<div className="rounded-md border bg-background p-2">
													{t('platform.connectors.tools')}:{' '}
													{countArrayField(workspace, 'tools')}
												</div>
											</div>
										</div>
									))
								) : (
									<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
										{t('platform.connectors.empty')}
									</div>
								)}
							</CardContent>
						</Card>
					</section>
				</div>
			</main>
		);
	}

	if (view === 'memory') {
		return (
			<main className="h-full overflow-y-auto bg-background">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
					<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0">
							<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
								<Brain className="size-4" />
								<span>{t('platform.memoryOps.eyebrow')}</span>
							</div>
							<h1 className="text-2xl font-semibold tracking-normal">
								{t('platform.memoryOps.title')}
							</h1>
							<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
								{t('platform.memoryOps.description')}
							</p>
						</div>
						<div className="flex flex-wrap gap-2 lg:justify-end">
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => navigate('/platform/agents')}
							>
								<Play className="size-4" />
								{t('platform.memoryOps.runAgent')}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => navigate('/platform/runs')}
							>
								<FileClock className="size-4" />
								{t('platform.nav.runs')}
							</Button>
						</div>
					</section>

					<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						{[
							{
								label: t('platform.memoryOps.loadedRuns'),
								value: memoryOperationsRunCount,
								icon: FileClock,
							},
							{
								label: t('platform.memoryOps.memoryHits'),
								value: memoryOperationsHitCount,
								icon: Brain,
							},
							{
								label: t('platform.memoryOps.memoryWrites'),
								value: memoryOperationsSavedCount,
								icon: Database,
							},
							{
								label: t('platform.memoryOps.activeScopes'),
								value: memoryOperationsItems.length,
								icon: ShieldCheck,
							},
						].map((item) => {
							const Icon = item.icon;
							return (
								<Card key={item.label} size="sm" className="rounded-lg shadow-none">
									<CardHeader className="grid-cols-[1fr_auto] items-start gap-3">
										<CardTitle className="text-sm text-muted-foreground">
											{item.label}
										</CardTitle>
										<Icon className="size-4 text-muted-foreground" />
									</CardHeader>
									<CardContent>
										<div className="text-2xl font-semibold tabular-nums">
											{item.value}
										</div>
									</CardContent>
								</Card>
							);
						})}
					</section>

					<section className="grid gap-3">
						{memoryOperationsItems.length === 0 ? (
							<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
								{t('platform.memoryOps.empty')}
							</div>
						) : (
							<div className="grid gap-3 xl:grid-cols-2">
								{memoryOperationsItems.map((item) => (
									<Card key={item.key} className="rounded-lg shadow-none">
										<CardHeader className="grid-cols-[1fr_auto] items-start gap-3">
											<div className="min-w-0">
												<CardTitle className="truncate text-sm">
													{item.agentName}
												</CardTitle>
												<div className="mt-2 flex flex-wrap gap-1">
													<Badge variant="secondary">{item.tenant}</Badge>
													<Badge variant="outline">{item.userId}</Badge>
													<Badge variant="outline">{item.agentId}</Badge>
												</div>
											</div>
											<div className="shrink-0 text-right text-xs text-muted-foreground">
												<div>{t('platform.memoryOps.latestRun')}</div>
												<div className="mt-1 tabular-nums">
													{formatTimestamp(item.latestAt)}
												</div>
											</div>
										</CardHeader>
										<CardContent className="grid gap-3">
											<div className="grid grid-cols-3 gap-2">
												{[
													{
														label: t('platform.memoryOps.runs'),
														value: item.runCount,
													},
													{
														label: t('platform.memoryOps.hits'),
														value: item.memoryHitCount,
													},
													{
														label: t('platform.memoryOps.writes'),
														value: item.memorySavedCount,
													},
												].map((metric) => (
													<div
														key={metric.label}
														className="rounded-md border bg-muted/10 px-3 py-2"
													>
														<div className="truncate text-xs text-muted-foreground">
															{metric.label}
														</div>
														<div className="mt-1 text-lg font-semibold tabular-nums">
															{metric.value}
														</div>
													</div>
												))}
											</div>
											<div className="grid gap-2 text-sm">
												<div className="rounded-md border bg-muted/10 p-3">
													<div className="mb-1 text-xs text-muted-foreground">
														{t('platform.agentRunner.question')}
													</div>
													<p className="line-clamp-2">{item.latestQuestion}</p>
												</div>
												<div className="rounded-md border bg-muted/10 p-3">
													<div className="mb-1 text-xs text-muted-foreground">
														{t('platform.agentRunner.answer')}
													</div>
													<p className="line-clamp-3 text-muted-foreground">
														{item.latestAnswer}
													</p>
												</div>
											</div>
											{item.sources.length ? (
												<div className="flex flex-wrap gap-1">
													{item.sources.map((source) => (
														<Badge key={source} variant="outline">
															{source}
														</Badge>
													))}
												</div>
											) : null}
										</CardContent>
									</Card>
								))}
							</div>
						)}
					</section>
				</div>
			</main>
		);
	}

	if (view === 'settings') {
		return (
			<main className="h-full overflow-y-auto bg-background">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
					<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0">
							<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
								<Server className="size-4" />
								<span>{t('platform.configManagement.title')}</span>
							</div>
							<h1 className="text-2xl font-semibold tracking-normal">
								平台设置
							</h1>
							<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
								查看运行时连接状态，导出或导入平台配置，后续模型、租户策略和运行参数都收敛到这里。
							</p>
						</div>
						<div className="flex flex-wrap gap-2 lg:justify-end">
							<Button
								size="sm"
								variant="outline"
								onClick={() => void refetchPlatform()}
								disabled={platformLoading}
							>
								<RefreshCcw className={cn(platformLoading && 'animate-spin')} />
								{t('platform.actions.refreshStatus')}
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={refetchPlatformConfigExport}
								disabled={platformConfigLoading}
							>
								<Upload />
								{t('platform.configManagement.refresh')}
							</Button>
						</div>
					</section>

					{platformError ? (
						<PlatformNotice>{t('platform.runtime.error')}</PlatformNotice>
					) : null}
					{platformConfigError ? (
						<PlatformNotice className="border-destructive/30 bg-destructive/10 text-destructive">
							{platformConfigError}
						</PlatformNotice>
					) : null}
					{platformConfigImportResult ? (
						<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800">
							{platformConfigImportResult}
						</div>
					) : null}

					<section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
						<Card className="rounded-lg shadow-none">
							<CardHeader>
								<CardTitle className="text-base">
									{t('platform.connection.title')}
								</CardTitle>
							</CardHeader>
							<CardContent className="grid gap-3">
								<div className="grid gap-2 rounded-lg border bg-muted/10 p-3 text-xs">
									<div className="flex items-center justify-between gap-3">
										<span className="text-muted-foreground">
											{t('platform.connection.server')}
										</span>
										<span className="truncate font-mono" title={serverUrl}>
											{serverUrl}
										</span>
									</div>
									<div className="flex items-center justify-between gap-3">
										<span className="text-muted-foreground">
											{t('platform.connection.user')}
										</span>
										<span className="truncate font-mono" title={username}>
											{username}
										</span>
									</div>
									<div className="flex items-center justify-between gap-3">
										<span className="text-muted-foreground">
											{t('platform.connection.health')}
										</span>
										<StateBadge
											state={hasErrors ? 'partial' : 'ready'}
											label={
												hasErrors
													? t('platform.status.toConfigure')
													: t('platform.status.ready')
											}
										/>
									</div>
								</div>
								<div className="grid gap-2">
									{runtimeItems.map((item) => {
										const Icon = item.icon;
										return (
											<div
												key={item.label}
												className="grid grid-cols-[auto_7rem_1fr] items-center gap-3 rounded-lg border bg-muted/10 p-3 text-sm"
											>
												<Icon className="size-4 text-muted-foreground" />
												<span className="text-xs text-muted-foreground">
													{item.label}
												</span>
												<span className="min-w-0 truncate font-mono text-xs">
													{item.value}
												</span>
											</div>
										);
									})}
								</div>
							</CardContent>
						</Card>

						<Card className="rounded-lg shadow-none">
							<CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
								<div>
									<CardTitle className="text-base">
										{t('platform.configManagement.title')}
									</CardTitle>
									<p className="mt-1 text-sm text-muted-foreground">
										{t('platform.configManagement.description')}
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										size="sm"
										variant="outline"
										onClick={handleCopyPlatformConfig}
										disabled={!platformConfigExport}
									>
										<Copy />
										{t('platform.configManagement.copyExport')}
									</Button>
								</div>
							</CardHeader>
							<CardContent className="grid gap-4">
								<PlatformNotice>
									{t('platform.configManagement.redactedNotice')}
								</PlatformNotice>
								<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
									{platformConfigLoading
										? Array.from({ length: 6 }).map((_, index) => (
												<Skeleton key={index} className="h-20 rounded-lg" />
											))
										: platformConfigExport
											? [
													{
														label: t('platform.configManagement.members'),
														value: platformConfigExport.counts.members,
													},
													{
														label: t('platform.configManagement.connectors'),
														value:
															platformConfigExport.counts.connector_configs,
													},
													{
														label: t('platform.configManagement.agents'),
														value: platformConfigExport.counts.agents,
													},
													{
														label: t('platform.configManagement.workflows'),
														value:
															platformConfigExport.counts.workflow_templates,
													},
													{
														label: t(
															'platform.configManagement.toolPolicyTenants',
														),
														value:
															platformConfigExport.counts
																.tool_policy_tenants,
													},
													{
														label: t(
															'platform.configManagement.toolPolicyUsers',
														),
														value:
															platformConfigExport.counts
																.tool_policy_users,
													},
												].map((item) => (
													<div
														key={item.label}
														className="rounded-lg border bg-muted/10 p-3"
													>
														<div className="truncate text-xs text-muted-foreground">
															{item.label}
														</div>
														<div className="mt-1 text-xl font-semibold tabular-nums">
															{item.value}
														</div>
													</div>
												))
											: (
													<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
														{t('platform.configManagement.empty')}
													</div>
												)}
								</div>
								<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
									{platformConfigExport ? (
										<>
											<span>
												{t('platform.configManagement.schemaVersion')}:{' '}
												{platformConfigExport.schema_version}
											</span>
											<span>
												{t('platform.configManagement.lastExported')}:{' '}
												{formatTimestamp(platformConfigExport.exported_at)}
											</span>
										</>
									) : null}
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<Select
										value={platformConfigImportMode}
										onValueChange={(value) =>
											setPlatformConfigImportMode(value as 'merge' | 'replace')
										}
									>
										<SelectTrigger className="w-[8rem]">
											<SelectValue
												placeholder={t(
													'platform.configManagement.importMode',
												)}
											/>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="merge">
												{t('platform.configManagement.merge')}
											</SelectItem>
											<SelectItem value="replace">
												{t('platform.configManagement.replace')}
											</SelectItem>
										</SelectContent>
									</Select>
									<Button
										size="sm"
										onClick={handleImportPlatformConfig}
										disabled={
											importingPlatformConfig ||
											!platformConfigImportText.trim()
										}
									>
										<Upload />
										{t('platform.configManagement.import')}
									</Button>
								</div>
								<Textarea
									className="min-h-[18rem] font-mono text-xs"
									value={platformConfigImportText}
									onChange={(event) =>
										setPlatformConfigImportText(event.target.value)
									}
									placeholder={t('platform.configManagement.empty')}
								/>
							</CardContent>
						</Card>
					</section>
				</div>
			</main>
		);
	}

	if (view === 'tools') {
		return (
			<main className="h-full overflow-y-auto bg-background">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
					<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0">
							<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
								<Boxes className="size-4" />
								<span>{t('platform.toolCatalog.title')}</span>
							</div>
							<h1 className="text-2xl font-semibold tracking-normal">
								{t('platform.toolCatalog.title')}
							</h1>
							<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
								{t('platform.toolCatalog.description')}
							</p>
						</div>
						<div className="grid min-w-0 gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:min-w-80">
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t('platform.connection.server')}
								</span>
								<span className="truncate font-mono" title={serverUrl}>
									{serverUrl}
								</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t('platform.connection.user')}
								</span>
								<span className="truncate font-mono" title={username}>
									{username}
								</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t('platform.connection.health')}
								</span>
								<StateBadge
									state={hasErrors ? 'partial' : 'ready'}
									label={
										hasErrors
											? t('platform.connection.partial')
											: t('platform.connection.connected')
									}
								/>
							</div>
						</div>
					</section>

					<section ref={configManagementRef} className="flex flex-col gap-3">
						<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<h2 className="text-base font-semibold">
									{t('platform.toolCatalog.title')}
								</h2>
								<p className="text-sm text-muted-foreground">
									{t('platform.toolCatalog.description')}
								</p>
							</div>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => void refetchToolCatalog()}
								disabled={toolCatalogLoading}
							>
								<RefreshCcw className={cn(toolCatalogLoading && 'animate-spin')} />
								{t('platform.audit.refresh')}
							</Button>
						</div>

						{toolCatalogLoading ? (
							<div className="grid gap-3 lg:grid-cols-3">
								<Skeleton className="h-48 w-full" />
								<Skeleton className="h-48 w-full" />
								<Skeleton className="h-48 w-full" />
							</div>
						) : toolCatalogError ? (
							<PlatformNotice>{toolCatalogError}</PlatformNotice>
						) : availableToolItems.length === 0 ? (
							<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
								{t('platform.toolCatalog.empty')}
							</div>
						) : (
							<div className="grid gap-3 lg:grid-cols-3">
								{availableToolItems.map((tool) => {
									const statItems = [
										{
											label: t('platform.toolCatalog.calls'),
											value: String(tool.stats.calls ?? 0),
										},
										{
											label: t('platform.toolCatalog.successes'),
											value: String(tool.stats.successes ?? 0),
										},
										{
											label: t('platform.toolCatalog.failures'),
											value: String(tool.stats.failures ?? 0),
										},
										{
											label: t('platform.toolCatalog.avgDuration'),
											value:
												tool.stats.avg_duration_ms === null ||
												tool.stats.avg_duration_ms === undefined
													? '-'
													: `${Math.round(tool.stats.avg_duration_ms)} ms`,
										},
										{
											label: t('platform.toolCatalog.lastCalled'),
											value: tool.stats.last_called_at
												? formatTimestamp(tool.stats.last_called_at)
												: t('platform.toolCatalog.neverCalled'),
										},
									];

									return (
										<Card
											key={tool.name}
											size="sm"
											className="rounded-lg shadow-none"
										>
											<CardHeader className="grid-cols-[auto_1fr_auto] items-start gap-3">
												<div className="flex size-8 items-center justify-center rounded-lg border bg-background">
													<Boxes className="size-4 text-muted-foreground" />
												</div>
												<div className="min-w-0">
													<CardTitle className="truncate font-mono text-sm">
														{tool.name}
													</CardTitle>
													<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
														{tool.description}
													</p>
												</div>
												<Badge
													variant={tool.allowed ? 'outline' : 'destructive'}
													className={cn(
														tool.allowed &&
															'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
													)}
												>
													{tool.allowed ? (
														<CheckCircle2 className="size-3" />
													) : (
														<XCircle className="size-3" />
													)}
													{tool.allowed
														? t('platform.policy.allowed')
														: t('platform.policy.denied')}
												</Badge>
											</CardHeader>
											<CardContent className="grid gap-4 text-xs">
												{tool.reason ? (
													<p className="break-words text-muted-foreground">
														{tool.reason}
													</p>
												) : null}
												<div className="grid gap-2">
													<div className="grid grid-cols-[6rem_1fr] gap-2">
														<span className="text-muted-foreground">
															{t('platform.toolCatalog.inputKey')}
														</span>
														<span className="min-w-0 truncate font-mono">
															{tool.input_key}
														</span>
													</div>
													<div className="grid grid-cols-[6rem_1fr] gap-2">
														<span className="text-muted-foreground">
															{t('platform.toolCatalog.defaultInput')}
														</span>
														<span className="min-w-0 truncate font-mono">
															{tool.default_input || '-'}
														</span>
													</div>
													<div className="grid grid-cols-[6rem_1fr] gap-2">
														<span className="text-muted-foreground">
															{t('platform.toolCatalog.configuredBy')}
														</span>
														{tool.configured_by_agents.length > 0 ? (
															<div className="flex min-w-0 flex-wrap gap-1">
																{tool.configured_by_agents.map(
																	(agentId) => {
																		const agent =
																			publishedPlatformAgents.find(
																				(item) =>
																					item.id === agentId,
																			);

																		return (
																			<Badge
																				key={agentId}
																				variant="outline"
																				className="max-w-full truncate font-normal"
																			>
																				{agent?.name ?? agentId}
																			</Badge>
																		);
																	},
																)}
															</div>
														) : (
															<span className="min-w-0 text-muted-foreground">
																{t(
																	'platform.toolCatalog.notConfigured',
																)}
															</span>
														)}
													</div>
												</div>
												<div className="grid gap-2 sm:grid-cols-2">
													{statItems.map((item) => (
														<div
															key={item.label}
															className="rounded-lg border bg-background p-2"
														>
															<div className="text-muted-foreground">
																{item.label}
															</div>
															<div
																className="mt-1 truncate font-mono font-medium"
																title={item.value}
															>
																{item.value}
															</div>
														</div>
													))}
												</div>
											</CardContent>
										</Card>
									);
								})}
							</div>
						)}
					</section>

					<section
						ref={toolRunnerRef}
						className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]"
					>
						<div className="flex flex-col gap-3">
							<div className="flex items-start gap-2">
								<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/20">
									<Code2 className="size-4 text-muted-foreground" />
								</div>
								<div className="min-w-0">
									<h2 className="text-base font-semibold">
										{t('platform.toolRunner.title')}
									</h2>
									<p className="text-sm text-muted-foreground">
										{t('platform.toolRunner.description')}
									</p>
								</div>
							</div>

							<div className="grid gap-4 rounded-lg border bg-muted/10 p-4">
								<div className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.toolRunner.selectTool')}
									</label>
									<Select
										value={selectedToolName}
										onValueChange={(value) => {
											setSelectedToolName(value);
											setToolRunError(null);
										}}
										disabled={toolCatalogLoading || availableToolItems.length === 0}
									>
										<SelectTrigger className="w-full font-mono">
											<SelectValue
												placeholder={t('platform.toolRunner.selectTool')}
											/>
										</SelectTrigger>
										<SelectContent>
											{availableToolItems.map((tool) => (
												<SelectItem key={tool.name} value={tool.name}>
													{tool.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{selectedToolConfig
											? t(`platform.toolRunner.${selectedToolConfig.labelKey}`)
											: (selectedToolCatalogItem?.input_key ??
												t('platform.toolRunner.input'))}
									</label>
									<Input
										value={selectedToolInputValue}
										onChange={(event) =>
											setToolInputs((current) => ({
												...current,
												[selectedToolName]: event.target.value,
											}))
										}
										disabled={!selectedToolInputKey}
									/>
								</div>

								<div className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.toolRunner.approvalId')}
									</label>
									<Input
										value={toolApprovalId}
										onChange={(event) => setToolApprovalId(event.target.value)}
										placeholder={t('platform.toolRunner.approvalIdPlaceholder')}
										className="font-mono"
									/>
								</div>

								<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
									<div className="min-w-0">
										{selectedToolCatalogItem || selectedToolDecision ? (
											<Badge
												variant={
													selectedToolAllowed ? 'outline' : 'destructive'
												}
												className={cn(
													selectedToolAllowed &&
														'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
												)}
											>
												{selectedToolAllowed
													? t('platform.policy.allowed')
													: t('platform.policy.denied')}
											</Badge>
										) : null}
										{selectedToolReason ? (
											<p className="mt-2 text-xs text-muted-foreground">
												{selectedToolReason}
											</p>
										) : null}
										{(selectedToolCatalogItem || selectedToolDecision) &&
										!selectedToolAllowed ? (
											<p className="mt-2 text-xs text-destructive">
												{t('platform.toolRunner.notAllowed')}
											</p>
										) : null}
									</div>
									<div className="flex flex-wrap justify-end gap-2">
										<Button
											variant="outline"
											onClick={() => void handleCreateRunApproval('tool_run')}
											disabled={
												creatingRunApproval === 'tool_run' ||
												Boolean(platformError) ||
												!selectedToolInputKey ||
												!selectedToolAllowed
											}
										>
											<ListChecks
												className={cn(
													creatingRunApproval === 'tool_run' &&
														'animate-pulse',
												)}
											/>
											{creatingRunApproval === 'tool_run'
												? t('platform.toolRunner.requestingApproval')
												: t('platform.toolRunner.requestApproval')}
										</Button>
										<Button
											onClick={handleRunEnterpriseTool}
											disabled={
												runningTool ||
												Boolean(platformError) ||
												!selectedToolInputKey ||
												!selectedToolAllowed
											}
										>
											<Play className={cn(runningTool && 'animate-pulse')} />
											{runningTool
												? t('platform.toolRunner.running')
												: t('platform.toolRunner.run')}
										</Button>
									</div>
								</div>

								{toolRunError ? (
									<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
										{t('platform.toolRunner.error')} {toolRunError}
									</div>
								) : null}
							</div>
						</div>

						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-2">
								<Code2 className="size-4 text-muted-foreground" />
								<h3 className="text-sm font-semibold">
									{t('platform.toolRunner.result')}
								</h3>
							</div>
							{toolRunResult ? (
								<pre className="min-h-72 overflow-auto rounded-lg border bg-muted/20 p-4 text-xs leading-5">
									{JSON.stringify(toolRunResult, null, 2)}
								</pre>
							) : (
								<div className="flex min-h-72 items-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
									{t('platform.toolRunner.emptyResult')}
								</div>
							)}
						</div>
					</section>
				</div>
			</main>
		);
	}

	if (view === 'approvals') {
		return (
			<main className="h-full overflow-y-auto bg-background">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
					<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0">
							<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
								<ShieldCheck className="size-4" />
								<span>{t('platform.approvals.title')}</span>
							</div>
							<h1 className="text-2xl font-semibold tracking-normal">
								{t('platform.approvals.title')}
							</h1>
							<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
								{t('platform.approvals.description')}
							</p>
						</div>
						<div className="grid min-w-0 gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:min-w-80">
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t('platform.connection.server')}
								</span>
								<span className="truncate font-mono" title={serverUrl}>
									{serverUrl}
								</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t('platform.connection.user')}
								</span>
								<span className="truncate font-mono" title={username}>
									{username}
								</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t('platform.connection.health')}
								</span>
								<StateBadge
									state={hasErrors ? 'partial' : 'ready'}
									label={
										hasErrors
											? t('platform.connection.partial')
											: t('platform.connection.connected')
									}
								/>
							</div>
						</div>
					</section>

					<section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
						<div className="flex flex-col gap-3">
							<div className="flex items-start gap-2">
								<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/20">
									<ListChecks className="size-4 text-muted-foreground" />
								</div>
								<div className="min-w-0">
									<h2 className="text-base font-semibold">
										{t('platform.approvals.createTitle')}
									</h2>
									<p className="text-sm text-muted-foreground">
										{t('platform.approvals.createDescription')}
									</p>
								</div>
							</div>

							<div className="grid gap-4 rounded-lg border bg-muted/10 p-4">
								<div className="grid gap-3 md:grid-cols-2">
									<div className="grid gap-2">
										<label className="text-xs font-medium text-muted-foreground">
											{t('platform.approvals.requestType')}
										</label>
										<Select
											value={approvalForm.request_type}
											onValueChange={(value) =>
												setApprovalForm((current) => ({
													...current,
													request_type: value as EnterpriseApprovalRequestType,
												}))
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="tool_run">
													{t('platform.approvals.toolRun')}
												</SelectItem>
												<SelectItem value="workflow_run">
													{t('platform.approvals.workflowRun')}
												</SelectItem>
												<SelectItem value="agent_action">
													{t('platform.approvals.agentAction')}
												</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{approvalForm.request_type === 'workflow_run' ? (
										<div className="grid gap-2">
											<label className="text-xs font-medium text-muted-foreground">
												{t('platform.approvals.target')}
											</label>
											<Select
												value={approvalForm.workflow_type}
												onValueChange={(value) =>
													setApprovalForm((current) => ({
														...current,
														workflow_type: value,
													}))
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{workflowOptions.map((workflow) => (
														<SelectItem
															key={workflow.value}
															value={workflow.value}
														>
															{workflow.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									) : approvalForm.request_type === 'tool_run' ? (
										<div className="grid gap-2">
											<label className="text-xs font-medium text-muted-foreground">
												{t('platform.approvals.target')}
											</label>
											<Select
												value={approvalForm.tool_name}
												onValueChange={(value) =>
													setApprovalForm((current) => ({
														...current,
														tool_name: value,
														input_key:
															enterpriseToolInputConfig[value]?.inputKey ||
															current.input_key,
														input_value:
															enterpriseToolInputConfig[value]?.defaultValue ||
															current.input_value,
													}))
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{availableToolItems.map((tool) => (
														<SelectItem key={tool.name} value={tool.name}>
															{tool.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									) : (
										<div className="grid gap-2">
											<label className="text-xs font-medium text-muted-foreground">
												{t('platform.approvals.agent')}
											</label>
											<Input
												value={approvalForm.agent_id}
												placeholder={selectedRunAgentId || 'platform-console'}
												onChange={(event) =>
													setApprovalForm((current) => ({
														...current,
														agent_id: event.target.value,
													}))
												}
											/>
										</div>
									)}
								</div>

								<div className="grid gap-3 md:grid-cols-2">
									<div className="grid gap-2">
										<label className="text-xs font-medium text-muted-foreground">
											{t('platform.approvals.inputKey')}
										</label>
										<Input
											value={approvalForm.input_key}
											onChange={(event) =>
												setApprovalForm((current) => ({
													...current,
													input_key: event.target.value,
												}))
											}
										/>
									</div>
									<div className="grid gap-2">
										<label className="text-xs font-medium text-muted-foreground">
											{t('platform.approvals.inputValue')}
										</label>
										<Input
											value={approvalForm.input_value}
											onChange={(event) =>
												setApprovalForm((current) => ({
													...current,
													input_value: event.target.value,
												}))
											}
										/>
									</div>
								</div>

								<div className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.approvals.reason')}
									</label>
									<Textarea
										value={approvalForm.reason}
										onChange={(event) =>
											setApprovalForm((current) => ({
												...current,
												reason: event.target.value,
											}))
										}
									/>
								</div>

								<div className="grid gap-3 md:grid-cols-2">
									<div className="grid gap-2">
										<label className="text-xs font-medium text-muted-foreground">
											{t('platform.approvals.user')}
										</label>
										<Input
											value={approvalForm.user_id}
											placeholder={selectedIdentityUserId || username}
											onChange={(event) =>
												setApprovalForm((current) => ({
													...current,
													user_id: event.target.value,
												}))
											}
										/>
									</div>
									<div className="grid gap-2">
										<label className="text-xs font-medium text-muted-foreground">
											{t('platform.approvals.agent')}
										</label>
										<Input
											value={approvalForm.agent_id}
											placeholder={selectedRunAgentId || 'platform-console'}
											onChange={(event) =>
												setApprovalForm((current) => ({
													...current,
													agent_id: event.target.value,
												}))
											}
										/>
									</div>
								</div>

								<div className="flex justify-end">
									<Button onClick={handleCreateApproval} disabled={creatingApproval}>
										<ListChecks className={cn(creatingApproval && 'animate-pulse')} />
										{creatingApproval
											? t('platform.approvals.creating')
											: t('platform.approvals.create')}
									</Button>
								</div>
							</div>
						</div>

						<div className="flex flex-col gap-3">
							<div className="flex items-start justify-between gap-3">
								<div>
									<h3 className="text-sm font-semibold">
										{t('platform.approvals.listTitle')}
									</h3>
									<p className="text-xs text-muted-foreground">
										{t('platform.approvals.listDescription')}
									</p>
								</div>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => void refetchApprovals()}
									disabled={approvalLoading}
								>
									<RefreshCcw className={cn(approvalLoading && 'animate-spin')} />
									{t('platform.approvals.refresh')}
								</Button>
							</div>

							<div className="grid gap-2 sm:grid-cols-4">
								<div className="rounded-lg border bg-muted/10 p-3">
									<div className="text-xs text-muted-foreground">
										{t('platform.approvals.total')}
									</div>
									<div className="mt-1 text-lg font-semibold">
										{approvalSummary.total}
									</div>
								</div>
								<div className="rounded-lg border bg-amber-500/10 p-3">
									<div className="text-xs text-amber-800">
										{t('platform.approvals.pending')}
									</div>
									<div className="mt-1 text-lg font-semibold text-amber-900">
										{approvalSummary.pending}
									</div>
								</div>
								<div className="rounded-lg border bg-emerald-500/10 p-3">
									<div className="text-xs text-emerald-800">
										{t('platform.approvals.approved')}
									</div>
									<div className="mt-1 text-lg font-semibold text-emerald-900">
										{approvalSummary.approved}
									</div>
								</div>
								<div className="rounded-lg border bg-red-500/10 p-3">
									<div className="text-xs text-red-800">
										{t('platform.approvals.rejected')}
									</div>
									<div className="mt-1 text-lg font-semibold text-red-900">
										{approvalSummary.rejected}
									</div>
								</div>
							</div>

							<div className="grid gap-3 rounded-lg border bg-muted/10 p-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
								<div className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.approvals.filterStatus')}
									</label>
									<Select
										value={approvalFilters.status || ALL_APPROVAL_STATUSES_VALUE}
										onValueChange={(value) =>
											setApprovalFilters((current) => ({
												...current,
												status:
													value === ALL_APPROVAL_STATUSES_VALUE ? '' : value,
											}))
										}
									>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={ALL_APPROVAL_STATUSES_VALUE}>
												{t('platform.approvals.allStatuses')}
											</SelectItem>
											<SelectItem value="pending">
												{t('platform.approvals.pending')}
											</SelectItem>
											<SelectItem value="approved">
												{t('platform.approvals.approved')}
											</SelectItem>
											<SelectItem value="rejected">
												{t('platform.approvals.rejected')}
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.approvals.filterTenant')}
									</label>
									<Input
										value={approvalFilters.tenant}
										onChange={(event) =>
											setApprovalFilters((current) => ({
												...current,
												tenant: event.target.value,
											}))
										}
										placeholder={platformStatus?.current_user.tenant || 'default'}
									/>
								</div>
								<div className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.approvals.filterUser')}
									</label>
									<Input
										value={approvalFilters.user_id}
										onChange={(event) =>
											setApprovalFilters((current) => ({
												...current,
												user_id: event.target.value,
											}))
										}
										placeholder={platformStatus?.current_user.user_id || username}
									/>
								</div>
								<div className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.approvals.filterAgent')}
									</label>
									<Select
										value={approvalFilters.agent_id || ALL_AGENTS_VALUE}
										onValueChange={(value) =>
											setApprovalFilters((current) => ({
												...current,
												agent_id: value === ALL_AGENTS_VALUE ? '' : value,
											}))
										}
									>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={ALL_AGENTS_VALUE}>
												{t('platform.approvals.allAgents')}
											</SelectItem>
											{activePlatformAgents.map((agent) => (
												<SelectItem key={agent.id} value={agent.id}>
													{agent.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.approvals.filterLimit')}
									</label>
									<Input
										type="number"
										min={1}
										max={200}
										value={approvalFilters.limit}
										onChange={(event) =>
											setApprovalFilters((current) => ({
												...current,
												limit: event.target.value,
											}))
										}
									/>
								</div>
								<Button
									type="button"
									size="sm"
									className="self-end"
									onClick={() => void refetchApprovals()}
									disabled={approvalLoading}
								>
									<ListChecks />
									{t('platform.approvals.applyFilters')}
								</Button>
							</div>

							{approvalError ? <PlatformNotice>{approvalError}</PlatformNotice> : null}

							{approvalLoading ? (
								<div className="grid gap-2">
									{[0, 1, 2].map((item) => (
										<Skeleton key={item} className="h-32 rounded-lg" />
									))}
								</div>
							) : approvalRequests.length === 0 ? (
								<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
									{t('platform.approvals.empty')}
								</div>
							) : (
								<div className="grid gap-2">
									{approvalRequests.map((approval) => {
										const target =
											approval.tool_name ||
											approval.workflow_type ||
											approval.agent_id ||
											approval.request_type;
										const isDeciding = decidingApprovalId === approval.approval_id;
										const isContinuing =
											continuingApprovalId === approval.approval_id;
										const canApproveAndRun =
											approval.status === 'pending' &&
											((approval.request_type === 'tool_run' &&
												Boolean(approval.tool_name)) ||
												(approval.request_type === 'workflow_run' &&
													Boolean(approval.workflow_type)));
										const canUseApproval =
											approval.status === 'approved' &&
											((approval.request_type === 'tool_run' &&
												Boolean(approval.tool_name)) ||
												(approval.request_type === 'workflow_run' &&
													Boolean(approval.workflow_type)));

										return (
											<div
												key={approval.approval_id}
												className="rounded-lg border bg-background p-3"
											>
												<div className="flex flex-wrap items-start justify-between gap-3">
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2">
															<Badge
																variant="outline"
																className={cn(
																	approvalStatusClassName(approval.status),
																)}
															>
																{t(`platform.approvals.${approval.status}`)}
															</Badge>
															<Badge variant="secondary">
																{t(
																	`platform.approvals.${approval.request_type === 'tool_run' ? 'toolRun' : approval.request_type === 'workflow_run' ? 'workflowRun' : 'agentAction'}`,
																)}
															</Badge>
															<span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
																{target}
															</span>
														</div>
														<p className="mt-2 text-sm">
															{approval.reason || '-'}
														</p>
													</div>
													{approval.status === 'pending' ? (
														<div className="flex shrink-0 gap-2">
															{canApproveAndRun ? (
																<Button
																	type="button"
																	size="sm"
																	onClick={() =>
																		void handleApproveAndRun(approval)
																	}
																	disabled={isDeciding || isContinuing}
																>
																	<Play
																		className={cn(
																			isContinuing && 'animate-pulse',
																		)}
																	/>
																	{isContinuing
																		? t(
																				'platform.approvals.approvingAndRunning',
																			)
																		: t('platform.approvals.approveAndRun')}
																</Button>
															) : null}
															<Button
																type="button"
																size="sm"
																variant="outline"
																onClick={() =>
																	void handleDecideApproval(
																		approval.approval_id,
																		'approved',
																	)
																}
																disabled={isDeciding || isContinuing}
															>
																<CheckCircle2
																	className={cn(
																		isDeciding && 'animate-pulse',
																	)}
																/>
																{isDeciding
																	? t('platform.approvals.approving')
																	: t('platform.approvals.approve')}
															</Button>
															<Button
																type="button"
																size="sm"
																variant="outline"
																onClick={() =>
																	void handleDecideApproval(
																		approval.approval_id,
																		'rejected',
																	)
																}
																disabled={isDeciding || isContinuing}
															>
																<XCircle
																	className={cn(
																		isDeciding && 'animate-pulse',
																	)}
																/>
																{isDeciding
																	? t('platform.approvals.rejecting')
																	: t('platform.approvals.reject')}
															</Button>
														</div>
													) : canUseApproval ? (
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() => handleUseApproval(approval)}
														>
															<ArrowRight />
															{t('platform.approvals.useForRun')}
														</Button>
													) : null}
												</div>

												<div className="mt-3 grid gap-1 text-xs text-muted-foreground">
													<div className="flex flex-wrap gap-1">
														<span>{t('platform.approvals.approvalId')}:</span>
														<span className="break-all font-mono">
															{approval.approval_id}
														</span>
													</div>
													<div className="flex flex-wrap gap-1">
														<span>{t('platform.audit.inputs')}:</span>
														<span>{summarizeAuditObject(approval.inputs)}</span>
													</div>
													<div className="flex flex-wrap gap-1">
														<span>{t('platform.approvals.requestedBy')}:</span>
														<span className="font-mono">
															{approval.requested_by} / {approval.user_id}
														</span>
													</div>
													<div className="flex flex-wrap gap-1">
														<span>{t('platform.approvals.requestedAt')}:</span>
														<span>{formatTimestamp(approval.requested_at)}</span>
													</div>
													{approval.decided_at ? (
														<div className="flex flex-wrap gap-1">
															<span>{t('platform.approvals.decidedAt')}:</span>
															<span>{formatTimestamp(approval.decided_at)}</span>
														</div>
													) : null}
													{approval.decided_by ? (
														<div className="flex flex-wrap gap-1">
															<span>{t('platform.approvals.decidedBy')}:</span>
															<span className="font-mono">
																{approval.decided_by}
															</span>
														</div>
													) : null}
													{approval.decision_note ? (
														<div className="flex flex-wrap gap-1">
															<span>{t('platform.approvals.decisionNote')}:</span>
															<span>{approval.decision_note}</span>
														</div>
													) : null}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</section>
				</div>
			</main>
		);
	}

	if (view === 'runs') {
		return (
			<main className="h-full overflow-y-auto bg-background">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
					<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0">
							<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
								<Activity className="size-4" />
								<span>{t('platform.monitoring.eyebrow')}</span>
							</div>
							<h1 className="text-2xl font-semibold tracking-normal">
								{t('platform.monitoring.title')}
							</h1>
							<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
								{t('platform.monitoring.description')}
							</p>
						</div>
						<div className="flex flex-wrap gap-2 lg:justify-end">
							<StateBadge
								state={monitoringHealthState}
								label={t(
									`platform.agentManagement.wizard.states.${monitoringHealthState}`,
								)}
							/>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() =>
									void Promise.all([
										refetchPlatform(),
										refetchAgentRuns(),
										refetchWorkflowRuns(),
										refetchAuditEvents(),
										refetchApprovals(),
										refetchGovernance(),
									])
								}
								disabled={monitoringLoading}
							>
								<RefreshCcw
									className={cn('size-4', monitoringLoading && 'animate-spin')}
								/>
								{t('platform.monitoring.refresh')}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => navigate('/platform/agents')}
							>
								<BotMessageSquare className="size-4" />
								{t('platform.monitoring.runAgent')}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => navigate('/platform/workflows')}
							>
								<Workflow className="size-4" />
								{t('platform.monitoring.runWorkflow')}
							</Button>
							<Button type="button" size="sm" onClick={() => navigate('/platform/approvals')}>
								<ShieldCheck className="size-4" />
								{t('platform.monitoring.openGovernance')}
							</Button>
						</div>
					</section>

					<section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
						{monitoringStats.map((stat) => {
							const StatIcon = stat.icon;
							return (
								<div key={stat.label} className="grid gap-3 rounded-lg border bg-muted/10 p-3">
									<div className="flex items-center justify-between gap-3">
										<div className="text-sm font-medium">{stat.label}</div>
										<div className="grid size-8 place-items-center rounded-md border bg-background">
											<StatIcon className="size-4 text-muted-foreground" />
										</div>
									</div>
									<div className="text-2xl font-semibold tracking-normal">{stat.value}</div>
									<p className="text-xs leading-5 text-muted-foreground">{stat.helper}</p>
								</div>
							);
						})}
					</section>

					<section className="grid gap-3 lg:grid-cols-3">
						<div className="grid content-start gap-3 rounded-lg border bg-muted/10 p-3">
							<div>
								<h2 className="text-sm font-medium">
									{t('platform.monitoring.recentAgentRuns')}
								</h2>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{t('platform.monitoring.recentAgentRunsHelper')}
								</p>
							</div>
							{recentAgentTurns.length === 0 ? (
								<div className="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
									{t('platform.monitoring.emptyAgentRuns')}
								</div>
							) : (
								<div className="grid gap-2">
									{recentAgentTurns.map((turn) => (
										<button
											key={turn.id}
											type="button"
											onClick={() => {
												setSelectedRunAgentId(turn.agentId);
												setAgentRunResult(turn.response);
												navigate('/platform/agents');
											}}
											className="rounded-md border bg-background p-3 text-left text-xs transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											<div className="flex items-center justify-between gap-2">
												<span className="truncate font-medium">{turn.question}</span>
												<span className="shrink-0 text-muted-foreground">
													{formatTimestamp(turn.createdAt)}
												</span>
											</div>
											<p className="mt-1 line-clamp-2 leading-5 text-muted-foreground">
												{turn.answer}
											</p>
										</button>
									))}
								</div>
							)}
						</div>

						<div className="grid content-start gap-3 rounded-lg border bg-muted/10 p-3">
							<div>
								<h2 className="text-sm font-medium">
									{t('platform.monitoring.recentWorkflowRuns')}
								</h2>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{t('platform.monitoring.recentWorkflowRunsHelper')}
								</p>
							</div>
							{recentWorkflowRuns.length === 0 ? (
								<div className="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
									{t('platform.monitoring.emptyWorkflowRuns')}
								</div>
							) : (
								<div className="grid gap-2">
									{recentWorkflowRuns.slice(0, 6).map((run) => (
										<button
											key={run.run_id}
											type="button"
											onClick={() => navigate('/platform/workflows')}
											className="rounded-md border bg-background p-3 text-left text-xs transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											<div className="flex items-center justify-between gap-2">
												<span className="truncate font-medium">{run.workflow_name}</span>
												<Badge
													variant="outline"
													className={workflowStatusClassName(run.status)}
												>
													{t(
														`platform.workflowRunner.${workflowStatusLabelKey(run.status)}`,
													)}
												</Badge>
											</div>
											<p className="mt-1 line-clamp-2 leading-5 text-muted-foreground">
												{run.summary || formatTimestamp(run.finished_at || run.started_at)}
											</p>
										</button>
									))}
								</div>
							)}
						</div>

						<div className="grid content-start gap-3 rounded-lg border bg-muted/10 p-3">
							<div>
								<h2 className="text-sm font-medium">
									{t('platform.monitoring.recentAudit')}
								</h2>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{t('platform.monitoring.recentAuditHelper')}
								</p>
							</div>
							{recentAuditEvents.length === 0 ? (
								<div className="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
									{t('platform.monitoring.emptyAudit')}
								</div>
							) : (
								<div className="grid gap-2">
									{recentAuditEvents.slice(0, 6).map((event, index) => (
										<div
											key={event.event_id ?? `${event.timestamp}-${index}`}
											className="rounded-md border bg-background p-3 text-xs"
										>
											<div className="flex items-center justify-between gap-2">
												<span className="truncate font-medium">
													{event.tool_name ||
														event.event_type ||
														t('platform.monitoring.auditEvent')}
												</span>
												<Badge
													variant="outline"
													className={
														event.success === false
															? ''
															: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
													}
												>
													{event.success === false
														? t('platform.monitoring.failure')
														: t('platform.monitoring.success')}
												</Badge>
											</div>
											<p className="mt-1 truncate text-muted-foreground">
												{event.user_id || '-'} · {event.tenant || '-'} ·{' '}
												{formatTimestamp(event.timestamp)}
											</p>
										</div>
									))}
								</div>
							)}
						</div>
					</section>

					<section className="flex flex-col gap-3">
						<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<h2 className="text-base font-semibold">{t('platform.audit.title')}</h2>
								<p className="text-sm text-muted-foreground">
									{t('platform.audit.description')}
								</p>
							</div>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => void refetchAuditEvents()}
								disabled={auditLoading}
							>
								<RefreshCcw className={cn(auditLoading && 'animate-spin')} />
								{t('platform.audit.refresh')}
							</Button>
						</div>

						<div className="grid gap-3 rounded-lg border bg-muted/10 p-3 md:grid-cols-2 xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.audit.filterTenant')}
								</label>
								<Input
									value={auditFilters.tenant}
									onChange={(event) =>
										setAuditFilters((current) => ({
											...current,
											tenant: event.target.value,
										}))
									}
									placeholder={platformStatus?.current_user.tenant || 'default'}
								/>
							</div>
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.audit.filterUser')}
								</label>
								<Input
									value={auditFilters.user_id}
									onChange={(event) =>
										setAuditFilters((current) => ({
											...current,
											user_id: event.target.value,
										}))
									}
									placeholder={platformStatus?.current_user.user_id || username}
								/>
							</div>
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.audit.filterAgent')}
								</label>
								<Select
									value={auditFilters.agent_id || ALL_AGENTS_VALUE}
									onValueChange={(value) =>
										setAuditFilters((current) => ({
											...current,
											agent_id: value === ALL_AGENTS_VALUE ? '' : value,
										}))
									}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_AGENTS_VALUE}>
											{t('platform.audit.allAgents')}
										</SelectItem>
										{activePlatformAgents.map((agent) => (
											<SelectItem key={agent.id} value={agent.id}>
												{agent.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.audit.filterTool')}
								</label>
								<Select
									value={auditFilters.tool_name || ALL_TOOLS_VALUE}
									onValueChange={(value) =>
										setAuditFilters((current) => ({
											...current,
											tool_name: value === ALL_TOOLS_VALUE ? '' : value,
										}))
									}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_TOOLS_VALUE}>
											{t('platform.audit.allTools')}
										</SelectItem>
										{availableToolItems.map((tool) => (
											<SelectItem key={tool.name} value={tool.name}>
												{tool.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.audit.filterStatus')}
								</label>
								<Select
									value={auditFilters.success || ALL_AUDIT_STATUSES_VALUE}
									onValueChange={(value) =>
										setAuditFilters((current) => ({
											...current,
											success: value === ALL_AUDIT_STATUSES_VALUE ? '' : value,
										}))
									}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_AUDIT_STATUSES_VALUE}>
											{t('platform.audit.allStatuses')}
										</SelectItem>
										<SelectItem value="true">{t('platform.audit.success')}</SelectItem>
										<SelectItem value="false">{t('platform.audit.failure')}</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.audit.filterLimit')}
								</label>
								<Input
									type="number"
									min={1}
									max={200}
									value={auditFilters.limit}
									onChange={(event) =>
										setAuditFilters((current) => ({
											...current,
											limit: event.target.value,
										}))
									}
								/>
							</div>
							<Button
								type="button"
								size="sm"
								className="self-end"
								onClick={() => void refetchAuditEvents()}
								disabled={auditLoading}
							>
								<ListChecks />
								{t('platform.audit.applyFilters')}
							</Button>
						</div>

						{auditLoading ? (
							<div className="grid gap-3 lg:grid-cols-2">
								<Skeleton className="h-28 w-full" />
								<Skeleton className="h-28 w-full" />
							</div>
						) : auditError ? (
							<PlatformNotice>{auditError}</PlatformNotice>
						) : auditEvents.length === 0 ? (
							<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
								{t('platform.audit.empty')}
							</div>
						) : (
							<>
								<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
									{auditStats.map((stat) => (
										<div key={stat.label} className="rounded-lg border bg-card p-3">
											<div className="text-xs text-muted-foreground">{stat.label}</div>
											<div className="mt-1 font-mono text-xl font-semibold">
												{stat.value}
											</div>
										</div>
									))}
								</div>
								<div className="grid gap-3 lg:grid-cols-2">
									{auditEvents.map((event: EnterpriseAuditEvent, index) => {
										const inputsSummary = summarizeAuditObject(event.inputs);
										const resultSummary = summarizeAuditObject(event.result);
										const statusLabel =
											event.success === true
												? t('platform.audit.success')
												: event.success === false
													? t('platform.audit.failure')
													: t('platform.audit.unknown');

										return (
											<Card
												key={
													event.event_id ||
													`${event.timestamp}-${event.tool_name}-${index}`
												}
												size="sm"
												className="rounded-lg shadow-none"
											>
												<CardHeader className="grid-cols-[auto_1fr_auto] gap-3">
													<div
														className={cn(
															'flex size-8 items-center justify-center rounded-lg border bg-background',
															event.success === false &&
																'border-destructive/30',
														)}
													>
														{event.success === false ? (
															<XCircle className="size-4 text-destructive" />
														) : (
															<CheckCircle2 className="size-4 text-emerald-700" />
														)}
													</div>
													<div className="min-w-0">
														<CardTitle className="truncate font-mono text-sm">
															{event.tool_name ||
																t('platform.audit.unknownTool')}
														</CardTitle>
														<p className="mt-1 truncate text-xs text-muted-foreground">
															{formatTimestamp(event.timestamp)}
														</p>
													</div>
													<Badge
														variant={
															event.success === false ? 'destructive' : 'outline'
														}
														className={cn(
															event.success !== false &&
																'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
														)}
													>
														{statusLabel}
													</Badge>
												</CardHeader>
												<CardContent className="grid gap-2 text-xs">
													<div className="grid grid-cols-[7rem_1fr] gap-2">
														<span className="text-muted-foreground">
															{t('platform.audit.user')}
														</span>
														<span className="min-w-0 truncate font-mono">
															{event.user_id || '-'} / {event.tenant || '-'}
														</span>
													</div>
													<div className="grid grid-cols-[7rem_1fr] gap-2">
														<span className="text-muted-foreground">
															{t('platform.audit.connector')}
														</span>
														<span className="min-w-0 truncate font-mono">
															{event.connector || '-'}
														</span>
													</div>
													<div className="grid grid-cols-[7rem_1fr] gap-2">
														<span className="text-muted-foreground">
															{t('platform.audit.duration')}
														</span>
														<span className="font-mono">
															{event.duration_ms ?? '-'} ms
														</span>
													</div>
													{inputsSummary ? (
														<div className="grid grid-cols-[7rem_1fr] gap-2">
															<span className="text-muted-foreground">
																{t('platform.audit.inputs')}
															</span>
															<span className="min-w-0 break-words font-mono">
																{inputsSummary}
															</span>
														</div>
													) : null}
													{resultSummary ? (
														<div className="grid grid-cols-[7rem_1fr] gap-2">
															<span className="text-muted-foreground">
																{t('platform.audit.result')}
															</span>
															<span className="min-w-0 break-words font-mono">
																{resultSummary}
															</span>
														</div>
													) : null}
													{event.error?.message ? (
														<div className="grid grid-cols-[7rem_1fr] gap-2 text-destructive">
															<span>{t('common.error')}</span>
															<span className="min-w-0 break-words">
																{event.error.message}
															</span>
														</div>
													) : null}
												</CardContent>
											</Card>
										);
									})}
								</div>
							</>
						)}
					</section>
				</div>
			</main>
		);
	}

	if (view === 'workflows') {
		return (
			<main className="h-full overflow-y-auto bg-background">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
					<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0">
							<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
								<Workflow className="size-4" />
								<span>{t('platform.workflowRunner.title')}</span>
							</div>
							<h1 className="text-2xl font-semibold tracking-normal">
								{t('platform.workflowRunner.title')}
							</h1>
							<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
								{t('platform.workflowRunner.description')}
							</p>
						</div>
						<div className="grid min-w-0 gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:min-w-80">
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t('platform.connection.server')}
								</span>
								<span className="truncate font-mono" title={serverUrl}>
									{serverUrl}
								</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t('platform.connection.user')}
								</span>
								<span className="truncate font-mono" title={username}>
									{username}
								</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t('platform.connection.health')}
								</span>
								<StateBadge
									state={hasErrors ? 'partial' : 'ready'}
									label={
										hasErrors
											? t('platform.connection.partial')
											: t('platform.connection.connected')
									}
								/>
							</div>
						</div>
					</section>

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
				</div>
			</main>
		);
	}

	if (view === 'agents') {
		return (
			<main className="h-full overflow-y-auto bg-background">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
					<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0">
							<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
								<BotMessageSquare className="size-4" />
								<span>{t('platform.agentManagement.title')}</span>
							</div>
							<h1 className="text-2xl font-semibold tracking-normal">
								{t('platform.agentManagement.title')}
							</h1>
							<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
								{t('platform.agentManagement.description')}
							</p>
						</div>
						<div className="flex flex-wrap gap-2 lg:justify-end">
							<Button
								size="sm"
								variant="outline"
								onClick={() => void refetchPlatformAgents()}
								disabled={platformAgentsLoading}
							>
								<RefreshCcw className={cn(platformAgentsLoading && 'animate-spin')} />
								{t('platform.actions.refreshStatus')}
							</Button>
							<Button
								size="sm"
								onClick={scrollToAgentRunner}
								disabled={!selectedRunAgent}
							>
								<Play />
								{t('platform.agentManagement.runAgent')}
							</Button>
						</div>
					</section>

					{platformAgentsError ? (
						<PlatformNotice>{t('platform.agentManagement.loadError')}</PlatformNotice>
					) : null}

					<section ref={agentManagementRef} className="grid gap-6">
						<AgentManagementOverview
							agentOpsSummary={agentOpsSummary}
							agentReleasePipeline={agentReleasePipeline}
							nextAgentSetupStep={nextAgentSetupStep}
							selectedRunAgent={selectedRunAgent}
							selectedRunAgentReadinessState={selectedRunAgentReadinessState}
							selectedRunAgentReadinessLabel={selectedRunAgentReadinessLabel}
							selectedRunAgentModelLabel={selectedRunAgentModelLabel}
							selectedRunAgentKnowledgeCount={selectedRunAgentKnowledgeCount}
							selectedRunAgentToolCount={selectedRunAgentToolCount}
							labels={{
								pipelineTitle: t('platform.agentManagement.pipeline.title'),
								pipelineDescription: t('platform.agentManagement.pipeline.description'),
								nextAction: t('platform.agentManagement.wizard.nextAction'),
								readyAction: t('platform.agentManagement.wizard.readyAction'),
								noRuntimeAgent: t('platform.agentManagement.ops.noRuntimeAgent'),
								noRuntimeAgentHint: t('platform.agentManagement.ops.noRuntimeAgentHint'),
								modelCredential: t('platform.agentManagement.modelCredential'),
								knowledgeBases: t('platform.agentManagement.knowledgeBases'),
								tools: t('platform.agentManagement.tools'),
								memory: t('platform.agentManagement.memory'),
								workflow: t('platform.agentManagement.workflow'),
								enabled: t('platform.agentManagement.enabled'),
								disabled: t('platform.agentManagement.disabled'),
								runAgent: t('platform.agentManagement.runAgent'),
								runWorkflow: t('platform.agentManagement.runWorkflow'),
								edit: t('platform.agentManagement.edit'),
								openGovernance: t('platform.agentManagement.ops.openGovernance'),
								states: {
									ready: t('platform.agentManagement.wizard.states.ready'),
									partial: t('platform.agentManagement.wizard.states.partial'),
									todo: t('platform.agentManagement.wizard.states.todo'),
									blocked: t('platform.agentManagement.wizard.states.blocked'),
								},
							}}
							onNextAgentSetupStep={handleNextAgentSetupStep}
							onRunAgent={scrollToAgentRunner}
							onRunWorkflow={handlePrimeAgentWorkflow}
							onEditAgent={handleEditAgent}
							onOpenGovernance={scrollToGovernance}
						/>
					</section>

					<section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
						<div ref={agentTemplateStepRef} className="grid gap-3">
							<AgentTemplateList
								templates={agentTemplates}
								selectedTemplateId={selectedTemplateId}
								loading={platformAgentsLoading}
								hasLoaded={Boolean(platformAgents)}
								publishingTemplateId={publishingTemplateId}
								labels={{
									title: t('platform.agentManagement.templates'),
									empty: t('platform.agentManagement.emptyTemplates'),
									configure: t('platform.agentManagement.configureTemplate'),
								}}
								onConfigureTemplate={handleConfigureTemplate}
							/>
						</div>

						<section ref={agentRunnerRef} className="grid gap-4 rounded-lg border bg-muted/10 p-4">
							<div className="flex items-start gap-2">
								<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
									<BotMessageSquare className="size-4 text-muted-foreground" />
								</div>
								<div className="min-w-0">
									<h2 className="text-base font-semibold">
										{t('platform.agentRunner.title')}
									</h2>
									<p className="text-sm text-muted-foreground">
										{t('platform.agentRunner.description')}
									</p>
								</div>
							</div>

							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.agentRunner.instance')}
								</label>
								<Select
									value={selectedRunAgentId}
									onValueChange={handleSelectRunAgent}
									disabled={activePlatformAgents.length === 0}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder={t('platform.agentRunner.selectInstance')} />
									</SelectTrigger>
									<SelectContent>
										{activePlatformAgents.map((agent) => (
											<SelectItem key={agent.id} value={agent.id}>
												{agent.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{activePlatformAgents.length === 0 ? (
								<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
									{t('platform.agentRunner.noInstances')}
								</div>
							) : selectedRunAgent ? (
								<div className="flex flex-wrap gap-2">
									<Badge variant="outline" className="max-w-full font-mono">
										{selectedRunAgent.tenant}
									</Badge>
									<Badge variant="outline" className="max-w-full truncate">
										{t('platform.agentManagement.modelCredential')}: {selectedRunAgentModelLabel}
									</Badge>
									<Badge variant="outline">
										{t('platform.agentRunner.knowledgeCount', {
											count: selectedRunAgentKnowledgeLabels.length,
										})}
									</Badge>
									<Badge variant="outline">
										{t('platform.agentRunner.toolsCount', {
											count: selectedRunAgentToolCount,
										})}
									</Badge>
									<Badge
										variant="outline"
										className={cn(
											!selectedRunAgentAccessAllowed &&
												'border-red-500/30 bg-red-500/10 text-red-700',
										)}
									>
										{selectedRunAgentAccessLabel}
									</Badge>
								</div>
							) : null}

							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.agentRunner.question')}
								</label>
								<Textarea
									value={agentQuestion}
									onChange={(event) => {
										setAgentQuestion(event.target.value);
										setAgentRunError(null);
									}}
									placeholder={t('platform.agentRunner.placeholder')}
									className="min-h-28 resize-y"
								/>
							</div>

							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.agentRunner.approvalId')}
								</label>
								<Input
									value={agentApprovalId}
									onChange={(event) => {
										setAgentApprovalId(event.target.value);
										setAgentRunError(null);
									}}
									placeholder={t('platform.agentRunner.approvalIdPlaceholder')}
									className="font-mono"
								/>
							</div>

							<div className="grid gap-2">
								<div className="text-xs font-medium text-muted-foreground">
									{t('platform.agentRunner.samples')}
								</div>
								<div className="flex flex-wrap gap-2">
									{agentSampleQuestions.map((sample) => (
										<Button
											key={sample}
											type="button"
											size="sm"
											variant="outline"
											onClick={() => {
												setAgentQuestion(sample);
												setAgentRunError(null);
											}}
										>
											{sample}
										</Button>
									))}
								</div>
							</div>

							<AgentRunnerConversation
								turns={selectedAgentConversation}
								activeResponse={agentRunResult}
								loading={agentRunsLoading}
								error={agentRunsError}
								labels={{
									title: t('platform.agentRunner.conversation'),
									clear: t('platform.agentRunner.clearConversation'),
									loading: t('common.loading'),
									empty: t('platform.agentRunner.conversationEmpty'),
									selectedTool: t('platform.agentRunner.selectedTool'),
									notRouted: t('platform.agentRunner.notRouted'),
								}}
								onClear={handleClearAgentConversation}
								onSelectTurn={(turn) =>
									void handleSelectAgentRun(turn as EnterpriseAgentConversationTurn)
								}
							/>

							<div className="flex justify-end">
								<Button
									onClick={handleRunEnterpriseAgent}
									disabled={
										runningAgent ||
										!agentQuestion.trim() ||
										!selectedRunAgentId ||
										!selectedRunAgentAccessAllowed
									}
								>
									<Play className={cn(runningAgent && 'animate-pulse')} />
									{runningAgent
										? t('platform.agentRunner.running')
										: t('platform.agentRunner.run')}
								</Button>
							</div>

							{agentRunError ? (
								<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
									{t('platform.agentRunner.error')} {agentRunError}
								</div>
							) : null}
						</section>
					</section>

					<section className="grid gap-3">
						<AgentRunnerResult
							result={agentRunResult}
							toolCalls={agentToolCalls}
							toolCallBadgeText={agentToolCallBadgeText}
							routingLabel={agentRoutingLabel}
							routingText={agentRoutingText}
							connectorSourceText={agentRunConnectorSourceText}
							modelLabel={agentRunModelLabel}
							knowledgeLabels={agentRunKnowledgeLabels}
							knowledgeBaseById={knowledgeBaseById}
							onInspectAudit={handleInspectAgentRunAudit}
							t={t}
						/>
					</section>
				</div>
			</main>
		);
	}

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
						void handleSelectAgentRun(turn as EnterpriseAgentConversationTurn);
					}}
					onInspectAudit={handleInspectAgentRunAudit}
					onOpenGovernance={scrollToGovernance}
					t={t}
				/>

				<section
					ref={workflowRunnerRef}
					className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]"
				>
					<div className="flex flex-col gap-3">
						<div className="flex items-start gap-2">
							<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/20">
								<Workflow className="size-4 text-muted-foreground" />
							</div>
							<div className="min-w-0">
								<h2 className="text-base font-semibold">
									{t('platform.workflowRunner.title')}
								</h2>
								<p className="text-sm text-muted-foreground">
									{t('platform.workflowRunner.description')}
								</p>
							</div>
						</div>

						<div className="grid gap-4 rounded-lg border bg-muted/10 p-4">
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.workflowRunner.selectWorkflow')}
								</label>
								<Select
									value={selectedWorkflowType}
									onValueChange={(value) => {
										setSelectedWorkflowType(value);
										setWorkflowRunError(null);
										const nextWorkflow = workflowOptions.find(
											(workflow) => workflow.value === value,
										);
										setWorkflowInputs(
											normalizeWorkflowInputs(nextWorkflow?.defaultInputs),
										);
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue
											placeholder={t(
												'platform.workflowRunner.selectWorkflow',
											)}
										/>
									</SelectTrigger>
									<SelectContent>
										{workflowOptions.map((workflow) => (
											<SelectItem
												key={workflow.value}
												value={workflow.value}
											>
												{workflow.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{selectedWorkflowTemplate ? (
									<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
										<Badge
											variant="outline"
											className={cn(
												selectedWorkflowTemplate.enabled
													? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
													: 'border-slate-500/30 bg-slate-500/10 text-slate-700',
											)}
										>
											{selectedWorkflowTemplate.enabled
												? t('platform.workflowRunner.enabled')
												: t('platform.workflowRunner.disabled')}
										</Badge>
										<span>{selectedWorkflowTemplate.description}</span>
									</div>
								) : null}
								</div>

								<div className="grid gap-3 md:grid-cols-3">
									{Object.entries(workflowInputs).map(([key, value]) => {
										const labelKey = workflowInputLabelKeys[key];

										return (
											<div key={key} className="grid gap-2">
												<label className="text-xs font-medium text-muted-foreground">
													{labelKey
														? t(`platform.workflowRunner.${labelKey}`)
														: workflowInputLabel(key)}
												</label>
												<Input
													value={value}
													onChange={(event) =>
														setWorkflowInputs((current) => ({
															...current,
															[key]: event.target.value,
														}))
													}
												/>
											</div>
										);
									})}
								</div>

							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.workflowRunner.approvalId')}
								</label>
								<Input
									value={workflowApprovalId}
									onChange={(event) => setWorkflowApprovalId(event.target.value)}
									placeholder={t(
										'platform.workflowRunner.approvalIdPlaceholder',
									)}
									className="font-mono"
								/>
							</div>

							<div className="flex flex-wrap justify-end gap-2">
								<Button
									variant="outline"
									onClick={() => void handleCreateRunApproval('workflow_run')}
									disabled={
										creatingRunApproval === 'workflow_run' ||
										workflowTemplatesLoading ||
										selectedWorkflowDisabled ||
										Boolean(platformError)
									}
								>
									<ListChecks
										className={cn(
											creatingRunApproval === 'workflow_run' &&
												'animate-pulse',
										)}
									/>
									{creatingRunApproval === 'workflow_run'
										? t('platform.workflowRunner.requestingApproval')
										: t('platform.workflowRunner.requestApproval')}
								</Button>
								<Button
									onClick={handleRunEnterpriseWorkflow}
									disabled={
										runningWorkflow ||
										workflowTemplatesLoading ||
										selectedWorkflowDisabled ||
										Boolean(platformError)
									}
								>
									<Play className={cn(runningWorkflow && 'animate-pulse')} />
									{runningWorkflow
										? t('platform.workflowRunner.running')
										: t('platform.workflowRunner.run')}
								</Button>
							</div>

							{workflowRunError ? (
								<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
									{t('platform.workflowRunner.error')} {workflowRunError}
								</div>
							) : null}
						</div>

						<div className="grid gap-3 rounded-lg border bg-muted/10 p-4">
							<div>
								<h3 className="text-sm font-semibold">
									{t('platform.workflowRunner.templates')}
								</h3>
								<p className="text-xs text-muted-foreground">
									{t('platform.workflowRunner.templatesDescription')}
								</p>
							</div>
							{workflowTemplatesLoading ? (
								<div className="grid gap-2">
									{[0, 1, 2].map((item) => (
										<Skeleton key={item} className="h-20 rounded-lg" />
									))}
								</div>
							) : workflowTemplatesError ? (
								<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
									{workflowTemplatesError}
								</div>
							) : workflowTemplates.length === 0 ? (
								<div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
									{t('platform.workflowRunner.noTemplates')}
								</div>
							) : (
								<div className="grid gap-2">
									{workflowTemplates.map((template) => {
										const toolNames = Array.from(
											new Set(
												template.steps.map((step) => step.tool_name),
											),
										);
										const isSaving =
											savingWorkflowType === template.workflow_type;

										return (
											<div
												key={template.workflow_type}
												className="rounded-lg border bg-background p-3"
											>
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2">
															<span className="font-medium">
																{template.name}
															</span>
															<Badge variant="outline">
																{t(
																	'platform.workflowRunner.stepsCount',
																	{
																		count: template.steps.length,
																	},
																)}
															</Badge>
															<Badge
																variant="outline"
																className={cn(
																	template.enabled
																		? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
																		: 'border-slate-500/30 bg-slate-500/10 text-slate-700',
																)}
															>
																{template.enabled
																	? t(
																			'platform.workflowRunner.enabled',
																		)
																	: t(
																			'platform.workflowRunner.disabled',
																		)}
															</Badge>
														</div>
														<p className="mt-1 text-xs text-muted-foreground">
															{template.description}
														</p>
													</div>
													<div className="flex shrink-0 items-center gap-2">
														{isSaving ? (
															<span className="text-xs text-muted-foreground">
																{t(
																	'platform.workflowRunner.savingTemplate',
																)}
															</span>
														) : null}
														<Switch
															size="sm"
															checked={template.enabled}
															disabled={isSaving}
															onCheckedChange={(checked) =>
																void handleToggleWorkflowTemplate(
																	template,
																	checked,
																)
															}
														/>
													</div>
												</div>
												<div className="mt-3 flex flex-wrap gap-2">
													<span className="text-xs text-muted-foreground">
														{t('platform.workflowRunner.stepTools')}
													</span>
													{toolNames.map((toolName) => (
														<Badge key={toolName} variant="secondary">
															{toolName}
														</Badge>
													))}
												</div>
												<div className="mt-3 text-xs text-muted-foreground">
													{t('platform.workflowRunner.updatedAt')}{' '}
													{formatTimestamp(template.updated_at)}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</div>

					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-2">
							<Workflow className="size-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold">
								{t('platform.workflowRunner.summary')}
							</h3>
						</div>
						{workflowRunResult ? (
							<div className="grid gap-4">
								<div className="rounded-lg border bg-muted/10 p-4">
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant="outline">
											{workflowRunResult.workflow_name}
										</Badge>
										<span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
											{workflowRunResult.agent_id}
										</span>
									</div>
									<p className="mt-3 whitespace-pre-wrap text-sm leading-6">
										{workflowRunResult.summary}
									</p>
								</div>

								<div className="grid gap-2">
									<div className="text-xs font-medium text-muted-foreground">
										{t('platform.workflowRunner.steps')}
									</div>
									{workflowRunResult.steps.map((step) => {
										const statusLabel =
											step.status === 'success'
												? t('platform.workflowRunner.statusSuccess')
												: step.status === 'denied'
													? t('platform.workflowRunner.statusDenied')
													: t('platform.workflowRunner.statusFailed');

										return (
											<div
												key={`${step.id}-${step.tool_name}`}
												className="rounded-lg border bg-background p-3"
											>
												<div className="flex flex-wrap items-center gap-2">
													<Badge
														variant={
															step.status === 'failed'
																? 'destructive'
																: 'outline'
														}
														className={cn(
															step.status === 'success' &&
																'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
															step.status === 'denied' &&
																'border-amber-500/30 bg-amber-500/10 text-amber-700',
														)}
													>
														{statusLabel}
													</Badge>
													<span className="font-medium">
														{step.title}
													</span>
													<span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
														{step.tool_name}
													</span>
												</div>
												{step.message ? (
													<p className="mt-2 text-sm text-muted-foreground">
														{step.message}
													</p>
												) : null}
												{step.result ? (
													<pre className="mt-3 max-h-44 overflow-auto rounded-md border bg-muted/20 p-3 text-xs leading-5">
														{JSON.stringify(step.result, null, 2)}
													</pre>
												) : null}
											</div>
										);
									})}
								</div>

								<div className="grid gap-2">
									<div className="text-xs font-medium text-muted-foreground">
										{t('platform.workflowRunner.toolCalls')}
									</div>
									<pre className="max-h-60 overflow-auto rounded-lg border bg-muted/20 p-4 text-xs leading-5">
										{JSON.stringify(
											workflowRunResult.tool_calls,
											null,
											2,
										)}
									</pre>
								</div>
							</div>
							) : (
								<div className="flex min-h-72 items-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
									{t('platform.workflowRunner.emptyResult')}
								</div>
							)}

							<div className="grid gap-3 rounded-lg border bg-muted/10 p-4">
								<div>
									<h3 className="text-sm font-semibold">
										{t('platform.workflowRunner.history')}
									</h3>
									<p className="text-xs text-muted-foreground">
										{t('platform.workflowRunner.historyDescription')}
									</p>
								</div>

								{workflowRunsLoading ? (
									<div className="grid gap-2">
										{[0, 1, 2].map((item) => (
											<Skeleton key={item} className="h-28 rounded-lg" />
										))}
									</div>
								) : workflowRunsError ? (
									<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
										{workflowRunsError}
									</div>
								) : workflowRuns.length === 0 ? (
									<div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
										{t('platform.workflowRunner.historyEmpty')}
									</div>
								) : (
									<div className="grid gap-2">
										{workflowRuns.map((run) => {
											const counts = run.status_counts ?? {};

											return (
												<div
													key={run.run_id}
													className="rounded-lg border bg-background p-3"
												>
													<div className="flex flex-wrap items-center justify-between gap-2">
														<div className="min-w-0">
															<div className="flex flex-wrap items-center gap-2">
																<Badge
																	variant={
																		run.status === 'failed'
																			? 'destructive'
																			: 'outline'
																	}
																	className={cn(
																		workflowStatusClassName(run.status),
																	)}
																>
																	{t(
																		`platform.workflowRunner.${workflowStatusLabelKey(run.status)}`,
																	)}
																</Badge>
																<span className="font-medium">
																	{run.workflow_name}
																</span>
															</div>
															<div className="mt-1 text-xs text-muted-foreground">
																{t('platform.workflowRunner.statusCounts', {
																	success: counts.success ?? 0,
																	denied: counts.denied ?? 0,
																	failed: counts.failed ?? 0,
																})}
															</div>
														</div>
														<div className="text-right text-xs text-muted-foreground">
															<div>{t('platform.workflowRunner.lastRun')}</div>
															<div>{formatTimestamp(run.finished_at)}</div>
														</div>
													</div>

													<p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
														{run.summary}
													</p>

													<div className="mt-3 grid gap-1 text-xs text-muted-foreground">
														<div className="flex flex-wrap gap-1">
															<span>{t('platform.audit.user')}:</span>
															<span className="font-mono">
																{run.user_id} / {run.tenant}
															</span>
														</div>
														<div className="flex flex-wrap gap-1">
															<span>Agent:</span>
															<span className="font-mono">{run.agent_id}</span>
														</div>
														<div className="flex flex-wrap gap-1">
															<span>{t('platform.audit.inputs')}:</span>
															<span>{summarizeAuditObject(run.inputs)}</span>
														</div>
														<div className="flex flex-wrap gap-1">
															<span>{t('platform.workflowRunner.runId')}:</span>
															<span className="font-mono">{run.run_id}</span>
														</div>
													</div>
												</div>
											);
										})}
									</div>
								)}
							</div>
					</div>
				</section>

				<section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
					<div className="flex flex-col gap-3">
						<div className="flex items-start gap-2">
							<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/20">
								<ShieldCheck className="size-4 text-muted-foreground" />
							</div>
							<div className="min-w-0">
								<h2 className="text-base font-semibold">
									{t('platform.approvals.title')}
								</h2>
								<p className="text-sm text-muted-foreground">
									{t('platform.approvals.description')}
								</p>
							</div>
						</div>

						<div className="grid gap-4 rounded-lg border bg-muted/10 p-4">
							<div>
								<h3 className="text-sm font-semibold">
									{t('platform.approvals.createTitle')}
								</h3>
								<p className="text-xs text-muted-foreground">
									{t('platform.approvals.createDescription')}
								</p>
							</div>

							<div className="grid gap-3 md:grid-cols-2">
								<div className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.approvals.requestType')}
									</label>
									<Select
										value={approvalForm.request_type}
										onValueChange={(value) =>
											setApprovalForm((current) => ({
												...current,
												request_type: value as EnterpriseApprovalRequestType,
											}))
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="tool_run">
												{t('platform.approvals.toolRun')}
											</SelectItem>
											<SelectItem value="workflow_run">
												{t('platform.approvals.workflowRun')}
											</SelectItem>
											<SelectItem value="agent_action">
												{t('platform.approvals.agentAction')}
											</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{approvalForm.request_type === 'workflow_run' ? (
									<div className="grid gap-2">
										<label className="text-xs font-medium text-muted-foreground">
											{t('platform.approvals.target')}
										</label>
										<Select
											value={approvalForm.workflow_type}
											onValueChange={(value) =>
												setApprovalForm((current) => ({
													...current,
													workflow_type: value,
												}))
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{workflowOptions.map((workflow) => (
													<SelectItem
														key={workflow.value}
														value={workflow.value}
													>
														{workflow.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								) : approvalForm.request_type === 'tool_run' ? (
									<div className="grid gap-2">
										<label className="text-xs font-medium text-muted-foreground">
											{t('platform.approvals.target')}
										</label>
										<Select
											value={approvalForm.tool_name}
											onValueChange={(value) =>
												setApprovalForm((current) => ({
													...current,
													tool_name: value,
													input_key:
														enterpriseToolInputConfig[value]?.inputKey ||
														current.input_key,
													input_value:
														enterpriseToolInputConfig[value]?.defaultValue ||
														current.input_value,
												}))
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{availableToolItems.map((tool) => (
													<SelectItem key={tool.name} value={tool.name}>
														{tool.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								) : (
									<div className="grid gap-2">
										<label className="text-xs font-medium text-muted-foreground">
											{t('platform.approvals.agent')}
										</label>
										<Input
											value={approvalForm.agent_id}
											placeholder={selectedRunAgentId || 'platform-console'}
											onChange={(event) =>
												setApprovalForm((current) => ({
													...current,
													agent_id: event.target.value,
												}))
											}
										/>
									</div>
								)}
							</div>

							<div className="grid gap-3 md:grid-cols-2">
								<div className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.approvals.inputKey')}
									</label>
									<Input
										value={approvalForm.input_key}
										onChange={(event) =>
											setApprovalForm((current) => ({
												...current,
												input_key: event.target.value,
											}))
										}
									/>
								</div>
								<div className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.approvals.inputValue')}
									</label>
									<Input
										value={approvalForm.input_value}
										onChange={(event) =>
											setApprovalForm((current) => ({
												...current,
												input_value: event.target.value,
											}))
										}
									/>
								</div>
							</div>

							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.approvals.reason')}
								</label>
								<Textarea
									value={approvalForm.reason}
									onChange={(event) =>
										setApprovalForm((current) => ({
											...current,
											reason: event.target.value,
										}))
									}
								/>
							</div>

							<div className="grid gap-3 md:grid-cols-2">
								<div className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.approvals.user')}
									</label>
									<Input
										value={approvalForm.user_id}
										placeholder={selectedIdentityUserId || username}
										onChange={(event) =>
											setApprovalForm((current) => ({
												...current,
												user_id: event.target.value,
											}))
										}
									/>
								</div>
								<div className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.approvals.agent')}
									</label>
									<Input
										value={approvalForm.agent_id}
										placeholder={selectedRunAgentId || 'platform-console'}
										onChange={(event) =>
											setApprovalForm((current) => ({
												...current,
												agent_id: event.target.value,
											}))
										}
									/>
								</div>
							</div>

							<div className="flex justify-end">
								<Button onClick={handleCreateApproval} disabled={creatingApproval}>
									<ListChecks className={cn(creatingApproval && 'animate-pulse')} />
									{creatingApproval
										? t('platform.approvals.creating')
										: t('platform.approvals.create')}
								</Button>
							</div>
						</div>
					</div>

					<div className="flex flex-col gap-3">
						<div className="flex items-start justify-between gap-3">
							<div>
								<h3 className="text-sm font-semibold">
									{t('platform.approvals.listTitle')}
								</h3>
								<p className="text-xs text-muted-foreground">
									{t('platform.approvals.listDescription')}
								</p>
							</div>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => void refetchApprovals()}
								disabled={approvalLoading}
							>
								<RefreshCcw className={cn(approvalLoading && 'animate-spin')} />
								{t('platform.approvals.refresh')}
							</Button>
						</div>

						<div className="grid gap-2 sm:grid-cols-4">
							<div className="rounded-lg border bg-muted/10 p-3">
								<div className="text-xs text-muted-foreground">
									{t('platform.approvals.total')}
								</div>
								<div className="mt-1 text-lg font-semibold">{approvalSummary.total}</div>
							</div>
							<div className="rounded-lg border bg-amber-500/10 p-3">
								<div className="text-xs text-amber-800">
									{t('platform.approvals.pending')}
								</div>
								<div className="mt-1 text-lg font-semibold text-amber-900">
									{approvalSummary.pending}
								</div>
							</div>
							<div className="rounded-lg border bg-emerald-500/10 p-3">
								<div className="text-xs text-emerald-800">
									{t('platform.approvals.approved')}
								</div>
								<div className="mt-1 text-lg font-semibold text-emerald-900">
									{approvalSummary.approved}
								</div>
							</div>
							<div className="rounded-lg border bg-red-500/10 p-3">
								<div className="text-xs text-red-800">
									{t('platform.approvals.rejected')}
								</div>
								<div className="mt-1 text-lg font-semibold text-red-900">
									{approvalSummary.rejected}
								</div>
							</div>
						</div>

						<div className="grid gap-3 rounded-lg border bg-muted/10 p-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.approvals.filterStatus')}
								</label>
								<Select
									value={approvalFilters.status || ALL_APPROVAL_STATUSES_VALUE}
									onValueChange={(value) =>
										setApprovalFilters((current) => ({
											...current,
											status:
												value === ALL_APPROVAL_STATUSES_VALUE ? '' : value,
										}))
									}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_APPROVAL_STATUSES_VALUE}>
											{t('platform.approvals.allStatuses')}
										</SelectItem>
										<SelectItem value="pending">
											{t('platform.approvals.pending')}
										</SelectItem>
										<SelectItem value="approved">
											{t('platform.approvals.approved')}
										</SelectItem>
										<SelectItem value="rejected">
											{t('platform.approvals.rejected')}
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.approvals.filterTenant')}
								</label>
								<Input
									value={approvalFilters.tenant}
									onChange={(event) =>
										setApprovalFilters((current) => ({
											...current,
											tenant: event.target.value,
										}))
									}
									placeholder={platformStatus?.current_user.tenant || 'default'}
								/>
							</div>
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.approvals.filterUser')}
								</label>
								<Input
									value={approvalFilters.user_id}
									onChange={(event) =>
										setApprovalFilters((current) => ({
											...current,
											user_id: event.target.value,
										}))
									}
									placeholder={platformStatus?.current_user.user_id || username}
								/>
							</div>
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.approvals.filterAgent')}
								</label>
								<Select
									value={approvalFilters.agent_id || ALL_AGENTS_VALUE}
									onValueChange={(value) =>
										setApprovalFilters((current) => ({
											...current,
											agent_id: value === ALL_AGENTS_VALUE ? '' : value,
										}))
									}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_AGENTS_VALUE}>
											{t('platform.approvals.allAgents')}
										</SelectItem>
										{activePlatformAgents.map((agent) => (
											<SelectItem key={agent.id} value={agent.id}>
												{agent.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.approvals.filterLimit')}
								</label>
								<Input
									type="number"
									min={1}
									max={200}
									value={approvalFilters.limit}
									onChange={(event) =>
										setApprovalFilters((current) => ({
											...current,
											limit: event.target.value,
										}))
									}
								/>
							</div>
							<Button
								type="button"
								size="sm"
								className="self-end"
								onClick={() => void refetchApprovals()}
								disabled={approvalLoading}
							>
								<ListChecks />
								{t('platform.approvals.applyFilters')}
							</Button>
						</div>

						{approvalError ? <PlatformNotice>{approvalError}</PlatformNotice> : null}

						{approvalLoading ? (
							<div className="grid gap-2">
								{[0, 1, 2].map((item) => (
									<Skeleton key={item} className="h-32 rounded-lg" />
								))}
							</div>
						) : approvalRequests.length === 0 ? (
							<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
								{t('platform.approvals.empty')}
							</div>
						) : (
							<div className="grid gap-2">
								{approvalRequests.map((approval) => {
									const target =
										approval.tool_name ||
										approval.workflow_type ||
										approval.agent_id ||
										approval.request_type;
									const isDeciding = decidingApprovalId === approval.approval_id;
									const isContinuing =
										continuingApprovalId === approval.approval_id;
									const canApproveAndRun =
										approval.status === 'pending' &&
										((approval.request_type === 'tool_run' &&
											Boolean(approval.tool_name)) ||
											(approval.request_type === 'workflow_run' &&
												Boolean(approval.workflow_type)));
									const canUseApproval =
										approval.status === 'approved' &&
										((approval.request_type === 'tool_run' &&
											Boolean(approval.tool_name)) ||
											(approval.request_type === 'workflow_run' &&
												Boolean(approval.workflow_type)));

									return (
										<div
											key={approval.approval_id}
											className="rounded-lg border bg-background p-3"
										>
											<div className="flex flex-wrap items-start justify-between gap-3">
												<div className="min-w-0">
													<div className="flex flex-wrap items-center gap-2">
														<Badge
															variant="outline"
															className={cn(
																approvalStatusClassName(approval.status),
															)}
														>
															{t(`platform.approvals.${approval.status}`)}
														</Badge>
														<Badge variant="secondary">
															{t(
																`platform.approvals.${approval.request_type === 'tool_run' ? 'toolRun' : approval.request_type === 'workflow_run' ? 'workflowRun' : 'agentAction'}`,
															)}
														</Badge>
														<span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
															{target}
														</span>
													</div>
													<p className="mt-2 text-sm">
														{approval.reason || '-'}
													</p>
												</div>
												{approval.status === 'pending' ? (
													<div className="flex shrink-0 gap-2">
														{canApproveAndRun ? (
															<Button
																type="button"
																size="sm"
																onClick={() =>
																	void handleApproveAndRun(approval)
																}
																disabled={isDeciding || isContinuing}
															>
																<Play
																	className={cn(
																		isContinuing && 'animate-pulse',
																	)}
																/>
																{isContinuing
																	? t(
																			'platform.approvals.approvingAndRunning',
																		)
																	: t('platform.approvals.approveAndRun')}
															</Button>
														) : null}
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() =>
																void handleDecideApproval(
																	approval.approval_id,
																	'approved',
																)
															}
															disabled={isDeciding || isContinuing}
														>
															<CheckCircle2
																className={cn(
																	isDeciding && 'animate-pulse',
																)}
															/>
															{isDeciding
																? t('platform.approvals.approving')
																: t('platform.approvals.approve')}
														</Button>
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() =>
																void handleDecideApproval(
																	approval.approval_id,
																	'rejected',
																)
															}
															disabled={isDeciding || isContinuing}
														>
															<XCircle
																className={cn(
																	isDeciding && 'animate-pulse',
																)}
															/>
															{isDeciding
																? t('platform.approvals.rejecting')
																: t('platform.approvals.reject')}
														</Button>
													</div>
												) : canUseApproval ? (
													<Button
														type="button"
														size="sm"
														variant="outline"
														onClick={() => handleUseApproval(approval)}
													>
														<ArrowRight />
														{t('platform.approvals.useForRun')}
													</Button>
												) : null}
											</div>

											<div className="mt-3 grid gap-1 text-xs text-muted-foreground">
												<div className="flex flex-wrap gap-1">
													<span>{t('platform.approvals.approvalId')}:</span>
													<span className="break-all font-mono">
														{approval.approval_id}
													</span>
												</div>
												<div className="flex flex-wrap gap-1">
													<span>{t('platform.audit.inputs')}:</span>
													<span>{summarizeAuditObject(approval.inputs)}</span>
												</div>
												<div className="flex flex-wrap gap-1">
													<span>{t('platform.approvals.requestedBy')}:</span>
													<span className="font-mono">
														{approval.requested_by} / {approval.user_id}
													</span>
												</div>
												<div className="flex flex-wrap gap-1">
													<span>{t('platform.approvals.requestedAt')}:</span>
													<span>{formatTimestamp(approval.requested_at)}</span>
												</div>
												{approval.decided_at ? (
													<div className="flex flex-wrap gap-1">
														<span>{t('platform.approvals.decidedAt')}:</span>
														<span>{formatTimestamp(approval.decided_at)}</span>
													</div>
												) : null}
												{approval.decided_by ? (
													<div className="flex flex-wrap gap-1">
														<span>{t('platform.approvals.decidedBy')}:</span>
														<span className="font-mono">
															{approval.decided_by}
														</span>
													</div>
												) : null}
												{approval.decision_note ? (
													<div className="flex flex-wrap gap-1">
														<span>{t('platform.approvals.decisionNote')}:</span>
														<span>{approval.decision_note}</span>
													</div>
												) : null}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</section>

				<section ref={configManagementRef} className="flex flex-col gap-3">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<h2 className="text-base font-semibold">
								{t('platform.toolCatalog.title')}
							</h2>
							<p className="text-sm text-muted-foreground">
								{t('platform.toolCatalog.description')}
							</p>
						</div>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => void refetchToolCatalog()}
							disabled={toolCatalogLoading}
						>
							<RefreshCcw className={cn(toolCatalogLoading && 'animate-spin')} />
							{t('platform.audit.refresh')}
						</Button>
					</div>

					{toolCatalogLoading ? (
						<div className="grid gap-3 lg:grid-cols-3">
							<Skeleton className="h-48 w-full" />
							<Skeleton className="h-48 w-full" />
							<Skeleton className="h-48 w-full" />
						</div>
					) : toolCatalogError ? (
						<PlatformNotice>{toolCatalogError}</PlatformNotice>
					) : availableToolItems.length === 0 ? (
						<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
							{t('platform.toolCatalog.empty')}
						</div>
					) : (
						<div className="grid gap-3 lg:grid-cols-3">
							{availableToolItems.map((tool) => {
								const statItems = [
									{
										label: t('platform.toolCatalog.calls'),
										value: String(tool.stats.calls ?? 0),
									},
									{
										label: t('platform.toolCatalog.successes'),
										value: String(tool.stats.successes ?? 0),
									},
									{
										label: t('platform.toolCatalog.failures'),
										value: String(tool.stats.failures ?? 0),
									},
									{
										label: t('platform.toolCatalog.avgDuration'),
										value:
											tool.stats.avg_duration_ms === null ||
											tool.stats.avg_duration_ms === undefined
												? '-'
												: `${Math.round(tool.stats.avg_duration_ms)} ms`,
									},
									{
										label: t('platform.toolCatalog.lastCalled'),
										value: tool.stats.last_called_at
											? formatTimestamp(tool.stats.last_called_at)
											: t('platform.toolCatalog.neverCalled'),
									},
								];

								return (
									<Card
										key={tool.name}
										size="sm"
										className="rounded-lg shadow-none"
									>
										<CardHeader className="grid-cols-[auto_1fr_auto] items-start gap-3">
											<div className="flex size-8 items-center justify-center rounded-lg border bg-background">
												<Boxes className="size-4 text-muted-foreground" />
											</div>
											<div className="min-w-0">
												<CardTitle className="truncate font-mono text-sm">
													{tool.name}
												</CardTitle>
												<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
													{tool.description}
												</p>
											</div>
											<Badge
												variant={tool.allowed ? 'outline' : 'destructive'}
												className={cn(
													tool.allowed &&
														'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
												)}
											>
												{tool.allowed ? (
													<CheckCircle2 className="size-3" />
												) : (
													<XCircle className="size-3" />
												)}
												{tool.allowed
													? t('platform.policy.allowed')
													: t('platform.policy.denied')}
											</Badge>
										</CardHeader>
										<CardContent className="grid gap-4 text-xs">
											{tool.reason ? (
												<p className="break-words text-muted-foreground">
													{tool.reason}
												</p>
											) : null}
											<div className="grid gap-2">
												<div className="grid grid-cols-[6rem_1fr] gap-2">
													<span className="text-muted-foreground">
														{t('platform.toolCatalog.inputKey')}
													</span>
													<span className="min-w-0 truncate font-mono">
														{tool.input_key}
													</span>
												</div>
												<div className="grid grid-cols-[6rem_1fr] gap-2">
													<span className="text-muted-foreground">
														{t('platform.toolCatalog.defaultInput')}
													</span>
													<span className="min-w-0 truncate font-mono">
														{tool.default_input || '-'}
													</span>
												</div>
												<div className="grid grid-cols-[6rem_1fr] gap-2">
													<span className="text-muted-foreground">
														{t('platform.toolCatalog.configuredBy')}
													</span>
													{tool.configured_by_agents.length > 0 ? (
														<div className="flex min-w-0 flex-wrap gap-1">
															{tool.configured_by_agents.map(
																(agentId) => {
																	const agent =
																		publishedPlatformAgents.find(
																			(item) =>
																				item.id === agentId,
																		);

																	return (
																		<Badge
																			key={agentId}
																			variant="outline"
																			className="max-w-full truncate font-normal"
																		>
																			{agent?.name ?? agentId}
																		</Badge>
																	);
																},
															)}
														</div>
													) : (
														<span className="min-w-0 text-muted-foreground">
															{t(
																'platform.toolCatalog.notConfigured',
															)}
														</span>
													)}
												</div>
											</div>
											<div className="grid gap-2 sm:grid-cols-2">
												{statItems.map((item) => (
													<div
														key={item.label}
														className="rounded-lg border bg-background p-2"
													>
														<div className="text-muted-foreground">
															{item.label}
														</div>
														<div
															className="mt-1 truncate font-mono font-medium"
															title={item.value}
														>
															{item.value}
														</div>
													</div>
												))}
											</div>
										</CardContent>
									</Card>
								);
							})}
						</div>
					)}
				</section>

				<section
					ref={toolRunnerRef}
					className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]"
				>
					<div className="flex flex-col gap-3">
						<div className="flex items-start gap-2">
							<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/20">
								<Code2 className="size-4 text-muted-foreground" />
							</div>
							<div className="min-w-0">
								<h2 className="text-base font-semibold">
									{t('platform.toolRunner.title')}
								</h2>
								<p className="text-sm text-muted-foreground">
									{t('platform.toolRunner.description')}
								</p>
							</div>
						</div>

						<div className="grid gap-4 rounded-lg border bg-muted/10 p-4">
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.toolRunner.selectTool')}
								</label>
								<Select
									value={selectedToolName}
									onValueChange={(value) => {
										setSelectedToolName(value);
										setToolRunError(null);
									}}
									disabled={toolCatalogLoading || availableToolItems.length === 0}
								>
									<SelectTrigger className="w-full font-mono">
										<SelectValue
											placeholder={t('platform.toolRunner.selectTool')}
										/>
									</SelectTrigger>
									<SelectContent>
										{availableToolItems.map((tool) => (
											<SelectItem key={tool.name} value={tool.name}>
												{tool.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{selectedToolConfig
										? t(`platform.toolRunner.${selectedToolConfig.labelKey}`)
										: (selectedToolCatalogItem?.input_key ??
											t('platform.toolRunner.input'))}
								</label>
								<Input
									value={selectedToolInputValue}
									onChange={(event) =>
										setToolInputs((current) => ({
											...current,
											[selectedToolName]: event.target.value,
										}))
									}
									disabled={!selectedToolInputKey}
								/>
							</div>

							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.toolRunner.approvalId')}
								</label>
								<Input
									value={toolApprovalId}
									onChange={(event) => setToolApprovalId(event.target.value)}
									placeholder={t('platform.toolRunner.approvalIdPlaceholder')}
									className="font-mono"
								/>
							</div>

							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<div className="min-w-0">
									{selectedToolCatalogItem || selectedToolDecision ? (
										<Badge
											variant={
												selectedToolAllowed ? 'outline' : 'destructive'
											}
											className={cn(
												selectedToolAllowed &&
													'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
											)}
										>
											{selectedToolAllowed
												? t('platform.policy.allowed')
												: t('platform.policy.denied')}
										</Badge>
									) : null}
									{selectedToolReason ? (
										<p className="mt-2 text-xs text-muted-foreground">
											{selectedToolReason}
										</p>
									) : null}
									{(selectedToolCatalogItem || selectedToolDecision) &&
									!selectedToolAllowed ? (
										<p className="mt-2 text-xs text-destructive">
											{t('platform.toolRunner.notAllowed')}
										</p>
									) : null}
								</div>
								<div className="flex flex-wrap justify-end gap-2">
									<Button
										variant="outline"
										onClick={() => void handleCreateRunApproval('tool_run')}
										disabled={
											creatingRunApproval === 'tool_run' ||
											Boolean(platformError) ||
											!selectedToolInputKey ||
											!selectedToolAllowed
										}
									>
										<ListChecks
											className={cn(
												creatingRunApproval === 'tool_run' &&
													'animate-pulse',
											)}
										/>
										{creatingRunApproval === 'tool_run'
											? t('platform.toolRunner.requestingApproval')
											: t('platform.toolRunner.requestApproval')}
									</Button>
									<Button
										onClick={handleRunEnterpriseTool}
										disabled={
											runningTool ||
											Boolean(platformError) ||
											!selectedToolInputKey ||
											!selectedToolAllowed
										}
									>
										<Play className={cn(runningTool && 'animate-pulse')} />
										{runningTool
											? t('platform.toolRunner.running')
											: t('platform.toolRunner.run')}
									</Button>
								</div>
							</div>

							{toolRunError ? (
								<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
									{t('platform.toolRunner.error')} {toolRunError}
								</div>
							) : null}
						</div>
					</div>

					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-2">
							<Code2 className="size-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold">
								{t('platform.toolRunner.result')}
							</h3>
						</div>
						{toolRunResult ? (
							<pre className="min-h-72 overflow-auto rounded-lg border bg-muted/20 p-4 text-xs leading-5">
								{JSON.stringify(toolRunResult, null, 2)}
							</pre>
						) : (
							<div className="flex min-h-72 items-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
								{t('platform.toolRunner.emptyResult')}
							</div>
						)}
					</div>
				</section>

				<section className="flex flex-col gap-3">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<h2 className="text-base font-semibold">{t('platform.audit.title')}</h2>
							<p className="text-sm text-muted-foreground">
								{t('platform.audit.description')}
							</p>
						</div>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => void refetchAuditEvents()}
							disabled={auditLoading}
						>
							<RefreshCcw className={cn(auditLoading && 'animate-spin')} />
							{t('platform.audit.refresh')}
						</Button>
					</div>

					<div className="grid gap-3 rounded-lg border bg-muted/10 p-3 md:grid-cols-2 xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
						<div className="grid gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								{t('platform.audit.filterTenant')}
							</label>
							<Input
								value={auditFilters.tenant}
								onChange={(event) =>
									setAuditFilters((current) => ({
										...current,
										tenant: event.target.value,
									}))
								}
								placeholder={platformStatus?.current_user.tenant || 'default'}
							/>
						</div>
						<div className="grid gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								{t('platform.audit.filterUser')}
							</label>
							<Input
								value={auditFilters.user_id}
								onChange={(event) =>
									setAuditFilters((current) => ({
										...current,
										user_id: event.target.value,
									}))
								}
								placeholder={platformStatus?.current_user.user_id || username}
							/>
						</div>
						<div className="grid gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								{t('platform.audit.filterAgent')}
							</label>
							<Select
								value={auditFilters.agent_id || ALL_AGENTS_VALUE}
								onValueChange={(value) =>
									setAuditFilters((current) => ({
										...current,
										agent_id: value === ALL_AGENTS_VALUE ? '' : value,
									}))
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL_AGENTS_VALUE}>
										{t('platform.audit.allAgents')}
									</SelectItem>
									{activePlatformAgents.map((agent) => (
										<SelectItem key={agent.id} value={agent.id}>
											{agent.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								{t('platform.audit.filterTool')}
							</label>
							<Select
								value={auditFilters.tool_name || ALL_TOOLS_VALUE}
								onValueChange={(value) =>
									setAuditFilters((current) => ({
										...current,
										tool_name: value === ALL_TOOLS_VALUE ? '' : value,
									}))
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL_TOOLS_VALUE}>
										{t('platform.audit.allTools')}
									</SelectItem>
									{availableToolItems.map((tool) => (
										<SelectItem key={tool.name} value={tool.name}>
											{tool.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								{t('platform.audit.filterStatus')}
							</label>
							<Select
								value={auditFilters.success || ALL_AUDIT_STATUSES_VALUE}
								onValueChange={(value) =>
									setAuditFilters((current) => ({
										...current,
										success:
											value === ALL_AUDIT_STATUSES_VALUE ? '' : value,
									}))
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL_AUDIT_STATUSES_VALUE}>
										{t('platform.audit.allStatuses')}
									</SelectItem>
									<SelectItem value="true">
										{t('platform.audit.success')}
									</SelectItem>
									<SelectItem value="false">
										{t('platform.audit.failure')}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								{t('platform.audit.filterLimit')}
							</label>
							<Input
								type="number"
								min={1}
								max={200}
								value={auditFilters.limit}
								onChange={(event) =>
									setAuditFilters((current) => ({
										...current,
										limit: event.target.value,
									}))
								}
							/>
						</div>
						<Button
							type="button"
							size="sm"
							className="self-end"
							onClick={() => void refetchAuditEvents()}
							disabled={auditLoading}
						>
							<ListChecks />
							{t('platform.audit.applyFilters')}
						</Button>
					</div>

					{auditLoading ? (
						<div className="grid gap-3 lg:grid-cols-2">
							<Skeleton className="h-28 w-full" />
							<Skeleton className="h-28 w-full" />
						</div>
					) : auditError ? (
						<PlatformNotice>{auditError}</PlatformNotice>
					) : auditEvents.length === 0 ? (
						<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
							{t('platform.audit.empty')}
						</div>
					) : (
						<>
							<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
								{auditStats.map((stat) => (
									<div
										key={stat.label}
										className="rounded-lg border bg-card p-3"
									>
										<div className="text-xs text-muted-foreground">
											{stat.label}
										</div>
										<div className="mt-1 font-mono text-xl font-semibold">
											{stat.value}
										</div>
									</div>
								))}
							</div>
							<div className="grid gap-3 lg:grid-cols-2">
								{auditEvents.map((event: EnterpriseAuditEvent, index) => {
								const inputsSummary = summarizeAuditObject(event.inputs);
								const resultSummary = summarizeAuditObject(event.result);
								const statusLabel =
									event.success === true
										? t('platform.audit.success')
										: event.success === false
											? t('platform.audit.failure')
											: t('platform.audit.unknown');

								return (
									<Card
										key={
											event.event_id ||
											`${event.timestamp}-${event.tool_name}-${index}`
										}
										size="sm"
										className="rounded-lg shadow-none"
									>
										<CardHeader className="grid-cols-[auto_1fr_auto] gap-3">
											<div
												className={cn(
													'flex size-8 items-center justify-center rounded-lg border bg-background',
													event.success === false &&
														'border-destructive/30',
												)}
											>
												{event.success === false ? (
													<XCircle className="size-4 text-destructive" />
												) : (
													<CheckCircle2 className="size-4 text-emerald-700" />
												)}
											</div>
											<div className="min-w-0">
												<CardTitle className="truncate font-mono text-sm">
													{event.tool_name ||
														t('platform.audit.unknownTool')}
												</CardTitle>
												<p className="mt-1 truncate text-xs text-muted-foreground">
													{formatTimestamp(event.timestamp)}
												</p>
											</div>
											<Badge
												variant={
													event.success === false
														? 'destructive'
														: 'outline'
												}
												className={cn(
													event.success !== false &&
														'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
												)}
											>
												{statusLabel}
											</Badge>
										</CardHeader>
										<CardContent className="grid gap-2 text-xs">
											<div className="grid grid-cols-[7rem_1fr] gap-2">
												<span className="text-muted-foreground">
													{t('platform.audit.user')}
												</span>
												<span className="min-w-0 truncate font-mono">
													{event.user_id || '-'} / {event.tenant || '-'}
												</span>
											</div>
											<div className="grid grid-cols-[7rem_1fr] gap-2">
												<span className="text-muted-foreground">
													{t('platform.audit.connector')}
												</span>
												<span className="min-w-0 truncate font-mono">
													{event.connector || '-'}
												</span>
											</div>
											<div className="grid grid-cols-[7rem_1fr] gap-2">
												<span className="text-muted-foreground">
													{t('platform.audit.duration')}
												</span>
												<span className="font-mono">
													{event.duration_ms ?? '-'} ms
												</span>
											</div>
											{inputsSummary ? (
												<div className="grid grid-cols-[7rem_1fr] gap-2">
													<span className="text-muted-foreground">
														{t('platform.audit.inputs')}
													</span>
													<span className="min-w-0 break-words font-mono">
														{inputsSummary}
													</span>
												</div>
											) : null}
											{resultSummary ? (
												<div className="grid grid-cols-[7rem_1fr] gap-2">
													<span className="text-muted-foreground">
														{t('platform.audit.result')}
													</span>
													<span className="min-w-0 break-words font-mono">
														{resultSummary}
													</span>
												</div>
											) : null}
											{event.error?.message ? (
												<div className="grid grid-cols-[7rem_1fr] gap-2 text-destructive">
													<span>{t('common.error')}</span>
													<span className="min-w-0 break-words">
														{event.error.message}
													</span>
												</div>
											) : null}
										</CardContent>
									</Card>
								);
								})}
							</div>
						</>
					)}
				</section>

				<section className="flex flex-col gap-3">
					<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
						<div>
							<h2 className="text-base font-semibold">
								{t('platform.configManagement.title')}
							</h2>
							<p className="text-sm text-muted-foreground">
								{t('platform.configManagement.description')}
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								size="sm"
								variant="outline"
								onClick={refetchPlatformConfigExport}
								disabled={platformConfigLoading}
							>
								<RefreshCcw />
								{t('platform.configManagement.refresh')}
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={handleCopyPlatformConfig}
								disabled={!platformConfigExport}
							>
								<Copy />
								{t('platform.configManagement.copyExport')}
							</Button>
						</div>
					</div>

					<PlatformNotice>{t('platform.configManagement.redactedNotice')}</PlatformNotice>

					{platformConfigError ? (
						<PlatformNotice className="border-destructive/30 bg-destructive/10 text-destructive">
							{platformConfigError}
						</PlatformNotice>
					) : null}
					{platformConfigImportResult ? (
						<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800">
							{platformConfigImportResult}
						</div>
					) : null}

					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						{platformConfigLoading
							? Array.from({ length: 6 }).map((_, index) => (
									<Skeleton key={index} className="h-24 rounded-lg" />
								))
							: platformConfigExport
								? [
										{
											label: t('platform.configManagement.members'),
											value: platformConfigExport.counts.members,
										},
										{
											label: t('platform.configManagement.connectors'),
											value: platformConfigExport.counts.connector_configs,
										},
										{
											label: t('platform.configManagement.agents'),
											value: platformConfigExport.counts.agents,
										},
										{
											label: t('platform.configManagement.workflows'),
											value: platformConfigExport.counts.workflow_templates,
										},
										{
											label: t(
												'platform.configManagement.toolPolicyTenants',
											),
											value:
												platformConfigExport.counts.tool_policy_tenants,
										},
										{
											label: t('platform.configManagement.toolPolicyUsers'),
											value: platformConfigExport.counts.tool_policy_users,
										},
									].map((item) => (
										<Card
											key={item.label}
											size="sm"
											className="rounded-lg shadow-none"
										>
											<CardHeader>
												<CardTitle className="text-sm text-muted-foreground">
													{item.label}
												</CardTitle>
											</CardHeader>
											<CardContent>
												<div className="text-2xl font-semibold">
													{item.value}
												</div>
											</CardContent>
										</Card>
									))
								: (
										<div className="rounded-lg border p-4 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
											{t('platform.configManagement.empty')}
										</div>
									)}
					</div>

					<Card className="rounded-lg shadow-none">
						<CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
							<div>
								<CardTitle className="text-sm">
									{t('platform.configManagement.exportJson')}
								</CardTitle>
								<div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
									{platformConfigExport ? (
										<>
											<span>
												{t('platform.configManagement.schemaVersion')}:{' '}
												{platformConfigExport.schema_version}
											</span>
											<span>
												{t('platform.configManagement.lastExported')}:{' '}
												{formatTimestamp(platformConfigExport.exported_at)}
											</span>
										</>
									) : null}
								</div>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<Select
									value={platformConfigImportMode}
									onValueChange={(value) =>
										setPlatformConfigImportMode(value as 'merge' | 'replace')
									}
								>
									<SelectTrigger className="w-[8rem]">
										<SelectValue
											placeholder={t(
												'platform.configManagement.importMode',
											)}
										/>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="merge">
											{t('platform.configManagement.merge')}
										</SelectItem>
										<SelectItem value="replace">
											{t('platform.configManagement.replace')}
										</SelectItem>
									</SelectContent>
								</Select>
								<Button
									size="sm"
									onClick={handleImportPlatformConfig}
									disabled={
										importingPlatformConfig ||
										!platformConfigImportText.trim()
									}
								>
									<Upload />
									{t('platform.configManagement.import')}
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							<Textarea
								className="min-h-[18rem] font-mono text-xs"
								value={platformConfigImportText}
								onChange={(event) =>
									setPlatformConfigImportText(event.target.value)
								}
								placeholder={t('platform.configManagement.empty')}
							/>
						</CardContent>
					</Card>
				</section>

				<section className="flex flex-col gap-3">
					<div>
						<h2 className="text-base font-semibold">
							{t('platform.capabilities.title')}
						</h2>
						<p className="text-sm text-muted-foreground">
							{t('platform.capabilities.description')}
						</p>
					</div>
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						{capabilities.map((capability) => {
							const Icon = capability.icon;

							return (
								<Card
									key={capability.title}
									size="sm"
									className="rounded-lg shadow-none transition-colors hover:bg-muted/20"
								>
									<CardHeader className="grid-cols-[auto_1fr_auto] items-start gap-3">
										<div className="flex size-8 items-center justify-center rounded-lg border bg-background">
											<Icon className="size-4 text-muted-foreground" />
										</div>
										<div className="min-w-0">
											<CardTitle className="truncate text-sm">
												{capability.title}
											</CardTitle>
											<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
												{capability.description}
											</p>
										</div>
										<StateBadge
											state={capability.state}
											label={capability.status}
										/>
									</CardHeader>
									<CardContent>
										<div className="mb-3 text-sm font-medium">
											{capability.metric}
										</div>
										<Button
											size="sm"
											variant="ghost"
											className="px-0"
											onClick={capability.onClick}
										>
											<ArrowRight />
											{capability.actionLabel}
										</Button>
									</CardContent>
								</Card>
							);
						})}
					</div>
				</section>
			</div>
		</main>
	);
}
