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
			helper: t('platform.settings.stats.membersHelper'),
			icon: UsersRound,
		},
		{
			label: t('platform.configManagement.agents'),
			value: configCounts?.agents ?? 0,
			helper: t('platform.settings.stats.agentsHelper'),
			icon: Bot,
		},
		{
			label: t('platform.configManagement.workflows'),
			value: configCounts?.workflow_templates ?? 0,
			helper: t('platform.settings.stats.workflowsHelper'),
			icon: GitBranch,
		},
		{
			label: t('platform.configManagement.connectors'),
			value: configCounts?.connector_configs ?? 0,
			helper: t('platform.settings.stats.connectorsHelper'),
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
			label: t('platform.settings.migration.secretHandling'),
			value: t('platform.settings.migration.redactedSecrets'),
			icon: LockKeyhole,
		},
		{
			label: t('platform.configManagement.importMode'),
			value:
				platformConfigImportMode === 'replace'
					? t('platform.configManagement.replace')
					: t('platform.configManagement.merge'),
			icon: ClipboardCheck,
		},
		{
			label: t('platform.settings.migration.configObjects'),
			value: totalConfigObjects,
			icon: Database,
		},
	];

	return (
		<PlatformPageShell>
			<PlatformPageHeader
				icon={Server}
				eyebrow={t('platform.configManagement.title')}
				title={t('platform.settings.title')}
				description={t('platform.settings.description')}
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

			<div className="grid gap-5">
				<section className="grid gap-3 border-y py-4 sm:grid-cols-2 xl:grid-cols-4">
					<div className="rounded-lg border bg-background/80 p-4 shadow-none">
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<Activity className="size-4" />
							{t('platform.settings.runtimeItems')}
						</div>
						<div className="mt-2 text-xl font-semibold tabular-nums">
							{runtimeReadyCount}/{runtimeItems.length}
						</div>
					</div>
					<div className="rounded-lg border bg-background/80 p-4 shadow-none">
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<KeyRound className="size-4" />
							{t('platform.settings.policyItems')}
						</div>
						<div className="mt-2 text-xl font-semibold tabular-nums">{policyCount}</div>
					</div>
					<div className="rounded-lg border bg-background/80 p-4 shadow-none sm:col-span-2">
						<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
							<div>
								<h2 className="text-sm font-semibold">
									{t('platform.settings.governanceTitle')}
								</h2>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{t('platform.settings.governanceDescription')}
								</p>
							</div>
							<StateBadge
								state={hasErrors ? 'partial' : 'ready'}
								label={
									hasErrors
										? t('platform.settings.needsReview')
										: t('platform.status.ready')
								}
							/>
						</div>
					</div>
				</section>

				<section className="border-b pb-5">
					<section className="grid gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
						<div className="grid content-start gap-4">
							<div className="rounded-lg border bg-background/80 p-4 shadow-none">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<h2 className="text-sm font-semibold">
											{t('platform.settings.runtimeConnectionTitle')}
										</h2>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											{t('platform.settings.runtimeConnectionDescription')}
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

							<div className="rounded-lg border bg-background/80 p-4 shadow-none">
								<div className="mb-3 flex items-start justify-between gap-3">
									<div>
										<h2 className="text-sm font-semibold">
											{t('platform.settings.configScopeTitle')}
										</h2>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											{t('platform.settings.configScopeDescription')}
										</p>
									</div>
									<FileJson className="size-4 text-muted-foreground" />
								</div>
								<div className="grid gap-2 text-sm">
									<div className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
										<span className="flex min-w-0 items-center gap-2 text-muted-foreground">
											<Database className="size-4" />
											{t('platform.settings.dataObjects')}
										</span>
										<span className="font-medium tabular-nums">
											{totalConfigObjects}
										</span>
									</div>
									<div className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
										<span className="flex min-w-0 items-center gap-2 text-muted-foreground">
											<KeyRound className="size-4" />
											{t('platform.configManagement.toolPolicy')}
										</span>
										<span className="font-medium tabular-nums">{policyCount}</span>
									</div>
									<div className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
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

						<div className="rounded-lg border bg-background/80 p-4 shadow-none">
							<div className="mb-3">
								<h2 className="text-sm font-semibold">
									{t('platform.settings.runtimeStatusTitle')}
								</h2>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{t('platform.settings.runtimeStatusDescription')}
								</p>
							</div>
							<div className="mb-3 grid gap-2 sm:grid-cols-3">
								<div className="rounded-md border bg-background p-3">
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										<Activity className="size-4" />
										{t('platform.settings.runtimeCoverage')}
									</div>
									<div className="mt-2 text-xl font-semibold tabular-nums">
										{runtimeReadyCount}
									</div>
								</div>
								<div className="rounded-md border bg-background p-3">
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										<CheckCircle2 className="size-4" />
										{t('platform.settings.connectionHealth')}
									</div>
									<div className="mt-2 text-sm font-medium">
										{hasErrors
											? t('platform.settings.needsReview')
											: t('platform.connection.connected')}
									</div>
								</div>
								<div className="rounded-md border bg-background p-3">
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
											className="grid grid-cols-[auto_minmax(5rem,0.38fr)_minmax(0,1fr)] items-center gap-3 rounded-lg border bg-background p-3 text-sm"
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
				</section>

				<section>
					<section className="grid gap-4">
						<div className="rounded-lg border bg-background/80 p-4 shadow-none">
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
						<aside className="grid content-start gap-3">
							<div className="rounded-lg border bg-background/80 p-4 shadow-none">
								<h2 className="text-sm font-semibold">
									{t('platform.settings.migration.title')}
								</h2>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{t('platform.settings.migration.description')}
								</p>
								<div className="mt-4 grid gap-2">
									{migrationChecks.map((item) => {
										const Icon = item.icon;

										return (
											<div
												key={item.label}
													className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm"
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
							<div className="rounded-lg border bg-background/80 p-4 text-xs leading-5 text-muted-foreground shadow-none">
								{t('platform.settings.migration.notice')}
							</div>
						</aside>
					</section>
				</section>
			</div>
		</PlatformPageShell>
	);
}
