import { CheckCircle2, ListChecks, RefreshCcw, XCircle } from 'lucide-react';
import { useState, type Dispatch, type SetStateAction } from 'react';

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
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
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
	const [selectedAuditEvent, setSelectedAuditEvent] =
		useState<EnterpriseAuditEvent | null>(null);
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
	const getAuditEventKey = (event: EnterpriseAuditEvent, index: number) =>
		event.event_id || `${event.timestamp}-${event.tool_name}-${index}`;
	const getAuditEventStatus = (event: EnterpriseAuditEvent) => {
		const label =
			event.success === true
				? t('platform.audit.success')
				: event.success === false
					? t('platform.audit.failure')
					: t('platform.audit.unknown');
		const status =
			event.success === true
				? 'success'
				: event.success === false
					? 'failed'
					: 'pending';

		return { label, status } as const;
	};
	const selectedAuditEventStatus = selectedAuditEvent
		? getAuditEventStatus(selectedAuditEvent)
		: null;

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
				<div className="rounded-lg border">
					{Array.from({ length: 5 }).map((_, index) => (
						<div
							key={index}
							className="grid gap-3 border-b p-3 last:border-b-0 md:grid-cols-[7rem_1.5fr_1fr_1fr_7rem_9rem_5rem]"
						>
							<Skeleton className="h-5 w-20" />
							<Skeleton className="h-5 w-full" />
							<Skeleton className="h-5 w-24" />
							<Skeleton className="h-5 w-24" />
							<Skeleton className="h-5 w-16" />
							<Skeleton className="h-5 w-28" />
							<Skeleton className="h-5 w-14" />
						</div>
					))}
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
					<div className="overflow-hidden rounded-lg border">
						<div className="hidden grid-cols-[7rem_1.5fr_1fr_1fr_7rem_9rem_5rem] gap-3 border-b bg-muted/35 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
							<span>{t('platform.audit.status')}</span>
							<span>{t('platform.audit.event')}</span>
							<span>{t('platform.audit.actor')}</span>
							<span>{t('platform.audit.resource')}</span>
							<span>{t('platform.audit.duration')}</span>
							<span>{t('platform.audit.time')}</span>
							<span className="text-right">{t('platform.audit.inspect')}</span>
						</div>
						{auditEvents.map((event, index) => {
							const eventKey = getAuditEventKey(event, index);
							const { label: statusLabel, status } =
								getAuditEventStatus(event);
							const isSelected =
								selectedAuditEvent?.event_id &&
								selectedAuditEvent.event_id === event.event_id;

							return (
								<button
									key={eventKey}
									type="button"
									onClick={() => setSelectedAuditEvent(event)}
									className={cn(
										'grid w-full gap-3 border-b p-3 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:grid-cols-[7rem_1.5fr_1fr_1fr_7rem_9rem_5rem] md:items-center',
										isSelected && 'bg-primary/5',
									)}
								>
									<div>
										<PlatformStatusBadge status={status} label={statusLabel} />
									</div>
									<div className="min-w-0">
										<div className="flex min-w-0 items-center gap-2">
											{event.success === false ? (
												<XCircle className="size-4 shrink-0 text-destructive" />
											) : (
												<CheckCircle2 className="size-4 shrink-0 text-emerald-700" />
											)}
											<span className="truncate font-mono font-medium">
												{event.event_type ||
													event.tool_name ||
													t('platform.audit.unknownTool')}
											</span>
										</div>
										<div className="mt-1 truncate text-xs text-muted-foreground md:hidden">
											{formatTimestamp(event.timestamp)}
										</div>
									</div>
									<div className="min-w-0 truncate font-mono text-xs text-muted-foreground">
										<span className="md:hidden">
											{t('platform.audit.actor')}:
										</span>
										{event.user_id || '-'}
									</div>
									<div className="min-w-0 truncate font-mono text-xs text-muted-foreground">
										<span className="md:hidden">
											{t('platform.audit.resource')}:
										</span>
										{event.connector || event.tool_name || event.agent_id || '-'}
									</div>
									<div className="font-mono text-xs text-muted-foreground">
										{event.duration_ms ?? '-'} ms
									</div>
									<div className="hidden truncate font-mono text-xs text-muted-foreground md:block">
										{formatTimestamp(event.timestamp)}
									</div>
									<div className="text-right text-xs font-medium text-primary">
										{t('platform.audit.inspect')}
									</div>
								</button>
							);
						})}
					</div>
					<Sheet
						open={Boolean(selectedAuditEvent)}
						onOpenChange={(open) => {
							if (!open) {
								setSelectedAuditEvent(null);
							}
						}}
					>
						<SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-xl">
							{selectedAuditEvent ? (
								<>
									<SheetHeader className="border-b pb-4 text-left">
										<SheetTitle className="flex items-center gap-2">
											{selectedAuditEvent.success === false ? (
												<XCircle className="size-5 text-destructive" />
											) : (
												<CheckCircle2 className="size-5 text-emerald-700" />
											)}
											<span className="min-w-0 truncate font-mono">
												{selectedAuditEvent.event_type ||
													selectedAuditEvent.tool_name ||
													t('platform.audit.unknownTool')}
											</span>
										</SheetTitle>
										<SheetDescription>
											{t('platform.audit.eventDetailDescription')}
										</SheetDescription>
									</SheetHeader>
									<div className="min-h-0 flex-1 overflow-y-auto py-4">
										<div className="grid gap-3 text-sm">
											<div className="flex items-center justify-between gap-3">
												<span className="text-muted-foreground">
													{t('platform.audit.status')}
												</span>
												{selectedAuditEventStatus ? (
													<PlatformStatusBadge
														status={selectedAuditEventStatus.status}
														label={selectedAuditEventStatus.label}
													/>
												) : null}
											</div>
											{[
												[
													t('platform.audit.actor'),
													selectedAuditEvent.user_id || '-',
												],
												[
													t('platform.audit.tenant'),
													selectedAuditEvent.tenant || '-',
												],
												[
													t('platform.audit.agent'),
													selectedAuditEvent.agent_id || '-',
												],
												[
													t('platform.audit.tool'),
													selectedAuditEvent.tool_name || '-',
												],
												[
													t('platform.audit.connector'),
													selectedAuditEvent.connector || '-',
												],
												[
													t('platform.audit.duration'),
													`${selectedAuditEvent.duration_ms ?? '-'} ms`,
												],
												[
													t('platform.audit.time'),
													formatTimestamp(selectedAuditEvent.timestamp),
												],
											].map(([label, value]) => (
												<div
													key={label}
													className="grid grid-cols-[7rem_1fr] gap-3"
												>
													<span className="text-muted-foreground">{label}</span>
													<span className="min-w-0 break-words font-mono">
														{value}
													</span>
												</div>
											))}
										</div>

										<div className="mt-5 grid gap-3">
											<details className="rounded-md border bg-muted/20">
												<summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
													{t('platform.audit.inputs')}
												</summary>
												<pre className="max-h-52 overflow-auto border-t bg-background p-3 text-xs">
													{summarizeAuditObject(selectedAuditEvent.inputs) ||
														t('platform.audit.noInputs')}
												</pre>
											</details>
											<details className="rounded-md border bg-muted/20">
												<summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
													{t('platform.audit.result')}
												</summary>
												<pre className="max-h-52 overflow-auto border-t bg-background p-3 text-xs">
													{summarizeAuditObject(selectedAuditEvent.result) ||
														t('platform.audit.noResult')}
												</pre>
											</details>
											{selectedAuditEvent.error ? (
												<div className="grid gap-2">
													<div className="text-xs font-medium text-destructive">
														{t('common.error')}
													</div>
													<div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
														{t('platform.audit.eventErrorFallback')}
													</div>
												</div>
											) : null}
										</div>
									</div>
								</>
							) : null}
						</SheetContent>
					</Sheet>
				</>
			)}
		</section>
	);
}
