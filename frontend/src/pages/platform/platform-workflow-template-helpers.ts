import type {
	EnterpriseWorkflowTemplate,
	EnterpriseWorkflowTemplatesResponse,
} from '@/api';
import { normalizePlatformErrorMessage } from './platform-error-state';

export type WorkflowTemplateToggleActionHandlers = {
	setSavingWorkflowType: (workflowType: string | null) => void;
	clearError: () => void;
	updateWorkflow: (
		workflowType: string,
		values: { enabled: boolean },
	) => EnterpriseWorkflowTemplatesResponse | Promise<EnterpriseWorkflowTemplatesResponse>;
	setWorkflowTemplates: (workflows: EnterpriseWorkflowTemplate[]) => void;
	refreshDependentViews: () => void | Promise<void>;
	handleError: (error: unknown) => void;
};

export type WorkflowTemplateLoadActionHandlers = {
	setLoading: (loading: boolean) => void;
	clearError: () => void;
	loadWorkflowTemplates: () =>
		| EnterpriseWorkflowTemplatesResponse
		| Promise<EnterpriseWorkflowTemplatesResponse>;
	setWorkflowTemplates: (workflows: EnterpriseWorkflowTemplate[]) => void;
	setError: (message: string) => void;
};

export type PlatformWorkflowTemplateHandlerValues = {
	text: {
		templatesLoadError: string;
	};
};

export type PlatformWorkflowTemplateHandlerActions = {
	setWorkflowTemplatesLoading: (loading: boolean) => void;
	setSavingWorkflowType: (workflowType: string | null) => void;
	setWorkflowTemplatesError: (message: string | null) => void;
	loadWorkflowTemplates: () =>
		| EnterpriseWorkflowTemplatesResponse
		| Promise<EnterpriseWorkflowTemplatesResponse>;
	updateWorkflow: (
		workflowType: string,
		values: { enabled: boolean },
	) => EnterpriseWorkflowTemplatesResponse | Promise<EnterpriseWorkflowTemplatesResponse>;
	setWorkflowTemplates: (workflows: EnterpriseWorkflowTemplate[]) => void;
	refreshDependentViews: () => void | Promise<void>;
};

export async function runWorkflowTemplateLoadAction(
	loadErrorMessage: string,
	handlers: WorkflowTemplateLoadActionHandlers,
) {
	handlers.setLoading(true);
	handlers.clearError();
	try {
		const response = await handlers.loadWorkflowTemplates();
		handlers.setWorkflowTemplates(response.workflows);
	} catch (error) {
		handlers.setError(normalizePlatformErrorMessage(error, loadErrorMessage));
	} finally {
		handlers.setLoading(false);
	}
}

export function createPlatformWorkflowTemplateHandlers(
	values: PlatformWorkflowTemplateHandlerValues,
	actions: PlatformWorkflowTemplateHandlerActions,
) {
	async function refetchWorkflowTemplates() {
		await runWorkflowTemplateLoadAction(values.text.templatesLoadError, {
			setLoading: actions.setWorkflowTemplatesLoading,
			clearError: () => actions.setWorkflowTemplatesError(null),
			loadWorkflowTemplates: actions.loadWorkflowTemplates,
			setWorkflowTemplates: actions.setWorkflowTemplates,
			setError: actions.setWorkflowTemplatesError,
		});
	}

	async function handleToggleWorkflowTemplate(
		template: EnterpriseWorkflowTemplate,
		enabled: boolean,
	) {
		await runWorkflowTemplateToggleAction(
			{ template, enabled },
			{
				setSavingWorkflowType: actions.setSavingWorkflowType,
				clearError: () => actions.setWorkflowTemplatesError(null),
				updateWorkflow: actions.updateWorkflow,
				setWorkflowTemplates: actions.setWorkflowTemplates,
				refreshDependentViews: actions.refreshDependentViews,
				handleError: (error) =>
					actions.setWorkflowTemplatesError(
						normalizePlatformErrorMessage(
							error,
							values.text.templatesLoadError,
						),
					),
			},
		);
	}

	return {
		refetchWorkflowTemplates,
		handleToggleWorkflowTemplate,
	};
}

export async function runWorkflowTemplateToggleAction(
	values: {
		template: EnterpriseWorkflowTemplate;
		enabled: boolean;
	},
	handlers: WorkflowTemplateToggleActionHandlers,
) {
	handlers.setSavingWorkflowType(values.template.workflow_type);
	handlers.clearError();
	try {
		const response = await handlers.updateWorkflow(values.template.workflow_type, {
			enabled: values.enabled,
		});
		handlers.setWorkflowTemplates(response.workflows);
		await handlers.refreshDependentViews();
	} catch (error) {
		handlers.handleError(error);
	} finally {
		handlers.setSavingWorkflowType(null);
	}
}
