import { RefreshCcw, Server } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import type { EnterprisePlatformConfigExportResponse } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { ConfigManagementPanel } from './ConfigManagementPanel';
import type { RuntimeStatusItem } from './RuntimeStatusPanel';
import { PlatformNotice, StateBadge } from './common';

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
		<main className="h-full overflow-y-auto bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
				<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0">
						<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
							<Server className="size-4" />
							<span>{t('platform.configManagement.title')}</span>
						</div>
						<h1 className="text-2xl font-semibold tracking-normal">平台设置</h1>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
							查看运行时连接状态，导出或导入平台配置，后续模型、租户策略和运行参数都收敛到这里。
						</p>
					</div>
					<div className="flex flex-wrap gap-2 lg:justify-end">
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
					</div>
				</section>

				{platformError ? (
					<PlatformNotice>{t('platform.runtime.error')}</PlatformNotice>
				) : null}

				<section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
					<Card className="rounded-lg shadow-none">
						<CardHeader>
							<CardTitle className="text-base">
								{t('platform.connection.title')}
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-3">
							<div className="grid gap-2 rounded-lg border bg-muted/10 p-3 text-xs">
								<div className="flex items-center justify-between gap-3">
									<span className="text-muted-foreground">
										{t('platform.connection.server')}
									</span>
									<span className="truncate font-mono" title={serverUrl}>
										{serverUrl}
									</span>
								</div>
								<div className="flex items-center justify-between gap-3">
									<span className="text-muted-foreground">
										{t('platform.connection.user')}
									</span>
									<span className="truncate font-mono" title={username}>
										{username}
									</span>
								</div>
								<div className="flex items-center justify-between gap-3">
									<span className="text-muted-foreground">
										{t('platform.connection.health')}
									</span>
									<StateBadge
										state={hasErrors ? 'partial' : 'ready'}
										label={
											hasErrors
												? t('platform.status.toConfigure')
												: t('platform.status.ready')
										}
									/>
								</div>
							</div>
							<div className="grid gap-2">
								{runtimeItems.map((item) => {
									const Icon = item.icon;

									return (
										<div
											key={item.label}
											className="grid grid-cols-[auto_7rem_1fr] items-center gap-3 rounded-lg border bg-muted/10 p-3 text-sm"
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
						</CardContent>
					</Card>

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
				</section>
			</div>
		</main>
	);
}
