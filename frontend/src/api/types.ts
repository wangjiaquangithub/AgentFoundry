// ─── Shared ───────────────────────────────────────────────────────────────────

export interface RecordBase {
	id: string;
	created_at: string;
	updated_at: string;
}

export interface ChatModelConfig {
	type: string;
	credential_id: string;
	model: string;
	parameters: Record<string, unknown>;
}

export interface TTSModelConfig {
	type: string;
	credential_id: string;
	model: string;
	parameters: Record<string, unknown>;
}

export interface ContextConfig {
	trigger_ratio?: number;
	reserve_ratio?: number;
	tool_result_limit?: number;
	compression_prompt?: string;
	summary_template?: string;
}

export interface ReActConfig {
	max_iters?: number;
	stop_on_reject?: boolean;
}

export interface InviteConfig {
	invitable?: boolean;
	invite_description?: string | null;
}

// ─── Enterprise Platform ─────────────────────────────────────────────────────

export interface EnterpriseToolDecision {
	name: string;
	allowed: boolean;
	reason: string;
}

export interface EnterpriseIdentity {
	user_id: string;
	tenant: string;
	display_name: string;
	role: string;
	status?: 'active' | 'inactive' | string;
	source?: string;
	sample_questions: string[];
	tool_policy: {
		mode: string;
		decisions: EnterpriseToolDecision[];
	};
}

export interface EnterprisePlatformMember {
	user_id: string;
	tenant: string;
	display_name: string;
	role: string;
	status: 'active' | 'inactive' | string;
	source?: string;
	updated_at?: string;
	updated_by?: string;
	sample_questions?: string[];
}

export interface EnterprisePlatformMembersResponse {
	members: EnterprisePlatformMember[];
	roles: string[];
	path: string;
}

export interface EnterprisePlatformMemberUpsertRequest {
	user_id: string;
	tenant?: string;
	display_name?: string;
	role?: string;
	status?: 'active' | 'inactive' | string;
}

export interface EnterprisePlatformMemberUpdateResponse
	extends EnterprisePlatformMembersResponse {
	member: EnterprisePlatformMember;
}

export interface EnterpriseTenantPolicy {
	key: string;
	preview: string;
}

export interface EnterpriseTenantTicket {
	id: string;
	status?: string | null;
	owner?: string | null;
	summary?: string | null;
}

export interface EnterpriseTenantDepartment {
	name: string;
	metrics: Record<string, unknown>;
}

export interface EnterpriseTenantWorkspace {
	tenant: string;
	source: string;
	policies: EnterpriseTenantPolicy[];
	tickets: EnterpriseTenantTicket[];
	departments: EnterpriseTenantDepartment[];
	sample_questions: string[];
	note?: string;
	[key: string]: unknown;
}

