import { BotMessageSquare, Play, ShieldCheck } from 'lucide-react';
import type { RefObject } from 'react';

import type {
	EnterpriseAgentRunResponse,
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
	AgentRunnerConversation,
	type AgentRunnerConversationTurn,
} from './AgentRunnerConversation';
import { AgentRunnerResult } from './AgentRunnerResult';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface AgentRunnerPanelProps {
	sectionRef: RefObject<HTMLElement | null>;
	agents: EnterprisePublishedAgent[];
	selectedAgent: EnterprisePublishedAgent | null | undefined;
	selectedAgentId: string;
	selectedAgentModelLabel: string;
	selectedAgentKnowledgeLabels: string[];
	selectedAgentToolCount: number;
	selectedAgentAccessAllowed: boolean;
	selectedAgentAccessLabel: string;
	lastPublishedAgent: EnterprisePublishedAgent | null;
	question: string;
	approvalId: string;
	sampleQuestions: string[];
	conversation: AgentRunnerConversationTurn[];
	activeResult: EnterpriseAgentRunResponse | null;
	conversationLoading: boolean;
	conversationError: string | null;
	running: boolean;
	runError: string | null;
	resultToolCalls: EnterpriseAgentToolCall[];
	resultToolCallBadgeText: string;
	resultRoutingLabel?: string | null;
	resultRoutingText?: string | null;
	resultConnectorSourceText?: string | null;
	resultModelLabel: string;
	resultKnowledgeLabels: string[];
	knowledgeBaseById: Map<string, KnowledgeBaseView>;
	onSelectAgent: (agentId: string) => void;
	onQuestionChange: (value: string) => void;
	onApprovalIdChange: (value: string) => void;
	onRun: () => void;
	onClearConversation: () => void;
	onSelectConversationTurn: (turn: AgentRunnerConversationTurn) => void;
	onInspectAudit: () => void;
	onOpenGovernance: () => void;
	t: Translate;
}

