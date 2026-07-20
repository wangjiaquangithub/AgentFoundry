import {
	Activity,
	BotMessageSquare,
	CheckCircle2,
	Clock3,
	FileSearch,
	RefreshCcw,
	ShieldCheck,
	Workflow,
} from 'lucide-react';
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import {
	formatTimestamp,
	workflowStatusClassName,
	workflowStatusLabelKey,
} from '../platform-utils';
import { AuditEventsPanel } from './AuditEventsPanel';
import {
	PlatformPageHeader,
	PlatformPageShell,
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

type SelectedRun =
	| { type: 'agent'; id: string }
	| { type: 'workflow'; id: string };

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
	const runItems = useMemo(
		() => [
			...recentAgentTurns.map((turn) => ({
				type: 'agent' as const,
				id: turn.id,
				title: turn.question,
				description: turn.answer,
				timestamp: turn.createdAt,
				statusLabel: 'Agent',
				statusClassName: 'border-sky-500/30 bg-sky-500/10 text-sky-700',
				agentId: turn.agentId,
				raw: turn,
			})),
			...recentWorkflowRuns.slice(0, 8).map((run) => ({
				type: 'workflow' as const,
				id: run.run_id,
				title: run.workflow_name,
				description: run.summary || formatTimestamp(run.finished_at || run.started_at),
				timestamp: run.finished_at || run.started_at,
				statusLabel: t(
					`platform.workflowRunner.${workflowStatusLabelKey(run.status)}`,
				),
				statusClassName: workflowStatusClassName(run.status),
				agentId: run.agent_id,
				raw: run,
			})),
		].sort(
			(a, b) =>
				new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
		),
		[recentAgentTurns, recentWorkflowRuns, t],
	);
	const [selectedRun, setSelectedRun] = useState<SelectedRun | null>(null);
	const activeRun =
		runItems.find(
			(item) =>
				item.type === selectedRun?.type && item.id === selectedRun?.id,
		) ?? runItems[0];
	const activeAgentTurn =
		activeRun?.type === 'agent'
			? (activeRun.raw as MonitoringAgentTurn)
			: undefined;
	const activeWorkflowRun =
		activeRun?.type === 'workflow'
			? (activeRun.raw as EnterpriseWorkflowRunHistoryItem)
			: undefined;

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

			<section className="grid gap-2 border-y py-3 md:grid-cols-2 xl:grid-cols-4">
				{monitoringStats.map((stat) => {
					const StatIcon = stat.icon;
					return (
						<div
							key={stat.label}
							className="grid min-h-20 grid-cols-[1fr_auto] gap-3 rounded-md border bg-background/80 p-3"
						>
							<div className="min-w-0">
								<div className="truncate text-xs font-medium text-muted-foreground">
									{stat.label}
								</div>
								<div className="mt-2 text-2xl font-semibold tabular-nums">
									{monitoringLoading ? '-' : stat.value}
								</div>
								{stat.helper ? (
									<div className="mt-1 truncate text-xs text-muted-foreground">
										{stat.helper}
									</div>
								) : null}
							</div>
							<div className="flex size-8 items-center justify-center rounded-md border bg-background">
								<StatIcon className="size-4 text-muted-foreground" />
							</div>
						</div>
					);
				})}
			</section>

			<div className="grid gap-5">
				<section className="border-b pb-5">
					<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
									<Activity className="size-4 text-muted-foreground" />
								</div>
								<h2 className="text-base font-semibold">运行中心</h2>
							</div>
							<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
								统一查看 Agent 对话、工作流执行和审计记录，支持从同一入口启动调试与治理检查。
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
				</section>

				<section>
					<section className="grid gap-4 xl:grid-cols-[minmax(22rem,0.95fr)_minmax(0,1.35fr)]">
						<div className="grid min-h-[30rem] content-start gap-3 rounded-lg border bg-background/80 p-4 shadow-none">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<h2 className="text-sm font-semibold">运行队列</h2>
									<p className="mt-1 text-xs leading-5 text-muted-foreground">
										Agent 对话和工作流执行按时间合并展示，点击后在右侧查看细节。
									</p>
								</div>
								<Badge variant="secondary" className="shrink-0">
									{runItems.length}
								</Badge>
							</div>

							{runItems.length === 0 ? (
								<div className="grid min-h-72 place-items-center rounded-md border border-dashed bg-background/80 p-6 text-center">
									<div className="max-w-72">
										<Clock3 className="mx-auto size-7 text-muted-foreground" />
										<p className="mt-3 text-sm font-medium">暂无运行记录</p>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											启动 Agent 或工作流后，最近执行会出现在这里。
										</p>
									</div>
								</div>
							) : (
								<div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
									{runItems.map((item) => {
										const ItemIcon =
											item.type === 'agent' ? BotMessageSquare : Workflow;
										const isActive =
											activeRun?.type === item.type && activeRun.id === item.id;
										return (
											<button
												key={`${item.type}-${item.id}`}
												type="button"
												onClick={() => {
													setSelectedRun({ type: item.type, id: item.id });
													if (item.type === 'agent') {
														onSelectAgentTurn(item.raw as MonitoringAgentTurn);
													}
												}}
												className={cn(
													'grid grid-cols-[auto_1fr] gap-3 rounded-md border p-3 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
													isActive
														? 'border-primary/40 bg-primary/5 text-foreground'
														: 'bg-background hover:border-primary/30 hover:bg-primary/5',
												)}
											>
												<div
													className={cn(
														'flex size-8 items-center justify-center rounded-md border',
														isActive
															? 'border-primary/20 bg-background'
															: 'bg-background',
													)}
												>
													<ItemIcon
														className={cn(
															'size-4',
															isActive
																? 'text-primary'
																: 'text-muted-foreground',
														)}
													/>
												</div>
												<div className="min-w-0">
													<div className="flex items-center justify-between gap-2">
														<span className="truncate font-medium">
															{item.title}
														</span>
														<span
															className={cn(
																'shrink-0 tabular-nums',
																isActive
																	? 'text-muted-foreground'
																	: 'text-muted-foreground',
															)}
														>
															{formatTimestamp(item.timestamp)}
														</span>
													</div>
													<p
														className={cn(
															'mt-1 line-clamp-2 leading-5',
															isActive
																? 'text-muted-foreground'
																: 'text-muted-foreground',
														)}
													>
														{item.description}
													</p>
												</div>
											</button>
										);
									})}
								</div>
							)}
						</div>

						<div className="grid gap-4">
							<section className="grid min-h-[20rem] content-start gap-4 rounded-lg border bg-background/80 p-4 shadow-none">
								<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
									<div className="min-w-0">
										<h2 className="text-sm font-semibold">运行详情</h2>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											查看当前执行对象、状态、所属租户和后续操作。
										</p>
									</div>
									{activeRun ? (
										<Badge
											variant="outline"
											className={cn('shrink-0', activeRun.statusClassName)}
										>
											{activeRun.statusLabel}
										</Badge>
									) : null}
								</div>

								{activeRun ? (
									<>
										<div className="rounded-md border bg-background p-4">
											<div className="flex items-start gap-3">
												<div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-background">
													{activeRun.type === 'agent' ? (
														<BotMessageSquare className="size-5 text-muted-foreground" />
													) : (
														<Workflow className="size-5 text-muted-foreground" />
													)}
												</div>
												<div className="min-w-0">
													<h3 className="line-clamp-2 text-base font-semibold">
														{activeRun.title}
													</h3>
													<p className="mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground">
														{activeRun.description}
													</p>
												</div>
											</div>
										</div>

										<div className="grid gap-3 md:grid-cols-3">
											<div className="rounded-md border p-3">
												<div className="text-xs text-muted-foreground">类型</div>
												<div className="mt-1 text-sm font-medium">
													{activeRun.type === 'agent' ? 'Agent Run' : 'Workflow Run'}
												</div>
											</div>
											<div className="rounded-md border p-3">
												<div className="text-xs text-muted-foreground">Agent</div>
												<div className="mt-1 truncate text-sm font-medium">
													{activeRun.agentId || '-'}
												</div>
											</div>
											<div className="rounded-md border p-3">
												<div className="text-xs text-muted-foreground">时间</div>
												<div className="mt-1 text-sm font-medium">
													{formatTimestamp(activeRun.timestamp)}
												</div>
											</div>
										</div>

										{activeWorkflowRun ? (
											<div className="rounded-md border p-3">
												<div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
													<CheckCircle2 className="size-4" />
													步骤状态
												</div>
												<div className="flex flex-wrap gap-2">
													{Object.entries(activeWorkflowRun.status_counts || {}).map(
														([status, count]) => (
															<Badge key={status} variant="secondary">
																{status}: {count}
															</Badge>
														),
													)}
												</div>
											</div>
										) : null}

										<div className="flex flex-wrap gap-2">
											{activeAgentTurn ? (
												<Button
													type="button"
													size="sm"
													onClick={() => onSelectAgentTurn(activeAgentTurn)}
												>
													<BotMessageSquare className="size-4" />
													查看回复
												</Button>
											) : (
												<Button type="button" size="sm" onClick={onRunWorkflow}>
													<Workflow className="size-4" />
													继续工作流
												</Button>
											)}
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={onOpenGovernance}
											>
												<ShieldCheck className="size-4" />
												治理审计
											</Button>
										</div>
									</>
								) : (
									<div className="grid min-h-64 place-items-center rounded-md border border-dashed bg-background/80 p-6 text-center text-sm text-muted-foreground">
										暂无可查看的运行详情。
									</div>
								)}
							</section>

							<section className="grid content-start gap-3 rounded-lg border bg-background/80 p-4 shadow-none">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<h2 className="text-sm font-semibold">
											{t('platform.monitoring.recentAudit')}
										</h2>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											{t('platform.monitoring.recentAuditHelper')}
										</p>
									</div>
									<Badge variant="secondary" className="shrink-0">
										{recentAuditEvents.length}
									</Badge>
								</div>
								{recentAuditEvents.length === 0 ? (
									<div className="rounded-md border border-dashed bg-background/80 p-3 text-xs text-muted-foreground">
										{t('platform.monitoring.emptyAudit')}
									</div>
								) : (
									<div className="grid gap-2 md:grid-cols-2">
										{recentAuditEvents.slice(0, 4).map((event, index) => (
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
							</section>
						</div>
					</section>
				</section>

				<section>
					<div className="mb-3 flex items-center gap-2">
						<div className="flex size-8 items-center justify-center rounded-md border bg-background">
							<FileSearch className="size-4 text-muted-foreground" />
						</div>
						<div>
							<h2 className="text-sm font-semibold">审计检索</h2>
							<p className="text-xs text-muted-foreground">
								按租户、用户、Agent 和工具调用结果过滤平台审计事件。
							</p>
						</div>
					</div>
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
				</section>
			</div>
		</PlatformPageShell>
	);
}
