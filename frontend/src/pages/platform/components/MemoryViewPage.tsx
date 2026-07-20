import { Brain, Database, FileClock, Play, ShieldCheck } from 'lucide-react';

import { formatTimestamp } from '../platform-utils';
import { PlatformPageHeader, PlatformPageShell, StatCard } from './common';
import type { MemoryOperationsItem } from './MemoryOperationsPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


type Translate = (key: string, options?: Record<string, unknown>) => string;

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
						icon: FileClock,
					},
					{
						label: t('platform.memoryOps.memoryHits'),
						value: memoryOperationsHitCount,
						icon: Brain,
					},
					{
						label: t('platform.memoryOps.memoryWrites'),
						value: memoryOperationsSavedCount,
						icon: Database,
					},
					{
						label: t('platform.memoryOps.activeScopes'),
						value: memoryOperationsItems.length,
						icon: ShieldCheck,
					},
				].map((item) => {
					const Icon = item.icon;
					return (
						<StatCard key={item.label} label={item.label} value={item.value} icon={Icon} />
					);
				})}
			</section>

			<section className="grid gap-4">
				<div className="rounded-lg border bg-background p-4 shadow-sm">
					<div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h2 className="text-sm font-semibold">{t('platform.memoryOps.title')}</h2>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{t('platform.memoryOps.description')}
							</p>
						</div>
						<Badge variant="outline">
							{memoryOperationsItems.length} {t('platform.memoryOps.activeScopes')}
						</Badge>
					</div>
					{memoryOperationsItems.length === 0 ? (
						<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
							{t('platform.memoryOps.empty')}
						</div>
					) : (
						<div className="grid gap-3 xl:grid-cols-2">
							{memoryOperationsItems.map((item) => (
								<article
									key={item.key}
									className="grid content-start gap-3 rounded-lg border bg-muted/10 p-4"
								>
									<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
										<div className="min-w-0">
											<h3 className="truncate text-sm font-semibold">
												{item.agentName}
											</h3>
											<div className="mt-2 flex flex-wrap gap-1">
												<Badge variant="secondary">{item.tenant}</Badge>
												<Badge variant="outline">{item.userId}</Badge>
												<Badge variant="outline">{item.agentId}</Badge>
											</div>
										</div>
										<div className="shrink-0 text-xs text-muted-foreground sm:text-right">
											<div>{t('platform.memoryOps.latestRun')}</div>
											<div className="mt-1 tabular-nums">
												{formatTimestamp(item.latestAt)}
											</div>
										</div>
									</div>
									<div className="grid grid-cols-3 gap-2">
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
												<div className="mt-1 text-lg font-semibold tabular-nums">
													{metric.value}
												</div>
											</div>
										))}
									</div>
									<div className="grid gap-2 text-sm">
										<div className="rounded-md border bg-background p-3">
											<div className="mb-1 text-xs text-muted-foreground">
												{t('platform.agentRunner.question')}
											</div>
											<p className="line-clamp-2">{item.latestQuestion}</p>
										</div>
										<div className="rounded-md border bg-background p-3">
											<div className="mb-1 text-xs text-muted-foreground">
												{t('platform.agentRunner.answer')}
											</div>
											<p className="line-clamp-3 text-muted-foreground">
												{item.latestAnswer}
											</p>
										</div>
									</div>
									{item.sources.length ? (
										<div className="flex flex-wrap gap-1">
											{item.sources.map((source) => (
												<Badge key={source} variant="outline">
													{source}
												</Badge>
											))}
										</div>
									) : null}
								</article>
							))}
						</div>
					)}
				</div>
			</section>
		</PlatformPageShell>
	);
}
