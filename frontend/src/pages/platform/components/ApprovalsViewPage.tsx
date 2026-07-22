import { CheckCircle2, Clock3, ListChecks, ShieldCheck, XCircle } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import { ApprovalsPanel, type ApprovalFormState } from './ApprovalsPanel';
import {
	PlatformConnectionCard,
	PlatformMetricsGrid,
	PlatformPageHeader,
	PlatformPageShell,
	StatCard,
} from './common';
import type {
	EnterpriseApprovalRequestItem,
	EnterprisePublishedAgent,
	EnterpriseToolCatalogItem,
} from '@/api';

type Translate = (key: string, options?: Record<string, unknown>) => string;

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

interface ToolInputConfig {
	inputKey: string;
	labelKey: string;
	defaultValue: string;
}

interface ApprovalsViewPageProps {
	serverUrl: string;
	username: string;
	hasErrors: boolean;
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
	currentTenant?: string;
	currentUserId?: string;
	toolInputConfig: Record<string, ToolInputConfig>;
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

export function ApprovalsViewPage({
	serverUrl,
	username,
	hasErrors,
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
}: ApprovalsViewPageProps) {
	const pendingApprovalRate =
		approvalSummary.total > 0
			? Math.round((approvalSummary.pending / approvalSummary.total) * 100)
			: 0;

	return (
		<PlatformPageShell>
			<PlatformPageHeader
				icon={ShieldCheck}
				eyebrow={t('platform.approvals.title')}
				title={t('platform.approvals.title')}
				description={t('platform.approvals.description')}
				aside={
					<PlatformConnectionCard
						serverUrl={serverUrl}
						username={username}
						hasErrors={hasErrors}
						labels={{
							server: t('platform.connection.server'),
							user: t('platform.connection.user'),
							health: t('platform.connection.health'),
							partial: t('platform.connection.partial'),
							connected: t('platform.connection.connected'),
						}}
					/>
				}
			/>

			<PlatformMetricsGrid>
				<StatCard
					label={t('platform.approvals.total')}
					value={approvalSummary.total}
					helper={t('platform.approvals.listDescription')}
					icon={ListChecks}
					loading={approvalLoading}
				/>
				<StatCard
					label={t('platform.approvals.pending')}
					value={approvalSummary.pending}
					helper={`${pendingApprovalRate}%`}
					icon={Clock3}
					loading={approvalLoading}
				/>
				<StatCard
					label={t('platform.approvals.approved')}
					value={approvalSummary.approved}
					helper={t('platform.approvals.approve')}
					icon={CheckCircle2}
					loading={approvalLoading}
				/>
				<StatCard
					label={t('platform.approvals.rejected')}
					value={approvalSummary.rejected}
					helper={t('platform.approvals.reject')}
					icon={XCircle}
					loading={approvalLoading}
				/>
			</PlatformMetricsGrid>

			<ApprovalsPanel
				approvalForm={approvalForm}
				onApprovalFormChange={onApprovalFormChange}
				approvalFilters={approvalFilters}
				onApprovalFiltersChange={onApprovalFiltersChange}
				approvalRequests={approvalRequests}
				approvalLoading={approvalLoading}
				approvalError={approvalError}
				creatingApproval={creatingApproval}
				decidingApprovalId={decidingApprovalId}
				continuingApprovalId={continuingApprovalId}
				workflowOptions={workflowOptions}
				availableToolItems={availableToolItems}
				activePlatformAgents={activePlatformAgents}
				selectedRunAgentId={selectedRunAgentId}
				selectedIdentityUserId={selectedIdentityUserId}
				username={username}
				currentTenant={currentTenant}
				currentUserId={currentUserId}
				toolInputConfig={toolInputConfig}
				onCreateApproval={onCreateApproval}
				onRefetchApprovals={onRefetchApprovals}
				onApproveAndRun={onApproveAndRun}
				onDecideApproval={onDecideApproval}
				onUseApproval={onUseApproval}
				summarizeAuditObject={summarizeAuditObject}
				t={t}
			/>
		</PlatformPageShell>
	);
}
