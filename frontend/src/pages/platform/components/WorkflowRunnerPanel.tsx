import {
	CheckCircle2,
	Clock3,
	FileClock,
	History,
	ListChecks,
	Play,
	Workflow,
} from 'lucide-react';

import { workflowInputLabelKeys } from '../platform-defaults';
import {
	formatTimestamp,
	workflowInputLabel,
	workflowStatusClassName,
	workflowStatusLabelKey,
} from '../platform-utils';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

export function WorkflowRunnerPanel({
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
}: WorkflowRunnerPanelProps) {
	const selectedWorkflowTools = selectedWorkflowTemplate
		? Array.from(
				new Set(selectedWorkflowTemplate.steps.map((step) => step.tool_name)),
			)
		: [];
	const recentWorkflowRuns = workflowRuns.slice(0, 3);

	return (
		<Tabs defaultValue="run" className="grid gap-4">
			<div className="flex justify-start">
				<TabsList className="grid w-full grid-cols-3 sm:w-auto">
					<TabsTrigger value="run">
						执行工作流
					</TabsTrigger>
					<TabsTrigger value="templates">
						模板治理
					</TabsTrigger>
					<TabsTrigger value="history">
						运行记录
					</TabsTrigger>
				</TabsList>
			</div>

			<TabsContent value="run" className="mt-0">
				<section className="grid items-start gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_24rem]">
					<aside className="rounded-lg border bg-background p-3 shadow-sm">
						<div className="flex items-center justify-between gap-3 border-b pb-3">
							<div className="flex items-center gap-2">
								<Workflow className="size-4 text-muted-foreground" />
								<h2 className="text-sm font-semibold">
									{t('platform.workflowRunner.templates')}
								</h2>
							</div>
							<Badge variant="outline">{workflowOptions.length}</Badge>
						</div>

						{workflowTemplatesLoading ? (
							<div className="mt-3 grid gap-2">
								{[0, 1, 2].map((item) => (
									<Skeleton key={item} className="h-20 rounded-lg" />
								))}
							</div>
						) : workflowOptions.length === 0 ? (
							<div className="mt-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
								{t('platform.workflowRunner.noTemplates')}
							</div>
						) : (
							<div className="mt-3 grid gap-2">
								{workflowOptions.map((workflow) => (
									<button
										key={workflow.value}
										type="button"
										onClick={() => onWorkflowTypeChange(workflow.value)}
										className={cn(
											'rounded-lg border p-3 text-left transition hover:border-primary/40 hover:bg-muted/30',
											workflow.value === selectedWorkflowType
												? 'border-primary/50 bg-primary/5'
												: 'bg-background',
										)}
									>
										<div className="flex items-start justify-between gap-2">
											<span className="min-w-0 text-sm font-medium">
												{workflow.label}
											</span>
											<Badge
												variant="outline"
												className={cn(
													workflow.enabled
														? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
														: 'border-slate-500/30 bg-slate-500/10 text-slate-700',
												)}
											>
												{workflow.enabled
													? t('platform.workflowRunner.enabled')
													: t('platform.workflowRunner.disabled')}
											</Badge>
										</div>
										<div className="mt-2 text-xs text-muted-foreground">
											{t('platform.workflowRunner.stepsCount', {
												count:
													workflowTemplates.find(
														(template) =>
															template.workflow_type === workflow.value,
													)?.steps.length ?? 0,
											})}
										</div>
									</button>
								))}
							</div>
						)}
					</aside>

					<div className="grid gap-4">
						<section className="rounded-lg border bg-background p-4 shadow-sm">
							<div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
								<div className="min-w-0">
									<h2 className="text-base font-semibold">
										{selectedWorkflowTemplate?.name ??
											t('platform.workflowRunner.selectWorkflow')}
									</h2>
									<p className="mt-1 text-sm leading-6 text-muted-foreground">
										{selectedWorkflowTemplate?.description ??
											t('platform.workflowRunner.description')}
									</p>
								</div>
								{selectedWorkflowTemplate ? (
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
								) : null}
							</div>

							<div className="mt-4 grid gap-4">
								<div className="grid gap-2 xl:hidden">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.workflowRunner.selectWorkflow')}
									</label>
									<Select
										value={selectedWorkflowType}
										onValueChange={onWorkflowTypeChange}
									>
										<SelectTrigger className="w-full bg-background">
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
								</div>

								{selectedWorkflowTemplate ? (
									<div className="grid gap-3 rounded-lg border bg-slate-50/70 p-3 sm:grid-cols-2">
										<div>
											<div className="text-xs font-medium text-muted-foreground">
												{t('platform.workflowRunner.steps')}
											</div>
											<div className="mt-2 flex flex-wrap gap-2">
												<Badge variant="secondary">
													{t('platform.workflowRunner.stepsCount', {
														count: selectedWorkflowTemplate.steps.length,
													})}
												</Badge>
												{selectedWorkflowTools.map((toolName) => (
													<Badge key={toolName} variant="outline">
														{toolName}
													</Badge>
												))}
											</div>
										</div>
										<div>
											<div className="text-xs font-medium text-muted-foreground">
												{t('platform.workflowRunner.updatedAt')}
											</div>
											<div className="mt-2 text-sm">
												{formatTimestamp(selectedWorkflowTemplate.updated_at)}
											</div>
										</div>
									</div>
								) : null}

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
													className="bg-background"
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
										onChange={(event) =>
											onWorkflowApprovalIdChange(event.target.value)
										}
										placeholder={t(
											'platform.workflowRunner.approvalIdPlaceholder',
										)}
										className="bg-background font-mono"
									/>
								</div>

								{workflowRunError ? (
									<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
										{t('platform.workflowRunner.error')} {workflowRunError}
									</div>
								) : null}

								<div className="flex flex-wrap justify-end gap-2 border-t pt-4">
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
												creatingRunApproval === 'workflow_run' &&
													'animate-pulse',
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
							</div>
						</section>

						<section className="rounded-lg border bg-background p-4 shadow-sm">
							<div className="flex items-center gap-2 border-b pb-3">
								<ListChecks className="size-4 text-muted-foreground" />
								<h3 className="text-sm font-semibold">
									{t('platform.workflowRunner.steps')}
								</h3>
							</div>
							{selectedWorkflowTemplate ? (
								<div className="mt-3 grid gap-2">
									{selectedWorkflowTemplate.steps.map((step, index) => (
										<div
											key={`${step.id}-${step.tool_name}`}
											className="grid gap-2 rounded-lg border bg-slate-50/70 p-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"
										>
											<div className="flex size-7 items-center justify-center rounded-full border bg-background text-xs font-medium text-muted-foreground">
												{index + 1}
											</div>
											<div className="min-w-0">
												<div className="font-medium">{step.title}</div>
											</div>
											<Badge variant="outline" className="w-fit font-mono">
												{step.tool_name}
											</Badge>
										</div>
									))}
								</div>
							) : (
								<div className="mt-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
									{t('platform.workflowRunner.noTemplates')}
								</div>
							)}
						</section>
					</div>

					<aside className="grid gap-4 xl:sticky xl:top-20">
						<section className="rounded-lg border bg-background p-4 shadow-sm">
							<div className="flex items-center gap-2 border-b pb-3">
								<CheckCircle2 className="size-4 text-muted-foreground" />
								<h3 className="text-sm font-semibold">
									{t('platform.workflowRunner.summary')}
								</h3>
							</div>
							{workflowRunResult ? (
								<div className="mt-4 grid gap-4">
									<div className="rounded-lg border bg-slate-50/70 p-3">
										<div className="flex flex-wrap items-center gap-2">
											<Badge variant="outline">
												{workflowRunResult.workflow_name}
											</Badge>
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
															variant={
																step.status === 'failed'
																	? 'destructive'
																	: 'outline'
															}
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
													</div>
													{step.result ? (
														<pre className="mt-3 max-h-36 overflow-auto rounded-md border bg-muted/20 p-3 text-xs leading-5">
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
										<pre className="max-h-44 overflow-auto rounded-lg border bg-muted/20 p-3 text-xs leading-5">
											{JSON.stringify(workflowRunResult.tool_calls, null, 2)}
										</pre>
									</div>
								</div>
							) : (
								<div className="mt-4 flex min-h-40 items-center rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
									{t('platform.workflowRunner.emptyResult')}
								</div>
							)}
						</section>

						<section className="rounded-lg border bg-background p-4 shadow-sm">
							<div className="flex items-center gap-2 border-b pb-3">
								<FileClock className="size-4 text-muted-foreground" />
								<h3 className="text-sm font-semibold">
									{t('platform.workflowRunner.history')}
								</h3>
							</div>
							{workflowRunsLoading ? (
								<div className="mt-3 grid gap-2">
									{[0, 1].map((item) => (
										<Skeleton key={item} className="h-16 rounded-lg" />
									))}
								</div>
							) : recentWorkflowRuns.length === 0 ? (
								<div className="mt-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
									{t('platform.workflowRunner.historyEmpty')}
								</div>
							) : (
								<div className="mt-3 grid gap-2">
									{recentWorkflowRuns.map((run) => (
										<div key={run.run_id} className="rounded-lg border p-3">
											<div className="flex flex-wrap items-center gap-2">
												<Badge
													variant={
														run.status === 'failed' ? 'destructive' : 'outline'
													}
													className={cn(workflowStatusClassName(run.status))}
												>
													{t(
														`platform.workflowRunner.${workflowStatusLabelKey(run.status)}`,
													)}
												</Badge>
												<span className="min-w-0 truncate text-sm font-medium">
													{run.workflow_name}
												</span>
											</div>
											<div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
												<Clock3 className="size-3.5" />
												<span>{formatTimestamp(run.finished_at)}</span>
											</div>
										</div>
									))}
								</div>
							)}
						</section>
					</aside>
				</section>
			</TabsContent>

			<TabsContent value="templates" className="mt-0">
				<section className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm">
					<div className="flex items-start gap-3">
						<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/30">
							<ListChecks className="size-4 text-muted-foreground" />
						</div>
						<div className="min-w-0">
							<h3 className="text-sm font-semibold">
								{t('platform.workflowRunner.templates')}
							</h3>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{t('platform.workflowRunner.templatesDescription')}
							</p>
						</div>
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
										className="rounded-lg border bg-slate-50/70 p-3"
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
												<p className="mt-1 text-xs leading-5 text-muted-foreground">
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
				</section>
			</TabsContent>

			<TabsContent value="history" className="mt-0">
				<section className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm">
					<div className="flex items-start gap-3">
						<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/30">
							<History className="size-4 text-muted-foreground" />
						</div>
						<div className="min-w-0">
							<h3 className="text-sm font-semibold">
								{t('platform.workflowRunner.history')}
							</h3>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{t('platform.workflowRunner.historyDescription')}
							</p>
						</div>
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
				</section>
			</TabsContent>
		</Tabs>
	);
}
