type PlatformTranslate = (key: string, options?: Record<string, unknown>) => string;

export const platformOverviewStatLabels = (t: PlatformTranslate) => ({
	label: (key: string) => t(`platform.stats.${key}`),
	helper: (key: string) => t(`platform.stats.${key}Helper`),
});

export const runtimeStatusLabels = (t: PlatformTranslate) => ({
	label: (key: string) => t(`platform.runtime.${key}`),
	unavailable: t('platform.runtime.unavailable'),
	enabled: t('platform.runtime.enabled'),
	disabled: t('platform.runtime.disabled'),
});

export const platformConnectionLabels = (t: PlatformTranslate) => ({
	notConfigured: t('platform.connection.notConfigured'),
	anonymous: t('platform.connection.anonymous'),
});

export const platformRuntimeConfigLabels = (t: PlatformTranslate) => ({
	unavailable: t('platform.runtime.unavailable'),
});

export const selectedToolRunnerLabels = (t: PlatformTranslate) => ({
	notConfiguredForAgent: t('platform.toolRunner.notConfiguredForAgent'),
});

export const toolRunnerRequestLabels = (t: PlatformTranslate) => ({
	approvalRequiredCreated: t('platform.toolRunner.approvalRequiredCreated'),
});

export const agentRoutingLabels = (t: PlatformTranslate) => ({
	model: t('platform.agentRunner.routingModel'),
	rules: t('platform.agentRunner.routingRules'),
});

export const agentRunnerLabels = (t: PlatformTranslate) => ({
	noneConfigured: t('platform.agentManagement.noneConfigured'),
	noSelectedAgent: t('platform.agentManagement.noSelectedAgent'),
	readiness: (state: string) => t(`platform.agentManagement.readiness.${state}`),
	connectorSourceSaved: t('platform.agentRunner.connectorSourceSaved'),
	connectorSourceGlobal: t('platform.agentRunner.connectorSourceGlobal'),
	toolCallCount: (count: number) => t('platform.agentRunner.toolCallCount', { count }),
	notRouted: t('platform.agentRunner.notRouted'),
});

export const agentRunnerRequestLabels = (t: PlatformTranslate) => ({
	historyLoadError: t('platform.agentRunner.historyLoadError'),
	historyClearError: t('platform.agentRunner.historyClearError'),
	accessDenied: t('platform.agentRunner.accessDenied'),
	approvalRequiredCreated: t('platform.agentRunner.approvalRequiredCreated'),
});

export const agentManagementRequestLabels = (t: PlatformTranslate) => ({
	loadError: t('platform.agentManagement.loadError'),
	updateError: t('platform.agentManagement.updateError'),
	publishError: t('platform.agentManagement.publishError'),
	archiveError: t('platform.agentManagement.archiveError'),
	bindModelError: t('platform.agentManagement.bindModelError'),
	bindKnowledgeError: t('platform.agentManagement.bindKnowledgeError'),
	bindToolsError: t('platform.agentManagement.bindToolsError'),
	enableMemoryError: t('platform.agentManagement.enableMemoryError'),
	enableWorkflowError: t('platform.agentManagement.enableWorkflowError'),
});

export const approvalRequestLabels = (t: PlatformTranslate) => ({
	loadError: t('platform.approvals.loadError'),
	createError: t('platform.approvals.createError'),
	runApprovalReason: t('platform.approvals.runApprovalReason'),
	approved: t('platform.approvals.approved'),
	rejected: t('platform.approvals.rejected'),
	decisionError: t('platform.approvals.decisionError'),
	approveAndRunError: t('platform.approvals.approveAndRunError'),
	agentToolApprovalReason: (values: { agent: string; tool: string }) =>
		t('platform.approvals.agentToolApprovalReason', values),
});

export const connectorOperationsLabels = (t: PlatformTranslate) => ({
	baseUrlRequired: t('platform.connectors.validationBaseUrlRequired'),
	baseUrlProtocol: t('platform.connectors.validationBaseUrlProtocol'),
	timeout: t('platform.connectors.validationTimeout'),
	policyPath: t('platform.connectors.validationPolicyPath'),
	ticketPath: t('platform.connectors.validationTicketPath'),
	metricsPath: t('platform.connectors.validationMetricsPath'),
	runtimeSavedConfig: t('platform.connectors.runtimeSavedConfig'),
	runtimeGlobal: t('platform.connectors.runtimeGlobal'),
});

