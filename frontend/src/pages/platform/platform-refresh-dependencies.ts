type RefreshHandler = () => void | Promise<void>;

export type PlatformRefreshDependencyHandlers = {
	refetchPlatform: RefreshHandler;
	refetchMembers: RefreshHandler;
	refetchConnectors: RefreshHandler;
	refetchGovernance: RefreshHandler;
	refetchPlatformAgents: RefreshHandler;
	refetchToolCatalog: RefreshHandler;
	refetchWorkflowTemplates: RefreshHandler;
	refetchPlatformConfigExport: RefreshHandler;
	refetchOpsTasks: RefreshHandler;
	refetchAuditEvents: RefreshHandler;
	refetchWorkflowRuns: RefreshHandler;
	refetchScenarios: RefreshHandler;
};

export function createPlatformRefreshDependencyHandlers(
	handlers: PlatformRefreshDependencyHandlers,
) {
	async function refetchPlatformConfigImportDependencies() {
		await Promise.all([
			handlers.refetchPlatform(),
			handlers.refetchMembers(),
			handlers.refetchConnectors(),
			handlers.refetchGovernance(),
			handlers.refetchPlatformAgents(),
			handlers.refetchToolCatalog(),
			handlers.refetchWorkflowTemplates(),
			handlers.refetchPlatformConfigExport(),
		]);
	}

	async function refreshMemberDependentViews() {
		await Promise.all([
			handlers.refetchMembers(),
			handlers.refetchGovernance(),
			handlers.refetchToolCatalog(),
			handlers.refetchPlatformAgents(),
		]);
	}

	async function refetchConnectorConfigDependencies() {
		await handlers.refetchConnectors();
		await handlers.refetchGovernance();
		await handlers.refetchOpsTasks();
	}

	async function refetchAgentManagementDependencies() {
		await handlers.refetchPlatformAgents();
		await handlers.refetchPlatform();
		await handlers.refetchToolCatalog();
		await handlers.refetchOpsTasks();
	}

	async function refetchRuntimeRunDependencies() {
		await handlers.refetchPlatform();
		await handlers.refetchToolCatalog();
		await handlers.refetchAuditEvents();
		await handlers.refetchOpsTasks();
	}

	async function refetchWorkflowRunDependencies() {
		await refetchRuntimeRunDependencies();
		await handlers.refetchWorkflowRuns();
		await handlers.refetchScenarios();
	}

	async function refetchApprovalDependencies() {
		await handlers.refetchGovernance();
		await handlers.refetchOpsTasks();
	}

	async function refetchToolPolicyDependencies() {
		await Promise.all([
			handlers.refetchPlatform(),
			handlers.refetchGovernance(),
			handlers.refetchToolCatalog(),
		]);
		await handlers.refetchOpsTasks();
	}

	async function refetchWorkflowTemplateDependencies() {
		await handlers.refetchPlatform();
		await handlers.refetchScenarios();
		await handlers.refetchOpsTasks();
	}

	async function refetchOpsTaskResolveDependencies() {
		await handlers.refetchPlatform();
		await handlers.refetchScenarios();
	}

	return {
		refetchAgentManagementDependencies,
		refetchApprovalDependencies,
		refetchConnectorConfigDependencies,
		refetchOpsTaskResolveDependencies,
		refetchPlatformConfigImportDependencies,
		refetchRuntimeRunDependencies,
		refetchToolPolicyDependencies,
		refetchWorkflowRunDependencies,
		refetchWorkflowTemplateDependencies,
		refreshMemberDependentViews,
	};
}
