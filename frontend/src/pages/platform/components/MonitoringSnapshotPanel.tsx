import {
	Activity,
	BotMessageSquare,
	RefreshCcw,
	ShieldCheck,
	Workflow,
} from 'lucide-react';
import type { ComponentType } from 'react';

import type {
	EnterpriseAgentRunResponse,
	EnterpriseAuditEvent,
	EnterpriseWorkflowRunHistoryItem,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { formatTimestamp } from '../platform-utils';
import { StateBadge, type HealthState } from './common';

export interface MonitoringStat {
	label: string;
	value: number;
	helper: string;
	icon: ComponentType<{ className?: string }>;
}

export interface MonitoringAgentTurn {
	id: string;
	agentId: string;
	question: string;
	answer: string;
	createdAt: string;
	response: EnterpriseAgentRunResponse;
}

interface MonitoringSnapshotPanelProps {
	healthState: HealthState;
	loading: boolean;
	stats: MonitoringStat[];
	recentAgentTurns: MonitoringAgentTurn[];
	recentWorkflowRuns: EnterpriseWorkflowRunHistoryItem[];
	recentAuditEvents: EnterpriseAuditEvent[];
	onRefresh: () => void;
	onSelectAgentTurn: (turn: MonitoringAgentTurn) => void;
	onRunAgent: () => void;
	onRunWorkflow: () => void;
	onOpenGovernance: () => void;
	workflowStatusLabelKey: (status?: string) => string;
	workflowStatusClassName: (status?: string) => string;
	labels: {
		eyebrow: string;
		title: string;
		description: string;
		state: string;
		refresh: string;
		runAgent: string;
		runWorkflow: string;
		openGovernance: string;
		recentAgentRuns: string;
		recentAgentRunsHelper: string;
		emptyAgentRuns: string;
		recentWorkflowRuns: string;
		recentWorkflowRunsHelper: string;
		emptyWorkflowRuns: string;
		recentAudit: string;
		recentAuditHelper: string;
		emptyAudit: string;
		auditEvent: string;
		failure: string;
		success: string;
		workflowStatus: (key: string) => string;
	};
}

export function MonitoringSnapshotPanel({
	healthState,
	loading,
	stats,
	recentAgentTurns,
	recentWorkflowRuns,
	recentAuditEvents,
	onRefresh,
	onSelectAgentTurn,
	onRunAgent,
	onRunWorkflow,
	onOpenGovernance,
	workflowStatusLabelKey,
	workflowStatusClassName,
	labels,
}: MonitoringSnapshotPanelProps) {
	return (
		<section className="grid gap-4 rounded-lg border bg-background p-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<Activity className="size-4" />
						<span>{labels.eyebrow}</span>
					</div>
					<h2 className="text-base font-semibold">{labels.title}</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{labels.description}
					</p>
				</div>
				<div className="flex flex-wrap gap-2 lg:justify-end">
					<StateBadge state={healthState} label={labels.state} />
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
					<Button type="button" size="sm" variant="outline" onClick={onRunAgent}>
						<BotMessageSquare className="size-4" />
						{labels.runAgent}
					</Button>
					<Button type="button" size="sm" variant="outline" onClick={onRunWorkflow}>
						<Workflow className="size-4" />
						{labels.runWorkflow}
					</Button>
					<Button type="button" size="sm" onClick={onOpenGovernance}>
						<ShieldCheck className="size-4" />
						{labels.openGovernance}
					</Button>
				</div>
			</div>

			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				{stats.map((stat) => {
					const StatIcon = stat.icon;

					return (
						<div key={stat.label} className="grid gap-3 rounded-lg border bg-muted/10 p-3">
							<div className="flex items-center justify-between gap-3">
								<div className="text-sm font-medium">{stat.label}</div>
								<div className="grid size-8 place-items-center rounded-md border bg-background">
									<StatIcon className="size-4 text-muted-foreground" />
								</div>
							</div>
							<div className="text-2xl font-semibold tracking-normal">{stat.value}</div>
							<p className="text-xs leading-5 text-muted-foreground">{stat.helper}</p>
						</div>
					);
				})}
			</div>

			<div className="grid gap-3 lg:grid-cols-3">
				<div className="grid gap-3 rounded-lg border bg-muted/10 p-3">
					<div>
						<h3 className="text-sm font-medium">{labels.recentAgentRuns}</h3>
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							{labels.recentAgentRunsHelper}
						</p>
					</div>
					{recentAgentTurns.length === 0 ? (
						<div className="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
							{labels.emptyAgentRuns}
						</div>
					) : (
						<div className="grid gap-2">
							{recentAgentTurns.map((turn) => (
								<button
									key={turn.id}
									type="button"
									onClick={() => onSelectAgentTurn(turn)}
									className="rounded-md border bg-background p-3 text-left text-xs transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									<div className="flex items-center justify-between gap-2">
										<span className="truncate font-medium">{turn.question}</span>
										<span className="shrink-0 text-muted-foreground">
											{formatTimestamp(turn.createdAt)}
										</span>
									</div>
									<p className="mt-1 line-clamp-2 leading-5 text-muted-foreground">
										{turn.answer}
									</p>
								</button>
							))}
						</div>
					)}
				</div>

				<div className="grid gap-3 rounded-lg border bg-muted/10 p-3">
					<div>
						<h3 className="text-sm font-medium">{labels.recentWorkflowRuns}</h3>
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							{labels.recentWorkflowRunsHelper}
						</p>
					</div>
					{recentWorkflowRuns.length === 0 ? (
						<div className="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
							{labels.emptyWorkflowRuns}
						</div>
					) : (
						<div className="grid gap-2">
							{recentWorkflowRuns.slice(0, 3).map((run) => (
								<button
									key={run.run_id}
									type="button"
									onClick={onRunWorkflow}
									className="rounded-md border bg-background p-3 text-left text-xs transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									<div className="flex items-center justify-between gap-2">
										<span className="truncate font-medium">{run.workflow_name}</span>
										<Badge
											variant="outline"
											className={workflowStatusClassName(run.status)}
										>
											{labels.workflowStatus(workflowStatusLabelKey(run.status))}
										</Badge>
									</div>
									<p className="mt-1 line-clamp-2 leading-5 text-muted-foreground">
										{run.summary || formatTimestamp(run.finished_at || run.started_at)}
									</p>
								</button>
							))}
						</div>
					)}
				</div>

				<div className="grid gap-3 rounded-lg border bg-muted/10 p-3">
					<div>
						<h3 className="text-sm font-medium">{labels.recentAudit}</h3>
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							{labels.recentAuditHelper}
						</p>
					</div>
					{recentAuditEvents.length === 0 ? (
						<div className="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
							{labels.emptyAudit}
						</div>
					) : (
						<div className="grid gap-2">
							{recentAuditEvents.slice(0, 3).map((event, index) => (
								<button
									key={event.event_id ?? `${event.timestamp}-${index}`}
									type="button"
									onClick={onOpenGovernance}
									className="rounded-md border bg-background p-3 text-left text-xs transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									<div className="flex items-center justify-between gap-2">
										<span className="truncate font-medium">
											{event.tool_name || event.event_type || labels.auditEvent}
										</span>
										<Badge
											variant="outline"
											className={
												event.success === false
													? ''
													: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
											}
										>
											{event.success === false ? labels.failure : labels.success}
										</Badge>
									</div>
									<p className="mt-1 truncate text-muted-foreground">
										{event.user_id || '-'} · {event.tenant || '-'} ·{' '}
										{formatTimestamp(event.timestamp)}
									</p>
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
