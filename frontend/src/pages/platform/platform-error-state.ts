export type PlatformPageErrorSources = {
	agentsError: unknown;
	credentialsError: unknown;
	knowledgeError: unknown;
	schedulesError: unknown;
	platformError: unknown;
	connectorsError: unknown;
	governanceError: unknown;
	platformMembersError: unknown;
	platformAgentsError: unknown;
	toolCatalogError: unknown;
	auditError: unknown;
	workflowTemplatesError: unknown;
	workflowRunsError: unknown;
	scenariosError: unknown;
	opsTasksError: unknown;
	approvalError: unknown;
	platformConfigError: unknown;
	agentRunsError: unknown;
};

export function platformPageHasErrors(sources: PlatformPageErrorSources): boolean {
	return Object.values(sources).some(Boolean);
}
