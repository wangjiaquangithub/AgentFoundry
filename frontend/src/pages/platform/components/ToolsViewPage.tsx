import { Boxes, CheckCircle2, ShieldAlert, Users, Wrench } from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';

import {
	PlatformConnectionCard,
	PlatformPageHeader,
	PlatformPageShell,
} from './common';
import { ToolCatalogPanel } from './ToolCatalogPanel';
import { ToolRunnerPanel } from './ToolRunnerPanel';
import type {
	EnterprisePublishedAgent,
	EnterpriseToolCatalogItem,
	EnterpriseToolDecision,
	EnterpriseToolRunResponse,
} from '@/api';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface ToolInputConfig {
	inputKey: string;
	labelKey: string;
	defaultValue: string;
}

interface ToolsViewPageProps {
	serverUrl: string;
	username: string;
	hasErrors: boolean;
	configManagementRef: RefObject<HTMLElement | null>;
	toolRunnerRef: RefObject<HTMLElement | null>;
	availableToolItems: EnterpriseToolCatalogItem[];
	publishedPlatformAgents: EnterprisePublishedAgent[];
	toolCatalogLoading: boolean;
	toolCatalogError: string | null;
	selectedToolName: string;
	selectedToolConfig?: ToolInputConfig;
	selectedToolCatalogItem?: EnterpriseToolCatalogItem | null;
	selectedToolInputValue: string;
	selectedToolInputKey?: string;
	toolApprovalId: string;
	selectedToolDecision?: EnterpriseToolDecision;
	selectedToolAllowed: boolean;
	selectedToolReason: string;
	creatingRunApproval: string | null;
	platformError: Error | string | null;
	runningTool: boolean;
	toolRunError: string | null;
	toolRunResult: EnterpriseToolRunResponse | null;
	onRefetchToolCatalog: () => void | Promise<void>;
	onSelectedToolNameChange: (value: string) => void;
	onToolRunErrorChange: (value: string | null) => void;
	onToolInputsChange: Dispatch<SetStateAction<Record<string, string>>>;
	onToolApprovalIdChange: (value: string) => void;
	onCreateRunApproval: (requestType: 'tool_run') => void | Promise<unknown>;
	onRunEnterpriseTool: () => void | Promise<void>;
	t: Translate;
}

