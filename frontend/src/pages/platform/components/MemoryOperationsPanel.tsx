import { ArrowRight, Brain, Database, FileClock, Play, ShieldCheck } from 'lucide-react';

import type { EnterpriseAgentRunResponse } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTimestamp } from '../platform-utils';

export interface MemoryOperationsItem {
	key: string;
	tenant: string;
	userId: string;
	agentId: string;
	agentName: string;
	runCount: number;
	memoryHitCount: number;
	memorySavedCount: number;
	latestAt: string;
	latestQuestion: string;
	latestAnswer: string;
	latestResponse: EnterpriseAgentRunResponse;
	sources: string[];
}

interface MemoryOperationsPanelProps {
	items: MemoryOperationsItem[];
	runCount: number;
	hitCount: number;
	savedCount: number;
	onRunAgent: () => void;
	onOpenAudit: () => void;
	onOpenRun: (item: MemoryOperationsItem) => void;
	onViewAudit: (item: MemoryOperationsItem) => void;
	labels: {
		eyebrow: string;
		title: string;
		description: string;
		runAgent: string;
		openAudit: string;
		loadedRuns: string;
		memoryHits: string;
		memoryWrites: string;
		activeScopes: string;
		empty: string;
		latestRun: string;
		runs: string;
		hits: string;
		writes: string;
		latestQuestion: string;
		latestAnswer: string;
		noQuestion: string;
		noAnswer: string;
		noSources: string;
		moreSources: (count: number) => string;
		openRun: string;
		viewAudit: string;
	};
}

export function MemoryOperationsPanel({
	items,
	runCount,
	hitCount,
	savedCount,
	onRunAgent,
	onOpenAudit,
	onOpenRun,
	onViewAudit,
	labels,
}: MemoryOperationsPanelProps) {
	const summaryItems = [
		{
			label: labels.loadedRuns,
			value: runCount,
			icon: FileClock,
		},
		{
			label: labels.memoryHits,
			value: hitCount,
			icon: Brain,
		},
		{
			label: labels.memoryWrites,
			value: savedCount,
			icon: Database,
		},
		{
			label: labels.activeScopes,
			value: items.length,
			icon: ShieldCheck,
		},
	];

	return (
		<section className="grid gap-4 rounded-lg border bg-background p-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<Brain className="size-4" />
						<span>{labels.eyebrow}</span>
					</div>
					<h2 className="text-base font-semibold">{labels.title}</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{labels.description}
					</p>
				</div>
				<div className="flex flex-wrap gap-2 lg:justify-end">
					<Button type="button" size="sm" variant="outline" onClick={onRunAgent}>
						<Play className="size-4" />
						{labels.runAgent}
					</Button>
					<Button type="button" size="sm" variant="outline" onClick={onOpenAudit}>
						<FileClock className="size-4" />
						{labels.openAudit}
					</Button>
				</div>
			</div>

			<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
				{summaryItems.map((item) => {
					const Icon = item.icon;
					return (
						<div
							key={item.label}
							className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3"
						>
							<div className="min-w-0">
								<div className="truncate text-xs text-muted-foreground">
									{item.label}
								</div>
								<div className="mt-1 text-xl font-semibold tabular-nums">
									{item.value}
								</div>
							</div>
							<Icon className="size-4 shrink-0 text-muted-foreground" />
						</div>
					);
				})}
			</div>

			{items.length === 0 ? (
				<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
					{labels.empty}
				</div>
			) : (
				<div className="grid gap-3 xl:grid-cols-2">
					{items.slice(0, 6).map((item) => (
						<div key={item.key} className="grid gap-3 rounded-lg border bg-muted/20 p-3">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<span className="truncate text-sm font-semibold">
											{item.agentName}
										</span>
										<Badge variant="secondary">{item.tenant}</Badge>
										<Badge variant="outline">{item.userId}</Badge>
									</div>
									<div className="mt-1 truncate font-mono text-xs text-muted-foreground">
										{item.agentId}
									</div>
								</div>
								<div className="shrink-0 text-right text-xs text-muted-foreground">
									<div>{labels.latestRun}</div>
									<div className="mt-1 tabular-nums">
										{formatTimestamp(item.latestAt)}
									</div>
								</div>
							</div>

							<div className="grid grid-cols-3 gap-2">
								{[
									{
										label: labels.runs,
										value: item.runCount,
									},
									{
										label: labels.hits,
										value: item.memoryHitCount,
									},
									{
										label: labels.writes,
										value: item.memorySavedCount,
									},
								].map((metric) => (
									<div key={metric.label} className="rounded-md border bg-background px-3 py-2">
										<div className="truncate text-xs text-muted-foreground">
											{metric.label}
										</div>
										<div className="mt-1 text-lg font-semibold tabular-nums">
											{metric.value}
										</div>
									</div>
								))}
							</div>

							<div className="grid gap-2 rounded-md border bg-background p-3">
								<div>
									<div className="text-xs text-muted-foreground">
										{labels.latestQuestion}
									</div>
									<div className="mt-1 line-clamp-2 text-sm leading-6">
										{item.latestQuestion || labels.noQuestion}
									</div>
								</div>
								<div>
									<div className="text-xs text-muted-foreground">
										{labels.latestAnswer}
									</div>
									<div className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
										{item.latestAnswer || labels.noAnswer}
									</div>
								</div>
							</div>

							<div className="flex flex-wrap items-center gap-2">
								{item.sources.length === 0 ? (
									<Badge variant="outline">{labels.noSources}</Badge>
								) : (
									item.sources.slice(0, 3).map((source) => (
										<Badge key={source} variant="outline">
											{source}
										</Badge>
									))
								)}
								{item.sources.length > 3 ? (
									<Badge variant="secondary">
										{labels.moreSources(item.sources.length - 3)}
									</Badge>
								) : null}
							</div>

							<div className="flex flex-wrap gap-2">
								<Button type="button" size="sm" onClick={() => onOpenRun(item)}>
									<ArrowRight className="size-4" />
									{labels.openRun}
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => onViewAudit(item)}
								>
									<FileClock className="size-4" />
									{labels.viewAudit}
								</Button>
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
