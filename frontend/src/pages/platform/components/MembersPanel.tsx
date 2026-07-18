import {
	BotMessageSquare,
	Building2,
	Pencil,
	RefreshCcw,
	Save,
	ShieldCheck,
	UserRound,
} from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';

import type {
	EnterprisePlatformMember,
	EnterprisePlatformMembersResponse,
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
import { cn } from '@/lib/utils';
import { PlatformNotice } from './common';

export interface MemberFormState {
	user_id: string;
	tenant: string;
	display_name: string;
	role: string;
	status: 'active' | 'inactive';
}

export interface PlatformMemberTenantSummary {
	tenant: string;
	members: EnterprisePlatformMember[];
	activeMemberCount: number;
	inactiveMemberCount: number;
	roleNames: string[];
	agentCount: number;
	pendingApprovalCount: number;
	auditEventCount: number;
}

interface MembersPanelProps {
	membersRef: RefObject<HTMLElement | null>;
	platformMembers: EnterprisePlatformMembersResponse | null;
	platformMembersLoading: boolean;
	platformMembersError: string | null;
	platformMemberTenantSummaries: PlatformMemberTenantSummary[];
	activeMemberCount: number;
	activePlatformAgentCount: number;
	pendingApprovalCount: number;
	memberForm: MemberFormState;
	setMemberForm: Dispatch<SetStateAction<MemberFormState>>;
	savingMember: boolean;
	updatingMemberId: string | null;
	onRefreshMembers: () => void;
	onSaveMember: () => void;
	onEditMember: (member: EnterprisePlatformMember) => void;
	onToggleMemberStatus: (member: EnterprisePlatformMember) => void;
	formatTimestamp: (value?: string) => string;
	t: (key: string) => string;
}

export function MembersPanel({
	membersRef,
	platformMembers,
	platformMembersLoading,
	platformMembersError,
	platformMemberTenantSummaries,
	activeMemberCount,
	activePlatformAgentCount,
	pendingApprovalCount,
	memberForm,
	setMemberForm,
	savingMember,
	updatingMemberId,
	onRefreshMembers,
	onSaveMember,
	onEditMember,
	onToggleMemberStatus,
	formatTimestamp,
	t,
}: MembersPanelProps) {
	return (
		<section
			ref={membersRef}
			className="grid gap-4 rounded-lg border bg-muted/10 p-4"
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<UserRound className="size-4" />
						<span>{t('platform.members.title')}</span>
					</div>
					<h2 className="text-base font-semibold">
						{t('platform.members.title')}
					</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{t('platform.members.description')}
					</p>
				</div>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={onRefreshMembers}
					disabled={platformMembersLoading}
				>
					<RefreshCcw className={cn(platformMembersLoading && 'animate-spin')} />
					{t('platform.actions.refreshStatus')}
				</Button>
			</div>

			{platformMembersError ? (
				<PlatformNotice>{platformMembersError}</PlatformNotice>
			) : null}

			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-lg border bg-background p-3">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Building2 className="size-4" />
						<span>{t('platform.members.organizationOverview')}</span>
					</div>
					<div className="mt-2 text-2xl font-semibold">
						{platformMemberTenantSummaries.length}
					</div>
					<p className="mt-1 text-xs text-muted-foreground">
						{t('platform.members.tenantGroups')}
					</p>
				</div>
				<div className="rounded-lg border bg-background p-3">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<UserRound className="size-4" />
						<span>{t('platform.members.activeMembers')}</span>
					</div>
					<div className="mt-2 text-2xl font-semibold">{activeMemberCount}</div>
					<p className="mt-1 text-xs text-muted-foreground">
						{t('platform.members.inactiveMembers')}:{' '}
						{platformMembers?.members.filter(
							(member) => member.status === 'inactive',
						).length ?? 0}
					</p>
				</div>
				<div className="rounded-lg border bg-background p-3">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<ShieldCheck className="size-4" />
						<span>{t('platform.members.roles')}</span>
					</div>
					<div className="mt-2 text-2xl font-semibold">
						{platformMembers?.roles.length ?? 0}
					</div>
					<p className="mt-1 text-xs text-muted-foreground">
						{t('platform.members.permissionNote')}
					</p>
				</div>
				<div className="rounded-lg border bg-background p-3">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<BotMessageSquare className="size-4" />
						<span>{t('platform.members.boundAgents')}</span>
					</div>
					<div className="mt-2 text-2xl font-semibold">
						{activePlatformAgentCount}
					</div>
					<p className="mt-1 text-xs text-muted-foreground">
						{t('platform.members.pendingApprovals')}: {pendingApprovalCount}
					</p>
				</div>
			</div>

			<div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
				<div className="grid gap-3 rounded-lg border bg-background p-3">
					<h3 className="text-sm font-medium">{t('platform.members.save')}</h3>
					<div className="grid gap-3 sm:grid-cols-2">
						<label className="grid gap-1 text-xs sm:col-span-2">
							<span className="text-muted-foreground">
								{t('platform.members.userId')}
							</span>
							<Input
								value={memberForm.user_id}
								onChange={(event) =>
									setMemberForm((previous) => ({
										...previous,
										user_id: event.target.value,
									}))
								}
								placeholder="acme:alice"
							/>
						</label>
						<label className="grid gap-1 text-xs">
							<span className="text-muted-foreground">
								{t('platform.members.tenant')}
							</span>
							<Input
								value={memberForm.tenant}
								onChange={(event) =>
									setMemberForm((previous) => ({
										...previous,
										tenant: event.target.value,
									}))
								}
								placeholder="acme"
							/>
						</label>
						<label className="grid gap-1 text-xs">
							<span className="text-muted-foreground">
								{t('platform.members.role')}
							</span>
							<Input
								value={memberForm.role}
								onChange={(event) =>
									setMemberForm((previous) => ({
										...previous,
										role: event.target.value,
									}))
								}
								placeholder="Finance reviewer"
							/>
						</label>
						<label className="grid gap-1 text-xs">
							<span className="text-muted-foreground">
								{t('platform.members.displayName')}
							</span>
							<Input
								value={memberForm.display_name}
								onChange={(event) =>
									setMemberForm((previous) => ({
										...previous,
										display_name: event.target.value,
									}))
								}
							/>
						</label>
						<label className="grid gap-1 text-xs">
							<span className="text-muted-foreground">
								{t('platform.members.status')}
							</span>
							<Select
								value={memberForm.status}
								onValueChange={(value) =>
									setMemberForm((previous) => ({
										...previous,
										status: value === 'inactive' ? 'inactive' : 'active',
									}))
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="active">
										{t('platform.members.active')}
									</SelectItem>
									<SelectItem value="inactive">
										{t('platform.members.inactive')}
									</SelectItem>
								</SelectContent>
							</Select>
						</label>
					</div>
					<div className="flex justify-end">
						<Button
							type="button"
							size="sm"
							onClick={onSaveMember}
							disabled={savingMember}
						>
							<Save className={cn(savingMember && 'animate-pulse')} />
							{savingMember
								? t('platform.members.saving')
								: t('platform.members.save')}
						</Button>
					</div>
				</div>

				<div className="grid gap-3 rounded-lg border bg-background p-3">
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-sm font-medium">
							{t('platform.members.groupedListTitle')}
						</h3>
						<Badge variant="outline">{platformMembers?.members.length ?? 0}</Badge>
					</div>
					{platformMembersLoading && !platformMembers ? (
						<div className="grid gap-2">
							<Skeleton className="h-20 rounded-lg" />
							<Skeleton className="h-20 rounded-lg" />
						</div>
					) : platformMemberTenantSummaries.length ? (
						<div className="grid gap-2">
							{platformMemberTenantSummaries.map((tenantSummary) => (
								<div
									key={tenantSummary.tenant}
									className="grid gap-3 rounded-md border bg-muted/10 p-3"
								>
									<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<h4 className="text-sm font-medium">
													{tenantSummary.tenant}
												</h4>
												<Badge variant="secondary">
													{tenantSummary.activeMemberCount}{' '}
													{t('platform.members.activeMembers')}
												</Badge>
												{tenantSummary.inactiveMemberCount > 0 ? (
													<Badge
														variant="outline"
														className="border-amber-500/30 bg-amber-500/10 text-amber-700"
													>
														{tenantSummary.inactiveMemberCount}{' '}
														{t('platform.members.inactiveMembers')}
													</Badge>
												) : null}
											</div>
											<div className="mt-2 flex flex-wrap gap-1">
												<Badge variant="outline">
													{t('platform.members.roles')}:{' '}
													{tenantSummary.roleNames.length}
												</Badge>
												<Badge variant="outline">
													{t('platform.members.boundAgents')}:{' '}
													{tenantSummary.agentCount}
												</Badge>
												<Badge variant="outline">
													{t('platform.members.pendingApprovals')}:{' '}
													{tenantSummary.pendingApprovalCount}
												</Badge>
												<Badge variant="outline">
													{t('platform.members.auditEvents')}:{' '}
													{tenantSummary.auditEventCount}
												</Badge>
											</div>
											<div className="mt-2 flex flex-wrap gap-1">
												{tenantSummary.roleNames.length ? (
													tenantSummary.roleNames.map((roleName) => (
														<Badge key={roleName} variant="secondary">
															{roleName}
														</Badge>
													))
												) : (
													<Badge variant="outline">
														{t('platform.members.noRole')}
													</Badge>
												)}
											</div>
										</div>
									</div>

									<div className="grid gap-2">
										{tenantSummary.members.length ? (
											tenantSummary.members.map((member) => {
												const inactive = member.status === 'inactive';
												return (
													<div
														key={`${tenantSummary.tenant}-${member.user_id}`}
														className="grid gap-3 rounded-md border bg-background p-3"
													>
														<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
															<div className="min-w-0">
																<div className="truncate text-sm font-medium">
																	{member.display_name || member.user_id}
																</div>
																<div className="font-mono text-xs text-muted-foreground">
																	{member.user_id}
																</div>
																<div className="mt-2 flex flex-wrap gap-1">
																	<Badge variant="secondary">
																		{member.tenant}
																	</Badge>
																	<Badge variant="outline">{member.role}</Badge>
																	<Badge
																		variant={
																			inactive ? 'outline' : 'secondary'
																		}
																		className={cn(
																			inactive &&
																				'border-amber-500/30 bg-amber-500/10 text-amber-700',
																		)}
																	>
																		{inactive
																			? t('platform.members.inactive')
																			: t('platform.members.active')}
																	</Badge>
																	{member.source ? (
																		<Badge variant="outline">
																			{t('platform.members.source')}:{' '}
																			{member.source}
																		</Badge>
																	) : null}
																</div>
															</div>
															<div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
																<Button
																	type="button"
																	size="sm"
																	variant="outline"
																	onClick={() => onEditMember(member)}
																>
																	<Pencil className="size-4" />
																	{t('platform.members.edit')}
																</Button>
																<Button
																	type="button"
																	size="sm"
																	variant="outline"
																	onClick={() => onToggleMemberStatus(member)}
																	disabled={updatingMemberId === member.user_id}
																>
																	<RefreshCcw
																		className={cn(
																			updatingMemberId === member.user_id &&
																				'animate-spin',
																		)}
																	/>
																	{inactive
																		? t('platform.members.enable')
																		: t('platform.members.disable')}
																</Button>
															</div>
														</div>
														<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
															<span>
																{t('platform.members.updatedAt')}:{' '}
																{formatTimestamp(member.updated_at)}
															</span>
															<span>
																{t('platform.members.updatedBy')}:{' '}
																{member.updated_by || '-'}
															</span>
														</div>
													</div>
												);
											})
										) : (
											<div className="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
												{t('platform.members.empty')}
											</div>
										)}
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
							{t('platform.members.empty')}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
