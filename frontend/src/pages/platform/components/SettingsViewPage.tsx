import { RefreshCcw, Server } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import {
	PlatformConnectionCard,
	PlatformNotice,
	PlatformPageHeader,
	PlatformPageShell,
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

			<section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)]">
				<div className="grid content-start gap-4 rounded-lg border bg-background p-4 shadow-sm">
					<div className="flex flex-col gap-1">
						<h2 className="text-sm font-semibold">{t('platform.connection.health')}</h2>
						<p className="text-xs leading-5 text-muted-foreground">
							{t('platform.connection.health')}
						</p>
					</div>
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
					<div className="grid gap-2">
						{runtimeItems.map((item) => {
							const Icon = item.icon;

							return (
								<div
									key={item.label}
									className="grid grid-cols-[auto_minmax(6rem,0.35fr)_minmax(0,1fr)] items-center gap-3 rounded-lg border bg-muted/10 p-3 text-sm"
								>
									<Icon className="size-4 text-muted-foreground" />
									<span className="text-xs text-muted-foreground">{item.label}</span>
									<span className="min-w-0 truncate font-mono text-xs">
										{item.value}
									</span>
								</div>
							);
						})}
					</div>
				</div>

				<div className="[&>div]:h-full [&>div]:shadow-sm">
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
						onPlatformConfigImportModeChange={onPlatformConfigImportModeChange}
						onPlatformConfigImportTextChange={onPlatformConfigImportTextChange}
						t={t}
					/>
				</div>
			</section>
		</PlatformPageShell>
	);
}
