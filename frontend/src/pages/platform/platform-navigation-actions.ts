import type { EnterpriseAgentTemplate, EnterprisePublishedAgent } from '@/api';
import { runStartPublishingAction } from './platform-publish-form';
import {
	agentIsReady,
	type AgentRunnerNextStepMode,
	type AgentWizardStep,
} from './platform-utils';

type NavigationHandler = () => void;
type NavigateHandler = (path: string) => void;

export type AgentSetupStepAction =
	| { type: 'none' }
	| { type: 'template'; shouldConfigureDefault: boolean }
	| { type: 'navigate'; path: '/credential' | '/knowledge' }
	| { type: 'scroll-step' };

export type AppCenterPrimaryAction =
	| { type: 'navigate'; path: '/credential' }
	| { type: 'select-ready-agent'; agentId: string }
	| { type: 'quick-publish' }
	| { type: 'scroll-management' };

export type AppCenterDetailPrimaryAction =
	| { type: 'none' }
	| { type: 'select-agent'; agentId: string }
	| { type: 'edit-agent' }
	| { type: 'configure-template' };

export type AppCenterDetailSecondaryAction =
	| { type: 'edit-agent' }
	| { type: 'scroll-governance' };

export type NextStepPrimaryAction =
	| { type: 'navigate'; path: '/credential' }
	| { type: 'quick-publish' }
	| { type: 'scroll-management' }
	| { type: 'scroll-governance' }
	| { type: 'prime-runner' };

export function agentSetupStepAction(values: {
	nextStep: AgentWizardStep | null;
	hasSelectedTemplate: boolean;
	hasDefaultTemplate: boolean;
	credentialCount: number;
	knowledgeBaseCount: number;
}): AgentSetupStepAction {
	const { nextStep } = values;

	if (!nextStep) {
		return { type: 'none' };
	}

	if (nextStep.key === 'template') {
		return {
			type: 'template',
			shouldConfigureDefault:
				!values.hasSelectedTemplate && values.hasDefaultTemplate,
		};
	}

	if (nextStep.key === 'model' && values.credentialCount === 0) {
		return { type: 'navigate', path: '/credential' };
	}

	if (nextStep.key === 'knowledge' && values.knowledgeBaseCount === 0) {
		return { type: 'navigate', path: '/knowledge' };
	}

	return { type: 'scroll-step' };
}

export type AgentSetupStepActionHandlers = {
	configureDefaultTemplate: NavigationHandler;
	navigate: NavigateHandler;
	scrollToAgentManagement: NavigationHandler;
	scrollToCurrentStep: NavigationHandler;
};

export function runAgentSetupStepAction(
	action: AgentSetupStepAction,
	handlers: AgentSetupStepActionHandlers,
) {
	if (action.type === 'template') {
		if (action.shouldConfigureDefault) {
			handlers.configureDefaultTemplate();
		}
		handlers.scrollToAgentManagement();
		return;
	}

	if (action.type === 'navigate') {
		handlers.navigate(action.path);
		return;
	}

	if (action.type === 'scroll-step') {
		handlers.scrollToCurrentStep();
	}
}

export function runAgentSetupStepRequestAction(
	values: Parameters<typeof agentSetupStepAction>[0],
	handlers: AgentSetupStepActionHandlers,
) {
	runAgentSetupStepAction(agentSetupStepAction(values), handlers);
}

export type PlatformStartPublishingActionValues = {
	selectedTemplateId: string | null;
	templates: EnterpriseAgentTemplate[];
};

export type PlatformStartPublishingActionHandlers = {
	configureTemplate: (template: EnterpriseAgentTemplate) => void;
	scrollToAgentManagement: NavigationHandler;
};

export function runPlatformStartPublishingRequestAction(
	values: PlatformStartPublishingActionValues,
	handlers: PlatformStartPublishingActionHandlers,
) {
	runStartPublishingAction(values, {
		configureTemplate: handlers.configureTemplate,
		scrollToAgentManagement: () =>
			window.setTimeout(handlers.scrollToAgentManagement, 0),
	});
}

