// @ts-nocheck

import { WorkflowRunnerPanel } from './WorkflowRunnerPanel';
import { workflowInputsWithValue } from '../platform-agent-runner';
import { normalizeWorkflowInputs } from '../platform-utils';

interface DashboardWorkflowRunnerSectionProps {
	[key: string]: any;
}

export function DashboardWorkflowRunnerSection({
	creatingRunApproval,
	handleCreateRunApproval,
	handleRunEnterpriseWorkflow,
	handleToggleWorkflowTemplate,
	platformError,
	runningWorkflow,
	savingWorkflowType,
	selectedWorkflowDisabled,
	selectedWorkflowTemplate,
	selectedWorkflowType,
	setSelectedWorkflowType,
	setWorkflowInputs,
	setWorkflowRunError,
	summarizeAuditObject,
	t,
	workflowApprovalId,
	workflowInputs,
	workflowOptions,
	workflowRunError,
	workflowRunResult,
	workflowRunnerRef,
	workflowRuns,
	workflowRunsError,
	workflowRunsLoading,
	workflowTemplates,
	workflowTemplatesError,
	workflowTemplatesLoading,
	setWorkflowApprovalId,
}: DashboardWorkflowRunnerSectionProps) {
	return (
		<section ref={workflowRunnerRef}>
			<WorkflowRunnerPanel
				selectedWorkflowType={selectedWorkflowType}
				workflowOptions={workflowOptions}
				selectedWorkflowTemplate={selectedWorkflowTemplate}
				workflowInputs={workflowInputs}
				workflowApprovalId={workflowApprovalId}
				workflowRunError={workflowRunError}
				workflowRunResult={workflowRunResult}
				runningWorkflow={runningWorkflow}
				workflowTemplatesLoading={workflowTemplatesLoading}
				workflowTemplatesError={workflowTemplatesError}
				workflowTemplates={workflowTemplates}
				selectedWorkflowDisabled={selectedWorkflowDisabled}
				savingWorkflowType={savingWorkflowType}
				creatingRunApproval={creatingRunApproval}
				platformError={platformError ? String(platformError) : null}
				workflowRunsLoading={workflowRunsLoading}
				workflowRunsError={workflowRunsError}
				workflowRuns={workflowRuns}
				onWorkflowTypeChange={(value) => {
					setSelectedWorkflowType(value);
					setWorkflowRunError(null);
					const nextWorkflow = workflowOptions.find(
						(workflow) => workflow.value === value,
					);
					setWorkflowInputs(normalizeWorkflowInputs(nextWorkflow?.defaultInputs));
				}}
				onWorkflowInputChange={(key, value) =>
					setWorkflowInputs((current) =>
						workflowInputsWithValue(current, key, value),
					)
				}
				onWorkflowApprovalIdChange={setWorkflowApprovalId}
				onRequestApproval={() => void handleCreateRunApproval('workflow_run')}
				onRunWorkflow={() => void handleRunEnterpriseWorkflow()}
				onToggleWorkflowTemplate={(template, checked) =>
					void handleToggleWorkflowTemplate(template, checked)
				}
				summarizeAuditObject={summarizeAuditObject}
				t={t}
			/>
		</section>
	);
}
