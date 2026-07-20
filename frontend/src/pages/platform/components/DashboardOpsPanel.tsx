import {
	AlertTriangle,
	Boxes,
	FileClock,
	ListChecks,
	Play,
	ShieldCheck,
	Workflow,
} from 'lucide-react';
import type { ComponentType } from 'react';

import type {
	EnterpriseApprovalRequestItem,
	EnterpriseAuditEvent,
	EnterprisePlatformDashboardAction,
	EnterprisePlatformDashboardRiskTool,
	EnterprisePlatformGovernedWorkflow,
	EnterprisePlatformOperations,
	EnterpriseToolCatalogItem,
	EnterpriseWorkflowRunHistoryItem,
	EnterpriseWorkflowTemplate,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	operationSeverityClassName,
	workflowStatusClassName,
	workflowStatusLabelKey,
} from '../platform-utils';

type DashboardRiskTool =
	| EnterprisePlatformDashboardRiskTool
	| EnterpriseToolCatalogItem;

interface DashboardOpsPanelProps {
	dashboardOperations?: EnterprisePlatformOperations;
	workflowTemplates: EnterpriseWorkflowTemplate[];
	completedWorkflowRunCount: number;
	partialWorkflowRunCount: number;
	failedWorkflowRunCount: number;
	governedWorkflowItems: EnterprisePlatformGovernedWorkflow[];
	recommendedOperationActions: EnterprisePlatformDashboardAction[];
	pendingApprovals: EnterpriseApprovalRequestItem[];
	approvedApprovalCount: number;
	workflowRunCount: number;
	recentWorkflowRuns: EnterpriseWorkflowRunHistoryItem[];
	riskToolItems: DashboardRiskTool[];
	auditEventCount: number;
	recentAuditEvents: EnterpriseAuditEvent[];
	dashboardTodoItems: string[];
	nextStepMode: string;
	nextStepIcon: ComponentType<{ className?: string }>;
	nextStepPrimaryDisabled: boolean;
	onOperationAction: (target?: string) => void;
	onNextStepPrimaryAction: () => void;
	onScrollToGovernance: () => void;
	onScrollToAgentRunner: () => void;
	onScrollToWorkflowRunner: () => void;
	onScrollToToolRunner: () => void;
	labels: {
		eyebrow: string;
		title: string;
		description: string;
		openAudit: string;
		runAgent: string;
		workflowHealth: string;
		workflowHealthDescription: string;
		enabledWorkflows: string;
		completedRuns: string;
		partialRuns: string;
		failedRuns: string;
		noGovernedWorkflows: string;
		workflowApprovalRequired: string;
		ready: string;
		toConfigure: string;
		pendingCount: (count: number) => string;
		recommendedActions: string;
		recommendedActionsDescription: string;
		actionLabel: (code: string, count: number) => string;
		severityLabel: (severity: string) => string;
		workflowApprovals: string;
		toolApprovals: string;
		pendingApprovals: string;
		pendingApprovalsDescription: (approved: number) => string;
		emptyApprovals: string;
		openApprovals: string;
		recentRuns: string;
		recentRunsDescription: string;
		emptyRuns: string;
		workflowStatusLabel: (labelKey: string) => string;
		openWorkflows: string;
		riskActions: string;
		riskActionsDescription: string;
		emptyRiskActions: string;
		policyReviewWorkflow: string;
		approvalGate: string;
		openTools: string;
		auditTrail: string;
		auditTrailDescription: string;
		emptyAudit: string;
		auditFailure: string;
		auditSuccess: string;
		todo: string;
		todoReady: string;
		nextStepAction: (mode: string) => string;
	};
}

