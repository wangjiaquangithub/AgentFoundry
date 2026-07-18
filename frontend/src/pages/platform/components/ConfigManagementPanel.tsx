import { Copy, RefreshCcw, Upload } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import type { EnterprisePlatformConfigExportResponse } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { PlatformNotice } from './common';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface ConfigManagementPanelProps {
	platformConfigExport: EnterprisePlatformConfigExportResponse | null;
	platformConfigLoading: boolean;
	platformConfigError: string | null;
	platformConfigImportResult: string | null;
	platformConfigImportMode: 'merge' | 'replace';
	platformConfigImportText: string;
	importingPlatformConfig: boolean;
	onRefetchPlatformConfigExport: () => void | Promise<void>;
	onCopyPlatformConfig: () => void | Promise<void>;
	onImportPlatformConfig: () => void | Promise<void>;
	onPlatformConfigImportModeChange: Dispatch<SetStateAction<'merge' | 'replace'>>;
	onPlatformConfigImportTextChange: Dispatch<SetStateAction<string>>;
	formatTimestamp: (value?: string) => string;
	t: Translate;
}

export function ConfigManagementPanel({
	platformConfigExport,
	platformConfigLoading,
	platformConfigError,
	platformConfigImportResult,
	platformConfigImportMode,
	platformConfigImportText,
	importingPlatformConfig,
	onRefetchPlatformConfigExport,
	onCopyPlatformConfig,
	onImportPlatformConfig,
	onPlatformConfigImportModeChange,
	onPlatformConfigImportTextChange,
	formatTimestamp,
	t,
}: ConfigManagementPanelProps) {
	return (
		<section className="flex flex-col gap-3">
			<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div>
					<h2 className="text-base font-semibold">
						{t('platform.configManagement.title')}
					</h2>
					<p className="text-sm text-muted-foreground">
						{t('platform.configManagement.description')}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						size="sm"
						variant="outline"
						onClick={() => void onRefetchPlatformConfigExport()}
						disabled={platformConfigLoading}
					>
						<RefreshCcw />
						{t('platform.configManagement.refresh')}
					</Button>
					<Button
						size="sm"
						variant="outline"
						onClick={() => void onCopyPlatformConfig()}
						disabled={!platformConfigExport}
					>
						<Copy />
						{t('platform.configManagement.copyExport')}
					</Button>
				</div>
			</div>

			<PlatformNotice>{t('platform.configManagement.redactedNotice')}</PlatformNotice>

			{platformConfigError ? (
				<PlatformNotice className="border-destructive/30 bg-destructive/10 text-destructive">
					{platformConfigError}
				</PlatformNotice>
			) : null}
			{platformConfigImportResult ? (
				<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800">
					{platformConfigImportResult}
				</div>
			) : null}

			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{platformConfigLoading
					? Array.from({ length: 6 }).map((_, index) => (
							<Skeleton key={index} className="h-24 rounded-lg" />
						))
					: platformConfigExport
						? [
								{
									label: t('platform.configManagement.members'),
									value: platformConfigExport.counts.members,
								},
								{
									label: t('platform.configManagement.connectors'),
									value: platformConfigExport.counts.connector_configs,
								},
								{
									label: t('platform.configManagement.agents'),
									value: platformConfigExport.counts.agents,
								},
								{
									label: t('platform.configManagement.workflows'),
									value: platformConfigExport.counts.workflow_templates,
								},
								{
									label: t('platform.configManagement.toolPolicyTenants'),
									value: platformConfigExport.counts.tool_policy_tenants,
								},
								{
									label: t('platform.configManagement.toolPolicyUsers'),
									value: platformConfigExport.counts.tool_policy_users,
								},
							].map((item) => (
								<Card
									key={item.label}
									size="sm"
									className="rounded-lg shadow-none"
								>
									<CardHeader>
										<CardTitle className="text-sm text-muted-foreground">
											{item.label}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="text-2xl font-semibold">
											{item.value}
										</div>
									</CardContent>
								</Card>
							))
						: (
								<div className="rounded-lg border p-4 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
									{t('platform.configManagement.empty')}
								</div>
							)}
			</div>

			<Card className="rounded-lg shadow-none">
				<CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div>
						<CardTitle className="text-sm">
							{t('platform.configManagement.exportJson')}
						</CardTitle>
						<div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
							{platformConfigExport ? (
								<>
									<span>
										{t('platform.configManagement.schemaVersion')}:{' '}
										{platformConfigExport.schema_version}
									</span>
									<span>
										{t('platform.configManagement.lastExported')}:{' '}
										{formatTimestamp(platformConfigExport.exported_at)}
									</span>
								</>
							) : null}
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Select
							value={platformConfigImportMode}
							onValueChange={(value) =>
								onPlatformConfigImportModeChange(
									value as 'merge' | 'replace',
								)
							}
						>
							<SelectTrigger className="w-[8rem]">
								<SelectValue
									placeholder={t('platform.configManagement.importMode')}
								/>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="merge">
									{t('platform.configManagement.merge')}
								</SelectItem>
								<SelectItem value="replace">
									{t('platform.configManagement.replace')}
								</SelectItem>
							</SelectContent>
						</Select>
						<Button
							size="sm"
							onClick={() => void onImportPlatformConfig()}
							disabled={
								importingPlatformConfig || !platformConfigImportText.trim()
							}
						>
							<Upload />
							{t('platform.configManagement.import')}
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<Textarea
						className="min-h-[18rem] font-mono text-xs"
						value={platformConfigImportText}
						onChange={(event) =>
							onPlatformConfigImportTextChange(event.target.value)
						}
						placeholder={t('platform.configManagement.empty')}
					/>
				</CardContent>
			</Card>
		</section>
	);
}
