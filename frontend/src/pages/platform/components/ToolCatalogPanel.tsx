import { Boxes, CheckCircle2, RefreshCcw, XCircle } from 'lucide-react';
import type { RefObject } from 'react';

import type { EnterprisePublishedAgent, EnterpriseToolCatalogItem } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { PlatformNotice } from './common';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface ToolCatalogPanelProps {
	sectionRef: RefObject<HTMLElement | null>;
	availableToolItems: EnterpriseToolCatalogItem[];
	publishedPlatformAgents: EnterprisePublishedAgent[];
	toolCatalogLoading: boolean;
	toolCatalogError: string | null;
	onRefetchToolCatalog: () => void | Promise<void>;
	formatTimestamp: (value?: string) => string;
	t: Translate;
}

export function ToolCatalogPanel({
	sectionRef,
	availableToolItems,
	publishedPlatformAgents,
	toolCatalogLoading,
	toolCatalogError,
	onRefetchToolCatalog,
	formatTimestamp,
	t,
}: ToolCatalogPanelProps) {
	return (
		<section ref={sectionRef} className="flex flex-col gap-3">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="text-base font-semibold">
						{t('platform.toolCatalog.title')}
					</h2>
					<p className="text-sm text-muted-foreground">
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

			{toolCatalogLoading ? (
				<div className="grid gap-3 lg:grid-cols-3">
					<Skeleton className="h-48 w-full" />
					<Skeleton className="h-48 w-full" />
					<Skeleton className="h-48 w-full" />
				</div>
			) : toolCatalogError ? (
				<PlatformNotice>{toolCatalogError}</PlatformNotice>
			) : availableToolItems.length === 0 ? (
				<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
					{t('platform.toolCatalog.empty')}
				</div>
			) : (
				<div className="grid gap-3 lg:grid-cols-3">
					{availableToolItems.map((tool) => {
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
							<Card key={tool.name} size="sm" className="rounded-lg shadow-none">
								<CardHeader className="grid-cols-[auto_1fr_auto] items-start gap-3">
									<div className="flex size-8 items-center justify-center rounded-lg border bg-background">
										<Boxes className="size-4 text-muted-foreground" />
									</div>
									<div className="min-w-0">
										<CardTitle className="truncate font-mono text-sm">
											{tool.name}
										</CardTitle>
										<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
											{tool.description}
										</p>
									</div>
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
								</CardHeader>
								<CardContent className="grid gap-4 text-xs">
									{tool.reason ? (
										<p className="break-words text-muted-foreground">
											{tool.reason}
										</p>
									) : null}
									<div className="grid gap-2">
										<div className="grid grid-cols-[6rem_1fr] gap-2">
											<span className="text-muted-foreground">
												{t('platform.toolCatalog.inputKey')}
											</span>
											<span className="min-w-0 truncate font-mono">
												{tool.input_key}
											</span>
										</div>
										<div className="grid grid-cols-[6rem_1fr] gap-2">
											<span className="text-muted-foreground">
												{t('platform.toolCatalog.defaultInput')}
											</span>
											<span className="min-w-0 truncate font-mono">
												{tool.default_input || '-'}
											</span>
										</div>
										<div className="grid grid-cols-[6rem_1fr] gap-2">
											<span className="text-muted-foreground">
												{t('platform.toolCatalog.configuredBy')}
											</span>
											{tool.configured_by_agents.length > 0 ? (
												<div className="flex min-w-0 flex-wrap gap-1">
													{tool.configured_by_agents.map((agentId) => {
														const agent = publishedPlatformAgents.find(
															(item) => item.id === agentId,
														);

														return (
															<Badge
																key={agentId}
																variant="outline"
																className="max-w-full truncate font-normal"
															>
																{agent?.name ?? agentId}
															</Badge>
														);
													})}
												</div>
											) : (
												<span className="min-w-0 text-muted-foreground">
													{t('platform.toolCatalog.notConfigured')}
												</span>
											)}
										</div>
									</div>
									<div className="grid gap-2 sm:grid-cols-2">
										{statItems.map((item) => (
											<div
												key={item.label}
												className="rounded-lg border bg-background p-2"
											>
												<div className="text-muted-foreground">
													{item.label}
												</div>
												<div
													className="mt-1 truncate font-mono font-medium"
													title={item.value}
												>
													{item.value}
												</div>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}
		</section>
	);
}
