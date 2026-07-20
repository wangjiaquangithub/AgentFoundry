import { Play, RefreshCcw, Workflow } from 'lucide-react';

import type { EnterprisePlatformScenario } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTimestamp } from '../platform-utils';
import { PlatformNotice, StateBadge } from './common';

interface ScenariosPanelProps {
	scenarios: EnterprisePlatformScenario[];
	loading: boolean;
	error: string | null;
	runningWorkflow: boolean;
	onRefresh: () => void;
	onRunScenario: (scenario: EnterprisePlatformScenario) => void;
	labels: {
		eyebrow: string;
		title: string;
		description: string;
		total: (count: number) => string;
		readyCount: (count: number) => string;
		refresh: string;
		empty: string;
		ready: string;
		partial: string;
		blocked: string;
		lastRun: (status: string, time: string) => string;
		neverRun: string;
		toolCount: (count: number) => string;
		runCount: (count: number) => string;
		approvalRequired: string;
		noApproval: string;
		pendingApprovals: (count: number) => string;
		running: string;
		run: string;
	};
}

export function ScenariosPanel({
	scenarios,
	loading,
	error,
	runningWorkflow,
	onRefresh,
	onRunScenario,
	labels,
}: ScenariosPanelProps) {
	const readyCount = scenarios.filter((item) => item.status === 'ready').length;

	return (
		<section className="grid gap-4 rounded-lg border bg-background p-4">
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
					<Badge variant="outline">{labels.total(scenarios.length)}</Badge>
					<Badge variant="outline">{labels.readyCount(readyCount)}</Badge>
					<Button type="button" size="sm" variant="outline" onClick={onRefresh}>
						<RefreshCcw className="size-4" />
						{labels.refresh}
					</Button>
				</div>
			</div>

			{error ? <PlatformNotice>{error}</PlatformNotice> : null}

			{loading ? (
				<div className="grid gap-3 md:grid-cols-3">
					{[0, 1, 2].map((item) => (
						<Skeleton key={item} className="h-48 rounded-lg" />
					))}
				</div>
			) : scenarios.length === 0 ? (
				<div className="rounded-lg border border-dashed bg-background/80 p-4 text-sm text-muted-foreground">
					{labels.empty}
				</div>
			) : (
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					{scenarios.map((scenario) => {
						const statusLabel =
							scenario.status === 'ready'
								? labels.ready
								: scenario.status === 'partial'
									? labels.partial
									: labels.blocked;
						const lastRunLabel = scenario.last_run
							? labels.lastRun(
									scenario.last_run.status,
									formatTimestamp(
										scenario.last_run.finished_at || scenario.last_run.started_at,
									),
								)
							: labels.neverRun;

						return (
							<div
								key={scenario.scenario_id}
								className="grid content-between gap-4 rounded-lg border bg-background p-3"
							>
								<div className="grid gap-3">
									<div className="flex items-start justify-between gap-3">
										<div className="flex size-9 items-center justify-center rounded-lg border bg-background">
											<Workflow className="size-4 text-muted-foreground" />
										</div>
										<StateBadge state={scenario.status} label={statusLabel} />
									</div>
									<div className="min-w-0">
										<h3 className="text-sm font-medium">{scenario.name}</h3>
										<p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
											{scenario.description}
										</p>
									</div>
									<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
										<Badge variant="outline">
											{labels.toolCount(scenario.tools.length)}
										</Badge>
										<Badge variant="outline">
											{labels.runCount(scenario.run_count)}
										</Badge>
										<Badge variant="outline">
											{scenario.approval_required
												? labels.approvalRequired
												: labels.noApproval}
										</Badge>
										{scenario.pending_approval_count > 0 ? (
											<Badge variant="outline">
												{labels.pendingApprovals(scenario.pending_approval_count)}
											</Badge>
										) : null}
									</div>
									<p className="text-xs text-muted-foreground">{lastRunLabel}</p>
								</div>
								<Button
									type="button"
									size="sm"
									onClick={() => onRunScenario(scenario)}
									disabled={runningWorkflow || scenario.status === 'blocked'}
								>
									<Play className="size-4" />
									{runningWorkflow ? labels.running : labels.run}
								</Button>
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
