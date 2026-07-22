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

import {
	formatTimestamp,
	workflowStatusClassName,
	workflowStatusLabelKey,
} from '../platform-utils';
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
	labels,
}: MonitoringSnapshotPanelProps) {
	const activityItems = [
		...recentAgentTurns.map((turn) => ({
			id: `agent-${turn.id}`,
			type: labels.recentAgentRuns,
			title: turn.question,
			description: turn.answer,
			timestamp: turn.createdAt,
			status: null as string | null,
			statusClassName: '',
			onClick: () => onSelectAgentTurn(turn),
		})),
		...recentWorkflowRuns.slice(0, 4).map((run) => ({
			id: `workflow-${run.run_id}`,
			type: labels.recentWorkflowRuns,
			title: run.workflow_name,
			description: run.summary || formatTimestamp(run.finished_at || run.started_at),
			timestamp: run.finished_at || run.started_at,
			status: labels.workflowStatus(workflowStatusLabelKey(run.status)),
			statusClassName: workflowStatusClassName(run.status),
			onClick: onRunWorkflow,
		})),
		...recentAuditEvents.slice(0, 4).map((event, index) => ({
			id: `audit-${event.event_id ?? `${event.timestamp}-${index}`}`,
			type: labels.recentAudit,
			title: event.tool_name || event.event_type || labels.auditEvent,
			description: `${event.user_id || '-'} · ${event.tenant || '-'}`,
			timestamp: event.timestamp,
			status: event.success === false ? labels.failure : labels.success,
			statusClassName:
				event.success === false
					? ''
					: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
			onClick: onOpenGovernance,
		})),
	]
		.sort(
			(a, b) =>
				new Date(b.timestamp || 0).getTime() -
				new Date(a.timestamp || 0).getTime(),
		)
		.slice(0, 8);

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
						<div key={stat.label} className="grid gap-3 rounded-lg border bg-background p-3">
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

			<div className="rounded-lg border bg-background">
				<div className="border-b px-4 py-3">
					<h3 className="text-sm font-medium">{labels.recentAudit}</h3>
					<p className="mt-1 text-xs leading-5 text-muted-foreground">
						{labels.recentAgentRunsHelper} · {labels.recentWorkflowRunsHelper} ·{' '}
						{labels.recentAuditHelper}
					</p>
				</div>
				{activityItems.length === 0 ? (
					<div className="m-4 rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
						{labels.emptyAgentRuns} / {labels.emptyWorkflowRuns} / {labels.emptyAudit}
					</div>
				) : (
					<div className="divide-y">
						{activityItems.map((item) => (
							<button
								key={item.id}
								type="button"
								onClick={item.onClick}
								className="grid w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[7rem_minmax(0,1fr)_auto]"
							>
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="bg-background">
										{item.type}
									</Badge>
								</div>
								<div className="min-w-0">
									<div className="truncate text-sm font-medium">{item.title}</div>
									<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
										{item.description}
									</p>
								</div>
								<div className="flex items-center gap-2 sm:justify-end">
									{item.status ? (
										<Badge variant="outline" className={item.statusClassName}>
											{item.status}
										</Badge>
									) : null}
									<span className="shrink-0 text-xs text-muted-foreground">
										{formatTimestamp(item.timestamp)}
									</span>
								</div>
							</button>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
