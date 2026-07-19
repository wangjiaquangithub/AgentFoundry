import { Workflow } from 'lucide-react';
import type { RefObject } from 'react';

import type {
	EnterpriseWorkflowRunHistoryItem,
	EnterpriseWorkflowRunResponse,
	EnterpriseWorkflowTemplate,
} from '@/api';

import {
	PlatformConnectionCard,
	PlatformPageHeader,
	PlatformPageShell,
} from './common';
import { WorkflowRunnerPanel } from './WorkflowRunnerPanel';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface WorkflowOption {
	value: string;
	label: string;
	enabled: boolean;
	defaultInputs?: Record<string, unknown>;
}

interface WorkflowsViewPageProps {
	serverUrl: string;
	username: string;
	hasErrors: boolean;
	workflowRunnerRef: RefObject<HTMLElement | null>;
	selectedWorkflowType: string;
	workflowOptions: WorkflowOption[];
	selectedWorkflowTemplate: EnterpriseWorkflowTemplate | null;
	workflowInputs: Record<string, string>;
	workflowApprovalId: string;
	workflowRunError: string | null;
	workflowRunResult: EnterpriseWorkflowRunResponse | null;
	runningWorkflow: boolean;
	workflowTemplatesLoading: boolean;
	workflowTemplatesError: string | null;
	workflowTemplates: EnterpriseWorkflowTemplate[];
	selectedWorkflowDisabled: boolean;
	savingWorkflowType: string | null;
	creatingRunApproval: string | null;
	platformError: string | null;
	workflowRunsLoading: boolean;
	workflowRunsError: string | null;
	workflowRuns: EnterpriseWorkflowRunHistoryItem[];
	onWorkflowTypeChange: (value: string) => void;
	onWorkflowInputChange: (key: string, value: string) => void;
	onWorkflowApprovalIdChange: (value: string) => void;
	onRequestApproval: () => void;
	onRunWorkflow: () => void;
	onToggleWorkflowTemplate: (
		template: EnterpriseWorkflowTemplate,
		checked: boolean,
	) => void;
	summarizeAuditObject: (value?: Record<string, unknown>) => string;
	t: Translate;
}

export function WorkflowsViewPage({
	serverUrl,
	username,
	hasErrors,
	workflowRunnerRef,
	selectedWorkflowType,
	workflowOptions,
	selectedWorkflowTemplate,
	workflowInputs,
	workflowApprovalId,
	workflowRunError,
	workflowRunResult,
	runningWorkflow,
	workflowTemplatesLoading,
	workflowTemplatesError,
	workflowTemplates,
	selectedWorkflowDisabled,
	savingWorkflowType,
	creatingRunApproval,
	platformError,
	workflowRunsLoading,
	workflowRunsError,
	workflowRuns,
	onWorkflowTypeChange,
	onWorkflowInputChange,
	onWorkflowApprovalIdChange,
	onRequestApproval,
	onRunWorkflow,
	onToggleWorkflowTemplate,
	summarizeAuditObject,
	t,
}: WorkflowsViewPageProps) {
	return (
		<PlatformPageShell>
			<PlatformPageHeader
				icon={Workflow}
				eyebrow={t('platform.workflowRunner.title')}
				title={t('platform.workflowRunner.title')}
				description={t('platform.workflowRunner.description')}
				aside={
					<PlatformConnectionCard
						serverUrl={serverUrl}
						username={username}
						hasErrors={hasErrors}
						labels={{
							server: t('platform.connection.server'),
							user: t('platform.connection.user'),
							health: t('platform.connection.health'),
							partial: t('platform.connection.partial'),
							connected: t('platform.connection.connected'),
						}}
					/>
				}
			/>

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
						platformError={platformError}
						workflowRunsLoading={workflowRunsLoading}
						workflowRunsError={workflowRunsError}
						workflowRuns={workflowRuns}
						onWorkflowTypeChange={onWorkflowTypeChange}
						onWorkflowInputChange={onWorkflowInputChange}
						onWorkflowApprovalIdChange={onWorkflowApprovalIdChange}
						onRequestApproval={onRequestApproval}
						onRunWorkflow={onRunWorkflow}
						onToggleWorkflowTemplate={onToggleWorkflowTemplate}
						summarizeAuditObject={summarizeAuditObject}
						t={t}
					/>
				</section>
		</PlatformPageShell>
	);
}
