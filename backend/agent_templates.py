# -*- coding: utf-8 -*-
"""Enterprise agent and sub-agent template definitions."""
from __future__ import annotations

from agentscope.app import SubAgentTemplate
from agentscope.permission import PermissionContext, PermissionMode

from permissions import ENTERPRISE_TOOL_NAMES


ENTERPRISE_SUBAGENT_TEMPLATES = [
    SubAgentTemplate(
        type="policy_researcher",
        description=(
            "A read-only enterprise researcher for policy, knowledge-base, "
            "and ticket investigation."
        ),
        system_prompt_template="""You are {member_name}, an enterprise \
policy researcher in team '{team_name}' led by {leader_name}.

Team purpose: {team_description}
Your role: {member_description}

Work only from the tenant-scoped tools, attached knowledge bases, and readable \
workspace files. Cite which source or tool result supports each conclusion. \
Do not modify files or external systems. Report your findings back to \
{leader_name} with TeamSay.""",
        permission_context=PermissionContext(
            mode=PermissionMode.EXPLORE,
        ),
        override_leader_mode=True,
    ),
    SubAgentTemplate(
        type="workflow_operator",
        description=(
            "A controlled worker for drafting workflow steps, runbooks, "
            "and automation plans inside the approved workspace."
        ),
        system_prompt_template="""You are {member_name}, a workflow \
operator in team '{team_name}' led by {leader_name}.

Team purpose: {team_description}
Your role: {member_description}

Turn the leader's business goal into concrete operating steps, checklists, or \
draft artifacts. Keep tenant boundaries strict. Use tools only when their \
scope is clear, and report every material action back to {leader_name} with \
TeamSay.""",
        permission_context=PermissionContext(
            mode=PermissionMode.ACCEPT_EDITS,
        ),
    ),
]

ENTERPRISE_AGENT_TEMPLATES = [
    {
        "id": "weather_forecast_assistant",
        "name": "天气预报助手",
        "description": "调用真实天气服务查询城市天气并生成中文出行建议。",
        "tools": ["enterprise_get_weather_forecast"],
        "capabilities": ["weather_forecast"],
    },
    {
        "id": "enterprise_knowledge_assistant",
        "name": "企业知识助手",
        "description": "面向员工问答、制度查询、工单状态和部门指标的业务助手。",
        "tools": ENTERPRISE_TOOL_NAMES,
        "capabilities": [
            "knowledge_qa",
            "ticket_lookup",
            "policy_lookup",
            "metrics_summary",
        ],
    },
    {
        "id": "customer_support_assistant",
        "name": "智能客服助手",
        "description": "处理客户请求、查询工单和沉淀服务审计记录。",
        "tools": [
            "enterprise_get_ticket_status",
            "enterprise_lookup_policy",
        ],
        "capabilities": [
            "ticket_lookup",
            "policy_lookup",
            "customer_reply",
        ],
    },
    {
        "id": "data_analysis_assistant",
        "name": "数据分析助手",
        "description": "查询部门指标并生成可审计的分析摘要。",
        "tools": ["enterprise_summarize_department_metrics"],
        "capabilities": [
            "metrics_summary",
            "analysis_report",
        ],
    },
    {
        "id": "uat-leave-assistant",
        "name": "请假助手",
        "description": "帮助员工查询假期余额、检查日期冲突、发起请假申请并跟踪审批状态。",
        "tools": [
            "enterprise_get_leave_balance",
            "enterprise_check_leave_conflict",
            "enterprise_prepare_leave_request",
            "enterprise_submit_leave_request",
        ],
        "capabilities": [
            "leave_balance",
            "leave_conflict",
            "leave_request",
        ],
    },
    {
        "id": "uat-report-assistant",
        "name": "报表助手",
        "description": "帮助员工查询受治理报表，理解数据范围并申请导出。",
        "tools": [
            "enterprise_list_available_reports",
            "enterprise_describe_report",
            "enterprise_query_report",
            "enterprise_export_report",
        ],
        "capabilities": [
            "report_list",
            "report_query",
            "report_export",
        ],
    },
]
