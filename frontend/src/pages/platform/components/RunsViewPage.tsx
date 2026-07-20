import {
	Activity,
	BotMessageSquare,
	ClipboardList,
	FileSearch,
	RefreshCcw,
	ShieldCheck,
	Workflow,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import {
	formatTimestamp,
	workflowStatusClassName,
	workflowStatusLabelKey,
} from '../platform-utils';
import { AuditEventsPanel } from './AuditEventsPanel';
import {
	PlatformPageHeader,
	PlatformPageShell,
	StatCard,
	StateBadge,
	type HealthState,
} from './common';
import type {
	MonitoringAgentTurn,
	MonitoringStat,
} from './MonitoringSnapshotPanel';
import type {
	EnterpriseAuditEvent,
	EnterprisePublishedAgent,
	EnterpriseToolCatalogItem,
	EnterpriseWorkflowRunHistoryItem,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

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
	summarizeAuditObject,
	t,
}: RunsViewPageProps) {
	return (
		<PlatformPageShell>
			<PlatformPageHeader
				icon={Activity}
				eyebrow={t('platform.monitoring.eyebrow')}
				title={t('platform.monitoring.title')}
				description={t('platform.monitoring.description')}
				actions={
					<>
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
					</>
				}
			/>

			<section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				{monitoringStats.map((stat) => {
					const StatIcon = stat.icon;
					return (
						<StatCard
							key={stat.label}
							label={stat.label}
							value={stat.value}
							helper={stat.helper}
							icon={StatIcon}
							loading={monitoringLoading}
						/>
					);
				})}
			</section>

			<Tabs defaultValue="overview" className="grid gap-4">
				<section className="rounded-lg border bg-background p-4 shadow-sm">
					<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
									<Activity className="size-4 text-muted-foreground" />
								</div>
								<h2 className="text-base font-semibold">运行工作区</h2>
							</div>
							<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
								运行摘要和审计检索分区查看，把启动调试、流程运行和治理入口集中在当前工作区。
							</p>
						</div>

						<div className="grid gap-2 sm:grid-cols-3 xl:min-w-[34rem]">
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={onRunAgent}
								className="justify-start"
							>
								<BotMessageSquare className="size-4" />
								{t('platform.monitoring.runAgent')}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={onRunWorkflow}
								className="justify-start"
							>
								<Workflow className="size-4" />
								{t('platform.monitoring.runWorkflow')}
							</Button>
							<Button
								type="button"
								size="sm"
								onClick={onOpenGovernance}
								className="justify-start"
							>
								<ShieldCheck className="size-4" />
								{t('platform.monitoring.openGovernance')}
							</Button>
						</div>
					</div>

					<TabsList className="mt-4 w-full sm:w-auto">
						<TabsTrigger value="overview" className="flex-1 sm:flex-none">
							<ClipboardList className="size-4" />
							运行概览
						</TabsTrigger>
						<TabsTrigger value="audit" className="flex-1 sm:flex-none">
							<FileSearch className="size-4" />
							审计检索
						</TabsTrigger>
					</TabsList>
				</section>

				<TabsContent value="overview" className="mt-0">
					<section className="grid gap-4 lg:grid-cols-3">
						<div className="grid min-h-80 content-start gap-3 rounded-lg border bg-background p-4 shadow-sm">
							<div className="flex items-start gap-3">
								<div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
									<BotMessageSquare className="size-4 text-muted-foreground" />
								</div>
								<div className="min-w-0">
									<h2 className="text-sm font-medium">
										{t('platform.monitoring.recentAgentRuns')}
									</h2>
									<p className="mt-1 text-xs leading-5 text-muted-foreground">
										{t('platform.monitoring.recentAgentRunsHelper')}
									</p>
								</div>
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
											className="rounded-md border bg-muted/10 p-3 text-left text-xs transition-colors hover:border-primary/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											<div className="flex items-center justify-between gap-2">
												<span className="truncate font-medium">
													{turn.question}
												</span>
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

						<div className="grid min-h-80 content-start gap-3 rounded-lg border bg-background p-4 shadow-sm">
							<div className="flex items-start gap-3">
								<div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
									<Workflow className="size-4 text-muted-foreground" />
								</div>
								<div className="min-w-0">
									<h2 className="text-sm font-medium">
										{t('platform.monitoring.recentWorkflowRuns')}
									</h2>
									<p className="mt-1 text-xs leading-5 text-muted-foreground">
										{t('platform.monitoring.recentWorkflowRunsHelper')}
									</p>
								</div>
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
											className="rounded-md border bg-muted/10 p-3 text-left text-xs transition-colors hover:border-primary/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											<div className="flex items-center justify-between gap-2">
												<span className="truncate font-medium">
													{run.workflow_name}
												</span>
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
												{run.summary ||
													formatTimestamp(run.finished_at || run.started_at)}
											</p>
										</button>
									))}
								</div>
							)}
						</div>

						<div className="grid min-h-80 content-start gap-3 rounded-lg border bg-background p-4 shadow-sm">
							<div className="flex items-start gap-3">
								<div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
									<FileSearch className="size-4 text-muted-foreground" />
								</div>
								<div className="min-w-0">
									<h2 className="text-sm font-medium">
										{t('platform.monitoring.recentAudit')}
									</h2>
									<p className="mt-1 text-xs leading-5 text-muted-foreground">
										{t('platform.monitoring.recentAuditHelper')}
									</p>
								</div>
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
											className="rounded-md border bg-muted/10 p-3 text-xs"
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
				</TabsContent>

				<TabsContent value="audit" className="mt-0">
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
				</TabsContent>
			</Tabs>
		</PlatformPageShell>
	);
}
