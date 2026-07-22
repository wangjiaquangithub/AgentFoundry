import { ArrowRight, ListChecks, RefreshCcw } from 'lucide-react';

import type {
	EnterprisePlatformOpsTask,
	EnterprisePlatformOpsTasksResponse,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { PlatformNotice, StateBadge, type HealthState } from './common';

interface OpsTasksPanelProps {
	tasks: EnterprisePlatformOpsTask[];
	summary: EnterprisePlatformOpsTasksResponse['summary'] | null;
	loading: boolean;
	error: string | null;
	resolvingTaskCode: string | null;
	onRefresh: () => void;
	onResolveTask: (task: EnterprisePlatformOpsTask) => void;
	summarizeAuditObject: (value?: Record<string, unknown>) => string;
	labels: {
		eyebrow: string;
		title: string;
		description: string;
		total: (count: number) => string;
		errors: (count: number) => string;
		warnings: (count: number) => string;
		refresh: string;
		empty: string;
		resolve: string;
		action: string;
		resolving: string;
	};
}

export function OpsTasksPanel({
	tasks,
	summary,
	loading,
	error,
	resolvingTaskCode,
	onRefresh,
	onResolveTask,
	summarizeAuditObject,
	labels,
}: OpsTasksPanelProps) {
	return (
		<section className="grid gap-4 border-t py-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<ListChecks className="size-4" />
						<span>{labels.eyebrow}</span>
					</div>
					<h2 className="text-base font-semibold">{labels.title}</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{labels.description}
					</p>
				</div>
				<div className="flex flex-wrap gap-2 lg:justify-end">
					<Badge variant="outline">{labels.total(summary?.total_count ?? tasks.length)}</Badge>
					<Badge variant="outline">{labels.errors(summary?.error_count ?? 0)}</Badge>
					<Badge variant="outline">{labels.warnings(summary?.warning_count ?? 0)}</Badge>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onRefresh}
						disabled={loading}
					>
						<RefreshCcw className={cn('size-4', loading && 'animate-spin')} />
						{labels.refresh}
					</Button>
				</div>
			</div>

			{error ? <PlatformNotice>{error}</PlatformNotice> : null}

			{loading ? (
				<div className="grid gap-3 md:grid-cols-2">
					{[0, 1, 2].map((item) => (
						<Skeleton key={item} className="h-36 rounded-lg" />
					))}
				</div>
			) : tasks.length === 0 ? (
				<div className="rounded-lg border border-dashed bg-background/80 p-4 text-sm text-muted-foreground">
					{labels.empty}
				</div>
			) : (
				<div className="grid gap-3 md:grid-cols-2">
					{tasks.map((task) => {
						const taskState: HealthState =
							task.severity === 'error'
								? 'blocked'
								: task.severity === 'warning'
									? 'partial'
									: 'ready';
						const evidence = summarizeAuditObject(task.evidence);
						const isResolving = resolvingTaskCode === task.code;
						const actionLabel =
							task.action?.type === 'resolve'
								? task.action.label || labels.resolve
								: labels.action;

						return (
							<div
								key={task.task_id}
								className="grid content-between gap-3 rounded-lg border bg-background p-3"
							>
								<div className="grid gap-2">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<h3 className="text-sm font-medium">{task.title}</h3>
											<p className="mt-1 text-xs leading-5 text-muted-foreground">
												{task.description}
											</p>
										</div>
										<StateBadge state={taskState} label={task.severity} />
									</div>
									<div className="flex flex-wrap gap-2">
										{typeof task.count === 'number' ? (
											<Badge variant="outline">{task.count}</Badge>
										) : null}
										<Badge variant="secondary">{task.target}</Badge>
									</div>
									{evidence ? (
										<p className="text-xs leading-5 text-muted-foreground">{evidence}</p>
									) : null}
								</div>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => onResolveTask(task)}
									disabled={isResolving}
								>
									{isResolving ? labels.resolving : actionLabel}
									{isResolving ? (
										<RefreshCcw className="size-4 animate-spin" />
									) : (
										<ArrowRight className="size-4" />
									)}
								</Button>
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