export const connectorRequestLabels = (t: PlatformTranslate) => ({
	loadError: t('platform.connectors.loadError'),
	saveBaseUrlRequired: t('platform.connectors.saveBaseUrlRequired'),
	saveSuccessWithTenant: (tenant: string) =>
		t('platform.connectors.saveSuccessWithTenant', { tenant }),
	saveError: t('platform.connectors.saveError'),
	testBaseUrlRequired: t('platform.connectors.testBaseUrlRequired'),
	testError: t('platform.connectors.testError'),
	testBeforeSaveRequired: t('platform.connectors.testBeforeSaveRequired'),
});

export const configManagementRequestLabels = (t: PlatformTranslate) => ({
	loadError: t('platform.configManagement.loadError'),
	importSuccess: (values: { members: number; agents: number }) =>
		t('platform.configManagement.importSuccess', values),
	parseError: t('platform.configManagement.parseError'),
	importError: t('platform.configManagement.importError'),
});

export const memberRequestLabels = (t: PlatformTranslate) => ({
	loadError: t('platform.members.loadError'),
	userRequired: t('platform.members.userRequired'),
	saveError: t('platform.members.saveError'),
});

export const tenantGovernanceRequestLabels = (t: PlatformTranslate) => ({
	noIdentity: t('platform.tenantGovernance.noIdentity'),
	policySaved: t('platform.tenantGovernance.policySaved'),
	policySaveError: t('platform.tenantGovernance.policySaveError'),
});

export const toolCatalogRequestLabels = (t: PlatformTranslate) => ({
	loadError: t('platform.toolCatalog.loadError'),
});

export const scenarioRequestLabels = (t: PlatformTranslate) => ({
	loadError: t('platform.scenarios.loadError'),
});

export const opsTasksRequestLabels = (t: PlatformTranslate) => ({
	loadError: t('platform.opsTasks.loadError'),
	resolveError: t('platform.opsTasks.resolveError'),
});

export const dashboardTodoLabels = (t: PlatformTranslate) => ({
	model: t('platform.dashboard.todoModel'),
	agent: t('platform.dashboard.todoAgent'),
	agentReadiness: t('platform.dashboard.todoAgentReadiness'),
	approval: (count: number) => t('platform.dashboard.todoApproval', { count }),
	errors: t('platform.dashboard.todoErrors'),
});

export const appCenterOperationsLabels = (t: PlatformTranslate) => ({
	publishedTotal: t('platform.agentManagement.ops.publishedTotal'),
	publishedTotalHelper: t('platform.agentManagement.ops.publishedTotalHelper'),
	activeTotal: t('platform.agentManagement.ops.activeTotal'),
	activeTotalHelper: t('platform.agentManagement.ops.activeTotalHelper'),
	readyTotal: t('platform.agentManagement.ops.readyTotal'),
	readyTotalHelper: t('platform.agentManagement.ops.readyTotalHelper'),
	needsSetupTotal: t('platform.agentManagement.ops.needsSetupTotal'),
	needsSetupTotalHelper: ({ count }: { count: number }) =>
		t('platform.agentManagement.ops.needsSetupTotalHelper', { count }),
});

export const auditRequestLabels = (t: PlatformTranslate) => ({
	loadError: t('platform.audit.loadError'),
});

export const appCenterAgentDisplayLabels = (t: PlatformTranslate) => ({
	archivedIssue: t('platform.operations.archivedIssue'),
	missingIssue: t('platform.operations.missingIssue'),
	readyIssue: t('platform.operations.readyIssue'),
	noModel: t('platform.appCenter.noModel'),
	agentResources: (values: { model: string; knowledge: number; tools: number }) =>
		t('platform.appCenter.agentResources', values),
});

export const appCenterDetailResourceValueLabels = (t: PlatformTranslate) => ({
	noModel: t('platform.appCenter.noModel'),
	access: {
		restricted: ({ users, roles }: { users: number; roles: number }) =>
			t('platform.appCenter.restrictedAccess', { users, roles }),
		open: t('platform.appCenter.tenantAccess'),
	},
	runtime: {
		value: ({ memory, workflow }: { memory: string; workflow: string }) =>
			t('platform.appCenter.runtimeValue', { memory, workflow }),
		enabled: t('platform.agentManagement.enabled'),
		disabled: t('platform.agentManagement.disabled'),
	},
});

