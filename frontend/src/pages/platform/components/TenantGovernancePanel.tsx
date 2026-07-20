import {
	ArrowRight,
	Boxes,
	Database,
	FileClock,
	Play,
	Save,
	ShieldCheck,
	UserRound,
} from 'lucide-react';

import type {
	EnterpriseIdentity,
	EnterpriseTenantWorkspace,
	EnterpriseToolCatalogItem,
	EnterpriseToolDecision,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { PlatformNotice, StateBadge } from './common';
import { countArrayField } from '../platform-utils';

export type ToolPolicyDraftValue = 'allow' | 'deny' | 'inherit';

interface TenantGovernancePanelProps {
	connectorsLoading: boolean;
	hasConnectors: boolean;
	enterpriseIdentities: EnterpriseIdentity[];
	selectedIdentity: EnterpriseIdentity | null;
	currentIdentityLabel: string;
	selectedIdentityAllowedTools: EnterpriseToolDecision[];
	selectedIdentityDeniedTools: EnterpriseToolDecision[];
	toolPolicyMode: string;
	toolPolicySummary: {
		effectiveAllowed: number;
		effectiveDenied: number;
		draftAllow: number;
		draftDeny: number;
		draftInherit: number;
		pending: number;
	};
	savingToolPolicy: boolean;
	availableToolItems: EnterpriseToolCatalogItem[];
	toolPolicyDraft: Record<string, ToolPolicyDraftValue>;
	selectedIdentityPendingToolNames: Set<string>;
	selectedIdentityWorkspace: EnterpriseTenantWorkspace | null;
	toolPolicySaveError: string | null;
	toolPolicySaveSuccess: string | null;
	onSelectIdentity: (userId: string) => void;
	onUseSampleQuestion: (question: string) => void;
	onSaveToolPolicy: () => void;
	onChangeToolPolicyDraft: (toolName: string, value: ToolPolicyDraftValue) => void;
	onUseIdentity: (identity: EnterpriseIdentity) => void;
	onInspectIdentityAudit: (identity: EnterpriseIdentity) => void;
	labels: {
		title: string;
		description: string;
		currentIdentity: string;
		noIdentity: string;
		selectIdentity: string;
		sampleQuestion: string;
		policies: string;
		allowedTools: string;
		deniedTools: string;
		editToolPolicy: string;
		effectiveAllowed: string;
		effectiveDenied: string;
		policyInherited: string;
		pendingToolApprovals: string;
		draftAllowCount: (count: number) => string;
		draftDenyCount: (count: number) => string;
		draftInheritCount: (count: number) => string;
		savingPolicy: string;
		savePolicy: string;
		effectiveAllow: string;
		effectiveDeny: string;
		pendingApproval: string;
		notBoundToAgent: string;
		toolCalls: (count: number) => string;
		toolSuccesses: (count: number) => string;
		toolFailures: (count: number) => string;
		effectiveReason: string;
		configuredBy: string;
		noConfiguredAgent: string;
		policyInherit: string;
		policyAllow: string;
		policyDeny: string;
		tenantWorkspaces: string;
		source: string;
		tickets: string;
		departments: string;
		knowledgeBases: string;
		tools: string;
		identities: string;
		useIdentity: string;
		viewAudit: string;
	};
}

export function TenantGovernancePanel({
	connectorsLoading,
	hasConnectors,
	enterpriseIdentities,
	selectedIdentity,
	currentIdentityLabel,
	selectedIdentityAllowedTools,
	selectedIdentityDeniedTools,
	toolPolicyMode,
	toolPolicySummary,
	savingToolPolicy,
	availableToolItems,
	toolPolicyDraft,
	selectedIdentityPendingToolNames,
	selectedIdentityWorkspace,
	toolPolicySaveError,
	toolPolicySaveSuccess,
	onSelectIdentity,
	onUseSampleQuestion,
	onSaveToolPolicy,
	onChangeToolPolicyDraft,
	onUseIdentity,
	onInspectIdentityAudit,
	labels,
}: TenantGovernancePanelProps) {
	return (
		<section className="grid gap-4 rounded-lg border bg-background p-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="text-base font-semibold">{labels.title}</h2>
					<p className="text-sm text-muted-foreground">{labels.description}</p>
				</div>
				<StateBadge
					state={selectedIdentity ? 'ready' : 'todo'}
					label={selectedIdentity ? labels.currentIdentity : labels.noIdentity}
				/>
			</div>

			{connectorsLoading && !hasConnectors ? (
				<div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
					<Skeleton className="h-64 rounded-lg" />
					<Skeleton className="h-64 rounded-lg" />
				</div>
			) : enterpriseIdentities.length > 0 ? (
				<div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
					<div className="grid gap-3 rounded-lg border bg-background p-3">
						<div className="flex items-start gap-3">
							<div className="flex size-9 items-center justify-center rounded-lg border bg-background">
								<UserRound className="size-4 text-muted-foreground" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="text-xs text-muted-foreground">
									{labels.currentIdentity}
								</div>
								<div className="mt-1 truncate text-sm font-medium">
									{currentIdentityLabel}
								</div>
								{selectedIdentity ? (
									<div className="mt-2 flex flex-wrap gap-1">
										<Badge variant="secondary">{selectedIdentity.role}</Badge>
										<Badge variant="outline">{selectedIdentity.user_id}</Badge>
									</div>
								) : null}
							</div>
						</div>

						<div className="grid gap-2">
							<label className="text-xs text-muted-foreground">
								{labels.selectIdentity}
							</label>
							<Select
								value={selectedIdentity?.user_id ?? ''}
								onValueChange={onSelectIdentity}
							>
								<SelectTrigger>
									<SelectValue placeholder={labels.selectIdentity} />
								</SelectTrigger>
								<SelectContent>
									{enterpriseIdentities.map((identity) => (
										<SelectItem key={identity.user_id} value={identity.user_id}>
											{identity.display_name} / {identity.tenant}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{selectedIdentity?.sample_questions.length ? (
							<div className="grid gap-2">
								<div className="text-xs text-muted-foreground">
									{labels.sampleQuestion}
								</div>
								<div className="grid gap-2">
									{selectedIdentity.sample_questions.slice(0, 3).map((question) => (
										<Button
											key={question}
											type="button"
											variant="outline"
											className="h-auto justify-between gap-3 whitespace-normal text-left"
											onClick={() => onUseSampleQuestion(question)}
										>
											<span className="min-w-0 text-xs leading-5">{question}</span>
											<ArrowRight className="size-4 shrink-0" />
										</Button>
									))}
								</div>
							</div>
						) : null}
					</div>

					<div className="grid gap-3">
						<div className="grid gap-3 rounded-lg border bg-background p-3">
							<div className="flex items-center justify-between gap-3">
								<div className="flex items-center gap-2">
									<ShieldCheck className="size-4 text-muted-foreground" />
									<h3 className="text-sm font-medium">{labels.policies}</h3>
								</div>
								<Badge variant="outline">
									{selectedIdentity?.tool_policy.mode ?? toolPolicyMode}
								</Badge>
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="grid gap-2 rounded-md border bg-background p-3">
									<div className="flex items-center justify-between gap-2">
										<span className="text-xs font-medium">{labels.allowedTools}</span>
										<Badge variant="secondary">
											{selectedIdentityAllowedTools.length}
										</Badge>
									</div>
									<div className="flex flex-wrap gap-1">
										{selectedIdentityAllowedTools.length > 0 ? (
											selectedIdentityAllowedTools.map((decision) => (
												<Badge
													key={decision.name}
													variant="outline"
													className="max-w-full truncate"
													title={decision.reason}
												>
													{decision.name}
												</Badge>
											))
										) : (
											<span className="text-xs text-muted-foreground">
												{labels.noIdentity}
											</span>
										)}
									</div>
								</div>

								<div className="grid gap-2 rounded-md border bg-background p-3">
									<div className="flex items-center justify-between gap-2">
										<span className="text-xs font-medium">{labels.deniedTools}</span>
										<Badge variant="secondary">
											{selectedIdentityDeniedTools.length}
										</Badge>
									</div>
									<div className="flex flex-wrap gap-1">
										{selectedIdentityDeniedTools.length > 0 ? (
											selectedIdentityDeniedTools.map((decision) => (
												<Badge
													key={decision.name}
													variant="outline"
													className="max-w-full truncate border-amber-500/30 bg-amber-500/10 text-amber-700"
													title={decision.reason}
												>
													{decision.name}
												</Badge>
											))
										) : (
											<span className="text-xs text-muted-foreground">
												{labels.noIdentity}
											</span>
										)}
									</div>
								</div>
							</div>
							<div className="grid gap-3 rounded-md border bg-background p-3">
								<div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
									<div className="min-w-0">
										<h4 className="text-xs font-medium">{labels.editToolPolicy}</h4>
										<p className="mt-1 text-xs text-muted-foreground">
											{currentIdentityLabel}
										</p>
									</div>
									<div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
										<div className="rounded-md border bg-background px-3 py-2">
											<div className="text-muted-foreground">
												{labels.effectiveAllowed}
											</div>
											<div className="mt-1 font-semibold tabular-nums">
												{toolPolicySummary.effectiveAllowed}
											</div>
										</div>
										<div className="rounded-md border bg-background px-3 py-2">
											<div className="text-muted-foreground">
												{labels.effectiveDenied}
											</div>
											<div className="mt-1 font-semibold tabular-nums">
												{toolPolicySummary.effectiveDenied}
											</div>
										</div>
										<div className="rounded-md border bg-background px-3 py-2">
											<div className="text-muted-foreground">
												{labels.policyInherited}
											</div>
											<div className="mt-1 font-semibold tabular-nums">
												{toolPolicySummary.draftInherit}
											</div>
										</div>
										<div className="rounded-md border bg-background px-3 py-2">
											<div className="text-muted-foreground">
												{labels.pendingToolApprovals}
											</div>
											<div className="mt-1 font-semibold tabular-nums">
												{toolPolicySummary.pending}
											</div>
										</div>
									</div>
								</div>
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
									<div className="flex flex-wrap gap-1">
										<Badge variant="outline">
											{labels.draftAllowCount(toolPolicySummary.draftAllow)}
										</Badge>
										<Badge variant="outline">
											{labels.draftDenyCount(toolPolicySummary.draftDeny)}
										</Badge>
										<Badge variant="outline">
											{labels.draftInheritCount(toolPolicySummary.draftInherit)}
										</Badge>
									</div>
									<Button
										type="button"
										size="sm"
										onClick={onSaveToolPolicy}
										disabled={
											savingToolPolicy ||
											!selectedIdentity ||
											availableToolItems.length === 0
										}
									>
										<Save
											className={cn(
												'mr-2 size-3.5',
												savingToolPolicy && 'animate-pulse',
											)}
										/>
										{savingToolPolicy ? labels.savingPolicy : labels.savePolicy}
									</Button>
								</div>
								{availableToolItems.length > 0 ? (
									<div className="grid gap-2">
										{availableToolItems.map((tool) => {
											const draftValue = toolPolicyDraft[tool.name] ?? 'inherit';
											const pendingApproval = selectedIdentityPendingToolNames.has(
												tool.name,
											);
											const configuredForAgent = tool.configured_for_agent !== false;
											const effectiveAllowed = configuredForAgent && tool.allowed;
											const effectiveState = effectiveAllowed
												? 'ready'
												: pendingApproval
													? 'partial'
													: 'blocked';

											return (
												<div
													key={tool.name}
													className="grid gap-3 rounded-md border bg-background p-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)_10rem] xl:items-center"
												>
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2">
															<div className="min-w-0 truncate text-xs font-medium">
																{tool.name}
															</div>
															<StateBadge
																state={effectiveState}
																label={
																	effectiveAllowed
																		? labels.effectiveAllow
																		: labels.effectiveDeny
																}
															/>
															{pendingApproval ? (
																<Badge
																	variant="outline"
																	className="border-amber-500/30 bg-amber-500/10 text-amber-700"
																>
																	{labels.pendingApproval}
																</Badge>
															) : null}
															{!configuredForAgent ? (
																<Badge variant="outline">
																	{labels.notBoundToAgent}
																</Badge>
															) : null}
														</div>
														<div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
															{tool.description || tool.reason}
														</div>
														<div className="mt-2 flex flex-wrap gap-1">
															<Badge variant="secondary">
																{labels.toolCalls(tool.stats.calls)}
															</Badge>
															<Badge variant="outline">
																{labels.toolSuccesses(tool.stats.successes)}
															</Badge>
															<Badge variant="outline">
																{labels.toolFailures(tool.stats.failures)}
															</Badge>
														</div>
													</div>
													<div className="grid gap-2 text-xs">
														<div>
															<div className="text-muted-foreground">
																{labels.effectiveReason}
															</div>
															<div className="mt-1 line-clamp-2">{tool.reason}</div>
														</div>
														<div>
															<div className="text-muted-foreground">
																{labels.configuredBy}
															</div>
															<div className="mt-1 flex flex-wrap gap-1">
																{tool.configured_by_agents.length > 0 ? (
																	tool.configured_by_agents
																		.slice(0, 3)
																		.map((agent) => (
																			<Badge key={agent} variant="outline">
																				{agent}
																			</Badge>
																		))
																) : (
																	<span className="text-muted-foreground">
																		{labels.noConfiguredAgent}
																	</span>
																)}
															</div>
														</div>
													</div>
													<Select
														value={draftValue}
														onValueChange={(value) =>
															onChangeToolPolicyDraft(
																tool.name,
																value as ToolPolicyDraftValue,
															)
														}
													>
														<SelectTrigger className="h-8">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="inherit">
																{labels.policyInherit}
															</SelectItem>
															<SelectItem value="allow">{labels.policyAllow}</SelectItem>
															<SelectItem value="deny">{labels.policyDeny}</SelectItem>
														</SelectContent>
													</Select>
												</div>
											);
										})}
									</div>
								) : (
									<span className="text-xs text-muted-foreground">
										{labels.noIdentity}
									</span>
								)}
								{toolPolicySaveError ? (
									<PlatformNotice>{toolPolicySaveError}</PlatformNotice>
								) : null}
								{toolPolicySaveSuccess ? (
									<div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
										{toolPolicySaveSuccess}
									</div>
								) : null}
							</div>
						</div>

						<div className="grid gap-3 rounded-lg border bg-background p-3">
							<div className="flex items-center justify-between gap-3">
								<div className="flex items-center gap-2">
									<Database className="size-4 text-muted-foreground" />
									<h3 className="text-sm font-medium">{labels.tenantWorkspaces}</h3>
								</div>
								<Badge variant="outline">
									{selectedIdentityWorkspace?.source ?? labels.source}
								</Badge>
							</div>
							<div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 xl:grid-cols-6">
								<div className="rounded-md border bg-background px-3 py-2">
									<div className="text-muted-foreground">{labels.policies}</div>
									<div className="mt-1 font-semibold tabular-nums">
										{selectedIdentityWorkspace
											? countArrayField(selectedIdentityWorkspace, 'policies')
											: 0}
									</div>
								</div>
								<div className="rounded-md border bg-background px-3 py-2">
									<div className="text-muted-foreground">{labels.tickets}</div>
									<div className="mt-1 font-semibold tabular-nums">
										{selectedIdentityWorkspace
											? countArrayField(selectedIdentityWorkspace, 'tickets')
											: 0}
									</div>
								</div>
								<div className="rounded-md border bg-background px-3 py-2">
									<div className="text-muted-foreground">{labels.departments}</div>
									<div className="mt-1 font-semibold tabular-nums">
										{selectedIdentityWorkspace
											? countArrayField(selectedIdentityWorkspace, 'departments')
											: 0}
									</div>
								</div>
								<div className="rounded-md border bg-background px-3 py-2">
									<div className="text-muted-foreground">{labels.knowledgeBases}</div>
									<div className="mt-1 font-semibold tabular-nums">
										{selectedIdentityWorkspace
											? countArrayField(selectedIdentityWorkspace, 'knowledge_bases')
											: 0}
									</div>
								</div>
								<div className="rounded-md border bg-background px-3 py-2">
									<div className="text-muted-foreground">{labels.tools}</div>
									<div className="mt-1 font-semibold tabular-nums">
										{selectedIdentityWorkspace
											? countArrayField(selectedIdentityWorkspace, 'tools')
											: 0}
									</div>
								</div>
								<div className="rounded-md border bg-background px-3 py-2">
									<div className="text-muted-foreground">{labels.sampleQuestion}</div>
									<div className="mt-1 font-semibold tabular-nums">
										{selectedIdentityWorkspace?.sample_questions.length ?? 0}
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="grid gap-3 rounded-lg border bg-background p-3 lg:col-span-2">
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-2">
								<Boxes className="size-4 text-muted-foreground" />
								<h3 className="text-sm font-medium">{labels.identities}</h3>
							</div>
							<Badge variant="outline">{enterpriseIdentities.length}</Badge>
						</div>
						<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
							{enterpriseIdentities.map((identity) => (
								<div
									key={identity.user_id}
									className={cn(
										'grid gap-3 rounded-md border bg-background p-3',
										identity.user_id === selectedIdentity?.user_id &&
											'border-primary/40 bg-primary/5',
									)}
								>
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div className="min-w-0">
											<div className="truncate text-sm font-medium">
												{identity.display_name}
											</div>
											<div className="font-mono text-xs text-muted-foreground">
												{identity.user_id}
											</div>
										</div>
										<div className="flex flex-wrap gap-1">
											<Badge variant="secondary">{identity.tenant}</Badge>
											<Badge variant="outline">{identity.role}</Badge>
										</div>
									</div>
									<div className="flex flex-wrap gap-1">
										{identity.sample_questions.slice(0, 2).map((question) => (
											<Badge
												key={question}
												variant="outline"
												className="max-w-full truncate"
												title={question}
											>
												{question}
											</Badge>
										))}
									</div>
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											size="sm"
											variant={
												identity.user_id === selectedIdentity?.user_id
													? 'default'
													: 'outline'
											}
											onClick={() => onUseIdentity(identity)}
										>
											<Play className="size-4" />
											{labels.useIdentity}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={() => onInspectIdentityAudit(identity)}
										>
											<FileClock className="size-4" />
											{labels.viewAudit}
										</Button>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			) : (
				<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
					{labels.noIdentity}
				</div>
			)}
		</section>
	);
}
