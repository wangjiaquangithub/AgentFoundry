import { BotMessageSquare, Play, RefreshCcw } from 'lucide-react';
import type { ComponentType, RefObject } from 'react';

import type {
	EnterpriseAgentRunResponse,
	EnterpriseAgentTemplate,
	EnterpriseAgentToolCall,
	EnterprisePublishedAgent,
	KnowledgeBaseView,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
	AgentManagementOverview,
	AgentTemplateList,
} from './AgentManagementOverview';
import {
	AgentRunnerConversation,
	type AgentRunnerConversationTurn,
} from './AgentRunnerConversation';
import { AgentRunnerResult } from './AgentRunnerResult';
import { PlatformNotice, type HealthState } from './common';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface AgentOpsSummaryItem {
	label: string;
	value: number;
	helper: string;
}

interface AgentReleasePipelineStep {
	key: string;
	title: string;
	detail: string;
	state: HealthState;
	icon: ComponentType<{ className?: string }>;
}

interface AgentsViewPageProps {
	t: Translate;
	platformAgentsError: string | null;
	platformAgentsLoading: boolean;
	platformAgents: unknown;
	agentManagementRef: RefObject<HTMLElement | null>;
	agentTemplateStepRef: RefObject<HTMLDivElement | null>;
	agentRunnerRef: RefObject<HTMLElement | null>;
	agentOpsSummary: AgentOpsSummaryItem[];
	agentReleasePipeline: AgentReleasePipelineStep[];
	nextAgentSetupStep: { title: string } | null;
	selectedRunAgent: EnterprisePublishedAgent | null;
	selectedRunAgentReadinessState: HealthState;
	selectedRunAgentReadinessLabel: string;
	selectedRunAgentModelLabel: string;
	selectedRunAgentKnowledgeCount: number;
	selectedRunAgentKnowledgeLabels: string[];
	selectedRunAgentToolCount: number;
	selectedRunAgentAccessAllowed: boolean;
	selectedRunAgentAccessLabel: string;
	agentTemplates: EnterpriseAgentTemplate[];
	selectedTemplateId: string | null;
	publishingTemplateId: string | null;
	activePlatformAgents: EnterprisePublishedAgent[];
	selectedRunAgentId: string;
	agentQuestion: string;
	agentApprovalId: string;
	agentSampleQuestions: string[];
	selectedAgentConversation: AgentRunnerConversationTurn[];
	agentRunResult: EnterpriseAgentRunResponse | null;
	agentRunsLoading: boolean;
	agentRunsError: string | null;
	runningAgent: boolean;
	agentRunError: string | null;
	agentToolCalls: EnterpriseAgentToolCall[];
	agentToolCallBadgeText: string;
	agentRoutingLabel?: string | null;
	agentRoutingText?: string | null;
	agentRunConnectorSourceText?: string | null;
	agentRunModelLabel: string;
	agentRunKnowledgeLabels: string[];
	knowledgeBaseById: Map<string, KnowledgeBaseView>;
	refetchPlatformAgents: () => Promise<unknown>;
	scrollToAgentRunner: () => void;
	handleNextAgentSetupStep: () => void;
	handlePrimeAgentWorkflow: (agent: EnterprisePublishedAgent) => void;
	handleEditAgent: (agent: EnterprisePublishedAgent) => void;
	scrollToGovernance: () => void;
	handleConfigureTemplate: (template: EnterpriseAgentTemplate) => void;
	handleSelectRunAgent: (agentId: string) => void;
	setAgentQuestion: (value: string) => void;
	setAgentRunError: (value: string | null) => void;
	setAgentApprovalId: (value: string) => void;
	handleClearAgentConversation: () => void;
	handleSelectAgentRun: (turn: AgentRunnerConversationTurn) => Promise<void> | void;
	handleRunEnterpriseAgent: () => Promise<void> | void;
	handleInspectAgentRunAudit: () => void;
}

