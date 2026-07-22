import {
	BotMessageSquare,
	CheckCircle2,
	Clock3,
	KeyRound,
	ListChecks,
	Play,
	PlugZap,
	ShieldCheck,
} from 'lucide-react';
import type { ReactNode } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
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

function HealthRow({
	label,
	description,
	state,
	stateLabel,
	action,
}: {
	label: string;
	description: string;
	state: HealthState;
	stateLabel: string;
	action?: ReactNode;
}) {
	return (
		<div className="grid gap-3 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
			<div className="min-w-0">
				<div className="text-sm font-medium">{label}</div>
				<p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
			</div>
			<StateBadge state={state} label={stateLabel} />
			{action ? <div className="flex justify-start sm:justify-end">{action}</div> : null}
		</div>
	);
}

export function DashboardViewPage({
	activeMemberCount,
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
	const activityItems = [
		...topOpsTasks.map((task) => ({
			id: task.task_id,
			type: '待办',
			title: task.title ?? task.code ?? '运维任务',
			description: task.description ?? '需要在对应模块继续处理。',
			badge: task.severity ?? 'todo',
			time: '',
			href: '/platform/runs',
		})),
		...(Array.isArray(recentWorkflowRuns) ? recentWorkflowRuns : []).map((run) => ({
			id: run.run_id,
			type: '工作流',
			title: run.workflow_name ?? run.workflow_type ?? '工作流运行',
			description: run.run_id ?? '无运行 ID',
			badge: run.status ?? 'unknown',
			time: run.started_at ?? run.finished_at ?? '',
			href: '/platform/workflows',
		})),
		...(Array.isArray(recentAuditEvents) ? recentAuditEvents : []).map((event) => ({
			id: event.event_id,
			type: '审计',
			title: String(event.event_type ?? '审计事件'),
			description: String(event.user_id ?? event.tenant ?? '系统记录'),
			badge: String(event.tenant ?? 'tenant'),
			time: event.timestamp ?? '',
			href: '/platform/tenants',
		})),
	]
		.sort((left, right) => {
			const leftTime = left.time ? new Date(left.time).getTime() : 0;
			const rightTime = right.time ? new Date(right.time).getTime() : 0;
			return rightTime - leftTime;
		})
		.slice(0, 8);

	return (
		<PlatformPageShell>
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

			<section className="rounded-md border bg-background">
				<div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-[1.15fr_1fr_1fr_1fr]">
					<div className="grid gap-3 p-4">
						<div className="flex items-center justify-between gap-3">
							<div className="text-xs font-medium text-muted-foreground">平台状态</div>
							<CheckCircle2
								className={cn(
									'size-4',
									platformReady ? 'text-emerald-600' : 'text-amber-600',
								)}
							/>
						</div>
						<div className="text-base font-semibold">
							{platformReady ? '核心服务可用' : '存在需要处理的服务状态'}
						</div>
						<StateBadge
							state={platformLoading ? 'todo' : platformReady ? 'ready' : 'partial'}
							label={
								platformLoading ? '加载中' : platformReady ? '已连接' : '部分可用'
							}
						/>
					</div>
					<div className="grid gap-3 p-4">
						<div className="flex items-center justify-between gap-3">
							<div className="text-xs font-medium text-muted-foreground">运行概览</div>
							<Clock3 className="size-4 text-muted-foreground" />
						</div>
						<div className="grid grid-cols-3 gap-2">
							<div>
								<div className="text-xl font-semibold tabular-nums">{workflowRunCount}</div>
								<div className="text-xs text-muted-foreground">总运行</div>
							</div>
							<div>
								<div className="text-xl font-semibold tabular-nums">
									{completedWorkflowRunCount}
								</div>
								<div className="text-xs text-muted-foreground">完成</div>
							</div>
							<div>
								<div className="text-xl font-semibold tabular-nums">
									{failedWorkflowRunCount}
								</div>
								<div className="text-xs text-muted-foreground">失败</div>
							</div>
						</div>
					</div>
					<div className="grid gap-3 p-4">
						<div className="flex items-center justify-between gap-3">
							<div className="text-xs font-medium text-muted-foreground">连接器</div>
							<PlugZap className="size-4 text-muted-foreground" />
						</div>
						<div className="flex items-baseline gap-2">
							<span className="text-xl font-semibold tabular-nums">
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
					</div>
					<div className="grid gap-3 p-4">
						<div className="flex items-center justify-between gap-3">
							<div className="text-xs font-medium text-muted-foreground">待办</div>
							<ListChecks className="size-4 text-muted-foreground" />
						</div>
						<div className="flex items-baseline gap-2">
							<span className="text-xl font-semibold tabular-nums">
								{topOpsTasks.length + pendingApprovals.length}
							</span>
							<span className="text-sm text-muted-foreground">项需要关注</span>
						</div>
						<div className="flex flex-wrap gap-2">
							<Badge variant="outline">{pendingApprovals.length} 个审批</Badge>
							<Badge variant="outline">{topOpsTasks.length} 个运维任务</Badge>
						</div>
					</div>
				</div>
			</section>

			<section className="grid gap-4 border-y py-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div className="min-w-0">
						<h2 className="text-base font-semibold">运营与治理队列</h2>
					</div>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => navigate('/platform/runs')}
					>
						查看运行监控
						<Play className="size-4" />
					</Button>
				</div>
				<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
					<div className="rounded-md border bg-background">
						<HealthRow
							label="待审批请求"
							description={
								pendingApprovals.length > 0
									? '存在需要业务或治理负责人确认的高风险操作。'
									: '当前没有阻塞执行链路的审批请求。'
							}
							state={pendingApprovals.length > 0 ? 'partial' : 'ready'}
							stateLabel={
								pendingApprovals.length > 0
									? `${pendingApprovals.length} 个待处理`
									: '无阻塞'
							}
							action={
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => navigate('/platform/approvals')}
								>
									审批队列
								</Button>
							}
						/>
						<HealthRow
							label="失败运行"
							description={
								failedWorkflowRunCount > 0
									? '有工作流运行失败，需要查看失败原因、日志或触发重试。'
									: '最近工作流运行未发现失败记录。'
							}
							state={failedWorkflowRunCount > 0 ? 'blocked' : 'ready'}
							stateLabel={
								failedWorkflowRunCount > 0
									? `${failedWorkflowRunCount} 个失败`
									: '运行稳定'
							}
							action={
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => navigate('/platform/runs')}
								>
									运行监控
								</Button>
							}
						/>
						<HealthRow
							label="Runtime provider"
							description="运行时 provider 与平台业务状态分层展示，AgentScope 仅作为可替换 provider 之一。"
							state={connectorState}
							stateLabel={
								connectorsLoading
									? '加载中'
									: connectors?.runtime.saved_config_enabled
										? '已启用'
										: '待配置'
							}
							action={
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => navigate('/platform/connectors')}
								>
									Provider 配置
								</Button>
							}
						/>
						<HealthRow
							label="Agent 资产"
							description={
								readyPlatformAgents.length > 0
									? '已有可运行 Agent，可继续维护版本、工具、知识和治理策略。'
									: '尚未形成可运行 Agent 资产，需要先发布或完成配置。'
							}
							state={readyPlatformAgents.length > 0 ? 'ready' : 'todo'}
							stateLabel={
								readyPlatformAgents.length > 0
									? `${readyPlatformAgents.length} 个可运行`
									: '待发布'
							}
							action={
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => navigate('/platform/agents')}
								>
									Agent 清单
								</Button>
							}
						/>
					</div>
					<div className="rounded-md border bg-background p-4">
						<div className="flex items-center justify-between gap-3">
							<div>
								<h3 className="text-sm font-semibold">配置健康度</h3>
							</div>
							<StateBadge
								state={platformReady ? 'ready' : 'partial'}
								label={platformReady ? '可用' : '需检查'}
							/>
						</div>
						<div className="mt-4 grid gap-3 text-sm">
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">模型与凭据</span>
								<span className="font-medium tabular-nums">{credentials.length} 项</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">Runtime provider 配置</span>
								<span className="font-medium tabular-nums">{connectorConfigCount} 项</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">成员与租户</span>
								<span className="font-medium tabular-nums">{activeMemberCount} 个成员</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">工作流运行</span>
								<span className="font-medium tabular-nums">{workflowRunCount} 次</span>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className="grid gap-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div className="min-w-0">
						<h2 className="text-base font-semibold">近期动态</h2>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => navigate('/platform/runs')}
						>
							运行监控
						</Button>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							onClick={() => navigate('/platform/approvals')}
						>
							审批队列
						</Button>
					</div>
				</div>
				<Card size="sm" className="rounded-md shadow-none">
					<CardContent className="p-0">
						{activityItems.length > 0 ? (
							<div className="divide-y">
								{activityItems.map((item, index) => (
									<button
										key={item.id ?? `${item.type}-${index}`}
										type="button"
										className="grid w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/45 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
										onClick={() => navigate(item.href)}
									>
										<Badge variant="secondary" className="w-fit">
											{item.type}
										</Badge>
										<div className="min-w-0">
											<div className="truncate text-sm font-medium">
												{item.title}
											</div>
											<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
												{item.description}
											</p>
										</div>
										<div className="flex items-center gap-2 sm:justify-end">
											<Badge variant="outline">{item.badge}</Badge>
											{item.time ? (
												<span className="text-xs text-muted-foreground">
													{new Date(item.time).toLocaleString()}
												</span>
											) : null}
										</div>
									</button>
								))}
							</div>
						) : (
							<div className="px-4 py-8 text-sm text-muted-foreground">
								暂无待办、工作流运行或审计事件。
							</div>
						)}
					</CardContent>
				</Card>
			</section>

			<section className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<h2 className="text-base font-semibold">继续配置平台</h2>
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