export function DashboardOpsPanel({
	dashboardOperations,
	workflowTemplates,
	completedWorkflowRunCount,
	partialWorkflowRunCount,
	failedWorkflowRunCount,
	governedWorkflowItems,
	recommendedOperationActions,
	pendingApprovals,
	approvedApprovalCount,
	workflowRunCount,
	recentWorkflowRuns,
	riskToolItems,
	auditEventCount,
	recentAuditEvents,
	dashboardTodoItems,
	nextStepMode,
	nextStepIcon: NextStepIcon,
	nextStepPrimaryDisabled,
	onOperationAction,
	onNextStepPrimaryAction,
	onScrollToGovernance,
	onScrollToAgentRunner,
	onScrollToWorkflowRunner,
	onScrollToToolRunner,
	labels,
}: DashboardOpsPanelProps) {
	return (
		<section className="grid gap-4 rounded-lg border bg-background p-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<ShieldCheck className="size-4" />
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
						onClick={onScrollToGovernance}
					>
						<FileClock className="size-4" />
						{labels.openAudit}
					</Button>
					<Button type="button" size="sm" onClick={onScrollToAgentRunner}>
						<Play className="size-4" />
						{labels.runAgent}
					</Button>
				</div>
			</div>

			<div className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
				<div className="grid gap-3 rounded-lg border bg-background p-3">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<h3 className="text-sm font-medium">{labels.workflowHealth}</h3>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{labels.workflowHealthDescription}
							</p>
						</div>
						<Workflow className="mt-0.5 size-4 text-muted-foreground" />
					</div>
					<div className="grid gap-2 sm:grid-cols-4">
						<div className="rounded-md border bg-background px-2 py-2">
							<div className="text-lg font-semibold tabular-nums">
								{dashboardOperations?.enabled_workflow_count ?? workflowTemplates.length}
							</div>
							<div className="text-xs text-muted-foreground">
								{labels.enabledWorkflows}
							</div>
						</div>
						<div className="rounded-md border bg-background px-2 py-2">
							<div className="text-lg font-semibold tabular-nums">
								{completedWorkflowRunCount}
							</div>
							<div className="text-xs text-muted-foreground">
								{labels.completedRuns}
							</div>
						</div>
						<div className="rounded-md border bg-background px-2 py-2">
							<div className="text-lg font-semibold tabular-nums">
								{partialWorkflowRunCount}
							</div>
							<div className="text-xs text-muted-foreground">{labels.partialRuns}</div>
						</div>
						<div className="rounded-md border bg-background px-2 py-2">
							<div className="text-lg font-semibold tabular-nums">
								{failedWorkflowRunCount}
							</div>
							<div className="text-xs text-muted-foreground">{labels.failedRuns}</div>
						</div>
					</div>
					<div className="grid gap-2">
						{governedWorkflowItems.length === 0 ? (
							<p className="text-xs text-muted-foreground">
								{labels.noGovernedWorkflows}
							</p>
						) : (
							governedWorkflowItems.slice(0, 3).map((workflow) => (
								<div
									key={workflow.workflow_type}
									className="flex flex-col gap-2 rounded-md border bg-background px-2 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="min-w-0">
										<div className="truncate font-medium">{workflow.name}</div>
										<div className="truncate text-muted-foreground">
											{workflow.approval_required_tools.length > 0
												? workflow.approval_required_tools.join(', ')
												: labels.workflowApprovalRequired}
										</div>
									</div>
									<div className="flex shrink-0 flex-wrap gap-2">
										<Badge variant="outline">
											{workflow.enabled ? labels.ready : labels.toConfigure}
										</Badge>
										<Badge variant="outline">
											{labels.pendingCount(workflow.pending_approval_count)}
										</Badge>
									</div>
								</div>
							))
						)}
					</div>
				</div>

				<div className="grid gap-3 rounded-lg border bg-background p-3">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<h3 className="text-sm font-medium">{labels.recommendedActions}</h3>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{labels.recommendedActionsDescription}
							</p>
						</div>
						<ListChecks className="mt-0.5 size-4 text-muted-foreground" />
					</div>
					<div className="grid gap-2">
						{recommendedOperationActions.map((action) => (
							<button
								key={`${action.code}-${action.target ?? 'default'}`}
								type="button"
								className="flex items-center justify-between gap-3 rounded-md border bg-background px-2 py-2 text-left text-xs transition hover:border-primary/30 hover:bg-primary/5"
								onClick={() => onOperationAction(action.target)}
							>
								<span className="min-w-0 truncate">
									{labels.actionLabel(action.code, action.count ?? 0)}
								</span>
								<Badge
									variant="outline"
									className={operationSeverityClassName(action.severity)}
								>
									{labels.severityLabel(action.severity)}
								</Badge>
							</button>
						))}
					</div>
					<div className="grid grid-cols-2 gap-2 text-xs">
						<div className="rounded-md border bg-background px-2 py-2">
							<div className="font-semibold tabular-nums">
								{dashboardOperations?.pending_workflow_approval_count ?? 0}
							</div>
							<div className="text-muted-foreground">
								{labels.workflowApprovals}
							</div>
						</div>
						<div className="rounded-md border bg-background px-2 py-2">
							<div className="font-semibold tabular-nums">
								{dashboardOperations?.pending_tool_approval_count ?? 0}
							</div>
							<div className="text-muted-foreground">{labels.toolApprovals}</div>
						</div>
					</div>
				</div>
			</div>

			<div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
				<div className="grid gap-3 md:grid-cols-2">
					<div className="grid gap-3 rounded-lg border bg-background p-3">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<h3 className="text-sm font-medium">{labels.pendingApprovals}</h3>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{labels.pendingApprovalsDescription(approvedApprovalCount)}
								</p>
							</div>
							<div className="text-2xl font-semibold tabular-nums">
								{pendingApprovals.length}
							</div>
						</div>
						<div className="grid gap-2">
							{pendingApprovals.length === 0 ? (
								<p className="text-xs text-muted-foreground">
									{labels.emptyApprovals}
								</p>
							) : (
								pendingApprovals.slice(0, 3).map((approval) => (
									<div
										key={approval.approval_id}
										className="flex items-center justify-between gap-3 rounded-md border bg-background px-2 py-1.5 text-xs"
									>
										<span className="min-w-0 truncate">
											{approval.tool_name ||
												approval.workflow_type ||
												approval.request_type}
										</span>
										<span className="shrink-0 text-muted-foreground">
											{approval.tenant}
										</span>
									</div>
								))
							)}
						</div>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onScrollToGovernance}
						>
							<ShieldCheck className="size-4" />
							{labels.openApprovals}
						</Button>
					</div>

					<div className="grid gap-3 rounded-lg border bg-background p-3">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<h3 className="text-sm font-medium">{labels.recentRuns}</h3>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{labels.recentRunsDescription}
								</p>
							</div>
							<div className="text-2xl font-semibold tabular-nums">
								{workflowRunCount}
							</div>
						</div>
						<div className="grid gap-2">
							{recentWorkflowRuns.length === 0 ? (
								<p className="text-xs text-muted-foreground">{labels.emptyRuns}</p>
							) : (
								recentWorkflowRuns.map((run) => (
									<div
										key={run.run_id}
										className="flex items-center justify-between gap-3 rounded-md border bg-background px-2 py-1.5 text-xs"
									>
										<span className="min-w-0 truncate">{run.workflow_name}</span>
										<Badge
											variant="outline"
											className={workflowStatusClassName(run.status)}
										>
											{labels.workflowStatusLabel(
												workflowStatusLabelKey(run.status),
											)}
										</Badge>
									</div>
								))
							)}
						</div>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onScrollToWorkflowRunner}
						>
							<Workflow className="size-4" />
							{labels.openWorkflows}
						</Button>
					</div>
				</div>

				<div className="grid gap-3 md:grid-cols-2">
					<div className="grid gap-3 rounded-lg border bg-background p-3">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<h3 className="text-sm font-medium">{labels.riskActions}</h3>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{labels.riskActionsDescription}
								</p>
							</div>
							<AlertTriangle className="mt-0.5 size-4 text-amber-600" />
						</div>
						<div className="grid gap-2">
							{riskToolItems.length === 0 ? (
								<p className="text-xs text-muted-foreground">
									{labels.emptyRiskActions}
								</p>
							) : (
								riskToolItems.slice(0, 3).map((tool) => (
									<div
										key={tool.name}
										className="flex items-center justify-between gap-3 rounded-md border bg-background px-2 py-1.5 text-xs"
									>
										<span className="min-w-0 truncate">{tool.name}</span>
										<Badge variant="outline">
											{tool.allowed ? labels.ready : labels.toConfigure}
										</Badge>
									</div>
								))
							)}
							<div className="flex items-center justify-between gap-3 rounded-md border bg-background px-2 py-1.5 text-xs">
								<span className="min-w-0 truncate">
									{labels.policyReviewWorkflow}
								</span>
								<Badge variant="outline">{labels.approvalGate}</Badge>
							</div>
						</div>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onScrollToToolRunner}
						>
							<Boxes className="size-4" />
							{labels.openTools}
						</Button>
					</div>

					<div className="grid gap-3 rounded-lg border bg-background p-3">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<h3 className="text-sm font-medium">{labels.auditTrail}</h3>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{labels.auditTrailDescription}
								</p>
							</div>
							<div className="text-2xl font-semibold tabular-nums">
								{auditEventCount}
							</div>
						</div>
						<div className="grid gap-2">
							{recentAuditEvents.length === 0 ? (
								<p className="text-xs text-muted-foreground">{labels.emptyAudit}</p>
							) : (
								recentAuditEvents.map((event, index) => (
									<div
										key={event.event_id || `${event.timestamp}-${index}`}
										className="flex items-center justify-between gap-3 rounded-md border bg-background px-2 py-1.5 text-xs"
									>
										<span className="min-w-0 truncate">
											{event.tool_name || event.event_type || '-'}
										</span>
										<span className="shrink-0 text-muted-foreground">
											{event.success === false
												? labels.auditFailure
												: labels.auditSuccess}
										</span>
									</div>
								))
							)}
						</div>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onScrollToGovernance}
						>
							<FileClock className="size-4" />
							{labels.openAudit}
						</Button>
					</div>
				</div>
			</div>

			<div className="flex flex-col gap-2 rounded-lg border bg-background p-3 md:flex-row md:items-center md:justify-between">
				<div className="min-w-0">
					<h3 className="text-sm font-medium">{labels.todo}</h3>
					<p className="mt-1 text-xs leading-5 text-muted-foreground">
						{dashboardTodoItems.length > 0
							? dashboardTodoItems.join(' · ')
							: labels.todoReady}
					</p>
				</div>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={onNextStepPrimaryAction}
					disabled={nextStepPrimaryDisabled}
				>
					<NextStepIcon className="size-4" />
					{labels.nextStepAction(nextStepMode)}
				</Button>
			</div>
		</section>
	);
}
