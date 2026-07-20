import { BotMessageSquare, CheckCircle2, Database, Play, RefreshCcw, Wrench } from 'lucide-react';
import { useState, type ComponentType, type RefObject } from 'react';

import {
	AgentManagementOverview,
	AgentTemplateList,
} from './AgentManagementOverview';
import {
	AgentRunnerConversation,
	type AgentRunnerConversationTurn,
} from './AgentRunnerConversation';
import { AgentRunnerResult } from './AgentRunnerResult';
import {
	PlatformNotice,
	PlatformPageHeader,
	PlatformPageShell,
	type HealthState,
} from './common';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;
type AgentWorkspaceTab = 'manage' | 'run';

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
	const activeAgentCount = activePlatformAgents.length;
	const totalToolBindings = activePlatformAgents.reduce(
		(total, agent) => total + agent.tools.length,
		0,
	);
	const totalKnowledgeBindings = activePlatformAgents.reduce(
		(total, agent) => total + agent.knowledge_base_ids.length,
		0,
	);
	const runnerStateLabel = selectedRunAgent
		? selectedRunAgentReadinessLabel
		: t('platform.agentRunner.noInstances');
	const [agentWorkspaceTab, setAgentWorkspaceTab] =
		useState<AgentWorkspaceTab>('manage');
	const handleOpenAgentRunner = () => {
		setAgentWorkspaceTab('run');
		window.setTimeout(scrollToAgentRunner, 0);
	};

	return (
		<PlatformPageShell>
			<PlatformPageHeader
				icon={BotMessageSquare}
				eyebrow={t('platform.agentManagement.title')}
				title={t('platform.agentManagement.title')}
				description={t('platform.agentManagement.description')}
				actions={
					<>
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
							onClick={handleOpenAgentRunner}
							disabled={!selectedRunAgent}
						>
							<Play />
							{t('platform.agentManagement.runAgent')}
						</Button>
					</>
				}
			/>

			{platformAgentsError ? (
				<PlatformNotice>{t('platform.agentManagement.loadError')}</PlatformNotice>
			) : null}

			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-lg border bg-background p-4 shadow-sm">
					<div className="flex items-center justify-between gap-3">
						<span className="text-sm font-medium text-muted-foreground">
							{t('platform.agentManagement.templates')}
						</span>
						<BotMessageSquare className="size-4 text-muted-foreground" />
					</div>
					<div className="mt-3 text-2xl font-semibold tabular-nums">
						{agentTemplates.length}
					</div>
					<p className="mt-1 truncate text-xs text-muted-foreground">
						{t('platform.agentManagement.configure')}
					</p>
				</div>
				<div className="rounded-lg border bg-background p-4 shadow-sm">
					<div className="flex items-center justify-between gap-3">
						<span className="text-sm font-medium text-muted-foreground">
							{t('platform.agentRunner.instance')}
						</span>
						<CheckCircle2 className="size-4 text-muted-foreground" />
					</div>
					<div className="mt-3 text-2xl font-semibold tabular-nums">
						{activeAgentCount}
					</div>
					<p className="mt-1 truncate text-xs text-muted-foreground">
						{runnerStateLabel}
					</p>
				</div>
				<div className="rounded-lg border bg-background p-4 shadow-sm">
					<div className="flex items-center justify-between gap-3">
						<span className="text-sm font-medium text-muted-foreground">
							{t('platform.agentManagement.knowledgeBases')}
						</span>
						<Database className="size-4 text-muted-foreground" />
					</div>
					<div className="mt-3 text-2xl font-semibold tabular-nums">
						{totalKnowledgeBindings}
					</div>
					<p className="mt-1 truncate text-xs text-muted-foreground">
						{t('platform.agentRunner.knowledgeCount', {
							count: selectedRunAgentKnowledgeCount,
						})}
					</p>
				</div>
				<div className="rounded-lg border bg-background p-4 shadow-sm">
					<div className="flex items-center justify-between gap-3">
						<span className="text-sm font-medium text-muted-foreground">
							{t('platform.agentManagement.tools')}
						</span>
						<Wrench className="size-4 text-muted-foreground" />
					</div>
					<div className="mt-3 text-2xl font-semibold tabular-nums">
						{totalToolBindings}
					</div>
					<p className="mt-1 truncate text-xs text-muted-foreground">
						{t('platform.agentRunner.toolsCount', {
							count: selectedRunAgentToolCount,
						})}
					</p>
				</div>
			</section>

			<Tabs
				value={agentWorkspaceTab}
				onValueChange={(value) => setAgentWorkspaceTab(value as AgentWorkspaceTab)}
				className="grid gap-4"
			>
				<section className="flex flex-col gap-3 rounded-lg border bg-background p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 className="text-base font-semibold">Agent 工作区</h2>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">
							编排配置和运行调试分区处理，避免模板、发布状态、对话测试和结果审计挤在同一个长页面里。
						</p>
					</div>
					<TabsList className="w-full sm:w-auto">
						<TabsTrigger value="manage" className="flex-1 sm:flex-none">
							编排管理
						</TabsTrigger>
						<TabsTrigger value="run" className="flex-1 sm:flex-none">
							运行调试
						</TabsTrigger>
					</TabsList>
				</section>

				<TabsContent value="manage" className="mt-0">
					<div className="grid min-w-0 gap-4">
						<section ref={agentManagementRef} className="grid gap-4">
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
								onRunAgent={handleOpenAgentRunner}
								onRunWorkflow={handlePrimeAgentWorkflow}
								onEditAgent={handleEditAgent}
								onOpenGovernance={scrollToGovernance}
							/>
						</section>

						<section ref={agentTemplateStepRef} className="grid gap-3">
							<AgentTemplateList
								templates={agentTemplates}
								selectedTemplateId={selectedTemplateId}
								loading={platformAgentsLoading}
								hasLoaded={Boolean(platformAgents)}
								publishingTemplateId={publishingTemplateId}
								labels={{
									title: t('platform.agentManagement.templates'),
									empty: t('platform.agentManagement.emptyTemplates'),
									configure: t('platform.agentManagement.configure'),
								}}
								onConfigureTemplate={handleConfigureTemplate}
							/>
						</section>
					</div>
				</TabsContent>

				<TabsContent value="run" className="mt-0">
					<div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(24rem,0.72fr)]">
						<section ref={agentRunnerRef} className="grid gap-4 rounded-lg border bg-muted/10 p-4 shadow-sm">
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

						<section className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm">
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
				</TabsContent>
			</Tabs>
		</PlatformPageShell>
	);
}
