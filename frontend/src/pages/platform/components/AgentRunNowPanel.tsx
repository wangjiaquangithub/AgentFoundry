import {
	BotMessageSquare,
	Boxes,
	Brain,
	KeyRound,
	LibraryBig,
	ListChecks,
	Network,
	Pencil,
	Play,
	UserRound,
	Workflow,
} from 'lucide-react';

import type { EnterprisePublishedAgent } from '@/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { StateBadge } from './common';

interface AgentRunNowPanelProps {
	loading: boolean;
	selectedRunAgent?: EnterprisePublishedAgent | null;
	currentIdentityLabel: string;
	selectedRunAgentModelLabel: string;
	selectedRunAgentKnowledgeCount: number;
	selectedRunAgentToolCount: number;
	primaryAgentSampleQuestion: string;
	connectorName?: string;
	hasDefaultAgentTemplate: boolean;
	isPublishingTemplate: boolean;
	onPrimeAgentRunner: () => void;
	onScrollToAgentRunner: () => void;
	onStartPublishing: () => void;
	onQuickPublishAgent: () => void;
	labels: {
		eyebrow: string;
		title: string;
		description: string;
		fillSample: string;
		run: string;
		publishAgent: string;
		currentAgent: string;
		publishedStatus: string;
		sample: string;
		currentUser: string;
		model: string;
		knowledge: string;
		knowledgeCount: (count: number) => string;
		tools: string;
		toolsCount: (count: number) => string;
		memory: string;
		workflow: string;
		enabled: string;
		disabled: string;
		connector: string;
		unavailable: string;
		noAgent: string;
		noAgentDescription: string;
		manualPublish: string;
		publishing: string;
		quickPublish: string;
	};
}

export function AgentRunNowPanel({
	loading,
	selectedRunAgent,
	currentIdentityLabel,
	selectedRunAgentModelLabel,
	selectedRunAgentKnowledgeCount,
	selectedRunAgentToolCount,
	primaryAgentSampleQuestion,
	connectorName,
	hasDefaultAgentTemplate,
	isPublishingTemplate,
	onPrimeAgentRunner,
	onScrollToAgentRunner,
	onStartPublishing,
	onQuickPublishAgent,
	labels,
}: AgentRunNowPanelProps) {
	return (
		<section className="grid gap-4 rounded-lg border bg-background p-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<Play className="size-4" />
						<span>{labels.eyebrow}</span>
					</div>
					<h2 className="text-base font-semibold">{labels.title}</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{labels.description}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onPrimeAgentRunner}
						disabled={!selectedRunAgent}
					>
						<Pencil className="size-4" />
						{labels.fillSample}
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={selectedRunAgent ? onScrollToAgentRunner : onStartPublishing}
					>
						{selectedRunAgent ? (
							<Play className="size-4" />
						) : (
							<BotMessageSquare className="size-4" />
						)}
						{selectedRunAgent ? labels.run : labels.publishAgent}
					</Button>
				</div>
			</div>

			{loading ? (
				<div className="grid gap-3 md:grid-cols-[1.2fr_2fr]">
					<Skeleton className="h-32 rounded-lg" />
					<Skeleton className="h-32 rounded-lg" />
				</div>
			) : selectedRunAgent ? (
				<div className="grid gap-3 lg:grid-cols-[1.1fr_2fr]">
					<div className="grid gap-3 rounded-lg border bg-background p-3">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<div className="text-xs text-muted-foreground">
									{labels.currentAgent}
								</div>
								<div className="mt-1 truncate text-sm font-medium">
									{selectedRunAgent.name}
								</div>
							</div>
							<StateBadge state="ready" label={labels.publishedStatus} />
						</div>
						<div className="rounded-lg border bg-background p-3">
							<div className="text-xs text-muted-foreground">{labels.sample}</div>
							<div className="mt-1 text-sm leading-6">
								{primaryAgentSampleQuestion}
							</div>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<div className="grid gap-2 rounded-lg border bg-background p-3">
							<UserRound className="size-4 text-muted-foreground" />
							<div className="min-w-0">
								<div className="text-xs text-muted-foreground">
									{labels.currentUser}
								</div>
								<div className="mt-1 truncate text-sm font-medium">
									{currentIdentityLabel}
								</div>
							</div>
						</div>
						<div className="grid gap-2 rounded-lg border bg-background p-3">
							<KeyRound className="size-4 text-muted-foreground" />
							<div className="min-w-0">
								<div className="text-xs text-muted-foreground">{labels.model}</div>
								<div className="mt-1 truncate text-sm font-medium">
									{selectedRunAgentModelLabel}
								</div>
							</div>
						</div>
						<div className="grid gap-2 rounded-lg border bg-background p-3">
							<LibraryBig className="size-4 text-muted-foreground" />
							<div className="min-w-0">
								<div className="text-xs text-muted-foreground">
									{labels.knowledge}
								</div>
								<div className="mt-1 truncate text-sm font-medium">
									{labels.knowledgeCount(selectedRunAgentKnowledgeCount)}
								</div>
							</div>
						</div>
						<div className="grid gap-2 rounded-lg border bg-background p-3">
							<Boxes className="size-4 text-muted-foreground" />
							<div className="min-w-0">
								<div className="text-xs text-muted-foreground">{labels.tools}</div>
								<div className="mt-1 truncate text-sm font-medium">
									{labels.toolsCount(selectedRunAgentToolCount)}
								</div>
							</div>
						</div>
						<div className="grid gap-2 rounded-lg border bg-background p-3">
							<Brain className="size-4 text-muted-foreground" />
							<div className="min-w-0">
								<div className="text-xs text-muted-foreground">{labels.memory}</div>
								<div className="mt-1 truncate text-sm font-medium">
									{selectedRunAgent.memory_enabled ? labels.enabled : labels.disabled}
								</div>
							</div>
						</div>
						<div className="grid gap-2 rounded-lg border bg-background p-3">
							<Workflow className="size-4 text-muted-foreground" />
							<div className="min-w-0">
								<div className="text-xs text-muted-foreground">
									{labels.workflow}
								</div>
								<div className="mt-1 truncate text-sm font-medium">
									{selectedRunAgent.workflow_enabled
										? labels.enabled
										: labels.disabled}
								</div>
							</div>
						</div>
						<div className="grid gap-2 rounded-lg border bg-background p-3 sm:col-span-2">
							<Network className="size-4 text-muted-foreground" />
							<div className="min-w-0">
								<div className="text-xs text-muted-foreground">
									{labels.connector}
								</div>
								<div className="mt-1 truncate text-sm font-medium">
									{connectorName || labels.unavailable}
								</div>
							</div>
						</div>
					</div>
				</div>
			) : (
				<div className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="min-w-0">
						<div className="text-sm font-medium">{labels.noAgent}</div>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">
							{labels.noAgentDescription}
						</p>
					</div>
					<div className="flex flex-wrap gap-2 sm:justify-end">
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onStartPublishing}
						>
							<ListChecks className="size-4" />
							{labels.manualPublish}
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={onQuickPublishAgent}
							disabled={!hasDefaultAgentTemplate || isPublishingTemplate}
						>
							<BotMessageSquare
								className={cn('size-4', isPublishingTemplate && 'animate-pulse')}
							/>
							{isPublishingTemplate ? labels.publishing : labels.quickPublish}
						</Button>
					</div>
				</div>
			)}
		</section>
	);
}
