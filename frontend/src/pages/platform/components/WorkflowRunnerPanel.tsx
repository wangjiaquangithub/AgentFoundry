import { ListChecks, Play, Workflow } from 'lucide-react';

import type {
	EnterpriseWorkflowRunHistoryItem,
	EnterpriseWorkflowRunResponse,
	EnterpriseWorkflowTemplate,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface WorkflowOption {
	value: string;
	label: string;
	enabled: boolean;
	defaultInputs?: Record<string, unknown>;
}

interface WorkflowRunnerPanelProps {
	selectedWorkflowType: string;
	workflowOptions: WorkflowOption[];
	selectedWorkflowTemplate: EnterpriseWorkflowTemplate | null;
	workflowInputs: Record<string, string>;
	workflowInputLabelKeys: Record<string, string>;
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
	workflowInputLabel: (key: string) => string;
	workflowStatusLabelKey: (status?: string) => string;
	workflowStatusClassName: (status?: string) => string;
	formatTimestamp: (value?: string) => string;
	summarizeAuditObject: (value?: Record<string, unknown>) => string;
	t: Translate;
}

export function WorkflowRunnerPanel({
	selectedWorkflowType,
	workflowOptions,
	selectedWorkflowTemplate,
	workflowInputs,
	workflowInputLabelKeys,
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
	workflowInputLabel,
	workflowStatusLabelKey,
	workflowStatusClassName,
	formatTimestamp,
	summarizeAuditObject,
	t,
}: WorkflowRunnerPanelProps) {
	return (
		<section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
			<div className="flex flex-col gap-3">
				<div className="flex items-start gap-2">
					<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/20">
						<Workflow className="size-4 text-muted-foreground" />
					</div>
					<div className="min-w-0">
						<h2 className="text-base font-semibold">
							{t('platform.workflowRunner.title')}
						</h2>
						<p className="text-sm text-muted-foreground">
							{t('platform.workflowRunner.description')}
						</p>
					</div>
				</div>

				<div className="grid gap-4 rounded-lg border bg-muted/10 p-4">
					<div className="grid gap-2">
						<label className="text-xs font-medium text-muted-foreground">
							{t('platform.workflowRunner.selectWorkflow')}
						</label>
						<Select value={selectedWorkflowType} onValueChange={onWorkflowTypeChange}>
							<SelectTrigger className="w-full">
								<SelectValue
									placeholder={t('platform.workflowRunner.selectWorkflow')}
								/>
							</SelectTrigger>
							<SelectContent>
								{workflowOptions.map((workflow) => (
									<SelectItem key={workflow.value} value={workflow.value}>
										{workflow.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{selectedWorkflowTemplate ? (
							<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<Badge
									variant="outline"
									className={cn(
										selectedWorkflowTemplate.enabled
											? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
											: 'border-slate-500/30 bg-slate-500/10 text-slate-700',
									)}
								>
									{selectedWorkflowTemplate.enabled
										? t('platform.workflowRunner.enabled')
										: t('platform.workflowRunner.disabled')}
								</Badge>
								<span>{selectedWorkflowTemplate.description}</span>
							</div>
						) : null}
					</div>

					<div className="grid gap-3 md:grid-cols-3">
						{Object.entries(workflowInputs).map(([key, value]) => {
							const labelKey = workflowInputLabelKeys[key];

							return (
								<div key={key} className="grid gap-2">
									<label className="text-xs font-medium text-muted-foreground">
										{labelKey
											? t(`platform.workflowRunner.${labelKey}`)
											: workflowInputLabel(key)}
									</label>
									<Input
										value={value}
										onChange={(event) =>
											onWorkflowInputChange(key, event.target.value)
										}
									/>
								</div>
							);
						})}
					</div>

					<div className="grid gap-2">
						<label className="text-xs font-medium text-muted-foreground">
							{t('platform.workflowRunner.approvalId')}
						</label>
						<Input
							value={workflowApprovalId}
							onChange={(event) => onWorkflowApprovalIdChange(event.target.value)}
							placeholder={t('platform.workflowRunner.approvalIdPlaceholder')}
							className="font-mono"
						/>
					</div>

					<div className="flex flex-wrap justify-end gap-2">
						<Button
							variant="outline"
							onClick={onRequestApproval}
							disabled={
								creatingRunApproval === 'workflow_run' ||
								workflowTemplatesLoading ||
								selectedWorkflowDisabled ||
								Boolean(platformError)
							}
						>
							<ListChecks
								className={cn(
									creatingRunApproval === 'workflow_run' && 'animate-pulse',
								)}
							/>
							{creatingRunApproval === 'workflow_run'
								? t('platform.workflowRunner.requestingApproval')
								: t('platform.workflowRunner.requestApproval')}
						</Button>
						<Button
							onClick={onRunWorkflow}
							disabled={
								runningWorkflow ||
								workflowTemplatesLoading ||
								selectedWorkflowDisabled ||
								Boolean(platformError)
							}
						>
							<Play className={cn(runningWorkflow && 'animate-pulse')} />
							{runningWorkflow
								? t('platform.workflowRunner.running')
								: t('platform.workflowRunner.run')}
						</Button>
					</div>

					{workflowRunError ? (
						<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{t('platform.workflowRunner.error')} {workflowRunError}
						</div>
					) : null}
				</div>

				<div className="grid gap-3 rounded-lg border bg-muted/10 p-4">
					<div>
						<h3 className="text-sm font-semibold">
							{t('platform.workflowRunner.templates')}
						</h3>
						<p className="text-xs text-muted-foreground">
							{t('platform.workflowRunner.templatesDescription')}
						</p>
					</div>
					{workflowTemplatesLoading ? (
						<div className="grid gap-2">
							{[0, 1, 2].map((item) => (
								<Skeleton key={item} className="h-20 rounded-lg" />
							))}
						</div>
					) : workflowTemplatesError ? (
						<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{workflowTemplatesError}
						</div>
					) : workflowTemplates.length === 0 ? (
						<div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
							{t('platform.workflowRunner.noTemplates')}
						</div>
					) : (
						<div className="grid gap-2">
							{workflowTemplates.map((template) => {
								const toolNames = Array.from(
									new Set(template.steps.map((step) => step.tool_name)),
								);
								const isSaving = savingWorkflowType === template.workflow_type;

								return (
									<div
										key={template.workflow_type}
										className="rounded-lg border bg-background p-3"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<div className="flex flex-wrap items-center gap-2">
													<span className="font-medium">{template.name}</span>
													<Badge variant="outline">
														{t('platform.workflowRunner.stepsCount', {
															count: template.steps.length,
														})}
													</Badge>
													<Badge
														variant="outline"
														className={cn(
															template.enabled
																? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
																: 'border-slate-500/30 bg-slate-500/10 text-slate-700',
														)}
													>
														{template.enabled
															? t('platform.workflowRunner.enabled')
															: t('platform.workflowRunner.disabled')}
													</Badge>
												</div>
												<p className="mt-1 text-xs text-muted-foreground">
													{template.description}
												</p>
											</div>
											<div className="flex shrink-0 items-center gap-2">
												{isSaving ? (
													<span className="text-xs text-muted-foreground">
														{t('platform.workflowRunner.savingTemplate')}
													</span>
												) : null}
												<Switch
													size="sm"
													checked={template.enabled}
													disabled={isSaving}
													onCheckedChange={(checked) =>
														onToggleWorkflowTemplate(template, checked)
													}
												/>
											</div>
										</div>
										<div className="mt-3 flex flex-wrap gap-2">
											<span className="text-xs text-muted-foreground">
												{t('platform.workflowRunner.stepTools')}
											</span>
											{toolNames.map((toolName) => (
												<Badge key={toolName} variant="secondary">
													{toolName}
												</Badge>
											))}
										</div>
										<div className="mt-3 text-xs text-muted-foreground">
											{t('platform.workflowRunner.updatedAt')}{' '}
											{formatTimestamp(template.updated_at)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex items-center gap-2">
					<Workflow className="size-4 text-muted-foreground" />
					<h3 className="text-sm font-semibold">
						{t('platform.workflowRunner.summary')}
					</h3>
				</div>
				{workflowRunResult ? (
					<div className="grid gap-4">
						<div className="rounded-lg border bg-muted/10 p-4">
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="outline">{workflowRunResult.workflow_name}</Badge>
								<span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
									{workflowRunResult.agent_id}
								</span>
							</div>
							<p className="mt-3 whitespace-pre-wrap text-sm leading-6">
								{workflowRunResult.summary}
							</p>
						</div>

						<div className="grid gap-2">
							<div className="text-xs font-medium text-muted-foreground">
								{t('platform.workflowRunner.steps')}
							</div>
							{workflowRunResult.steps.map((step) => {
								const statusLabel =
									step.status === 'success'
										? t('platform.workflowRunner.statusSuccess')
										: step.status === 'denied'
											? t('platform.workflowRunner.statusDenied')
											: t('platform.workflowRunner.statusFailed');

								return (
									<div
										key={`${step.id}-${step.tool_name}`}
										className="rounded-lg border bg-background p-3"
									>
										<div className="flex flex-wrap items-center gap-2">
											<Badge
												variant={step.status === 'failed' ? 'destructive' : 'outline'}
												className={cn(
													step.status === 'success' &&
														'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
													step.status === 'denied' &&
														'border-amber-500/30 bg-amber-500/10 text-amber-700',
												)}
											>
												{statusLabel}
											</Badge>
											<span className="font-medium">{step.title}</span>
											<span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
												{step.tool_name}
											</span>
										</div>
										{step.message ? (
											<p className="mt-2 text-sm text-muted-foreground">
												{step.message}
											</p>
										) : null}
										{step.result ? (
											<pre className="mt-3 max-h-44 overflow-auto rounded-md border bg-muted/20 p-3 text-xs leading-5">
												{JSON.stringify(step.result, null, 2)}
											</pre>
										) : null}
									</div>
								);
							})}
						</div>

						<div className="grid gap-2">
							<div className="text-xs font-medium text-muted-foreground">
								{t('platform.workflowRunner.toolCalls')}
							</div>
							<pre className="max-h-60 overflow-auto rounded-lg border bg-muted/20 p-4 text-xs leading-5">
								{JSON.stringify(workflowRunResult.tool_calls, null, 2)}
							</pre>
						</div>
					</div>
				) : (
					<div className="flex min-h-72 items-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
						{t('platform.workflowRunner.emptyResult')}
					</div>
				)}

				<div className="grid gap-3 rounded-lg border bg-muted/10 p-4">
					<div>
						<h3 className="text-sm font-semibold">
							{t('platform.workflowRunner.history')}
						</h3>
						<p className="text-xs text-muted-foreground">
							{t('platform.workflowRunner.historyDescription')}
						</p>
					</div>

					{workflowRunsLoading ? (
						<div className="grid gap-2">
							{[0, 1, 2].map((item) => (
								<Skeleton key={item} className="h-28 rounded-lg" />
							))}
						</div>
					) : workflowRunsError ? (
						<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{workflowRunsError}
						</div>
					) : workflowRuns.length === 0 ? (
						<div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
							{t('platform.workflowRunner.historyEmpty')}
						</div>
					) : (
						<div className="grid gap-2">
							{workflowRuns.map((run) => {
								const counts = run.status_counts ?? {};

								return (
									<div
										key={run.run_id}
										className="rounded-lg border bg-background p-3"
									>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div className="min-w-0">
												<div className="flex flex-wrap items-center gap-2">
													<Badge
														variant={run.status === 'failed' ? 'destructive' : 'outline'}
														className={cn(workflowStatusClassName(run.status))}
													>
														{t(
															`platform.workflowRunner.${workflowStatusLabelKey(run.status)}`,
														)}
													</Badge>
													<span className="font-medium">{run.workflow_name}</span>
												</div>
												<div className="mt-1 text-xs text-muted-foreground">
													{t('platform.workflowRunner.statusCounts', {
														success: counts.success ?? 0,
														denied: counts.denied ?? 0,
														failed: counts.failed ?? 0,
													})}
												</div>
											</div>
											<div className="text-right text-xs text-muted-foreground">
												<div>{t('platform.workflowRunner.lastRun')}</div>
												<div>{formatTimestamp(run.finished_at)}</div>
											</div>
										</div>

										<p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
											{run.summary}
										</p>

										<div className="mt-3 grid gap-1 text-xs text-muted-foreground">
											<div className="flex flex-wrap gap-1">
												<span>{t('platform.audit.user')}:</span>
												<span className="font-mono">
													{run.user_id} / {run.tenant}
												</span>
											</div>
											<div className="flex flex-wrap gap-1">
												<span>Agent:</span>
												<span className="font-mono">{run.agent_id}</span>
											</div>
											<div className="flex flex-wrap gap-1">
												<span>{t('platform.audit.inputs')}:</span>
												<span>{summarizeAuditObject(run.inputs)}</span>
											</div>
											<div className="flex flex-wrap gap-1">
												<span>{t('platform.workflowRunner.runId')}:</span>
												<span className="font-mono">{run.run_id}</span>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
