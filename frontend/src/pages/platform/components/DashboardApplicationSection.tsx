// @ts-nocheck

import { AppCenterPanel } from './AppCenterPanel';
import { ScenariosPanel } from './ScenariosPanel';

interface DashboardApplicationSectionProps {
	[key: string]: any;
}

export function DashboardApplicationSection({
	t,
	activePlatformAgents,
	agentResourceText,
	agentTemplates,
	appCenterAgents,
	appCenterDetailIssues,
	appCenterDetailResources,
	appCenterDetailStatus,
	appCenterPrimaryDisabled,
	appCenterPrimaryLabel,
	handleAppCenterDetailPrimaryAction,
	handleAppCenterDetailSecondaryAction,
	handleAppCenterPrimaryAction,
	handleConfigureTemplate,
	handleEditAgent,
	handlePrimeAgentRunner,
	handleRunScenario,
	handleUseApproval,
	inspectedAppCenterAgent,
	inspectedAppCenterTemplate,
	pendingApprovals,
	readyPlatformAgents,
	refetchScenarios,
	runningWorkflow,
	scenarios,
	scenariosError,
	scenariosLoading,
	scrollToAgentManagement,
	scrollToGovernance,
	setSelectedAppCenterItem,
	setSelectedRunAgentId,
}: DashboardApplicationSectionProps) {
	return (
		<>
			<ScenariosPanel
				scenarios={scenarios}
				loading={scenariosLoading}
				error={scenariosError}
				runningWorkflow={runningWorkflow}
				onRefresh={() => void refetchScenarios()}
				onRunScenario={(scenario) => void handleRunScenario(scenario)}
				labels={{
					eyebrow: t('platform.scenarios.eyebrow'),
					title: t('platform.scenarios.title'),
					description: t('platform.scenarios.description'),
					total: (count) => t('platform.scenarios.total', { count }),
					readyCount: (count) => t('platform.scenarios.readyCount', { count }),
					refresh: t('platform.scenarios.refresh'),
					empty: t('platform.scenarios.empty'),
					ready: t('platform.scenarios.ready'),
					partial: t('platform.scenarios.partial'),
					blocked: t('platform.scenarios.blocked'),
					lastRun: (status, time) =>
						t('platform.scenarios.lastRun', { status, time }),
					neverRun: t('platform.scenarios.neverRun'),
					toolCount: (count) => t('platform.scenarios.toolCount', { count }),
					runCount: (count) => t('platform.scenarios.runCount', { count }),
					approvalRequired: t('platform.scenarios.approvalRequired'),
					noApproval: t('platform.scenarios.noApproval'),
					pendingApprovals: (count) =>
						t('platform.scenarios.pendingApprovals', { count }),
					running: t('platform.scenarios.running'),
					run: t('platform.scenarios.run'),
				}}
			/>

			<AppCenterPanel
				agentTemplates={agentTemplates}
				activePlatformAgents={activePlatformAgents}
				readyPlatformAgents={readyPlatformAgents}
				pendingApprovals={pendingApprovals}
				appCenterAgents={appCenterAgents}
				inspectedAppCenterAgent={inspectedAppCenterAgent}
				inspectedAppCenterTemplate={inspectedAppCenterTemplate}
				appCenterPrimaryLabel={appCenterPrimaryLabel}
				appCenterPrimaryDisabled={appCenterPrimaryDisabled}
				appCenterDetailResources={appCenterDetailResources}
				appCenterDetailIssues={appCenterDetailIssues}
				appCenterDetailStatus={appCenterDetailStatus}
				agentResourceText={agentResourceText}
				onOpenGovernance={scrollToGovernance}
				onPrimaryAction={handleAppCenterPrimaryAction}
				setSelectedAppCenterItem={setSelectedAppCenterItem}
				onConfigureTemplate={handleConfigureTemplate}
				onOpenAgentManagement={scrollToAgentManagement}
				setSelectedRunAgentId={setSelectedRunAgentId}
				onPrimeAgentRunner={handlePrimeAgentRunner}
				onEditAgent={handleEditAgent}
				onUseApproval={handleUseApproval}
				onDetailPrimaryAction={handleAppCenterDetailPrimaryAction}
				onDetailSecondaryAction={handleAppCenterDetailSecondaryAction}
				labels={{
					eyebrow: t('platform.appCenter.eyebrow'),
					title: t('platform.appCenter.title'),
					description: t('platform.appCenter.description'),
					reviewApprovals: t('platform.appCenter.reviewApprovals'),
					templates: t('platform.appCenter.templates'),
					emptyTemplates: t('platform.appCenter.emptyTemplates'),
					templateTools: (count) =>
						t('platform.appCenter.templateTools', { count }),
					configureTemplate: t('platform.appCenter.configureTemplate'),
					published: t('platform.appCenter.published'),
					emptyAgents: t('platform.appCenter.emptyAgents'),
					run: t('platform.appCenter.run'),
					fix: t('platform.appCenter.fix'),
					governance: t('platform.appCenter.governance'),
					loopReady: t('platform.appCenter.loopReady'),
					loopNeedsWork: t('platform.appCenter.loopNeedsWork'),
					readyApps: t('platform.appCenter.readyApps'),
					pendingApprovals: t('platform.appCenter.pendingApprovals'),
					emptyApprovals: t('platform.operations.emptyApprovals'),
					selectedAgent: t('platform.appCenter.selectedAgent'),
					selectedTemplate: t('platform.appCenter.selectedTemplate'),
					details: t('platform.appCenter.details'),
					readinessLabel: (state) =>
						t(`platform.agentManagement.readiness.${state}`),
					readyToPublish: t('platform.appCenter.readyToPublish'),
					needsConfiguration: t('platform.appCenter.needsConfiguration'),
					selectToInspect: t('platform.appCenter.selectToInspect'),
					selectToInspectHelper: t('platform.appCenter.selectToInspectHelper'),
					readiness: t('platform.appCenter.readiness'),
					noIssues: t('platform.appCenter.noIssues'),
					runSelected: t('platform.appCenter.runSelected'),
					editConfiguration: t('platform.appCenter.editConfiguration'),
					publishFromTemplate: t('platform.appCenter.publishFromTemplate'),
					viewInManagement: t('platform.appCenter.viewInManagement'),
				}}
			/>
		</>
	);
}
