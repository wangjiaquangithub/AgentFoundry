import {
	AlertTriangle,
	ArrowRight,
	Building2,
	FileClock,
	KeyRound,
	ListChecks,
	Play,
	RefreshCcw,
	ShieldCheck,
	UserRound,
} from 'lucide-react';
import { useState } from 'react';

import { PlatformDetailDrawer, PlatformNotice } from './common';
import type {
	EnterpriseApprovalRequestItem,
	EnterpriseAuditEvent,
	EnterpriseIdentity,
	EnterpriseToolDecision,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface AccessTenantSummary {
	tenant: string;
	identities: number;
	roles: string[];
	allowed: number;
	denied: number;
	pending: number;
}

export interface IdentityAccessRow {
	identity: EnterpriseIdentity;
	allowedCount: number;
	deniedCount: number;
	pendingCount: number;
	risk: number;
}

export interface AccessControlStat {
	label: string;
	value: number;
}

interface AccessControlPanelProps {
	stats: AccessControlStat[];
	governance: unknown;
	governanceLoading: boolean;
	governanceError: string | null;
	enterpriseIdentities: EnterpriseIdentity[];
	accessTenantSummaries: AccessTenantSummary[];
	identityAccessRows: IdentityAccessRow[];
	toolPolicyMode: string;
	selectedIdentity: EnterpriseIdentity | null;
	selectedIdentityAllowedTools: EnterpriseToolDecision[];
	selectedIdentityDeniedTools: EnterpriseToolDecision[];
	selectedIdentityPendingApprovals: EnterpriseApprovalRequestItem[];
	selectedIdentityFailedAuditEvents: EnterpriseAuditEvent[];
	selectedIdentityRecentAuditEvents: EnterpriseAuditEvent[];
	creatingRunApproval: string | null;
	onRefreshGovernance: () => void;
	onCreateRunApproval: (requestType: 'tool_run') => void;
	onSelectIdentity: (userId: string) => void;
	onUseApproval: (approval: EnterpriseApprovalRequestItem) => void;
	onInspectIdentityApprovals: (identity: EnterpriseIdentity) => void;
	onInspectIdentityFailures: (identity: EnterpriseIdentity) => void;
	onUseIdentity: (identity: EnterpriseIdentity) => void;
	onInspectIdentityAudit: (identity: EnterpriseIdentity) => void;
	labels: {
		eyebrow: string;
		title: string;
		description: string;
		refreshStatus: string;
		requestingApproval: string;
		requestToolApproval: string;
		tenantMatrix: string;
		roleCount: (count: number) => string;
		identityCount: (count: number) => string;
		allowed: string;
		denied: string;
		pending: string;
		identityDirectory: string;
		allowedCount: (count: number) => string;
		deniedCount: (count: number) => string;
		pendingCount: (count: number) => string;
		selectedPolicy: string;
		needsReview: string;
		normal: string;
		identityOps: string;
		actionNeeded: string;
		pendingApprovalsShort: string;
		failedAudits: string;
		recentAudit: string;
		pendingQueue: string;
		noPendingQueue: string;
		reviewApprovals: string;
		viewFailures: string;
		allowedTools: string;
		deniedTools: string;
		none: string;
		runAsIdentity: string;
		viewAudit: string;
		noIdentity: string;
	};
}

export function AccessControlPanel({
	stats,
	governance,
	governanceLoading,
	governanceError,
	enterpriseIdentities,
	accessTenantSummaries,
	identityAccessRows,
	toolPolicyMode,
	selectedIdentity,
	selectedIdentityAllowedTools,
	selectedIdentityDeniedTools,
	selectedIdentityPendingApprovals,
	selectedIdentityFailedAuditEvents,
	selectedIdentityRecentAuditEvents,
	creatingRunApproval,
	onRefreshGovernance,
	onCreateRunApproval,
	onSelectIdentity,
	onUseApproval,
	onInspectIdentityApprovals,
	onInspectIdentityFailures,
	onUseIdentity,
	onInspectIdentityAudit,
	labels,
}: AccessControlPanelProps) {
	const [identityDrawerOpen, setIdentityDrawerOpen] = useState(false);
	const selectedIdentityNeedsReview =
		selectedIdentityDeniedTools.length > 0 ||
		selectedIdentityPendingApprovals.length > 0;

	return (
		<section className="grid gap-4 rounded-lg border bg-background p-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<KeyRound className="size-4" />
						<span>{labels.eyebrow}</span>
					</div>
					<h2 className="text-base font-semibold">{labels.title}</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{labels.description}
					</p>
				</div>
				<div className="flex flex-wrap gap-2 lg:justify-end">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onRefreshGovernance}
						disabled={governanceLoading}
					>
						<RefreshCcw className={cn('size-4', governanceLoading && 'animate-spin')} />
						{labels.refreshStatus}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => onCreateRunApproval('tool_run')}
						disabled={creatingRunApproval === 'tool_run'}
					>
						<ListChecks className="size-4" />
						{creatingRunApproval === 'tool_run'
							? labels.requestingApproval
							: labels.requestToolApproval}
					</Button>
				</div>
			</div>

			<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
				{stats.map((item) => (
					<div key={item.label} className="rounded-md border bg-background px-3 py-2">
						<div className="text-xs text-muted-foreground">{item.label}</div>
						<div className="mt-1 text-xl font-semibold tabular-nums">{item.value}</div>
					</div>
				))}
			</div>

			{governanceError ? <PlatformNotice>{governanceError}</PlatformNotice> : null}

			{governanceLoading && !governance ? (
				<div className="grid gap-3 md:grid-cols-2">
					<Skeleton className="h-56 w-full" />
					<Skeleton className="h-56 w-full" />
				</div>
			) : null}

			{enterpriseIdentities.length > 0 ? (
				<div className="grid gap-3">
					<div className="grid gap-3">
						<div className="rounded-lg border bg-background p-3">
							<div className="mb-3 flex items-center justify-between gap-3">
								<div className="flex items-center gap-2">
									<Building2 className="size-4 text-muted-foreground" />
									<h3 className="text-sm font-medium">{labels.tenantMatrix}</h3>
								</div>
								<Badge variant="outline">{toolPolicyMode}</Badge>
							</div>
							<div className="grid gap-2 md:grid-cols-2">
								{accessTenantSummaries.map((tenant) => (
									<div key={tenant.tenant} className="rounded-md border bg-background p-3">
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<div className="truncate text-sm font-medium">{tenant.tenant}</div>
												<div className="mt-1 text-xs text-muted-foreground">
													{labels.roleCount(tenant.roles.length)}
												</div>
											</div>
											<Badge variant={tenant.pending > 0 ? 'secondary' : 'outline'}>
												{labels.identityCount(tenant.identities)}
											</Badge>
										</div>
										<div className="mt-3 grid grid-cols-3 gap-2 text-xs">
											<div className="rounded-md border bg-background px-2 py-1">
												<div className="text-muted-foreground">{labels.allowed}</div>
												<div className="mt-1 font-semibold tabular-nums">{tenant.allowed}</div>
											</div>
											<div className="rounded-md border bg-background px-2 py-1">
												<div className="text-muted-foreground">{labels.denied}</div>
												<div className="mt-1 font-semibold tabular-nums">{tenant.denied}</div>
											</div>
											<div className="rounded-md border bg-background px-2 py-1">
												<div className="text-muted-foreground">{labels.pending}</div>
												<div className="mt-1 font-semibold tabular-nums">{tenant.pending}</div>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>

						<div className="rounded-lg border bg-background p-3">
							<div className="mb-3 flex items-center gap-2">
								<UserRound className="size-4 text-muted-foreground" />
								<h3 className="text-sm font-medium">{labels.identityDirectory}</h3>
							</div>
							<div className="grid gap-2">
								{identityAccessRows.map((row) => (
									<button
										key={row.identity.user_id}
										type="button"
										className={cn(
											'grid gap-2 rounded-md border bg-background p-3 text-left transition hover:border-primary/50',
											selectedIdentity?.user_id === row.identity.user_id &&
												'border-primary bg-primary/5',
										)}
										onClick={() => {
											onSelectIdentity(row.identity.user_id);
											setIdentityDrawerOpen(true);
										}}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<div className="truncate text-sm font-medium">
													{row.identity.display_name}
												</div>
												<div className="mt-1 truncate font-mono text-xs text-muted-foreground">
													{row.identity.user_id}
												</div>
											</div>
											<div className="flex flex-wrap justify-end gap-1">
												<Badge variant="secondary">{row.identity.tenant}</Badge>
												<Badge variant="outline">{row.identity.role}</Badge>
											</div>
										</div>
										<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
											<span>{labels.allowedCount(row.allowedCount)}</span>
											<span>{labels.deniedCount(row.deniedCount)}</span>
											{row.pendingCount > 0 ? (
												<span className="text-amber-600">
													{labels.pendingCount(row.pendingCount)}
												</span>
											) : null}
										</div>
									</button>
								))}
							</div>
						</div>
					</div>

					<PlatformDetailDrawer
						open={identityDrawerOpen && Boolean(selectedIdentity)}
						onOpenChange={setIdentityDrawerOpen}
						title={selectedIdentity?.display_name ?? labels.selectedPolicy}
						description={
							selectedIdentity
								? `${selectedIdentity.tenant} · ${selectedIdentity.role}`
								: undefined
						}
					>
						{selectedIdentity ? (
							<>
								<div className="mb-3 flex items-center justify-between gap-3">
									<div className="flex items-center gap-2">
										<ShieldCheck className="size-4 text-muted-foreground" />
										<h3 className="text-sm font-medium">{labels.selectedPolicy}</h3>
									</div>
									{selectedIdentityNeedsReview ? (
										<Badge variant="secondary">
											<AlertTriangle className="size-3" />
											{labels.needsReview}
										</Badge>
									) : (
										<Badge variant="outline">{labels.normal}</Badge>
									)}
								</div>
								<div className="rounded-md border bg-background p-3">
									<div className="text-sm font-medium">{selectedIdentity.display_name}</div>
									<div className="mt-1 text-xs text-muted-foreground">
										{selectedIdentity.tenant} · {selectedIdentity.role}
									</div>
								</div>
								<div className="grid gap-3 rounded-md border bg-background p-3">
									<div className="flex items-center justify-between gap-3">
										<div className="flex items-center gap-2">
											<ListChecks className="size-4 text-muted-foreground" />
											<h4 className="text-sm font-medium">{labels.identityOps}</h4>
										</div>
										<Badge
											variant={
												selectedIdentityPendingApprovals.length > 0 ||
												selectedIdentityFailedAuditEvents.length > 0
													? 'secondary'
													: 'outline'
											}
										>
											{selectedIdentityPendingApprovals.length > 0 ||
											selectedIdentityFailedAuditEvents.length > 0
												? labels.actionNeeded
												: labels.normal}
										</Badge>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div className="rounded-md border bg-background px-2 py-2">
											<div className="text-xs text-muted-foreground">
												{labels.pendingApprovalsShort}
											</div>
											<div className="mt-1 text-lg font-semibold tabular-nums">
												{selectedIdentityPendingApprovals.length}
											</div>
										</div>
										<div className="rounded-md border bg-background px-2 py-2">
											<div className="text-xs text-muted-foreground">
												{labels.failedAudits}
											</div>
											<div className="mt-1 text-lg font-semibold tabular-nums">
												{selectedIdentityFailedAuditEvents.length}
											</div>
										</div>
										<div className="rounded-md border bg-background px-2 py-2">
											<div className="text-xs text-muted-foreground">{labels.allowed}</div>
											<div className="mt-1 text-lg font-semibold tabular-nums">
												{selectedIdentityAllowedTools.length}
											</div>
										</div>
										<div className="rounded-md border bg-background px-2 py-2">
											<div className="text-xs text-muted-foreground">
												{labels.recentAudit}
											</div>
											<div className="mt-1 text-lg font-semibold tabular-nums">
												{selectedIdentityRecentAuditEvents.length}
											</div>
										</div>
									</div>
									{selectedIdentityPendingApprovals.length > 0 ? (
										<div className="grid gap-2">
											<div className="text-xs font-medium text-muted-foreground">
												{labels.pendingQueue}
											</div>
											{selectedIdentityPendingApprovals.slice(0, 2).map((approval) => (
												<button
													key={approval.approval_id}
													type="button"
													className="grid gap-1 rounded-md border bg-background p-2 text-left transition hover:border-primary/30 hover:bg-primary/5"
													onClick={() => onUseApproval(approval)}
												>
													<div className="flex items-center justify-between gap-2">
														<span className="truncate text-xs font-medium">
															{approval.tool_name ||
																approval.workflow_type ||
																approval.request_type}
														</span>
														<ArrowRight className="size-3 text-muted-foreground" />
													</div>
													<span className="line-clamp-2 text-xs text-muted-foreground">
														{approval.reason || approval.approval_id}
													</span>
												</button>
											))}
										</div>
									) : (
										<div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
											{labels.noPendingQueue}
										</div>
									)}
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={() => onInspectIdentityApprovals(selectedIdentity)}
										>
											<ListChecks className="size-4" />
											{labels.reviewApprovals}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={() => onInspectIdentityFailures(selectedIdentity)}
										>
											<AlertTriangle className="size-4" />
											{labels.viewFailures}
										</Button>
									</div>
								</div>
								<div className="grid gap-3">
									<div>
										<div className="text-xs text-muted-foreground">
											{labels.allowedTools}
										</div>
										<div className="mt-1 flex flex-wrap gap-1">
											{selectedIdentityAllowedTools.length === 0 ? (
												<Badge variant="outline">{labels.none}</Badge>
											) : (
												selectedIdentityAllowedTools.map((decision) => (
													<Badge key={decision.name} variant="secondary">
														{decision.name}
													</Badge>
												))
											)}
										</div>
									</div>
									<div>
										<div className="text-xs text-muted-foreground">
											{labels.deniedTools}
										</div>
										<div className="mt-1 grid gap-2">
											{selectedIdentityDeniedTools.length === 0 ? (
												<Badge className="w-fit" variant="outline">
													{labels.none}
												</Badge>
											) : (
												selectedIdentityDeniedTools.map((decision) => (
													<div key={decision.name} className="rounded-md border bg-background p-2">
														<div className="text-xs font-medium">{decision.name}</div>
														<div className="mt-1 text-xs leading-5 text-muted-foreground">
															{decision.reason}
														</div>
													</div>
												))
											)}
										</div>
									</div>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button type="button" size="sm" onClick={() => onUseIdentity(selectedIdentity)}>
										<Play className="size-4" />
										{labels.runAsIdentity}
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => onInspectIdentityAudit(selectedIdentity)}
									>
										<FileClock className="size-4" />
										{labels.viewAudit}
									</Button>
								</div>
							</>
						) : null}
					</PlatformDetailDrawer>
				</div>
			) : (
				<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
					{labels.noIdentity}
				</div>
			)}
		</section>
	);
}
