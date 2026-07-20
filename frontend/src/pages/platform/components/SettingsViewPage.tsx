import {
	Activity,
	Bot,
	CheckCircle2,
	ClipboardCheck,
	Database,
	FileJson,
	GitBranch,
	KeyRound,
	LockKeyhole,
	RefreshCcw,
	Server,
	Settings2,
	UsersRound,
	Wrench,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import {
	PlatformConnectionCard,
	PlatformNotice,
	PlatformPageHeader,
	PlatformPageShell,
	StatCard,
	StateBadge,
} from './common';
import { ConfigManagementPanel } from './ConfigManagementPanel';
import type { RuntimeStatusItem } from './RuntimeStatusPanel';
import type { EnterprisePlatformConfigExportResponse } from '@/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';


type Translate = (key: string, options?: Record<string, unknown>) => string;

interface SettingsViewPageProps {
	platformLoading: boolean;
	platformError: unknown;
	platformConfigExport: EnterprisePlatformConfigExportResponse | null;
	platformConfigLoading: boolean;
	platformConfigError: string | null;
	platformConfigImportResult: string | null;
	platformConfigImportMode: 'merge' | 'replace';
	platformConfigImportText: string;
	importingPlatformConfig: boolean;
	serverUrl: string;
	username: string;
	hasErrors: boolean;
	runtimeItems: RuntimeStatusItem[];
	onRefreshPlatform: () => void;
	onRefetchPlatformConfigExport: () => void | Promise<void>;
	onCopyPlatformConfig: () => void | Promise<void>;
	onImportPlatformConfig: () => void | Promise<void>;
	onPlatformConfigImportModeChange: Dispatch<SetStateAction<'merge' | 'replace'>>;
	onPlatformConfigImportTextChange: Dispatch<SetStateAction<string>>;
	t: Translate;
}

export function SettingsViewPage({
	platformLoading,
	platformError,
	platformConfigExport,
	platformConfigLoading,
	platformConfigError,
	platformConfigImportResult,
	platformConfigImportMode,
	platformConfigImportText,
	importingPlatformConfig,
	serverUrl,
	username,
	hasErrors,
	runtimeItems,
	onRefreshPlatform,
	onRefetchPlatformConfigExport,
	onCopyPlatformConfig,
	onImportPlatformConfig,
	onPlatformConfigImportModeChange,
	onPlatformConfigImportTextChange,
	t,
}: SettingsViewPageProps) {
	const configCounts = platformConfigExport?.counts;
	const settingsStats = [
		{
			label: t('platform.configManagement.members'),
			value: configCounts?.members ?? 0,
			helper: '组织成员与租户身份',
			icon: UsersRound,
		},
		{
			label: t('platform.configManagement.agents'),
			value: configCounts?.agents ?? 0,
			helper: '已纳入平台治理的 Agent',
			icon: Bot,
		},
		{
			label: t('platform.configManagement.workflows'),
			value: configCounts?.workflow_templates ?? 0,
			helper: '可复用自动化模板',
			icon: GitBranch,
		},
		{
			label: t('platform.configManagement.connectors'),
			value: configCounts?.connector_configs ?? 0,
			helper: '外部系统连接配置',
			icon: Wrench,
		},
	];
	const policyCount =
		(configCounts?.tool_policy_tenants ?? 0) + (configCounts?.tool_policy_users ?? 0);
	const totalConfigObjects = settingsStats.reduce(
		(sum, item) => sum + Number(item.value),
		0,
	);
	const runtimeReadyCount = runtimeItems.filter(
		(item) => item.value && item.value !== '--',
	).length;
	const migrationChecks = [
		{
			label: '敏感信息处理',
			value: '密钥脱敏',
			icon: LockKeyhole,
		},
		{
			label: '导入模式',
			value: platformConfigImportMode === 'replace' ? '替换' : '合并',
			icon: ClipboardCheck,
		},
		{
			label: '配置对象',
			value: totalConfigObjects,
			icon: Database,
		},
	];

	return (
		<PlatformPageShell>
			<PlatformPageHeader
				icon={Server}
				eyebrow={t('platform.configManagement.title')}
				title="平台设置"
				description="查看运行时连接状态，导出或导入平台配置，后续模型、租户策略和运行参数都收敛到这里。"
				actions={
					<>
						<Button
							size="sm"
							variant="outline"
							onClick={onRefreshPlatform}
							disabled={platformLoading}
						>
							<RefreshCcw className={cn(platformLoading && 'animate-spin')} />
							{t('platform.actions.refreshStatus')}
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => void onRefetchPlatformConfigExport()}
							disabled={platformConfigLoading}
						>
							<RefreshCcw className={cn(platformConfigLoading && 'animate-spin')} />
							{t('platform.configManagement.refresh')}
						</Button>
					</>
				}
			/>

			{platformError ? <PlatformNotice>{t('platform.runtime.error')}</PlatformNotice> : null}

			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{settingsStats.map((item) => (
					<StatCard
						key={item.label}
						label={item.label}
						value={item.value}
						helper={item.helper}
						icon={item.icon}
						loading={platformConfigLoading}
					/>
				))}
			</section>

			<Tabs defaultValue="runtime" className="grid gap-4">
				<section className="flex flex-col gap-3 rounded-lg border bg-background p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
					<div>
						<h2 className="text-base font-semibold">设置工作区</h2>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">
							运行连接和配置迁移分区处理，平台设置页默认只展示当前需要核对的状态。
						</p>
					</div>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
						<div className="grid grid-cols-2 gap-2 text-xs sm:w-72">
							<div className="rounded-md border bg-muted/20 px-3 py-2">
								<div className="text-muted-foreground">运行项</div>
								<div className="mt-1 font-semibold tabular-nums">
									{runtimeReadyCount}/{runtimeItems.length}
								</div>
							</div>
							<div className="rounded-md border bg-muted/20 px-3 py-2">
								<div className="text-muted-foreground">策略</div>
								<div className="mt-1 font-semibold tabular-nums">{policyCount}</div>
							</div>
						</div>
						<TabsList className="w-full sm:w-auto">
							<TabsTrigger value="runtime" className="flex-1 sm:flex-none">
								运行状态
							</TabsTrigger>
							<TabsTrigger value="config" className="flex-1 sm:flex-none">
								配置迁移
							</TabsTrigger>
						</TabsList>
					</div>
				</section>

				<TabsContent value="runtime" className="mt-0">
					<section className="grid gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
						<div className="grid content-start gap-4">
							<div className="rounded-lg border bg-background p-4 shadow-sm">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<h2 className="text-sm font-semibold">运行连接</h2>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											用于确认前端连接到哪一个平台服务，以及当前账号是否已经完成基础配置。
										</p>
									</div>
									<StateBadge
										state={hasErrors ? 'partial' : 'ready'}
										label={
											hasErrors
												? t('platform.connection.partial')
												: t('platform.connection.connected')
										}
									/>
								</div>
								<div className="mt-4">
									<PlatformConnectionCard
										serverUrl={serverUrl}
										username={username}
										hasErrors={hasErrors}
										labels={{
											server: t('platform.connection.server'),
											user: t('platform.connection.user'),
											health: t('platform.connection.health'),
											partial: t('platform.status.toConfigure'),
											connected: t('platform.status.ready'),
										}}
									/>
								</div>
							</div>

							<div className="rounded-lg border bg-background p-4 shadow-sm">
								<div className="mb-3 flex items-start justify-between gap-3">
									<div>
										<h2 className="text-sm font-semibold">配置范围</h2>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											导出的配置覆盖平台治理对象，不包含明文密钥。
										</p>
									</div>
									<FileJson className="size-4 text-muted-foreground" />
								</div>
								<div className="grid gap-2 text-sm">
									<div className="flex items-center justify-between gap-3 rounded-md border bg-muted/10 p-3">
										<span className="flex min-w-0 items-center gap-2 text-muted-foreground">
											<Database className="size-4" />
											数据对象
										</span>
										<span className="font-medium tabular-nums">
											{totalConfigObjects}
										</span>
									</div>
									<div className="flex items-center justify-between gap-3 rounded-md border bg-muted/10 p-3">
										<span className="flex min-w-0 items-center gap-2 text-muted-foreground">
											<KeyRound className="size-4" />
											工具策略
										</span>
										<span className="font-medium tabular-nums">{policyCount}</span>
									</div>
									<div className="flex items-center justify-between gap-3 rounded-md border bg-muted/10 p-3">
										<span className="flex min-w-0 items-center gap-2 text-muted-foreground">
											<Settings2 className="size-4" />
											Schema
										</span>
										<span className="max-w-[12rem] truncate font-mono text-xs">
											{platformConfigExport?.schema_version ?? '--'}
										</span>
									</div>
								</div>
							</div>
						</div>

						<div className="rounded-lg border bg-background p-4 shadow-sm">
							<div className="mb-3">
								<h2 className="text-sm font-semibold">运行时状态</h2>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									快速核对模型、工具、RAG、工作流等依赖是否已经接入。
								</p>
							</div>
							<div className="mb-3 grid gap-2 sm:grid-cols-3">
								<div className="rounded-md border bg-muted/10 p-3">
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										<Activity className="size-4" />
										运行覆盖
									</div>
									<div className="mt-2 text-xl font-semibold tabular-nums">
										{runtimeReadyCount}
									</div>
								</div>
								<div className="rounded-md border bg-muted/10 p-3">
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										<CheckCircle2 className="size-4" />
										连接健康
									</div>
									<div className="mt-2 text-sm font-medium">
										{hasErrors ? '待检查' : '已连接'}
									</div>
								</div>
								<div className="rounded-md border bg-muted/10 p-3">
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										<Settings2 className="size-4" />
										Schema
									</div>
									<div className="mt-2 truncate font-mono text-xs">
										{platformConfigExport?.schema_version ?? '--'}
									</div>
								</div>
							</div>
							<div className="grid gap-2 sm:grid-cols-2">
								{runtimeItems.map((item) => {
									const Icon = item.icon;

									return (
										<div
											key={item.label}
											className="grid grid-cols-[auto_minmax(5rem,0.38fr)_minmax(0,1fr)] items-center gap-3 rounded-lg border bg-muted/10 p-3 text-sm"
										>
											<Icon className="size-4 text-muted-foreground" />
											<span className="text-xs text-muted-foreground">
												{item.label}
											</span>
											<span className="min-w-0 truncate font-mono text-xs">
												{item.value}
											</span>
										</div>
									);
								})}
							</div>
						</div>
					</section>
				</TabsContent>

				<TabsContent value="config" className="mt-0">
					<section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
						<div className="rounded-lg border bg-background p-4 shadow-sm">
							<ConfigManagementPanel
								platformConfigExport={platformConfigExport}
								platformConfigLoading={platformConfigLoading}
								platformConfigError={platformConfigError}
								platformConfigImportResult={platformConfigImportResult}
								platformConfigImportMode={platformConfigImportMode}
								platformConfigImportText={platformConfigImportText}
								importingPlatformConfig={importingPlatformConfig}
								onRefetchPlatformConfigExport={onRefetchPlatformConfigExport}
								onCopyPlatformConfig={onCopyPlatformConfig}
								onImportPlatformConfig={onImportPlatformConfig}
								onPlatformConfigImportModeChange={
									onPlatformConfigImportModeChange
								}
								onPlatformConfigImportTextChange={
									onPlatformConfigImportTextChange
								}
								t={t}
							/>
						</div>
						<aside className="grid content-start gap-3 xl:sticky xl:top-20">
							<div className="rounded-lg border bg-background p-4 shadow-sm">
								<h2 className="text-sm font-semibold">迁移检查</h2>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									导入前先确认对象数量、模式和密钥处理，避免覆盖生产配置。
								</p>
								<div className="mt-4 grid gap-2">
									{migrationChecks.map((item) => {
										const Icon = item.icon;

										return (
											<div
												key={item.label}
												className="flex items-center justify-between gap-3 rounded-md border bg-muted/10 p-3 text-sm"
											>
												<span className="flex min-w-0 items-center gap-2 text-muted-foreground">
													<Icon className="size-4" />
													{item.label}
												</span>
												<span className="shrink-0 font-medium tabular-nums">
													{item.value}
												</span>
											</div>
										);
									})}
								</div>
							</div>
							<div className="rounded-lg border bg-background p-4 text-xs leading-5 text-muted-foreground shadow-sm">
								配置迁移只处理平台治理数据；外部系统凭证仍由连接器或运行环境单独管理。
							</div>
						</aside>
					</section>
				</TabsContent>
			</Tabs>
		</PlatformPageShell>
	);
}
