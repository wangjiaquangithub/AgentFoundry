import {
	ArrowRight,
	CheckCircle2,
	ListChecks,
	Play,
	RefreshCcw,
	ShieldCheck,
	XCircle,
} from 'lucide-react';
import { useState, type Dispatch, type SetStateAction } from 'react';

import { formatTimestamp } from '../platform-utils';
import { PlatformNotice } from './common';
import { PlatformConfirmAction } from './PlatformConfirmAction';
import { PlatformEmptyState } from './PlatformEmptyState';
import { PlatformFilterBar } from './PlatformFilterBar';
import { PlatformStatusBadge } from './PlatformStatusBadge';
import type {
	EnterpriseApprovalRequestItem,
	EnterpriseApprovalRequestType,
	EnterprisePublishedAgent,
	EnterpriseToolCatalogItem,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface ApprovalFormState {
	request_type: EnterpriseApprovalRequestType;
	tool_name: string;
	workflow_type: string;
	input_key: string;
	input_value: string;
	reason: string;
	user_id: string;
	agent_id: string;
}

interface ApprovalFilters {
	status: string;
	tenant: string;
	user_id: string;
	agent_id: string;
	limit: string;
}

interface WorkflowOption {
	value: string;
	label: string;
}

interface ApprovalsPanelProps {
	approvalForm: ApprovalFormState;
	onApprovalFormChange: Dispatch<SetStateAction<ApprovalFormState>>;
	approvalFilters: ApprovalFilters;
	onApprovalFiltersChange: Dispatch<SetStateAction<ApprovalFilters>>;
	approvalRequests: EnterpriseApprovalRequestItem[];
	approvalLoading: boolean;
	approvalError: string | null;
	creatingApproval: boolean;
	decidingApprovalId: string | null;
	continuingApprovalId: string | null;
	workflowOptions: WorkflowOption[];
	availableToolItems: EnterpriseToolCatalogItem[];
	activePlatformAgents: EnterprisePublishedAgent[];
	selectedRunAgentId: string;
	selectedIdentityUserId: string;
	username: string;
	currentTenant?: string;
	currentUserId?: string;
	toolInputConfig: Record<
		string,
		{ inputKey: string; labelKey: string; defaultValue: string }
	>;
	onCreateApproval: () => void | Promise<void>;
	onRefetchApprovals: () => void | Promise<void>;
	onApproveAndRun: (approval: EnterpriseApprovalRequestItem) => void | Promise<void>;
	onDecideApproval: (
		approvalId: string,
		decision: 'approved' | 'rejected',
	) => void | Promise<void>;
	onUseApproval: (approval: EnterpriseApprovalRequestItem) => void;
	summarizeAuditObject: (value?: Record<string, unknown>) => string;
	t: Translate;
}

const ALL_AGENTS_VALUE = '__all_agents__';
const ALL_APPROVAL_STATUSES_VALUE = '__all_approval_statuses__';

type ApprovalDecisionAction = 'approve' | 'reject' | 'approveAndRun';

interface PendingApprovalDecision {
	approval: EnterpriseApprovalRequestItem;
	action: ApprovalDecisionAction;
}

export function ApprovalsPanel({
	approvalForm,
	onApprovalFormChange,
	approvalFilters,
	onApprovalFiltersChange,
	approvalRequests,
	approvalLoading,
	approvalError,
	creatingApproval,
	decidingApprovalId,
	continuingApprovalId,
	workflowOptions,
	availableToolItems,
	activePlatformAgents,
	selectedRunAgentId,
	selectedIdentityUserId,
	username,
	currentTenant,
	currentUserId,
	toolInputConfig,
	onCreateApproval,
	onRefetchApprovals,
	onApproveAndRun,
	onDecideApproval,
	onUseApproval,
	summarizeAuditObject,
	t,
}: ApprovalsPanelProps) {
	const enterpriseToolInputConfig = toolInputConfig;
	const pendingCount = approvalRequests.filter((approval) => approval.status === 'pending').length;
	const [pendingDecision, setPendingDecision] =
		useState<PendingApprovalDecision | null>(null);
	const [createApprovalOpen, setCreateApprovalOpen] = useState(false);
	const hasActiveApprovalFilters = Boolean(
		approvalFilters.status ||
			approvalFilters.tenant.trim() ||
			approvalFilters.user_id.trim() ||
			approvalFilters.agent_id,
	);
	const clearApprovalFilters = () => {
		onApprovalFiltersChange((current) => ({
			status: '',
			tenant: '',
			user_id: '',
			agent_id: '',
			limit: current.limit || '50',
		}));
	};
	const getApprovalTarget = (approval: EnterpriseApprovalRequestItem) =>
		approval.tool_name ||
		approval.workflow_type ||
		approval.agent_id ||
		approval.request_type;
	const closePendingDecision = () => setPendingDecision(null);
	const confirmPendingDecision = async () => {
		if (!pendingDecision) {
			return;
		}

		const { approval, action } = pendingDecision;
		if (action === 'approveAndRun') {
			await onApproveAndRun(approval);
		} else {
			await onDecideApproval(
				approval.approval_id,
				action === 'approve' ? 'approved' : 'rejected',
			);
		}
		closePendingDecision();
	};
	const handleCreateApproval = async () => {
		await onCreateApproval();
		setCreateApprovalOpen(false);
	};
	const pendingDecisionTarget = pendingDecision
		? getApprovalTarget(pendingDecision.approval)
		: '';
	const pendingDecisionType = pendingDecision
		? t(
				`platform.approvals.${pendingDecision.approval.request_type === 'tool_run' ? 'toolRun' : pendingDecision.approval.request_type === 'workflow_run' ? 'workflowRun' : 'agentAction'}`,
			)
		: '';
	const pendingDecisionIsBusy = pendingDecision
		? decidingApprovalId === pendingDecision.approval.approval_id ||
			continuingApprovalId === pendingDecision.approval.approval_id
		: false;
	const pendingDecisionTitleKey =
		pendingDecision?.action === 'approveAndRun'
			? 'platform.approvals.confirmApproveAndRunTitle'
			: pendingDecision?.action === 'reject'
				? 'platform.approvals.confirmRejectTitle'
				: 'platform.approvals.confirmApproveTitle';
	const pendingDecisionBodyKey =
		pendingDecision?.action === 'approveAndRun'
			? 'platform.approvals.confirmApproveAndRunBody'
			: pendingDecision?.action === 'reject'
				? 'platform.approvals.confirmRejectBody'
				: 'platform.approvals.confirmApproveBody';
	const pendingDecisionConfirmKey =
		pendingDecision?.action === 'approveAndRun'
			? 'platform.approvals.confirmApproveAndRun'
			: pendingDecision?.action === 'reject'
				? 'platform.approvals.confirmReject'
				: 'platform.approvals.confirmApprove';

	return (
		<section className="grid gap-4">
			<Dialog open={createApprovalOpen} onOpenChange={setCreateApprovalOpen}>
				<DialogContent className="max-h-[calc(100vh-2rem)] overflow-hidden sm:max-w-3xl">
					<DialogHeader className="pr-10">
						<div className="flex items-start gap-2">
							<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
								<ShieldCheck className="size-4 text-muted-foreground" />
							</div>
							<div className="min-w-0">
								<DialogTitle>{t('platform.approvals.createTitle')}</DialogTitle>
								<DialogDescription>
									{t('platform.approvals.createDescription')}
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<div className="min-h-0 overflow-y-auto pr-1">
						<div className="grid gap-3">
					<div className="grid gap-3 sm:grid-cols-2">
						<div className="grid gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								{t('platform.approvals.requestType')}
							</label>
							<Select
								value={approvalForm.request_type}
								onValueChange={(value) =>
									onApprovalFormChange((current) => ({
										...current,
										request_type: value as EnterpriseApprovalRequestType,
									}))
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="tool_run">
										{t('platform.approvals.toolRun')}
									</SelectItem>
									<SelectItem value="workflow_run">
										{t('platform.approvals.workflowRun')}
									</SelectItem>
									<SelectItem value="agent_action">
										{t('platform.approvals.agentAction')}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{approvalForm.request_type === 'workflow_run' ? (
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.approvals.target')}
								</label>
								<Select
									value={approvalForm.workflow_type}
									onValueChange={(value) =>
										onApprovalFormChange((current) => ({
											...current,
											workflow_type: value,
										}))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{workflowOptions.map((workflow) => (
											<SelectItem key={workflow.value} value={workflow.value}>
												{workflow.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						) : approvalForm.request_type === 'tool_run' ? (
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.approvals.target')}
								</label>
								<Select
									value={approvalForm.tool_name}
									onValueChange={(value) =>
										onApprovalFormChange((current) => ({
											...current,
											tool_name: value,
											input_key:
												enterpriseToolInputConfig[value]?.inputKey ||
												current.input_key,
											input_value:
												enterpriseToolInputConfig[value]?.defaultValue ||
												current.input_value,
										}))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{availableToolItems.map((tool) => (
											<SelectItem key={tool.name} value={tool.name}>
												{tool.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						) : (
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.approvals.agent')}
								</label>
								<Input
									value={approvalForm.agent_id}
									placeholder={selectedRunAgentId || 'platform-console'}
									onChange={(event) =>
										onApprovalFormChange((current) => ({
											...current,
											agent_id: event.target.value,
										}))
									}
								/>
							</div>
						)}
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<div className="grid gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								{t('platform.approvals.inputKey')}
							</label>
							<Input
								value={approvalForm.input_key}
								onChange={(event) =>
									onApprovalFormChange((current) => ({
										...current,
										input_key: event.target.value,
									}))
								}
							/>
						</div>
						<div className="grid gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								{t('platform.approvals.inputValue')}
							</label>
							<Input
								value={approvalForm.input_value}
								onChange={(event) =>
									onApprovalFormChange((current) => ({
										...current,
										input_value: event.target.value,
									}))
								}
							/>
						</div>
					</div>

					<div className="grid gap-2">
						<label className="text-xs font-medium text-muted-foreground">
							{t('platform.approvals.reason')}
						</label>
						<Textarea
							value={approvalForm.reason}
							className="min-h-24"
							onChange={(event) =>
								onApprovalFormChange((current) => ({
									...current,
									reason: event.target.value,
								}))
							}
						/>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<div className="grid gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								{t('platform.approvals.user')}
							</label>
							<Input
								value={approvalForm.user_id}
								placeholder={selectedIdentityUserId || username}
								onChange={(event) =>
									onApprovalFormChange((current) => ({
										...current,
										user_id: event.target.value,
									}))
								}
							/>
						</div>
						<div className="grid gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								{t('platform.approvals.agent')}
							</label>
							<Input
								value={approvalForm.agent_id}
								placeholder={selectedRunAgentId || 'platform-console'}
								onChange={(event) =>
									onApprovalFormChange((current) => ({
										...current,
										agent_id: event.target.value,
									}))
								}
							/>
						</div>
					</div>
						</div>
					</div>

					<DialogFooter>
						<Button
							className="w-full sm:w-auto"
							onClick={() => void handleCreateApproval()}
							disabled={creatingApproval}
						>
							<ListChecks className={cn(creatingApproval && 'animate-pulse')} />
							{creatingApproval
								? t('platform.approvals.creating')
								: t('platform.approvals.create')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<div className="flex min-w-0 flex-col gap-4 rounded-lg border bg-background p-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="flex min-w-0 items-start gap-2">
						<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
							<ListChecks className="size-4 text-muted-foreground" />
						</div>
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<h2 className="text-sm font-semibold">
									{t('platform.approvals.listTitle')}
								</h2>
								<Badge variant="secondary">
									{t('platform.approvals.pendingCount', {
										count: pendingCount,
									})}
								</Badge>
								<Badge variant="outline">
									{t('platform.approvals.resultCount', {
										count: approvalRequests.length,
									})}
								</Badge>
							</div>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{t('platform.approvals.listDescription')}
							</p>
						</div>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row">
						<Button
							type="button"
							size="sm"
							className="w-full sm:w-auto"
							onClick={() => setCreateApprovalOpen(true)}
						>
							<ListChecks />
							{t('platform.approvals.create')}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="w-full sm:w-auto"
							onClick={() => void onRefetchApprovals()}
							disabled={approvalLoading}
						>
							<RefreshCcw className={cn(approvalLoading && 'animate-spin')} />
							{t('platform.approvals.refresh')}
						</Button>
					</div>
				</div>

				<PlatformFilterBar
					resultLabel={t('platform.ux.filters.results', {
						count: approvalRequests.length,
					})}
					clearLabel={t('platform.ux.filters.clear')}
					onClear={clearApprovalFilters}
					clearDisabled={approvalLoading || !hasActiveApprovalFilters}
				>
					<div className="grid gap-2">
						<label className="text-xs font-medium text-muted-foreground">
							{t('platform.approvals.filterStatus')}
						</label>
						<Select
							value={approvalFilters.status || ALL_APPROVAL_STATUSES_VALUE}
							onValueChange={(value) =>
								onApprovalFiltersChange((current) => ({
									...current,
									status: value === ALL_APPROVAL_STATUSES_VALUE ? '' : value,
								}))
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={ALL_APPROVAL_STATUSES_VALUE}>
									{t('platform.approvals.allStatuses')}
								</SelectItem>
								<SelectItem value="pending">
									{t('platform.approvals.pending')}
								</SelectItem>
								<SelectItem value="approved">
									{t('platform.approvals.approved')}
								</SelectItem>
								<SelectItem value="rejected">
									{t('platform.approvals.rejected')}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-2">
						<label className="text-xs font-medium text-muted-foreground">
							{t('platform.approvals.filterTenant')}
						</label>
						<Input
							value={approvalFilters.tenant}
							onChange={(event) =>
								onApprovalFiltersChange((current) => ({
									...current,
									tenant: event.target.value,
								}))
							}
							placeholder={currentTenant || 'default'}
						/>
					</div>
					<div className="grid gap-2">
						<label className="text-xs font-medium text-muted-foreground">
							{t('platform.approvals.filterUser')}
						</label>
						<Input
							value={approvalFilters.user_id}
							onChange={(event) =>
								onApprovalFiltersChange((current) => ({
									...current,
									user_id: event.target.value,
								}))
							}
							placeholder={currentUserId || username}
						/>
					</div>
					<div className="grid gap-2">
						<label className="text-xs font-medium text-muted-foreground">
							{t('platform.approvals.filterAgent')}
						</label>
						<Select
							value={approvalFilters.agent_id || ALL_AGENTS_VALUE}
							onValueChange={(value) =>
								onApprovalFiltersChange((current) => ({
									...current,
									agent_id: value === ALL_AGENTS_VALUE ? '' : value,
								}))
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={ALL_AGENTS_VALUE}>
									{t('platform.approvals.allAgents')}
								</SelectItem>
								{activePlatformAgents.map((agent) => (
									<SelectItem key={agent.id} value={agent.id}>
										{agent.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-2">
						<label className="text-xs font-medium text-muted-foreground">
							{t('platform.approvals.filterLimit')}
						</label>
						<Input
							type="number"
							min={1}
							max={200}
							value={approvalFilters.limit}
							onChange={(event) =>
								onApprovalFiltersChange((current) => ({
									...current,
									limit: event.target.value,
								}))
							}
						/>
					</div>
					<Button
						type="button"
						size="sm"
						className="self-end md:col-span-2 xl:col-span-1"
						onClick={() => void onRefetchApprovals()}
						disabled={approvalLoading}
					>
						<ListChecks />
						{t('platform.approvals.applyFilters')}
					</Button>
				</PlatformFilterBar>

				{approvalError ? <PlatformNotice>{approvalError}</PlatformNotice> : null}

				{approvalLoading ? (
					<div className="grid gap-2">
						{[0, 1, 2].map((item) => (
							<Skeleton key={item} className="h-32 rounded-lg" />
						))}
					</div>
				) : approvalRequests.length === 0 ? (
					<PlatformEmptyState
						variant={hasActiveApprovalFilters ? 'filtered' : 'noData'}
						title={
							hasActiveApprovalFilters
								? t('platform.ux.empty.filteredTitle')
								: t('platform.ux.empty.noDataTitle')
						}
						description={
							hasActiveApprovalFilters
								? t('platform.approvals.emptyFilteredDescription')
								: t('platform.ux.empty.noDataDescription')
						}
						actionLabel={
							hasActiveApprovalFilters
								? t('platform.ux.filters.clear')
								: undefined
						}
						onAction={hasActiveApprovalFilters ? clearApprovalFilters : undefined}
						className="rounded-lg border border-dashed bg-background/80 p-6"
					/>
				) : (
					<div className="grid gap-3">
						{approvalRequests.map((approval) => {
							const target = getApprovalTarget(approval);
							const isDeciding = decidingApprovalId === approval.approval_id;
							const isContinuing = continuingApprovalId === approval.approval_id;
							const canApproveAndRun =
								approval.status === 'pending' &&
								((approval.request_type === 'tool_run' &&
									Boolean(approval.tool_name)) ||
									(approval.request_type === 'workflow_run' &&
										Boolean(approval.workflow_type)));
							const canUseApproval =
								approval.status === 'approved' &&
								((approval.request_type === 'tool_run' &&
									Boolean(approval.tool_name)) ||
									(approval.request_type === 'workflow_run' &&
										Boolean(approval.workflow_type)));

							return (
								<div
									key={approval.approval_id}
									className="rounded-lg border bg-background/80 p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
								>
									<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<PlatformStatusBadge status={approval.status} t={t} />
												<Badge variant="secondary">
													{t(
														`platform.approvals.${approval.request_type === 'tool_run' ? 'toolRun' : approval.request_type === 'workflow_run' ? 'workflowRun' : 'agentAction'}`,
													)}
												</Badge>
												<span className="min-w-0 break-all font-mono text-xs text-muted-foreground">
													{target}
												</span>
											</div>
											<p className="mt-3 text-sm leading-6">
												{approval.reason || '-'}
											</p>
										</div>
										{approval.status === 'pending' ? (
											<div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
												{canApproveAndRun ? (
													<Button
														type="button"
														size="sm"
														className="w-full sm:w-auto"
														onClick={() =>
															setPendingDecision({
																approval,
																action: 'approveAndRun',
															})
														}
														disabled={isDeciding || isContinuing}
													>
														<Play
															className={cn(
																isContinuing && 'animate-pulse',
															)}
														/>
														{isContinuing
															? t(
																	'platform.approvals.approvingAndRunning',
																)
															: t('platform.approvals.approveAndRun')}
													</Button>
												) : null}
												<Button
													type="button"
													size="sm"
													variant="outline"
													className="w-full sm:w-auto"
													onClick={() =>
														setPendingDecision({
															approval,
															action: 'approve',
														})
													}
													disabled={isDeciding || isContinuing}
												>
													<CheckCircle2
														className={cn(isDeciding && 'animate-pulse')}
													/>
													{isDeciding
														? t('platform.approvals.approving')
														: t('platform.approvals.approve')}
												</Button>
												<Button
													type="button"
													size="sm"
													variant="destructive"
													className="w-full sm:w-auto"
													onClick={() =>
														setPendingDecision({
															approval,
															action: 'reject',
														})
													}
													disabled={isDeciding || isContinuing}
												>
													<XCircle
														className={cn(isDeciding && 'animate-pulse')}
													/>
													{isDeciding
														? t('platform.approvals.rejecting')
														: t('platform.approvals.reject')}
												</Button>
											</div>
										) : canUseApproval ? (
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="w-full sm:w-auto"
												onClick={() => onUseApproval(approval)}
											>
												<ArrowRight />
												{t('platform.approvals.useForRun')}
											</Button>
										) : null}
									</div>

									<div className="mt-4 grid gap-3 border-t pt-3 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
										<div className="grid gap-1">
											<span>{t('platform.approvals.approvalId')}</span>
											<span className="break-all font-mono text-foreground">
												{approval.approval_id}
											</span>
										</div>
										<div className="grid gap-1">
											<span>{t('platform.audit.inputs')}</span>
											<span className="break-words text-foreground">
												{summarizeAuditObject(approval.inputs)}
											</span>
										</div>
										<div className="grid gap-1">
											<span>{t('platform.approvals.requestedBy')}</span>
											<span className="break-all font-mono text-foreground">
												{approval.requested_by} / {approval.user_id}
											</span>
										</div>
										<div className="grid gap-1">
											<span>{t('platform.approvals.requestedAt')}</span>
											<span className="text-foreground">
												{formatTimestamp(approval.requested_at)}
											</span>
										</div>
										{approval.decided_at ? (
											<div className="grid gap-1">
												<span>{t('platform.approvals.decidedAt')}</span>
												<span className="text-foreground">
													{formatTimestamp(approval.decided_at)}
												</span>
											</div>
										) : null}
										{approval.decided_by ? (
											<div className="grid gap-1">
												<span>{t('platform.approvals.decidedBy')}</span>
												<span className="break-all font-mono text-foreground">
													{approval.decided_by}
												</span>
											</div>
										) : null}
										{approval.decision_note ? (
											<div className="grid gap-1 md:col-span-2">
												<span>{t('platform.approvals.decisionNote')}</span>
												<span className="break-words text-foreground">
													{approval.decision_note}
												</span>
											</div>
										) : null}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
			<PlatformConfirmAction
				open={Boolean(pendingDecision)}
				onOpenChange={(open) => {
					if (!open) {
						closePendingDecision();
					}
				}}
				title={t(pendingDecisionTitleKey)}
				description={t(pendingDecisionBodyKey)}
				actionLabel={t(pendingDecisionConfirmKey)}
				cancelLabel={t('common.cancel')}
				targetLabel={t('platform.ux.confirm.target')}
				targetValue={<span className="font-mono">{pendingDecisionTarget}</span>}
				impactScopeLabel={t('platform.ux.confirm.impactScope')}
				impactScope={pendingDecisionType}
				consequenceLabel={t('platform.ux.confirm.consequence')}
				consequence={t(pendingDecisionBodyKey)}
				details={
					pendingDecision
						? [
								{
									label: t('platform.approvals.approvalId'),
									value: (
										<span className="font-mono">
											{pendingDecision.approval.approval_id}
										</span>
									),
								},
								{
									label: t('platform.approvals.requestedBy'),
									value: (
										<span className="font-mono">
											{pendingDecision.approval.requested_by} /{' '}
											{pendingDecision.approval.user_id}
										</span>
									),
								},
								{
									label: t('platform.audit.inputs'),
									value: summarizeAuditObject(pendingDecision.approval.inputs),
								},
							]
						: undefined
				}
				variant={pendingDecision?.action === 'reject' ? 'destructive' : 'default'}
				loading={pendingDecisionIsBusy}
				onConfirm={confirmPendingDecision}
			/>
		</section>
	);
}
