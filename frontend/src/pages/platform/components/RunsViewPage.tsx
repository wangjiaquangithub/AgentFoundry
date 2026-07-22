import {
	Activity,
	BotMessageSquare,
	CheckCircle2,
	RefreshCcw,
	Workflow,
} from 'lucide-react';
import { useMemo, useState } from 'react';

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
import { cn } from '@/lib/utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface RunsViewPageProps {
	monitoringHealthState: HealthState;
	monitoringLoading: boolean;
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

export function RunsViewPage({
	monitoringHealthState,
	monitoringLoading,
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
			...recentWorkflowRuns.map((run) => ({
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

			<section className="grid min-h-[34rem] content-start gap-3">
				<div className="flex flex-col gap-3 border-b pb-3 lg:flex-row lg:items-end lg:justify-between">
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

				<div className="grid gap-3 border-b pb-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="text-xs font-medium text-muted-foreground">
							{t('platform.ux.filters.results', {
								count: filteredRunItems.length,
							})}
						</div>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							onClick={() => {
								setRunTypeFilter('all');
								setRunStatusFilter('all');
								setRunKeywordFilter('');
							}}
							disabled={!hasRunFilters}
						>
							{t('platform.ux.filters.clear')}
						</Button>
					</div>

					<div className="grid gap-2 md:grid-cols-[10rem_10rem_minmax(14rem,1fr)]">
						<div className="min-w-0">
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
						</div>
						<div className="min-w-0">
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
						</div>
						<div className="min-w-0">
							<Input
								className="h-9"
								value={runKeywordFilter}
								onChange={(event) => setRunKeywordFilter(event.target.value)}
								placeholder={t('platform.monitoring.keywordPlaceholder')}
							/>
						</div>
					</div>
				</div>

				{runItems.length === 0 ? (
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
						onAction={() => {
							setRunTypeFilter('all');
							setRunStatusFilter('all');
							setRunKeywordFilter('');
						}}
						className="min-h-80 rounded-md border border-dashed bg-background/80 p-6"
					/>
				) : (
					<div className="overflow-hidden rounded-md border bg-background">
						<div className="hidden grid-cols-[7rem_minmax(0,1.8fr)_8rem_minmax(8rem,0.8fr)_10rem_4.5rem] gap-3 border-b bg-muted/35 px-3 py-2 text-xs font-medium text-muted-foreground lg:grid">
							<span>{t('platform.monitoring.type')}</span>
							<span>{t('platform.monitoring.runObject')}</span>
							<span>{t('platform.monitoring.filterStatus')}</span>
							<span>{t('platform.monitoring.agent')}</span>
							<span>{t('platform.monitoring.time')}</span>
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
										onClick={() => {
											setSelectedRun({ type: item.type, id: item.id });
										}}
										className={cn(
											'grid w-full gap-3 border-b px-3 py-3 text-left text-xs transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:grid-cols-[7rem_minmax(0,1.8fr)_8rem_minmax(8rem,0.8fr)_10rem_4.5rem] lg:items-center',
											isActive
												? 'bg-primary/5 text-foreground'
												: 'bg-background hover:bg-muted/50',
										)}
									>
										<div className="flex min-w-0 items-center gap-2">
											<div className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background">
												<ItemIcon className="size-4 text-muted-foreground" />
											</div>
											<span className="truncate font-medium">
												{item.type === 'agent'
													? t('platform.monitoring.agentRunType')
													: t('platform.monitoring.workflowRunType')}
											</span>
										</div>
										<div className="min-w-0">
											<div className="truncate font-medium">{item.title}</div>
											<p className="mt-1 line-clamp-1 text-muted-foreground">
												{item.description}
											</p>
										</div>
										<div>
											<PlatformStatusBadge status={item.status} t={t} />
										</div>
										<div className="truncate text-muted-foreground">
											{item.agentId || '-'}
										</div>
										<div className="tabular-nums text-muted-foreground">
											{formatTimestamp(item.timestamp)}
										</div>
										<div className="text-right font-medium text-primary">
											{t('platform.monitoring.inspect')}
										</div>
									</button>
								);
							})}
						</div>
					</div>
				)}
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

								<div className="grid gap-3 md:grid-cols-2">
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
							</div>
						</div>
					) : null}

					{activeRun ? (
						<SheetFooter className="border-t bg-background">
							<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
