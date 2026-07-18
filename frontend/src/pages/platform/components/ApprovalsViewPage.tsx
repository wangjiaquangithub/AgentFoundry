import { ShieldCheck } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import type {
	EnterpriseApprovalRequestItem,
	EnterprisePublishedAgent,
	EnterpriseToolCatalogItem,
} from '@/api';
import { ApprovalsPanel, type ApprovalFormState } from './ApprovalsPanel';
import { StateBadge } from './common';

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
	approvalStatusClassName: (status?: string) => string;
	summarizeAuditObject: (value?: Record<string, unknown>) => string;
	formatTimestamp: (value?: string) => string;
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
	approvalStatusClassName,
	summarizeAuditObject,
	formatTimestamp,
	t,
}: ApprovalsViewPageProps) {
	return (
		<main className="h-full overflow-y-auto bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
				<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0">
						<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
							<ShieldCheck className="size-4" />
							<span>{t('platform.approvals.title')}</span>
						</div>
						<h1 className="text-2xl font-semibold tracking-normal">
							{t('platform.approvals.title')}
						</h1>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
							{t('platform.approvals.description')}
						</p>
					</div>
					<div className="grid min-w-0 gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:min-w-80">
						<div className="flex items-center justify-between gap-3">
							<span className="text-muted-foreground">
								{t('platform.connection.server')}
							</span>
							<span className="truncate font-mono" title={serverUrl}>
								{serverUrl}
							</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className="text-muted-foreground">
								{t('platform.connection.user')}
							</span>
							<span className="truncate font-mono" title={username}>
								{username}
							</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className="text-muted-foreground">
								{t('platform.connection.health')}
							</span>
							<StateBadge
								state={hasErrors ? 'partial' : 'ready'}
								label={
									hasErrors
										? t('platform.connection.partial')
										: t('platform.connection.connected')
								}
							/>
						</div>
					</div>
				</section>

				<ApprovalsPanel
					approvalForm={approvalForm}
					onApprovalFormChange={onApprovalFormChange}
					approvalFilters={approvalFilters}
					onApprovalFiltersChange={onApprovalFiltersChange}
					approvalSummary={approvalSummary}
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
					approvalStatusClassName={approvalStatusClassName}
					summarizeAuditObject={summarizeAuditObject}
					formatTimestamp={formatTimestamp}
					t={t}
				/>
			</div>
		</main>
	);
}
