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
import { PlatformEmptyState } from './PlatformEmptyState';
import { PlatformFilterBar } from './PlatformFilterBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

	const selectedItem = filteredItems.find((item) => item.key === selectedScopeKey) ?? null;
	const sourceCount = new Set(memoryOperationsItems.flatMap((item) => item.sources)).size;
	const hasActiveFilters = memoryFilter !== 'all' || memorySearch.trim().length > 0;
	const sourceRows = useMemo(() => {
		const counts = new Map<string, number>();
		memoryOperationsItems.forEach((item) => {
			item.sources.forEach((source) => {
				counts.set(source, (counts.get(source) ?? 0) + 1);
			});
		});

		return Array.from(counts.entries())
			.map(([source, count]) => ({ source, count }))
			.sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
			.slice(0, 8);
	}, [memoryOperationsItems]);
	const memoryFilters: Array<{ label: string; value: MemoryFilter }> = [
		{ label: t('platform.memoryOps.filters.all'), value: 'all' },
		{ label: t('platform.memoryOps.filters.hits'), value: 'hits' },
		{ label: t('platform.memoryOps.filters.writes'), value: 'writes' },
		{ label: t('platform.memoryOps.filters.cold'), value: 'cold' },
	];
	const clearFilters = () => {
		setMemorySearch('');
		setMemoryFilter('all');
	};

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
							helper: t('platform.memoryOps.statLoadedRunsHelper'),
							icon: FileClock,
						},
						{
							label: t('platform.memoryOps.memoryHits'),
							value: memoryOperationsHitCount,
							helper: t('platform.memoryOps.statMemoryHitsHelper'),
							icon: Brain,
						},
						{
							label: t('platform.memoryOps.memoryWrites'),
							value: memoryOperationsSavedCount,
							helper: t('platform.memoryOps.statMemoryWritesHelper'),
							icon: Database,
						},
						{
							label: t('platform.memoryOps.activeScopes'),
							value: memoryOperationsItems.length,
							helper: t('platform.memoryOps.statActiveScopesHelper', {
								count: sourceCount,
							}),
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

			<div className="grid gap-5">
					<section className="grid min-w-0 gap-4">
						<div className="grid min-w-0 gap-4 rounded-lg border bg-background/80 p-4">
							<div>
								<div className="flex flex-wrap items-center gap-2">
									<h2 className="text-sm font-semibold">
										{t('platform.memoryOps.scopeTitle')}
									</h2>
									<Badge variant="secondary">
										{t('platform.memoryOps.scopeCount', {
											count: filteredItems.length,
										})}
									</Badge>
									<Badge variant="outline">
										{t('platform.memoryOps.sourceCount', {
											count: sourceCount,
										})}
									</Badge>
								</div>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{t('platform.memoryOps.scopeDescription')}
								</p>
							</div>
							<PlatformFilterBar
								resultLabel={t('platform.ux.filters.results', {
									count: filteredItems.length,
								})}
								clearLabel={t('platform.ux.filters.clear')}
								onClear={clearFilters}
								clearDisabled={!hasActiveFilters}
							>
								<label className="grid gap-1.5 md:col-span-1 xl:col-span-3">
									<span className="text-xs font-medium text-muted-foreground">
										{t('platform.monitoring.filterKeyword')}
									</span>
									<div className="relative min-w-0">
										<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
										<Input
											value={memorySearch}
											onChange={(event) => setMemorySearch(event.target.value)}
											placeholder={t('platform.memoryOps.searchPlaceholder')}
											className="pl-9"
										/>
									</div>
								</label>
								<div className="grid gap-1.5 md:col-span-1 xl:col-span-3">
									<span className="text-xs font-medium text-muted-foreground">
										{t('platform.monitoring.filterType')}
									</span>
									<div className="grid grid-cols-4 gap-1 rounded-md border bg-background p-1">
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
							</PlatformFilterBar>
							{memoryOperationsItems.length === 0 ? (
								<PlatformEmptyState
									variant="noData"
									title={t('platform.memoryOps.emptyTitle')}
									description={t('platform.memoryOps.empty')}
								/>
							) : filteredItems.length === 0 ? (
								<PlatformEmptyState
									variant="filtered"
									title={t('platform.ux.empty.filteredTitle')}
									description={t('platform.memoryOps.emptyFilteredDescription')}
									actionLabel={t('platform.ux.filters.clear')}
									onAction={clearFilters}
								/>
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
													'grid gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5',
													isSelected && 'border-primary/40 bg-primary/5',
												)}
											>
												<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
													<div className="min-w-0">
														<div className="flex min-w-0 flex-wrap items-center gap-2">
															<h3 className="min-w-0 truncate text-sm font-semibold">
																{item.agentName}
															</h3>
																<Badge
																	variant={item.memoryHitCount > 0 ? 'default' : 'outline'}
																>
																	{item.memoryHitCount > 0
																		? t('platform.memoryOps.hitStatus')
																		: t('platform.memoryOps.pendingHitStatus')}
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
															{
																label: t('platform.memoryOps.runs'),
																value: item.runCount,
															},
															{
																label: t('platform.memoryOps.hits'),
																value: item.memoryHitCount,
															},
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

					</section>

					<Sheet
						open={Boolean(selectedItem)}
						onOpenChange={(open) => {
							if (!open) {
								setSelectedScopeKey(null);
							}
						}}
					>
						<SheetContent className="w-full sm:max-w-xl">
							<SheetHeader className="border-b pr-12">
								<div className="flex items-start justify-between gap-3">
									<div>
										<SheetTitle>
											{t('platform.memoryOps.selectedScopeTitle')}
										</SheetTitle>
										<SheetDescription>
											{t('platform.memoryOps.selectedScopeDescription')}
										</SheetDescription>
									</div>
									{selectedItem ? (
										<Badge
											variant={
												selectedItem.memoryHitCount > 0 ? 'default' : 'outline'
											}
										>
											{selectedItem.memoryHitCount > 0
												? t('platform.memoryOps.hitStatus')
												: t('platform.memoryOps.pendingHitStatus')}
										</Badge>
									) : null}
								</div>
							</SheetHeader>

							{selectedItem ? (
								<div className="min-h-0 flex-1 overflow-y-auto px-4">
									<div className="grid gap-4 py-4">
										<div className="rounded-lg border bg-background p-3">
											<div className="flex min-w-0 items-start gap-3">
												<div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background">
													<UserRound className="size-4 text-muted-foreground" />
												</div>
												<div className="min-w-0">
													<h3 className="truncate text-sm font-semibold">
														{selectedItem.agentName}
													</h3>
													<p className="mt-1 break-all font-mono text-xs text-muted-foreground">
														{selectedItem.key}
													</p>
												</div>
											</div>
										</div>

										<div className="grid grid-cols-3 gap-2">
											{[
												{
													label: t('platform.memoryOps.runs'),
													value: selectedItem.runCount,
												},
												{
													label: t('platform.memoryOps.hits'),
													value: selectedItem.memoryHitCount,
												},
												{
													label: t('platform.memoryOps.writes'),
													value: selectedItem.memorySavedCount,
												},
											].map((metric) => (
												<div
													key={metric.label}
													className="rounded-md border px-3 py-2"
												>
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
													{selectedItem.latestQuestion ||
														t('platform.memoryOps.noQuestion')}
												</p>
											</div>
											<div className="rounded-lg border p-3">
												<div className="text-xs text-muted-foreground">
													{t('platform.memoryOps.latestAnswer')}
												</div>
												<p className="mt-2 text-sm leading-6 text-muted-foreground">
													{selectedItem.latestAnswer ||
														t('platform.memoryOps.noAnswer')}
												</p>
											</div>
										</div>

										<div>
											<div className="mb-2 text-xs text-muted-foreground">
												{t('platform.memoryOps.memorySources')}
											</div>
											<div className="flex flex-wrap gap-1">
												{selectedItem.sources.length ? (
													selectedItem.sources.map((source) => (
														<Badge key={source} variant="outline">
															{source}
														</Badge>
													))
												) : (
													<Badge variant="outline">
														{t('platform.memoryOps.noSources')}
													</Badge>
												)}
											</div>
										</div>
									</div>
								</div>
							) : null}

							<SheetFooter className="border-t bg-background">
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
							</SheetFooter>
						</SheetContent>
					</Sheet>

					<section className="rounded-lg border bg-background/80 p-4">
							<div className="flex items-start justify-between gap-3">
								<div>
									<h2 className="text-sm font-semibold">
										{t('platform.memoryOps.sourceCoverageTitle')}
									</h2>
									<p className="mt-1 text-xs leading-5 text-muted-foreground">
										{t('platform.memoryOps.sourceCoverageDescription')}
									</p>
								</div>
								<Badge variant="outline">
									{t('platform.memoryOps.sourceCount', {
										count: sourceCount,
									})}
								</Badge>
							</div>
							<div className="mt-4 grid gap-2">
							{sourceRows.length ? (
								sourceRows.map((row) => (
									<div
										key={row.source}
										className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
										>
											<div className="min-w-0 truncate text-sm font-medium">{row.source}</div>
											<Badge variant="secondary">
												{t('platform.memoryOps.scopeCount', {
													count: row.count,
												})}
											</Badge>
										</div>
									))
								) : (
									<PlatformEmptyState
										variant="noData"
										title={t('platform.memoryOps.memorySources')}
										description={t('platform.memoryOps.noSourcesDescription')}
									/>
								)}
						</div>
				</section>
			</div>
		</PlatformPageShell>
	);
}
