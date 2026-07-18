import { Boxes } from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';

import type {
	EnterprisePublishedAgent,
	EnterpriseToolCatalogItem,
	EnterpriseToolDecision,
	EnterpriseToolRunResponse,
} from '@/api';
import { ToolCatalogPanel } from './ToolCatalogPanel';
import { ToolRunnerPanel } from './ToolRunnerPanel';
import { StateBadge } from './common';

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
	formatTimestamp: (value?: string) => string;
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
	formatTimestamp,
	t,
}: ToolsViewPageProps) {
	return (
		<main className="h-full overflow-y-auto bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
				<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0">
						<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
							<Boxes className="size-4" />
							<span>{t('platform.toolCatalog.title')}</span>
						</div>
						<h1 className="text-2xl font-semibold tracking-normal">
							{t('platform.toolCatalog.title')}
						</h1>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
							{t('platform.toolCatalog.description')}
						</p>
					</div>
					<div className="grid min-w-0 gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:min-w-80">
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
										? t('platform.connection.partial')
										: t('platform.connection.connected')
								}
							/>
						</div>
					</div>
				</section>

				<ToolCatalogPanel
					sectionRef={configManagementRef}
					availableToolItems={availableToolItems}
					publishedPlatformAgents={publishedPlatformAgents}
					toolCatalogLoading={toolCatalogLoading}
					toolCatalogError={toolCatalogError}
					onRefetchToolCatalog={onRefetchToolCatalog}
					formatTimestamp={formatTimestamp}
					t={t}
				/>

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
		</main>
	);
}