export const appCenterDetailResourcesLabels = (t: PlatformTranslate) => ({
	model: t('platform.appCenter.model'),
	knowledgeBases: t('platform.appCenter.knowledgeBases'),
	tools: t('platform.appCenter.tools'),
	runtime: t('platform.appCenter.runtime'),
	access: t('platform.appCenter.access'),
	none: t('platform.appCenter.none'),
	availableModels: (count: number) => t('platform.appCenter.availableModels', { count }),
	noModel: t('platform.appCenter.noModel'),
	availableKnowledgeBases: (count: number) =>
		t('platform.appCenter.availableKnowledgeBases', { count }),
	templateRuntime: t('platform.appCenter.templateRuntime'),
});

export const appCenterDetailHealthLabels = (t: PlatformTranslate) => ({
	missingModel: t('platform.dashboard.todoModel'),
	missingKnowledge: t('platform.agentManagement.noKnowledge'),
});

export const operationsHeadlineLabels = (t: PlatformTranslate) => ({
	empty: t('platform.operations.headlineEmpty'),
	needsWork: ({ count }: { count: number }) =>
		t('platform.operations.headlineNeedsWork', { count }),
	approvals: ({ count }: { count: number }) =>
		t('platform.operations.headlineApprovals', { count }),
	ready: t('platform.operations.headlineReady'),
});

export const agentReleasePipelineLabels = (t: PlatformTranslate) => ({
	template: t('platform.agentManagement.pipeline.template'),
	templateDetail: t('platform.agentManagement.pipeline.templateDetail'),
	model: t('platform.agentManagement.pipeline.model'),
	modelDetail: t('platform.agentManagement.pipeline.modelDetail'),
	knowledge: t('platform.agentManagement.pipeline.knowledge'),
	selectedKnowledge: ({ count }: { count: number }) =>
		t('platform.agentManagement.selectedKnowledge', { count }),
	knowledgeDetail: t('platform.agentManagement.pipeline.knowledgeDetail'),
	tools: t('platform.agentManagement.pipeline.tools'),
	toolsSelected: ({ count }: { count: number }) =>
		t('platform.agentManagement.wizard.toolsSelected', { count }),
	toolsDetail: t('platform.agentManagement.pipeline.toolsDetail'),
	runtime: t('platform.agentManagement.pipeline.runtime'),
	runtimeDetail: ({ memory, workflow }: { memory: string; workflow: string }) =>
		t('platform.agentManagement.wizard.runtimeDetail', { memory, workflow }),
	enabled: t('platform.agentManagement.enabled'),
	disabled: t('platform.agentManagement.disabled'),
	publish: t('platform.agentManagement.pipeline.publish'),
	publishDetailReady: ({ count }: { count: number }) =>
		t('platform.agentManagement.pipeline.publishDetailReady', { count }),
	publishDetail: t('platform.agentManagement.pipeline.publishDetail'),
	governance: t('platform.agentManagement.pipeline.governance'),
	governanceDetailPending: ({ count }: { count: number }) =>
		t('platform.agentManagement.pipeline.governanceDetailPending', { count }),
	governanceDetail: t('platform.agentManagement.pipeline.governanceDetail'),
});

export const agentSetupStepLabels = (t: PlatformTranslate) => ({
	templateTitle: t('platform.agentManagement.wizard.template'),
	templateMissing: t('platform.agentManagement.wizard.templateMissing'),
	modelTitle: t('platform.agentManagement.wizard.model'),
	modelMissing: t('platform.agentManagement.wizard.modelMissing'),
	noModel: t('platform.agentManagement.noModel'),
	knowledgeTitle: t('platform.agentManagement.wizard.knowledge'),
	selectedKnowledge: (count: number) =>
		t('platform.agentManagement.selectedKnowledge', { count }),
	knowledgeMissing: t('platform.agentManagement.wizard.knowledgeMissing'),
	noKnowledge: t('platform.agentManagement.noKnowledge'),
	toolsTitle: t('platform.agentManagement.wizard.tools'),
	toolsSelected: (count: number) =>
		t('platform.agentManagement.wizard.toolsSelected', { count }),
	toolsMissing: t('platform.agentManagement.wizard.toolsMissing'),
	runtimeTitle: t('platform.agentManagement.wizard.runtime'),
	runtimeDetail: (values: { memory: string; workflow: string }) =>
		t('platform.agentManagement.wizard.runtimeDetail', values),
	enabled: t('platform.agentManagement.enabled'),
	disabled: t('platform.agentManagement.disabled'),
});

