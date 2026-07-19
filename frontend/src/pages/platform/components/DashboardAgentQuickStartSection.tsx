// @ts-nocheck

import { AgentQuickStartPanel } from './AgentQuickStartPanel';

interface DashboardAgentQuickStartSectionProps {
	[key: string]: any;
}

export function DashboardAgentQuickStartSection({
	t,
	agentsLoading,
	featuredAgents,
	navigate,
}: DashboardAgentQuickStartSectionProps) {
	return (
		<AgentQuickStartPanel
			agentsLoading={agentsLoading}
			featuredAgents={featuredAgents}
			onNavigate={navigate}
			labels={{
				agentsTitle: t('platform.agents.title'),
				agentsDescription: t('platform.agents.description'),
				openChat: t('platform.actions.openChat'),
				emptyAgents: t('platform.agents.empty'),
				noPrompt: t('platform.agents.noPrompt'),
				openAgent: t('platform.actions.openAgent'),
				editable: t('platform.agents.editable'),
				readOnly: t('common.readOnly'),
				invitable: t('platform.agents.invitable'),
				quickActionsTitle: t('platform.quickActions.title'),
				quickActionsDescription: t('platform.quickActions.description'),
				configureModel: t('platform.actions.configureModel'),
				manageKnowledge: t('platform.actions.manageKnowledge'),
				manageWorkflow: t('platform.actions.manageWorkflow'),
			}}
		/>
	);
}
