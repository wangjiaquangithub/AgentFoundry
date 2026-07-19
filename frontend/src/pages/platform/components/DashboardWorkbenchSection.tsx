// @ts-nocheck

import { BotMessageSquare, Building2, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FirstAgentGuide } from './FirstAgentGuide';
import { RolloutPath } from './RolloutPath';
import { WorkbenchReadinessPanel } from './WorkbenchReadinessPanel';
import { WorkbenchStatusPanel } from './WorkbenchStatusPanel';

interface DashboardWorkbenchSectionProps {
	[key: string]: any;
}

export function DashboardWorkbenchSection({
	t,
	NextStepIcon,
	dashboardTodoItems,
	firstAgentGuidePrimaryStep,
	firstAgentGuideSteps,
	handleNextStepPrimaryAction,
	handleStartPublishing,
	nextStepMode,
	nextStepPrimaryDisabled,
	publishingTemplateId,
	rolloutPathSteps,
	scrollToAgentRunner,
	selectedRunAgent,
	workbenchActions,
	workbenchIndicators,
	workbenchQuickActions,
	workbenchReadinessItems,
	workbenchRiskItems,
}: DashboardWorkbenchSectionProps) {
	return (
		<section className="grid gap-4 rounded-lg border bg-background p-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<Building2 className="size-4" />
						<span>{t('platform.workbench.eyebrow')}</span>
					</div>
					<h2 className="text-base font-semibold">
						{t('platform.workbench.title')}
					</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{t('platform.workbench.description')}
					</p>
				</div>
				<div className="flex flex-wrap gap-2 lg:justify-end">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={handleNextStepPrimaryAction}
						disabled={nextStepPrimaryDisabled}
					>
						<NextStepIcon className="size-4" />
						{t(`platform.nextStep.${nextStepMode}.action`)}
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={selectedRunAgent ? scrollToAgentRunner : handleStartPublishing}
					>
						{selectedRunAgent ? (
							<Play className="size-4" />
						) : (
							<BotMessageSquare className="size-4" />
						)}
						{selectedRunAgent
							? t('platform.workbench.runPrimary')
							: t('platform.workbench.publishPrimary')}
					</Button>
				</div>
			</div>

			<FirstAgentGuide
				steps={firstAgentGuideSteps}
				primaryStep={firstAgentGuidePrimaryStep}
				publishingTemplateId={publishingTemplateId}
				labels={{
					title: t('platform.workbench.firstAgentGuide.title'),
					description: t('platform.workbench.firstAgentGuide.description'),
					publishing: t('platform.agentManagement.publishing'),
					states: {
						ready: t('platform.launchpad.ready'),
						partial: t('platform.launchpad.partial'),
						todo: t('platform.launchpad.todo'),
						blocked: t('platform.launchpad.blocked'),
					},
				}}
			/>

			<RolloutPath
				steps={rolloutPathSteps}
				labels={{
					title: t('platform.workbench.rolloutPath.title'),
					description: t('platform.workbench.rolloutPath.description'),
					progress: t('platform.launchpad.progress', {
						ready: rolloutPathSteps.filter((step) => step.state === 'ready')
							.length,
						total: rolloutPathSteps.length,
					}),
					states: {
						ready: t('platform.launchpad.ready'),
						partial: t('platform.launchpad.partial'),
						todo: t('platform.launchpad.todo'),
						blocked: t('platform.launchpad.blocked'),
					},
				}}
			/>

			<WorkbenchReadinessPanel
				readinessItems={workbenchReadinessItems}
				quickActions={workbenchQuickActions}
				riskItems={workbenchRiskItems}
				labels={{
					readinessTitle: t('platform.workbench.readinessTitle'),
					readinessDescription: t('platform.workbench.readinessDescription'),
					readinessProgress: t('platform.launchpad.progress', {
						ready: workbenchReadinessItems.filter(
							(item) => item.state === 'ready',
						).length,
						total: workbenchReadinessItems.length,
					}),
					quickActionsTitle: t('platform.workbench.quickActionsTitle'),
					riskTitle: t('platform.workbench.riskTitle'),
					riskEmpty: t('platform.workbench.riskEmpty'),
					states: {
						ready: t('platform.launchpad.ready'),
						partial: t('platform.launchpad.partial'),
						todo: t('platform.launchpad.todo'),
						blocked: t('platform.launchpad.blocked'),
					},
				}}
			/>

			<WorkbenchStatusPanel
				indicators={workbenchIndicators}
				actions={workbenchActions}
				labels={{
					statusTitle: t('platform.workbench.statusTitle'),
					statusDescription:
						dashboardTodoItems.length > 0
							? dashboardTodoItems.join(' · ')
							: t('platform.dashboard.todoReady'),
					statusState: dashboardTodoItems.length > 0 ? 'partial' : 'ready',
					statusStateLabel:
						dashboardTodoItems.length > 0
							? t('platform.workbench.needsAction')
							: t('platform.workbench.ready'),
					states: {
						ready: t('platform.launchpad.ready'),
						partial: t('platform.launchpad.partial'),
						todo: t('platform.launchpad.todo'),
						blocked: t('platform.launchpad.blocked'),
					},
				}}
			/>
		</section>
	);
}