export type PlatformAgentSetupStepActionValues = {
	nextStep: AgentWizardStep | null;
	selectedTemplate?: EnterpriseAgentTemplate | null;
	defaultTemplate?: EnterpriseAgentTemplate | null;
	credentialCount: number;
	knowledgeBaseCount: number;
};

export type PlatformAgentSetupStepActionHandlers = {
	configureTemplate: (template: EnterpriseAgentTemplate) => void;
	navigate: NavigateHandler;
	scrollToAgentManagement: NavigationHandler;
};

export function runPlatformAgentSetupStepRequestAction(
	values: PlatformAgentSetupStepActionValues,
	handlers: PlatformAgentSetupStepActionHandlers,
) {
	runAgentSetupStepRequestAction(
		{
			nextStep: values.nextStep,
			hasSelectedTemplate: Boolean(values.selectedTemplate),
			hasDefaultTemplate: Boolean(values.defaultTemplate),
			credentialCount: values.credentialCount,
			knowledgeBaseCount: values.knowledgeBaseCount,
		},
		{
			configureDefaultTemplate: () => {
				if (values.defaultTemplate) {
					handlers.configureTemplate(values.defaultTemplate);
				}
			},
			navigate: handlers.navigate,
			scrollToAgentManagement: () =>
				window.setTimeout(handlers.scrollToAgentManagement, 0),
			scrollToCurrentStep: () => {
				values.nextStep?.ref.current?.scrollIntoView({
					behavior: 'smooth',
					block: 'center',
				});
			},
		},
	);
}

export function appCenterPrimaryAction(values: {
	credentialCount: number;
	readyAgentId?: string;
	activeAgentCount: number;
}): AppCenterPrimaryAction {
	if (values.credentialCount === 0) {
		return { type: 'navigate', path: '/credential' };
	}

	if (values.readyAgentId) {
		return { type: 'select-ready-agent', agentId: values.readyAgentId };
	}

	if (values.activeAgentCount === 0) {
		return { type: 'quick-publish' };
	}

	return { type: 'scroll-management' };
}

export function appCenterDetailPrimaryAction(values: {
	agentId?: string;
	agentIsReady: boolean;
	hasTemplate: boolean;
}): AppCenterDetailPrimaryAction {
	if (values.agentId) {
		return values.agentIsReady
			? { type: 'select-agent', agentId: values.agentId }
			: { type: 'edit-agent' };
	}

	if (values.hasTemplate) {
		return { type: 'configure-template' };
	}

	return { type: 'none' };
}

export function appCenterDetailSecondaryAction(values: {
	hasAgent: boolean;
}): AppCenterDetailSecondaryAction {
	return values.hasAgent ? { type: 'edit-agent' } : { type: 'scroll-governance' };
}

export function nextStepPrimaryAction(
	nextStepMode: AgentRunnerNextStepMode,
): NextStepPrimaryAction {
	if (nextStepMode === 'model') {
		return { type: 'navigate', path: '/credential' };
	}

	if (nextStepMode === 'publish') {
		return { type: 'quick-publish' };
	}

	if (nextStepMode === 'configure') {
		return { type: 'scroll-management' };
	}

	if (nextStepMode === 'governance') {
		return { type: 'scroll-governance' };
	}

	return { type: 'prime-runner' };
}

export type NextStepPrimaryActionHandlers = {
	navigate: NavigateHandler;
	handleQuickPublishAgent: () => void | Promise<void>;
	scrollToAgentManagement: NavigationHandler;
	scrollToGovernance: NavigationHandler;
	handlePrimeAgentRunner: NavigationHandler;
};

export function runNextStepPrimaryAction(
	action: NextStepPrimaryAction,
	handlers: NextStepPrimaryActionHandlers,
) {
	if (action.type === 'navigate') {
		handlers.navigate(action.path);
		return;
	}

	if (action.type === 'quick-publish') {
		void handlers.handleQuickPublishAgent();
		return;
	}

	if (action.type === 'scroll-management') {
		handlers.scrollToAgentManagement();
		return;
	}

	if (action.type === 'scroll-governance') {
		handlers.scrollToGovernance();
		return;
	}

	handlers.handlePrimeAgentRunner();
}

