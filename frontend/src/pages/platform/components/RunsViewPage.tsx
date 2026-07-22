import {
	Activity,
	BotMessageSquare,
	CheckCircle2,
	FileSearch,
	RefreshCcw,
	ShieldCheck,
	Workflow,
} from 'lucide-react';
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import { formatTimestamp } from '../platform-utils';
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
import {
	normalizePlatformStatus,
	type PlatformOperationalStatus,
} from './platform-status';
import { PlatformEmptyState } from './PlatformEmptyState';
import { PlatformFilterBar } from './PlatformFilterBar';
import { PlatformStatusBadge } from './PlatformStatusBadge';
import type {
	EnterpriseAuditEvent,
	EnterprisePublishedAgent,
	EnterpriseToolCatalogItem,
	EnterpriseWorkflowRunHistoryItem,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
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

type RunTypeFilter = 'all' | 'agent' | 'workflow';
type RunStatusFilter = 'all' | PlatformOperationalStatus;

const runStatuses: PlatformOperationalStatus[] = [
	'pending',
	'approved',
	'rejected',
	'running',
	'success',
	'failed',
	'cancelled',
];

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
	const [selectedRun, setSelectedRun] = useState<SelectedRun | null>(null);
	const [runTypeFilter, setRunTypeFilter] = useState<RunTypeFilter>('all');
	const [runStatusFilter, setRunStatusFilter] =
		useState<RunStatusFilter>('all');
	const [runKeywordFilter, setRunKeywordFilter] = useState('');
	const runItems = useMemo(
		() => [
			...recentAgentTurns.map((turn) => ({
				type: 'agent' as const,
				id: turn.id,
				title: turn.question,
				description: turn.answer,
				timestamp: turn.createdAt,
				status: 'success' as PlatformOperationalStatus,
				agentId: turn.agentId,
				raw: turn,
			})),
			...recentWorkflowRuns.slice(0, 8).map((run) => ({
				type: 'workflow' as const,
				id: run.run_id,
				title: run.workflow_name,
				description: run.summary || formatTimestamp(run.finished_at || run.started_at),
				timestamp: run.finished_at || run.started_at,
				status: normalizePlatformStatus(run.status),
				agentId: run.agent_id,
				raw: run,
			})),
		].sort(
			(a, b) =>
				new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
		),
		[recentAgentTurns, recentWorkflowRuns],
	);
	const filteredRunItems = useMemo(() => {
		const keyword = runKeywordFilter.trim().toLowerCase();

		return runItems.filter((item) => {
			const matchesType = runTypeFilter === 'all' || item.type === runTypeFilter;
			const matchesStatus =
				runStatusFilter === 'all' || item.status === runStatusFilter;
			const matchesKeyword =
				keyword.length === 0 ||
				[item.title, item.description, item.agentId, item.id]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(keyword));

			return matchesType && matchesStatus && matchesKeyword;
		});
	}, [runItems, runKeywordFilter, runStatusFilter, runTypeFilter]);
	const hasRunFilters =
		runTypeFilter !== 'all' ||
		runStatusFilter !== 'all' ||
		runKeywordFilter.trim().length > 0;
	const activeRun = selectedRun
		? filteredRunItems.find(
			(item) =>
				item.type === selectedRun.type && item.id === selectedRun.id,
			)
		: undefined;
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
								<h2 className="text-base font-semibold">
									{t('platform.monitoring.runCenter')}
								</h2>
							</div>
							<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
								{t('platform.monitoring.runCenterDescription')}
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
					<section className="grid gap-4">
						<div className="grid min-h-[30rem] content-start gap-3 rounded-lg border bg-background/80 p-4 shadow-none">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<h2 className="text-sm font-semibold">
										{t('platform.monitoring.runQueue')}
									</h2>
									<p className="mt-1 text-xs leading-5 text-muted-foreground">
										{t('platform.monitoring.runQueueDescription')}
									</p>
								</div>
								<Badge variant="secondary" className="shrink-0">
									{filteredRunItems.length}
								</Badge>
							</div>

							<PlatformFilterBar
								resultLabel={t('platform.ux.filters.results', {
									count: filteredRunItems.length,
								})}
								clearLabel={t('platform.ux.filters.clear')}
								clearDisabled={!hasRunFilters}
								onClear={() => {
									setRunTypeFilter('all');
									setRunStatusFilter('all');
									setRunKeywordFilter('');
								}}
							>
								<div className="grid gap-1.5 xl:col-span-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.monitoring.filterType')}
									</label>
									<Select
										value={runTypeFilter}
										onValueChange={(value) =>
											setRunTypeFilter(value as RunTypeFilter)
										}
									>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">
												{t('platform.monitoring.allTypes')}
											</SelectItem>
											<SelectItem value="agent">
												{t('platform.monitoring.agentRunType')}
											</SelectItem>
											<SelectItem value="workflow">
												{t('platform.monitoring.workflowRunType')}
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="grid gap-1.5 xl:col-span-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.monitoring.filterStatus')}
									</label>
									<Select
										value={runStatusFilter}
										onValueChange={(value) =>
											setRunStatusFilter(value as RunStatusFilter)
										}
									>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">
												{t('platform.monitoring.allStatuses')}
											</SelectItem>
											{runStatuses.map((status) => (
												<SelectItem key={status} value={status}>
													{t(`platform.statuses.${status}`)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="grid gap-1.5 xl:col-span-2">
									<label className="text-xs font-medium text-muted-foreground">
										{t('platform.monitoring.filterKeyword')}
									</label>
									<Input
										value={runKeywordFilter}
										onChange={(event) => setRunKeywordFilter(event.target.value)}
										placeholder={t('platform.monitoring.keywordPlaceholder')}
									/>
								</div>
							</PlatformFilterBar>

							{runItems.length === 0 ? (
								<PlatformEmptyState
									variant="noData"
									title={t('platform.monitoring.noRunsTitle')}
									description={t('platform.monitoring.noRunsDescription')}
									className="min-h-72 rounded-md border border-dashed bg-background/80 p-6"
								/>
							) : filteredRunItems.length === 0 ? (
								<PlatformEmptyState
									variant="filtered"
									title={t('platform.ux.empty.filteredTitle')}
									description={t('platform.ux.empty.filteredDescription')}
									actionLabel={t('platform.ux.filters.clear')}
									onAction={() => {
										setRunTypeFilter('all');
										setRunStatusFilter('all');
										setRunKeywordFilter('');
									}}
									className="min-h-72 rounded-md border border-dashed bg-background/80 p-6"
								/>
							) : (
								<div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
									{filteredRunItems.map((item) => {
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
					</section>
				</section>

				<section>
					<div className="mb-3 flex items-center gap-2">
						<div className="flex size-8 items-center justify-center rounded-md border bg-background">
							<FileSearch className="size-4 text-muted-foreground" />
						</div>
						<div>
							<h2 className="text-sm font-semibold">
								{t('platform.monitoring.auditSearch')}
							</h2>
							<p className="text-xs text-muted-foreground">
								{t('platform.monitoring.auditSearchDescription')}
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

			<Sheet
				open={Boolean(activeRun)}
				onOpenChange={(open) => {
					if (!open) {
						setSelectedRun(null);
					}
				}}
			>
				<SheetContent
					side="right"
					className="w-full gap-0 overflow-hidden p-0 sm:max-w-xl lg:max-w-2xl"
				>
					<SheetHeader className="border-b pr-12">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<SheetTitle>{t('platform.monitoring.runDetail')}</SheetTitle>
								<SheetDescription className="mt-1">
									{t('platform.monitoring.runDetailDescription')}
								</SheetDescription>
							</div>
							{activeRun ? (
								<PlatformStatusBadge
									status={activeRun.status}
									t={t}
									className="shrink-0"
								/>
							) : null}
						</div>
					</SheetHeader>

					{activeRun ? (
						<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
							<div className="grid gap-4">
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
										<div className="text-xs text-muted-foreground">
											{t('platform.monitoring.type')}
										</div>
										<div className="mt-1 text-sm font-medium">
											{activeRun.type === 'agent'
												? t('platform.monitoring.agentRunType')
												: t('platform.monitoring.workflowRunType')}
										</div>
									</div>
									<div className="rounded-md border p-3">
										<div className="text-xs text-muted-foreground">
											{t('platform.monitoring.agent')}
										</div>
										<div className="mt-1 truncate text-sm font-medium">
											{activeRun.agentId || '-'}
										</div>
									</div>
									<div className="rounded-md border p-3">
										<div className="text-xs text-muted-foreground">
											{t('platform.monitoring.time')}
										</div>
										<div className="mt-1 text-sm font-medium">
											{formatTimestamp(activeRun.timestamp)}
										</div>
									</div>
								</div>

								{activeWorkflowRun ? (
									<div className="rounded-md border p-3">
										<div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
											<CheckCircle2 className="size-4" />
											{t('platform.monitoring.stepsStatus')}
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
							</div>
						</div>
					) : null}

					{activeRun ? (
						<SheetFooter className="border-t bg-background">
							<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={onOpenGovernance}
								>
									<ShieldCheck className="size-4" />
									{t('platform.monitoring.governanceAudit')}
								</Button>
								{activeAgentTurn ? (
									<Button
										type="button"
										size="sm"
										onClick={() => onSelectAgentTurn(activeAgentTurn)}
									>
										<BotMessageSquare className="size-4" />
										{t('platform.monitoring.viewResponse')}
									</Button>
								) : (
									<Button type="button" size="sm" onClick={onRunWorkflow}>
										<Workflow className="size-4" />
										{t('platform.monitoring.continueWorkflow')}
									</Button>
								)}
							</div>
						</SheetFooter>
					) : null}
				</SheetContent>
			</Sheet>
		</PlatformPageShell>
	);
}
