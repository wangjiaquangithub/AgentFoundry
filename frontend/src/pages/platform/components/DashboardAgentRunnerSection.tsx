// @ts-nocheck

import { AgentRunnerPanel } from './AgentRunnerPanel';

interface DashboardAgentRunnerSectionProps {
	[key: string]: any;
}

export function DashboardAgentRunnerSection({
	t,
	agentRunnerRef,
	activePlatformAgents,
	selectedRunAgent,
	selectedRunAgentId,
	selectedRunAgentModelLabel,
	selectedRunAgentKnowledgeLabels,
	selectedRunAgentToolCount,
	selectedRunAgentAccessAllowed,
	selectedRunAgentAccessLabel,
	lastPublishedAgent,
	agentQuestion,
	agentApprovalId,
	agentSampleQuestions,
	selectedAgentConversation,
	agentRunResult,
	agentRunsLoading,
	agentRunsError,
	runningAgent,
	agentRunError,
	agentToolCalls,
	agentToolCallBadgeText,
	agentRoutingLabel,
	agentRoutingText,
	agentRunConnectorSourceText,
	agentRunModelLabel,
	agentRunKnowledgeLabels,
	knowledgeBaseById,
	handleSelectRunAgent,
	setAgentQuestion,
	setAgentRunError,
	setAgentApprovalId,
	handleRunEnterpriseAgent,
	handleClearAgentConversation,
	handleSelectAgentRun,
	handleInspectAgentRunAudit,
	scrollToGovernance,
}: DashboardAgentRunnerSectionProps) {
	return (
		<AgentRunnerPanel
			sectionRef={agentRunnerRef}
			agents={activePlatformAgents}
			selectedAgent={selectedRunAgent}
			selectedAgentId={selectedRunAgentId}
			selectedAgentModelLabel={selectedRunAgentModelLabel}
			selectedAgentKnowledgeLabels={selectedRunAgentKnowledgeLabels}
			selectedAgentToolCount={selectedRunAgentToolCount}
			selectedAgentAccessAllowed={selectedRunAgentAccessAllowed}
			selectedAgentAccessLabel={selectedRunAgentAccessLabel}
			lastPublishedAgent={lastPublishedAgent}
			question={agentQuestion}
			approvalId={agentApprovalId}
			sampleQuestions={agentSampleQuestions}
			conversation={selectedAgentConversation}
			activeResult={agentRunResult}
			conversationLoading={agentRunsLoading}
			conversationError={agentRunsError}
			running={runningAgent}
			runError={agentRunError}
			resultToolCalls={agentToolCalls}
			resultToolCallBadgeText={agentToolCallBadgeText}
			resultRoutingLabel={agentRoutingLabel}
			resultRoutingText={agentRoutingText}
			resultConnectorSourceText={agentRunConnectorSourceText}
			resultModelLabel={agentRunModelLabel}
			resultKnowledgeLabels={agentRunKnowledgeLabels}
			knowledgeBaseById={knowledgeBaseById}
			onSelectAgent={handleSelectRunAgent}
			onQuestionChange={(value) => {
				setAgentQuestion(value);
				setAgentRunError(null);
			}}
			onApprovalIdChange={(value) => {
				setAgentApprovalId(value);
				setAgentRunError(null);
			}}
			onRun={handleRunEnterpriseAgent}
			onClearConversation={handleClearAgentConversation}
			onSelectConversationTurn={(turn) => {
				void handleSelectAgentRun(turn as never);
			}}
			onInspectAudit={handleInspectAgentRunAudit}
			onOpenGovernance={scrollToGovernance}
			t={t}
		/>
	);
}
