import type {
	EnterpriseWorkflowTemplate,
	EnterpriseWorkflowTemplatesResponse,
} from '@/api';

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
