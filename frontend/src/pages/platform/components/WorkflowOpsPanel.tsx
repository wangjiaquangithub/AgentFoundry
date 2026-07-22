import {
	ArrowRight,
	FileClock,
	ListChecks,
	Play,
	ShieldCheck,
	Workflow,
} from 'lucide-react';

import type {
	EnterpriseApprovalRequestItem,
	EnterpriseWorkflowRunHistoryItem,
	EnterpriseWorkflowTemplate,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
	workflowStatusClassName,
	workflowStatusLabelKey,
} from '../platform-utils';

export interface WorkflowOpsStat {
	label: string;
	value: number;
}

interface WorkflowOpsPanelProps {
	stats: WorkflowOpsStat[];
	selectedWorkflowName: string;
	selectedWorkflowTemplate: EnterpriseWorkflowTemplate | null;
	selectedWorkflowSteps: EnterpriseWorkflowTemplate['steps'];
	selectedWorkflowDisabled: boolean;
	selectedWorkflowLastRun: EnterpriseWorkflowRunHistoryItem | null;
	workflowPendingApprovals: EnterpriseApprovalRequestItem[];
	creatingRunApproval: string | null;
	runningWorkflow: boolean;
	onCreateRunApproval: (requestType: 'workflow_run') => void;
	onRunWorkflow: () => void;
	onScrollToWorkflowRunner: () => void;
	onScrollToGovernance: () => void;
	onUseApproval: (approval: EnterpriseApprovalRequestItem) => void;
	labels: {
		eyebrow: string;
		title: string;
		description: string;
		requestingApproval: string;
		requestApproval: string;
		running: string;
		runCurrent: string;
		fallbackDescription: string;
		disabled: string;
		enabled: string;
		stepPreview: string;
		noSteps: string;
		editInputs: string;
		viewAudit: string;
		latestRun: string;
		history: string;
		status: (key: string) => string;
		noRuns: string;
		approvalQueue: string;
		review: string;
		noApprovals: string;
	};
}

export function WorkflowOpsPanel({
	stats,
	selectedWorkflowName,
	selectedWorkflowTemplate,
	selectedWorkflowSteps,
	selectedWorkflowDisabled,
	selectedWorkflowLastRun,
	workflowPendingApprovals,
	creatingRunApproval,
	runningWorkflow,
	onCreateRunApproval,
	onRunWorkflow,
	onScrollToWorkflowRunner,
	onScrollToGovernance,
	onUseApproval,
	labels,
}: WorkflowOpsPanelProps) {
	return (
		<section className="grid gap-4 border-t py-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<Workflow className="size-4" />
						<span>{labels.eyebrow}</span>
					</div>
					<h2 className="text-base font-semibold">{labels.title}</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{labels.description}
					</p>
				</div>
				<div className="flex flex-wrap gap-2 lg:justify-end">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => onCreateRunApproval('workflow_run')}
						disabled={creatingRunApproval === 'workflow_run'}
					>
						<ShieldCheck className="size-4" />
						{creatingRunApproval === 'workflow_run'
							? labels.requestingApproval
							: labels.requestApproval}
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={onRunWorkflow}
						disabled={runningWorkflow || selectedWorkflowDisabled}
					>
						<Play className="size-4" />
						{runningWorkflow ? labels.running : labels.runCurrent}
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-2 md:grid-cols-4">
				{stats.map((item) => (
					<div key={item.label} className="rounded-md border bg-background px-3 py-2">
						<div className="text-xs text-muted-foreground">{item.label}</div>
						<div className="mt-1 text-lg font-semibold tabular-nums">{item.value}</div>
					</div>
				))}
			</div>

			<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)_minmax(18rem,0.85fr)]">
				<div className="grid gap-3 rounded-lg border bg-background p-3">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<h3 className="truncate text-sm font-medium">{selectedWorkflowName}</h3>
							<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
								{selectedWorkflowTemplate?.description ?? labels.fallbackDescription}
							</p>
						</div>
						<Badge
							variant="outline"
							className={cn(
								selectedWorkflowDisabled
									? 'border-slate-500/30 bg-slate-500/10 text-slate-700'
									: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
							)}
						>
							{selectedWorkflowDisabled ? labels.disabled : labels.enabled}
						</Badge>
					</div>

					<div className="grid gap-2">
						<div className="text-xs font-medium text-muted-foreground">
							{labels.stepPreview}
						</div>
						{selectedWorkflowSteps.length === 0 ? (
							<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
								{labels.noSteps}
							</div>
						) : (
							<div className="grid gap-2">
								{selectedWorkflowSteps.slice(0, 4).map((step, index) => (
									<div
										key={step.id}
										className="flex items-center justify-between gap-3 rounded-md border bg-background px-2 py-1.5 text-xs"
									>
										<span className="min-w-0 truncate">
											{index + 1}. {step.title}
										</span>
										<Badge variant="secondary" className="max-w-48 truncate">
											{step.tool_name}
										</Badge>
									</div>
								))}
							</div>
						)}
					</div>

					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onScrollToWorkflowRunner}
						>
							<ListChecks className="size-4" />
							{labels.editInputs}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onScrollToGovernance}
						>
							<FileClock className="size-4" />
							{labels.viewAudit}
						</Button>
					</div>
				</div>

				<div className="grid content-start gap-3 rounded-lg border bg-background p-3">
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-sm font-medium">{labels.latestRun}</h3>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							onClick={onScrollToWorkflowRunner}
						>
							{labels.history}
							<ArrowRight className="size-4" />
						</Button>
					</div>
					{selectedWorkflowLastRun ? (
						<div className="grid gap-2 text-sm">
							<div className="flex items-center justify-between gap-3">
								<span className="min-w-0 truncate font-medium">
									{selectedWorkflowLastRun.workflow_name}
								</span>
								<Badge
									variant="outline"
									className={workflowStatusClassName(selectedWorkflowLastRun.status)}
								>
									{labels.status(workflowStatusLabelKey(selectedWorkflowLastRun.status))}
								</Badge>
							</div>
							<p className="line-clamp-3 text-xs leading-5 text-muted-foreground">
								{selectedWorkflowLastRun.summary}
							</p>
							<div className="text-xs text-muted-foreground">
								{selectedWorkflowLastRun.tenant} · {selectedWorkflowLastRun.user_id}
							</div>
						</div>
					) : (
						<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
							{labels.noRuns}
						</div>
					)}
				</div>

				<div className="grid content-start gap-3 rounded-lg border bg-background p-3">
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-sm font-medium">{labels.approvalQueue}</h3>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							onClick={onScrollToGovernance}
						>
							{labels.review}
							<ArrowRight className="size-4" />
						</Button>
					</div>
					{workflowPendingApprovals.length === 0 ? (
						<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
							{labels.noApprovals}
						</div>
					) : (
						<div className="grid gap-2">
							{workflowPendingApprovals.slice(0, 3).map((approval) => (
								<button
									key={approval.approval_id}
									type="button"
									className="grid gap-1 rounded-md border bg-background px-2 py-1.5 text-left text-xs transition hover:border-primary/30 hover:bg-primary/5"
									onClick={() => onUseApproval(approval)}
								>
									<span className="truncate font-medium">
										{approval.workflow_type ?? approval.request_type}
									</span>
									<span className="truncate text-muted-foreground">
										{approval.user_id} · {approval.tenant}
									</span>
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
