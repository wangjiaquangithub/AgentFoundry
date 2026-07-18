type NavigationHandler = () => void;
type NavigateHandler = (path: string) => void;

export type PlatformNavigationActionHandlers = {
	navigate: NavigateHandler;
	handleStartPublishing: NavigationHandler;
	handleQuickPublishAgent: () => void | Promise<void>;
	scrollToAgentRunner: NavigationHandler;
	scrollToConfigManagement: NavigationHandler;
	scrollToConnectorCenter: NavigationHandler;
	scrollToGovernance: NavigationHandler;
	scrollToMemoryOperations: NavigationHandler;
	scrollToMembers: NavigationHandler;
	scrollToToolRunner: NavigationHandler;
	scrollToWorkflowRunner: NavigationHandler;
};

export function launchpadNavigationActions(
	handlers: PlatformNavigationActionHandlers,
) {
	return {
		members: handlers.scrollToMembers,
		credentials: () => handlers.navigate('/credential'),
		agents: handlers.handleStartPublishing,
		knowledge: () => handlers.navigate('/knowledge'),
		run: handlers.scrollToAgentRunner,
		tools: handlers.scrollToToolRunner,
		memory: handlers.scrollToMemoryOperations,
		connectors: handlers.scrollToConnectorCenter,
		governance: handlers.scrollToGovernance,
		workflows: handlers.scrollToWorkflowRunner,
	};
}

export function capabilityNavigationActions(
	handlers: PlatformNavigationActionHandlers,
) {
	return {
		credentials: () => handlers.navigate('/credential'),
		knowledge: () => handlers.navigate('/knowledge'),
		agents: handlers.handleStartPublishing,
		tools: handlers.scrollToToolRunner,
		workflows: handlers.scrollToWorkflowRunner,
		tenants: handlers.scrollToMembers,
		governance: handlers.scrollToGovernance,
		config: handlers.scrollToConfigManagement,
	};
}

export function platformConsoleNavigationActions(
	handlers: PlatformNavigationActionHandlers,
) {
	return {
		agents: handlers.handleStartPublishing,
		resources: handlers.scrollToConnectorCenter,
		run: handlers.scrollToAgentRunner,
		governance: handlers.scrollToGovernance,
	};
}

export function workbenchIndicatorNavigationActions(
	handlers: PlatformNavigationActionHandlers,
) {
	return {
		agents: handlers.scrollToAgentRunner,
		approvals: handlers.scrollToGovernance,
		workflows: handlers.scrollToWorkflowRunner,
		memory: handlers.scrollToMemoryOperations,
	};
}

export function workbenchPrimaryNavigationActions(
	handlers: PlatformNavigationActionHandlers,
) {
	return {
		run: handlers.scrollToAgentRunner,
		publish: handlers.handleStartPublishing,
		workflow: handlers.scrollToWorkflowRunner,
		governance: handlers.scrollToGovernance,
		memory: handlers.scrollToMemoryOperations,
	};
}

export function workbenchReadinessNavigationActions(
	handlers: PlatformNavigationActionHandlers,
) {
	return {
		credentials: () => handlers.navigate('/credential'),
		knowledge: () => handlers.navigate('/knowledge'),
		connectors: handlers.scrollToConnectorCenter,
		members: handlers.scrollToMembers,
		agents: handlers.handleStartPublishing,
		workflows: handlers.scrollToWorkflowRunner,
	};
}

export function workbenchRiskNavigationActions(
	handlers: PlatformNavigationActionHandlers,
) {
	return {
		governance: handlers.scrollToGovernance,
		connectors: handlers.scrollToConnectorCenter,
		workflows: handlers.scrollToWorkflowRunner,
		agents: handlers.handleStartPublishing,
	};
}

export function workbenchQuickNavigationActions(
	handlers: PlatformNavigationActionHandlers,
) {
	return {
		connectors: handlers.scrollToConnectorCenter,
		publish: handlers.handleStartPublishing,
		run: handlers.scrollToAgentRunner,
		workflow: handlers.scrollToWorkflowRunner,
		governance: handlers.scrollToGovernance,
		tools: handlers.scrollToToolRunner,
	};
}

export function rolloutPathNavigationActions(
	handlers: PlatformNavigationActionHandlers,
) {
	return {
		model: () => handlers.navigate('/credential'),
		knowledge: () => handlers.navigate('/knowledge'),
		agent: handlers.handleStartPublishing,
		run: handlers.scrollToAgentRunner,
		governance: handlers.scrollToGovernance,
		config: handlers.scrollToConfigManagement,
	};
}

export function firstAgentGuideNavigationActions(
	handlers: PlatformNavigationActionHandlers,
) {
	return {
		model: () => handlers.navigate('/credential'),
		agent: () => void handlers.handleQuickPublishAgent(),
		run: handlers.scrollToAgentRunner,
		governance: handlers.scrollToGovernance,
	};
}

export function orchestrationWorkbenchNavigationActions(
	handlers: PlatformNavigationActionHandlers,
	options: {
		handleNextAgentSetupStep: NavigationHandler;
		hasKnowledgeBases: boolean;
		hasSelectedRunAgent: boolean;
	},
) {
	return {
		template: handlers.handleStartPublishing,
		model: () => handlers.navigate('/credential'),
		knowledge: options.hasKnowledgeBases
			? options.handleNextAgentSetupStep
			: () => handlers.navigate('/knowledge'),
		tools: options.handleNextAgentSetupStep,
		policy: options.handleNextAgentSetupStep,
		publish: handlers.handleStartPublishing,
		operate: options.hasSelectedRunAgent
			? handlers.scrollToAgentRunner
			: handlers.scrollToWorkflowRunner,
	};
}
