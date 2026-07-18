import {
	ArrowRight,
	CheckCircle2,
	ListChecks,
	Play,
	RefreshCcw,
	ShieldCheck,
	XCircle,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import type {
	EnterpriseApprovalRequestItem,
	EnterpriseApprovalRequestType,
	EnterprisePublishedAgent,
	EnterpriseToolCatalogItem,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { approvalStatusClassName, formatTimestamp } from '../platform-utils';
import { PlatformNotice } from './common';

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

interface ApprovalSummary {
	total: number;
	pending: number;
	approved: number;
	rejected: number;
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
	approvalSummary: ApprovalSummary;
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

export function ApprovalsPanel({
	approvalForm,
	onApprovalFormChange,
	approvalFilters,
	onApprovalFiltersChange,
	approvalSummary,
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

	return (
				<section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
					<div className="flex flex-col gap-3">
						<div className="flex items-start gap-2">
							<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/20">
								<ShieldCheck className="size-4 text-muted-foreground" />
							</div>
							<div className="min-w-0">
								<h2 className="text-base font-semibold">
									{t('platform.approvals.title')}
								</h2>
								<p className="text-sm text-muted-foreground">
									{t('platform.approvals.description')}
								</p>
							</div>
						</div>

						<div className="grid gap-4 rounded-lg border bg-muted/10 p-4">
							<div>
								<h3 className="text-sm font-semibold">
									{t('platform.approvals.createTitle')}
								</h3>
								<p className="text-xs text-muted-foreground">
									{t('platform.approvals.createDescription')}
								</p>
							</div>

							<div className="grid gap-3 md:grid-cols-2">
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
													<SelectItem
														key={workflow.value}
														value={workflow.value}
													>
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

							<div className="grid gap-3 md:grid-cols-2">
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
									onChange={(event) =>
										onApprovalFormChange((current) => ({
											...current,
											reason: event.target.value,
										}))
									}
								/>
							</div>

							<div className="grid gap-3 md:grid-cols-2">
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

							<div className="flex justify-end">
								<Button onClick={onCreateApproval} disabled={creatingApproval}>
									<ListChecks className={cn(creatingApproval && 'animate-pulse')} />
									{creatingApproval
										? t('platform.approvals.creating')
										: t('platform.approvals.create')}
								</Button>
							</div>
						</div>
					</div>

					<div className="flex flex-col gap-3">
						<div className="flex items-start justify-between gap-3">
							<div>
								<h3 className="text-sm font-semibold">
									{t('platform.approvals.listTitle')}
								</h3>
								<p className="text-xs text-muted-foreground">
									{t('platform.approvals.listDescription')}
								</p>
							</div>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => void onRefetchApprovals()}
								disabled={approvalLoading}
							>
								<RefreshCcw className={cn(approvalLoading && 'animate-spin')} />
								{t('platform.approvals.refresh')}
							</Button>
						</div>

						<div className="grid gap-2 sm:grid-cols-4">
							<div className="rounded-lg border bg-muted/10 p-3">
								<div className="text-xs text-muted-foreground">
									{t('platform.approvals.total')}
								</div>
								<div className="mt-1 text-lg font-semibold">{approvalSummary.total}</div>
							</div>
							<div className="rounded-lg border bg-amber-500/10 p-3">
								<div className="text-xs text-amber-800">
									{t('platform.approvals.pending')}
								</div>
								<div className="mt-1 text-lg font-semibold text-amber-900">
									{approvalSummary.pending}
								</div>
							</div>
							<div className="rounded-lg border bg-emerald-500/10 p-3">
								<div className="text-xs text-emerald-800">
									{t('platform.approvals.approved')}
								</div>
								<div className="mt-1 text-lg font-semibold text-emerald-900">
									{approvalSummary.approved}
								</div>
							</div>
							<div className="rounded-lg border bg-red-500/10 p-3">
								<div className="text-xs text-red-800">
									{t('platform.approvals.rejected')}
								</div>
								<div className="mt-1 text-lg font-semibold text-red-900">
									{approvalSummary.rejected}
								</div>
							</div>
						</div>

						<div className="grid gap-3 rounded-lg border bg-muted/10 p-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
							<div className="grid gap-2">
								<label className="text-xs font-medium text-muted-foreground">
									{t('platform.approvals.filterStatus')}
								</label>
								<Select
									value={approvalFilters.status || ALL_APPROVAL_STATUSES_VALUE}
									onValueChange={(value) =>
										onApprovalFiltersChange((current) => ({
											...current,
											status:
												value === ALL_APPROVAL_STATUSES_VALUE ? '' : value,
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
								className="self-end"
								onClick={() => void onRefetchApprovals()}
								disabled={approvalLoading}
							>
								<ListChecks />
								{t('platform.approvals.applyFilters')}
							</Button>
						</div>

						{approvalError ? <PlatformNotice>{approvalError}</PlatformNotice> : null}

						{approvalLoading ? (
							<div className="grid gap-2">
								{[0, 1, 2].map((item) => (
									<Skeleton key={item} className="h-32 rounded-lg" />
								))}
							</div>
						) : approvalRequests.length === 0 ? (
							<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
								{t('platform.approvals.empty')}
							</div>
						) : (
							<div className="grid gap-2">
								{approvalRequests.map((approval) => {
									const target =
										approval.tool_name ||
										approval.workflow_type ||
										approval.agent_id ||
										approval.request_type;
									const isDeciding = decidingApprovalId === approval.approval_id;
									const isContinuing =
										continuingApprovalId === approval.approval_id;
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
											className="rounded-lg border bg-background p-3"
										>
											<div className="flex flex-wrap items-start justify-between gap-3">
												<div className="min-w-0">
													<div className="flex flex-wrap items-center gap-2">
														<Badge
															variant="outline"
															className={cn(
																approvalStatusClassName(approval.status),
															)}
														>
															{t(`platform.approvals.${approval.status}`)}
														</Badge>
														<Badge variant="secondary">
															{t(
																`platform.approvals.${approval.request_type === 'tool_run' ? 'toolRun' : approval.request_type === 'workflow_run' ? 'workflowRun' : 'agentAction'}`,
															)}
														</Badge>
														<span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
															{target}
														</span>
													</div>
													<p className="mt-2 text-sm">
														{approval.reason || '-'}
													</p>
												</div>
												{approval.status === 'pending' ? (
													<div className="flex shrink-0 gap-2">
														{canApproveAndRun ? (
															<Button
																type="button"
																size="sm"
																onClick={() =>
																	void onApproveAndRun(approval)
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
															onClick={() =>
																void onDecideApproval(
																	approval.approval_id,
																	'approved',
																)
															}
															disabled={isDeciding || isContinuing}
														>
															<CheckCircle2
																className={cn(
																	isDeciding && 'animate-pulse',
																)}
															/>
															{isDeciding
																? t('platform.approvals.approving')
																: t('platform.approvals.approve')}
														</Button>
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() =>
																void onDecideApproval(
																	approval.approval_id,
																	'rejected',
																)
															}
															disabled={isDeciding || isContinuing}
														>
															<XCircle
																className={cn(
																	isDeciding && 'animate-pulse',
																)}
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
														onClick={() => onUseApproval(approval)}
													>
														<ArrowRight />
														{t('platform.approvals.useForRun')}
													</Button>
												) : null}
											</div>

											<div className="mt-3 grid gap-1 text-xs text-muted-foreground">
												<div className="flex flex-wrap gap-1">
													<span>{t('platform.approvals.approvalId')}:</span>
													<span className="break-all font-mono">
														{approval.approval_id}
													</span>
												</div>
												<div className="flex flex-wrap gap-1">
													<span>{t('platform.audit.inputs')}:</span>
													<span>{summarizeAuditObject(approval.inputs)}</span>
												</div>
												<div className="flex flex-wrap gap-1">
													<span>{t('platform.approvals.requestedBy')}:</span>
													<span className="font-mono">
														{approval.requested_by} / {approval.user_id}
													</span>
												</div>
												<div className="flex flex-wrap gap-1">
													<span>{t('platform.approvals.requestedAt')}:</span>
													<span>{formatTimestamp(approval.requested_at)}</span>
												</div>
												{approval.decided_at ? (
													<div className="flex flex-wrap gap-1">
														<span>{t('platform.approvals.decidedAt')}:</span>
														<span>{formatTimestamp(approval.decided_at)}</span>
													</div>
												) : null}
												{approval.decided_by ? (
													<div className="flex flex-wrap gap-1">
														<span>{t('platform.approvals.decidedBy')}:</span>
														<span className="font-mono">
															{approval.decided_by}
														</span>
													</div>
												) : null}
												{approval.decision_note ? (
													<div className="flex flex-wrap gap-1">
														<span>{t('platform.approvals.decisionNote')}:</span>
														<span>{approval.decision_note}</span>
													</div>
												) : null}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</section>
	);
}
