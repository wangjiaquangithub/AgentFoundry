import {
	BotMessageSquare,
	Brain,
	CheckCircle2,
	Database,
	Pencil,
	Play,
	RefreshCcw,
	ShieldCheck,
	UsersRound,
	Workflow,
	Wrench,
} from 'lucide-react';
import { type ComponentType, type RefObject } from 'react';

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
	StateBadge,
	type HealthState,
} from './common';
import { PlatformEmptyState } from './PlatformEmptyState';
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

function readinessStateForAgent(agent: EnterprisePublishedAgent): HealthState {
	if (agent.readiness?.status === 'ready') return 'ready';
	if (agent.readiness?.status === 'blocked') return 'blocked';
	if (agent.readiness?.status === 'partial') return 'partial';
	if (agent.status === 'active') return 'ready';
	if (agent.status === 'archived') return 'blocked';
	return 'todo';
}

function readinessLabelForAgent(agent: EnterprisePublishedAgent, t: Translate) {
	const state = readinessStateForAgent(agent);
	if (state === 'ready') return t('platform.agentManagement.lifecycle.readiness.ready');
	if (state === 'partial')
		return t('platform.agentManagement.lifecycle.readiness.partial');
	if (state === 'blocked')
		return t('platform.agentManagement.lifecycle.readiness.blocked');
	return t('platform.agentManagement.lifecycle.readiness.todo');
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

interface AgentLifecycleWorkspaceProps {
	t: Translate;
	agents: EnterprisePublishedAgent[];
	selectedAgent: EnterprisePublishedAgent | null;
	selectedAgentReadinessState: HealthState;
	selectedAgentReadinessLabel: string;
	selectedAgentModelLabel: string;
	selectedAgentKnowledgeLabels: string[];
	selectedAgentKnowledgeCount: number;
	selectedAgentToolCount: number;
	selectedAgentAccessAllowed: boolean;
	selectedAgentAccessLabel: string;
	onSelectAgent: (agentId: string) => void;
	onRunAgent: () => void;
	onRunWorkflow: (agent: EnterprisePublishedAgent) => void;
	onEditAgent: (agent: EnterprisePublishedAgent) => void;
	onOpenGovernance: () => void;
}

function AgentLifecycleWorkspace({
	t,
	agents,
	selectedAgent,
	selectedAgentReadinessState,
	selectedAgentReadinessLabel,
	selectedAgentModelLabel,
	selectedAgentKnowledgeLabels,
	selectedAgentKnowledgeCount,
	selectedAgentToolCount,
	selectedAgentAccessAllowed,
	selectedAgentAccessLabel,
	onSelectAgent,
	onRunAgent,
	onRunWorkflow,
	onEditAgent,
	onOpenGovernance,
}: AgentLifecycleWorkspaceProps) {
	const selectedAgentCapabilities = selectedAgent?.capabilities ?? [];
	const selectedAgentTools = selectedAgent?.tools ?? [];

	return (
		<section className="grid gap-4 border-y bg-background/70 py-4">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0">
					<h2 className="text-base font-semibold">
						{t('platform.agentManagement.lifecycle.title')}
					</h2>
					<p className="mt-1 text-sm leading-6 text-muted-foreground">
						{t('platform.agentManagement.lifecycle.description')}
					</p>
				</div>
				<Badge variant="outline" className="w-fit">
					{t('platform.agentManagement.lifecycle.onlineAgents', {
						count: agents.length,
					})}
				</Badge>
			</div>

			<div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(18rem,0.42fr)_minmax(0,1fr)]">
				<div className="grid gap-2">
					<div className="text-xs font-medium text-muted-foreground">
						{t('platform.agentManagement.lifecycle.inventory')}
					</div>
					{agents.length === 0 ? (
						<PlatformEmptyState
							variant="noData"
							title={t('platform.agentManagement.lifecycle.emptyTitle')}
							description={t(
								'platform.agentManagement.lifecycle.emptyDescription',
							)}
							className="rounded-lg border border-dashed p-6"
						/>
					) : (
					<div className="grid max-h-[30rem] gap-2 overflow-y-auto pr-1">
							{agents.map((agent) => {
								const isSelected = selectedAgent?.id === agent.id;
								const readinessState = readinessStateForAgent(agent);

								return (
									<button
										key={agent.id}
										type="button"
										onClick={() => onSelectAgent(agent.id)}
										className={cn(
											'grid w-full gap-2 rounded-lg border bg-background/80 p-3 text-left transition-colors',
											'hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
											isSelected && 'border-primary/40 bg-primary/5',
										)}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<div className="truncate text-sm font-medium">
													{agent.name}
												</div>
												<div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
													<UsersRound className="size-3.5 shrink-0" />
													<span className="truncate font-mono">{agent.tenant}</span>
												</div>
											</div>
											<StateBadge
												state={readinessState}
												label={readinessLabelForAgent(agent, t)}
											/>
									</div>
									<div className="grid grid-cols-3 gap-2 text-xs">
										<span className="rounded-md border bg-background px-2 py-1 text-center tabular-nums">
											{t('platform.agentManagement.lifecycle.toolsCount', {
												count: agent.tools.length,
											})}
										</span>
										<span className="rounded-md border bg-background px-2 py-1 text-center tabular-nums">
											{t('platform.agentManagement.lifecycle.knowledgeCount', {
												count: agent.knowledge_base_ids.length,
											})}
										</span>
										<span className="rounded-md border bg-background px-2 py-1 text-center">
											{agent.workflow_enabled
												? t('platform.agentManagement.lifecycle.workflowMode')
												: t('platform.agentManagement.lifecycle.directMode')}
										</span>
									</div>
								</button>
								);
							})}
						</div>
					)}
				</div>

				<div className="grid min-w-0 gap-4 rounded-lg border bg-background/80 p-4">
					{selectedAgent ? (
						<>
							<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<h3 className="truncate text-lg font-semibold">
											{selectedAgent.name}
										</h3>
										<StateBadge
											state={selectedAgentReadinessState}
											label={selectedAgentReadinessLabel}
										/>
									</div>
									<p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
										{selectedAgent.description}
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button type="button" size="sm" onClick={onRunAgent}>
										<Play />
										{t('platform.agentManagement.runAgent')}
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => onEditAgent(selectedAgent)}
									>
										<Pencil />
										{t('platform.agentManagement.edit')}
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => onRunWorkflow(selectedAgent)}
										disabled={!selectedAgent.workflow_enabled}
									>
										<Workflow />
										{t('platform.agentManagement.workflow')}
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={onOpenGovernance}
									>
										<ShieldCheck />
										{t('platform.agentManagement.lifecycle.governance')}
									</Button>
								</div>
							</div>

							<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
								<div className="rounded-lg border bg-background p-3">
									<div className="text-xs text-muted-foreground">
										{t('platform.agentManagement.modelCredential')}
									</div>
									<div className="mt-1 truncate font-mono text-sm">
										{selectedAgentModelLabel}
									</div>
								</div>
								<div className="rounded-lg border bg-background p-3">
									<div className="text-xs text-muted-foreground">
										{t('platform.agentManagement.lifecycle.toolBindings')}
									</div>
									<div className="mt-1 text-sm font-semibold tabular-nums">
										{selectedAgentToolCount}
									</div>
								</div>
								<div className="rounded-lg border bg-background p-3">
									<div className="text-xs text-muted-foreground">
										{t('platform.agentManagement.knowledgeBases')}
									</div>
									<div className="mt-1 text-sm font-semibold tabular-nums">
										{selectedAgentKnowledgeCount}
									</div>
								</div>
								<div className="rounded-lg border bg-background p-3">
									<div className="text-xs text-muted-foreground">
										{t('platform.agentManagement.lifecycle.accessScope')}
									</div>
									<div
										className={cn(
											'mt-1 truncate text-sm font-medium',
											!selectedAgentAccessAllowed && 'text-red-700',
										)}
									>
										{selectedAgentAccessLabel}
									</div>
								</div>
							</div>

							<div className="grid gap-3 lg:grid-cols-2">
								<div className="grid gap-2 rounded-lg border bg-background p-3">
									<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
										<Wrench className="size-4" />
										{t('platform.agentManagement.lifecycle.toolsAndPermissions')}
									</div>
									<div className="flex flex-wrap gap-2">
										{selectedAgentTools.length > 0 ? (
											selectedAgentTools.map((tool) => (
												<Badge
													key={tool}
													variant="outline"
													className="max-w-full truncate font-mono"
													title={tool}
												>
													{tool}
												</Badge>
											))
										) : (
											<span className="text-xs text-muted-foreground">
												{t('platform.agentManagement.lifecycle.noTools')}
											</span>
										)}
									</div>
								</div>
								<div className="grid gap-2 rounded-lg border bg-background p-3">
									<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
										<Database className="size-4" />
										{t('platform.agentManagement.lifecycle.knowledgeAndCapabilities')}
									</div>
									<div className="flex flex-wrap gap-2">
										{selectedAgentKnowledgeLabels.map((knowledge) => (
											<Badge
												key={knowledge}
												variant="outline"
												className="max-w-full truncate"
												title={knowledge}
											>
												{knowledge}
											</Badge>
										))}
										{selectedAgentCapabilities.map((capability) => (
											<Badge
												key={capability}
												variant="secondary"
												className="max-w-full truncate font-mono"
												title={capability}
											>
												{capability}
											</Badge>
										))}
										{selectedAgentKnowledgeLabels.length === 0 &&
										selectedAgentCapabilities.length === 0 ? (
											<span className="text-xs text-muted-foreground">
												{t(
													'platform.agentManagement.lifecycle.noKnowledgeOrCapabilities',
												)}
											</span>
										) : null}
									</div>
								</div>
							</div>

							<div className="flex flex-wrap gap-2 border-t pt-3">
								<Badge variant="outline">
									<Brain className="mr-1 size-3.5" />
									{t('platform.agentManagement.lifecycle.memoryState', {
										state: selectedAgent.memory_enabled
											? t('platform.agentManagement.enabled')
											: t('platform.agentManagement.disabled'),
									})}
								</Badge>
								<Badge variant="outline">
									<Workflow className="mr-1 size-3.5" />
									{t('platform.agentManagement.lifecycle.workflowState', {
										state: selectedAgent.workflow_enabled
											? t('platform.agentManagement.enabled')
											: t('platform.agentManagement.disabled'),
									})}
								</Badge>
								<Badge variant="outline" className="font-mono">
									{selectedAgent.id}
								</Badge>
							</div>
						</>
					) : (
						<PlatformEmptyState
							variant="noData"
							title={t('platform.agentManagement.lifecycle.selectTitle')}
							description={t(
								'platform.agentManagement.lifecycle.selectDescription',
							)}
							className="rounded-lg border border-dashed bg-background p-10"
						/>
					)}
				</div>
			</div>
		</section>
	);
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
	const handleOpenAgentRunner = () => {
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

			<section className="flex flex-wrap items-center gap-2 border-y bg-background/70 py-3 text-sm">
				<div className="flex min-w-0 items-center gap-2 rounded-md bg-background px-3 py-2">
					<BotMessageSquare className="size-4 text-muted-foreground" />
					<span className="text-muted-foreground">
						{t('platform.agentManagement.templates')}
					</span>
					<span className="font-semibold tabular-nums">{agentTemplates.length}</span>
				</div>
				<div className="flex min-w-0 items-center gap-2 rounded-md bg-background px-3 py-2">
					<CheckCircle2 className="size-4 text-muted-foreground" />
					<span className="text-muted-foreground">
						{t('platform.agentRunner.instance')}
					</span>
					<span className="font-semibold tabular-nums">{activeAgentCount}</span>
					<span className="max-w-32 truncate text-xs text-muted-foreground">
						{runnerStateLabel}
					</span>
				</div>
				<div className="flex min-w-0 items-center gap-2 rounded-md bg-background px-3 py-2">
					<Database className="size-4 text-muted-foreground" />
					<span className="text-muted-foreground">
						{t('platform.agentManagement.knowledgeBases')}
					</span>
					<span className="font-semibold tabular-nums">
						{totalKnowledgeBindings}
					</span>
				</div>
				<div className="flex min-w-0 items-center gap-2 rounded-md bg-background px-3 py-2">
					<Wrench className="size-4 text-muted-foreground" />
					<span className="text-muted-foreground">
						{t('platform.agentManagement.tools')}
					</span>
					<span className="font-semibold tabular-nums">{totalToolBindings}</span>
				</div>
			</section>

			<div className="grid min-w-0 gap-4">
				<section className="flex flex-col gap-3 border-b bg-background/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 className="text-base font-semibold">
							{t('platform.agentManagement.opsCenter.title')}
						</h2>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">
							{t('platform.agentManagement.opsCenter.description')}
						</p>
					</div>
					<Button
						size="sm"
						variant="outline"
						onClick={handleOpenAgentRunner}
						disabled={!selectedRunAgent}
					>
						<Play />
						{t('platform.agentManagement.opsCenter.openRunner')}
					</Button>
				</section>

				<section ref={agentManagementRef} className="grid gap-4">
					<AgentLifecycleWorkspace
						t={t}
						agents={activePlatformAgents}
						selectedAgent={selectedRunAgent}
						selectedAgentReadinessState={selectedRunAgentReadinessState}
						selectedAgentReadinessLabel={selectedRunAgentReadinessLabel}
						selectedAgentModelLabel={selectedRunAgentModelLabel}
						selectedAgentKnowledgeLabels={selectedRunAgentKnowledgeLabels}
						selectedAgentKnowledgeCount={selectedRunAgentKnowledgeCount}
						selectedAgentToolCount={selectedRunAgentToolCount}
						selectedAgentAccessAllowed={selectedRunAgentAccessAllowed}
						selectedAgentAccessLabel={selectedRunAgentAccessLabel}
						onSelectAgent={handleSelectRunAgent}
						onRunAgent={handleOpenAgentRunner}
						onRunWorkflow={handlePrimeAgentWorkflow}
						onEditAgent={handleEditAgent}
						onOpenGovernance={scrollToGovernance}
					/>
				</section>

				<details className="group rounded-lg border bg-background/80">
					<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
						<span>{t('platform.agentManagement.configuration')}</span>
						<span className="text-xs text-muted-foreground group-open:hidden">
							{t('platform.agentManagement.configurationCollapsedHint')}
						</span>
						<span className="hidden text-xs text-muted-foreground group-open:inline">
							{t('platform.agentManagement.collapse')}
						</span>
					</summary>
					<div className="grid gap-4 border-t bg-background/80 p-4">
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
				</details>

				<section className="grid gap-3">
					<div className="flex flex-col gap-1">
						<h2 className="text-base font-semibold">
							{t('platform.agentManagement.runnerSection.title')}
						</h2>
						<p className="text-sm leading-6 text-muted-foreground">
							{t('platform.agentManagement.runnerSection.description')}
						</p>
					</div>
					<div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(24rem,0.72fr)]">
						<section ref={agentRunnerRef} className="grid gap-4 rounded-lg border bg-background/80 p-4">
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

						<section className="grid gap-3 rounded-lg border bg-background/80 p-4">
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
				</section>
			</div>
		</PlatformPageShell>
	);
}
