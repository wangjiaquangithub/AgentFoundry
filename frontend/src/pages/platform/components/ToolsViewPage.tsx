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
import {
	PlatformConnectionCard,
	PlatformPageHeader,
	PlatformPageShell,
} from './common';

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

				<ToolCatalogPanel
					sectionRef={configManagementRef}
					availableToolItems={availableToolItems}
					publishedPlatformAgents={publishedPlatformAgents}
					toolCatalogLoading={toolCatalogLoading}
					toolCatalogError={toolCatalogError}
					onRefetchToolCatalog={onRefetchToolCatalog}
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
		</PlatformPageShell>
	);
}
