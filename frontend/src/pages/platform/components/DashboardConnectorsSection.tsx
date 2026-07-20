import {
	AlertTriangle,
	Building2,
	CheckCircle2,
	Database,
	KeyRound,
	ListChecks,
	Network,
	Play,
	PlugZap,
	RefreshCcw,
	Save,
	ServerCog,
	XCircle,
} from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';

import type { ConnectorTestFormState } from '../platform-defaults';
import { countArrayField, formatTimestamp } from '../platform-utils';
import {
	PlatformPageHeader,
	PlatformPageShell,
	PlatformNotice,
	StatCard,
	StateBadge,
	type HealthState,
} from './common';
import type {
	EnterpriseConnectorSavedConfig,
	EnterpriseConnectorTestResponse,
	EnterprisePlatformConnectorsResponse,
	EnterpriseTenantWorkspace,
} from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface DashboardConnectorsSectionProps {
	activeConnectorTenant: string;
	activeSavedConnectorConfig: EnterpriseConnectorSavedConfig | null;
	connectorCenterRef: RefObject<HTMLElement | null>;
	connectorDraftIssues: string[];
	connectorDraftState: HealthState;
	connectorRuntimeSourceText: string;
	connectorRuntimeState: HealthState;
	connectorSaveError: string | null;
	connectorSaveSuccess: string | null;
	connectorState: HealthState;
	connectorTestError: string | null;
	connectorTestForm: ConnectorTestFormState;
	connectorTestPassed: boolean;
	connectorTestResult: EnterpriseConnectorTestResponse | null;
	connectors: EnterprisePlatformConnectorsResponse | null;
	connectorsError: string | null;
	connectorsLoading: boolean;
	handleSaveConnectorConfig: () => Promise<void>;
	handleTestAndSaveConnectorConfig: () => Promise<void>;
	handleTestConnector: () => Promise<EnterpriseConnectorTestResponse | null>;
	loadSavedConnectorConfig: (config: EnterpriseConnectorSavedConfig) => void;
	refetchConnectors: () => Promise<void>;
	savedConnectorConfigs: EnterpriseConnectorSavedConfig[];
	savingConnectorConfig: boolean;
	setConnectorTestForm: Dispatch<SetStateAction<ConnectorTestFormState>>;
	t: Translate;
	tenantWorkspaces: Array<[string, EnterpriseTenantWorkspace]>;
	testingConnector: boolean;
}