export function runNextStepPrimaryRequestAction(
	nextStepMode: AgentRunnerNextStepMode,
	handlers: NextStepPrimaryActionHandlers,
) {
	runNextStepPrimaryAction(nextStepPrimaryAction(nextStepMode), handlers);
}

export type AppCenterPrimaryActionHandlers = {
	navigate: NavigateHandler;
	selectAndPrimeAgent: (agentId: string) => void;
	handleQuickPublishAgent: () => void | Promise<void>;
	scrollToAgentManagement: NavigationHandler;
};

export function runAppCenterPrimaryAction(
	action: AppCenterPrimaryAction,
	handlers: AppCenterPrimaryActionHandlers,
) {
	if (action.type === 'navigate') {
		handlers.navigate(action.path);
		return;
	}

	if (action.type === 'select-ready-agent') {
		handlers.selectAndPrimeAgent(action.agentId);
		return;
	}

	if (action.type === 'quick-publish') {
		void handlers.handleQuickPublishAgent();
		return;
	}

	handlers.scrollToAgentManagement();
}

export function runAppCenterPrimaryRequestAction(
	values: Parameters<typeof appCenterPrimaryAction>[0],
	handlers: AppCenterPrimaryActionHandlers,
) {
	runAppCenterPrimaryAction(appCenterPrimaryAction(values), handlers);
}

export type PlatformAppCenterPrimaryActionValues = {
	credentialCount: number;
	readyPlatformAgents: Pick<EnterprisePublishedAgent, 'id'>[];
	activePlatformAgents: EnterprisePublishedAgent[];
};

export type PlatformAppCenterPrimaryActionHandlers = {
	navigate: NavigateHandler;
	setSelectedRunAgentId: (agentId: string) => void;
	handlePrimeAgentRunner: NavigationHandler;
	handleQuickPublishAgent: () => void | Promise<void>;
	scrollToAgentManagement: NavigationHandler;
};

export function runPlatformAppCenterPrimaryRequestAction(
	values: PlatformAppCenterPrimaryActionValues,
	handlers: PlatformAppCenterPrimaryActionHandlers,
) {
	runAppCenterPrimaryRequestAction(
		{
			credentialCount: values.credentialCount,
			readyAgentId: values.readyPlatformAgents[0]?.id,
			activeAgentCount: values.activePlatformAgents.length,
		},
		{
			navigate: handlers.navigate,
			selectAndPrimeAgent: (agentId) => {
				handlers.setSelectedRunAgentId(agentId);
				handlers.handlePrimeAgentRunner();
			},
			handleQuickPublishAgent: handlers.handleQuickPublishAgent,
			scrollToAgentManagement: handlers.scrollToAgentManagement,
		},
	);
}

export type AppCenterDetailPrimaryActionHandlers = {
	selectAndPrimeAgent: (agentId: string) => void;
	editAgent: NavigationHandler;
	configureTemplate: NavigationHandler;
	scrollToAgentManagement: NavigationHandler;
};

export function runAppCenterDetailPrimaryAction(
	action: AppCenterDetailPrimaryAction,
	handlers: AppCenterDetailPrimaryActionHandlers,
) {
	if (action.type === 'select-agent') {
		handlers.selectAndPrimeAgent(action.agentId);
		return;
	}

	if (action.type === 'edit-agent') {
		handlers.editAgent();
		handlers.scrollToAgentManagement();
		return;
	}

	if (action.type === 'configure-template') {
		handlers.configureTemplate();
		handlers.scrollToAgentManagement();
	}
}

export function runAppCenterDetailPrimaryRequestAction(
	values: Parameters<typeof appCenterDetailPrimaryAction>[0],
	handlers: AppCenterDetailPrimaryActionHandlers,
) {
	runAppCenterDetailPrimaryAction(appCenterDetailPrimaryAction(values), handlers);
}

