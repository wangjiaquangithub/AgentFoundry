import {
	Boxes,
	CheckCircle2,
	Code2,
	ListChecks,
	ShieldAlert,
	Users,
	Wrench,
} from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';

import {
	PlatformConnectionCard,
	PlatformPageHeader,
	PlatformPageShell,
	StatCard,
} from './common';
import { ToolCatalogPanel } from './ToolCatalogPanel';
import { ToolRunnerPanel } from './ToolRunnerPanel';
import type {
	EnterprisePublishedAgent,
	EnterpriseToolCatalogItem,
	EnterpriseToolDecision,
	EnterpriseToolRunResponse,
} from '@/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<StatCard
					label={t('platform.toolCatalog.title')}
					value={availableToolItems.length}
					helper={`${t('platform.toolCatalog.calls')}: ${totalToolCalls}`}
					icon={Wrench}
					loading={toolCatalogLoading}
				/>
				<StatCard
					label={t('platform.policy.allowed')}
					value={allowedToolCount}
					helper={t('platform.toolRunner.run')}
					icon={CheckCircle2}
					loading={toolCatalogLoading}
				/>
				<StatCard
					label={t('platform.toolCatalog.configuredBy')}
					value={boundToolCount}
					helper={`${publishedPlatformAgents.length} Agent`}
					icon={Users}
					loading={toolCatalogLoading}
				/>
				<StatCard
					label={t('platform.policy.denied')}
					value={deniedToolCount}
					helper={t('platform.toolRunner.requestApproval')}
					icon={ShieldAlert}
					loading={toolCatalogLoading}
				/>
			</section>

			<Tabs defaultValue="catalog" className="grid gap-4">
				<section className="flex flex-col gap-3 rounded-lg border bg-background p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
					<div className="min-w-0">
						<h2 className="text-base font-semibold">工具工作区</h2>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">
							把工具目录、权限状态和调用调试分区处理，避免配置清单和运行结果挤在同一个长页面里。
						</p>
					</div>
					<TabsList className="w-full sm:w-auto">
						<TabsTrigger value="catalog" className="flex-1 sm:flex-none">
							<ListChecks className="size-4" />
							工具目录
						</TabsTrigger>
						<TabsTrigger value="runner" className="flex-1 sm:flex-none">
							<Code2 className="size-4" />
							调用调试
						</TabsTrigger>
					</TabsList>
				</section>

				<TabsContent value="catalog" className="mt-0">
					<ToolCatalogPanel
						sectionRef={configManagementRef}
						availableToolItems={availableToolItems}
						publishedPlatformAgents={publishedPlatformAgents}
						toolCatalogLoading={toolCatalogLoading}
						toolCatalogError={toolCatalogError}
						onRefetchToolCatalog={onRefetchToolCatalog}
						t={t}
					/>
				</TabsContent>

				<TabsContent value="runner" className="mt-0">
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
				</TabsContent>
			</Tabs>
		</PlatformPageShell>
	);
}
