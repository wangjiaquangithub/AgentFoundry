import {
	ArrowRight,
	BotMessageSquare,
	Boxes,
	Brain,
	KeyRound,
	LibraryBig,
	ListChecks,
	Pencil,
	Play,
	ShieldCheck,
	Workflow,
} from 'lucide-react';
import type { ComponentType } from 'react';

import { StateBadge, type HealthState } from './common';
import type { EnterpriseAgentTemplate, EnterprisePublishedAgent } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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

interface AgentManagementOverviewProps {
	agentOpsSummary: AgentOpsSummaryItem[];
	agentReleasePipeline: AgentReleasePipelineStep[];
	nextAgentSetupStep: { title: string } | null;
	selectedRunAgent: EnterprisePublishedAgent | null;
	selectedRunAgentReadinessState: HealthState;
	selectedRunAgentReadinessLabel: string;
	selectedRunAgentModelLabel: string;
	selectedRunAgentKnowledgeCount: number;
	selectedRunAgentToolCount: number;
	labels: {
		pipelineTitle: string;
		pipelineDescription: string;
		nextAction: string;
		readyAction: string;
		noRuntimeAgent: string;
		noRuntimeAgentHint: string;
		modelCredential: string;
		knowledgeBases: string;
		tools: string;
		memory: string;
		workflow: string;
		enabled: string;
		disabled: string;
		runAgent: string;
		runWorkflow: string;
		edit: string;
		openGovernance: string;
		states: Record<HealthState, string>;
	};
	onNextAgentSetupStep: () => void;
	onRunAgent: () => void;
	onRunWorkflow: (agent: EnterprisePublishedAgent) => void;
	onEditAgent: (agent: EnterprisePublishedAgent) => void;
	onOpenGovernance: () => void;
}

