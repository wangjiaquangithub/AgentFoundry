import {
	ArrowRight,
	Brain,
	Clock3,
	Database,
	FileClock,
	Play,
	Search,
	ShieldCheck,
	UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { formatTimestamp } from '../platform-utils';
import { PlatformPageHeader, PlatformPageShell, StatCard } from './common';
import type { MemoryOperationsItem } from './MemoryOperationsPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;
type MemoryFilter = 'all' | 'hits' | 'writes' | 'cold';

interface MemoryViewPageProps {
	memoryOperationsItems: MemoryOperationsItem[];
	memoryOperationsRunCount: number;
	memoryOperationsHitCount: number;
	memoryOperationsSavedCount: number;
	onNavigate: (to: string) => void;
	t: Translate;
}

export function MemoryViewPage({
	memoryOperationsItems,
	memoryOperationsRunCount,
	memoryOperationsHitCount,
	memoryOperationsSavedCount,
	onNavigate,
	t,
}: MemoryViewPageProps) {
	const [memorySearch, setMemorySearch] = useState('');
	const [memoryFilter, setMemoryFilter] = useState<MemoryFilter>('all');
	const [selectedScopeKey, setSelectedScopeKey] = useState<string | null>(null);

	const filteredItems = useMemo(() => {
		const query = memorySearch.trim().toLowerCase();

		return memoryOperationsItems.filter((item) => {
			const matchesFilter =
				memoryFilter === 'all' ||
				(memoryFilter === 'hits' && item.memoryHitCount > 0) ||
				(memoryFilter === 'writes' && item.memorySavedCount > 0) ||
				(memoryFilter === 'cold' &&
					item.memoryHitCount === 0 &&
					item.memorySavedCount === 0);

			if (!matchesFilter) {
				return false;
			}

			if (!query) {
				return true;
			}

			return [
				item.agentName,
				item.agentId,
				item.tenant,
				item.userId,
				item.latestQuestion,
				item.latestAnswer,
				...item.sources,
			]
				.filter(Boolean)
				.some((value) => value.toLowerCase().includes(query));
		});
	}, [memoryFilter, memoryOperationsItems, memorySearch]);

	const selectedItem =
		filteredItems.find((item) => item.key === selectedScopeKey) ?? filteredItems[0] ?? null;
	const sourceCount = new Set(memoryOperationsItems.flatMap((item) => item.sources)).size;
	const topSources = Array.from(new Set(memoryOperationsItems.flatMap((item) => item.sources))).slice(
		0,
		8,
	);
	const memoryFilters: Array<{ label: string; value: MemoryFilter }> = [
		{ label: '全部', value: 'all' },
		{ label: '有命中', value: 'hits' },
		{ label: '有写入', value: 'writes' },
		{ label: '待激活', value: 'cold' },
	];

	return (
		<PlatformPageShell>
			<PlatformPageHeader
				icon={Brain}
				eyebrow={t('platform.memoryOps.eyebrow')}
				title={t('platform.memoryOps.title')}
				description={t('platform.memoryOps.description')}
				actions={
					<>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => onNavigate('/platform/agents')}
						>
							<Play className="size-4" />
							{t('platform.memoryOps.runAgent')}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => onNavigate('/platform/runs')}
						>
							<FileClock className="size-4" />
							{t('platform.memoryOps.openRun')}
						</Button>
					</>
				}
			/>

			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{[
					{
						label: t('platform.memoryOps.loadedRuns'),
						value: memoryOperationsRunCount,
						helper: '运行历史已接入长期记忆统计',
						icon: FileClock,
					},
					{
						label: t('platform.memoryOps.memoryHits'),
						value: memoryOperationsHitCount,
						helper: '回答中检索到的历史上下文',
						icon: Brain,
					},
					{
						label: t('platform.memoryOps.memoryWrites'),
						value: memoryOperationsSavedCount,
						helper: '运行后沉淀到记忆层的记录',
						icon: Database,
					},
					{
						label: t('platform.memoryOps.activeScopes'),
						value: memoryOperationsItems.length,
						helper: `${sourceCount} 个来源参与记忆证据`,
						icon: ShieldCheck,
					},
				].map((item) => {
					const Icon = item.icon;
					return (
						<StatCard
							key={item.label}
							label={item.label}
							value={item.value}
							helper={item.helper}
							icon={Icon}
						/>
					);
				})}
			</section>

			<section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.42fr)]">
				<div className="grid min-w-0 gap-4 rounded-lg border bg-background p-4 shadow-sm">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
						<div>
							<h2 className="text-sm font-semibold">记忆作用域清单</h2>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								按租户、用户和 Agent 聚合长期记忆，快速定位哪些业务范围已经形成可复用上下文。
							</p>
						</div>
						<div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
							<div className="relative min-w-0 sm:w-72">
								<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={memorySearch}
									onChange={(event) => setMemorySearch(event.target.value)}
									placeholder="搜索 Agent、租户、用户或来源"
									className="pl-9"
								/>
							</div>
							<div className="grid grid-cols-4 gap-1 rounded-md border bg-muted/30 p-1 sm:w-[19rem]">
								{memoryFilters.map((filter) => (
									<Button
										key={filter.value}
										type="button"
										size="sm"
										variant={memoryFilter === filter.value ? 'secondary' : 'ghost'}
										className="h-8 px-2 text-xs"
										onClick={() => setMemoryFilter(filter.value)}
									>
										{filter.label}
									</Button>
								))}
							</div>
						</div>
					</div>
					{memoryOperationsItems.length === 0 ? (
						<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
							{t('platform.memoryOps.empty')}
						</div>
					) : filteredItems.length === 0 ? (
						<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
							没有匹配当前筛选条件的记忆作用域。
						</div>
					) : (
						<div className="grid gap-2">
							{filteredItems.map((item) => {
								const isSelected = selectedItem?.key === item.key;

								return (
									<button
										key={item.key}
										type="button"
										onClick={() => setSelectedScopeKey(item.key)}
										className={cn(
											'grid gap-3 rounded-lg border bg-muted/10 p-3 text-left transition-colors hover:border-slate-300 hover:bg-muted/20',
											isSelected && 'border-slate-900 bg-slate-50',
										)}
									>
										<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
											<div className="min-w-0">
												<div className="flex min-w-0 flex-wrap items-center gap-2">
													<h3 className="min-w-0 truncate text-sm font-semibold">
														{item.agentName}
													</h3>
													<Badge variant={item.memoryHitCount > 0 ? 'default' : 'outline'}>
														{item.memoryHitCount > 0 ? '已命中' : '待命中'}
													</Badge>
												</div>
												<div className="mt-2 flex flex-wrap gap-1">
													<Badge variant="secondary">{item.tenant}</Badge>
													<Badge variant="outline">{item.userId}</Badge>
													<Badge variant="outline" className="max-w-full truncate">
														{item.agentId}
													</Badge>
												</div>
											</div>
											<div className="grid grid-cols-3 gap-2 sm:min-w-64">
												{[
													{ label: t('platform.memoryOps.runs'), value: item.runCount },
													{ label: t('platform.memoryOps.hits'), value: item.memoryHitCount },
													{
														label: t('platform.memoryOps.writes'),
														value: item.memorySavedCount,
													},
												].map((metric) => (
													<div
														key={metric.label}
														className="rounded-md border bg-background px-3 py-2"
													>
														<div className="truncate text-xs text-muted-foreground">
															{metric.label}
														</div>
														<div className="mt-1 text-base font-semibold tabular-nums">
															{metric.value}
														</div>
													</div>
												))}
											</div>
										</div>
										<div className="grid gap-3 border-t pt-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
											<p className="line-clamp-2 min-w-0 text-sm leading-6 text-muted-foreground">
												{item.latestQuestion || t('platform.memoryOps.noQuestion')}
											</p>
											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												<Clock3 className="size-4" />
												<span className="tabular-nums">
													{formatTimestamp(item.latestAt)}
												</span>
											</div>
										</div>
									</button>
								);
							})}
						</div>
					)}
				</div>

				<aside className="grid gap-4 xl:sticky xl:top-20">
					<div className="rounded-lg border bg-background p-4 shadow-sm">
						<div className="flex items-start justify-between gap-3">
							<div>
								<h2 className="text-sm font-semibold">记忆证据面板</h2>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									查看选中作用域的最近问答、来源和运行入口。
								</p>
							</div>
							<Badge variant="outline">{filteredItems.length} 项</Badge>
						</div>

						{selectedItem ? (
							<div className="mt-4 grid gap-4">
								<div className="rounded-lg border bg-muted/10 p-3">
									<div className="flex min-w-0 items-start gap-3">
										<div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background">
											<UserRound className="size-4 text-muted-foreground" />
										</div>
										<div className="min-w-0">
											<h3 className="truncate text-sm font-semibold">
												{selectedItem.agentName}
											</h3>
											<p className="mt-1 truncate font-mono text-xs text-muted-foreground">
												{selectedItem.key}
											</p>
										</div>
									</div>
								</div>

								<div className="grid grid-cols-3 gap-2">
									{[
										{ label: t('platform.memoryOps.runs'), value: selectedItem.runCount },
										{
											label: t('platform.memoryOps.hits'),
											value: selectedItem.memoryHitCount,
										},
										{
											label: t('platform.memoryOps.writes'),
											value: selectedItem.memorySavedCount,
										},
									].map((metric) => (
										<div key={metric.label} className="rounded-md border px-3 py-2">
											<div className="truncate text-xs text-muted-foreground">
												{metric.label}
											</div>
											<div className="mt-1 text-lg font-semibold tabular-nums">
												{metric.value}
											</div>
										</div>
									))}
								</div>

								<div className="grid gap-3">
									<div className="rounded-lg border p-3">
										<div className="text-xs text-muted-foreground">
											{t('platform.memoryOps.latestQuestion')}
										</div>
										<p className="mt-2 text-sm leading-6">
											{selectedItem.latestQuestion || t('platform.memoryOps.noQuestion')}
										</p>
									</div>
									<div className="rounded-lg border p-3">
										<div className="text-xs text-muted-foreground">
											{t('platform.memoryOps.latestAnswer')}
										</div>
										<p className="mt-2 line-clamp-6 text-sm leading-6 text-muted-foreground">
											{selectedItem.latestAnswer || t('platform.memoryOps.noAnswer')}
										</p>
									</div>
								</div>

								<div>
									<div className="mb-2 text-xs text-muted-foreground">记忆来源</div>
									<div className="flex flex-wrap gap-1">
										{selectedItem.sources.length ? (
											selectedItem.sources.map((source) => (
												<Badge key={source} variant="outline">
													{source}
												</Badge>
											))
										) : (
											<Badge variant="outline">{t('platform.memoryOps.noSources')}</Badge>
										)}
									</div>
								</div>

								<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
									<Button type="button" onClick={() => onNavigate('/platform/runs')}>
										<ArrowRight className="size-4" />
										{t('platform.memoryOps.openRun')}
									</Button>
									<Button
										type="button"
										variant="outline"
										onClick={() => onNavigate('/platform/agents')}
									>
										<Play className="size-4" />
										{t('platform.memoryOps.runAgent')}
									</Button>
								</div>
							</div>
						) : (
							<div className="mt-4 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
								选择一个记忆作用域查看证据。
							</div>
						)}
					</div>

					<div className="rounded-lg border bg-background p-4 shadow-sm">
						<h2 className="text-sm font-semibold">来源覆盖</h2>
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							用于判断长期记忆是否集中依赖少数来源。
						</p>
						<div className="mt-3 flex flex-wrap gap-1">
							{topSources.length ? (
								topSources.map((source) => (
									<Badge key={source} variant="secondary">
										{source}
									</Badge>
								))
							) : (
								<Badge variant="outline">{t('platform.memoryOps.noSources')}</Badge>
							)}
						</div>
					</div>
				</aside>
			</section>
		</PlatformPageShell>
	);
}
