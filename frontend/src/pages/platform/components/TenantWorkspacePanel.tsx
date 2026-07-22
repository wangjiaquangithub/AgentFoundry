import {
	ArrowRight,
	BotMessageSquare,
	Boxes,
	Building2,
	Database,
	FileClock,
	ListChecks,
	Play,
	ShieldCheck,
	UserRound,
} from 'lucide-react';
import { useState } from 'react';

import { countArrayField } from '../platform-utils';
import { PlatformDetailDrawer } from './common';
import type {
	EnterpriseIdentity,
	EnterpriseTenantWorkspace,
	EnterpriseToolDecision,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TenantOverviewItem {
	tenant: string;
	source: string;
	identityCount: number;
	roleCount: number;
	agentCount: number;
	pendingApprovalCount: number;
	auditEventCount: number;
	workflowRunCount: number;
	sampleQuestion: string;
	representativeIdentity: EnterpriseIdentity | null;
}

interface TenantWorkspacePanelProps {
	tenantOverviewItems: TenantOverviewItem[];
	selectedIdentity: EnterpriseIdentity | null;
	selectedIdentityWorkspace: EnterpriseTenantWorkspace | null;
	selectedIdentityAllowedTools: EnterpriseToolDecision[];
	selectedIdentityDeniedTools: EnterpriseToolDecision[];
	enterpriseIdentityCount: number;
	onConfigureSources: () => void;
	onUseIdentity: (identity: EnterpriseIdentity) => void;
	onUseTenant: (tenant: string) => void;
	onPrepareTenantAgent: (tenant: string) => void;
	onInspectTenantApprovals: (tenant: string) => void;
	onInspectTenantAudit: (tenant: string) => void;
	onInspectIdentityAudit: (identity: EnterpriseIdentity) => void;
	onOpenGovernance: () => void;
	labels: {
		eyebrow: string;
		title: string;
		description: string;
		configureSources: string;
		runAsCurrent: string;
		emptyTenants: string;
		tenant: string;
		roleCount: (count: number) => string;
		identities: string;
		agents: string;
		pendingApprovals: string;
		auditEvents: string;
		workflowRuns: string;
		roles: string;
		sampleQuestion: string;
		noSample: string;
		useTenant: string;
		publishForTenant: string;
		openTenantApprovals: string;
		openTenantAudit: string;
		activeIdentity: string;
		runSample: string;
		viewAudit: string;
		workspace: string;
		localSource: string;
		policies: string;
		tickets: string;
		departments: string;
		knowledgeBases: string;
		tools: string;
		policy: string;
		allowedTools: string;
		deniedTools: string;
		none: string;
		openGovernance: string;
		noIdentity: string;
	};
}

export function TenantWorkspacePanel({
	tenantOverviewItems,
	selectedIdentity,
	selectedIdentityWorkspace,
	selectedIdentityAllowedTools,
	selectedIdentityDeniedTools,
	enterpriseIdentityCount,
	onConfigureSources,
	onUseIdentity,
	onUseTenant,
	onPrepareTenantAgent,
	onInspectTenantApprovals,
	onInspectTenantAudit,
	onInspectIdentityAudit,
	onOpenGovernance,
	labels,
}: TenantWorkspacePanelProps) {
	const [identityDetailOpen, setIdentityDetailOpen] = useState(false);

	return (
		<section className="grid gap-4 rounded-lg border bg-background p-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<Building2 className="size-4" />
						<span>{labels.eyebrow}</span>
					</div>
					<h2 className="text-base font-semibold">{labels.title}</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{labels.description}
					</p>
				</div>
				<div className="flex flex-wrap gap-2 lg:justify-end">
					<Button type="button" size="sm" variant="outline" onClick={onConfigureSources}>
						<Database className="size-4" />
						{labels.configureSources}
					</Button>
					{selectedIdentity ? (
						<Button type="button" size="sm" onClick={() => onUseIdentity(selectedIdentity)}>
							<Play className="size-4" />
							{labels.runAsCurrent}
						</Button>
					) : null}
				</div>
			</div>

			{tenantOverviewItems.length === 0 ? (
				<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
					{labels.emptyTenants}
				</div>
			) : (
				<div className="grid gap-3 lg:grid-cols-2">
					{tenantOverviewItems.map((tenantItem) => (
						<div
							key={tenantItem.tenant}
							className={cn(
								'grid gap-3 rounded-lg border bg-background p-3',
								selectedIdentity?.tenant === tenantItem.tenant &&
									'border-primary/60 bg-primary/5',
							)}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										<Building2 className="size-4" />
										<span>{labels.tenant}</span>
									</div>
									<div className="mt-1 truncate text-sm font-semibold">
										{tenantItem.tenant}
									</div>
									<div className="mt-1 truncate text-xs text-muted-foreground">
										{tenantItem.source}
									</div>
								</div>
								<Badge variant="outline">{labels.roleCount(tenantItem.roleCount)}</Badge>
							</div>

							<div className="grid grid-cols-3 gap-2">
								{[
									{ label: labels.identities, value: tenantItem.identityCount },
									{ label: labels.agents, value: tenantItem.agentCount },
									{
										label: labels.pendingApprovals,
										value: tenantItem.pendingApprovalCount,
									},
									{ label: labels.auditEvents, value: tenantItem.auditEventCount },
									{ label: labels.workflowRuns, value: tenantItem.workflowRunCount },
									{ label: labels.roles, value: tenantItem.roleCount },
								].map((item) => (
									<div key={item.label} className="rounded-md border bg-background px-2 py-2">
										<div className="truncate text-xs text-muted-foreground">
											{item.label}
										</div>
										<div className="mt-1 text-base font-semibold tabular-nums">
											{item.value}
										</div>
									</div>
								))}
							</div>

							<div className="rounded-md border bg-background p-3">
								<div className="text-xs text-muted-foreground">
									{labels.sampleQuestion}
								</div>
								<div className="mt-1 line-clamp-2 text-sm leading-6">
									{tenantItem.sampleQuestion || labels.noSample}
								</div>
							</div>

							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									size="sm"
									variant={
										selectedIdentity?.tenant === tenantItem.tenant ? 'default' : 'outline'
									}
									onClick={() => onUseTenant(tenantItem.tenant)}
									disabled={!tenantItem.representativeIdentity}
								>
									<Play className="size-4" />
									{labels.useTenant}
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => onPrepareTenantAgent(tenantItem.tenant)}
								>
									<BotMessageSquare className="size-4" />
									{labels.publishForTenant}
								</Button>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onClick={() => onInspectTenantApprovals(tenantItem.tenant)}
								>
									<ListChecks className="size-4" />
									{labels.openTenantApprovals}
								</Button>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onClick={() => onInspectTenantAudit(tenantItem.tenant)}
								>
									<FileClock className="size-4" />
									{labels.openTenantAudit}
								</Button>
							</div>
						</div>
					))}
				</div>
			)}

			{selectedIdentity ? (
				<div className="rounded-lg border bg-background p-3">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0">
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<UserRound className="size-4" />
								<span>{labels.activeIdentity}</span>
							</div>
							<div className="mt-2 truncate text-sm font-semibold">
								{selectedIdentity.display_name}
							</div>
							<div className="font-mono text-xs text-muted-foreground">
								{selectedIdentity.user_id}
							</div>
							<div className="mt-2 flex flex-wrap gap-1">
								<Badge variant="secondary">{selectedIdentity.tenant}</Badge>
								<Badge variant="outline">{selectedIdentity.role}</Badge>
								<Badge variant="outline">
									{selectedIdentityWorkspace?.source ?? labels.localSource}
								</Badge>
							</div>
						</div>
						<div className="flex flex-wrap gap-2 lg:justify-end">
							<Button type="button" size="sm" onClick={() => onUseIdentity(selectedIdentity)}>
								<Play className="size-4" />
								{labels.runSample}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => setIdentityDetailOpen(true)}
							>
								<Boxes className="size-4" />
								{labels.workspace}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={() => onInspectIdentityAudit(selectedIdentity)}
							>
								<FileClock className="size-4" />
								{labels.viewAudit}
							</Button>
						</div>
					</div>
					<div className="mt-3 rounded-md border bg-muted/20 p-3">
						<div className="text-xs text-muted-foreground">{labels.sampleQuestion}</div>
						<div className="mt-1 line-clamp-2 text-sm leading-6">
							{selectedIdentity.sample_questions[0] ?? labels.noSample}
						</div>
					</div>
					<PlatformDetailDrawer
						open={identityDetailOpen}
						onOpenChange={setIdentityDetailOpen}
						title={labels.workspace}
						description={selectedIdentity.display_name}
					>
						<div className="grid gap-4">
							<div className="grid gap-3 rounded-lg border bg-background p-3">
								<div className="flex items-center justify-between gap-3">
									<div className="flex items-center gap-2">
										<Boxes className="size-4 text-muted-foreground" />
										<h3 className="text-sm font-medium">{labels.workspace}</h3>
									</div>
									<Badge variant="outline">
										{selectedIdentityWorkspace?.source ?? labels.localSource}
									</Badge>
								</div>
								<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
									{[
										{
											label: labels.policies,
											value: selectedIdentityWorkspace
												? countArrayField(selectedIdentityWorkspace, 'policies')
												: 0,
										},
										{
											label: labels.tickets,
											value: selectedIdentityWorkspace
												? countArrayField(selectedIdentityWorkspace, 'tickets')
												: 0,
										},
										{
											label: labels.departments,
											value: selectedIdentityWorkspace
												? countArrayField(selectedIdentityWorkspace, 'departments')
												: 0,
										},
										{
											label: labels.knowledgeBases,
											value: selectedIdentityWorkspace
												? countArrayField(selectedIdentityWorkspace, 'knowledge_bases')
												: 0,
										},
										{
											label: labels.tools,
											value: selectedIdentityWorkspace
												? countArrayField(selectedIdentityWorkspace, 'tools')
												: 0,
										},
										{ label: labels.identities, value: enterpriseIdentityCount },
									].map((item) => (
										<div
											key={item.label}
											className="rounded-md border bg-background px-3 py-2"
										>
											<div className="text-xs text-muted-foreground">{item.label}</div>
											<div className="mt-1 text-lg font-semibold tabular-nums">
												{item.value}
											</div>
										</div>
									))}
								</div>
							</div>
							<div className="grid content-start gap-3 rounded-lg border bg-background p-3">
								<div className="flex items-center justify-between gap-3">
									<div className="flex items-center gap-2">
										<ShieldCheck className="size-4 text-muted-foreground" />
										<h3 className="text-sm font-medium">{labels.policy}</h3>
									</div>
									<Button type="button" size="sm" variant="outline" onClick={onOpenGovernance}>
										<ArrowRight className="size-4" />
										{labels.openGovernance}
									</Button>
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
										<div className="mt-1 flex flex-wrap gap-1">
											{selectedIdentityDeniedTools.length === 0 ? (
												<Badge variant="outline">{labels.none}</Badge>
											) : (
												selectedIdentityDeniedTools.map((decision) => (
													<Badge key={decision.name} variant="outline">
														{decision.name}
													</Badge>
												))
											)}
										</div>
									</div>
								</div>
							</div>
						</div>
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
