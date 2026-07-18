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

export const selectedToolRunnerLabels = (t: PlatformTranslate) => ({
	notConfiguredForAgent: t('platform.toolRunner.notConfiguredForAgent'),
});

export const agentRoutingLabels = (t: PlatformTranslate) => ({
	model: t('platform.agentRunner.routingModel'),
	rules: t('platform.agentRunner.routingRules'),
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

export const workflowOperationsLabels = (t: PlatformTranslate) => ({
	templates: t('platform.workflowOps.templates'),
	enabled: t('platform.workflowOps.enabled'),
	runs: t('platform.workflowOps.runs'),
	approvals: t('platform.workflowOps.approvals'),
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
