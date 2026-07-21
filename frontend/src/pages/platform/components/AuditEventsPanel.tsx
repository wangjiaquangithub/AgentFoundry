import { CheckCircle2, ListChecks, RefreshCcw, XCircle } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import { formatTimestamp } from '../platform-utils';
import { PlatformEmptyState } from './PlatformEmptyState';
import { PlatformFilterBar } from './PlatformFilterBar';
import { PlatformStatusBadge } from './PlatformStatusBadge';
import type {
	EnterpriseAuditEvent,
	EnterprisePublishedAgent,
	EnterpriseToolCatalogItem,
} from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const ALL_AGENTS_VALUE = '__all_agents__';
const ALL_TOOLS_VALUE = '__all_tools__';
const ALL_AUDIT_STATUSES_VALUE = '__all_statuses__';

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

interface AuditEventsPanelProps {
	auditFilters: AuditFilters;
	activePlatformAgents: EnterprisePublishedAgent[];
	availableToolItems: EnterpriseToolCatalogItem[];
	currentTenant?: string;
	currentUserId?: string;
	username: string;
	auditLoading: boolean;
	auditError: string | null;
	auditEvents: EnterpriseAuditEvent[];
	auditStats: AuditStatItem[];
	onAuditFiltersChange: Dispatch<SetStateAction<AuditFilters>>;
	onRefetchAuditEvents: () => void | Promise<void>;
	summarizeAuditObject: (value?: Record<string, unknown>) => string;
	t: Translate;
}