export interface EnterpriseAuditEvent {
	schema_version?: number;
	event_id?: string;
	event_type?: string;
	timestamp?: string;
	user_id?: string;
	tenant?: string;
	agent_id?: string;
	session_id?: string;
	tool_name?: string;
	connector?: string;
	inputs?: Record<string, unknown>;
	duration_ms?: number;
	success?: boolean;
	error?: {
		type?: string;
		message?: string;
	};
	result?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface EnterpriseToolRunRequest {
	tool_name: string;
	inputs: Record<string, unknown>;
	user_id?: string;
	agent_id?: string;
	approval_id?: string;
}

export interface EnterpriseToolRunResponse {
	tool_name: string;
	allowed: boolean;
	tenant: string;
	user_id: string;
	approval_id?: string | null;
	decision: EnterpriseToolDecision;
	result?: Record<string, unknown>;
}

export interface EnterpriseToolAuditStats {
	calls: number;
	successes: number;
	failures: number;
	last_called_at?: string | null;
	avg_duration_ms?: number | null;
}

export interface EnterpriseToolCatalogItem {
	name: string;
	description: string;
	input_key: string;
	default_input: string;
	allowed: boolean;
	reason: string;
	configured_by_agents: string[];
	configured_for_agent?: boolean | null;
	configured_agent_id?: string | null;
	stats: EnterpriseToolAuditStats;
}

export interface EnterpriseToolCatalogResponse {
	tools: EnterpriseToolCatalogItem[];
	user_id: string;
	tenant: string;
	agent_id?: string | null;
}

export interface EnterpriseToolPolicyScope {
	allow?: string[];
	deny?: string[];
	[key: string]: unknown;
}

export interface EnterpriseToolPolicyResponse {
	mode: string;
	path: string;
	policy: Record<string, unknown>;
	identities: EnterpriseIdentity[];
	selected?: {
		tenant: string;
		user_id: string;
	};
}

export interface EnterpriseToolPolicyUpdateRequest {
	tenant: string;
	user_id: string;
	allow: string[];
	deny: string[];
}

export type EnterpriseToolPolicyUpdateResponse = EnterpriseToolPolicyResponse;

export interface EnterprisePlatformDashboardTodo {
	code: 'pending_approvals' | 'recent_tool_failures' | string;
	severity: 'info' | 'warning' | 'error' | string;
	count?: number;
}

export interface EnterprisePlatformDashboardRiskTool {
	name: string;
	description: string;
	allowed: boolean;
	reason: string;
}

export interface EnterprisePlatformDashboardAction {
	code:
		| 'review_pending_approvals'
		| 'investigate_failed_workflows'
		| 'enable_disabled_workflows'
		| 'run_first_workflow'
		| 'operations_ready'
		| string;
	severity: 'info' | 'warning' | 'error' | string;
	count?: number;
	target?: 'approvals' | 'workflows' | 'tools' | 'audit' | string;
}

export interface EnterprisePlatformGovernedWorkflow {
	workflow_type: string;
	name: string;
	enabled: boolean;
	requires_workflow_approval: boolean;
	approval_required_tools: string[];
	pending_approval_count: number;
}

export interface EnterprisePlatformOperations {
	workflow_template_count: number;
	enabled_workflow_count: number;
	disabled_workflow_count: number;
	workflow_status_counts: Record<string, number>;
	pending_workflow_approval_count: number;
	pending_tool_approval_count: number;
	governed_workflows: EnterprisePlatformGovernedWorkflow[];
	recommended_actions: EnterprisePlatformDashboardAction[];
}

export interface EnterprisePlatformDashboard {
	pending_approvals: {
		count: number;
		items: EnterpriseApprovalRequestItem[];
	};
	approved_approval_count: number;
	recent_workflow_runs: EnterpriseWorkflowRunHistoryItem[];
	workflow_run_count: number;
	recent_audit_events: EnterpriseAuditEvent[];
	audit_event_count: number;
	risk_tools: EnterprisePlatformDashboardRiskTool[];
	todos: EnterprisePlatformDashboardTodo[];
	operations?: EnterprisePlatformOperations;
}

export type EnterprisePlatformLaunchReadinessStatus = 'ready' | 'partial' | 'blocked';

export interface EnterprisePlatformLaunchReadinessItem {
	code:
		| 'model'
		| 'agent'
		| 'knowledge'
		| 'tools'
		| 'memory'
		| 'connector'
		| 'governance'
		| 'workflow'
		| 'audit'
		| string;
	status: EnterprisePlatformLaunchReadinessStatus;
	severity: 'info' | 'warning' | 'error' | string;
	target:
		| 'credentials'
		| 'agents'
		| 'knowledge'
		| 'tools'
		| 'memory'
		| 'connectors'
		| 'governance'
		| 'workflows'
		| 'audit'
		| string;
	evidence?: Record<string, unknown>;
}

export interface EnterprisePlatformLaunchReadiness {
	status: EnterprisePlatformLaunchReadinessStatus;
	ready_count: number;
	total_count: number;
	blocking_count: number;
	items: EnterprisePlatformLaunchReadinessItem[];
	primary_action?: {
		target: string;
		code: string;
	} | null;
}

export type EnterprisePlatformScenarioStatus = 'ready' | 'partial' | 'blocked';

export interface EnterprisePlatformScenario {
	scenario_id: string;
	name: string;
	description: string;
	status: EnterprisePlatformScenarioStatus;
	workflow_type: string;
	enabled: boolean;
	tools: string[];
	approval_required: boolean;
	approval_required_tools: string[];
	pending_approval_count: number;
	run_count: number;
	last_run?: EnterpriseWorkflowRunHistoryItem | null;
	evidence: {
		enabled: boolean;
		tool_count: number;
		missing_tool_count: number;
		has_last_run: boolean;
		[key: string]: unknown;
	};
	next_action: {
		code: string;
		target: string;
	};
}

export interface EnterprisePlatformScenariosResponse {
	scenarios: EnterprisePlatformScenario[];
	summary: {
		total_count: number;
		ready_count: number;
		partial_count: number;
		blocked_count: number;
	};
}

export type EnterprisePlatformOpsTaskSeverity = 'info' | 'warning' | 'error' | string;

export interface EnterprisePlatformOpsTask {
	task_id: string;
	code: string;
	severity: EnterprisePlatformOpsTaskSeverity;
	status: 'open' | 'done' | string;
	title: string;
	description: string;
	target: string;
	count?: number;
	evidence?: Record<string, unknown>;
	action?: {
		type: string;
		label: string;
		method?: string;
		endpoint?: string;
	};
}

export interface EnterprisePlatformOpsTasksResponse {
	tasks: EnterprisePlatformOpsTask[];
	summary: {
		total_count: number;
		error_count: number;
		warning_count: number;
		info_count: number;
		open_count: number;
	};
}

export interface EnterprisePlatformOpsTaskResolveResponse {
	task_code: string;
	resolved: boolean;
	message: string;
	enabled_workflows?: EnterpriseWorkflowTemplate[];
	workflows?: EnterpriseWorkflowTemplate[];
	ops_tasks: EnterprisePlatformOpsTasksResponse;
}

export interface EnterpriseAuditQueryResponse {
	events: EnterpriseAuditEvent[];
	summary: {
		total_returned: number;
		successes: number;
		failures: number;
		avg_duration_ms?: number | null;
		unique_users: number;
		unique_agents: number;
		unique_tools: number;
	};
	filters: {
		tenant?: string | null;
		user_id?: string | null;
		agent_id?: string | null;
		tool_name?: string | null;
		success?: boolean | null;
	};
	limit: number;
}

export interface EnterpriseAgentRunDecision extends Partial<EnterpriseToolDecision> {
	routing_mode?: string;
	routing_source?: string;
	routing_reason?: string;
	routing_error?: string;
}

export interface EnterpriseAgentRunRequest {
	question: string;
	agent_id?: string;
	user_id?: string;
	session_id?: string;
	approval_id?: string;
}

export interface EnterpriseAgentKnowledgeHit {
	knowledge_base_id: string;
	score: number;
	document_id: string;
	source?: string;
	chunk_index?: number | null;
	total_chunks?: number | null;
	snippet: string;
	metadata?: Record<string, unknown>;
}

export interface EnterpriseAgentMemoryHit {
	id: string;
	created_at: string;
	score: number;
	source: string;
	snippet: string;
	facts?: string[];
	tool_names?: string[];
	knowledge_base_ids?: string[];
}

export interface EnterpriseAgentToolCall {
	tool_name: string;
	inputs?: Record<string, unknown>;
	allowed?: boolean;
	approval_required?: boolean;
	approval_id?: string | null;
	tenant?: string;
	user_id?: string;
	connector?: string;
	connector_source?: string;
	routing_source?: string;
	routing_reason?: string;
	decision?: EnterpriseAgentRunDecision;
	result?: Record<string, unknown>;
	answer?: string;
}

export interface EnterpriseAgentRunResponse {
	answer: string;
	routed: boolean;
	turn_id?: string;
	session_id?: string;
	tool_name?: string;
	inputs?: Record<string, unknown>;
	tenant: string;
	user_id: string;
	connector?: string;
	connector_source?: string;
	agent_id?: string;
	agent_name?: string;
	configured_tenant?: string;
	configured_tools?: string[];
	knowledge_base_ids?: string[];
	model_config_id?: string | null;
	memory_enabled?: boolean;
	workflow_enabled?: boolean;
	allowed_user_ids?: string[];
	allowed_roles?: string[];
	routing_mode?: string;
	routing_source?: string;
	routing_reason?: string;
	routing_error?: string;
	knowledge_hits?: EnterpriseAgentKnowledgeHit[];
	knowledge_error?: string;
	memory_hits?: EnterpriseAgentMemoryHit[];
	memory_saved?: boolean;
	memory_scope?: {
		tenant: string;
		user_id: string;
		agent_id: string;
	};
	decision?: EnterpriseAgentRunDecision;
	result?: Record<string, unknown>;
	tool_calls?: EnterpriseAgentToolCall[];
	evidence?: EnterpriseAgentRunEvidence;
}

export interface EnterpriseAgentRunEvidence {
	run_id: string;
	turn_id: string;
	created_at: string;
	tenant: string;
	user_id: string;
	agent_id: string;
	session_id: string;
	tool_call_count: number;
	allowed_tool_call_count: number;
	denied_tool_call_count: number;
	approval_required_count: number;
	approval_ids: string[];
	knowledge_hit_count: number;
	memory_hit_count: number;
	memory_saved: boolean;
	audit_filter: Record<string, unknown>;
}

export interface EnterpriseAgentRunHistoryItem {
	turn_id: string;
	session_id: string;
	agent_id: string;
	agent_name?: string | null;
	tenant: string;
	user_id: string;
	question: string;
	answer: string;
	created_at: string;
	evidence?: EnterpriseAgentRunEvidence;
	response: EnterpriseAgentRunResponse;
}

export interface EnterpriseAgentRunsResponse {
	runs: EnterpriseAgentRunHistoryItem[];
}

export interface EnterpriseAgentRunsDeleteResponse {
	deleted_count: number;
}

export interface EnterpriseWorkflowRunRequest {
	workflow_type: string;
	inputs: Record<string, unknown>;
	agent_id?: string;
	user_id?: string;
	approval_id?: string;
}

export interface EnterpriseWorkflowStep {
	id: string;
	title: string;
	tool_name: string;
	inputs?: Record<string, unknown>;
	status: 'success' | 'denied' | 'failed';
	result?: Record<string, unknown>;
	decision?: EnterpriseAgentRunDecision;
	message?: string;
}

export interface EnterpriseWorkflowTemplateStep {
	id: string;
	title: string;
	tool_name: string;
	input_map?: Record<string, string>;
}

export interface EnterpriseWorkflowTemplate {
	workflow_type: string;
	name: string;
	description: string;
	enabled: boolean;
	default_inputs: Record<string, unknown>;
	steps: EnterpriseWorkflowTemplateStep[];
	updated_at?: string;
	updated_by?: string;
}

export interface EnterpriseWorkflowTemplatesResponse {
	workflows: EnterpriseWorkflowTemplate[];
	workflow?: EnterpriseWorkflowTemplate;
}

export interface EnterpriseWorkflowTemplateUpdateRequest {
	name?: string;
	description?: string;
	enabled?: boolean;
	default_inputs?: Record<string, unknown>;
}

export interface EnterpriseWorkflowRunResponse {
	run_id?: string;
	workflow_type: string;
	workflow_name: string;
	status?: 'completed' | 'partial' | 'failed';
	status_counts?: Record<string, number>;
	started_at?: string;
	finished_at?: string;
	tenant: string;
	user_id: string;
	agent_id: string;
	connector?: string;
	connector_source?: string;
	approval_id?: string | null;
	inputs: Record<string, unknown>;
	summary: string;
	steps: EnterpriseWorkflowStep[];
	tool_calls: EnterpriseAgentToolCall[];
	audit_filter?: Record<string, unknown>;
}

export interface EnterpriseWorkflowRunHistoryItem {
	run_id: string;
	workflow_type: string;
	workflow_name: string;
	status: 'completed' | 'partial' | 'failed';
	status_counts: Record<string, number>;
	tenant: string;
	user_id: string;
	agent_id: string;
	inputs: Record<string, unknown>;
	started_at: string;
	finished_at: string;
	summary: string;
	steps?: EnterpriseWorkflowStep[];
	tool_calls?: EnterpriseAgentToolCall[];
}

export interface EnterpriseWorkflowRunsResponse {
	runs: EnterpriseWorkflowRunHistoryItem[];
}

export type EnterpriseApprovalStatus = 'pending' | 'approved' | 'rejected';

export type EnterpriseApprovalRequestType = 'tool_run' | 'workflow_run' | 'agent_action';

export interface EnterpriseApprovalRequestItem {
	approval_id: string;
	status: EnterpriseApprovalStatus;
	tenant: string;
	user_id: string;
	agent_id: string;
	request_type: EnterpriseApprovalRequestType;
	tool_name?: string | null;
	workflow_type?: string | null;
	inputs: Record<string, unknown>;
	reason?: string | null;
	requested_at: string;
	requested_by: string;
	decided_at?: string | null;
	decided_by?: string | null;
	decision_note?: string | null;
}

export interface EnterpriseApprovalCreateRequest {
	request_type: EnterpriseApprovalRequestType;
	tool_name?: string;
	workflow_type?: string;
	inputs?: Record<string, unknown>;
	reason?: string;
	agent_id?: string;
	user_id?: string;
}

export interface EnterpriseApprovalDecisionRequest {
	decision_note?: string;
	decided_by?: string;
}

export interface EnterpriseApprovalsResponse {
	approvals: EnterpriseApprovalRequestItem[];
	approval?: EnterpriseApprovalRequestItem;
}

export interface EnterpriseApprovalDecisionResponse {
	approval: EnterpriseApprovalRequestItem;
}

export interface EnterpriseGovernanceTenantSummary {
	tenant: string;
	identity_count: number;
	roles: string[];
	allowed_count: number;
	denied_count: number;
	pending_approvals: number;
	audit_events: number;
	failed_audit_events: number;
	workspace_source?: string;
}

export interface EnterpriseGovernanceIdentitySummary {
	user_id: string;
	tenant: string;
	display_name: string;
	role: string;
	allowed_count: number;
	denied_count: number;
	pending_approvals: number;
	recent_audit_events: number;
	failed_audit_events: number;
}

export interface EnterprisePlatformGovernanceResponse {
	identities: EnterpriseIdentity[];
	tenant_workspaces: Record<string, EnterpriseTenantWorkspace>;
	tenant_summaries: EnterpriseGovernanceTenantSummary[];
	identity_summaries: EnterpriseGovernanceIdentitySummary[];
	pending_approvals: EnterpriseApprovalRequestItem[];
	recent_audit_events: EnterpriseAuditEvent[];
	summary: {
		tenant_count: number;
		identity_count: number;
		risky_identity_count: number;
		pending_approval_count: number;
		audit_event_count: number;
		failed_audit_event_count: number;
	};
}

export interface EnterpriseApprovalRequiredDetail {
	approval_required: true;
	message: string;
	request_type: EnterpriseApprovalRequestType;
	target: string;
	target_key?: 'tool_name' | 'workflow_type' | string;
	tenant?: string;
	user_id?: string;
	agent_id?: string;
	inputs?: Record<string, unknown>;
}

export interface EnterpriseSubagentTemplate {
	type: string;
	description: string;
	permission_mode: string;
	override_leader_mode: boolean;
}

export interface EnterpriseAgentTemplate {
	id: string;
	name: string;
	description: string;
	tools: string[];
	capabilities: string[];
}

export interface EnterpriseAgentReadinessIssue {
	code: string;
	severity: 'blocking' | 'warning' | 'info';
	message: string;
	tools?: string[];
}

export interface EnterpriseAgentReadiness {
	status: 'ready' | 'partial' | 'blocked';
	summary: {
		knowledge_base_count: number;
		tool_count: number;
		approval_required_tool_count: number;
		tenant_configured?: boolean;
		model_configured: boolean;
		memory_enabled: boolean;
		workflow_enabled: boolean;
		access_restricted?: boolean;
		access_scope_valid?: boolean;
	};
	checks: {
		tenant_configured?: boolean;
		model_configured: boolean;
		knowledge_configured: boolean;
		tools_configured: boolean;
		memory_enabled: boolean;
		workflow_enabled: boolean;
		access_restricted?: boolean;
		access_scope_valid?: boolean;
		approval_required_tools: string[];
	};
	issues: EnterpriseAgentReadinessIssue[];
}

export interface EnterpriseAgentAccessSummary {
	tenant: string;
	tenant_mismatched_user_ids: string[];
	unknown_user_ids: string[];
	inactive_user_ids: string[];
	unknown_roles: string[];
	active_member_count: number;
	inactive_member_count: number;
	allowed_user_count: number;
	allowed_role_count: number;
	open_to_tenant: boolean;
	access_scope_valid: boolean;
}

export interface EnterprisePublishedAgent {
	id: string;
	template_id: string;
	name: string;
	description: string;
	tenant: string;
	tools: string[];
	knowledge_base_ids: string[];
	model_config_id?: string | null;
	memory_enabled: boolean;
	workflow_enabled: boolean;
	allowed_user_ids: string[];
	allowed_roles: string[];
	capabilities: string[];
	status: string;
	created_by: string;
	created_at: string;
	updated_at: string;
	access_summary?: EnterpriseAgentAccessSummary;
	readiness?: EnterpriseAgentReadiness;
}

export interface EnterpriseConnectorConfigVar {
	name: string;
	configured: boolean;
	required: boolean;
	secret?: boolean;
	description?: string;
}

export interface EnterpriseConnectorSupportedItem {
	name: string;
	mode: string;
	description: string;
	env_vars: string[];
	paths?: Record<string, string>;
}

export interface EnterpriseConnectorHealth {
	name: string;
	mode: string;
	status: 'ready' | 'partial' | 'error';
	message: string;
}

export interface EnterpriseConnectorSavedConfig {
	tenant: string;
	base_url: string;
	policy_path: string;
	ticket_path: string;
	metrics_path: string;
	timeout_seconds: number;
	enabled: boolean;
	token_configured: boolean;
	updated_at: string;
	updated_by: string;
}

export interface EnterpriseConnectorRuntime {
	tenant: string;
	connector: string;
	source: 'saved_config' | 'global' | string;
	saved_config_enabled: boolean;
}

export interface EnterprisePlatformConnectorsResponse {
	current: EnterpriseConnectorHealth;
	runtime: EnterpriseConnectorRuntime;
	supported: EnterpriseConnectorSupportedItem[];
	env: EnterpriseConnectorConfigVar[];
	http_paths: Record<string, string>;
	identities: EnterpriseIdentity[];
	tenant_workspaces: Record<string, EnterpriseTenantWorkspace>;
	saved_configs: EnterpriseConnectorSavedConfig[];
}

export interface EnterpriseConnectorTestRequest {
	base_url: string;
	token?: string;
	tenant: string;
	policy_keyword: string;
	ticket_id: string;
	department: string;
	policy_path: string;
	ticket_path: string;
	metrics_path: string;
	timeout_seconds: number;
}

export interface EnterpriseConnectorTestCheck {
	name: string;
	label: string;
	status: 'success' | 'error';
	latency_ms: number;
	message: string;
	preview: string;
}

export interface EnterpriseConnectorTestResponse {
	status: 'success' | 'partial' | 'error';
	checks: EnterpriseConnectorTestCheck[];
}

export interface EnterpriseConnectorConfigSaveRequest {
	base_url: string;
	token?: string;
	tenant: string;
	policy_path: string;
	ticket_path: string;
	metrics_path: string;
	timeout_seconds: number;
	enabled: boolean;
}

export interface EnterpriseConnectorConfigSaveResponse {
	config: EnterpriseConnectorSavedConfig;
	saved_configs: EnterpriseConnectorSavedConfig[];
}

export interface EnterprisePlatformAgentsResponse {
	templates: EnterpriseAgentTemplate[];
	agents: EnterprisePublishedAgent[];
}

export interface EnterpriseAgentPublishRequest {
	template_id: string;
	name?: string;
	description?: string;
	tenant?: string;
	tools?: string[];
	knowledge_base_ids?: string[];
	model_config_id?: string;
	memory_enabled?: boolean;
	workflow_enabled?: boolean;
	allowed_user_ids?: string[];
	allowed_roles?: string[];
}

export interface EnterpriseAgentUpdateRequest {
	name?: string;
	description?: string;
	tenant?: string;
	tools?: string[];
	knowledge_base_ids?: string[];
	model_config_id?: string;
	memory_enabled?: boolean;
	workflow_enabled?: boolean;
	allowed_user_ids?: string[];
	allowed_roles?: string[];
	status?: 'published' | 'archived';
}

export interface EnterpriseAgentPublishResponse {
	agent: EnterprisePublishedAgent;
	agents: EnterprisePublishedAgent[];
}

export type EnterpriseAgentUpdateResponse = EnterpriseAgentPublishResponse;

export interface EnterprisePlatformStatusResponse {
	platform: {
		name: string;
		version: string;
	};
	current_user: {
		user_id: string;
		tenant: string;
	};
	connector: {
		name: string;
	};
	identities: EnterpriseIdentity[];
	tenant_workspaces: Record<string, EnterpriseTenantWorkspace>;
	current_workspace?: EnterpriseTenantWorkspace | null;
	storage: {
		data_dir: string;
		audit_log_path: string;
	};
	audit: {
		enabled: boolean;
		recent_events: EnterpriseAuditEvent[];
	};
	dashboard?: EnterprisePlatformDashboard;
	launch_readiness?: EnterprisePlatformLaunchReadiness;
	tool_policy: {
		mode: string;
		decisions: EnterpriseToolDecision[];
	};
	subagent_templates: EnterpriseSubagentTemplate[];
}

export interface EnterprisePlatformConfigFileInfo {
	path: string;
	count?: number;
	tenant_count?: number;
	user_policy_count?: number;
}

export interface EnterprisePlatformConfigCounts {
	members: number;
	connector_configs: number;
	agents: number;
	workflow_templates: number;
	tool_policy_tenants: number;
	tool_policy_users: number;
}

export interface EnterprisePlatformConfigExportResponse {
	schema_version: number;
	platform_version: string;
	exported_at: string;
	redacted: boolean;
	files: Record<string, EnterprisePlatformConfigFileInfo>;
	counts: EnterprisePlatformConfigCounts;
	config: Record<string, unknown>;
}

export interface EnterprisePlatformConfigImportRequest {
	mode?: 'merge' | 'replace';
	config: Record<string, unknown>;
}

export interface EnterprisePlatformConfigImportResponse {
	imported: boolean;
	mode: 'merge' | 'replace' | string;
	counts: EnterprisePlatformConfigCounts;
	config: EnterprisePlatformConfigExportResponse;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export interface AgentData {
	id: string;
	name: string;
	system_prompt: string;
	context_config: ContextConfig;
	react_config: ReActConfig;
	invite_config: InviteConfig;
}

export interface AgentView extends RecordBase {
	user_id: string;
	data: AgentData;
	/**
	 * Whether the current viewer may PATCH/DELETE this agent. `false`
	 * for agents shared to the viewer with read-only permission.
	 */
	editable: boolean;
}

export interface CreateAgentRequest {
	name: string;
	system_prompt?: string;
	context_config?: ContextConfig;
	react_config?: ReActConfig;
	invite_config?: InviteConfig;
}

export interface CreateAgentResponse {
	agent_id: string;
}

export interface UpdateAgentRequest {
	name?: string;
	system_prompt?: string;
	context_config?: ContextConfig;
	react_config?: ReActConfig;
	invite_config?: InviteConfig;
}

export interface AgentListResponse {
	agents: AgentView[];
	total: number;
}

/**
 * @deprecated Superseded by {@link AgentSchemaV2Response}. Kept only for
 * legacy consumers still calling `GET /agent/schema`. The new form flow
 * uses `GET /agent/schema/v2`, which returns the full `AgentData` JSON
 * Schema in a single `schema` field.
 */
export interface AgentSchemaResponse {
	identity: JSONSchema;
	context_config: JSONSchema;
	react_config: JSONSchema;
}

/**
 * Response of `GET /agent/schema/v2`. `schema` is the full `AgentData`
 * JSON Schema (with `$ref`s inlined, `id` filtered out, and
 * `context_config.summary_schema` filtered out). The frontend derives
 * its section grouping directly from `schema.properties`:
 *   - top-level scalar/textarea/boolean properties → "identity" section
 *   - top-level `object`-typed properties (currently `context_config`,
 *     `react_config`, and `invite_config`) → one section each
 */
export interface AgentSchemaV2Response {
	schema: JSONSchema;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export type SessionSource = 'user' | 'schedule';

export interface SessionConfig {
	name: string;
	chat_model_config: ChatModelConfig;
	/** Fallback model used when the primary model fails. */
	fallback_chat_model_config: ChatModelConfig | null;
	/** TTS model configuration. null means TTS is not enabled. */
	tts_model_config: TTSModelConfig | null;
	/** Knowledge bases attached to this session + KB middleware parameters. */
	knowledge_config: SessionKnowledgeConfig | null;
	workspace_id: string;
}

// TODO: update when Python side is finalised
export type AgentState = Record<string, unknown>;

export interface SessionRecord extends RecordBase {
	user_id: string;
	agent_id: string;
	source: SessionSource;
	source_schedule_id: string | null;
	/**
	 * The team this session participates in, if any. Set when the
	 * session is the leader of a team (the session that called
	 * `TeamCreate`) or a worker spawned by `AgentCreate`. `null` for
	 * regular standalone sessions.
	 */
	team_id: string | null;
	config: SessionConfig;
	state: AgentState;
}

export interface CreateSessionRequest {
	agent_id: string;
	workspace_id?: string;
	chat_model_config?: ChatModelConfig | null;
	/** Optional fallback model. Omit (or pass null) for no fallback. */
	fallback_chat_model_config?: ChatModelConfig | null;
	/** Optional TTS model. Omit (or pass null) for no TTS. */
	tts_model_config?: TTSModelConfig | null;
	/** Optional knowledge base attachment. Omit (or null) for none. */
	knowledge_config?: SessionKnowledgeConfig | null;
}

export interface CreateSessionResponse {
	session_id: string;
}

export interface InterruptSessionResponse {
	session_id: string;
}

export interface UpdateSessionRequest {
	name?: string;
	chat_model_config?: ChatModelConfig;
	/**
	 * New fallback model. PATCH semantics:
	 *   - omit the field → leave unchanged
	 *   - set to `null`  → clear the existing fallback
	 *   - set to a value → replace the existing fallback
	 */
	fallback_chat_model_config?: ChatModelConfig | null;
	/**
	 * New TTS model. PATCH semantics:
	 *   - omit the field → leave unchanged
	 *   - set to `null`  → disable TTS
	 *   - set to a value → replace the existing TTS config
	 */
	tts_model_config?: TTSModelConfig | null;
	/**
	 * New knowledge base attachment. PATCH semantics:
	 *   - omit the field → leave unchanged
	 *   - set to `null`  → detach every knowledge base
	 *   - set to a value → replace the existing attachment
	 */
	knowledge_config?: SessionKnowledgeConfig | null;
	permission_mode?: PermissionMode;
}

export interface SessionListResponse {
	sessions: SessionView[];
	total: number;
}

/**
 * Response body for `GET /schedule/{id}/sessions`. Returns plain
 * `SessionRecord[]` (no team / is_running enrichment) because
 * scheduled-execution sessions are listed for audit purposes only,
 * not for opening in the chat UI.
 */
export interface ScheduleSessionsResponse {
	sessions: SessionRecord[];
	total: number;
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export interface TeamData {
	name: string;
	description: string;
	/** Worker agent ids belonging to the team. */
	member_ids: string[];
}

export interface TeamRecord extends RecordBase {
	user_id: string;
	/** The leader session id — the session that called `TeamCreate`. */
	session_id: string;
	data: TeamData;
}

/**
 * One member entry inside `TeamDetailResponse.members`. Pairs the
 * worker's `AgentView` with its single `session_id` so the UI can
 * navigate straight to the worker's chat.
 */
export interface TeamMemberInfo {
	agent: AgentView;
	/** `null` if the agent is in an inconsistent state (no session). */
	session_id: string | null;
}

/**
 * Resolved team detail returned inline inside `SessionView.team`.
 *
 * The leader's `AgentView` is looked up from the team's
 * `session_id` → `session.agent_id` chain on the server side.
 */
export interface TeamDetailResponse {
	team: TeamRecord;
	leader_agent: AgentView | null;
	members: TeamMemberInfo[];
}

/**
 * Per-session bundle returned by `GET /sessions/?agent_id=...`.
 *
 * Bundles three pieces of information so the chat UI can render a
 * session without follow-up requests: the persisted record (incl.
 * `state`), whether a chat run is active, and — when the session
 * participates in a team — the resolved team detail.
 *
 * Messages are intentionally separate (`GET /sessions/{id}/messages`)
 * since they paginate independently.
 */
export interface SessionView {
	session: SessionRecord;
	is_running: boolean;
	team: TeamDetailResponse | null;
}

// ─── JSON Schema ──────────────────────────────────────────────────────────────

/**
 * Subset of JSON Schema property fields the frontend renders. Sourced from
 * Pydantic's `model_json_schema()` output, including the `format: textarea`
 * hint we add via `json_schema_extra` for multi-line strings.
 */
export interface JSONSchemaProperty {
	type?: string;
	format?: string;
	description?: string;
	default?: unknown;
	const?: unknown;
	anyOf?: Array<{ type: string }>;
	enum?: unknown[];
	title?: string;
	writeOnly?: boolean;
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: number;
	exclusiveMaximum?: number;
}

export interface JSONSchema {
	title?: string;
	type?: string;
	properties: Record<string, JSONSchemaProperty>;
	required?: string[];
}

// ─── Credential ───────────────────────────────────────────────────────────────

export type CredentialSchemaProperty = JSONSchemaProperty;

// Credential schemas always include title + type (Pydantic always emits them
// for credential data classes); we narrow the generic JSONSchema here so call
// sites that read `schema.title` don't have to do null-checks.
export interface CredentialSchema extends JSONSchema {
	title: string;
	type: string;
}

export interface CredentialSchemasResponse {
	schemas: CredentialSchema[];
}

export interface CredentialView extends RecordBase {
	user_id: string;
	/**
	 * Credential payload. When the current viewer is not the owner
	 * (shared credential), only `type` and `name` are populated —
	 * secret fields are stripped server-side.
	 */
	data: Record<string, unknown>;
	/**
	 * Whether the current viewer may PATCH/DELETE this credential.
	 * `false` for credentials shared with read-only permission.
	 */
	editable: boolean;
}

export interface CreateCredentialRequest {
	data: Record<string, unknown>;
}

export interface CreateCredentialResponse {
	credential_id: string;
}

export interface UpdateCredentialRequest {
	data: Record<string, unknown>;
}

export interface CredentialListResponse {
	credentials: CredentialView[];
	total: number;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type { Msg, ContentBlock } from '@agentscope-ai/agentscope/message';
export type { AgentEvent } from '@agentscope-ai/agentscope/event';
import type {
	UserConfirmResultEvent,
	ExternalExecutionResultEvent,
} from '@agentscope-ai/agentscope/event';
import type { Msg } from '@agentscope-ai/agentscope/message';

export interface ChatRequest {
	agent_id: string;
	session_id: string;
	input: Msg | Msg[] | UserConfirmResultEvent | ExternalExecutionResultEvent | null;
}

// ─── MCP ──────────────────────────────────────────────────────────────────────

export interface StdioMCPConfig {
	type: 'stdio_mcp';
	command: string;
	args?: string[] | null;
	env?: Record<string, string> | null;
	cwd?: string | null;
	encoding_error_handler?: 'strict' | 'ignore' | 'replace';
}

export interface HttpMCPConfig {
	type: 'http_mcp';
	url: string;
	headers?: Record<string, string> | null;
	timeout?: number | null;
}

export interface MCPClient {
	name: string;
	is_stateful: boolean;
	mcp_config: StdioMCPConfig | HttpMCPConfig;
}

export interface ToolInfo {
	name: string;
	description?: string | null;
}

export interface MCPClientStatus extends MCPClient {
	is_healthy: boolean;
	tools: ToolInfo[];
}

// ─── Skill ────────────────────────────────────────────────────────────────────

export interface Skill {
	name: string;
	description: string;
	dir: string;
	markdown: string;
	updated_at: number;
}

export interface AddSkillRequest {
	skill_path: string;
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export type PermissionMode =
	| 'default'
	| 'accept_edits'
	| 'explore'
	| 'bypass'
	| 'dont_ask'
	| (string & {});

export type ScheduleSource = 'USER' | 'AGENT';

export interface ScheduleData {
	name: string;
	description: string;
	enabled: boolean;
	timezone: string;
	cron_expression: string;
	started_at: string;
	ended_at: string | null;
	chat_model_config: ChatModelConfig;
	stateful: boolean;
	permission_mode: PermissionMode;
	source: ScheduleSource;
	source_session_id: string;
}

export interface ScheduleRecord extends RecordBase {
	user_id: string;
	agent_id: string;
	data: ScheduleData;
}

export interface CreateScheduleRequest {
	name: string;
	description?: string;
	cron_expression: string;
	timezone?: string;
	agent_id: string;
	chat_model_config: ChatModelConfig;
	enabled?: boolean;
	stateful?: boolean;
	permission_mode?: PermissionMode;
}

export interface CreateScheduleResponse {
	schedule_id: string;
}

export interface UpdateScheduleRequest {
	name?: string;
	description?: string;
	cron_expression?: string;
	timezone?: string;
	enabled?: boolean;
	stateful?: boolean;
	permission_mode?: PermissionMode;
}

export interface ScheduleListResponse {
	schedules: ScheduleRecord[];
	total: number;
}

// ─── Model ────────────────────────────────────────────────────────────────────

export interface ModelCard {
	type: 'chat_model';
	name: string;
	label: string;
	status: 'active' | 'deprecated' | 'sunset';
	deprecated_at: string | null;
	input_types: string[];
	output_types: string[];
	context_size: number;
	output_size: number;
	parameter_schema: Record<string, unknown>;
	parameters_overrides: Record<string, Record<string, unknown>>;
}

export interface ListModelRequest {
	provider: string;
}

export interface ListModelResponse {
	models: ModelCard[];
	total: number;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

export interface EmbeddingModelConfig {
	type: string;
	credential_id: string;
	model: string;
	/**
	 * Output vector dimensions, pinned at config time. Required because
	 * the backend uses it to size the vector store collection and to
	 * validate against the manager's `DimensionPolicy`.
	 */
	dimensions: number;
	parameters: Record<string, unknown>;
}

export interface EmbeddingModelCard {
	type: 'embedding_model';
	name: string;
	label: string;
	status: 'active' | 'deprecated' | 'sunset';
	input_types: string[];
	output_types: string[];
	context_size: number | null;
	/** Default output dimensions for this model. */
	dimensions: number;
	/**
	 * If set, the only dimensions this model can produce (Matryoshka).
	 * `null` means the model is fixed-dim at `dimensions`.
	 */
	supported_dimensions: number[] | null;
	parameter_schema: Record<string, unknown>;
	parameter_overrides: Record<string, Record<string, unknown>>;
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

/**
 * Knowledge base view as exposed by the API. Mirrors
 * :class:`agentscope.app._service.KnowledgeBaseView`.
 */
export interface KnowledgeBaseView {
	id: string;
	name: string;
	description: string;
	embedding_model_config: EmbeddingModelConfig;
	created_at: string;
	updated_at: string;
	/**
	 * Whether the current viewer may modify this knowledge base (edit
	 * metadata, add/delete documents). `false` for knowledge bases
	 * shared with read-only permission.
	 */
	editable: boolean;
}

export interface ListKnowledgeBasesResponse {
	knowledge_bases: KnowledgeBaseView[];
	total: number;
}

export interface CreateKnowledgeBaseRequest {
	name: string;
	description?: string;
	embedding_model_config: EmbeddingModelConfig;
}

export interface CreateKnowledgeBaseResponse {
	knowledge_base_id: string;
}

/**
 * Body for `PATCH /knowledge_bases/{id}`. Only mutable fields can be
 * sent; the embedding model is pinned at creation time and cannot
 * change because the underlying collection is sized to its dimension.
 */
export interface UpdateKnowledgeBaseRequest {
	name?: string;
	description?: string;
}

/**
 * Lifecycle states a document can be in. Mirrors
 * :class:`agentscope.app.storage.KnowledgeDocumentStatus`.
 *
 * - `pending` — accepted, blob stored, indexing not yet started.
 * - `parsing` / `chunking` / `indexing` — worker phases.
 * - `ready` — chunks committed to the vector store.
 * - `error` — terminal failure; `error` field carries the reason.
 */
export type KnowledgeDocumentStatus =
	| 'pending'
	| 'parsing'
	| 'chunking'
	| 'indexing'
	| 'ready'
	| 'error';

/**
 * Document view returned by `/knowledge_bases/{id}/documents` and
 * `/knowledge_bases/{id}/documents/status`. Mirrors
 * :class:`agentscope.app._router._schema.KnowledgeDocumentView`.
 */
export interface KnowledgeDocumentView {
	id: string;
	filename: string;
	size: number;
	content_type: string | null;
	status: KnowledgeDocumentStatus;
	error: string | null;
	chunk_count: number;
	created_at: string;
	updated_at: string;
}

export interface ListKnowledgeDocumentsResponse {
	documents: KnowledgeDocumentView[];
	total: number;
}

export interface ListKnowledgeDocumentStatusResponse {
	items: KnowledgeDocumentView[];
}

export interface UploadKnowledgeDocumentResponse {
	document_id: string;
	filename: string;
	status: KnowledgeDocumentStatus;
}

export interface SearchKnowledgeBaseRequest {
	query: string;
	top_k?: number;
}

/**
 * Lightweight chunk shape returned inside `VectorSearchResult`. Mirrors
 * :class:`agentscope.rag.Chunk` — content is the raw `TextBlock` /
 * `DataBlock` discriminated union the backend ships.
 */
export interface KnowledgeChunk {
	content: { type: 'text'; text: string; id?: string } | { type: string; [key: string]: unknown };
	source: string;
	chunk_index: number;
	total_chunks: number;
	metadata: Record<string, unknown>;
}

/**
 * One vector search hit returned by the knowledge base search endpoint.
 * Mirrors :class:`agentscope.rag.VectorSearchResult` on the backend.
 */
export interface VectorSearchResult {
	score: number;
	document_id: string;
	chunk: KnowledgeChunk;
}

export interface SearchKnowledgeBaseResponse {
	results: VectorSearchResult[];
	total: number;
}

/**
 * Mirrors :class:`agentscope.app.rag.knowledge_base_manager.DimensionPolicyKind`.
 */
export type DimensionPolicyKind = 'any' | 'fixed' | 'locked_by_existing';

/**
 * Mirrors :class:`agentscope.app.rag.knowledge_base_manager.DimensionPolicy`.
 */
export interface DimensionPolicy {
	kind: DimensionPolicyKind;
	dimension: number | null;
}

/** One credential and the embedding models it can serve, post-policy. */
export interface KbEmbeddingProvider {
	credential: CredentialView;
	models: EmbeddingModelCard[];
}

/**
 * Response of `GET /knowledge_bases/embedding_models`.
 *
 * Server-side already filtered models by the manager's
 * :class:`DimensionPolicy` and narrowed matryoshka cards to the
 * locked dimension when applicable. The policy is included so the
 * UI can render an explanatory banner.
 */
export interface ListKbEmbeddingModelsResponse {
	providers: KbEmbeddingProvider[];
	policy: DimensionPolicy;
}

/**
 * Session-level knowledge base attachment. Persisted on
 * :class:`SessionConfig.knowledge_config` and translated into a
 * `KnowledgeBaseMiddleware` at chat-run time.
 *
 * `parameters` holds the user-tunable middleware fields verbatim — its
 * accepted keys/values are described by the JSON Schema returned from
 * `GET /knowledge_bases/middleware/parameters_schema`.
 */
export interface SessionKnowledgeConfig {
	knowledge_base_ids: string[];
	parameters: Record<string, unknown>;
}

/** Response of `GET /knowledge_bases/middleware/parameters_schema`. */
export interface KbMiddlewareParametersSchemaResponse {
	parameter_schema: Record<string, unknown>;
}

/** Response of `GET /knowledge_bases/supported_content_types`. */
export interface ListSupportedContentTypesResponse {
	/** Union of IANA media types every registered parser handles. */
	media_types: string[];
	/** Union of filename extensions (each starting with `.`). */
	extensions: string[];
}

// ─── TTS ──────────────────────────────────────────────────────────────────────

export interface TTSModelCard {
	type: 'tts_model';
	name: string;
	label: string;
	status: 'active' | 'deprecated' | 'sunset';
	deprecated_at: string | null;
	input_types: string[];
	output_types: string[];
	realtime: boolean;
	parameter_schema: Record<string, unknown>;
	parameters_overrides: Record<string, Record<string, unknown>>;
}

export interface ListTTSModelResponse {
	models: TTSModelCard[];
	total: number;
}
