import { Activity, CheckCircle2, History, ListChecks, Workflow } from 'lucide-react';
import type { RefObject } from 'react';


import {
	PlatformConnectionCard,
	PlatformPageHeader,
	PlatformPageShell,
} from './common';
import { WorkflowRunnerPanel } from './WorkflowRunnerPanel';
import type {
	EnterpriseWorkflowRunHistoryItem,
	EnterpriseWorkflowRunResponse,
	EnterpriseWorkflowTemplate,
} from '@/api';

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
	const enabledWorkflowCount = workflowTemplates.filter(
		(template) => template.enabled,
	).length;
	const totalWorkflowSteps = workflowTemplates.reduce(
		(total, template) => total + template.steps.length,
		0,
	);
	const latestWorkflowRun = workflowRuns[0];
	const latestWorkflowStatusLabel = latestWorkflowRun
		? t(
				latestWorkflowRun.status === 'completed'
					? 'platform.workflowRunner.statusCompleted'
					: latestWorkflowRun.status === 'partial'
						? 'platform.workflowRunner.statusPartial'
						: 'platform.workflowRunner.statusWorkflowFailed',
			)
		: t('platform.workflowRunner.historyEmpty');

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

				<section className="grid gap-3 md:grid-cols-4">
					<div className="rounded-lg border bg-background p-4 shadow-sm">
						<div className="flex items-center justify-between gap-3">
							<span className="text-sm font-medium text-muted-foreground">
								{t('platform.workflowRunner.templates')}
							</span>
							<Workflow className="size-4 text-muted-foreground" />
						</div>
						<div className="mt-3 text-2xl font-semibold tabular-nums">
							{workflowTemplates.length}
						</div>
						<p className="mt-1 truncate text-xs text-muted-foreground">
							{t('platform.workflowRunner.selectWorkflow')}
						</p>
					</div>
					<div className="rounded-lg border bg-background p-4 shadow-sm">
						<div className="flex items-center justify-between gap-3">
							<span className="text-sm font-medium text-muted-foreground">
								{t('platform.workflowRunner.enabled')}
							</span>
							<CheckCircle2 className="size-4 text-muted-foreground" />
						</div>
						<div className="mt-3 text-2xl font-semibold tabular-nums">
							{enabledWorkflowCount}
						</div>
						<p className="mt-1 truncate text-xs text-muted-foreground">
							{workflowTemplatesLoading
								? t('common.loading')
								: t('platform.workflowRunner.disabled')}
						</p>
					</div>
					<div className="rounded-lg border bg-background p-4 shadow-sm">
						<div className="flex items-center justify-between gap-3">
							<span className="text-sm font-medium text-muted-foreground">
								{t('platform.workflowRunner.steps')}
							</span>
							<ListChecks className="size-4 text-muted-foreground" />
						</div>
						<div className="mt-3 text-2xl font-semibold tabular-nums">
							{totalWorkflowSteps}
						</div>
						<p className="mt-1 truncate text-xs text-muted-foreground">
							{selectedWorkflowTemplate
								? t('platform.workflowRunner.stepsCount', {
										count: selectedWorkflowTemplate.steps.length,
									})
								: t('platform.workflowRunner.noTemplates')}
						</p>
					</div>
					<div className="rounded-lg border bg-background p-4 shadow-sm">
						<div className="flex items-center justify-between gap-3">
							<span className="text-sm font-medium text-muted-foreground">
								{t('platform.workflowRunner.history')}
							</span>
							<History className="size-4 text-muted-foreground" />
						</div>
						<div className="mt-3 text-2xl font-semibold tabular-nums">
							{workflowRuns.length}
						</div>
						<p className="mt-1 truncate text-xs text-muted-foreground">
							{latestWorkflowStatusLabel}
						</p>
					</div>
				</section>

				<section ref={workflowRunnerRef}>
					<div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
						<Activity className="size-4" />
						<span>{t('platform.workflowRunner.summary')}</span>
					</div>
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