export type PlatformAppCenterDetailPrimaryActionValues = {
	inspectedAgent?: EnterprisePublishedAgent | null;
	inspectedTemplate?: EnterpriseAgentTemplate | null;
};

export type PlatformAppCenterDetailPrimaryActionHandlers = {
	setSelectedRunAgentId: (agentId: string) => void;
	handlePrimeAgentRunner: NavigationHandler;
	handleEditAgent: (agent: EnterprisePublishedAgent) => void;
	handleConfigureTemplate: (template: EnterpriseAgentTemplate) => void;
	scrollToAgentManagement: NavigationHandler;
};

export function runPlatformAppCenterDetailPrimaryRequestAction(
	values: PlatformAppCenterDetailPrimaryActionValues,
	handlers: PlatformAppCenterDetailPrimaryActionHandlers,
) {
	const { inspectedAgent, inspectedTemplate } = values;

	runAppCenterDetailPrimaryRequestAction(
		{
			agentId: inspectedAgent?.id,
			agentIsReady: agentIsReady(inspectedAgent),
			hasTemplate: Boolean(inspectedTemplate),
		},
		{
			selectAndPrimeAgent: (agentId) => {
				handlers.setSelectedRunAgentId(agentId);
				handlers.handlePrimeAgentRunner();
			},
			editAgent: () => {
				if (inspectedAgent) {
					handlers.handleEditAgent(inspectedAgent);
				}
			},
			configureTemplate: () => {
				if (inspectedTemplate) {
					handlers.handleConfigureTemplate(inspectedTemplate);
				}
			},
			scrollToAgentManagement: () =>
				window.setTimeout(handlers.scrollToAgentManagement, 0),
		},
	);
}

export type AppCenterDetailSecondaryActionHandlers = {
	editAgent: NavigationHandler;
	scrollToAgentManagement: NavigationHandler;
	scrollToGovernance: NavigationHandler;
};

export function runAppCenterDetailSecondaryAction(
	action: AppCenterDetailSecondaryAction,
	handlers: AppCenterDetailSecondaryActionHandlers,
) {
	if (action.type === 'edit-agent') {
		handlers.editAgent();
		handlers.scrollToAgentManagement();
		return;
	}

	handlers.scrollToGovernance();
}

export function runAppCenterDetailSecondaryRequestAction(
	values: Parameters<typeof appCenterDetailSecondaryAction>[0],
	handlers: AppCenterDetailSecondaryActionHandlers,
) {
	runAppCenterDetailSecondaryAction(
		appCenterDetailSecondaryAction(values),
		handlers,
	);
}

export type PlatformAppCenterDetailSecondaryActionValues = {
	inspectedAgent?: EnterprisePublishedAgent | null;
};

export type PlatformAppCenterDetailSecondaryActionHandlers = {
	handleEditAgent: (agent: EnterprisePublishedAgent) => void;
	scrollToAgentManagement: NavigationHandler;
	scrollToGovernance: NavigationHandler;
};

export function runPlatformAppCenterDetailSecondaryRequestAction(
	values: PlatformAppCenterDetailSecondaryActionValues,
	handlers: PlatformAppCenterDetailSecondaryActionHandlers,
) {
	const { inspectedAgent } = values;

	runAppCenterDetailSecondaryRequestAction(
		{
			hasAgent: Boolean(inspectedAgent),
		},
		{
			editAgent: () => {
				if (inspectedAgent) {
					handlers.handleEditAgent(inspectedAgent);
				}
			},
			scrollToAgentManagement: () =>
				window.setTimeout(handlers.scrollToAgentManagement, 0),
			scrollToGovernance: handlers.scrollToGovernance,
		},
	);
}