export function AgentRunnerPanel({
	sectionRef,
	agents,
	selectedAgent,
	selectedAgentId,
	selectedAgentModelLabel,
	selectedAgentKnowledgeLabels,
	selectedAgentToolCount,
	selectedAgentAccessAllowed,
	selectedAgentAccessLabel,
	lastPublishedAgent,
	question,
	approvalId,
	sampleQuestions,
	conversation,
	activeResult,
	conversationLoading,
	conversationError,
	running,
	runError,
	resultToolCalls,
	resultToolCallBadgeText,
	resultRoutingLabel,
	resultRoutingText,
	resultConnectorSourceText,
	resultModelLabel,
	resultKnowledgeLabels,
	knowledgeBaseById,
	onSelectAgent,
	onQuestionChange,
	onApprovalIdChange,
	onRun,
	onClearConversation,
	onSelectConversationTurn,
	onInspectAudit,
	onOpenGovernance,
	t,
}: AgentRunnerPanelProps) {
	return (
		<section
			ref={sectionRef}
			className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]"
		>
			<div className="flex flex-col gap-3">
				<div className="flex items-start gap-2">
					<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/20">
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

				<div className="grid gap-4 rounded-lg border bg-muted/10 p-4">
					<div className="grid gap-2">
						<label className="text-xs font-medium text-muted-foreground">
							{t('platform.agentRunner.instance')}
						</label>
						<Select
							value={selectedAgentId}
							onValueChange={onSelectAgent}
							disabled={agents.length === 0}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder={t('platform.agentRunner.selectInstance')} />
							</SelectTrigger>
							<SelectContent>
								{agents.map((agent) => (
									<SelectItem key={agent.id} value={agent.id}>
										{agent.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{agents.length === 0 ? (
							<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
								{t('platform.agentRunner.noInstances')}
							</div>
						) : selectedAgent ? (
							<div className="grid gap-3">
								<div className="flex flex-wrap gap-2">
									<Badge variant="outline" className="max-w-full font-mono">
										{selectedAgent.tenant}
									</Badge>
									<Badge variant="outline" className="max-w-full truncate">
										{t('platform.agentManagement.modelCredential')}:{' '}
										{selectedAgentModelLabel}
									</Badge>
									<Badge variant="outline">
										{t('platform.agentRunner.knowledgeCount', {
											count: selectedAgentKnowledgeLabels.length,
										})}
									</Badge>
									<Badge variant="outline">
										{t('platform.agentRunner.toolsCount', {
											count: selectedAgentToolCount,
										})}
									</Badge>
									<Badge
										variant="outline"
										className={cn(
											selectedAgent.memory_enabled &&
												'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
										)}
									>
										{t('platform.agentManagement.memory')}:{' '}
										{selectedAgent.memory_enabled
											? t('platform.agentManagement.enabled')
											: t('platform.agentManagement.disabled')}
									</Badge>
									<Badge
										variant="outline"
										className={cn(
											selectedAgent.workflow_enabled &&
												'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
										)}
									>
										{t('platform.agentManagement.workflow')}:{' '}
										{selectedAgent.workflow_enabled
											? t('platform.agentManagement.enabled')
											: t('platform.agentManagement.disabled')}
									</Badge>
									<Badge
										variant="outline"
										className={cn(
											!selectedAgentAccessAllowed &&
												'border-red-500/30 bg-red-500/10 text-red-700',
										)}
									>
										{selectedAgentAccessLabel}
									</Badge>
								</div>
								{lastPublishedAgent?.id === selectedAgent.id ? (
									<div className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
										<div className="min-w-0">
											<div className="text-xs font-semibold text-emerald-800">
												{t('platform.agentRunner.readyAfterPublishTitle')}
											</div>
											<div className="text-xs leading-5 text-emerald-800/80">
												{t('platform.agentRunner.readyAfterPublishDescription', {
													name: selectedAgent.name,
												})}
											</div>
										</div>
										<div className="flex shrink-0 flex-wrap gap-2">
											<Button
												type="button"
												size="sm"
												onClick={onRun}
												disabled={
													running || !question.trim() || !selectedAgentAccessAllowed
												}
											>
												<Play className={cn(running && 'animate-pulse')} />
												{running
													? t('platform.agentRunner.running')
													: t('platform.agentRunner.runNow')}
											</Button>
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={onOpenGovernance}
											>
												<ShieldCheck />
												{t('platform.agentManagement.releaseOpenGovernance')}
											</Button>
										</div>
									</div>
								) : null}
							</div>
						) : null}
					</div>

					<div className="grid gap-2">
						<label className="text-xs font-medium text-muted-foreground">
							{t('platform.agentRunner.question')}
						</label>
						<Textarea
							value={question}
							onChange={(event) => onQuestionChange(event.target.value)}
							placeholder={t('platform.agentRunner.placeholder')}
							className="min-h-28 resize-y"
						/>
					</div>

					<div className="grid gap-2">
						<label className="text-xs font-medium text-muted-foreground">
							{t('platform.agentRunner.approvalId')}
						</label>
						<Input
							value={approvalId}
							onChange={(event) => onApprovalIdChange(event.target.value)}
							placeholder={t('platform.agentRunner.approvalIdPlaceholder')}
							className="font-mono"
						/>
					</div>

					<div className="grid gap-2">
						<div className="text-xs font-medium text-muted-foreground">
							{t('platform.agentRunner.samples')}
						</div>
						<div className="flex flex-wrap gap-2">
							{sampleQuestions.map((sample) => (
								<Button
									key={sample}
									type="button"
									size="sm"
									variant="outline"
									onClick={() => onQuestionChange(sample)}
								>
									{sample}
								</Button>
							))}
						</div>
					</div>

					<AgentRunnerConversation
						turns={conversation}
						activeResponse={activeResult}
						loading={conversationLoading}
						error={conversationError}
						labels={{
							title: t('platform.agentRunner.conversation'),
							clear: t('platform.agentRunner.clearConversation'),
							loading: t('common.loading'),
							empty: t('platform.agentRunner.conversationEmpty'),
							selectedTool: t('platform.agentRunner.selectedTool'),
							notRouted: t('platform.agentRunner.notRouted'),
						}}
						onClear={onClearConversation}
						onSelectTurn={onSelectConversationTurn}
					/>

					<div className="flex justify-end">
						<Button
							onClick={onRun}
							disabled={
								running ||
								!question.trim() ||
								!selectedAgentId ||
								!selectedAgentAccessAllowed
							}
						>
							<Play className={cn(running && 'animate-pulse')} />
							{running ? t('platform.agentRunner.running') : t('platform.agentRunner.run')}
						</Button>
					</div>

					{runError ? (
						<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{t('platform.agentRunner.error')} {runError}
						</div>
					) : null}
				</div>
			</div>

			<AgentRunnerResult
				result={activeResult}
				toolCalls={resultToolCalls}
				toolCallBadgeText={resultToolCallBadgeText}
				routingLabel={resultRoutingLabel}
				routingText={resultRoutingText}
				connectorSourceText={resultConnectorSourceText}
				modelLabel={resultModelLabel}
				knowledgeLabels={resultKnowledgeLabels}
				knowledgeBaseById={knowledgeBaseById}
				onInspectAudit={onInspectAudit}
				t={t}
			/>
		</section>
	);
}
