import {
	ArrowRight,
	BotMessageSquare,
	Building2,
	CheckCircle2,
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
	PlatformMetricsGrid,
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
}: TenantsViewPageProps) {
	const [tenantQuery, setTenantQuery] = useState('');
	const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
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
	const selectedTenantSummary = selectedTenant
		? filteredTenantSummaries.find((summary) => summary.tenant === selectedTenant) ??
			filteredTenantSummaries[0] ??
			null
		: filteredTenantSummaries[0] ?? null;
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
	const isInitialMembersLoading = platformMembersLoading && !platformMembersLoaded;
	const copy = {
		active: '启用',
		activeMembers: '启用成员',
		agentManagement: 'Agent 管理',
		auditEvents: '审计事件',
		boundAgents: '绑定 Agent',
		connectors: '数据源连接器',
		departments: '部门',
		emptyConnectors: '暂无连接器数据',
		emptyMembers: '暂无租户成员',
		identities: '平台身份',
		inactive: '停用',
		organizationOverview: '组织概览',
		pendingApprovals: '待审批',
		policies: '策略',
		refreshStatus: '刷新状态',
		roles: '角色',
		tenantDataPreview: '租户数据预览',
		tenantGroups: '租户组',
		tenantListTitle: '按租户管理成员',
		tickets: '工单',
		tools: '工具',
	};

	return (
		<PlatformPageShell className="min-w-0 max-w-full overflow-x-hidden max-[520px]:gap-3 max-[520px]:px-2 max-[520px]:[overflow-wrap:anywhere] max-[520px]:[&_h1]:text-base max-[520px]:[&_h1]:leading-5 max-[520px]:[&_h1]:[overflow-wrap:anywhere] max-[520px]:[&_p]:[overflow-wrap:anywhere]">
			<PlatformPageHeader
				icon={Building2}
				eyebrow={copy.organizationOverview}
				title="成员与租户治理"
				description={
					<>
						<span className="max-[520px]:hidden">
							按租户查看成员、角色、已绑定 Agent、审批和连接器覆盖，先把多租户隔离关系管清楚。
						</span>
						<span className="hidden max-[520px]:inline">
							按租户核对成员、角色和连接器覆盖。
						</span>
					</>
				}
				actions={
					<>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onRefreshMembers}
							disabled={platformMembersLoading}
							aria-label={copy.refreshStatus}
							title={copy.refreshStatus}
							className="max-[520px]:size-9 max-[520px]:flex-none max-[520px]:justify-center max-[520px]:p-0"
						>
							<RefreshCcw className={cn(platformMembersLoading && 'animate-spin')} />
							<span className="max-[520px]:sr-only">{copy.refreshStatus}</span>
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onRefreshConnectors}
							disabled={connectorsLoading}
							aria-label={copy.connectors}
							title={copy.connectors}
							className="max-[520px]:size-9 max-[520px]:flex-none max-[520px]:justify-center max-[520px]:p-0"
						>
							<Network className={cn(connectorsLoading && 'animate-pulse')} />
							<span className="max-[520px]:sr-only">{copy.connectors}</span>
						</Button>
					</>
				}
			/>

			{platformMembersError ? <PlatformNotice>{platformMembersError}</PlatformNotice> : null}
			{connectorsError ? <PlatformNotice>{connectorsError}</PlatformNotice> : null}

			<PlatformMetricsGrid
				className={cn(
					'max-[520px]:grid max-[520px]:grid-cols-2 max-[520px]:rounded-md max-[520px]:border max-[520px]:[&_.truncate]:overflow-visible max-[520px]:[&_.truncate]:whitespace-normal max-[520px]:[&>div]:min-h-12 max-[520px]:[&>div]:grid-cols-1 max-[520px]:[&>div]:border-l-0 max-[520px]:[&>div]:border-t max-[520px]:[&>div:nth-child(-n+2)]:border-t-0 max-[520px]:[&>div:nth-child(odd)]:border-r max-[520px]:[&>div:last-child]:col-span-2 max-[520px]:[&>div:last-child]:border-r-0 max-[520px]:[&>div]:px-3 max-[520px]:[&>div]:py-2 max-[520px]:[&>div>div:last-child]:hidden xl:grid-cols-5',
					isInitialMembersLoading && 'max-[520px]:hidden',
				)}
			>
				{[
					{
						label: copy.tenantGroups,
						value: platformMemberTenantSummaries.length,
						icon: Building2,
					},
					{
						label: copy.activeMembers,
						value: activeMemberCount,
						icon: UserRound,
					},
					{
						label: copy.roles,
						value: roleCount,
						icon: ShieldCheck,
					},
					{
						label: copy.boundAgents,
						value: activePlatformAgentCount,
						icon: BotMessageSquare,
					},
					{
						label: copy.pendingApprovals,
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
			</PlatformMetricsGrid>

			<section className="grid min-w-0 gap-4 max-[520px]:gap-2 xl:grid-cols-[minmax(320px,0.76fr)_minmax(0,1.24fr)] xl:items-start">
				<div className="grid min-w-0 content-start gap-3 border-y bg-white py-4 max-[520px]:gap-2 max-[520px]:rounded-md max-[520px]:border max-[520px]:p-2.5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:grid-rows-[auto_auto_minmax(0,1fr)] xl:overflow-hidden xl:rounded-lg xl:border xl:p-3">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div className="min-w-0">
							<h2 className="text-sm font-semibold text-foreground">
								<span className="max-[520px]:hidden">
									{copy.tenantListTitle}
								</span>
								<span className="hidden max-[520px]:inline">租户成员</span>
							</h2>
							<p className="mt-1 text-xs leading-5 text-muted-foreground max-[520px]:hidden">
								搜索租户、成员或角色，详情区同步显示治理信息。
							</p>
						</div>
						<Badge variant="outline" className="w-fit max-w-full shrink-0 max-[520px]:text-[11px]">
							<span className="max-[520px]:hidden">
								{filteredTenantSummaries.length}{' '}
								{copy.tenantGroups}
							</span>
							<span className="hidden max-[520px]:inline">
								{filteredTenantSummaries.length} 组
							</span>
						</Badge>
					</div>
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={tenantQuery}
							onChange={(event) => setTenantQuery(event.target.value)}
							placeholder="搜索租户、成员、角色"
							className="min-w-0 pl-9 max-[520px]:h-9 max-[520px]:text-xs"
						/>
					</div>
					{isInitialMembersLoading ? (
						<div className="grid gap-2">
							<div className="flex min-w-0 items-center justify-between gap-3 border-b pb-2 text-xs text-muted-foreground max-[520px]:pb-1.5">
								<span className="min-w-0 truncate max-[520px]:text-[11px]">
									正在同步租户成员
								</span>
								<RefreshCcw className="size-3.5 shrink-0 animate-spin" />
							</div>
							{[0, 1].map((item) => (
								<div
									key={item}
									className="border-t py-2.5 first:border-t-0 max-[520px]:py-2"
								>
									<div className="flex items-center justify-between gap-3">
										<Skeleton className="h-3.5 w-24 max-[520px]:w-14" />
										<Skeleton className="h-4 w-14 rounded-full max-[520px]:hidden" />
									</div>
									<div className="mt-2 flex gap-2 max-[520px]:hidden">
										<Skeleton className="h-2.5 w-12" />
										<Skeleton className="h-2.5 w-14" />
										<Skeleton className="h-2.5 w-10" />
									</div>
								</div>
							))}
						</div>
					) : filteredTenantSummaries.length ? (
						<div className="grid min-h-0 gap-2 xl:overflow-y-auto xl:pr-1">
							{filteredTenantSummaries.map((tenantSummary) => {
								const isSelected =
									selectedTenantSummary?.tenant === tenantSummary.tenant;

								return (
									<button
										type="button"
										key={tenantSummary.tenant}
										onClick={() => setSelectedTenant(tenantSummary.tenant)}
										className={cn(
											'grid w-full min-w-0 gap-2 rounded-md border px-3 py-2.5 text-left transition-colors max-[520px]:gap-2 max-[520px]:p-2.5',
											isSelected
												? 'border-primary/45 bg-primary/5 shadow-[inset_3px_0_0_hsl(var(--primary))]'
												: 'bg-white hover:border-primary/30 hover:bg-primary/5',
										)}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<div className="flex flex-wrap items-center gap-2">
													<h3 className="break-words text-sm font-semibold">
														{tenantSummary.tenant}
													</h3>
													{isSelected ? (
														<Badge
															variant="outline"
															className="gap-1 border-primary/30 bg-white text-primary"
															title="当前查看"
														>
															<CheckCircle2 className="size-3" />
															<span className="max-[520px]:sr-only">当前查看</span>
														</Badge>
													) : null}
													<Badge
														variant={isSelected ? 'outline' : 'secondary'}
														className="max-w-full"
													>
														{tenantSummary.activeMemberCount}{' '}
														{copy.activeMembers}
													</Badge>
												</div>
												<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
													<span>{tenantSummary.roleNames.length} 角色</span>
													<span>{tenantSummary.agentCount} Agent</span>
													<span>{tenantSummary.pendingApprovalCount} 待审批</span>
													<span>{tenantSummary.auditEventCount} 审计</span>
												</div>
											</div>
											<ArrowRight
												className={cn(
													'mt-1 hidden size-4 shrink-0 sm:block',
													isSelected ? 'text-primary' : 'text-muted-foreground',
												)}
											/>
										</div>
									</button>
								);
							})}
						</div>
					) : (
						<div className="flex min-h-32 min-w-0 gap-3 border-t py-5">
							<Building2 className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
							<div className="min-w-0">
								<div className="text-sm font-medium text-foreground">
									{copy.emptyMembers}
								</div>
								<p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground max-[520px]:leading-4">
									完成成员同步后，这里会按租户展示身份、角色、审批和 Agent 绑定。
								</p>
							</div>
						</div>
					)}
				</div>

				<div
					className={cn(
						'min-w-0 overflow-hidden bg-white max-[520px]:rounded-md max-[520px]:border max-[520px]:shadow-sm xl:border-y xl:border-slate-200',
						!selectedTenant && 'max-[520px]:hidden',
					)}
				>
					<div className="border-b border-slate-200 pb-4 max-[520px]:px-3 max-[520px]:py-2.5">
						<div className="flex flex-col gap-3 max-[520px]:gap-2 sm:flex-row sm:items-start sm:justify-between">
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="outline" className="max-w-full bg-slate-50">
										<span className="max-[520px]:hidden">租户详情</span>
										<span className="hidden max-[520px]:inline">详情</span>
									</Badge>
									{selectedTenantSummary ? (
										<Badge
											variant="outline"
											className={cn(
												'max-w-full',
												selectedWorkspace
													? 'border-emerald-200 bg-emerald-50 text-emerald-700'
													: 'border-amber-200 bg-amber-50 text-amber-700',
											)}
										>
											{selectedWorkspace ? '连接器已覆盖' : '未接入连接器'}
										</Badge>
									) : null}
								</div>
								<h2 className="mt-2 break-words text-lg font-semibold leading-6 max-[520px]:mt-1.5 max-[520px]:text-base max-[520px]:leading-5">
									{selectedTenantSummary?.tenant ?? (
										<>
											<span className="max-[520px]:hidden">租户治理详情</span>
											<span className="hidden max-[520px]:inline">治理详情</span>
										</>
									)}
								</h2>
								<p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground max-[520px]:hidden">
									集中核对该租户的成员身份、Agent 绑定、审批风险和连接器资源。
								</p>
							</div>
							{selectedTenantSummary ? (
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => onNavigate('/platform/agents')}
									className="w-full bg-white max-[520px]:h-9 max-[520px]:justify-center sm:w-auto"
								>
									<BotMessageSquare className="size-4" />
									{copy.agentManagement}
								</Button>
							) : null}
						</div>
					</div>
					<div className="pt-4 max-[520px]:p-2.5">
						{isInitialMembersLoading ? (
							<div className="grid min-w-0 gap-3">
								<div className="border-b pb-3 max-[520px]:pb-2">
									<div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
										<div className="min-w-0">
											<div className="flex items-center gap-2 text-sm font-medium text-foreground max-[520px]:text-xs">
												<RefreshCcw className="size-4 shrink-0 animate-spin text-muted-foreground max-[520px]:size-3.5" />
												<span className="min-w-0 truncate">
													正在载入租户治理详情
												</span>
											</div>
											<p className="mt-1 text-xs leading-5 text-muted-foreground max-[520px]:hidden">
												成员、角色和连接器数据会在同一视图内完成核对。
											</p>
										</div>
										<Badge variant="outline" className="w-fit bg-white max-[520px]:hidden">
											同步中
										</Badge>
									</div>
								</div>
								<div className="grid min-w-0 overflow-hidden rounded-md border bg-white text-xs text-muted-foreground max-[520px]:hidden sm:grid-cols-3">
									<div className="min-w-0 border-b p-3 sm:border-b-0 sm:border-r">
										<div className="font-medium text-foreground">成员</div>
										<div className="mt-1">同步身份、角色、状态</div>
									</div>
									<div className="min-w-0 border-b p-3 sm:border-b-0 sm:border-r">
										<div className="font-medium text-foreground">治理</div>
										<div className="mt-1">统计审批、Agent、审计</div>
									</div>
									<div className="min-w-0 p-3">
										<div className="font-medium text-foreground">连接器</div>
										<div className="mt-1">合并租户资源覆盖</div>
									</div>
								</div>
							</div>
						) : selectedTenantSummary ? (
							<>
								<section className="grid gap-3">
									<div className="grid min-w-0 gap-2 rounded-md bg-slate-50 p-2 max-[520px]:grid-cols-2 sm:grid-cols-2 xl:grid-cols-4">
										{[
											{
												label: copy.roles,
												value: selectedTenantSummary.roleNames.length,
												icon: ShieldCheck,
											},
											{
												label: copy.boundAgents,
												value: selectedTenantSummary.agentCount,
												icon: BotMessageSquare,
											},
											{
												label: copy.pendingApprovals,
												value: selectedTenantSummary.pendingApprovalCount,
												icon: Clock3,
											},
											{
												label: copy.auditEvents,
												value: selectedTenantSummary.auditEventCount,
												icon: UserCheck,
											},
										].map((item) => {
											const Icon = item.icon;

											return (
												<div
													key={item.label}
													className="min-w-0 rounded bg-white p-3 shadow-[inset_0_0_0_1px_hsl(var(--border)/0.55)] max-[520px]:p-2.5"
												>
													<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground max-[520px]:text-[11px]">
														<span className="min-w-0 break-words">{item.label}</span>
														<Icon className="size-4 shrink-0 max-[520px]:size-3.5" />
													</div>
													<div className="mt-2 text-2xl font-semibold tabular-nums max-[520px]:text-xl">
														{item.value}
													</div>
												</div>
											);
										})}
									</div>

									<div className="grid gap-2 lg:grid-cols-3">
										<div className="min-w-0 rounded-md bg-slate-50 p-3 max-[520px]:p-2.5">
											<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
												<UserCheck className="size-4" />
												<span>身份覆盖</span>
											</div>
											<div className="mt-2 text-sm font-semibold text-foreground">
												{selectedIdentityCount}{' '}
												{copy.identities}
											</div>
											<p className="mt-1 text-xs leading-5 text-muted-foreground max-[520px]:hidden">
												用于判断连接器身份映射是否覆盖该租户。
											</p>
										</div>
										<div className="min-w-0 rounded-md bg-slate-50 p-3 max-[520px]:p-2.5">
											<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
												<Network className="size-4" />
												<span>连接器覆盖</span>
											</div>
											<div className="mt-2 text-sm font-semibold text-foreground">
												{selectedWorkspace
													? copy.tenantDataPreview
													: copy.emptyConnectors}
											</div>
											<p className="mt-1 break-words text-xs leading-5 text-muted-foreground max-[520px]:leading-4">
												{selectedWorkspace?.source ?? '暂未绑定外部系统来源。'}
											</p>
										</div>
										<div className="min-w-0 rounded-md bg-slate-50 p-3 max-[520px]:p-2.5">
											<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
												<CheckCircle2 className="size-4" />
												<span>平台覆盖</span>
											</div>
											<div className="mt-2 text-sm font-semibold text-foreground">
												{workspaceCount} 个租户接入
											</div>
											<p className="mt-1 text-xs leading-5 text-muted-foreground max-[520px]:leading-4">
												覆盖 {tenantsWithWorkspaceCount} /{' '}
												{platformMemberTenantSummaries.length} 个租户。
											</p>
										</div>
									</div>
								</section>

								<section className="mt-5 grid min-w-0 gap-5 border-t pt-5 max-[520px]:mt-4 max-[520px]:gap-4 max-[520px]:pt-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
									<div className="min-w-0">
										<div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
											<div className="min-w-0">
												<h3 className="text-sm font-semibold">成员清单</h3>
												<p className="mt-1 text-xs leading-5 text-muted-foreground max-[520px]:hidden">
													展示前 8 个成员，用于快速核对身份、角色和状态。
												</p>
											</div>
											<Badge variant="outline" className="w-fit max-w-full">
												{selectedTenantSummary.members.length}{' '}
												{copy.activeMembers}
											</Badge>
										</div>
										<div className="grid gap-2">
											{selectedTenantSummary.members.length ? (
												<>
													{selectedTenantSummary.members
														.slice(0, 8)
														.map((member) => (
															<div
																key={`${selectedTenantSummary.tenant}-${member.user_id}`}
																className="grid gap-3 rounded-md bg-slate-50 px-3 py-2.5 max-[520px]:gap-2 max-[520px]:px-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
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
																			? copy.inactive
																			: copy.active}
																	</Badge>
																</div>
															</div>
														))}
													{selectedTenantSummary.members.length > 8 ? (
														<div className="border-t pt-3 text-xs text-muted-foreground">
															仅显示前 8 个成员，其余成员可通过搜索定位。
														</div>
													) : null}
												</>
											) : (
												<div className="flex min-w-0 gap-3 rounded-md bg-slate-50 p-3">
													<UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
													<div className="min-w-0">
														<div className="text-sm font-medium">暂无成员</div>
														<div className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
															当前租户还没有同步到成员身份。接入身份源后，这里会显示成员、角色和状态。
														</div>
													</div>
												</div>
											)}
										</div>
									</div>

									<aside className="min-w-0">
										<div className="grid gap-3">
											<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
												<div className="min-w-0">
													<h3 className="text-sm font-semibold">
														{copy.tenantDataPreview}
													</h3>
													<p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
														{selectedWorkspace?.source ??
															copy.emptyConnectors}
													</p>
												</div>
												<Badge variant="outline" className="w-fit bg-white">
													{selectedIdentityCount}{' '}
													{copy.identities}
												</Badge>
											</div>
											{selectedWorkspace ? (
												<div className="grid min-w-0 gap-2 text-xs sm:grid-cols-2">
													{[
														{
															label: copy.policies,
															value: selectedWorkspace.policies.length,
														},
														{
															label: copy.tickets,
															value: selectedWorkspace.tickets.length,
														},
														{
															label: copy.departments,
															value: selectedWorkspace.departments.length,
														},
														{
															label: copy.tools,
															value: countArrayField(selectedWorkspace, 'tools'),
														},
													].map((item) => (
														<div
															key={item.label}
															className="min-w-0 rounded-md bg-slate-50 p-3"
														>
															<div className="break-words text-muted-foreground">
																{item.label}
															</div>
															<div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
																{item.value}
															</div>
														</div>
													))}
												</div>
											) : (
												<div className="rounded-md bg-slate-50 p-3 text-sm text-muted-foreground">
													{copy.emptyConnectors}
												</div>
											)}
										</div>
									</aside>
								</section>
							</>
						) : (
							<div className="flex min-w-0 gap-3 border-t py-5">
								<Building2 className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
								<div className="min-w-0">
									<div className="text-sm font-medium text-foreground">
										暂无租户详情
									</div>
									<p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground max-[520px]:leading-4">
										当前筛选没有匹配的租户。清空搜索或同步成员数据后，可在这里查看治理详情。
									</p>
								</div>
							</div>
						)}
					</div>
				</div>
			</section>
		</PlatformPageShell>
	);
}
