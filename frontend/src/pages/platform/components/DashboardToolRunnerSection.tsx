// @ts-nocheck

import { ToolRunnerPanel } from './ToolRunnerPanel';

interface DashboardToolRunnerSectionProps {
	[key: string]: any;
}

export function DashboardToolRunnerSection({
	t,
	toolRunnerRef,
	selectedToolName,
	availableToolItems,
	toolCatalogLoading,
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
	setSelectedToolName,
	setToolRunError,
	setToolInputs,
	setToolApprovalId,
	handleCreateRunApproval,
	handleRunEnterpriseTool,
}: DashboardToolRunnerSectionProps) {
	return (
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
			onSelectedToolNameChange={setSelectedToolName}
			onToolRunErrorChange={setToolRunError}
			onToolInputsChange={setToolInputs}
			onToolApprovalIdChange={setToolApprovalId}
			onCreateRunApproval={handleCreateRunApproval}
			onRunEnterpriseTool={handleRunEnterpriseTool}
			t={t}
		/>
	);
}