export const publishDraftLabels = (t: PlatformTranslate) => ({
	noneConfigured: t('platform.agentManagement.noneConfigured'),
	accessOpen: t('platform.agentManagement.accessOpen'),
	accessRestricted: (values: { users: number; roles: number }) =>
		t('platform.agentManagement.releaseAccessRestricted', values),
	runtimeSummary: (values: { memory: string; workflow: string }) =>
		t('platform.agentManagement.releaseRuntimeSummary', values),
	enabled: t('platform.agentManagement.enabled'),
	disabled: t('platform.agentManagement.disabled'),
	missingModel: t('platform.agentManagement.releaseMissingModel'),
	noKnowledge: t('platform.agentManagement.releaseNoKnowledge'),
});

export const selectedIdentityLabels = (t: PlatformTranslate) => ({
	accessLabel: (key: string) => t(key),
});

export const workflowOperationsLabels = (t: PlatformTranslate) => ({
	templates: t('platform.workflowOps.templates'),
	enabled: t('platform.workflowOps.enabled'),
	runs: t('platform.workflowOps.runs'),
	approvals: t('platform.workflowOps.approvals'),
});

export const workflowRunnerRequestLabels = (t: PlatformTranslate) => ({
	templatesLoadError: t('platform.workflowRunner.templatesLoadError'),
	historyLoadError: t('platform.workflowRunner.historyLoadError'),
	approvalRequiredCreated: t('platform.workflowRunner.approvalRequiredCreated'),
});

export const workflowSelectionLabels = (t: PlatformTranslate) => ({
	fallbackLabel: (labelKey: string) => t(`platform.workflowRunner.${labelKey}`),
});

export const tenantWorkspaceOperationsLabels = (t: PlatformTranslate) => ({
	localSource: t('platform.tenantWorkspace.localSource'),
});

export const triggerOperationsStatLabels = (t: PlatformTranslate) => ({
	schedules: t('platform.triggerOps.schedules'),
	enabled: t('platform.triggerOps.enabled'),
	agentSource: t('platform.triggerOps.agentSource'),
	userSource: t('platform.triggerOps.userSource'),
});

export const triggerOperationsSummaryLabels = (t: PlatformTranslate) => ({
	manual: t('platform.triggerOps.summaryManual'),
	paused: t('platform.triggerOps.summaryPaused'),
	active: ({ count }: { count: number }) => t('platform.triggerOps.summaryActive', { count }),
});

export const auditStatsLabels = (t: PlatformTranslate) => ({
	returned: t('platform.audit.summaryReturned'),
	successes: t('platform.audit.summarySuccesses'),
	failures: t('platform.audit.summaryFailures'),
	avgDuration: t('platform.audit.summaryAvgDuration'),
});

export const launchpadStepLabels = (t: PlatformTranslate) => ({
	title: (key: string) => t(`platform.launchpad.${key}.title`),
	description: (key: string) => t(`platform.launchpad.${key}.description`),
	action: (key: string) => t(`platform.launchpad.${key}.action`),
});

export const platformConsoleItemLabels = (t: PlatformTranslate) => ({
	title: (key: string) => t(`platform.console.${key}`),
	description: (key: string) => t(`platform.console.${key}Description`),
	action: (key: string) => t(`platform.console.${key}Action`),
});

export const workbenchIndicatorLabels = (
	t: PlatformTranslate,
	values: { memoryOperationsSavedCount: number; memoryOperationsHitCount: number },
) => ({
	readyAgents: t('platform.workbench.indicators.readyAgents'),
	readyAgentsHelper: t('platform.workbench.indicators.readyAgentsHelper'),
	approvals: t('platform.workbench.indicators.approvals'),
	approvalsHelper: t('platform.workbench.indicators.approvalsHelper'),
	workflowRuns: t('platform.workbench.indicators.workflowRuns'),
	workflowRunsHelper: t('platform.workbench.indicators.workflowRunsHelper'),
	memory: t('platform.workbench.indicators.memory'),
	memoryHelper: t('platform.workbench.indicators.memoryHelper', {
		saved: values.memoryOperationsSavedCount,
		hits: values.memoryOperationsHitCount,
	}),
});