export function AuditEventsPanel({
	auditFilters,
	activePlatformAgents,
	availableToolItems,
	currentTenant,
	currentUserId,
	username,
	auditLoading,
	auditError,
	auditEvents,
	auditStats,
	onAuditFiltersChange,
	onRefetchAuditEvents,
	summarizeAuditObject,
	t,
}: AuditEventsPanelProps) {
	const hasActiveAuditFilters = Boolean(
		auditFilters.tenant ||
			auditFilters.user_id ||
			auditFilters.agent_id ||
			auditFilters.tool_name ||
			auditFilters.success,
	);
	const clearAuditFilters = () => {
		onAuditFiltersChange((current) => ({
			...current,
			tenant: '',
			user_id: '',
			agent_id: '',
			tool_name: '',
			success: '',
			limit: current.limit || '50',
		}));
	};

	return (
		<section className="flex flex-col gap-4 rounded-lg border bg-background p-4 shadow-none">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="text-base font-semibold">{t('platform.audit.title')}</h2>
					<p className="text-sm text-muted-foreground">
						{t('platform.audit.description')}
					</p>
				</div>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={() => void onRefetchAuditEvents()}
					disabled={auditLoading}
				>
					<RefreshCcw className={cn(auditLoading && 'animate-spin')} />
					{t('platform.audit.refresh')}
				</Button>
			</div>

			<PlatformFilterBar
				resultLabel={t('platform.ux.filters.results', {
					count: auditEvents.length,
				})}
				clearLabel={t('platform.ux.filters.clear')}
				onClear={clearAuditFilters}
				clearDisabled={!hasActiveAuditFilters || auditLoading}
			>
				<div className="grid gap-2">
					<label className="text-xs font-medium text-muted-foreground">
						{t('platform.audit.filterTenant')}
					</label>
					<Input
						value={auditFilters.tenant}
						onChange={(event) =>
							onAuditFiltersChange((current) => ({
								...current,
								tenant: event.target.value,
							}))
						}
						placeholder={currentTenant || 'default'}
					/>
				</div>
				<div className="grid gap-2">
					<label className="text-xs font-medium text-muted-foreground">
						{t('platform.audit.filterUser')}
					</label>
					<Input
						value={auditFilters.user_id}
						onChange={(event) =>
							onAuditFiltersChange((current) => ({
								...current,
								user_id: event.target.value,
							}))
						}
						placeholder={currentUserId || username}
					/>
				</div>
				<div className="grid gap-2">
					<label className="text-xs font-medium text-muted-foreground">
						{t('platform.audit.filterAgent')}
					</label>
					<Select
						value={auditFilters.agent_id || ALL_AGENTS_VALUE}
						onValueChange={(value) =>
							onAuditFiltersChange((current) => ({
								...current,
								agent_id: value === ALL_AGENTS_VALUE ? '' : value,
							}))
						}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL_AGENTS_VALUE}>
								{t('platform.audit.allAgents')}
							</SelectItem>
							{activePlatformAgents.map((agent) => (
								<SelectItem key={agent.id} value={agent.id}>
									{agent.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="grid gap-2">
					<label className="text-xs font-medium text-muted-foreground">
						{t('platform.audit.filterTool')}
					</label>
					<Select
						value={auditFilters.tool_name || ALL_TOOLS_VALUE}
						onValueChange={(value) =>
							onAuditFiltersChange((current) => ({
								...current,
								tool_name: value === ALL_TOOLS_VALUE ? '' : value,
							}))
						}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL_TOOLS_VALUE}>
								{t('platform.audit.allTools')}
							</SelectItem>
							{availableToolItems.map((tool) => (
								<SelectItem key={tool.name} value={tool.name}>
									{tool.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="grid gap-2">
					<label className="text-xs font-medium text-muted-foreground">
						{t('platform.audit.filterStatus')}
					</label>
					<Select
						value={auditFilters.success || ALL_AUDIT_STATUSES_VALUE}
						onValueChange={(value) =>
							onAuditFiltersChange((current) => ({
								...current,
								success: value === ALL_AUDIT_STATUSES_VALUE ? '' : value,
							}))
						}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL_AUDIT_STATUSES_VALUE}>
								{t('platform.audit.allStatuses')}
							</SelectItem>
							<SelectItem value="true">{t('platform.audit.success')}</SelectItem>
							<SelectItem value="false">{t('platform.audit.failure')}</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="grid gap-2">
					<label className="text-xs font-medium text-muted-foreground">
						{t('platform.audit.filterLimit')}
					</label>
					<Input
						type="number"
						min={1}
						max={200}
						value={auditFilters.limit}
						onChange={(event) =>
							onAuditFiltersChange((current) => ({
								...current,
								limit: event.target.value,
							}))
						}
					/>
				</div>
				<Button
					type="button"
					size="sm"
					className="self-end xl:col-start-6"
					onClick={() => void onRefetchAuditEvents()}
					disabled={auditLoading}
				>
					<ListChecks />
					{t('platform.audit.applyFilters')}
				</Button>
			</PlatformFilterBar>

			{auditLoading ? (
				<div className="grid gap-3 lg:grid-cols-2">
					<Skeleton className="h-28 w-full" />
					<Skeleton className="h-28 w-full" />
				</div>
			) : auditError ? (
				<PlatformEmptyState
					variant="error"
					title={t('platform.ux.empty.errorTitle')}
					description={auditError || t('platform.ux.empty.errorDescription')}
					actionLabel={t('error.retry')}
					onAction={() => void onRefetchAuditEvents()}
				/>
			) : auditEvents.length === 0 ? (
				<PlatformEmptyState
					variant={hasActiveAuditFilters ? 'filtered' : 'noData'}
					title={t(
						hasActiveAuditFilters
							? 'platform.ux.empty.filteredTitle'
							: 'platform.ux.empty.noDataTitle',
					)}
					description={t(
						hasActiveAuditFilters
							? 'platform.ux.empty.filteredDescription'
							: 'platform.ux.empty.noDataDescription',
					)}
					actionLabel={
						hasActiveAuditFilters
							? t('platform.ux.filters.clear')
							: t('platform.audit.refresh')
					}
					onAction={
						hasActiveAuditFilters
							? clearAuditFilters
							: () => void onRefetchAuditEvents()
					}
				/>
			) : (
				<>
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						{auditStats.map((stat) => (
							<div key={stat.label} className="rounded-lg border bg-background/80 p-3">
								<div className="text-xs text-muted-foreground">{stat.label}</div>
								<div className="mt-1 font-mono text-xl font-semibold">
									{stat.value}
								</div>
							</div>
						))}
					</div>
					<div className="grid gap-3 lg:grid-cols-2">
						{auditEvents.map((event, index) => {
							const inputsSummary = summarizeAuditObject(event.inputs);
							const resultSummary = summarizeAuditObject(event.result);
							const statusLabel =
								event.success === true
									? t('platform.audit.success')
									: event.success === false
										? t('platform.audit.failure')
										: t('platform.audit.unknown');
							const status = event.success === true
								? 'success'
								: event.success === false
									? 'failed'
									: 'pending';

							return (
								<Card
									key={
										event.event_id ||
										`${event.timestamp}-${event.tool_name}-${index}`
									}
									size="sm"
									className="rounded-lg shadow-none transition-colors hover:border-primary/30 hover:bg-primary/5"
								>
									<CardHeader className="grid-cols-[auto_1fr_auto] gap-3">
										<div
											className={cn(
												'flex size-8 items-center justify-center rounded-lg border bg-background',
												event.success === false && 'border-destructive/30',
											)}
										>
											{event.success === false ? (
												<XCircle className="size-4 text-destructive" />
											) : (
												<CheckCircle2 className="size-4 text-emerald-700" />
											)}
										</div>
										<div className="min-w-0">
											<CardTitle className="truncate font-mono text-sm">
												{event.tool_name || t('platform.audit.unknownTool')}
											</CardTitle>
											<p className="mt-1 truncate text-xs text-muted-foreground">
												{formatTimestamp(event.timestamp)}
											</p>
										</div>
										<PlatformStatusBadge status={status} label={statusLabel} />
									</CardHeader>
									<CardContent className="grid gap-2 text-xs">
										<div className="grid grid-cols-[7rem_1fr] gap-2">
											<span className="text-muted-foreground">
												{t('platform.audit.user')}
											</span>
											<span className="min-w-0 truncate font-mono">
												{event.user_id || '-'} / {event.tenant || '-'}
											</span>
										</div>
										<div className="grid grid-cols-[7rem_1fr] gap-2">
											<span className="text-muted-foreground">
												{t('platform.audit.connector')}
											</span>
											<span className="min-w-0 truncate font-mono">
												{event.connector || '-'}
											</span>
										</div>
										<div className="grid grid-cols-[7rem_1fr] gap-2">
											<span className="text-muted-foreground">
												{t('platform.audit.duration')}
											</span>
											<span className="font-mono">
												{event.duration_ms ?? '-'} ms
											</span>
										</div>
										{inputsSummary ? (
											<div className="grid grid-cols-[7rem_1fr] gap-2">
												<span className="text-muted-foreground">
													{t('platform.audit.inputs')}
												</span>
												<span className="min-w-0 break-words font-mono">
													{inputsSummary}
												</span>
											</div>
										) : null}
										{resultSummary ? (
											<div className="grid grid-cols-[7rem_1fr] gap-2">
												<span className="text-muted-foreground">
													{t('platform.audit.result')}
												</span>
												<span className="min-w-0 break-words font-mono">
													{resultSummary}
												</span>
											</div>
										) : null}
										{event.error ? (
											<div className="grid grid-cols-[7rem_1fr] gap-2 text-destructive">
												<span>{t('common.error')}</span>
												<span className="min-w-0 break-words">
													{event.error['message'] ||
														t('platform.audit.eventErrorFallback')}
												</span>
											</div>
										) : null}
									</CardContent>
								</Card>
							);
						})}
					</div>
				</>
			)}
		</section>
	);
}
