import { ArrowRight, CalendarClock, Play, ShieldCheck } from 'lucide-react';

import type { ScheduleRecord } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTimestamp } from '../platform-utils';

export interface TriggerOpsStat {
	label: string;
	value: number;
}

interface TriggerOpsPanelProps {
	stats: TriggerOpsStat[];
	triggerOpsSummary: string;
	selectedWorkflowName: string;
	recentSchedules: ScheduleRecord[];
	schedulesLoading: boolean;
	schedulesError: Error | null;
	creatingRunApproval: string | null;
	runningWorkflow: boolean;
	selectedWorkflowDisabled: boolean;
	onOpenSchedules: () => void;
	onCreateRunApproval: (requestType: 'workflow_run') => void;
	onRunWorkflow: () => void;
	onScrollToWorkflowRunner: () => void;
	onScrollToGovernance: () => void;
	scheduleFrequencyLabel: (schedule: ScheduleRecord) => string;
	scheduleAgentLabel: (schedule: ScheduleRecord) => string;
	labels: {
		eyebrow: string;
		title: string;
		description: string;
		createSchedule: string;
		requestApproval: string;
		running: string;
		runWorkflow: string;
		triggerPlan: string;
		manualTrigger: string;
		configureWorkflow: string;
		approvalGate: string;
		viewGovernance: string;
		recentSchedules: string;
		openSchedules: string;
		loadFailed: string;
		noSchedules: string;
		enabledStatus: string;
		disabled: string;
		updatedAt: (time: string) => string;
	};
}

export function TriggerOpsPanel({
	stats,
	triggerOpsSummary,
	selectedWorkflowName,
	recentSchedules,
	schedulesLoading,
	schedulesError,
	creatingRunApproval,
	runningWorkflow,
	selectedWorkflowDisabled,
	onOpenSchedules,
	onCreateRunApproval,
	onRunWorkflow,
	onScrollToWorkflowRunner,
	onScrollToGovernance,
	scheduleFrequencyLabel,
	scheduleAgentLabel,
	labels,
}: TriggerOpsPanelProps) {
	return (
		<section className="grid min-w-0 gap-4 rounded-lg border bg-muted/10 p-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<CalendarClock className="size-4" />
						<span>{labels.eyebrow}</span>
					</div>
					<h2 className="text-base font-semibold">{labels.title}</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{labels.description}
					</p>
				</div>
				<div className="grid w-full min-w-0 gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[28rem]">
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="min-w-0 justify-center"
						onClick={onOpenSchedules}
					>
						<CalendarClock className="size-4" />
						<span className="min-w-0 truncate">{labels.createSchedule}</span>
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="min-w-0 justify-center"
						onClick={() => onCreateRunApproval('workflow_run')}
						disabled={creatingRunApproval === 'workflow_run'}
					>
						<ShieldCheck className="size-4" />
						<span className="min-w-0 truncate">{labels.requestApproval}</span>
					</Button>
					<Button
						type="button"
						size="sm"
						className="min-w-0 justify-center"
						onClick={onRunWorkflow}
						disabled={runningWorkflow || selectedWorkflowDisabled}
					>
						<Play className="size-4" />
						<span className="min-w-0 truncate">
							{runningWorkflow ? labels.running : labels.runWorkflow}
						</span>
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

			<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]">
				<div className="grid content-start gap-3 rounded-lg border bg-background p-3">
					<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
						<div className="min-w-0">
							<h3 className="text-sm font-medium">{labels.triggerPlan}</h3>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{triggerOpsSummary}
							</p>
						</div>
						<Badge variant="secondary" className="max-w-full self-start">
							<span className="min-w-0 truncate">{selectedWorkflowName}</span>
						</Badge>
					</div>
					<div className="grid gap-2">
						<div className="grid min-w-0 gap-2 rounded-md bg-muted/30 px-2 py-1.5 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
							<span className="min-w-0 truncate">{labels.manualTrigger}</span>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								className="min-w-0 justify-start sm:justify-center"
								onClick={onScrollToWorkflowRunner}
							>
								<span className="min-w-0 truncate">{labels.configureWorkflow}</span>
								<ArrowRight className="size-4" />
							</Button>
						</div>
						<div className="grid min-w-0 gap-2 rounded-md bg-muted/30 px-2 py-1.5 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
							<span className="min-w-0 truncate">{labels.approvalGate}</span>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								className="min-w-0 justify-start sm:justify-center"
								onClick={onScrollToGovernance}
							>
								<span className="min-w-0 truncate">{labels.viewGovernance}</span>
								<ArrowRight className="size-4" />
							</Button>
						</div>
					</div>
				</div>

				<div className="grid content-start gap-3 rounded-lg border bg-background p-3">
					<div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
						<h3 className="text-sm font-medium">{labels.recentSchedules}</h3>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="min-w-0 justify-start sm:justify-center"
							onClick={onOpenSchedules}
						>
							<span className="min-w-0 truncate">{labels.openSchedules}</span>
							<ArrowRight className="size-4" />
						</Button>
					</div>
					{schedulesLoading ? (
						<div className="grid gap-2">
							<Skeleton className="h-12 w-full" />
							<Skeleton className="h-12 w-full" />
						</div>
					) : schedulesError ? (
						<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
							{labels.loadFailed}
						</div>
					) : recentSchedules.length === 0 ? (
						<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
							{labels.noSchedules}
						</div>
					) : (
						<div className="grid gap-2">
							{recentSchedules.map((schedule) => (
								<div
									key={schedule.id}
									className="grid gap-1 rounded-md bg-muted/30 px-2 py-1.5 text-xs"
								>
									<div className="flex items-center justify-between gap-3">
										<span className="min-w-0 truncate font-medium">
											{schedule.data.name}
										</span>
										<Badge variant={schedule.data.enabled ? 'outline' : 'secondary'}>
											{schedule.data.enabled ? labels.enabledStatus : labels.disabled}
										</Badge>
									</div>
									<div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
										<span>{scheduleFrequencyLabel(schedule)}</span>
										<span>{schedule.data.source}</span>
										<span className="min-w-0 truncate">
											{scheduleAgentLabel(schedule)}
										</span>
									</div>
									<div className="text-muted-foreground">
										{labels.updatedAt(formatTimestamp(schedule.updated_at))}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