export const workbenchPrimaryActionLabels = (t: PlatformTranslate) => ({
	runTitle: t('platform.workbench.actions.run.title'),
	runDescriptionReady: (agent: string) =>
		t('platform.workbench.actions.run.descriptionReady', { agent }),
	runDescriptionEmpty: t('platform.workbench.actions.run.descriptionEmpty'),
	runAction: t('platform.workbench.actions.run.action'),
	runPublishAction: t('platform.workbench.actions.run.publishAction'),
	workflowTitle: t('platform.workbench.actions.workflow.title'),
	workflowDescription: (count: number) =>
		t('platform.workbench.actions.workflow.description', { count }),
	workflowAction: t('platform.workbench.actions.workflow.action'),
	governanceTitle: t('platform.workbench.actions.governance.title'),
	governanceDescription: (count: number) =>
		t('platform.workbench.actions.governance.description', { count }),
	governanceAction: t('platform.workbench.actions.governance.action'),
	memoryTitle: t('platform.workbench.actions.memory.title'),
	memoryDescription: (count: number) =>
		t('platform.workbench.actions.memory.description', { count }),
	memoryAction: t('platform.workbench.actions.memory.action'),
});

export const workbenchReadinessLabels = (t: PlatformTranslate) => ({
	title: (key: string) => t(`platform.workbench.readiness.${key}.title`),
	modelDescription: (count: number) =>
		t('platform.workbench.readiness.model.description', { count }),
	knowledgeDescription: (count: number) =>
		t('platform.workbench.readiness.knowledge.description', { count }),
	connectorsDescription: (count: number) =>
		t('platform.workbench.readiness.connectors.description', { count }),
	membersDescription: (count: number) =>
		t('platform.workbench.readiness.members.description', { count }),
	agentsDescription: (ready: number, total: number) =>
		t('platform.workbench.readiness.agents.description', { ready, total }),
	workflowsDescription: (count: number) =>
		t('platform.workbench.readiness.workflows.description', { count }),
});

export const workbenchRiskLabels = (t: PlatformTranslate) => ({
	errors: t('platform.workbench.risks.errors'),
	connectorDraft: (count: number) =>
		t('platform.workbench.risks.connectorDraft', { count }),
	approvals: (count: number) => t('platform.workbench.risks.approvals', { count }),
	workflowFailures: (count: number) =>
		t('platform.workbench.risks.workflowFailures', { count }),
	agents: t('platform.workbench.risks.agents'),
});

export const workbenchQuickActionLabels = (t: PlatformTranslate) => ({
	connectors: t('platform.workbench.quickActions.connectors'),
	publish: t('platform.workbench.quickActions.publish'),
	run: t('platform.workbench.quickActions.run'),
	workflow: t('platform.workbench.quickActions.workflow'),
	governance: t('platform.workbench.quickActions.governance'),
	tools: t('platform.workbench.quickActions.tools'),
});

export const rolloutPathStepLabels = (t: PlatformTranslate) => ({
	title: (key: string) => t(`platform.workbench.rolloutPath.steps.${key}.title`),
	description: (key: string) =>
		t(`platform.workbench.rolloutPath.steps.${key}.description`),
	action: (key: string) => t(`platform.workbench.rolloutPath.steps.${key}.action`),
});

