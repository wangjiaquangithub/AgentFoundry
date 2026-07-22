import {
	Activity,
	BotMessageSquare,
	CheckCircle2,
	CircleAlert,
	Clock3,
	RefreshCcw,
	Workflow,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import {
	normalizePlatformErrorMessage,
	platformServiceUnavailableTitle,
} from '../platform-error-state';
import { formatTimestamp } from '../platform-utils';
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface RunsViewPageProps {
	monitoringHealthState: HealthState;
	monitoringLoading: boolean;
	monitoringError?: unknown;
	monitoringStats: MonitoringStat[];
	recentAgentTurns: MonitoringAgentTurn[];
	recentWorkflowRuns: EnterpriseWorkflowRunHistoryItem[];
	onRefreshMonitoring: () => void | Promise<void>;
	onSelectAgentTurn: (turn: MonitoringAgentTurn) => void;
	onRunAgent: () => void;
	onRunWorkflow: () => void;
	t: Translate;
}

type SelectedRun =
	| { type: 'agent'; id: string }
	| { type: 'workflow'; id: string };

type RunTypeFilter = 'all' | 'agent' | 'workflow';
type RunStatusFilter = 'all' | PlatformOperationalStatus;
type RunListItem =
	| {
			type: 'agent';
			id: string;
			title: string;
			description: string;
			timestamp: string;
			startedAt: string;
			finishedAt?: string;
			duration: string;
			status: PlatformOperationalStatus;
			agentId?: string;
			owner?: string;
			scope?: string;
			raw: MonitoringAgentTurn;
	  }
	| {
			type: 'workflow';
			id: string;
			title: string;
			description: string;
			timestamp: string;
			startedAt: string;
			finishedAt?: string;
			duration: string;
			status: PlatformOperationalStatus;
			agentId?: string;
			owner?: string;
			scope?: string;
			raw: EnterpriseWorkflowRunHistoryItem;
	  };

const runStatuses: PlatformOperationalStatus[] = [
	'pending',
	'approved',
	'rejected',
	'running',
	'success',
	'failed',
	'cancelled',
];

function formatRunStatusCounts(
	statusCounts: Record<string, number> | undefined,
	t: Translate,
) {
	return Object.entries(statusCounts || {}).map(([status, count]) => ({
		status: normalizePlatformStatus(status),
		label: t(`platform.statuses.${normalizePlatformStatus(status)}`),
		count,
	}));
}

function formatDuration(startedAt?: string, finishedAt?: string) {
	if (!startedAt) {
		return '-';
	}

	const start = new Date(startedAt).getTime();
	const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();

	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
		return '-';
	}

	const seconds = Math.max(1, Math.round((end - start) / 1000));
	if (seconds < 60) {
		return `${seconds}s`;
	}

	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	if (minutes < 60) {
		return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
	}

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function RunsViewPage({
	monitoringHealthState,
	monitoringLoading,
	monitoringError,
	monitoringStats,
	recentAgentTurns,
	recentWorkflowRuns,
	onRefreshMonitoring,
	onSelectAgentTurn,
	onRunAgent,
	onRunWorkflow,
	t,
}: RunsViewPageProps) {
	const [selectedRun, setSelectedRun] = useState<SelectedRun | null>(null);
	const [runTypeFilter, setRunTypeFilter] = useState<RunTypeFilter>('all');
	const [runStatusFilter, setRunStatusFilter] =
		useState<RunStatusFilter>('all');
	const [runKeywordFilter, setRunKeywordFilter] = useState('');
	const runItems = useMemo<RunListItem[]>(
		() =>
			[
				...recentAgentTurns.map((turn) => ({
					type: 'agent' as const,
					id: turn.id,
					title: turn.question,
					description: turn.answer,
					timestamp: turn.createdAt,
					startedAt: turn.createdAt,
					finishedAt: turn.createdAt,
					duration: formatDuration(turn.createdAt, turn.createdAt),
					status: 'success' as PlatformOperationalStatus,
					agentId: turn.agentId,
					owner: undefined,
					scope: undefined,
					raw: turn,
				})),
				...recentWorkflowRuns.map((run) => ({
					type: 'workflow' as const,
					id: run.run_id,
					title: run.workflow_name,
					description:
						run.summary || formatTimestamp(run.finished_at || run.started_at),
					timestamp: run.finished_at || run.started_at,
					startedAt: run.started_at,
					finishedAt: run.finished_at,
					duration: formatDuration(run.started_at, run.finished_at),
					status: normalizePlatformStatus(run.status),
					agentId: run.agent_id,
					owner: run.user_id,
					scope: run.tenant,
					raw: run,
				})),
			].sort((a, b) => {
				const left = new Date(a.timestamp).getTime();
				const right = new Date(b.timestamp).getTime();
				return (
					(Number.isFinite(right) ? right : 0) -
					(Number.isFinite(left) ? left : 0)
				);
			}),
		[recentAgentTurns, recentWorkflowRuns],
	);
	const filteredRunItems = useMemo(() => {
		const keyword = runKeywordFilter.trim().toLowerCase();

		return runItems.filter((item) => {
			const matchesType =
				runTypeFilter === 'all' || item.type === runTypeFilter;
			const matchesStatus =
				runStatusFilter === 'all' || item.status === runStatusFilter;
			const matchesKeyword =
				keyword.length === 0 ||
				[
					item.title,
					item.description,
					item.agentId,
					item.owner,
					item.scope,
					item.id,
				]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(keyword));

			return matchesType && matchesStatus && matchesKeyword;
		});
	}, [runItems, runKeywordFilter, runStatusFilter, runTypeFilter]);
	const operationalSummary = useMemo(() => {
		const failed = runItems.filter((item) => item.status === 'failed').length;
		const running = runItems.filter((item) => item.status === 'running').length;
		const workflows = runItems.filter((item) => item.type === 'workflow').length;
		const agents = runItems.filter((item) => item.type === 'agent').length;

		return [
			{
				id: 'failed',
				label: t('platform.monitoring.summaryFailed'),
				value: failed,
				helper: t('platform.monitoring.summaryFailedHelper'),
				icon: CircleAlert,
				statusFilter: 'failed' as const,
				tone:
					failed > 0
						? 'border-red-500/35 bg-red-500/5 text-red-700'
						: 'border-border bg-background text-foreground',
			},
			{
				id: 'running',
				label: t('platform.monitoring.summaryRunning'),
				value: running,
				helper: t('platform.monitoring.summaryRunningHelper'),
				icon: Clock3,
				statusFilter: 'running' as const,
				tone:
					running > 0
						? 'border-blue-500/35 bg-blue-500/5 text-blue-700'
						: 'border-border bg-background text-foreground',
			},
			{
				id: 'coverage',
				label: t('platform.monitoring.summaryCoverage'),
				value: `${agents}/${workflows}`,
				helper: t('platform.monitoring.summaryCoverageHelper'),
				icon: Activity,
				statusFilter: 'all' as const,
				tone: 'border-border bg-background text-foreground',
			},
		];
	}, [runItems, t]);
	const hasRunFilters =
		runTypeFilter !== 'all' ||
		runStatusFilter !== 'all' ||
		runKeywordFilter.trim().length > 0;
	const isInitialLoading = monitoringLoading && runItems.length === 0;
	const hasInitialError = Boolean(monitoringError) && runItems.length === 0;
	const resetRunFilters = () => {
		setRunTypeFilter('all');
		setRunStatusFilter('all');
		setRunKeywordFilter('');
	};
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

			<section className="grid gap-0 border-y md:grid-cols-2 xl:grid-cols-4">
				{monitoringStats.map((stat) => {
					const StatIcon = stat.icon;
					return (
						<div
							key={stat.label}
							className="grid min-h-16 grid-cols-[1fr_auto] gap-3 border-b py-3 pr-4 last:border-b-0 md:odd:pr-5 md:even:border-l md:even:pl-5 xl:border-b-0 xl:border-l xl:first:border-l-0 xl:first:pl-0 xl:not(:first-child):pl-5"
						>
							<div className="min-w-0">
								<div className="truncate text-xs font-medium text-muted-foreground">
									{stat.label}
								</div>
								<div className="mt-1 text-xl font-semibold tabular-nums">
									{monitoringLoading ? '-' : stat.value}
								</div>
								{stat.helper ? (
									<div className="mt-0.5 truncate text-xs text-muted-foreground">
										{stat.helper}
									</div>
								) : null}
							</div>
							<div className="flex size-7 items-center justify-center rounded-md border bg-background">
								<StatIcon className="size-4 text-muted-foreground" />
							</div>
						</div>
					);
				})}
			</section>

			<section className="grid min-h-[34rem] content-start gap-4">
				<div className="grid min-w-0 content-start gap-3">
					<div className="flex flex-col gap-3 border-b pb-3 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<h2 className="text-base font-semibold">
									{t('platform.monitoring.runRecords')}
								</h2>
								<Badge variant="secondary" className="shrink-0">
									{filteredRunItems.length}
								</Badge>
							</div>
							<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
								{t('platform.monitoring.runQueueDescription')}
							</p>
						</div>

						<div className="flex flex-col gap-2 sm:flex-row lg:min-w-[18rem] lg:justify-end">
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
								variant="default"
								onClick={onRunWorkflow}
								className="justify-start"
							>
								<Workflow className="size-4" />
								{t('platform.monitoring.runWorkflow')}
							</Button>
						</div>
					</div>

					<div className="grid gap-3">
						<div className="grid overflow-hidden rounded-md border bg-background md:grid-cols-3">
						{operationalSummary.map((item) => {
							const SummaryIcon = item.icon;
							return (
								<button
									key={item.label}
									type="button"
									onClick={() => {
										setRunStatusFilter(item.statusFilter);
										if (item.id === 'coverage') {
											setRunTypeFilter('all');
										}
									}}
									className={cn(
										'grid grid-cols-[1fr_auto] gap-3 border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:border-b-0 md:border-r md:last:border-r-0',
										item.tone,
									)}
								>
									<div className="min-w-0">
										<div className="truncate text-xs font-medium text-muted-foreground">
											{item.label}
										</div>
										<div className="mt-1 text-lg font-semibold tabular-nums">
											{monitoringLoading ? '-' : item.value}
										</div>
										<div className="mt-0.5 truncate text-xs text-muted-foreground">
											{item.helper}
										</div>
									</div>
									<SummaryIcon className="mt-0.5 size-4 text-muted-foreground" />
								</button>
							);
						})}
						</div>

						<PlatformFilterBar
							resultLabel={t('platform.ux.filters.results', {
								count: filteredRunItems.length,
							})}
							clearLabel={t('platform.ux.filters.clear')}
							onClear={resetRunFilters}
							clearDisabled={!hasRunFilters}
						>
						<Select
							value={runTypeFilter}
							onValueChange={(value) =>
								setRunTypeFilter(value as RunTypeFilter)
							}
						>
							<SelectTrigger className="h-9 w-full">
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
						<Select
							value={runStatusFilter}
							onValueChange={(value) =>
								setRunStatusFilter(value as RunStatusFilter)
							}
						>
							<SelectTrigger className="h-9 w-full">
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
						<Input
							className="h-9 md:col-span-2 xl:col-span-4"
							value={runKeywordFilter}
							onChange={(event) => setRunKeywordFilter(event.target.value)}
							placeholder={t('platform.monitoring.keywordPlaceholder')}
						/>
						</PlatformFilterBar>
					</div>

					{monitoringError && runItems.length > 0 ? (
						<div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-muted-foreground">
							<span className="font-medium text-foreground">
								{platformServiceUnavailableTitle}
							</span>
							<span className="ml-2">
								{normalizePlatformErrorMessage(monitoringError)}
							</span>
						</div>
					) : null}

					{isInitialLoading ? (
					<div className="overflow-hidden rounded-md border bg-background">
						<div className="hidden grid-cols-[8rem_minmax(0,2fr)_minmax(8rem,0.8fr)_7rem_10rem_4.5rem] gap-3 border-b bg-muted/35 px-3 py-2 lg:grid">
							<Skeleton className="h-4 w-14" />
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-16" />
							<Skeleton className="ml-auto h-4 w-10" />
						</div>
						<div>
							{[0, 1, 2, 3, 4].map((item) => (
								<div
									key={item}
									className="grid gap-3 border-b px-3 py-3 last:border-b-0 lg:grid-cols-[8rem_minmax(0,2fr)_minmax(8rem,0.8fr)_7rem_10rem_4.5rem] lg:items-center"
								>
									<Skeleton className="h-7 w-24" />
									<div className="grid gap-2">
										<Skeleton className="h-4 w-3/4" />
										<Skeleton className="h-3 w-1/2" />
									</div>
									<Skeleton className="h-6 w-20" />
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-4 w-28" />
									<Skeleton className="ml-auto h-4 w-10" />
								</div>
							))}
						</div>
					</div>
				) : hasInitialError ? (
					<PlatformEmptyState
						variant="error"
						title={platformServiceUnavailableTitle}
						description={normalizePlatformErrorMessage(monitoringError)}
						actionLabel={t('platform.monitoring.refresh')}
						onAction={() => void onRefreshMonitoring()}
						className="min-h-80 rounded-md border border-dashed bg-background/80 p-6"
					/>
				) : runItems.length === 0 ? (
					<PlatformEmptyState
						variant="noData"
						title={t('platform.monitoring.noRunsTitle')}
						description={t('platform.monitoring.noRunsDescription')}
						className="min-h-80 rounded-md border border-dashed bg-background/80 p-6"
					/>
				) : filteredRunItems.length === 0 ? (
					<PlatformEmptyState
						variant="filtered"
						title={t('platform.ux.empty.filteredTitle')}
						description={t('platform.ux.empty.filteredDescription')}
						actionLabel={t('platform.ux.filters.clear')}
						onAction={resetRunFilters}
						className="min-h-80 rounded-md border border-dashed bg-background/80 p-6"
					/>
					) : (
					<div className="overflow-hidden rounded-md border bg-background">
						<div className="hidden grid-cols-[8rem_minmax(0,2.2fr)_minmax(8rem,0.8fr)_7rem_10rem_5rem] gap-3 border-b bg-muted/35 px-3 py-2 text-xs font-medium text-muted-foreground lg:grid">
							<span>{t('platform.monitoring.filterStatus')}</span>
							<span>{t('platform.monitoring.runObject')}</span>
							<span>{t('platform.monitoring.agent')}</span>
							<span>{t('platform.monitoring.duration')}</span>
							<span>{t('platform.monitoring.updatedAt')}</span>
							<span className="text-right">{t('platform.monitoring.actions')}</span>
						</div>
						<div>
							{filteredRunItems.map((item) => {
								const ItemIcon =
									item.type === 'agent' ? BotMessageSquare : Workflow;
								const isActive =
									activeRun?.type === item.type && activeRun.id === item.id;
								return (
									<button
										key={`${item.type}-${item.id}`}
										type="button"
										aria-label={t('platform.monitoring.inspectRun', {
											name: item.title,
										})}
										onClick={() => {
											setSelectedRun({ type: item.type, id: item.id });
										}}
										className={cn(
											'grid w-full gap-3 border-b border-l-2 border-l-transparent px-3 py-3 text-left text-xs transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:grid-cols-[8rem_minmax(0,2.2fr)_minmax(8rem,0.8fr)_7rem_10rem_5rem] lg:items-center',
											isActive
												? 'border-l-primary bg-primary/5 text-foreground'
												: item.status === 'failed'
													? 'border-l-red-500 bg-background hover:bg-red-500/5'
												: 'bg-background hover:bg-muted/50',
										)}
									>
										<div className="flex items-center justify-between gap-3 lg:block">
											<span className="text-muted-foreground lg:hidden">
												{t('platform.monitoring.filterStatus')}
											</span>
											<PlatformStatusBadge status={item.status} t={t} />
										</div>
										<div className="min-w-0">
											<div className="flex min-w-0 items-center gap-2">
												<div className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/25">
													<ItemIcon className="size-4 text-muted-foreground" />
												</div>
												<div className="min-w-0 truncate font-medium">
													{item.title}
												</div>
											</div>
											<p className="mt-1 line-clamp-1 pl-9 text-muted-foreground">
												{item.type === 'agent'
													? t('platform.monitoring.agentRunType')
													: t('platform.monitoring.workflowRunType')}
												{item.description ? ` · ${item.description}` : ''}
											</p>
											<div className="mt-2 flex flex-wrap gap-1.5 pl-9 lg:hidden">
												<Badge variant="outline" className="h-5 text-[11px]">
													{item.agentId || '-'}
												</Badge>
												<Badge variant="outline" className="h-5 text-[11px]">
													{item.duration}
												</Badge>
											</div>
										</div>
										<div className="flex min-w-0 items-center justify-between gap-3 text-muted-foreground lg:block">
											<span className="lg:hidden">
												{t('platform.monitoring.agent')}
											</span>
											<span className="truncate">{item.agentId || '-'}</span>
										</div>
										<div className="flex items-center justify-between gap-3 tabular-nums text-muted-foreground lg:block">
											<span className="lg:hidden">
												{t('platform.monitoring.duration')}
											</span>
											<span>{item.duration}</span>
										</div>
										<div className="flex items-center justify-between gap-3 tabular-nums text-muted-foreground lg:block">
											<span className="lg:hidden">
												{t('platform.monitoring.updatedAt')}
											</span>
											<span>{formatTimestamp(item.timestamp)}</span>
										</div>
										<div className="hidden text-right font-medium text-primary lg:block">
											{t('platform.monitoring.inspect')}
										</div>
									</button>
								);
							})}
						</div>
					</div>
					)}
				</div>
			</section>

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
								<div className="border-b pb-4">
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

								<div className="grid gap-3 md:grid-cols-2">
									<div className="border-b pb-3 md:border-b-0 md:border-r md:pr-3">
										<div className="text-xs text-muted-foreground">
											{t('platform.monitoring.type')}
										</div>
										<div className="mt-1 text-sm font-medium">
											{activeRun.type === 'agent'
												? t('platform.monitoring.agentRunType')
												: t('platform.monitoring.workflowRunType')}
										</div>
									</div>
									<div className="border-b pb-3 md:border-b-0">
										<div className="text-xs text-muted-foreground">
											{t('platform.monitoring.agent')}
										</div>
										<div className="mt-1 truncate text-sm font-medium">
											{activeRun.agentId || '-'}
										</div>
									</div>
									<div className="border-b pb-3 md:border-b-0 md:border-r md:pr-3">
										<div className="text-xs text-muted-foreground">
											{t('platform.monitoring.duration')}
										</div>
										<div className="mt-1 text-sm font-medium">
											{activeRun.duration}
										</div>
									</div>
									<div className="border-b pb-3 md:border-b-0">
										<div className="text-xs text-muted-foreground">
											{t('platform.monitoring.updatedAt')}
										</div>
										<div className="mt-1 text-sm font-medium">
											{formatTimestamp(activeRun.timestamp)}
										</div>
									</div>
									{activeWorkflowRun ? (
										<>
											<div className="border-b pb-3 md:border-b-0 md:border-r md:pr-3">
												<div className="text-xs text-muted-foreground">
													{t('platform.monitoring.workflowType')}
												</div>
												<div className="mt-1 truncate text-sm font-medium">
													{activeWorkflowRun.workflow_type || '-'}
												</div>
											</div>
											<div className="border-b pb-3 md:border-b-0">
												<div className="text-xs text-muted-foreground">
													{t('platform.monitoring.initiator')}
												</div>
												<div className="mt-1 truncate text-sm font-medium">
													{activeWorkflowRun.user_id || '-'}
												</div>
											</div>
											<div className="border-b pb-3 md:border-b-0 md:border-r md:pr-3">
												<div className="text-xs text-muted-foreground">
													{t('platform.monitoring.tenant')}
												</div>
												<div className="mt-1 truncate text-sm font-medium">
													{activeWorkflowRun.tenant || '-'}
												</div>
											</div>
										</>
									) : null}
									<div className="border-b pb-3 md:border-b-0">
										<div className="text-xs text-muted-foreground">
											{t('platform.monitoring.runId')}
										</div>
										<div className="mt-1 truncate font-mono text-xs">
											{activeRun.id}
										</div>
									</div>
								</div>

								{activeWorkflowRun ? (
									<div className="border-t pt-4">
										<div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
											<CheckCircle2 className="size-4" />
											{t('platform.monitoring.stepsStatus')}
										</div>
										<div className="flex flex-wrap gap-2">
											{formatRunStatusCounts(activeWorkflowRun.status_counts, t).map(
												(item) => (
													<Badge key={item.status} variant="secondary">
														{item.label}: {item.count}
													</Badge>
												),
											)}
										</div>
									</div>
								) : null}

								<div className="rounded-md border bg-muted/25 p-3">
									<div className="text-xs font-medium text-muted-foreground">
										{t('platform.monitoring.nextAction')}
									</div>
									<div className="mt-1 text-sm font-medium">
										{activeRun.status === 'failed'
											? t('platform.monitoring.nextActionFailed')
											: activeRun.status === 'running'
												? t('platform.monitoring.nextActionRunning')
												: activeRun.type === 'agent'
													? t('platform.monitoring.nextActionAgent')
													: t('platform.monitoring.nextActionWorkflow')}
									</div>
								</div>
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
									onClick={() => setSelectedRun(null)}
								>
									{t('common.close')}
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
