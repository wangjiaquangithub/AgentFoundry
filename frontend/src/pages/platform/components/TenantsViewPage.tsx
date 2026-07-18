import {
	BotMessageSquare,
	Building2,
	Clock3,
	Network,
	RefreshCcw,
	ShieldCheck,
	UserRound,
} from 'lucide-react';

import type {
	EnterpriseIdentity,
	EnterprisePlatformConnectorsResponse,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { PlatformMemberTenantSummary } from './MembersPanel';
import { PlatformNotice } from './common';

type Translate = (key: string, options?: Record<string, unknown>) => string;
type TenantWorkspace = EnterprisePlatformConnectorsResponse['tenant_workspaces'][string];

interface TenantsViewPageProps {
	platformMemberTenantSummaries: PlatformMemberTenantSummary[];
	platformMembersLoading: boolean;
	platformMembersLoaded: boolean;
	platformMembersError: string | null;
	connectorsLoading: boolean;
	connectorsError: string | null;
	tenantWorkspaces: Array<[string, TenantWorkspace]>;
	enterpriseIdentities: EnterpriseIdentity[];
	activeMemberCount: number;
	roleCount: number;
	activePlatformAgentCount: number;
	pendingApprovalCount: number;
	onRefreshMembers: () => void;
	onRefreshConnectors: () => void;
	onNavigate: (to: string) => void;
	t: Translate;
}

function countArrayField(record: Record<string, unknown>, key: string) {
	const value = record[key];
	return Array.isArray(value) ? value.length : 0;
}

export function TenantsViewPage({
	platformMemberTenantSummaries,
	platformMembersLoading,
	platformMembersLoaded,
	platformMembersError,
	connectorsLoading,
	connectorsError,
	tenantWorkspaces,
	enterpriseIdentities,
	activeMemberCount,
	roleCount,
	activePlatformAgentCount,
	pendingApprovalCount,
	onRefreshMembers,
	onRefreshConnectors,
	onNavigate,
	t,
}: TenantsViewPageProps) {
	return (
		<main className="h-full overflow-y-auto bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
				<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0">
						<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
							<Building2 className="size-4" />
							<span>{t('platform.members.organizationOverview')}</span>
						</div>
						<h1 className="text-2xl font-semibold tracking-normal">
							成员与租户治理
						</h1>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
							按租户查看成员、角色、已绑定 Agent、审批和连接器工作区，先把多租户隔离关系管清楚。
						</p>
					</div>
					<div className="flex flex-wrap gap-2 lg:justify-end">
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onRefreshMembers}
							disabled={platformMembersLoading}
						>
							<RefreshCcw className={cn(platformMembersLoading && 'animate-spin')} />
							{t('platform.actions.refreshStatus')}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onRefreshConnectors}
							disabled={connectorsLoading}
						>
							<Network className={cn(connectorsLoading && 'animate-pulse')} />
							{t('platform.connectors.title')}
						</Button>
					</div>
				</section>

				{platformMembersError ? <PlatformNotice>{platformMembersError}</PlatformNotice> : null}
				{connectorsError ? <PlatformNotice>{connectorsError}</PlatformNotice> : null}

				<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
					{[
						{
							label: t('platform.members.tenantGroups'),
							value: platformMemberTenantSummaries.length,
							icon: Building2,
						},
						{
							label: t('platform.members.activeMembers'),
							value: activeMemberCount,
							icon: UserRound,
						},
						{
							label: t('platform.members.roles'),
							value: roleCount,
							icon: ShieldCheck,
						},
						{
							label: t('platform.members.boundAgents'),
							value: activePlatformAgentCount,
							icon: BotMessageSquare,
						},
						{
							label: t('platform.members.pendingApprovals'),
							value: pendingApprovalCount,
							icon: Clock3,
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

				<section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
					<Card className="rounded-lg shadow-none">
						<CardHeader>
							<CardTitle className="text-base">
								{t('platform.members.groupedListTitle')}
							</CardTitle>
						</CardHeader>
						<CardContent>
							{platformMembersLoading && !platformMembersLoaded ? (
								<div className="grid gap-3">
									<Skeleton className="h-24 rounded-lg" />
									<Skeleton className="h-24 rounded-lg" />
								</div>
							) : platformMemberTenantSummaries.length ? (
								<div className="grid gap-3">
									{platformMemberTenantSummaries.map((tenantSummary) => (
										<div
											key={tenantSummary.tenant}
											className="grid gap-3 rounded-lg border bg-muted/10 p-3"
										>
											<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
												<div className="min-w-0">
													<div className="flex flex-wrap items-center gap-2">
														<h3 className="text-sm font-semibold">
															{tenantSummary.tenant}
														</h3>
														<Badge variant="secondary">
															{tenantSummary.activeMemberCount}{' '}
															{t('platform.members.activeMembers')}
														</Badge>
														{tenantSummary.inactiveMemberCount > 0 ? (
															<Badge variant="outline">
																{tenantSummary.inactiveMemberCount}{' '}
																{t('platform.members.inactiveMembers')}
															</Badge>
														) : null}
													</div>
													<div className="mt-2 flex flex-wrap gap-1">
														<Badge variant="outline">
															{t('platform.members.roles')}:{' '}
															{tenantSummary.roleNames.length}
														</Badge>
														<Badge variant="outline">
															{t('platform.members.boundAgents')}:{' '}
															{tenantSummary.agentCount}
														</Badge>
														<Badge variant="outline">
															{t('platform.members.pendingApprovals')}:{' '}
															{tenantSummary.pendingApprovalCount}
														</Badge>
														<Badge variant="outline">
															{t('platform.members.auditEvents')}:{' '}
															{tenantSummary.auditEventCount}
														</Badge>
													</div>
												</div>
												<Button
													type="button"
													size="sm"
													variant="outline"
													onClick={() => onNavigate('/platform/agents')}
												>
													<BotMessageSquare className="size-4" />
													{t('platform.nav.agents')}
												</Button>
											</div>
											<div className="grid gap-2 md:grid-cols-2">
												{tenantSummary.members.slice(0, 6).map((member) => (
													<div
														key={`${tenantSummary.tenant}-${member.user_id}`}
														className="rounded-md border bg-background p-3"
													>
														<div className="truncate text-sm font-medium">
															{member.display_name || member.user_id}
														</div>
														<div className="mt-1 truncate font-mono text-xs text-muted-foreground">
															{member.user_id}
														</div>
														<div className="mt-2 flex flex-wrap gap-1">
															<Badge variant="outline">{member.role}</Badge>
															<Badge
																variant={
																	member.status === 'inactive'
																		? 'outline'
																		: 'secondary'
																}
															>
																{member.status === 'inactive'
																	? t('platform.members.inactive')
																	: t('platform.members.active')}
															</Badge>
														</div>
													</div>
												))}
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
									{t('platform.members.empty')}
								</div>
							)}
						</CardContent>
					</Card>

					<Card className="rounded-lg shadow-none">
						<CardHeader>
							<CardTitle className="text-base">
								{t('platform.connectors.tenantPreview')}
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-3">
							{tenantWorkspaces.length ? (
								tenantWorkspaces.map(([tenant, workspace]) => (
									<div key={tenant} className="rounded-lg border bg-muted/10 p-3">
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<div className="truncate text-sm font-semibold">
													{tenant}
												</div>
												<div className="mt-1 truncate text-xs text-muted-foreground">
													{workspace.source}
												</div>
											</div>
											<Badge variant="outline">
												{
													enterpriseIdentities.filter(
														(identity) => identity.tenant === tenant,
													).length
												}{' '}
												{t('platform.connectors.identities')}
											</Badge>
										</div>
										<div className="mt-3 grid grid-cols-2 gap-2 text-xs">
											<div className="rounded-md border bg-background p-2">
												{t('platform.connectors.policies')}:{' '}
												{workspace.policies.length}
											</div>
											<div className="rounded-md border bg-background p-2">
												{t('platform.connectors.tickets')}:{' '}
												{workspace.tickets.length}
											</div>
											<div className="rounded-md border bg-background p-2">
												{t('platform.connectors.departments')}:{' '}
												{workspace.departments.length}
											</div>
											<div className="rounded-md border bg-background p-2">
												{t('platform.connectors.tools')}:{' '}
												{countArrayField(workspace, 'tools')}
											</div>
										</div>
									</div>
								))
							) : (
								<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
									{t('platform.connectors.empty')}
								</div>
							)}
						</CardContent>
					</Card>
				</section>
			</div>
		</main>
	);
}
