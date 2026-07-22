import {
	AlertTriangle,
	ArrowRight,
	BotMessageSquare,
	CheckCircle2,
	ListChecks,
	Pencil,
	Play,
	ShieldCheck,
} from 'lucide-react';
import type { ComponentType, Dispatch, SetStateAction } from 'react';

import type {
	EnterpriseAgentTemplate,
	EnterpriseApprovalRequestItem,
	EnterprisePublishedAgent,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { agentIsReady, agentReadinessState } from '../platform-utils';
import { StateBadge, type HealthState } from './common';

export type AppCenterSelection = { type: 'template' | 'agent'; id: string };

export interface AppCenterResource {
	label: string;
	value: string;
	icon: ComponentType<{ className?: string }>;
}

interface AppCenterPanelProps {
	agentTemplates: EnterpriseAgentTemplate[];
	activePlatformAgents: EnterprisePublishedAgent[];
	readyPlatformAgents: EnterprisePublishedAgent[];
	pendingApprovals: EnterpriseApprovalRequestItem[];
	appCenterAgents: EnterprisePublishedAgent[];
	inspectedAppCenterAgent: EnterprisePublishedAgent | null;
	inspectedAppCenterTemplate: EnterpriseAgentTemplate | null;
	appCenterPrimaryLabel: string;
	appCenterPrimaryDisabled: boolean;
	appCenterDetailResources: AppCenterResource[];
	appCenterDetailIssues: string[];
	appCenterDetailStatus: HealthState;
	agentResourceText: (agent: EnterprisePublishedAgent) => string;
	onOpenGovernance: () => void;
	onPrimaryAction: () => void;
	setSelectedAppCenterItem: Dispatch<SetStateAction<AppCenterSelection | null>>;
	onConfigureTemplate: (template: EnterpriseAgentTemplate) => void;
	onOpenAgentManagement: () => void;
	setSelectedRunAgentId: Dispatch<SetStateAction<string>>;
	onPrimeAgentRunner: () => void;
	onEditAgent: (agent: EnterprisePublishedAgent) => void;
	onUseApproval: (approval: EnterpriseApprovalRequestItem) => void;
	onDetailPrimaryAction: () => void;
	onDetailSecondaryAction: () => void;
	labels: {
		eyebrow: string;
		title: string;
		description: string;
		reviewApprovals: string;
		templates: string;
		emptyTemplates: string;
		templateTools: (count: number) => string;
		configureTemplate: string;
		published: string;
		emptyAgents: string;
		run: string;
		fix: string;
		governance: string;
		loopReady: string;
		loopNeedsWork: string;
		readyApps: string;
		pendingApprovals: string;
		emptyApprovals: string;
		selectedAgent: string;
		selectedTemplate: string;
		details: string;
		readinessLabel: (state: HealthState) => string;
		readyToPublish: string;
		needsConfiguration: string;
		selectToInspect: string;
		selectToInspectHelper: string;
		readiness: string;
		noIssues: string;
		runSelected: string;
		editConfiguration: string;
		publishFromTemplate: string;
		viewInManagement: string;
	};
}

export function AppCenterPanel({
	agentTemplates,
	activePlatformAgents,
	readyPlatformAgents,
	pendingApprovals,
	appCenterAgents,
	inspectedAppCenterAgent,
	inspectedAppCenterTemplate,
	appCenterPrimaryLabel,
	appCenterPrimaryDisabled,
	appCenterDetailResources,
	appCenterDetailIssues,
	appCenterDetailStatus,
	agentResourceText,
	onOpenGovernance,
	onPrimaryAction,
	setSelectedAppCenterItem,
	onConfigureTemplate,
	onOpenAgentManagement,
	setSelectedRunAgentId,
	onPrimeAgentRunner,
	onEditAgent,
	onUseApproval,
	onDetailPrimaryAction,
	onDetailSecondaryAction,
	labels,
}: AppCenterPanelProps) {
	const loopReady =
		readyPlatformAgents.length > 0 && pendingApprovals.length === 0;

	return (
		<section className="grid gap-4 rounded-lg border bg-background p-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<BotMessageSquare className="size-4" />
						<span>{labels.eyebrow}</span>
					</div>
					<h2 className="text-base font-semibold">{labels.title}</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{labels.description}
					</p>
				</div>
				<div className="flex flex-wrap gap-2 lg:justify-end">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onOpenGovernance}
					>
						<ShieldCheck className="size-4" />
						{labels.reviewApprovals}
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={onPrimaryAction}
						disabled={appCenterPrimaryDisabled}
					>
						<Play className="size-4" />
						{appCenterPrimaryLabel}
					</Button>
				</div>
			</div>

			<div className="grid gap-3 lg:grid-cols-2">
				<div className="grid content-start gap-3 rounded-lg border bg-background p-3">
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-sm font-medium">{labels.templates}</h3>
						<Badge variant="outline">{agentTemplates.length}</Badge>
					</div>
					{agentTemplates.length === 0 ? (
						<div className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
							{labels.emptyTemplates}
						</div>
					) : (
						agentTemplates.slice(0, 3).map((template) => {
							const templateTools = template.tools ?? [];
							const isSelected =
								inspectedAppCenterTemplate?.id === template.id &&
								!inspectedAppCenterAgent;

							return (
								<div
									key={template.id}
									role="button"
									tabIndex={0}
									className={cn(
										'grid gap-3 rounded-lg border bg-background p-3 text-left transition hover:border-primary/30 hover:bg-primary/5',
										isSelected && 'border-primary/60 bg-primary/5',
									)}
									onClick={() =>
										setSelectedAppCenterItem({
											type: 'template',
											id: template.id,
										})
									}
									onKeyDown={(event) => {
										if (event.key === 'Enter' || event.key === ' ') {
											event.preventDefault();
											setSelectedAppCenterItem({
												type: 'template',
												id: template.id,
											});
										}
									}}
								>
									<div className="min-w-0">
										<div className="flex items-center justify-between gap-3">
											<span className="truncate text-sm font-medium">
												{template.name}
											</span>
											<span className="shrink-0 text-xs text-muted-foreground">
												{labels.templateTools(templateTools.length)}
											</span>
										</div>
										<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
											{template.description}
										</p>
									</div>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={(event) => {
											event.stopPropagation();
											setSelectedAppCenterItem({
												type: 'template',
												id: template.id,
											});
											onConfigureTemplate(template);
											window.setTimeout(onOpenAgentManagement, 0);
										}}
									>
										<ListChecks className="size-4" />
										{labels.configureTemplate}
									</Button>
								</div>
							);
						})
					)}
				</div>

				<div className="grid content-start gap-3 rounded-lg border bg-background p-3">
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-sm font-medium">{labels.published}</h3>
						<Badge variant="outline">{activePlatformAgents.length}</Badge>
					</div>
					{appCenterAgents.length === 0 ? (
						<div className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
							{labels.emptyAgents}
						</div>
					) : (
						appCenterAgents.map((agent) => {
							const readinessState: HealthState = agentReadinessState(agent);
							const isReady = agentIsReady(agent);

							return (
								<div
									key={agent.id}
									role="button"
									tabIndex={0}
									className={cn(
										'grid gap-3 rounded-lg border bg-background p-3 text-left transition hover:border-primary/30 hover:bg-primary/5',
										inspectedAppCenterAgent?.id === agent.id &&
											'border-primary/60 bg-primary/5',
									)}
									onClick={() =>
										setSelectedAppCenterItem({
											type: 'agent',
											id: agent.id,
										})
									}
									onKeyDown={(event) => {
										if (event.key === 'Enter' || event.key === ' ') {
											event.preventDefault();
											setSelectedAppCenterItem({
												type: 'agent',
												id: agent.id,
											});
										}
									}}
								>
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<span className="min-w-0 truncate text-sm font-medium">
												{agent.name}
											</span>
											<StateBadge
												state={readinessState}
												label={labels.readinessLabel(readinessState)}
											/>
										</div>
										<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
											{agentResourceText(agent)}
										</p>
									</div>
									<Button
										type="button"
										size="sm"
										variant={isReady ? 'default' : 'outline'}
										onClick={(event) => {
											event.stopPropagation();
											setSelectedAppCenterItem({
												type: 'agent',
												id: agent.id,
											});
											if (isReady) {
												setSelectedRunAgentId(agent.id);
												onPrimeAgentRunner();
												return;
											}
											onEditAgent(agent);
											window.setTimeout(onOpenAgentManagement, 0);
										}}
									>
										{isReady ? (
											<Play className="size-4" />
										) : (
											<Pencil className="size-4" />
										)}
										{isReady ? labels.run : labels.fix}
									</Button>
								</div>
							);
						})
					)}
				</div>

				<div className="grid content-start gap-3 rounded-lg border bg-background p-3">
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-sm font-medium">{labels.governance}</h3>
						<StateBadge
							state={loopReady ? 'ready' : 'partial'}
							label={loopReady ? labels.loopReady : labels.loopNeedsWork}
						/>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<div className="rounded-lg border bg-background p-3">
							<div className="text-xs text-muted-foreground">
								{labels.readyApps}
							</div>
							<div className="mt-1 text-2xl font-semibold tabular-nums">
								{readyPlatformAgents.length}
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
					{pendingApprovals.length === 0 ? (
						<div className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
							{labels.emptyApprovals}
						</div>
					) : (
						pendingApprovals.slice(0, 2).map((approval) => (
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
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onOpenGovernance}
					>
						<ArrowRight className="size-4" />
						{labels.reviewApprovals}
					</Button>
				</div>
			</div>

			<div className="grid gap-4 rounded-lg border bg-background p-4 lg:grid-cols-[1.2fr_0.8fr]">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline">
							{inspectedAppCenterAgent
								? labels.selectedAgent
								: inspectedAppCenterTemplate
									? labels.selectedTemplate
									: labels.details}
						</Badge>
						{inspectedAppCenterAgent || inspectedAppCenterTemplate ? (
							<StateBadge
								state={appCenterDetailStatus}
								label={
									inspectedAppCenterAgent
										? labels.readinessLabel(appCenterDetailStatus)
										: appCenterDetailStatus === 'ready'
											? labels.readyToPublish
											: labels.needsConfiguration
								}
							/>
						) : null}
					</div>
					<h3 className="mt-3 text-base font-semibold">
						{inspectedAppCenterAgent?.name ??
							inspectedAppCenterTemplate?.name ??
							labels.selectToInspect}
					</h3>
					<p className="mt-1 text-sm leading-6 text-muted-foreground">
						{inspectedAppCenterAgent?.description ??
							inspectedAppCenterTemplate?.description ??
							labels.selectToInspectHelper}
					</p>

					<div className="mt-4 grid gap-2 sm:grid-cols-2">
						{appCenterDetailResources.map((resource) => {
							const Icon = resource.icon;

							return (
								<div
									key={resource.label}
									className="grid gap-2 rounded-lg border bg-background p-3"
								>
									<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
										<Icon className="size-4" />
										<span>{resource.label}</span>
									</div>
									<div className="line-clamp-2 text-sm">{resource.value}</div>
								</div>
							);
						})}
					</div>
				</div>

				<div className="grid content-start gap-3">
					<div className="rounded-lg border bg-background p-3">
						<div className="flex items-center gap-2 text-sm font-medium">
							<ListChecks className="size-4 text-muted-foreground" />
							{labels.readiness}
						</div>
						{appCenterDetailIssues.length === 0 ? (
							<div className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
								<CheckCircle2 className="size-4" />
								{labels.noIssues}
							</div>
						) : (
							<ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
								{appCenterDetailIssues.map((issue) => (
									<li key={issue} className="flex items-start gap-2">
										<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
										<span>{issue}</span>
									</li>
								))}
							</ul>
						)}
					</div>

					<div className="grid gap-2">
						<Button
							type="button"
							size="sm"
							onClick={onDetailPrimaryAction}
							disabled={!inspectedAppCenterAgent && !inspectedAppCenterTemplate}
						>
							{inspectedAppCenterAgent &&
							agentIsReady(inspectedAppCenterAgent) ? (
								<Play className="size-4" />
							) : (
								<Pencil className="size-4" />
							)}
							{inspectedAppCenterAgent
								? agentIsReady(inspectedAppCenterAgent)
									? labels.runSelected
									: labels.editConfiguration
								: labels.publishFromTemplate}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onDetailSecondaryAction}
							disabled={!inspectedAppCenterAgent && pendingApprovals.length === 0}
						>
							{inspectedAppCenterAgent ? (
								<ListChecks className="size-4" />
							) : (
								<ShieldCheck className="size-4" />
							)}
							{inspectedAppCenterAgent
								? labels.viewInManagement
								: labels.reviewApprovals}
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
