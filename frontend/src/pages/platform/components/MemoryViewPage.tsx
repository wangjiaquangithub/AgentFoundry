import { Brain, Database, FileClock, Play, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { formatTimestamp } from '../platform-utils';
import type { MemoryOperationsItem } from './MemoryOperationsPanel';

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
		<main className="h-full overflow-y-auto bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
				<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0">
						<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
							<Brain className="size-4" />
							<span>{t('platform.memoryOps.eyebrow')}</span>
						</div>
						<h1 className="text-2xl font-semibold tracking-normal">
							{t('platform.memoryOps.title')}
						</h1>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
							{t('platform.memoryOps.description')}
						</p>
					</div>
					<div className="flex flex-wrap gap-2 lg:justify-end">
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
							{t('platform.nav.runs')}
						</Button>
					</div>
				</section>

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
							<Card key={item.label} size="sm" className="rounded-lg shadow-none">
								<CardHeader className="grid-cols-[1fr_auto] items-start gap-3">
									<CardTitle className="text-sm text-muted-foreground">
										{item.label}
									</CardTitle>
									<Icon className="size-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-semibold tabular-nums">
										{item.value}
									</div>
								</CardContent>
							</Card>
						);
					})}
				</section>

				<section className="grid gap-3">
					{memoryOperationsItems.length === 0 ? (
						<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
							{t('platform.memoryOps.empty')}
						</div>
					) : (
						<div className="grid gap-3 xl:grid-cols-2">
							{memoryOperationsItems.map((item) => (
								<Card key={item.key} className="rounded-lg shadow-none">
									<CardHeader className="grid-cols-[1fr_auto] items-start gap-3">
										<div className="min-w-0">
											<CardTitle className="truncate text-sm">
												{item.agentName}
											</CardTitle>
											<div className="mt-2 flex flex-wrap gap-1">
												<Badge variant="secondary">{item.tenant}</Badge>
												<Badge variant="outline">{item.userId}</Badge>
												<Badge variant="outline">{item.agentId}</Badge>
											</div>
										</div>
										<div className="shrink-0 text-right text-xs text-muted-foreground">
											<div>{t('platform.memoryOps.latestRun')}</div>
											<div className="mt-1 tabular-nums">
												{formatTimestamp(item.latestAt)}
											</div>
										</div>
									</CardHeader>
									<CardContent className="grid gap-3">
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
													className="rounded-md border bg-muted/10 px-3 py-2"
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
											<div className="rounded-md border bg-muted/10 p-3">
												<div className="mb-1 text-xs text-muted-foreground">
													{t('platform.agentRunner.question')}
												</div>
												<p className="line-clamp-2">{item.latestQuestion}</p>
											</div>
											<div className="rounded-md border bg-muted/10 p-3">
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
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</section>
			</div>
		</main>
	);
}
