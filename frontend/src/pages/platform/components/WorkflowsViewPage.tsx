import { Workflow } from 'lucide-react';
import type { RefObject } from 'react';

import type {
	EnterpriseWorkflowRunHistoryItem,
	EnterpriseWorkflowRunResponse,
	EnterpriseWorkflowTemplate,
} from '@/api';

import { StateBadge } from './common';
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
		<main className="h-full overflow-y-auto bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
				<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0">
						<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
							<Workflow className="size-4" />
							<span>{t('platform.workflowRunner.title')}</span>
						</div>
						<h1 className="text-2xl font-semibold tracking-normal">
							{t('platform.workflowRunner.title')}
						</h1>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
							{t('platform.workflowRunner.description')}
						</p>
					</div>
					<div className="grid min-w-0 gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:min-w-80">
						<div className="flex items-center justify-between gap-3">
							<span className="text-muted-foreground">
								{t('platform.connection.server')}
							</span>
							<span className="truncate font-mono" title={serverUrl}>
								{serverUrl}
							</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className="text-muted-foreground">
								{t('platform.connection.user')}
							</span>
							<span className="truncate font-mono" title={username}>
								{username}
							</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className="text-muted-foreground">
								{t('platform.connection.health')}
							</span>
							<StateBadge
								state={hasErrors ? 'partial' : 'ready'}
								label={
									hasErrors
										? t('platform.connection.partial')
										: t('platform.connection.connected')
								}
							/>
						</div>
					</div>
				</section>

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
			</div>
		</main>
	);
}
