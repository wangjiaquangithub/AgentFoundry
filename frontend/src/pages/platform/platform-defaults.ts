import type { ApprovalFormState } from './components/ApprovalsPanel';
import type { MemberFormState } from './components/MembersPanel';

export type { ApprovalFormState, MemberFormState };

export interface PublishFormState {
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

export interface ApprovalFiltersState {
	status: string;
	tenant: string;
	user_id: string;
	agent_id: string;
	limit: string;
}

export interface AuditFiltersState {
	tenant: string;
	user_id: string;
	agent_id: string;
	tool_name: string;
	success: string;
	limit: string;
}

export interface ConnectorTestFormState {
	base_url: string;
	token: string;
	tenant: string;
	policy_keyword: string;
	ticket_id: string;
	department: string;
	policy_path: string;
	ticket_path: string;
	metrics_path: string;
	timeout_seconds: string;
	enabled: boolean;
}

export const enterpriseToolInputConfig: Record<
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

export const agentSampleQuestions = [
	'请查询 remote 政策、INC-1001 工单状态，并总结 engineering 部门指标。',
	'帮我查一下 INC-1001 的工单状态',
	'远程办公制度怎么说？',
	'总结 engineering 部门指标',
];

export const defaultAgentQuestion = '帮我查一下 INC-1001 的工单状态';

export const defaultSelectedToolName = 'enterprise_lookup_policy';

export const defaultToolInputs: Record<string, string> = {
	enterprise_lookup_policy: 'remote',
	enterprise_get_ticket_status: 'INC-1001',
	enterprise_summarize_department_metrics: 'engineering',
};

export const defaultSelectedWorkflowType = 'daily_ops_brief';

export const defaultApprovalForm: ApprovalFormState = {
	request_type: 'tool_run',
	tool_name: 'enterprise_lookup_policy',
	workflow_type: 'daily_ops_brief',
	input_key: 'keyword',
	input_value: 'remote',
	reason: '需要审批后调用企业工具',
	user_id: '',
	agent_id: '',
};

export const defaultApprovalFilters: ApprovalFiltersState = {
	status: '',
	tenant: '',
	user_id: '',
	agent_id: '',
	limit: '20',
};

export const defaultMemberForm: MemberFormState = {
	user_id: '',
	tenant: 'acme',
	display_name: '',
	role: '',
	status: 'active',
};

export const defaultConnectorTestForm: ConnectorTestFormState = {
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
};

export const defaultAuditFilters: AuditFiltersState = {
	tenant: '',
	user_id: '',
	agent_id: '',
	tool_name: '',
	success: '',
	limit: '50',
};

export const defaultPublishForm: PublishFormState = {
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
};
