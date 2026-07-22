import {
	Boxes,
	CheckCircle2,
	Play,
	ShieldAlert,
	Users,
	Wrench,
} from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useState } from 'react';

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
import { Button } from '@/components/ui/button';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';

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
	const [runnerOpen, setRunnerOpen] = useState(false);
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
				actions={
					<Sheet open={runnerOpen} onOpenChange={setRunnerOpen}>
						<SheetTrigger asChild>
							<Button type="button">
								<Play className="size-4" />
								{t('platform.toolRunner.openRunner')}
							</Button>
						</SheetTrigger>
						<SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-2xl">
							<SheetHeader className="border-b pb-4 pr-12 text-left">
								<SheetTitle>{t('platform.toolRunner.title')}</SheetTitle>
								<SheetDescription>
									{t('platform.toolRunner.description')}
								</SheetDescription>
							</SheetHeader>
							<div className="min-h-0 flex-1 overflow-y-auto py-4">
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
						</SheetContent>
					</Sheet>
				}
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

			<ToolCatalogPanel
				sectionRef={configManagementRef}
				availableToolItems={availableToolItems}
				publishedPlatformAgents={publishedPlatformAgents}
				toolCatalogLoading={toolCatalogLoading}
				toolCatalogError={toolCatalogError}
				onRefetchToolCatalog={onRefetchToolCatalog}
				onRunTool={(toolName) => {
					onSelectedToolNameChange(toolName);
					setRunnerOpen(true);
				}}
				t={t}
			/>
		</PlatformPageShell>
	);
}
