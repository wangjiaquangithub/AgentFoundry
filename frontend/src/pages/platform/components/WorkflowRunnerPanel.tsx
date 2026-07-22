import {
	CheckCircle2,
	Clock3,
	FileClock,
	ListChecks,
	Play,
	Workflow,
} from 'lucide-react';
import { useState } from 'react';

import { workflowInputLabelKeys } from '../platform-defaults';
import {
	formatTimestamp,
	workflowInputLabel,
} from '../platform-utils';
import { PlatformConfirmAction } from './PlatformConfirmAction';
import { PlatformEmptyState } from './PlatformEmptyState';
import { PlatformStatusBadge } from './PlatformStatusBadge';
import type {
	EnterpriseWorkflowRunHistoryItem,
	EnterpriseWorkflowRunResponse,
	EnterpriseWorkflowTemplate,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
	const [templatePendingDisable, setTemplatePendingDisable] =
		useState<EnterpriseWorkflowTemplate | null>(null);
	const selectedWorkflowTools = selectedWorkflowTemplate
		? Array.from(
				new Set(selectedWorkflowTemplate.steps.map((step) => step.tool_name)),
			)
		: [];
	const recentWorkflowRuns = workflowRuns.slice(0, 5);
	const pendingDisableTools = templatePendingDisable
		? Array.from(new Set(templatePendingDisable.steps.map((step) => step.tool_name)))
		: [];
	const confirmDisableTemplate = () => {
		if (!templatePendingDisable) {
			return;
		}

		onToggleWorkflowTemplate(templatePendingDisable, false);
		setTemplatePendingDisable(null);
	};

	return (
		<section className="grid items-start gap-4">
			<section className="rounded-lg border bg-background">
				<div className="flex items-center justify-between gap-3 border-b p-4">
					<div className="flex items-center gap-2">
						<Workflow className="size-4 text-muted-foreground" />
						<h2 className="text-sm font-semibold">
							{t('platform.workflowRunner.templates')}
						</h2>
					</div>
					<Badge variant="outline">{workflowTemplates.length}</Badge>
				</div>

				<div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
					{workflowTemplatesLoading ? (
						[0, 1, 2].map((item) => (
							<Skeleton key={item} className="h-24 rounded-lg" />
						))
					) : workflowTemplatesError ? (
						<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{workflowTemplatesError}
						</div>
					) : workflowTemplates.length === 0 ? (
						<PlatformEmptyState
							variant="noData"
							title={t('platform.workflowRunner.noTemplates')}
							description={t('platform.ux.empty.noDataDescription')}
							className="rounded-lg border border-dashed p-3"
						/>
					) : (
						workflowTemplates.map((template) => {
							const isSelected =
								template.workflow_type === selectedWorkflowType;
							const isSaving =
								savingWorkflowType === template.workflow_type;

							return (
								<div
									key={template.workflow_type}
									className={cn(
										'rounded-lg border bg-background p-3 transition-colors hover:border-primary/30 hover:bg-primary/5',
										isSelected && 'border-primary/50 bg-primary/5',
									)}
								>
									<button
										type="button"
										onClick={() =>
											onWorkflowTypeChange(template.workflow_type)
										}
										className="grid w-full gap-2 text-left"
									>
										<div className="flex items-start justify-between gap-2">
											<span className="min-w-0 text-sm font-medium">
												{template.name}
											</span>
											<PlatformStatusBadge
												status={template.enabled ? 'enabled' : 'disabled'}
												label={
													template.enabled
														? t('platform.workflowRunner.enabled')
														: t('platform.workflowRunner.disabled')
												}
											/>
										</div>
										<p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
											{template.description}
										</p>
									</button>
									<div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
										<div className="flex flex-wrap gap-2">
											<Badge variant="secondary">
												{t('platform.workflowRunner.stepsCount', {
													count: template.steps.length,
												})}
											</Badge>
											{isSaving ? (
												<span className="text-xs text-muted-foreground">
													{t('platform.workflowRunner.savingTemplate')}
												</span>
											) : null}
										</div>
										<Switch
											size="sm"
											checked={template.enabled}
											disabled={isSaving}
											onCheckedChange={(checked) => {
												if (checked) {
													onToggleWorkflowTemplate(template, true);
													return;
												}
												setTemplatePendingDisable(template);
											}}
										/>
									</div>
								</div>
							);
						})
					)}
				</div>
			</section>

			<div className="grid gap-4">
				<section className="rounded-lg border bg-background p-4">
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
							<PlatformStatusBadge
								status={selectedWorkflowTemplate.enabled ? 'enabled' : 'disabled'}
								label={
									selectedWorkflowTemplate.enabled
										? t('platform.workflowRunner.enabled')
										: t('platform.workflowRunner.disabled')
								}
							/>
						) : null}
					</div>

					<div className="mt-4 grid gap-4">
						{selectedWorkflowTemplate ? (
							<div className="grid gap-3 border-y bg-background/80 py-3 sm:grid-cols-2">
								<div>
									<div className="text-xs font-medium text-muted-foreground">
										{t('platform.workflowRunner.stepTools')}
									</div>
									<div className="mt-2 flex flex-wrap gap-2">
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

						<div className="grid gap-3 md:grid-cols-2">
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
								placeholder={t('platform.workflowRunner.approvalIdPlaceholder')}
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
					</div>
				</section>

				<section className="rounded-lg border bg-background p-4">
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
									className="grid gap-2 rounded-lg border bg-background p-3 transition-colors hover:border-primary/30 hover:bg-primary/5 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"
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

			<section className="grid gap-4 xl:grid-cols-2">
				<section className="rounded-lg border bg-background p-4">
					<div className="flex items-center gap-2 border-b pb-3">
						<CheckCircle2 className="size-4 text-muted-foreground" />
						<h3 className="text-sm font-semibold">
							{t('platform.workflowRunner.summary')}
						</h3>
					</div>
					{workflowRunResult ? (
						<div className="mt-4 grid gap-4">
							<div className="border-b pb-4">
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
														step.status === 'failed' ? 'destructive' : 'outline'
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
												<details className="mt-3 rounded-md border bg-muted/20">
													<summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
														{t('platform.workflowRunner.summary')}
													</summary>
													<pre className="max-h-36 overflow-auto border-t bg-background p-3 text-xs leading-5">
														{JSON.stringify(step.result, null, 2)}
													</pre>
												</details>
											) : null}
										</div>
									);
								})}
							</div>

							<div className="grid gap-2">
								<div className="text-xs font-medium text-muted-foreground">
									{t('platform.workflowRunner.toolCalls')}
								</div>
								<details className="rounded-lg border bg-muted/20">
									<summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
										{t('platform.workflowRunner.toolCalls')}
									</summary>
									<pre className="max-h-44 overflow-auto border-t bg-background p-3 text-xs leading-5">
										{JSON.stringify(workflowRunResult.tool_calls, null, 2)}
									</pre>
								</details>
							</div>
						</div>
					) : (
						<div className="mt-4 flex min-h-40 items-center rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
							{t('platform.workflowRunner.emptyResult')}
						</div>
					)}
				</section>

				<section className="rounded-lg border bg-background p-4">
					<div className="flex items-center gap-2 border-b pb-3">
						<FileClock className="size-4 text-muted-foreground" />
						<h3 className="text-sm font-semibold">
							{t('platform.workflowRunner.history')}
						</h3>
					</div>
					{workflowRunsLoading ? (
						<div className="mt-3 grid gap-2">
							{[0, 1, 2].map((item) => (
								<Skeleton key={item} className="h-20 rounded-lg" />
							))}
						</div>
					) : workflowRunsError ? (
						<div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{workflowRunsError}
						</div>
					) : recentWorkflowRuns.length === 0 ? (
						<div className="mt-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
							{t('platform.workflowRunner.historyEmpty')}
						</div>
					) : (
						<div className="mt-3 grid max-h-[34rem] gap-2 overflow-auto pr-1">
							{recentWorkflowRuns.map((run) => {
								const counts = run.status_counts ?? {};

								return (
									<div
										key={run.run_id}
										className="rounded-lg border bg-background p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
									>
										<div className="flex flex-wrap items-center gap-2">
											<PlatformStatusBadge status={run.status} t={t} />
											<span className="min-w-0 truncate text-sm font-medium">
												{run.workflow_name}
											</span>
										</div>
										<p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
											{run.summary}
										</p>
										<div className="mt-3 grid gap-1 text-xs text-muted-foreground">
											<div className="flex items-center gap-1">
												<Clock3 className="size-3.5" />
												<span>{formatTimestamp(run.finished_at)}</span>
											</div>
											<div>
												{t('platform.workflowRunner.statusCounts', {
													success: counts.success ?? 0,
													denied: counts.denied ?? 0,
													failed: counts.failed ?? 0,
												})}
											</div>
											<div className="truncate font-mono">
												{run.user_id} / {run.tenant}
											</div>
											<div className="truncate">
												{t('platform.audit.inputs')}: {summarizeAuditObject(run.inputs)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</section>
			</section>
			<PlatformConfirmAction
				open={Boolean(templatePendingDisable)}
				onOpenChange={(open) => {
					if (!open) {
						setTemplatePendingDisable(null);
					}
				}}
				title={t('platform.workflowRunner.confirmDisableTitle')}
				description={t('platform.workflowRunner.confirmDisableBody')}
				actionLabel={t('platform.workflowRunner.confirmDisable')}
				cancelLabel={t('common.cancel')}
				targetLabel={t('platform.ux.confirm.target')}
				targetValue={templatePendingDisable?.name ?? '-'}
				impactScopeLabel={t('platform.ux.confirm.impactScope')}
				impactScope={
					templatePendingDisable
						? t('platform.workflowRunner.disableImpactScope', {
								steps: templatePendingDisable.steps.length,
								tools: pendingDisableTools.length,
							})
						: '-'
				}
				consequenceLabel={t('platform.ux.confirm.consequence')}
				consequence={t('platform.workflowRunner.confirmDisableBody')}
				details={[
					{
						label: t('platform.workflowRunner.workflowType'),
						value: (
							<span className="break-all font-mono">
								{templatePendingDisable?.workflow_type ?? '-'}
							</span>
						),
					},
					{
						label: t('platform.ux.confirm.details'),
						value:
							pendingDisableTools.length > 0 ? (
								<span className="flex flex-wrap gap-2">
									{pendingDisableTools.map((toolName) => (
										<Badge key={toolName} variant="outline">
											{toolName}
										</Badge>
									))}
								</span>
							) : (
								'-'
							),
					},
				]}
				variant="destructive"
				loading={
					templatePendingDisable
						? savingWorkflowType === templatePendingDisable.workflow_type
						: false
				}
				onConfirm={confirmDisableTemplate}
			/>
		</section>
	);
}
