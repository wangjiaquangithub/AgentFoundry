import {
	Activity,
	BotMessageSquare,
	RefreshCcw,
	ShieldCheck,
	Workflow,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import type {
	EnterpriseAuditEvent,
	EnterprisePublishedAgent,
	EnterpriseToolCatalogItem,
	EnterpriseWorkflowRunHistoryItem,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
	MonitoringAgentTurn,
	MonitoringStat,
} from './MonitoringSnapshotPanel';
import { AuditEventsPanel } from './AuditEventsPanel';
import { StateBadge, type HealthState } from './common';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface AuditFilters {
	tenant: string;
	user_id: string;
	agent_id: string;
	tool_name: string;
	success: string;
	limit: string;
}

interface AuditStatItem {
	label: string;
	value: string | number;
}

interface RunsViewPageProps {
	monitoringHealthState: HealthState;
	monitoringLoading: boolean;
	monitoringStats: MonitoringStat[];
	recentAgentTurns: MonitoringAgentTurn[];
	recentWorkflowRuns: EnterpriseWorkflowRunHistoryItem[];
	recentAuditEvents: EnterpriseAuditEvent[];
	auditFilters: AuditFilters;
	auditLoading: boolean;
	auditError: string | null;
	auditEvents: EnterpriseAuditEvent[];
	auditStats: AuditStatItem[];
	activePlatformAgents: EnterprisePublishedAgent[];
	availableToolItems: EnterpriseToolCatalogItem[];
	currentTenant?: string;
	currentUserId?: string;
	username: string;
	onRefreshMonitoring: () => void | Promise<void>;
	onSelectAgentTurn: (turn: MonitoringAgentTurn) => void;
	onRunAgent: () => void;
	onRunWorkflow: () => void;
	onOpenGovernance: () => void;
	onAuditFiltersChange: Dispatch<SetStateAction<AuditFilters>>;
	onRefetchAuditEvents: () => void | Promise<void>;
	formatTimestamp: (value?: string) => string;
	workflowStatusClassName: (status?: string) => string;
	workflowStatusLabelKey: (status?: string) => string;
	summarizeAuditObject: (value?: Record<string, unknown>) => string;
	t: Translate;
}

export function RunsViewPage({
	monitoringHealthState,
	monitoringLoading,
	monitoringStats,
	recentAgentTurns,
	recentWorkflowRuns,
	recentAuditEvents,
	auditFilters,
	auditLoading,
	auditError,
	auditEvents,
	auditStats,
	activePlatformAgents,
	availableToolItems,
	currentTenant,
	currentUserId,
	username,
	onRefreshMonitoring,
	onSelectAgentTurn,
	onRunAgent,
	onRunWorkflow,
	onOpenGovernance,
	onAuditFiltersChange,
	onRefetchAuditEvents,
	formatTimestamp,
	workflowStatusClassName,
	workflowStatusLabelKey,
	summarizeAuditObject,
	t,
}: RunsViewPageProps) {
	return (
		<main className="h-full overflow-y-auto bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
				<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0">
						<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
							<Activity className="size-4" />
							<span>{t('platform.monitoring.eyebrow')}</span>
						</div>
						<h1 className="text-2xl font-semibold tracking-normal">
							{t('platform.monitoring.title')}
						</h1>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
							{t('platform.monitoring.description')}
						</p>
					</div>
					<div className="flex flex-wrap gap-2 lg:justify-end">
						<StateBadge
							state={monitoringHealthState}
							label={t(
								`platform.agentManagement.wizard.states.${monitoringHealthState}`,
							)}
						/>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => void onRefreshMonitoring()}
							disabled={monitoringLoading}
						>
							<RefreshCcw
								className={cn('size-4', monitoringLoading && 'animate-spin')}
							/>
							{t('platform.monitoring.refresh')}
						</Button>
						<Button type="button" size="sm" variant="outline" onClick={onRunAgent}>
							<BotMessageSquare className="size-4" />
							{t('platform.monitoring.runAgent')}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onRunWorkflow}
						>
							<Workflow className="size-4" />
							{t('platform.monitoring.runWorkflow')}
						</Button>
						<Button type="button" size="sm" onClick={onOpenGovernance}>
							<ShieldCheck className="size-4" />
							{t('platform.monitoring.openGovernance')}
						</Button>
					</div>
				</section>

				<section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					{monitoringStats.map((stat) => {
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
				</section>

				<section className="grid gap-3 lg:grid-cols-3">
					<div className="grid content-start gap-3 rounded-lg border bg-muted/10 p-3">
						<div>
							<h2 className="text-sm font-medium">
								{t('platform.monitoring.recentAgentRuns')}
							</h2>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{t('platform.monitoring.recentAgentRunsHelper')}
							</p>
						</div>
						{recentAgentTurns.length === 0 ? (
							<div className="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
								{t('platform.monitoring.emptyAgentRuns')}
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

					<div className="grid content-start gap-3 rounded-lg border bg-muted/10 p-3">
						<div>
							<h2 className="text-sm font-medium">
								{t('platform.monitoring.recentWorkflowRuns')}
							</h2>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{t('platform.monitoring.recentWorkflowRunsHelper')}
							</p>
						</div>
						{recentWorkflowRuns.length === 0 ? (
							<div className="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
								{t('platform.monitoring.emptyWorkflowRuns')}
							</div>
						) : (
							<div className="grid gap-2">
								{recentWorkflowRuns.slice(0, 6).map((run) => (
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
												{t(
													`platform.workflowRunner.${workflowStatusLabelKey(run.status)}`,
												)}
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

					<div className="grid content-start gap-3 rounded-lg border bg-muted/10 p-3">
						<div>
							<h2 className="text-sm font-medium">
								{t('platform.monitoring.recentAudit')}
							</h2>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{t('platform.monitoring.recentAuditHelper')}
							</p>
						</div>
						{recentAuditEvents.length === 0 ? (
							<div className="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
								{t('platform.monitoring.emptyAudit')}
							</div>
						) : (
							<div className="grid gap-2">
								{recentAuditEvents.slice(0, 6).map((event, index) => (
									<div
										key={event.event_id ?? `${event.timestamp}-${index}`}
										className="rounded-md border bg-background p-3 text-xs"
									>
										<div className="flex items-center justify-between gap-2">
											<span className="truncate font-medium">
												{event.tool_name ||
													event.event_type ||
													t('platform.monitoring.auditEvent')}
											</span>
											<Badge
												variant="outline"
												className={
													event.success === false
														? ''
														: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
												}
											>
												{event.success === false
													? t('platform.monitoring.failure')
													: t('platform.monitoring.success')}
											</Badge>
										</div>
										<p className="mt-1 truncate text-muted-foreground">
											{event.user_id || '-'} · {event.tenant || '-'} ·{' '}
											{formatTimestamp(event.timestamp)}
										</p>
									</div>
								))}
							</div>
						)}
					</div>
				</section>

				<AuditEventsPanel
					auditFilters={auditFilters}
					activePlatformAgents={activePlatformAgents}
					availableToolItems={availableToolItems}
					currentTenant={currentTenant}
					currentUserId={currentUserId}
					username={username}
					auditLoading={auditLoading}
					auditError={auditError}
					auditEvents={auditEvents}
					auditStats={auditStats}
					onAuditFiltersChange={onAuditFiltersChange}
					onRefetchAuditEvents={onRefetchAuditEvents}
					summarizeAuditObject={summarizeAuditObject}
					t={t}
				/>
			</div>
		</main>
	);
}
