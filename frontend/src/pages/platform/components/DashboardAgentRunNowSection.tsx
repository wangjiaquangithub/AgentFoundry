// @ts-nocheck

import { AgentRunNowPanel } from './AgentRunNowPanel';

interface DashboardAgentRunNowSectionProps {
	[key: string]: any;
}

export function DashboardAgentRunNowSection({
	t,
	currentIdentityLabel,
	defaultAgentTemplate,
	handlePrimeAgentRunner,
	handleQuickPublishAgent,
	handleStartPublishing,
	platformAgents,
	platformAgentsLoading,
	platformStatus,
	primaryAgentSampleQuestion,
	publishingTemplateId,
	scrollToAgentRunner,
	selectedRunAgent,
	selectedRunAgentKnowledgeCount,
	selectedRunAgentModelLabel,
	selectedRunAgentToolCount,
}: DashboardAgentRunNowSectionProps) {
	return (
		<AgentRunNowPanel
			loading={platformAgentsLoading && !platformAgents}
			selectedRunAgent={selectedRunAgent}
			currentIdentityLabel={currentIdentityLabel}
			selectedRunAgentModelLabel={selectedRunAgentModelLabel}
			selectedRunAgentKnowledgeCount={selectedRunAgentKnowledgeCount}
			selectedRunAgentToolCount={selectedRunAgentToolCount}
			primaryAgentSampleQuestion={primaryAgentSampleQuestion}
			connectorName={platformStatus?.connector.name}
			hasDefaultAgentTemplate={Boolean(defaultAgentTemplate)}
			isPublishingTemplate={Boolean(publishingTemplateId)}
			onPrimeAgentRunner={handlePrimeAgentRunner}
			onScrollToAgentRunner={scrollToAgentRunner}
			onStartPublishing={handleStartPublishing}
			onQuickPublishAgent={() => void handleQuickPublishAgent()}
			labels={{
				eyebrow: t('platform.now.eyebrow'),
				title: t('platform.now.title'),
				description: t('platform.now.description'),
				fillSample: t('platform.now.fillSample'),
				run: t('platform.now.run'),
				publishAgent: t('platform.now.publishAgent'),
				currentAgent: t('platform.now.currentAgent'),
				publishedStatus: t('platform.agentManagement.publishedStatus'),
				sample: t('platform.now.sample'),
				currentUser: t('platform.now.currentUser'),
				model: t('platform.now.model'),
				knowledge: t('platform.now.knowledge'),
				knowledgeCount: (count) =>
					t('platform.agentRunner.knowledgeCount', { count }),
				tools: t('platform.now.tools'),
				toolsCount: (count) => t('platform.agentRunner.toolsCount', { count }),
				memory: t('platform.now.memory'),
				workflow: t('platform.now.workflow'),
				enabled: t('platform.runtime.enabled'),
				disabled: t('platform.runtime.disabled'),
				connector: t('platform.now.connector'),
				unavailable: t('platform.runtime.unavailable'),
				noAgent: t('platform.now.noAgent'),
				noAgentDescription: t('platform.now.noAgentDescription'),
				manualPublish: t('platform.now.manualPublish'),
				publishing: t('platform.agentManagement.publishing'),
				quickPublish: t('platform.now.quickPublish'),
			}}
		/>
	);
}
