import { CheckCircle2, History, ListChecks, Workflow } from 'lucide-react';
import type { RefObject } from 'react';


import {
	PlatformConnectionCard,
	PlatformMetricsGrid,
	PlatformPageHeader,
	PlatformPageShell,
	StatCard,
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

			<PlatformMetricsGrid>
				<StatCard
					label={t('platform.workflowRunner.templates')}
					value={workflowTemplates.length}
					helper={t('platform.workflowRunner.selectWorkflow')}
					icon={Workflow}
					loading={workflowTemplatesLoading}
				/>
				<StatCard
					label={t('platform.workflowRunner.enabled')}
					value={enabledWorkflowCount}
					helper={t('platform.workflowRunner.disabled')}
					icon={CheckCircle2}
					loading={workflowTemplatesLoading}
				/>
				<StatCard
					label={t('platform.workflowRunner.steps')}
					value={totalWorkflowSteps}
					helper={
						selectedWorkflowTemplate
							? t('platform.workflowRunner.stepsCount', {
									count: selectedWorkflowTemplate.steps.length,
								})
							: t('platform.workflowRunner.noTemplates')
					}
					icon={ListChecks}
					loading={workflowTemplatesLoading}
				/>
				<StatCard
					label={t('platform.workflowRunner.history')}
					value={workflowRuns.length}
					helper={latestWorkflowStatusLabel}
					icon={History}
					loading={workflowRunsLoading}
				/>
			</PlatformMetricsGrid>

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
