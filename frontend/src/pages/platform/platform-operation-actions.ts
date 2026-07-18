export type PlatformOperationActionHandlers = {
	scrollToAgentManagement: () => void;
	scrollToConnectorCenter: () => void;
	scrollToGovernance: () => void;
	scrollToWorkflowRunner: () => void;
	scrollToToolRunner: () => void;
	scrollToMemoryOperations: () => void;
	navigate: (path: string) => void;
};

export function runPlatformOperationAction(
	target: string | undefined,
	handlers: PlatformOperationActionHandlers,
) {
	switch (target) {
		case 'agents':
			handlers.scrollToAgentManagement();
			return;
		case 'connectors':
			handlers.scrollToConnectorCenter();
			return;
		case 'governance':
		case 'approvals':
		case 'audit':
			handlers.scrollToGovernance();
			return;
		case 'credentials':
			handlers.navigate('/credential');
			return;
		case 'knowledge':
			handlers.navigate('/knowledge');
			return;
		case 'workflows':
			handlers.scrollToWorkflowRunner();
			return;
		case 'tools':
			handlers.scrollToToolRunner();
			return;
		case 'memory':
			handlers.scrollToMemoryOperations();
			return;
		default:
			handlers.scrollToGovernance();
	}
}
