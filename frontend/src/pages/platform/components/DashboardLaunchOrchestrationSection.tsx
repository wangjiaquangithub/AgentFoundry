// @ts-nocheck

import { LaunchpadPanel } from './LaunchpadPanel';
import { OrchestrationWorkbenchPanel } from './OrchestrationWorkbenchPanel';

interface DashboardLaunchOrchestrationSectionProps {
	[key: string]: any;
}

export function DashboardLaunchOrchestrationSection({
	t,
	activePlatformAgents,
	launchpadPrimaryStep,
	launchpadReadyCount,
	launchpadState,
	launchpadSteps,
	launchpadTotalCount,
	memoryOperationsRef,
	orchestrationPrimaryStep,
	orchestrationReadyCount,
	orchestrationWorkbenchSteps,
	pendingApprovals,
}: DashboardLaunchOrchestrationSectionProps) {
	return (
		<>
			<LaunchpadPanel
				steps={launchpadSteps}
				primaryStep={launchpadPrimaryStep}
				labels={{
					title: t('platform.launchpad.title'),
					description: t('platform.launchpad.description'),
					state: launchpadState,
					stateLabel: t(`platform.launchpad.${launchpadState}`),
					progress: t('platform.launchpad.progress', {
						ready: launchpadReadyCount,
						total: launchpadTotalCount,
					}),
					primaryAction: t('platform.launchpad.primaryAction', {
						action: launchpadPrimaryStep.actionLabel,
					}),
					states: {
						ready: t('platform.launchpad.ready'),
						partial: t('platform.launchpad.partial'),
						todo: t('platform.launchpad.todo'),
						blocked: t('platform.launchpad.blocked'),
					},
				}}
			/>

			<OrchestrationWorkbenchPanel
				sectionRef={memoryOperationsRef}
				steps={orchestrationWorkbenchSteps}
				primaryStep={orchestrationPrimaryStep}
				labels={{
					eyebrow: t('platform.orchestration.eyebrow'),
					title: t('platform.orchestration.title'),
					description: t('platform.orchestration.description'),
					progress: t('platform.orchestration.progress', {
						ready: orchestrationReadyCount,
						total: orchestrationWorkbenchSteps.length,
					}),
					agents: t('platform.orchestration.agents', {
						count: activePlatformAgents.length,
					}),
					approvals: t('platform.orchestration.approvals', {
						count: pendingApprovals.length,
					}),
					primaryAction: t('platform.orchestration.primaryAction', {
						action: orchestrationPrimaryStep.actionLabel,
					}),
					step: (index) => t('platform.orchestration.step', { index }),
					states: {
						ready: t('platform.agentManagement.wizard.states.ready'),
						partial: t('platform.agentManagement.wizard.states.partial'),
						todo: t('platform.agentManagement.wizard.states.todo'),
						blocked: t('platform.agentManagement.wizard.states.blocked'),
					},
				}}
			/>
		</>
	);
}
