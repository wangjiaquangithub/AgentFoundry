import {
	agentManagementRequestLabels,
	agentRunnerRequestLabels,
	approvalRequestLabels,
	auditRequestLabels,
	configManagementRequestLabels,
	connectorRequestLabels,
	memberRequestLabels,
	opsTasksRequestLabels,
	scenarioRequestLabels,
	tenantGovernanceRequestLabels,
	toolCatalogRequestLabels,
	toolRunnerRequestLabels,
	workflowRunnerRequestLabels,
} from './platform-labels';

type PlatformTranslate = (key: string, options?: Record<string, unknown>) => string;

export function createPlatformRequestTexts(t: PlatformTranslate) {
	return {
		agentManagementRequestText: agentManagementRequestLabels(t),
		agentRunnerRequestText: agentRunnerRequestLabels(t),
		approvalRequestText: approvalRequestLabels(t),
		auditRequestText: auditRequestLabels(t),
		configManagementRequestText: configManagementRequestLabels(t),
		connectorRequestText: connectorRequestLabels(t),
		memberRequestText: memberRequestLabels(t),
		opsTasksRequestText: opsTasksRequestLabels(t),
		scenarioRequestText: scenarioRequestLabels(t),
		tenantGovernanceRequestText: tenantGovernanceRequestLabels(t),
		toolCatalogRequestText: toolCatalogRequestLabels(t),
		toolRunnerRequestText: toolRunnerRequestLabels(t),
		workflowRunnerRequestText: workflowRunnerRequestLabels(t),
	};
}