export function ToolsViewPage({
	serverUrl,
	username,
	hasErrors,
	configManagementRef,
	toolRunnerRef,
	availableToolItems,
	publishedPlatformAgents,
	toolCatalogLoading,
	toolCatalogError,
	selectedToolName,
	selectedToolConfig,
	selectedToolCatalogItem,
	selectedToolInputValue,
	selectedToolInputKey,
	toolApprovalId,
	selectedToolDecision,
	selectedToolAllowed,
	selectedToolReason,
	creatingRunApproval,
	platformError,
	runningTool,
	toolRunError,
	toolRunResult,
	onRefetchToolCatalog,
	onSelectedToolNameChange,
	onToolRunErrorChange,
	onToolInputsChange,
	onToolApprovalIdChange,
	onCreateRunApproval,
	onRunEnterpriseTool,
	t,
}: ToolsViewPageProps) {
	const allowedToolCount = availableToolItems.filter((tool) => tool.allowed).length;
	const deniedToolCount = availableToolItems.length - allowedToolCount;
	const boundToolCount = availableToolItems.filter(
		(tool) => tool.configured_by_agents.length > 0,
	).length;
	const totalToolCalls = availableToolItems.reduce(
		(total, tool) => total + tool.stats.calls,
		0,
	);

	return (
		<PlatformPageShell>
			<PlatformPageHeader
				icon={Boxes}
				eyebrow={t('platform.toolCatalog.title')}
				title={t('platform.toolCatalog.title')}
				description={t('platform.toolCatalog.description')}
				aside={
					<PlatformConnectionCard
						serverUrl={serverUrl}
						username={username}
						hasErrors={hasErrors}
						labels={{
							server: t('platform.connection.server'),
							user: t('platform.connection.user'),
							health: t('platform.connection.health'),
							partial: t('platform.connection.partial'),
							connected: t('platform.connection.connected'),
						}}
					/>
				}
			/>

				<section className="grid gap-3 md:grid-cols-4">
					<div className="rounded-lg border bg-background p-4 shadow-sm">
						<div className="flex items-center justify-between gap-3">
							<span className="text-sm font-medium text-muted-foreground">
								{t('platform.toolCatalog.title')}
							</span>
							<Wrench className="size-4 text-muted-foreground" />
						</div>
						<div className="mt-3 text-2xl font-semibold tabular-nums">
							{availableToolItems.length}
						</div>
						<p className="mt-1 truncate text-xs text-muted-foreground">
							{t('platform.toolCatalog.calls')}: {totalToolCalls}
						</p>
					</div>
					<div className="rounded-lg border bg-background p-4 shadow-sm">
						<div className="flex items-center justify-between gap-3">
							<span className="text-sm font-medium text-muted-foreground">
								{t('platform.policy.allowed')}
							</span>
							<CheckCircle2 className="size-4 text-muted-foreground" />
						</div>
						<div className="mt-3 text-2xl font-semibold tabular-nums">
							{allowedToolCount}
						</div>
						<p className="mt-1 truncate text-xs text-muted-foreground">
							{t('platform.toolRunner.run')}
						</p>
					</div>
					<div className="rounded-lg border bg-background p-4 shadow-sm">
						<div className="flex items-center justify-between gap-3">
							<span className="text-sm font-medium text-muted-foreground">
								{t('platform.toolCatalog.configuredBy')}
							</span>
							<Users className="size-4 text-muted-foreground" />
						</div>
						<div className="mt-3 text-2xl font-semibold tabular-nums">
							{boundToolCount}
						</div>
						<p className="mt-1 truncate text-xs text-muted-foreground">
							{publishedPlatformAgents.length} Agent
						</p>
					</div>
					<div className="rounded-lg border bg-background p-4 shadow-sm">
						<div className="flex items-center justify-between gap-3">
							<span className="text-sm font-medium text-muted-foreground">
								{t('platform.policy.denied')}
							</span>
							<ShieldAlert className="size-4 text-muted-foreground" />
						</div>
						<div className="mt-3 text-2xl font-semibold tabular-nums">
							{deniedToolCount}
						</div>
						<p className="mt-1 truncate text-xs text-muted-foreground">
							{t('platform.toolRunner.requestApproval')}
						</p>
					</div>
				</section>

			<section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(400px,0.92fr)] xl:items-start">
				<ToolCatalogPanel
					sectionRef={configManagementRef}
					availableToolItems={availableToolItems}
					publishedPlatformAgents={publishedPlatformAgents}
					toolCatalogLoading={toolCatalogLoading}
					toolCatalogError={toolCatalogError}
					onRefetchToolCatalog={onRefetchToolCatalog}
					t={t}
				/>

				<div className="xl:sticky xl:top-6">
					<ToolRunnerPanel
						sectionRef={toolRunnerRef}
						selectedToolName={selectedToolName}
						availableToolItems={availableToolItems}
						toolCatalogLoading={toolCatalogLoading}
						selectedToolConfig={selectedToolConfig}
						selectedToolCatalogItem={selectedToolCatalogItem}
						selectedToolInputValue={selectedToolInputValue}
						selectedToolInputKey={selectedToolInputKey}
						toolApprovalId={toolApprovalId}
						selectedToolDecision={selectedToolDecision}
						selectedToolAllowed={selectedToolAllowed}
						selectedToolReason={selectedToolReason}
						creatingRunApproval={creatingRunApproval}
						platformError={platformError}
						runningTool={runningTool}
						toolRunError={toolRunError}
						toolRunResult={toolRunResult}
						onSelectedToolNameChange={onSelectedToolNameChange}
						onToolRunErrorChange={onToolRunErrorChange}
						onToolInputsChange={onToolInputsChange}
						onToolApprovalIdChange={onToolApprovalIdChange}
						onCreateRunApproval={onCreateRunApproval}
						onRunEnterpriseTool={onRunEnterpriseTool}
						t={t}
					/>
				</div>
			</section>
		</PlatformPageShell>
	);
}
