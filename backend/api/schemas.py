"""Request schemas for the AgentFoundry platform API."""

from typing import Any

from pydantic import BaseModel, Field


class EnterprisePlatformMemberUpsertRequest(BaseModel):
    user_id: str
    tenant: str | None = None
    display_name: str | None = None
    role: str | None = None
    status: str | None = None


class EnterprisePlatformMemberPatchRequest(BaseModel):
    tenant: str | None = None
    display_name: str | None = None
    role: str | None = None
    status: str | None = None
    sample_questions: list[str] | None = None


class EnterpriseToolPolicyUpdateRequest(BaseModel):
    tenant: str
    user_id: str
    allow: list[str] = Field(default_factory=list)
    deny: list[str] = Field(default_factory=list)


class EnterpriseConnectorConfigSaveRequest(BaseModel):
    base_url: str
    token: str | None = None
    tenant: str
    policy_path: str = ""
    ticket_path: str = ""
    metrics_path: str = ""
    timeout_seconds: int = 10
    enabled: bool = True


class EnterpriseConnectorTestRequest(BaseModel):
    base_url: str
    token: str | None = None
    tenant: str
    policy_keyword: str
    ticket_id: str
    department: str
    policy_path: str = ""
    ticket_path: str = ""
    metrics_path: str = ""
    timeout_seconds: int = 10


class EnterprisePlatformConfigImportRequest(BaseModel):
    mode: str = "merge"
    config: dict[str, Any] = Field(default_factory=dict)


class EnterpriseAgentPublishRequest(BaseModel):
    template_id: str
    name: str | None = None
    description: str | None = None
    tenant: str | None = None
    tools: list[str] | None = None
    knowledge_base_ids: list[str] | None = None
    model_config_id: str | None = None
    memory_enabled: bool = False
    workflow_enabled: bool = False
    allowed_user_ids: list[str] | None = None
    allowed_roles: list[str] | None = None


class EnterpriseAgentUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    tenant: str | None = None
    tools: list[str] | None = None
    knowledge_base_ids: list[str] | None = None
    model_config_id: str | None = None
    memory_enabled: bool | None = None
    workflow_enabled: bool | None = None
    allowed_user_ids: list[str] | None = None
    allowed_roles: list[str] | None = None
    status: str | None = None


class EnterpriseToolRunRequest(BaseModel):
    tool_name: str
    inputs: dict[str, Any] = Field(default_factory=dict)
    user_id: str | None = None
    agent_id: str | None = None
    approval_id: str | None = None


class EnterpriseAgentRunRequest(BaseModel):
    question: str
    agent_id: str | None = None
    user_id: str | None = None
    session_id: str | None = None
    approval_id: str | None = None


class EnterpriseKnowledgeIngestRequest(BaseModel):
    knowledge_base_id: str
    title: str
    text: str
    tenant: str | None = None
    source_type: str = "text"
    source_uri: str | None = None
    object_ref: str | None = None
    document_id: str | None = None


class EnterpriseKnowledgeReadinessRequest(BaseModel):
    knowledge_base_ids: list[str]
    tenant: str | None = None


class EnterpriseKnowledgeDocumentsRequest(BaseModel):
    knowledge_base_id: str | None = None
    status: str | None = None
    tenant: str | None = None
    limit: int = Field(default=50, ge=1, le=100)


class EnterpriseKnowledgeDocumentDetailRequest(BaseModel):
    document_id: str
    tenant: str | None = None
    include_chunks: bool = True
    chunk_limit: int = Field(default=100, ge=1, le=200)


class EnterpriseWorkflowTemplateUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    enabled: bool | None = None
    default_inputs: dict[str, Any] | None = None


class EnterpriseApprovalCreateRequest(BaseModel):
    request_type: str
    tool_name: str | None = None
    workflow_type: str | None = None
    inputs: dict[str, Any] = Field(default_factory=dict)
    reason: str | None = None
    agent_id: str | None = None
    user_id: str | None = None


class EnterpriseApprovalDecisionRequest(BaseModel):
    decision_note: str | None = None
    decided_by: str | None = None


class EnterpriseWorkflowRunRequest(BaseModel):
    workflow_type: str
    inputs: dict[str, Any] = Field(default_factory=dict)
    agent_id: str | None = None
    user_id: str | None = None
    approval_id: str | None = None