export function DashboardConnectorsSection({
	activeConnectorTenant,
	activeSavedConnectorConfig,
	connectorCenterRef,
	connectorDraftIssues,
	connectorDraftState,
	connectorRuntimeSourceText,
	connectorRuntimeState,
	connectorSaveError,
	connectorSaveSuccess,
	connectorState,
	connectorTestError,
	connectorTestForm,
	connectorTestPassed,
	connectorTestResult,
	connectors,
	connectorsError,
	connectorsLoading,
	handleSaveConnectorConfig,
	handleTestAndSaveConnectorConfig,
	handleTestConnector,
	loadSavedConnectorConfig,
	refetchConnectors,
	savedConnectorConfigs,
	savingConnectorConfig,
	setConnectorTestForm,
	t,
	tenantWorkspaces,
	testingConnector,
}: DashboardConnectorsSectionProps) {
	const connectorDraftStatusLabel =
		connectorDraftIssues.length > 0
			? t('platform.connectors.draftInvalid')
			: connectorDraftState === 'ready'
				? t('platform.connectors.draftSaved')
				: activeSavedConnectorConfig
					? t('platform.connectors.draftChanged')
					: t('platform.connectors.draftNew');
	const supportedConnectorCount = connectors?.supported.length ?? 0;
	const configuredEnvCount =
		connectors?.env.filter((envVar) => envVar.configured).length ?? 0;
	const httpPathCount = connectors ? Object.keys(connectors.http_paths).length : 0;

	return (
		<PlatformPageShell>
			<PlatformPageHeader
				icon={PlugZap}
				eyebrow={t('platform.connectors.title')}
				title={t('platform.connectors.title')}
				description={t('platform.connectors.description')}
				actions={
					<>
						{connectors ? (
							<StateBadge
								state={connectorState}
								label={connectors.current.status}
							/>
						) : null}
						<Button
							size="sm"
							variant="outline"
							onClick={() => void refetchConnectors()}
							disabled={connectorsLoading}
						>
							<RefreshCcw className={cn(connectorsLoading && 'animate-spin')} />
							{t('platform.actions.refreshStatus')}
						</Button>
					</>
				}
			/>

			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<StatCard
					label={t('platform.connectors.supported')}
					value={supportedConnectorCount}
					helper={connectors?.current.name ?? t('platform.connectors.empty')}
					icon={Database}
					loading={connectorsLoading}
				/>
				<StatCard
					label={t('platform.connectors.environment')}
					value={`${configuredEnvCount}/${connectors?.env.length ?? 0}`}
					helper={t('platform.connectors.configured')}
					icon={KeyRound}
					loading={connectorsLoading}
				/>
				<StatCard
					label={t('platform.connectors.httpPaths')}
					value={httpPathCount}
					helper={t('platform.connectors.runtimeDescription')}
					icon={Network}
					loading={connectorsLoading}
				/>
				<StatCard
					label={t('platform.connectors.savedConfigs')}
					value={savedConnectorConfigs.length}
					helper={t('platform.connectors.savedConfigsDescription')}
					icon={ServerCog}
					loading={connectorsLoading}
				/>
			</section>

			<section ref={connectorCenterRef} className="grid gap-4">

					{connectorsError ? (
						<PlatformNotice>{t('platform.connectors.loadError')}</PlatformNotice>
					) : null}

					{connectorsLoading && !connectors ? (
						<div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
							<Skeleton className="h-48 w-full" />
							<Skeleton className="h-48 w-full" />
						</div>
					) : connectors ? (
						<Tabs defaultValue="configuration" className="grid gap-4">
							<section className="rounded-lg border bg-background p-4 shadow-sm">
								<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
									<div className="min-w-0">
										<div className="flex items-center gap-2">
											<div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
												<PlugZap className="size-4 text-muted-foreground" />
											</div>
											<h2 className="text-base font-semibold">连接器工作区</h2>
										</div>
										<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
											把连接器状态、配置测试、资源目录和租户映射分区处理，避免调试表单和运行数据挤在同一个长面板里。
										</p>
									</div>
									<TabsList className="w-full sm:w-auto">
										<TabsTrigger value="configuration" className="flex-1 sm:flex-none">
											<ServerCog className="size-4" />
											配置
										</TabsTrigger>
										<TabsTrigger value="catalog" className="flex-1 sm:flex-none">
											<ListChecks className="size-4" />
											资源
										</TabsTrigger>
										<TabsTrigger value="tenants" className="flex-1 sm:flex-none">
											<Building2 className="size-4" />
											租户
										</TabsTrigger>
									</TabsList>
								</div>
							</section>

							<TabsContent value="configuration" className="mt-0 grid gap-4">
							<div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
								<div className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm">
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-center gap-2">
											<div className="flex size-9 items-center justify-center rounded-lg border bg-muted/30">
												<Database className="size-4 text-muted-foreground" />
											</div>
											<div className="min-w-0">
												<h3 className="text-sm font-medium">
													{t('platform.connectors.current')}
												</h3>
												<p className="truncate font-mono text-xs text-muted-foreground">
													{connectors.current.name}
												</p>
											</div>
										</div>
										<StateBadge
											state={connectorState}
											label={connectors.current.status}
										/>
									</div>
									<div className="grid gap-2 text-sm">
										<div className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2">
											<span className="text-muted-foreground">
												{t('platform.connectors.mode')}
											</span>
											<span className="font-mono text-xs">
												{connectors.current.mode}
											</span>
										</div>
										<div className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2">
											<span className="text-muted-foreground">
												{t('platform.connectors.status')}
											</span>
											<span className="font-mono text-xs">
												{connectors.current.status}
											</span>
										</div>
									</div>
									<p className="text-sm leading-6 text-muted-foreground">
										{connectors.current.message}
									</p>
									<div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-sm">
										<div className="flex items-center justify-between gap-3">
											<div>
												<p className="font-medium">
													{t('platform.connectors.runtime')}
												</p>
												<p className="text-xs text-muted-foreground">
													{t('platform.connectors.runtimeDescription')}
												</p>
											</div>
											<StateBadge
												state={connectorRuntimeState}
												label={
													connectors.runtime.saved_config_enabled
														? t('platform.connectors.runtimeSavedConfigEnabled')
														: t('platform.connectors.runtimeSavedConfigDisabled')
												}
											/>
										</div>
										<div className="grid gap-2 sm:grid-cols-3">
											<div className="rounded-md bg-background px-3 py-2">
												<p className="text-xs text-muted-foreground">
													{t('platform.connectors.runtimeTenant')}
												</p>
												<p className="truncate font-mono text-xs">
													{connectors.runtime.tenant}
												</p>
											</div>
											<div className="rounded-md bg-background px-3 py-2">
												<p className="text-xs text-muted-foreground">
													{t('platform.connectors.runtimeConnector')}
												</p>
												<p className="truncate font-mono text-xs">
													{connectors.runtime.connector}
												</p>
											</div>
											<div className="rounded-md bg-background px-3 py-2">
												<p className="text-xs text-muted-foreground">
													{t('platform.connectors.runtimeSource')}
												</p>
												<p className="truncate text-xs">
													{connectorRuntimeSourceText}
												</p>
											</div>
										</div>
									</div>
								</div>

								<div className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm">
									<div className="flex items-center justify-between gap-3">
										<h3 className="text-sm font-medium">
											{t('platform.connectors.environment')}
										</h3>
										<Badge variant="outline">{connectors.env.length}</Badge>
									</div>
									<div className="grid gap-2">
										{connectors.env.map((envVar) => (
											<div
												key={envVar.name}
												className="grid gap-2 rounded-md border bg-muted/10 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
											>
												<div className="min-w-0">
													<div className="flex flex-wrap items-center gap-2">
														<span className="break-all font-mono text-xs">
															{envVar.name}
														</span>
														<Badge
															variant="outline"
															className={cn(
																envVar.configured
																	? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
																	: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
															)}
														>
															{envVar.configured
																? t('platform.connectors.configured')
																: t('platform.connectors.missing')}
														</Badge>
														<Badge variant="secondary">
															{envVar.required
																? t('platform.connectors.required')
																: t('platform.connectors.optional')}
														</Badge>
														{envVar.secret ? (
															<Badge variant="outline">
																{t('platform.connectors.secret')}
															</Badge>
														) : null}
													</div>
													{envVar.description ? (
														<p className="mt-1 text-xs text-muted-foreground">
															{envVar.description}
														</p>
													) : null}
												</div>
											</div>
										))}
									</div>
								</div>
							</div>

							<div className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<h3 className="text-sm font-medium">
											{t('platform.connectors.testTitle')}
										</h3>
										<p className="mt-1 text-xs text-muted-foreground">
											{t('platform.connectors.testDescription')}
										</p>
									</div>
									{connectorTestResult ? (
										<StateBadge
											state={
												connectorTestResult.status === 'success'
													? 'ready'
													: connectorTestResult.status === 'partial'
														? 'partial'
														: 'todo'
											}
											label={connectorTestResult.status}
										/>
									) : null}
								</div>

								<div className="grid gap-3 rounded-md border bg-muted/10 p-3">
									<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
										<div>
											<h4 className="text-sm font-medium">
												{t('platform.connectors.savedConfigs')}
											</h4>
											<p className="mt-1 text-xs text-muted-foreground">
												{t('platform.connectors.savedConfigsDescription')}
											</p>
										</div>
										<Badge variant="outline">{savedConnectorConfigs.length}</Badge>
									</div>
									{savedConnectorConfigs.length > 0 ? (
										<div className="grid gap-2">
											{savedConnectorConfigs.map((config) => (
												<div
													key={config.tenant}
													className="grid gap-3 rounded-md border bg-background p-3 lg:grid-cols-[minmax(0,1fr)_auto]"
												>
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2">
															<Badge variant="secondary">{config.tenant}</Badge>
															<Badge
																variant="outline"
																className={cn(
																	config.enabled
																		? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
																		: 'border-slate-500/30 bg-slate-500/10 text-slate-700',
																)}
															>
																{config.enabled
																	? t('platform.connectors.enabled')
																	: t('platform.connectors.disabled')}
															</Badge>
															<Badge
																variant="outline"
																className={cn(
																	config.token_configured
																		? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
																		: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
																)}
															>
																{config.token_configured
																	? t('platform.connectors.tokenConfigured')
																	: t('platform.connectors.tokenNotConfigured')}
															</Badge>
														</div>
														<div className="mt-2 truncate font-mono text-xs text-muted-foreground">
															{config.base_url}
														</div>
														<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
															<span>
																{t('platform.connectors.updatedAt')}:{' '}
																{formatTimestamp(config.updated_at)}
															</span>
															<span>
																{t('platform.connectors.updatedBy')}:{' '}
																{config.updated_by || '-'}
															</span>
														</div>
													</div>
													<div className="flex items-center justify-end">
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() => loadSavedConnectorConfig(config)}
														>
															{t('platform.connectors.loadSavedConfig')}
														</Button>
													</div>
												</div>
											))}
										</div>
									) : (
										<div className="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
											{t('platform.connectors.savedConfigsEmpty')}
										</div>
									)}
								</div>

								<div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
									<div className="grid gap-3 rounded-md border bg-muted/10 p-3 lg:col-span-2">
										<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
											<div>
												<h4 className="text-sm font-medium">
													{t('platform.connectors.draftTitle')}
												</h4>
												<p className="mt-1 text-xs text-muted-foreground">
													{t('platform.connectors.draftDescription', {
														tenant: activeConnectorTenant,
													})}
												</p>
											</div>
											<StateBadge
												state={connectorDraftState}
												label={connectorDraftStatusLabel}
											/>
										</div>
										<div className="grid gap-2 sm:grid-cols-3">
											<div className="rounded-md bg-background px-3 py-2">
												<p className="text-xs text-muted-foreground">
													{t('platform.connectors.draftTenant')}
												</p>
												<p className="truncate font-mono text-xs">
													{activeConnectorTenant}
												</p>
											</div>
											<div className="rounded-md bg-background px-3 py-2">
												<p className="text-xs text-muted-foreground">
													{t('platform.connectors.draftToken')}
												</p>
												<p className="truncate text-xs">
													{connectorTestForm.token.trim()
														? t('platform.connectors.tokenWillUpdate')
														: activeSavedConnectorConfig?.token_configured
															? t('platform.connectors.tokenConfigured')
															: t('platform.connectors.tokenNotConfigured')}
												</p>
											</div>
											<div className="rounded-md bg-background px-3 py-2">
												<p className="text-xs text-muted-foreground">
													{t('platform.connectors.draftTest')}
												</p>
												<p className="truncate text-xs">
													{connectorTestPassed
														? t('platform.connectors.testPassed')
														: connectorTestResult
															? t('platform.connectors.testNotPassed')
															: t('platform.connectors.testNotRun')}
												</p>
											</div>
										</div>
										{connectorDraftIssues.length > 0 ? (
											<div className="grid gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
												{connectorDraftIssues.map((issue) => (
													<div key={issue} className="flex items-start gap-2">
														<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
														<span>{issue}</span>
													</div>
												))}
											</div>
										) : null}
									</div>

									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.baseUrl')}
										</span>
										<Input
											value={connectorTestForm.base_url}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													base_url: event.target.value,
												}))
											}
											placeholder="https://api.example.com"
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.token')}
										</span>
										<Input
											type="password"
											value={connectorTestForm.token}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													token: event.target.value,
												}))
											}
											placeholder="Bearer token"
										/>
									</label>
								</div>

								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.tenant')}
										</span>
										<Input
											value={connectorTestForm.tenant}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													tenant: event.target.value,
												}))
											}
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.policyKeyword')}
										</span>
										<Input
											value={connectorTestForm.policy_keyword}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													policy_keyword: event.target.value,
												}))
											}
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.ticketId')}
										</span>
										<Input
											value={connectorTestForm.ticket_id}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													ticket_id: event.target.value,
												}))
											}
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.department')}
										</span>
										<Input
											value={connectorTestForm.department}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													department: event.target.value,
												}))
											}
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.timeoutSeconds')}
										</span>
										<Input
											type="number"
											min="1"
											step="0.5"
											value={connectorTestForm.timeout_seconds}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													timeout_seconds: event.target.value,
												}))
											}
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.status')}
										</span>
										<div className="flex h-9 items-center justify-between gap-3 rounded-md border bg-background px-3">
											<span className="text-xs text-muted-foreground">
												{connectorTestForm.enabled
													? t('platform.connectors.enabled')
													: t('platform.connectors.disabled')}
											</span>
											<Switch
												size="sm"
												checked={connectorTestForm.enabled}
												onCheckedChange={(checked) =>
													setConnectorTestForm((previous) => ({
														...previous,
														enabled: checked,
													}))
												}
											/>
										</div>
									</label>
								</div>

								<div className="grid gap-3 lg:grid-cols-3">
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.policyPath')}
										</span>
										<Input
											value={connectorTestForm.policy_path}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													policy_path: event.target.value,
												}))
											}
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.ticketPath')}
										</span>
										<Input
											value={connectorTestForm.ticket_path}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													ticket_path: event.target.value,
												}))
											}
										/>
									</label>
									<label className="grid gap-1 text-xs">
										<span className="text-muted-foreground">
											{t('platform.connectors.metricsPath')}
										</span>
										<Input
											value={connectorTestForm.metrics_path}
											onChange={(event) =>
												setConnectorTestForm((previous) => ({
													...previous,
													metrics_path: event.target.value,
												}))
											}
										/>
									</label>
								</div>

								<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<p className="text-xs text-muted-foreground">
										{t('platform.connectors.applyEnvHint')}
									</p>
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={() => void handleSaveConnectorConfig()}
											disabled={savingConnectorConfig || connectorDraftIssues.length > 0}
										>
											<Save
												className={cn(savingConnectorConfig && 'animate-pulse')}
											/>
											{savingConnectorConfig
												? t('platform.connectors.saving')
												: t('platform.connectors.save')}
										</Button>
										<Button
											type="button"
											size="sm"
											onClick={() => void handleTestConnector()}
											disabled={testingConnector || connectorDraftIssues.length > 0}
										>
											<Play className={cn(testingConnector && 'animate-pulse')} />
											{testingConnector
												? t('platform.connectors.testing')
												: t('platform.connectors.test')}
										</Button>
										<Button
											type="button"
											size="sm"
											onClick={() => void handleTestAndSaveConnectorConfig()}
											disabled={
												testingConnector ||
												savingConnectorConfig ||
												connectorDraftIssues.length > 0
											}
										>
											<CheckCircle2
												className={cn(
													(testingConnector || savingConnectorConfig) &&
														'animate-pulse',
												)}
											/>
											{t('platform.connectors.testAndSave')}
										</Button>
									</div>
								</div>

								{connectorSaveError ? (
									<PlatformNotice>{connectorSaveError}</PlatformNotice>
								) : null}

								{connectorSaveSuccess ? (
									<div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800">
										<CheckCircle2 className="mt-0.5 size-4 shrink-0" />
										<span className="min-w-0 break-words">
											{connectorSaveSuccess}
										</span>
									</div>
								) : null}

								{connectorTestError ? (
									<PlatformNotice>{connectorTestError}</PlatformNotice>
								) : null}

								{connectorTestResult ? (
									<div className="grid gap-2">
										<div className="text-xs font-medium text-muted-foreground">
											{t('platform.connectors.testStatus')}
										</div>
										{connectorTestResult.checks.map((check) => {
											const succeeded = check.status === 'success';
											const Icon = succeeded ? CheckCircle2 : XCircle;
											return (
												<div
													key={check.name}
													className="grid gap-2 rounded-md border bg-muted/10 p-3"
												>
													<div className="flex flex-wrap items-center justify-between gap-2">
														<div className="flex min-w-0 items-center gap-2">
															<Icon
																className={cn(
																	'size-4 shrink-0',
																	succeeded
																		? 'text-emerald-600'
																		: 'text-red-600',
																)}
															/>
															<span className="font-medium">{check.label}</span>
														</div>
														<div className="flex flex-wrap items-center gap-2">
															<StateBadge
																state={succeeded ? 'ready' : 'todo'}
																label={check.status}
															/>
															<Badge variant="outline" className="font-mono">
																{t('platform.connectors.latency')}: {check.latency_ms}ms
															</Badge>
														</div>
													</div>
													<p className="text-xs text-muted-foreground">
														{check.message}
													</p>
													{check.preview ? (
														<div className="grid gap-1">
															<span className="text-xs text-muted-foreground">
																{t('platform.connectors.preview')}
															</span>
															<pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 font-mono text-xs">
																{check.preview}
															</pre>
														</div>
													) : null}
												</div>
											);
										})}
									</div>
								) : null}
							</div>

							</TabsContent>

							<TabsContent value="catalog" className="mt-0">
								<div className="grid gap-4 xl:grid-cols-2">
								<div className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm">
									<div className="flex items-center justify-between gap-3">
										<h3 className="text-sm font-medium">
											{t('platform.connectors.supported')}
										</h3>
										<Badge variant="outline">
											{connectors.supported.length}
										</Badge>
									</div>
									<div className="grid gap-2">
										{connectors.supported.map((connector) => (
											<div
												key={connector.name}
												className="grid gap-2 rounded-md border bg-muted/10 p-3"
											>
												<div className="flex flex-wrap items-center justify-between gap-2">
													<div className="min-w-0">
														<div className="font-mono text-xs">
															{connector.name}
														</div>
														<p className="mt-1 text-xs text-muted-foreground">
															{connector.description}
														</p>
													</div>
													<Badge variant="secondary">
														{connector.mode}
													</Badge>
												</div>
												{connector.env_vars.length > 0 ? (
													<div className="flex flex-wrap gap-1">
														{connector.env_vars.map((name) => (
															<Badge
																key={name}
																variant="outline"
																className="font-mono text-[10px]"
															>
																{name}
															</Badge>
														))}
													</div>
												) : null}
											</div>
										))}
									</div>
								</div>

								<div className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm">
									<div className="flex items-center justify-between gap-3">
										<h3 className="text-sm font-medium">
											{t('platform.connectors.httpPaths')}
										</h3>
										<Badge variant="outline">
											{Object.keys(connectors.http_paths).length}
										</Badge>
									</div>
									<div className="grid gap-2">
										{Object.entries(connectors.http_paths).map(([name, path]) => (
											<div
												key={name}
												className="grid gap-1 rounded-md border bg-muted/10 p-3"
											>
												<span className="text-xs text-muted-foreground">
													{name}
												</span>
												<span className="break-all font-mono text-xs">
													{path}
												</span>
											</div>
										))}
									</div>
								</div>
							</div>
							</TabsContent>

							<TabsContent value="tenants" className="mt-0">
								<div className="grid gap-4 xl:grid-cols-2">
								<div className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm">
									<div className="flex items-center justify-between gap-3">
										<h3 className="text-sm font-medium">
											{t('platform.connectors.tenantPreview')}
										</h3>
										<Badge variant="outline">{tenantWorkspaces.length}</Badge>
									</div>
									<div className="grid gap-2">
										{tenantWorkspaces.map(([tenant, workspace]) => (
											<div
												key={tenant}
												className="grid gap-3 rounded-md border bg-muted/10 p-3"
											>
												<div className="flex flex-wrap items-center gap-2">
													<Badge variant="secondary">{tenant}</Badge>
													<span className="font-mono text-xs text-muted-foreground">
														{workspace.source}
													</span>
												</div>
												<div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
													<div className="rounded-md bg-background px-3 py-2">
														<div className="text-muted-foreground">
															{t('platform.connectors.policies')}
														</div>
														<div className="mt-1 font-semibold tabular-nums">
															{countArrayField(workspace, 'policies')}
														</div>
													</div>
													<div className="rounded-md bg-background px-3 py-2">
														<div className="text-muted-foreground">
															{t('platform.connectors.tickets')}
														</div>
														<div className="mt-1 font-semibold tabular-nums">
															{countArrayField(workspace, 'tickets')}
														</div>
													</div>
													<div className="rounded-md bg-background px-3 py-2">
														<div className="text-muted-foreground">
															{t('platform.connectors.departments')}
														</div>
														<div className="mt-1 font-semibold tabular-nums">
															{countArrayField(workspace, 'departments')}
														</div>
													</div>
													<div className="rounded-md bg-background px-3 py-2">
														<div className="text-muted-foreground">
															{t('platform.connectors.knowledgeBases')}
														</div>
														<div className="mt-1 font-semibold tabular-nums">
															{countArrayField(workspace, 'knowledge_bases')}
														</div>
													</div>
													<div className="rounded-md bg-background px-3 py-2">
														<div className="text-muted-foreground">
															{t('platform.connectors.tools')}
														</div>
														<div className="mt-1 font-semibold tabular-nums">
															{countArrayField(workspace, 'tools')}
														</div>
													</div>
													<div className="rounded-md bg-background px-3 py-2">
														<div className="text-muted-foreground">
															{t('platform.connectors.sampleQuestions')}
														</div>
														<div className="mt-1 font-semibold tabular-nums">
															{workspace.sample_questions.length}
														</div>
													</div>
												</div>
												{workspace.sample_questions.length > 0 ? (
													<div className="grid gap-1">
														<span className="text-xs text-muted-foreground">
															{t('platform.connectors.sampleQuestions')}
														</span>
														<div className="flex flex-wrap gap-1">
															{workspace.sample_questions
																.slice(0, 3)
																.map((question) => (
																	<Badge
																		key={question}
																		variant="outline"
																		className="max-w-full truncate"
																		title={question}
																	>
																		{question}
																	</Badge>
																))}
														</div>
													</div>
												) : null}
											</div>
										))}
									</div>
								</div>

								<div className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm">
									<div className="flex items-center justify-between gap-3">
										<h3 className="text-sm font-medium">
											{t('platform.connectors.identities')}
										</h3>
										<Badge variant="outline">
											{connectors.identities.length}
										</Badge>
									</div>
									<div className="grid gap-2">
										{connectors.identities.map((identity) => (
											<div
												key={identity.user_id}
												className="grid gap-2 rounded-md border bg-muted/10 p-3"
											>
												<div className="flex flex-wrap items-center justify-between gap-2">
													<div className="min-w-0">
														<div className="truncate text-sm font-medium">
															{identity.display_name}
														</div>
														<div className="font-mono text-xs text-muted-foreground">
															{identity.user_id}
														</div>
													</div>
													<div className="flex flex-wrap gap-1">
														<Badge variant="secondary">
															{identity.tenant}
														</Badge>
														<Badge variant="outline">
															{identity.role}
														</Badge>
													</div>
												</div>
												{identity.sample_questions.length > 0 ? (
													<div className="flex flex-wrap gap-1">
														{identity.sample_questions
															.slice(0, 2)
															.map((question) => (
																<Badge
																	key={question}
																	variant="outline"
																	className="max-w-full truncate"
																	title={question}
																>
																	{question}
																</Badge>
															))}
													</div>
												) : null}
											</div>
										))}
									</div>
								</div>
							</div>
							</TabsContent>
						</Tabs>
					) : (
						<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
							{t('platform.connectors.empty')}
						</div>
					)}
			</section>
		</PlatformPageShell>
	);
}