export function AgentsViewPage({
	t,
	platformAgentsError,
	platformAgentsLoading,
	platformAgents,
	agentManagementRef,
	agentTemplateStepRef,
	agentRunnerRef,
	agentOpsSummary,
	agentReleasePipeline,
	nextAgentSetupStep,
	selectedRunAgent,
	selectedRunAgentReadinessState,
	selectedRunAgentReadinessLabel,
	selectedRunAgentModelLabel,
	selectedRunAgentKnowledgeCount,
	selectedRunAgentKnowledgeLabels,
	selectedRunAgentToolCount,
	selectedRunAgentAccessAllowed,
	selectedRunAgentAccessLabel,
	agentTemplates,
	selectedTemplateId,
	publishingTemplateId,
	activePlatformAgents,
	selectedRunAgentId,
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
	refetchPlatformAgents,
	scrollToAgentRunner,
	handleNextAgentSetupStep,
	handlePrimeAgentWorkflow,
	handleEditAgent,
	scrollToGovernance,
	handleConfigureTemplate,
	handleSelectRunAgent,
	setAgentQuestion,
	setAgentRunError,
	setAgentApprovalId,
	handleClearAgentConversation,
	handleSelectAgentRun,
	handleRunEnterpriseAgent,
	handleInspectAgentRunAudit,
}: AgentsViewPageProps) {
	return (
		<main className="h-full overflow-y-auto bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
				<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0">
						<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
							<BotMessageSquare className="size-4" />
							<span>{t('platform.agentManagement.title')}</span>
						</div>
						<h1 className="text-2xl font-semibold tracking-normal">
							{t('platform.agentManagement.title')}
						</h1>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
							{t('platform.agentManagement.description')}
						</p>
					</div>
					<div className="flex flex-wrap gap-2 lg:justify-end">
						<Button
							size="sm"
							variant="outline"
							onClick={() => void refetchPlatformAgents()}
							disabled={platformAgentsLoading}
						>
							<RefreshCcw className={cn(platformAgentsLoading && 'animate-spin')} />
							{t('platform.actions.refreshStatus')}
						</Button>
						<Button
							size="sm"
							onClick={scrollToAgentRunner}
							disabled={!selectedRunAgent}
						>
							<Play />
							{t('platform.agentManagement.runAgent')}
						</Button>
					</div>
				</section>

				{platformAgentsError ? (
					<PlatformNotice>{t('platform.agentManagement.loadError')}</PlatformNotice>
				) : null}

				<section ref={agentManagementRef} className="grid gap-6">
					<AgentManagementOverview
						agentOpsSummary={agentOpsSummary}
						agentReleasePipeline={agentReleasePipeline}
						nextAgentSetupStep={nextAgentSetupStep}
						selectedRunAgent={selectedRunAgent}
						selectedRunAgentReadinessState={selectedRunAgentReadinessState}
						selectedRunAgentReadinessLabel={selectedRunAgentReadinessLabel}
						selectedRunAgentModelLabel={selectedRunAgentModelLabel}
						selectedRunAgentKnowledgeCount={selectedRunAgentKnowledgeCount}
						selectedRunAgentToolCount={selectedRunAgentToolCount}
						labels={{
							pipelineTitle: t('platform.agentManagement.pipeline.title'),
							pipelineDescription: t('platform.agentManagement.pipeline.description'),
							nextAction: t('platform.agentManagement.wizard.nextAction'),
							readyAction: t('platform.agentManagement.wizard.readyAction'),
							noRuntimeAgent: t('platform.agentManagement.ops.noRuntimeAgent'),
							noRuntimeAgentHint: t('platform.agentManagement.ops.noRuntimeAgentHint'),
							modelCredential: t('platform.agentManagement.modelCredential'),
							knowledgeBases: t('platform.agentManagement.knowledgeBases'),
							tools: t('platform.agentManagement.tools'),
							memory: t('platform.agentManagement.memory'),
							workflow: t('platform.agentManagement.workflow'),
							enabled: t('platform.agentManagement.enabled'),
							disabled: t('platform.agentManagement.disabled'),
							runAgent: t('platform.agentManagement.runAgent'),
							runWorkflow: t('platform.agentManagement.runWorkflow'),
							edit: t('platform.agentManagement.edit'),
							openGovernance: t('platform.agentManagement.ops.openGovernance'),
							states: {
								ready: t('platform.agentManagement.wizard.states.ready'),
								partial: t('platform.agentManagement.wizard.states.partial'),
								todo: t('platform.agentManagement.wizard.states.todo'),
								blocked: t('platform.agentManagement.wizard.states.blocked'),
							},
						}}
						onNextAgentSetupStep={handleNextAgentSetupStep}
						onRunAgent={scrollToAgentRunner}
						onRunWorkflow={handlePrimeAgentWorkflow}
						onEditAgent={handleEditAgent}
						onOpenGovernance={scrollToGovernance}
					/>
				</section>

				<section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
					<div ref={agentTemplateStepRef} className="grid gap-3">
						<AgentTemplateList
							templates={agentTemplates}
							selectedTemplateId={selectedTemplateId}
							loading={platformAgentsLoading}
							hasLoaded={Boolean(platformAgents)}
							publishingTemplateId={publishingTemplateId}
							labels={{
								title: t('platform.agentManagement.templates'),
								empty: t('platform.agentManagement.emptyTemplates'),
								configure: t('platform.agentManagement.configureTemplate'),
							}}
							onConfigureTemplate={handleConfigureTemplate}
						/>
					</div>

					<section ref={agentRunnerRef} className="grid gap-4 rounded-lg border bg-muted/10 p-4">
						<div className="flex items-start gap-2">
							<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
								<BotMessageSquare className="size-4 text-muted-foreground" />
							</div>
							<div className="min-w-0">
								<h2 className="text-base font-semibold">
									{t('platform.agentRunner.title')}
								</h2>
								<p className="text-sm text-muted-foreground">
									{t('platform.agentRunner.description')}
								</p>
							</div>
						</div>

						<div className="grid gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								{t('platform.agentRunner.instance')}
							</label>
							<Select
								value={selectedRunAgentId}
								onValueChange={handleSelectRunAgent}
								disabled={activePlatformAgents.length === 0}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder={t('platform.agentRunner.selectInstance')} />
								</SelectTrigger>
								<SelectContent>
									{activePlatformAgents.map((agent) => (
										<SelectItem key={agent.id} value={agent.id}>
											{agent.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{activePlatformAgents.length === 0 ? (
							<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
								{t('platform.agentRunner.noInstances')}
							</div>
						) : selectedRunAgent ? (
							<div className="flex flex-wrap gap-2">
								<Badge variant="outline" className="max-w-full font-mono">
									{selectedRunAgent.tenant}
								</Badge>
								<Badge variant="outline" className="max-w-full truncate">
									{t('platform.agentManagement.modelCredential')}: {selectedRunAgentModelLabel}
								</Badge>
								<Badge variant="outline">
									{t('platform.agentRunner.knowledgeCount', {
										count: selectedRunAgentKnowledgeLabels.length,
									})}
								</Badge>
								<Badge variant="outline">
									{t('platform.agentRunner.toolsCount', {
										count: selectedRunAgentToolCount,
									})}
								</Badge>
								<Badge
									variant="outline"
									className={cn(
										!selectedRunAgentAccessAllowed &&
											'border-red-500/30 bg-red-500/10 text-red-700',
									)}
								>
									{selectedRunAgentAccessLabel}
								</Badge>
							</div>
						) : null}

						<div className="grid gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								{t('platform.agentRunner.question')}
							</label>
							<Textarea
								value={agentQuestion}
								onChange={(event) => {
									setAgentQuestion(event.target.value);
									setAgentRunError(null);
								}}
								placeholder={t('platform.agentRunner.placeholder')}
								className="min-h-28 resize-y"
							/>
						</div>

						<div className="grid gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								{t('platform.agentRunner.approvalId')}
							</label>
							<Input
								value={agentApprovalId}
								onChange={(event) => {
									setAgentApprovalId(event.target.value);
									setAgentRunError(null);
								}}
								placeholder={t('platform.agentRunner.approvalIdPlaceholder')}
								className="font-mono"
							/>
						</div>

						<div className="grid gap-2">
							<div className="text-xs font-medium text-muted-foreground">
								{t('platform.agentRunner.samples')}
							</div>
							<div className="flex flex-wrap gap-2">
								{agentSampleQuestions.map((sample) => (
									<Button
										key={sample}
										type="button"
										size="sm"
										variant="outline"
										onClick={() => {
											setAgentQuestion(sample);
											setAgentRunError(null);
										}}
									>
										{sample}
									</Button>
								))}
							</div>
						</div>

						<AgentRunnerConversation
							turns={selectedAgentConversation}
							activeResponse={agentRunResult}
							loading={agentRunsLoading}
							error={agentRunsError}
							labels={{
								title: t('platform.agentRunner.conversation'),
								clear: t('platform.agentRunner.clearConversation'),
								loading: t('common.loading'),
								empty: t('platform.agentRunner.conversationEmpty'),
								selectedTool: t('platform.agentRunner.selectedTool'),
								notRouted: t('platform.agentRunner.notRouted'),
							}}
							onClear={handleClearAgentConversation}
							onSelectTurn={(turn) => void handleSelectAgentRun(turn)}
						/>

						<div className="flex justify-end">
							<Button
								onClick={handleRunEnterpriseAgent}
								disabled={
									runningAgent ||
									!agentQuestion.trim() ||
									!selectedRunAgentId ||
									!selectedRunAgentAccessAllowed
								}
							>
								<Play className={cn(runningAgent && 'animate-pulse')} />
								{runningAgent
									? t('platform.agentRunner.running')
									: t('platform.agentRunner.run')}
							</Button>
						</div>

						{agentRunError ? (
							<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
								{t('platform.agentRunner.error')} {agentRunError}
							</div>
						) : null}
					</section>
				</section>

				<section className="grid gap-3">
					<AgentRunnerResult
						result={agentRunResult}
						toolCalls={agentToolCalls}
						toolCallBadgeText={agentToolCallBadgeText}
						routingLabel={agentRoutingLabel}
						routingText={agentRoutingText}
						connectorSourceText={agentRunConnectorSourceText}
						modelLabel={agentRunModelLabel}
						knowledgeLabels={agentRunKnowledgeLabels}
						knowledgeBaseById={knowledgeBaseById}
						onInspectAudit={handleInspectAgentRunAudit}
						t={t}
					/>
				</section>
			</div>
		</main>
	);
}
