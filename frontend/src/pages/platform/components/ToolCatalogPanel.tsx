import { Boxes, CheckCircle2, RefreshCcw, Search, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RefObject } from 'react';

import { formatTimestamp } from '../platform-utils';
import { PlatformNotice } from './common';
import type { EnterprisePublishedAgent, EnterpriseToolCatalogItem } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface ToolCatalogPanelProps {
	sectionRef: RefObject<HTMLElement | null>;
	availableToolItems: EnterpriseToolCatalogItem[];
	publishedPlatformAgents: EnterprisePublishedAgent[];
	toolCatalogLoading: boolean;
	toolCatalogError: string | null;
	onRefetchToolCatalog: () => void | Promise<void>;
	t: Translate;
}

export function ToolCatalogPanel({
	sectionRef,
	availableToolItems,
	publishedPlatformAgents,
	toolCatalogLoading,
	toolCatalogError,
	onRefetchToolCatalog,
	t,
}: ToolCatalogPanelProps) {
	const [query, setQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState<'all' | 'allowed' | 'denied'>(
		'all',
	);

	const filteredTools = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		return availableToolItems.filter((tool) => {
			const matchesStatus =
				statusFilter === 'all' ||
				(statusFilter === 'allowed' && tool.allowed) ||
				(statusFilter === 'denied' && !tool.allowed);
			const matchesQuery =
				normalizedQuery.length === 0 ||
				tool.name.toLowerCase().includes(normalizedQuery) ||
				tool.description.toLowerCase().includes(normalizedQuery) ||
				tool.input_key.toLowerCase().includes(normalizedQuery);

			return matchesStatus && matchesQuery;
		});
	}, [availableToolItems, query, statusFilter]);

	return (
		<section ref={sectionRef} className="overflow-hidden rounded-lg border bg-background">
			<div className="flex flex-col gap-4 border-b p-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0">
						<h2 className="text-base font-semibold">
							{t('platform.toolCatalog.title')}
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							{t('platform.toolCatalog.description')}
						</p>
					</div>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => void onRefetchToolCatalog()}
						disabled={toolCatalogLoading}
					>
						<RefreshCcw className={cn(toolCatalogLoading && 'animate-spin')} />
						{t('platform.audit.refresh')}
					</Button>
				</div>

				<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t('platform.toolRunner.selectTool')}
							className="pl-9"
						/>
					</div>
					<div className="grid grid-cols-3 rounded-md border bg-background p-1">
						{(['all', 'allowed', 'denied'] as const).map((filter) => (
							<Button
								key={filter}
								type="button"
								size="sm"
								variant={statusFilter === filter ? 'secondary' : 'ghost'}
								className="h-8 px-3 text-xs"
								onClick={() => setStatusFilter(filter)}
							>
								{filter === 'all'
									? t('platform.toolCatalog.title')
									: filter === 'allowed'
										? t('platform.policy.allowed')
										: t('platform.policy.denied')}
							</Button>
						))}
					</div>
				</div>
			</div>

			{toolCatalogLoading ? (
				<div className="grid gap-3 p-4">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			) : toolCatalogError ? (
				<div className="p-4">
					<PlatformNotice>{toolCatalogError}</PlatformNotice>
				</div>
			) : availableToolItems.length === 0 ? (
				<div className="m-4 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
					{t('platform.toolCatalog.empty')}
				</div>
			) : filteredTools.length === 0 ? (
				<div className="m-4 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
					{t('platform.toolCatalog.empty')}
				</div>
			) : (
				<div className="divide-y">
					{filteredTools.map((tool) => {
						const statItems = [
							{
								label: t('platform.toolCatalog.calls'),
								value: String(tool.stats.calls ?? 0),
							},
							{
								label: t('platform.toolCatalog.successes'),
								value: String(tool.stats.successes ?? 0),
							},
							{
								label: t('platform.toolCatalog.failures'),
								value: String(tool.stats.failures ?? 0),
							},
							{
								label: t('platform.toolCatalog.avgDuration'),
								value:
									tool.stats.avg_duration_ms === null ||
									tool.stats.avg_duration_ms === undefined
										? '-'
										: `${Math.round(tool.stats.avg_duration_ms)} ms`,
							},
							{
								label: t('platform.toolCatalog.lastCalled'),
								value: tool.stats.last_called_at
									? formatTimestamp(tool.stats.last_called_at)
									: t('platform.toolCatalog.neverCalled'),
							},
						];

						return (
							<div
								key={tool.name}
								className="grid gap-3 p-4 transition-colors hover:bg-primary/5"
							>
								<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
									<div className="flex min-w-0 gap-3">
										<div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
											<Boxes className="size-4 text-muted-foreground" />
										</div>
										<div className="min-w-0">
											<div className="flex min-w-0 flex-wrap items-center gap-2">
												<h3 className="truncate font-mono text-sm font-semibold">
													{tool.name}
												</h3>
												<Badge
													variant={tool.allowed ? 'outline' : 'destructive'}
													className={cn(
														tool.allowed &&
															'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
													)}
												>
													{tool.allowed ? (
														<CheckCircle2 className="size-3" />
													) : (
														<XCircle className="size-3" />
													)}
													{tool.allowed
														? t('platform.policy.allowed')
														: t('platform.policy.denied')}
												</Badge>
											</div>
											<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
												{tool.description}
											</p>
											{tool.reason ? (
												<p className="mt-2 break-words text-xs text-muted-foreground">
													{tool.reason}
												</p>
											) : null}
										</div>
									</div>

									<div className="grid min-w-48 gap-2 text-xs">
										<div className="grid grid-cols-[5.5rem_1fr] gap-2">
											<span className="text-muted-foreground">
												{t('platform.toolCatalog.inputKey')}
											</span>
											<span className="min-w-0 truncate font-mono">
												{tool.input_key}
											</span>
										</div>
										<div className="grid grid-cols-[5.5rem_1fr] gap-2">
											<span className="text-muted-foreground">
												{t('platform.toolCatalog.defaultInput')}
											</span>
											<span className="min-w-0 truncate font-mono">
												{tool.default_input || '-'}
											</span>
										</div>
									</div>
								</div>

								<div className="grid gap-3 border-t pt-3 text-xs xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.85fr)_minmax(220px,0.75fr)]">
									<div className="grid gap-2 sm:grid-cols-3">
										{statItems.slice(0, 3).map((item) => (
											<div key={item.label} className="min-w-0">
												<div className="text-muted-foreground">{item.label}</div>
												<div
													className="mt-1 truncate font-mono font-medium"
													title={item.value}
												>
													{item.value}
												</div>
											</div>
										))}
									</div>
									<div className="grid gap-2">
										<div className="grid grid-cols-[5.5rem_1fr] gap-2">
											<span className="text-muted-foreground">
												{t('platform.toolCatalog.avgDuration')}
											</span>
											<span className="truncate font-mono">
												{statItems[3].value}
											</span>
										</div>
										<div className="grid grid-cols-[5.5rem_1fr] gap-2">
											<span className="text-muted-foreground">
												{t('platform.toolCatalog.lastCalled')}
											</span>
											<span className="truncate font-mono">
												{statItems[4].value}
											</span>
										</div>
									</div>
									<div className="min-w-0">
										<span className="text-muted-foreground">
											{t('platform.toolCatalog.configuredBy')}
										</span>
										{tool.configured_by_agents.length > 0 ? (
											<div className="mt-2 flex min-w-0 flex-wrap gap-1">
												{tool.configured_by_agents.map((agentId) => {
													const agent = publishedPlatformAgents.find(
														(item) => item.id === agentId,
													);

													return (
														<Badge
															key={agentId}
															variant="outline"
															className="max-w-full truncate bg-background font-normal"
														>
															{agent?.name ?? agentId}
														</Badge>
													);
												})}
											</div>
										) : (
											<div className="mt-2 text-muted-foreground">
												{t('platform.toolCatalog.notConfigured')}
											</div>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
