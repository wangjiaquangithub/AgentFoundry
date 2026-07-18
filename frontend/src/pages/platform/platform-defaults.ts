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

export const defaultMemberForm: MemberFormState = {
	user_id: '',
	tenant: 'acme',
	display_name: '',
	role: '',
	status: 'active',
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