export const firstAgentGuideStepLabels = (t: PlatformTranslate) => ({
	title: (key: string) => t(`platform.workbench.firstAgentGuide.steps.${key}.title`),
	action: (key: string) => t(`platform.workbench.firstAgentGuide.steps.${key}.action`),
	modelReady: (count: number) =>
		t('platform.workbench.firstAgentGuide.steps.model.ready', { count }),
	modelEmpty: t('platform.workbench.firstAgentGuide.steps.model.empty'),
	agentReady: (count: number) =>
		t('platform.workbench.firstAgentGuide.steps.agent.ready', { count }),
	agentPartial: (count: number) =>
		t('platform.workbench.firstAgentGuide.steps.agent.partial', { count }),
	agentEmpty: t('platform.workbench.firstAgentGuide.steps.agent.empty'),
	runReady: t('platform.workbench.firstAgentGuide.steps.run.ready'),
	runPartial: t('platform.workbench.firstAgentGuide.steps.run.partial'),
	runEmpty: t('platform.workbench.firstAgentGuide.steps.run.empty'),
	governanceReady: (count: number) =>
		t('platform.workbench.firstAgentGuide.steps.governance.ready', { count }),
	governancePending: (count: number) =>
		t('platform.workbench.firstAgentGuide.steps.governance.pending', { count }),
	governanceEmpty: t('platform.workbench.firstAgentGuide.steps.governance.empty'),
});

export const orchestrationWorkbenchStepLabels = (t: PlatformTranslate) => ({
	title: (key: string) => t(`platform.orchestration.${key}.title`),
	description: (key: string) => t(`platform.orchestration.${key}.description`),
	action: (key: string) => t(`platform.orchestration.${key}.action`),
	templateEmpty: t('platform.orchestration.template.empty'),
	modelReady: (count: number) => t('platform.orchestration.model.ready', { count }),
	modelEmpty: t('platform.orchestration.model.empty'),
	selectedKnowledge: (count: number) =>
		t('platform.agentManagement.selectedKnowledge', { count }),
	knowledgeReady: (count: number) =>
		t('platform.orchestration.knowledge.ready', { count }),
	toolsSelected: (count: number) =>
		t('platform.agentManagement.wizard.toolsSelected', { count }),
	toolsReady: (count: number) => t('platform.orchestration.tools.ready', { count }),
	policyDetail: (counts: { users: number; roles: number }) =>
		t('platform.orchestration.policy.detail', {
			users: counts.users,
			roles: counts.roles,
		}),
	publishReady: (count: number) =>
		t('platform.orchestration.publish.ready', { count }),
	publishEmpty: t('platform.orchestration.publish.empty'),
	operateReady: (count: number) =>
		t('platform.orchestration.operate.ready', { count }),
	operatePending: (count: number) =>
		t('platform.orchestration.operate.pending', { count }),
	operateEmpty: t('platform.orchestration.operate.empty'),
});

export const monitoringStatLabels = (t: PlatformTranslate) => ({
	agentRuns: t('platform.monitoring.agentRuns'),
	agentRunsHelper: t('platform.monitoring.agentRunsHelper'),
	workflowRuns: t('platform.monitoring.workflowRuns'),
	workflowRunsHelper: (counts: { completed: number; partial: number; failed: number }) =>
		t('platform.monitoring.workflowRunsHelper', counts),
	toolAudit: t('platform.monitoring.toolAudit'),
	toolAuditHelper: (counts: { success: number; failure: number }) =>
		t('platform.monitoring.toolAuditHelper', counts),
	pendingApprovals: t('platform.monitoring.pendingApprovals'),
	pendingApprovalsHelper: t('platform.monitoring.pendingApprovalsHelper'),
});

export const governanceAccessLabels = (t: PlatformTranslate) => ({
	identities: t('platform.accessControl.identities'),
	tenants: t('platform.accessControl.tenants'),
	riskyIdentities: t('platform.accessControl.riskyIdentities'),
	pendingApprovals: t('platform.accessControl.pendingApprovals'),
});

export const governanceHealthLabels = (t: PlatformTranslate) => ({
	tenants: t('platform.governanceHealth.tenants'),
	tenantsHelper: t('platform.governanceHealth.tenantsHelper'),
	identities: t('platform.governanceHealth.identities'),
	identitiesHelper: t('platform.governanceHealth.identitiesHelper'),
	pendingApprovals: t('platform.governanceHealth.pendingApprovals'),
	pendingApprovalsHelper: t('platform.governanceHealth.pendingApprovalsHelper'),
	auditEvents: t('platform.governanceHealth.auditEvents'),
	auditEventsHelper: t('platform.governanceHealth.auditEventsHelper'),
	auditEventsFailedHelper: ({ count }: { count: number }) =>
		t('platform.governanceHealth.auditEventsFailedHelper', { count }),
});
