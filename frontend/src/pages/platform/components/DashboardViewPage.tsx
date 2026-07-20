import {
	BotMessageSquare,
	CheckCircle2,
	Clock3,
	Database,
	GitBranch,
	KeyRound,
	ListChecks,
	Play,
	PlugZap,
	ShieldCheck,
	SlidersHorizontal,
	Users,
	Wrench,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import {
	PlatformPageShell,
	StateBadge,
	type HealthState,
	type StatCardProps,
} from './common';
import { PlatformDashboardOverview } from './PlatformDashboardOverview';
import type {
	CredentialView,
	EnterpriseApprovalRequestItem,
	EnterpriseAuditEvent,
	EnterprisePlatformOpsTask,
	EnterprisePlatformConnectorsResponse,
	EnterprisePublishedAgent,
	EnterpriseWorkflowRunHistoryItem,
} from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface DashboardViewPageProps {
	activeMemberCount: number;
	activePlatformAgents: EnterprisePublishedAgent[];
	approvedApprovalCount: number;
	completedWorkflowRunCount: number;
	connectors: EnterprisePlatformConnectorsResponse | null;
	connectorsLoading: boolean;
	credentials: CredentialView[];
	failedWorkflowRunCount: number;
	governanceError: string | null;
	hasErrors: boolean;
	handleNextStepPrimaryAction: () => void;
	handleStartPublishing: () => void;
	monitoringHealthState: HealthState;
	nextStepMode: NextStepMode;
	nextStepPrimaryDisabled: boolean;
	opsTasks: EnterprisePlatformOpsTask[];
	pendingApprovals: EnterpriseApprovalRequestItem[];
	platformAgentsLoading: boolean;
	platformLoading: boolean;
	publishingTemplateId: string | null;
	readyPlatformAgents: EnterprisePublishedAgent[];
	recentAuditEvents: EnterpriseAuditEvent[];
	recentWorkflowRuns: EnterpriseWorkflowRunHistoryItem[];
	serverUrl: string;
	stats: StatCardProps[];
	t: (key: string) => string;
	username: string;
	workflowRunCount: number;
	[key: string]: unknown;
}

type NextStepMode = 'model' | 'publish' | 'configure' | 'governance' | 'run';

interface ModuleShortcut {
	title: string;
	description: string;
	href: string;
	icon: ComponentType<{ className?: string }>;
	state: HealthState;
	stateLabel: string;
	metric: ReactNode;
}

function DashboardModuleCard({
	title,
	description,
	href,
	icon: Icon,
	state,
	stateLabel,
	metric,
}: ModuleShortcut) {
	const navigate = useNavigate();

	return (
		<Card size="sm" className="rounded-lg shadow-none">
			<CardHeader className="grid-cols-[1fr_auto] gap-3">
				<div className="min-w-0">
					<div className="mb-3 flex items-center gap-2">
						<span className="grid size-8 place-items-center rounded-md border bg-background">
							<Icon className="size-4 text-muted-foreground" />
						</span>
						<StateBadge state={state} label={stateLabel} />
					</div>
					<CardTitle className="text-base">{title}</CardTitle>
				</div>
				<div className="text-right text-2xl font-semibold tabular-nums">
					{metric}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="min-h-10 text-sm leading-5 text-muted-foreground">
					{description}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="w-full justify-between"
					onClick={() => navigate(href)}
				>
					进入模块
					<Play className="size-4" />
				</Button>
			</CardContent>
		</Card>
	);
}

function ActivityList({
	title,
	items,
	emptyText,
	renderItem,
	action,
	getKey,
}: {
	title: string;
	items: readonly unknown[];
	emptyText: string;
	renderItem: (item: unknown, index: number) => ReactNode;
	action: ReactNode;
	getKey?: (item: unknown, index: number) => string | number;
}) {
	return (
		<Card size="sm" className="rounded-lg shadow-none">
			<CardHeader className="grid-cols-[1fr_auto] items-center gap-3">
				<CardTitle className="text-base">{title}</CardTitle>
				{action}
			</CardHeader>
			<CardContent>
				{items.length > 0 ? (
					<div className="divide-y rounded-md border bg-background">
						{items.slice(0, 4).map((item, index) => (
							<div key={getKey?.(item, index) ?? index} className="p-3">
								{renderItem(item, index)}
							</div>
						))}
					</div>
				) : (
					<div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
						{emptyText}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export function DashboardViewPage({
	activeMemberCount,
	activePlatformAgents,
	approvedApprovalCount,
	completedWorkflowRunCount,
	connectors,
	connectorsLoading,
	credentials,
	failedWorkflowRunCount,
	governanceError,
	hasErrors,
	handleNextStepPrimaryAction,
	handleStartPublishing,
	nextStepMode,
	nextStepPrimaryDisabled,
	opsTasks,
	pendingApprovals,
	platformAgentsLoading,
	platformLoading,
	publishingTemplateId,
	readyPlatformAgents,
	recentAuditEvents,
	recentWorkflowRuns,
	serverUrl,
	stats,
	t,
	username,
	workflowRunCount,
}: DashboardViewPageProps) {
	const navigate = useNavigate();
	const NextStepIcon =
		nextStepMode === 'model'
			? KeyRound
			: nextStepMode === 'publish'
				? BotMessageSquare
				: nextStepMode === 'configure'
					? ListChecks
					: nextStepMode === 'governance'
						? ShieldCheck
						: Play;
	const workflowIssueCount = failedWorkflowRunCount + pendingApprovals.length;
	const platformReady = !hasErrors && !governanceError;
	const topOpsTasks = Array.isArray(opsTasks) ? opsTasks.slice(0, 4) : [];
	const connectorConfigCount = connectors?.saved_configs.length ?? 0;
	const connectorState = connectorsLoading
		? 'todo'
		: connectors?.runtime.saved_config_enabled
			? 'ready'
			: connectors
				? 'partial'
				: 'todo';
	const moduleShortcuts: ModuleShortcut[] = [
		{
			title: 'Agent 管理',
			description:
				'发布、配置和运行企业助手，查看模型、知识库、工具和准入状态。',
			href: '/platform/agents',
			icon: BotMessageSquare,
			state: readyPlatformAgents.length > 0 ? 'ready' : 'todo',
			stateLabel: readyPlatformAgents.length > 0 ? '可运行' : '待发布',
			metric: activePlatformAgents.length,
		},
		{
			title: '工具与策略',
			description: '维护企业工具目录，按租户和身份控制工具权限，执行工具调试。',
			href: '/platform/tools',
			icon: Wrench,
			state: platformReady ? 'ready' : 'partial',
			stateLabel: platformReady ? '策略正常' : '需检查',
			metric: pendingApprovals.length,
		},
		{
			title: '连接器',
			description: '配置企业系统连接、租户映射、运行时来源和连接测试。',
			href: '/platform/connectors',
			icon: PlugZap,
			state: connectorState,
			stateLabel: connectorsLoading
				? '加载中'
				: connectors?.runtime.saved_config_enabled
					? '已启用'
					: connectors
						? '待配置'
						: '未加载',
			metric: connectorConfigCount,
		},
		{
			title: '工作流编排',
			description: '管理自动化模板、触发运行、审批续跑和近期执行结果。',
			href: '/platform/workflows',
			icon: GitBranch,
			state: workflowIssueCount > 0 ? 'partial' : 'ready',
			stateLabel: workflowIssueCount > 0 ? '有待处理' : '运行稳定',
			metric: workflowRunCount,
		},
		{
			title: '审批治理',
			description: '集中处理高风险动作、租户访问、审计事件和治理健康度。',
			href: '/platform/approvals',
			icon: ShieldCheck,
			state: pendingApprovals.length > 0 ? 'partial' : 'ready',
			stateLabel: pendingApprovals.length > 0 ? '待审批' : '无阻塞',
			metric: approvedApprovalCount,
		},
		{
			title: '租户与成员',
			description: '管理多租户空间、成员身份、角色授权和访问边界。',
			href: '/platform/tenants',
			icon: Users,
			state: activeMemberCount > 0 ? 'ready' : 'todo',
			stateLabel: activeMemberCount > 0 ? '已配置' : '待配置',
			metric: activeMemberCount,
		},
		{
			title: '知识库与记忆',
			description: '查看长期记忆、知识命中、记忆写入和助手上下文能力。',
			href: '/platform/memory',
			icon: Database,
			state: credentials.length > 0 ? 'ready' : 'todo',
			stateLabel: credentials.length > 0 ? '可用' : '需模型',
			metric: credentials.length,
		},
		{
			title: '系统设置',
			description: '维护模型、运行时、导入导出、环境变量和平台级配置。',
			href: '/platform/settings',
			icon: SlidersHorizontal,
			state: platformReady ? 'ready' : 'partial',
			stateLabel: platformReady ? '已连接' : '需检查',
			metric: credentials.length,
		},
	];

	return (
		<PlatformPageShell className="gap-5">
			<PlatformDashboardOverview
				serverUrl={serverUrl}
				username={username}
				connectionState={hasErrors ? 'partial' : 'ready'}
				stats={stats}
				nextStepMode={nextStepMode}
				nextStepIcon={NextStepIcon}
				nextStepPrimaryDisabled={nextStepPrimaryDisabled}
				publishingTemplateId={publishingTemplateId}
				labels={{
					eyebrow: t('platform.eyebrow'),
					title: t('platform.title'),
					subtitle: t('platform.subtitle'),
					server: t('platform.connection.server'),
					user: t('platform.connection.user'),
					health: t('platform.connection.health'),
					connectionState: hasErrors
						? t('platform.connection.partial')
						: t('platform.connection.connected'),
					nextStepEyebrow: t('platform.nextStep.eyebrow'),
					nextStepTitle: t(`platform.nextStep.${nextStepMode}.title`),
					nextStepDescription: t(
						`platform.nextStep.${nextStepMode}.description`,
					),
					nextStepManual: t('platform.nextStep.publish.manual'),
					nextStepAction: t(`platform.nextStep.${nextStepMode}.action`),
					publishing: t('platform.agentManagement.publishing'),
				}}
				onStartPublishing={handleStartPublishing}
				onPrimaryAction={handleNextStepPrimaryAction}
			/>

			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<Card size="sm" className="rounded-lg shadow-none">
					<CardHeader className="grid-cols-[1fr_auto] items-center gap-3">
						<CardTitle className="text-sm text-muted-foreground">
							平台状态
						</CardTitle>
						<CheckCircle2
							className={cn(
								'size-4',
								platformReady ? 'text-emerald-600' : 'text-amber-600',
							)}
						/>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="text-lg font-semibold">
							{platformReady ? '核心服务可用' : '存在需要处理的服务状态'}
						</div>
						<div className="flex flex-wrap gap-2">
							<StateBadge
								state={
									platformLoading ? 'todo' : platformReady ? 'ready' : 'partial'
								}
								label={
									platformLoading
										? '加载中'
										: platformReady
											? '已连接'
											: '部分可用'
								}
							/>
						</div>
					</CardContent>
				</Card>

				<Card size="sm" className="rounded-lg shadow-none">
					<CardHeader className="grid-cols-[1fr_auto] items-center gap-3">
						<CardTitle className="text-sm text-muted-foreground">
							运行概览
						</CardTitle>
						<Clock3 className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent className="grid grid-cols-3 gap-3 text-center">
						<div>
							<div className="text-2xl font-semibold tabular-nums">
								{workflowRunCount}
							</div>
							<div className="text-xs text-muted-foreground">总运行</div>
						</div>
						<div>
							<div className="text-2xl font-semibold tabular-nums">
								{completedWorkflowRunCount}
							</div>
							<div className="text-xs text-muted-foreground">完成</div>
						</div>
						<div>
							<div className="text-2xl font-semibold tabular-nums">
								{failedWorkflowRunCount}
							</div>
							<div className="text-xs text-muted-foreground">失败</div>
						</div>
					</CardContent>
				</Card>

				<Card size="sm" className="rounded-lg shadow-none">
					<CardHeader className="grid-cols-[1fr_auto] items-center gap-3">
						<CardTitle className="text-sm text-muted-foreground">
							连接器
						</CardTitle>
						<PlugZap className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex items-baseline gap-2">
							<span className="text-2xl font-semibold tabular-nums">
								{connectorConfigCount}
							</span>
							<span className="text-sm text-muted-foreground">个配置</span>
						</div>
						<StateBadge
							state={connectorState}
							label={
								connectorsLoading
									? '加载中'
									: connectors?.runtime.saved_config_enabled
										? '运行时已启用'
										: '待启用配置'
							}
						/>
					</CardContent>
				</Card>

				<Card size="sm" className="rounded-lg shadow-none">
					<CardHeader className="grid-cols-[1fr_auto] items-center gap-3">
						<CardTitle className="text-sm text-muted-foreground">
							待办
						</CardTitle>
						<ListChecks className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex items-baseline gap-2">
							<span className="text-2xl font-semibold tabular-nums">
								{topOpsTasks.length + pendingApprovals.length}
							</span>
							<span className="text-sm text-muted-foreground">项需要关注</span>
						</div>
						<div className="flex flex-wrap gap-2">
							<Badge variant="outline">{pendingApprovals.length} 个审批</Badge>
							<Badge variant="outline">{topOpsTasks.length} 个运维任务</Badge>
						</div>
					</CardContent>
				</Card>
			</section>

			<section className="rounded-lg border bg-background p-4 shadow-sm">
				<Tabs defaultValue="modules" className="gap-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h2 className="text-base font-semibold">平台工作区</h2>
							<p className="mt-1 text-sm leading-6 text-muted-foreground">
								首页只承载总控入口；模块作业和近期动态通过工作区切换查看。
							</p>
						</div>
						<TabsList className="w-full sm:w-auto">
							<TabsTrigger value="modules" className="flex-1 sm:flex-none">
								模块入口
							</TabsTrigger>
							<TabsTrigger value="activity" className="flex-1 sm:flex-none">
								实时动态
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="modules" className="mt-0">
						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
							{moduleShortcuts.map((shortcut) => (
								<DashboardModuleCard key={shortcut.href} {...shortcut} />
							))}
						</div>
					</TabsContent>

					<TabsContent value="activity" className="mt-0">
						<div className="grid gap-4 xl:grid-cols-3">
							<ActivityList
								title="待处理事项"
								items={topOpsTasks}
								emptyText="暂无运维待办。"
								getKey={(item, index) =>
									(item as EnterprisePlatformOpsTask).task_id ?? index
								}
								action={
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => navigate('/platform/runs')}
									>
										查看运行
									</Button>
								}
								renderItem={(item) => (
									<div className="space-y-1">
										<div className="flex items-center justify-between gap-3">
											<div className="truncate text-sm font-medium">
												{(item as EnterprisePlatformOpsTask).title ??
													(item as EnterprisePlatformOpsTask).code ??
													'运维任务'}
											</div>
											<Badge variant="outline">
												{(item as EnterprisePlatformOpsTask).severity ?? 'todo'}
											</Badge>
										</div>
										<p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
											{(item as EnterprisePlatformOpsTask).description ??
												'需要在对应模块继续处理。'}
										</p>
									</div>
								)}
							/>

							<ActivityList
								title="最近工作流"
								items={
									Array.isArray(recentWorkflowRuns) ? recentWorkflowRuns : []
								}
								emptyText="暂无工作流运行记录。"
								getKey={(item, index) =>
									(item as EnterpriseWorkflowRunHistoryItem).run_id ?? index
								}
								action={
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => navigate('/platform/workflows')}
									>
										进入工作流
									</Button>
								}
								renderItem={(item) => (
									<div className="space-y-1">
										<div className="flex items-center justify-between gap-3">
											<div className="truncate text-sm font-medium">
												{(item as EnterpriseWorkflowRunHistoryItem)
													.workflow_name ??
													(item as EnterpriseWorkflowRunHistoryItem)
														.workflow_type ??
													'工作流运行'}
											</div>
											<Badge variant="outline">
												{(item as EnterpriseWorkflowRunHistoryItem).status ??
													'unknown'}
											</Badge>
										</div>
										<p className="truncate text-xs text-muted-foreground">
											{(item as EnterpriseWorkflowRunHistoryItem).run_id ??
												'无运行 ID'}
										</p>
									</div>
								)}
							/>

							<ActivityList
								title="最近审计"
								items={
									Array.isArray(recentAuditEvents) ? recentAuditEvents : []
								}
								emptyText="暂无审计事件。"
								getKey={(item, index) =>
									(item as EnterpriseAuditEvent).event_id ?? index
								}
								action={
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => navigate('/platform/approvals')}
									>
										查看治理
									</Button>
								}
								renderItem={(item) => (
									<div className="space-y-1">
										<div className="flex items-center justify-between gap-3">
											<div className="truncate text-sm font-medium">
												{String(
													(item as EnterpriseAuditEvent).event_type ??
														'审计事件',
												)}
											</div>
											<Badge variant="outline">
												{String(
													(item as EnterpriseAuditEvent).tenant ?? 'tenant',
												)}
											</Badge>
										</div>
										<p className="truncate text-xs text-muted-foreground">
											{String(
												(item as EnterpriseAuditEvent).user_id ??
													(item as EnterpriseAuditEvent).timestamp ??
													'系统记录',
											)}
										</p>
									</div>
								)}
							/>
						</div>
					</TabsContent>
				</Tabs>
			</section>

			<section className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<h2 className="text-base font-semibold">继续配置平台</h2>
					<p className="mt-1 text-sm leading-6 text-muted-foreground">
						模型、连接器、导入导出等系统级配置已经移到设置页，首页只保留入口和状态摘要。
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => navigate('/platform/settings')}
					>
						系统设置
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={() => navigate('/platform/agents')}
						disabled={platformAgentsLoading}
					>
						管理 Agent
					</Button>
				</div>
			</section>
		</PlatformPageShell>
	);
}