export function AgentManagementOverview({
	agentOpsSummary,
	agentReleasePipeline,
	nextAgentSetupStep,
	selectedRunAgent,
	selectedRunAgentReadinessState,
	selectedRunAgentReadinessLabel,
	selectedRunAgentModelLabel,
	selectedRunAgentKnowledgeCount,
	selectedRunAgentToolCount,
	labels,
	onNextAgentSetupStep,
	onRunAgent,
	onRunWorkflow,
	onEditAgent,
	onOpenGovernance,
}: AgentManagementOverviewProps) {
	return (
		<div className="grid gap-3">
			<div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
				{agentOpsSummary.map((item) => (
					<div key={item.label} className="rounded-lg border bg-background p-3">
						<div className="text-xs text-muted-foreground">{item.label}</div>
						<div className="mt-1 text-2xl font-semibold tabular-nums">
							{item.value}
						</div>
						<div className="mt-1 truncate text-xs text-muted-foreground">
							{item.helper}
						</div>
					</div>
				))}
			</div>
			<div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.45fr)]">
				<Card size="sm" className="rounded-lg shadow-none">
					<CardHeader className="grid-cols-[1fr_auto] gap-3">
						<div className="min-w-0">
							<CardTitle className="truncate text-sm">
								{labels.pipelineTitle}
							</CardTitle>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{labels.pipelineDescription}
							</p>
						</div>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onNextAgentSetupStep}
							disabled={!nextAgentSetupStep}
						>
							<ArrowRight />
							{nextAgentSetupStep ? labels.nextAction : labels.readyAction}
						</Button>
					</CardHeader>
					<CardContent>
						<div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
							{agentReleasePipeline.map((step) => {
								const StepIcon = step.icon;
								return (
									<div
										key={step.key}
										className="grid min-h-28 gap-2 rounded-lg border bg-background p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
									>
										<div className="flex items-start justify-between gap-2">
											<div className="flex min-w-0 items-center gap-2">
												<div className="grid size-8 shrink-0 place-items-center rounded-md border bg-background">
													<StepIcon className="size-4" />
												</div>
												<div className="min-w-0 truncate text-xs font-medium">
													{step.title}
												</div>
											</div>
											<StateBadge
												state={step.state}
												label={labels.states[step.state]}
											/>
										</div>
										<div
											className="line-clamp-2 text-xs leading-5 text-muted-foreground"
											title={step.detail}
										>
											{step.detail}
										</div>
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
				<Card size="sm" className="rounded-lg shadow-none">
					<CardHeader className="grid-cols-[1fr_auto] gap-3">
						<div className="min-w-0">
							<CardTitle className="truncate text-sm">
								{selectedRunAgent ? selectedRunAgent.name : labels.noRuntimeAgent}
							</CardTitle>
							<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
								{selectedRunAgent
									? selectedRunAgent.description
									: labels.noRuntimeAgentHint}
							</p>
						</div>
						<StateBadge
							state={selectedRunAgentReadinessState}
							label={selectedRunAgentReadinessLabel}
						/>
					</CardHeader>
					<CardContent className="grid gap-3 text-xs">
						<div className="grid gap-2">
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{labels.modelCredential}
								</span>
								<span className="min-w-0 truncate font-mono">
									{selectedRunAgentModelLabel}
								</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{labels.knowledgeBases}
								</span>
								<span className="font-mono tabular-nums">
									{selectedRunAgentKnowledgeCount}
								</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">{labels.tools}</span>
								<span className="font-mono tabular-nums">
									{selectedRunAgentToolCount}
								</span>
							</div>
						</div>
						<div className="flex flex-wrap gap-2">
							<Badge variant="outline">
								{labels.memory}:{' '}
								{selectedRunAgent?.memory_enabled ? labels.enabled : labels.disabled}
							</Badge>
							<Badge variant="outline">
								{labels.workflow}:{' '}
								{selectedRunAgent?.workflow_enabled ? labels.enabled : labels.disabled}
							</Badge>
						</div>
						<div className="flex flex-wrap gap-2 border-t pt-3">
							<Button
								type="button"
								size="sm"
								onClick={onRunAgent}
								disabled={!selectedRunAgent}
							>
								<Play />
								{labels.runAgent}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => selectedRunAgent && onRunWorkflow(selectedRunAgent)}
								disabled={!selectedRunAgent || !selectedRunAgent.workflow_enabled}
							>
								<Workflow />
								{labels.runWorkflow}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => selectedRunAgent && onEditAgent(selectedRunAgent)}
								disabled={!selectedRunAgent}
							>
								<Pencil />
								{labels.edit}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={onOpenGovernance}
							>
								<ShieldCheck />
								{labels.openGovernance}
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

interface AgentTemplateListProps {
	templates: EnterpriseAgentTemplate[];
	selectedTemplateId: string | null;
	loading: boolean;
	hasLoaded: boolean;
	publishingTemplateId?: string | null;
	labels: {
		title: string;
		empty: string;
		configure: string;
	};
	onConfigureTemplate: (template: EnterpriseAgentTemplate) => void;
}

export function AgentTemplateList({
	templates,
	selectedTemplateId,
	loading,
	hasLoaded,
	publishingTemplateId,
	labels,
	onConfigureTemplate,
}: AgentTemplateListProps) {
	return (
		<div className="grid gap-3">
			<h3 className="text-sm font-medium text-muted-foreground">{labels.title}</h3>
			{loading && !hasLoaded ? (
				<div className="grid gap-3">
					<Skeleton className="h-32 w-full" />
					<Skeleton className="h-32 w-full" />
				</div>
			) : templates.length === 0 ? (
				<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
					{labels.empty}
				</div>
			) : (
				<div className="grid gap-3">
					{templates.map((template) => {
						const isSelected = selectedTemplateId === template.id;

						return (
							<Card
								key={template.id}
								size="sm"
								className={cn(
									'rounded-lg shadow-none transition-colors hover:border-primary/30 hover:bg-primary/5',
									isSelected && 'border-primary/60 bg-primary/5',
								)}
							>
								<CardHeader className="grid-cols-[1fr_auto] gap-3">
									<div className="min-w-0">
										<CardTitle className="truncate text-sm">
											{template.name}
										</CardTitle>
										<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
											{template.description}
										</p>
									</div>
									<Button
										size="sm"
										variant={isSelected ? 'default' : 'outline'}
										onClick={() => onConfigureTemplate(template)}
										disabled={Boolean(publishingTemplateId)}
									>
										<ListChecks />
										{labels.configure}
									</Button>
								</CardHeader>
								<CardContent className="grid gap-3 text-xs">
									<div className="flex flex-wrap gap-2">
										{template.tools.map((toolName) => (
											<Badge
												key={toolName}
												variant="outline"
												className="max-w-full truncate font-mono"
												title={toolName}
											>
												{toolName}
											</Badge>
										))}
									</div>
									<div className="flex flex-wrap gap-2">
										{template.capabilities.map((capability) => (
											<Badge
												key={capability}
												variant="secondary"
												className="max-w-full truncate font-mono"
												title={capability}
											>
												{capability}
											</Badge>
										))}
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}
		</div>
	);
}

export const agentReleasePipelineIcons = {
	template: ListChecks,
	model: KeyRound,
	knowledge: LibraryBig,
	tools: Boxes,
	runtime: Brain,
	publish: BotMessageSquare,
	governance: ShieldCheck,
};
