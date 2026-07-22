import { ArrowRight, BotMessageSquare, ListChecks, Pencil, Play } from 'lucide-react';

import type { EnterpriseApprovalRequestItem, EnterprisePublishedAgent } from '@/api';
import { Button } from '@/components/ui/button';
import { publishedAgentReadinessState } from '../platform-utils';
import { StateBadge, type HealthState } from './common';

interface OperationsPanelProps {
	activeAgents: EnterprisePublishedAgent[];
	readyAgents: EnterprisePublishedAgent[];
	blockedOrPartialAgents: EnterprisePublishedAgent[];
	topAgents: EnterprisePublishedAgent[];
	pendingApprovals: EnterpriseApprovalRequestItem[];
	headline: string;
	agentIssueText: (agent: EnterprisePublishedAgent) => string;
	onManageAgents: () => void;
	onOpenGovernance: () => void;
	onRunReadyAgent: () => void;
	onStartPublishing: () => void;
	onSelectRunAgent: (agentId: string) => void;
	onEditAgent: (agent: EnterprisePublishedAgent) => void;
	onUseApproval: (approval: EnterpriseApprovalRequestItem) => void;
	labels: {
		eyebrow: string;
		title: string;
		manageAgents: string;
		runReadyAgent: string;
		publishAgent: string;
		totalAgents: string;
		readyAgents: string;
		needsConfiguration: string;
		pendingApprovals: string;
		agentReadiness: string;
		viewAll: string;
		emptyAgents: string;
		archived: string;
		readiness: (state: HealthState) => string;
		run: string;
		configure: string;
		humanInLoop: string;
		review: string;
		emptyApprovals: string;
	};
}

export function OperationsPanel({
	activeAgents,
	readyAgents,
	blockedOrPartialAgents,
	topAgents,
	pendingApprovals,
	headline,
	agentIssueText,
	onManageAgents,
	onOpenGovernance,
	onRunReadyAgent,
	onStartPublishing,
	onSelectRunAgent,
	onEditAgent,
	onUseApproval,
	labels,
}: OperationsPanelProps) {
	return (
		<section className="grid gap-4 border-t py-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<BotMessageSquare className="size-4" />
						<span>{labels.eyebrow}</span>
					</div>
					<h2 className="text-base font-semibold">{labels.title}</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{headline}
					</p>
				</div>
				<div className="flex flex-wrap gap-2 lg:justify-end">
					<Button type="button" size="sm" variant="outline" onClick={onManageAgents}>
						<ListChecks className="size-4" />
						{labels.manageAgents}
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={() => (readyAgents[0] ? onRunReadyAgent() : onStartPublishing())}
					>
						<Play className="size-4" />
						{readyAgents[0] ? labels.runReadyAgent : labels.publishAgent}
					</Button>
				</div>
			</div>

			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-lg border bg-background p-3">
					<div className="text-xs text-muted-foreground">{labels.totalAgents}</div>
					<div className="mt-1 text-2xl font-semibold tabular-nums">
						{activeAgents.length}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-3">
					<div className="text-xs text-muted-foreground">{labels.readyAgents}</div>
					<div className="mt-1 text-2xl font-semibold tabular-nums">
						{readyAgents.length}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-3">
					<div className="text-xs text-muted-foreground">
						{labels.needsConfiguration}
					</div>
					<div className="mt-1 text-2xl font-semibold tabular-nums">
						{blockedOrPartialAgents.length}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-3">
					<div className="text-xs text-muted-foreground">
						{labels.pendingApprovals}
					</div>
					<div className="mt-1 text-2xl font-semibold tabular-nums">
						{pendingApprovals.length}
					</div>
				</div>
			</div>

			<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.45fr)]">
				<div className="grid gap-2">
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-sm font-medium">{labels.agentReadiness}</h3>
						<Button type="button" size="sm" variant="ghost" onClick={onManageAgents}>
							{labels.viewAll}
							<ArrowRight className="size-4" />
						</Button>
					</div>
					{topAgents.length === 0 ? (
						<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
							{labels.emptyAgents}
						</div>
					) : (
						<div className="grid gap-2">
							{topAgents.map((agent) => {
								const readinessState = publishedAgentReadinessState(agent);
								const isReady =
									agent.status === 'published' && readinessState === 'ready';
								const readinessLabel =
									agent.status !== 'published'
										? labels.archived
										: labels.readiness(readinessState);

								return (
									<div
										key={agent.id}
										className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
									>
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<span className="min-w-0 truncate text-sm font-medium">
													{agent.name}
												</span>
												<StateBadge state={readinessState} label={readinessLabel} />
											</div>
											<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
												{agentIssueText(agent)}
											</p>
										</div>
										<div className="flex flex-wrap gap-2 md:justify-end">
											{isReady ? (
												<Button
													type="button"
													size="sm"
													onClick={() => {
														onSelectRunAgent(agent.id);
														onRunReadyAgent();
													}}
												>
													<Play className="size-4" />
													{labels.run}
												</Button>
											) : (
												<Button
													type="button"
													size="sm"
													variant="outline"
													disabled={agent.status !== 'published'}
													onClick={() => {
														onEditAgent(agent);
														window.setTimeout(onManageAgents, 0);
													}}
												>
													<Pencil className="size-4" />
													{labels.configure}
												</Button>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				<div className="grid content-start gap-2">
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-sm font-medium">{labels.humanInLoop}</h3>
						<Button type="button" size="sm" variant="ghost" onClick={onOpenGovernance}>
							{labels.review}
							<ArrowRight className="size-4" />
						</Button>
					</div>
					{pendingApprovals.length === 0 ? (
						<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
							{labels.emptyApprovals}
						</div>
					) : (
						pendingApprovals.slice(0, 3).map((approval) => (
							<button
								key={approval.approval_id}
								type="button"
								className="grid gap-1 rounded-lg border bg-background p-3 text-left text-sm transition hover:border-primary/30 hover:bg-primary/5"
								onClick={() => onUseApproval(approval)}
							>
								<span className="truncate font-medium">
									{approval.tool_name ||
										approval.workflow_type ||
										approval.request_type}
								</span>
								<span className="truncate text-xs text-muted-foreground">
									{approval.user_id} · {approval.tenant}
								</span>
							</button>
						))
					)}
				</div>
			</div>
		</section>
	);
}