export type PlatformNavigationRequestHandlerValues = {
	nextAgentSetupStep: AgentWizardStep | null;
	selectedTemplate?: EnterpriseAgentTemplate | null;
	defaultTemplate?: EnterpriseAgentTemplate | null;
	credentialCount: number;
	knowledgeBaseCount: number;
	nextStepMode: AgentRunnerNextStepMode;
	readyPlatformAgents: Pick<EnterprisePublishedAgent, 'id'>[];
	activePlatformAgents: EnterprisePublishedAgent[];
	inspectedAppCenterAgent?: EnterprisePublishedAgent | null;
	inspectedAppCenterTemplate?: EnterpriseAgentTemplate | null;
};

export type PlatformNavigationRequestHandlerActions = {
	configureTemplate: (template: EnterpriseAgentTemplate) => void;
	navigate: NavigateHandler;
	scrollToAgentManagement: NavigationHandler;
	scrollToGovernance: NavigationHandler;
	setSelectedRunAgentId: (agentId: string) => void;
	handlePrimeAgentRunner: NavigationHandler;
	handleQuickPublishAgent: () => void | Promise<void>;
	handleEditAgent: (agent: EnterprisePublishedAgent) => void;
};

export function createPlatformNavigationRequestHandlers(
	values: PlatformNavigationRequestHandlerValues,
	actions: PlatformNavigationRequestHandlerActions,
) {
	function handleNextAgentSetupStep() {
		runPlatformAgentSetupStepRequestAction(
			{
				nextStep: values.nextAgentSetupStep,
				selectedTemplate: values.selectedTemplate,
				defaultTemplate: values.defaultTemplate,
				credentialCount: values.credentialCount,
				knowledgeBaseCount: values.knowledgeBaseCount,
			},
			{
				configureTemplate: actions.configureTemplate,
				navigate: actions.navigate,
				scrollToAgentManagement: actions.scrollToAgentManagement,
			},
		);
	}

	function handleNextStepPrimaryAction() {
		runNextStepPrimaryRequestAction(values.nextStepMode, {
			navigate: actions.navigate,
			handleQuickPublishAgent: actions.handleQuickPublishAgent,
			scrollToAgentManagement: actions.scrollToAgentManagement,
			scrollToGovernance: actions.scrollToGovernance,
			handlePrimeAgentRunner: actions.handlePrimeAgentRunner,
		});
	}

	function handleAppCenterPrimaryAction() {
		runPlatformAppCenterPrimaryRequestAction(
			{
				credentialCount: values.credentialCount,
				readyPlatformAgents: values.readyPlatformAgents,
				activePlatformAgents: values.activePlatformAgents,
			},
			{
				navigate: actions.navigate,
				setSelectedRunAgentId: actions.setSelectedRunAgentId,
				handlePrimeAgentRunner: actions.handlePrimeAgentRunner,
				handleQuickPublishAgent: actions.handleQuickPublishAgent,
				scrollToAgentManagement: actions.scrollToAgentManagement,
			},
		);
	}

	function handleAppCenterDetailPrimaryAction() {
		runPlatformAppCenterDetailPrimaryRequestAction(
			{
				inspectedAgent: values.inspectedAppCenterAgent,
				inspectedTemplate: values.inspectedAppCenterTemplate,
			},
			{
				setSelectedRunAgentId: actions.setSelectedRunAgentId,
				handlePrimeAgentRunner: actions.handlePrimeAgentRunner,
				handleEditAgent: actions.handleEditAgent,
				handleConfigureTemplate: actions.configureTemplate,
				scrollToAgentManagement: actions.scrollToAgentManagement,
			},
		);
	}

	function handleAppCenterDetailSecondaryAction() {
		runPlatformAppCenterDetailSecondaryRequestAction(
			{
				inspectedAgent: values.inspectedAppCenterAgent,
			},
			{
				handleEditAgent: actions.handleEditAgent,
				scrollToAgentManagement: actions.scrollToAgentManagement,
				scrollToGovernance: actions.scrollToGovernance,
			},
		);
	}

	return {
		handleNextAgentSetupStep,
		handleNextStepPrimaryAction,
		handleAppCenterPrimaryAction,
		handleAppCenterDetailPrimaryAction,
		handleAppCenterDetailSecondaryAction,
	};
}

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
