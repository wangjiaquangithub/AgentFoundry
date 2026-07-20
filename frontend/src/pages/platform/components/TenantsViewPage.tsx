import {
	ArrowRight,
	BotMessageSquare,
	Building2,
	Clock3,
	Network,
	RefreshCcw,
	Search,
	ShieldCheck,
	UserCheck,
	UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import {
	PlatformNotice,
	PlatformPageHeader,
	PlatformPageShell,
	StatCard,
} from './common';
import type { PlatformMemberTenantSummary } from './MembersPanel';
import { countArrayField } from '../platform-utils';
import type {
	EnterpriseIdentity,
	EnterprisePlatformConnectorsResponse,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';


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
	const [tenantQuery, setTenantQuery] = useState('');
	const filteredTenantSummaries = useMemo(() => {
		const normalizedQuery = tenantQuery.trim().toLowerCase();

		if (!normalizedQuery) {
			return platformMemberTenantSummaries;
		}

		return platformMemberTenantSummaries.filter((tenantSummary) => {
			const memberMatch = tenantSummary.members.some((member) =>
				[
					member.user_id,
					member.display_name,
					member.role,
					member.status,
				]
					.filter(Boolean)
					.join(' ')
					.toLowerCase()
					.includes(normalizedQuery),
			);

			return (
				tenantSummary.tenant.toLowerCase().includes(normalizedQuery) ||
				tenantSummary.roleNames.join(' ').toLowerCase().includes(normalizedQuery) ||
				memberMatch
			);
		});
	}, [platformMemberTenantSummaries, tenantQuery]);
	const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
	const selectedTenantSummary =
		filteredTenantSummaries.find((summary) => summary.tenant === selectedTenant) ??
		filteredTenantSummaries[0] ??
		null;
	const selectedWorkspace = selectedTenantSummary
		? tenantWorkspaces.find(([tenant]) => tenant === selectedTenantSummary.tenant)?.[1]
		: null;
	const selectedIdentityCount = selectedTenantSummary
		? enterpriseIdentities.filter(
				(identity) => identity.tenant === selectedTenantSummary.tenant,
			).length
		: 0;
	const workspaceCount = tenantWorkspaces.length;
	const tenantsWithWorkspaceCount = platformMemberTenantSummaries.filter((tenantSummary) =>
		tenantWorkspaces.some(([tenant]) => tenant === tenantSummary.tenant),
	).length;

	return (
		<PlatformPageShell>
			<PlatformPageHeader
				icon={Building2}
				eyebrow={t('platform.members.organizationOverview')}
				title="成员与租户治理"
				description="按租户查看成员、角色、已绑定 Agent、审批和连接器覆盖，先把多租户隔离关系管清楚。"
				actions={
					<>
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
					</>
				}
			/>

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
						<StatCard
							key={item.label}
							label={item.label}
							value={item.value}
							icon={Icon}
							loading={platformMembersLoading || connectorsLoading}
						/>
					);
				})}
			</section>

			<section className="grid gap-4 xl:grid-cols-[minmax(320px,0.42fr)_minmax(0,1fr)] xl:items-start">
				<div className="grid max-h-none content-start gap-4 border-y bg-background py-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-8rem)] xl:rounded-lg xl:border xl:p-4">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h2 className="text-sm font-semibold text-foreground">
								{t('platform.members.groupedListTitle')}
							</h2>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								搜索租户、成员或角色，选择后在右侧查看治理详情。
							</p>
						</div>
						<Badge variant="outline">
							{filteredTenantSummaries.length}{' '}
							{t('platform.members.tenantGroups')}
						</Badge>
					</div>
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={tenantQuery}
							onChange={(event) => setTenantQuery(event.target.value)}
							placeholder="搜索租户、成员、角色"
							className="pl-9"
						/>
					</div>
					{platformMembersLoading && !platformMembersLoaded ? (
						<div className="grid gap-3">
							<Skeleton className="h-28 rounded-lg" />
							<Skeleton className="h-28 rounded-lg" />
						</div>
					) : filteredTenantSummaries.length ? (
						<div className="grid gap-2 overflow-y-auto pr-1">
							{filteredTenantSummaries.map((tenantSummary) => {
								const isSelected =
									selectedTenantSummary?.tenant === tenantSummary.tenant;

								return (
									<button
										type="button"
										key={tenantSummary.tenant}
										onClick={() => setSelectedTenant(tenantSummary.tenant)}
										className={cn(
											'grid w-full gap-3 rounded-lg border p-3 text-left transition-colors',
											isSelected
												? 'border-primary/40 bg-primary/5'
												: 'bg-background hover:border-primary/30 hover:bg-primary/5',
										)}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<div className="flex flex-wrap items-center gap-2">
													<h3 className="break-words text-sm font-semibold">
														{tenantSummary.tenant}
													</h3>
													<Badge variant={isSelected ? 'outline' : 'secondary'}>
														{tenantSummary.activeMemberCount}{' '}
														{t('platform.members.activeMembers')}
													</Badge>
												</div>
												<div
													className={cn(
														'mt-3 grid grid-cols-2 gap-2 text-xs',
														isSelected
															? 'text-foreground'
															: 'text-muted-foreground',
													)}
												>
													<span className="rounded-md bg-background/10 px-2 py-1">
														{t('platform.members.roles')}: {tenantSummary.roleNames.length}
													</span>
													<span className="rounded-md bg-background/10 px-2 py-1">
														{t('platform.members.boundAgents')}: {tenantSummary.agentCount}
													</span>
													<span className="rounded-md bg-background/10 px-2 py-1">
														{t('platform.members.pendingApprovals')}:{' '}
														{tenantSummary.pendingApprovalCount}
													</span>
													<span className="rounded-md bg-background/10 px-2 py-1">
														{t('platform.members.auditEvents')}:{' '}
														{tenantSummary.auditEventCount}
													</span>
												</div>
											</div>
											<ArrowRight
												className={cn(
													'mt-1 size-4 shrink-0',
													isSelected ? 'text-primary' : 'text-muted-foreground',
												)}
											/>
										</div>
									</button>
								);
							})}
						</div>
					) : (
						<div className="rounded-lg border border-dashed bg-background/80 p-6 text-sm text-muted-foreground">
							{t('platform.members.empty')}
						</div>
					)}
				</div>

				<div className="grid content-start gap-4">
					{selectedTenantSummary ? (
						<>
							<section className="rounded-lg border bg-background p-4">
								<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<h2 className="break-words text-base font-semibold">
												{selectedTenantSummary.tenant}
											</h2>
											<Badge variant="secondary">
												{selectedTenantSummary.activeMemberCount}{' '}
												{t('platform.members.activeMembers')}
											</Badge>
											{selectedTenantSummary.inactiveMemberCount > 0 ? (
												<Badge variant="outline">
													{selectedTenantSummary.inactiveMemberCount}{' '}
													{t('platform.members.inactiveMembers')}
												</Badge>
											) : null}
											{selectedWorkspace ? (
												<Badge variant="outline">
													已接入连接器
												</Badge>
											) : null}
										</div>
										<p className="mt-2 text-sm leading-6 text-muted-foreground">
											该租户的成员身份、Agent 绑定、审批风险和连接器资源集中在这里核对。
										</p>
									</div>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => onNavigate('/platform/agents')}
										className="w-full sm:w-auto"
									>
										<BotMessageSquare className="size-4" />
										{t('platform.agentManagement.title')}
									</Button>
								</div>

								<div className="mt-4 grid overflow-hidden rounded-lg border bg-background sm:grid-cols-2 xl:grid-cols-4">
									{[
										{
											label: t('platform.members.roles'),
											value: selectedTenantSummary.roleNames.length,
											icon: ShieldCheck,
										},
										{
											label: t('platform.members.boundAgents'),
											value: selectedTenantSummary.agentCount,
											icon: BotMessageSquare,
										},
										{
											label: t('platform.members.pendingApprovals'),
											value: selectedTenantSummary.pendingApprovalCount,
											icon: Clock3,
										},
										{
											label: t('platform.members.auditEvents'),
											value: selectedTenantSummary.auditEventCount,
											icon: UserCheck,
										},
									].map((item) => {
										const Icon = item.icon;

										return (
											<div
												key={item.label}
												className="border-b p-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0"
											>
												<div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
													<span className="truncate">{item.label}</span>
													<Icon className="size-4" />
												</div>
												<div className="mt-2 text-2xl font-semibold tabular-nums">
													{item.value}
												</div>
											</div>
										);
									})}
								</div>

								<div className="mt-4 grid gap-3 border-t pt-4 lg:grid-cols-3">
									<div className="min-w-0">
										<div className="text-xs font-medium text-muted-foreground">身份覆盖</div>
										<div className="mt-2 text-sm font-semibold">
											{selectedIdentityCount} {t('platform.connectors.identities')}
										</div>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											用于判断连接器身份映射是否覆盖该租户。
										</p>
									</div>
									<div className="min-w-0">
										<div className="text-xs font-medium text-muted-foreground">连接器覆盖</div>
										<div className="mt-2 text-sm font-semibold">
											{selectedWorkspace
												? t('platform.connectors.tenantPreview')
												: t('platform.connectors.empty')}
										</div>
										<p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
											{selectedWorkspace?.source ?? '暂未绑定外部系统来源。'}
										</p>
									</div>
									<div className="min-w-0">
										<div className="text-xs font-medium text-muted-foreground">平台覆盖</div>
										<div className="mt-2 text-sm font-semibold">
											{workspaceCount} 个租户接入
										</div>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											覆盖 {tenantsWithWorkspaceCount} / {platformMemberTenantSummaries.length}{' '}
											个租户。
										</p>
									</div>
								</div>
							</section>

							<section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
								<div className="rounded-lg border bg-background p-4">
									<div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
										<div>
											<h3 className="text-sm font-semibold">成员清单</h3>
											<p className="mt-1 text-xs leading-5 text-muted-foreground">
												展示前 8 个成员，用于快速核对身份、角色和状态。
											</p>
										</div>
										<Badge variant="outline">
											{selectedTenantSummary.members.length}{' '}
											{t('platform.members.activeMembers')}
										</Badge>
									</div>
									<div className="grid gap-2">
										{selectedTenantSummary.members.length ? (
											<>
												{selectedTenantSummary.members.slice(0, 8).map((member) => (
													<div
														key={`${selectedTenantSummary.tenant}-${member.user_id}`}
														className="grid gap-3 rounded-md border border-transparent bg-background p-3 transition-colors hover:border-primary/30 hover:bg-primary/5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
													>
														<div className="min-w-0">
															<div className="break-words text-sm font-medium">
																{member.display_name || member.user_id}
															</div>
															<div className="mt-1 break-all font-mono text-xs text-muted-foreground">
																{member.user_id}
															</div>
														</div>
														<div className="flex flex-wrap gap-1 sm:justify-end">
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
												{selectedTenantSummary.members.length > 8 ? (
													<div className="rounded-md border border-dashed bg-background/80 p-3 text-xs text-muted-foreground">
														仅显示前 8 个成员，其余成员可通过搜索定位。
													</div>
												) : null}
											</>
										) : (
											<div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed bg-background/80 px-6 py-8 text-center">
												<UserRound className="size-6 text-muted-foreground" />
												<div className="mt-3 text-sm font-medium">暂无成员</div>
												<div className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
													当前租户还没有同步到成员身份。接入身份源后，这里会显示成员、角色和状态。
												</div>
											</div>
										)}
									</div>
								</div>

								<aside className="rounded-lg border bg-background p-4 xl:sticky xl:top-20">
									<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
										<div className="min-w-0">
											<h3 className="text-sm font-semibold">
												{t('platform.connectors.tenantPreview')}
											</h3>
											<p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
												{selectedWorkspace?.source ?? t('platform.connectors.empty')}
											</p>
										</div>
										<Badge variant="outline" className="w-fit">
											{selectedIdentityCount} {t('platform.connectors.identities')}
										</Badge>
									</div>
									{selectedWorkspace ? (
										<div className="mt-4 grid overflow-hidden rounded-lg border bg-background text-xs sm:grid-cols-2">
											{[
												{
													label: t('platform.connectors.policies'),
													value: selectedWorkspace.policies.length,
												},
												{
													label: t('platform.connectors.tickets'),
													value: selectedWorkspace.tickets.length,
												},
												{
													label: t('platform.connectors.departments'),
													value: selectedWorkspace.departments.length,
												},
												{
													label: t('platform.connectors.tools'),
													value: countArrayField(selectedWorkspace, 'tools'),
												},
											].map((item) => (
												<div
													key={item.label}
													className="border-b p-3 even:border-l last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0"
												>
													<div className="text-muted-foreground">{item.label}</div>
													<div className="mt-2 text-xl font-semibold tabular-nums text-foreground">
														{item.value}
													</div>
												</div>
											))}
										</div>
									) : (
										<div className="mt-4 rounded-lg border border-dashed bg-background/80 p-6 text-sm text-muted-foreground">
											{t('platform.connectors.empty')}
										</div>
									)}
								</aside>
							</section>
						</>
					) : (
						<div className="rounded-lg border border-dashed bg-background p-8 text-sm text-muted-foreground">
							{t('platform.members.empty')}
						</div>
					)}
				</div>
			</section>
		</PlatformPageShell>
	);
}
