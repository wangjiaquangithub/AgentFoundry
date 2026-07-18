import {
	AlertTriangle,
	Archive,
	ArrowRight,
	BotMessageSquare,
	Boxes,
	Brain,
	KeyRound,
	LibraryBig,
	ListChecks,
	Pencil,
	Play,
	RefreshCcw,
	Save,
	ShieldCheck,
	Workflow,
	X,
} from 'lucide-react';
import type { ComponentType, RefObject } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { formatTimestamp } from '../platform-utils';
import { PlatformNotice, StateBadge, type HealthState } from './common';

type AgentManagementPanelProps = {
	agentManagementRef: RefObject<HTMLElement | null>;
	agentTemplateStepRef: RefObject<HTMLDivElement | null>;
	agentModelStepRef: RefObject<HTMLDivElement | null>;
	agentKnowledgeStepRef: RefObject<HTMLDivElement | null>;
	agentToolsStepRef: RefObject<HTMLDivElement | null>;
	agentRuntimeStepRef: RefObject<HTMLDivElement | null>;
	platformAgents: any;
	agentOpsSummary: Record<string, any>[];
	agentReleasePipeline: Record<string, any>[];
	agentTemplates: Record<string, any>[];
	agentSetupSteps: Record<string, any>[];
	credentials: Record<string, any>[];
	knowledgeBases: Record<string, any>[];
	publishAccessMembers: Record<string, any>[];
	publishRoleOptions: string[];
	publishReleaseIssues: string[];
	publishedPlatformAgents: Record<string, any>[];
	activePlatformAgents: Record<string, any>[];
	setPublishForm: any;
	handleTogglePublishList: (
		field: 'tools' | 'knowledge_base_ids' | 'allowed_user_ids' | 'allowed_roles',
		value: string,
		checked: boolean,
	) => void;
	[key: string]: any;
};

export function AgentManagementPanel(props: AgentManagementPanelProps) {
	const {
		agentManagementRef,
		agentTemplateStepRef,
		agentModelStepRef,
		agentKnowledgeStepRef,
		agentToolsStepRef,
		agentRuntimeStepRef,
		platformAgents,
		platformAgentsLoading,
		platformAgentsError,
		agentOpsSummary,
		agentReleasePipeline,
		selectedRunAgent,
		selectedRunAgentReadinessState,
		selectedRunAgentReadinessLabel,
		selectedRunAgentModelLabel,
		selectedRunAgentKnowledgeCount,
		selectedRunAgentToolCount,
		agentTemplates,
		selectedTemplateId,
		selectedTemplate,
		publishingTemplateId,
		editingAgentId,
		agentSetupSteps,
		nextAgentSetupStep,
		publishForm,
		platformStatus,
		credentials,
		credentialsLoading,
		credentialById,
		knowledgeBases,
		knowledgeBaseById,
		publishTenant,
		publishAccessMembers,
		publishRoleOptions,
		publishBlocked,
		publishSelectedModelLabel,
		publishAccessScopeSummary,
		publishRuntimeSummary,
		publishReleaseIssues,
		publishedPlatformAgents,
		activePlatformAgents,
		selectedRunAgentId,
		selectedIdentity,
		archivingAgentId,
		bindingAgentModelId,
		bindingAgentKnowledgeId,
		bindingAgentToolsId,
		enablingAgentMemoryId,
		enablingAgentWorkflowId,
		setPublishForm,
		refetchPlatformAgents,
		handleNextAgentSetupStep,
		scrollToAgentRunner,
		handlePrimeAgentWorkflow,
		handleEditAgent,
		scrollToGovernance,
		handleConfigureTemplate,
		handleCancelEdit,
		handlePublishTenantChange,
		handleTogglePublishList,
		handlePublishAgent,
		handleBindDefaultModel,
		handleBindAvailableKnowledge,
		handleBindTemplateTools,
		handlePrimeToolApproval,
		handleEnableAgentMemory,
		handleEnableAgentWorkflow,
		handleArchiveAgent,
		handlePrimePublishedAgent,
		credentialLabel,
		shortResourceId,
		knowledgeBaseLabel,
		agentAccessAllowed,
		t,
		cn,
	} = props;

	return (
				<section
					ref={agentManagementRef}
					className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]"
				>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between xl:col-span-2">
						<div>
							<h2 className="text-base font-semibold">
								{t('platform.agentManagement.title')}
							</h2>
							<p className="text-sm text-muted-foreground">
								{t('platform.agentManagement.description')}
							</p>
						</div>
						<Button
							size="sm"
							variant="outline"
							onClick={() => void refetchPlatformAgents()}
							disabled={platformAgentsLoading}
						>
							<RefreshCcw className={cn(platformAgentsLoading && 'animate-spin')} />
							{t('platform.actions.refreshStatus')}
						</Button>
					</div>
					{platformAgentsError ? (
						<PlatformNotice className="xl:col-span-2">
							{t('platform.agentManagement.loadError')}
						</PlatformNotice>
					) : null}
					<div className="grid gap-3 xl:col-span-2">
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
							{agentOpsSummary.map((item) => (
								<div
									key={item.label}
									className="rounded-lg border bg-muted/20 p-3"
								>
									<div className="text-xs text-muted-foreground">
										{item.label}
									</div>
									<div className="mt-1 text-2xl font-semibold tabular-nums">
										{item.value}
									</div>
									<div className="mt-1 truncate text-xs text-muted-foreground">
										{item.helper}
									</div>
								</div>
							))}
						</div>
						<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.45fr)]">
							<Card size="sm" className="rounded-lg shadow-none">
								<CardHeader className="grid-cols-[1fr_auto] gap-3">
									<div className="min-w-0">
										<CardTitle className="truncate text-sm">
											{t('platform.agentManagement.pipeline.title')}
										</CardTitle>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											{t('platform.agentManagement.pipeline.description')}
										</p>
									</div>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={handleNextAgentSetupStep}
										disabled={!nextAgentSetupStep}
									>
										<ArrowRight />
										{nextAgentSetupStep
											? t('platform.agentManagement.wizard.nextAction')
											: t('platform.agentManagement.wizard.readyAction')}
									</Button>
								</CardHeader>
								<CardContent>
									<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
										{agentReleasePipeline.map((step) => {
											const StepIcon = step.icon;
											return (
												<div
													key={step.key}
													className="grid min-h-28 gap-2 rounded-lg border bg-muted/10 p-3"
												>
													<div className="flex items-start justify-between gap-2">
														<div className="flex min-w-0 items-center gap-2">
															<div className="grid size-8 shrink-0 place-items-center rounded-md border bg-background">
																<StepIcon className="size-4" />
															</div>
															<div className="min-w-0 truncate text-xs font-medium">
																{step.title}
															</div>
														</div>
														<StateBadge
															state={step.state}
															label={t(
																`platform.agentManagement.wizard.states.${step.state}`,
															)}
														/>
													</div>
													<div
														className="line-clamp-2 text-xs leading-5 text-muted-foreground"
														title={step.detail}
													>
														{step.detail}
													</div>
												</div>
											);
										})}
									</div>
								</CardContent>
							</Card>
							<Card size="sm" className="rounded-lg shadow-none">
								<CardHeader className="grid-cols-[1fr_auto] gap-3">
									<div className="min-w-0">
										<CardTitle className="truncate text-sm">
											{selectedRunAgent
												? selectedRunAgent.name
												: t(
														'platform.agentManagement.ops.noRuntimeAgent',
													)}
										</CardTitle>
										<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
											{selectedRunAgent
												? selectedRunAgent.description
												: t(
														'platform.agentManagement.ops.noRuntimeAgentHint',
													)}
										</p>
									</div>
									<StateBadge
										state={selectedRunAgentReadinessState}
										label={selectedRunAgentReadinessLabel}
									/>
								</CardHeader>
								<CardContent className="grid gap-3 text-xs">
									<div className="grid gap-2">
										<div className="flex items-center justify-between gap-3">
											<span className="text-muted-foreground">
												{t('platform.agentManagement.modelCredential')}
											</span>
											<span className="min-w-0 truncate font-mono">
												{selectedRunAgentModelLabel}
											</span>
										</div>
										<div className="flex items-center justify-between gap-3">
											<span className="text-muted-foreground">
												{t('platform.agentManagement.knowledgeBases')}
											</span>
											<span className="font-mono tabular-nums">
												{selectedRunAgentKnowledgeCount}
											</span>
										</div>
										<div className="flex items-center justify-between gap-3">
											<span className="text-muted-foreground">
												{t('platform.agentManagement.tools')}
											</span>
											<span className="font-mono tabular-nums">
												{selectedRunAgentToolCount}
											</span>
										</div>
									</div>
									<div className="flex flex-wrap gap-2">
										<Badge variant="outline">
											{t('platform.agentManagement.memory')}:{' '}
											{selectedRunAgent?.memory_enabled
												? t('platform.agentManagement.enabled')
												: t('platform.agentManagement.disabled')}
										</Badge>
										<Badge variant="outline">
											{t('platform.agentManagement.workflow')}:{' '}
											{selectedRunAgent?.workflow_enabled
												? t('platform.agentManagement.enabled')
												: t('platform.agentManagement.disabled')}
										</Badge>
									</div>
									<div className="flex flex-wrap gap-2 border-t pt-3">
										<Button
											type="button"
											size="sm"
											onClick={scrollToAgentRunner}
											disabled={!selectedRunAgent}
										>
											<Play />
											{t('platform.agentManagement.runAgent')}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={() =>
												selectedRunAgent &&
												handlePrimeAgentWorkflow(selectedRunAgent)
											}
											disabled={
												!selectedRunAgent ||
												!selectedRunAgent.workflow_enabled
											}
										>
											<Workflow />
											{t('platform.agentManagement.runWorkflow')}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={() =>
												selectedRunAgent && handleEditAgent(selectedRunAgent)
											}
											disabled={!selectedRunAgent}
										>
											<Pencil />
											{t('platform.agentManagement.edit')}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={scrollToGovernance}
										>
											<ShieldCheck />
											{t('platform.agentManagement.ops.openGovernance')}
										</Button>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
					<div className="flex flex-col gap-3">
						<div ref={agentTemplateStepRef} className="grid gap-3">
							<h3 className="text-sm font-medium text-muted-foreground">
								{t('platform.agentManagement.templates')}
							</h3>
							{platformAgentsLoading && !platformAgents ? (
								<div className="grid gap-3">
									<Skeleton className="h-32 w-full" />
									<Skeleton className="h-32 w-full" />
								</div>
							) : agentTemplates.length === 0 ? (
								<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
									{t('platform.agentManagement.emptyTemplates')}
								</div>
							) : (
								<div className="grid gap-3">
									{agentTemplates.map((template) => {
										const isSelected = selectedTemplateId === template.id;

										return (
											<Card
												key={template.id}
												size="sm"
												className={cn(
													'rounded-lg shadow-none',
													isSelected && 'border-primary/60 bg-primary/5',
												)}
											>
												<CardHeader className="grid-cols-[1fr_auto] gap-3">
													<div className="min-w-0">
														<CardTitle className="truncate text-sm">
															{template.name}
														</CardTitle>
														<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
															{template.description}
														</p>
													</div>
													<Button
														size="sm"
														variant={isSelected ? 'default' : 'outline'}
														onClick={() =>
															handleConfigureTemplate(template)
														}
														disabled={Boolean(publishingTemplateId)}
													>
														<ListChecks />
														{t('platform.agentManagement.configure')}
													</Button>
												</CardHeader>
												<CardContent className="grid gap-3 text-xs">
													<div className="flex flex-wrap gap-2">
														{template.tools.map((toolName: string) => (
															<Badge
																key={toolName}
																variant="outline"
																className="max-w-full truncate font-mono"
																title={toolName}
															>
																{toolName}
															</Badge>
														))}
													</div>
													<div className="flex flex-wrap gap-2">
														{template.capabilities.map((capability: string) => (
															<Badge
																key={capability}
																variant="secondary"
																className="max-w-full truncate font-mono"
																title={capability}
															>
																{capability}
															</Badge>
														))}
													</div>
												</CardContent>
											</Card>
										);
									})}
								</div>
							)}
						</div>
					</div>

					<div className="flex flex-col gap-3">
						<div>
							<h2 className="text-base font-semibold">
								{t('platform.agentManagement.configuration')}
							</h2>
							<p className="text-sm text-muted-foreground">
								{t('platform.agentManagement.configurationDescription')}
							</p>
						</div>
						<Card size="sm" className="rounded-lg shadow-none">
							<CardHeader className="grid-cols-[1fr_auto] gap-3">
								<div className="min-w-0">
									<CardTitle className="truncate text-sm">
										{selectedTemplate
											? selectedTemplate.name
											: t('platform.agentManagement.selectTemplateFirst')}
									</CardTitle>
									<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
										{selectedTemplate
											? selectedTemplate.description
											: t('platform.agentManagement.selectTemplateHint')}
									</p>
								</div>
								{selectedTemplate ? (
									<div className="flex shrink-0 flex-wrap justify-end gap-2">
										<StateBadge
											state={editingAgentId ? 'partial' : 'ready'}
											label={
												editingAgentId
													? t('platform.agentManagement.edit')
													: t('platform.agentManagement.selected')
											}
										/>
										{editingAgentId ? (
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={handleCancelEdit}
												disabled={Boolean(publishingTemplateId)}
											>
												<X />
												{t('platform.agentManagement.cancelEdit')}
											</Button>
										) : null}
									</div>
								) : null}
							</CardHeader>
							<CardContent className="grid gap-4">
								<div className="grid gap-3 rounded-lg border bg-muted/10 p-3">
									<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
										<div className="min-w-0">
											<div className="text-sm font-medium">
												{t('platform.agentManagement.wizard.title')}
											</div>
											<div className="mt-1 text-xs text-muted-foreground">
												{nextAgentSetupStep
													? t(
															'platform.agentManagement.wizard.nextMissing',
															{
																step: nextAgentSetupStep.title,
															},
														)
													: t(
															'platform.agentManagement.wizard.ready',
														)}
											</div>
										</div>
										<Button
											type="button"
											size="sm"
											variant={nextAgentSetupStep ? 'default' : 'outline'}
											onClick={handleNextAgentSetupStep}
											disabled={!nextAgentSetupStep}
										>
											<ArrowRight />
											{nextAgentSetupStep
												? t('platform.agentManagement.wizard.nextAction')
												: t('platform.agentManagement.wizard.readyAction')}
										</Button>
									</div>
									<div className="grid gap-2">
										{agentSetupSteps.map((step) => (
											<div
												key={step.key}
												className="grid gap-2 rounded-md border bg-background p-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
											>
												<div className="min-w-0">
													<div className="truncate text-xs font-medium">
														{step.title}
													</div>
													<div className="mt-0.5 truncate text-xs text-muted-foreground">
														{step.detail}
													</div>
												</div>
												<StateBadge
													state={step.state}
													label={t(
														`platform.agentManagement.wizard.states.${step.state}`,
													)}
												/>
											</div>
										))}
									</div>
								</div>
								{selectedTemplate ? (
									<>
										<div className="grid gap-3 sm:grid-cols-2">
											<div className="grid gap-2">
												<label className="text-xs font-medium text-muted-foreground">
													{t('platform.agentManagement.name')}
												</label>
												<Input
													value={publishForm.name}
													onChange={(event) =>
														setPublishForm((current: Record<string, any>) => ({
															...current,
															name: event.target.value,
														}))
													}
												/>
											</div>
											<div className="grid gap-2">
												<label className="text-xs font-medium text-muted-foreground">
													{t('platform.agentManagement.tenant')}
												</label>
												<Input
													value={publishForm.tenant}
													placeholder={
														platformStatus?.current_user.tenant
													}
													onChange={(event) =>
														handlePublishTenantChange(
															event.target.value,
														)
													}
												/>
											</div>
										</div>

										<div className="grid gap-2">
											<label className="text-xs font-medium text-muted-foreground">
												{t('platform.agentManagement.descriptionLabel')}
											</label>
											<Textarea
												value={publishForm.description}
												className="min-h-20"
												onChange={(event) =>
													setPublishForm((current: Record<string, any>) => ({
														...current,
														description: event.target.value,
													}))
												}
											/>
										</div>

										<div ref={agentModelStepRef} className="grid gap-2">
											<label className="text-xs font-medium text-muted-foreground">
												{t('platform.agentManagement.modelCredential')}
											</label>
											{credentials.length > 0 ? (
												<Select
													value={publishForm.model_config_id}
													onValueChange={(value) =>
														setPublishForm((current: Record<string, any>) => ({
															...current,
															model_config_id: value,
														}))
													}
												>
													<SelectTrigger disabled={credentialsLoading}>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{publishForm.model_config_id &&
														!credentialById.has(
															publishForm.model_config_id,
														) ? (
															<SelectItem
																value={
																	publishForm.model_config_id
																}
															>
																{shortResourceId(
																	publishForm.model_config_id,
																)}
															</SelectItem>
														) : null}
														{credentials.map((credential) => (
															<SelectItem
																key={credential.id}
																value={credential.id}
															>
																{credentialLabel(credential)} ·{' '}
																{shortResourceId(credential.id)}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											) : (
												<div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
													{t('platform.agentManagement.noModel')}
												</div>
											)}
										</div>

										<div ref={agentKnowledgeStepRef} className="grid gap-2">
											<div className="flex items-center justify-between gap-3">
												<label className="text-xs font-medium text-muted-foreground">
													{t('platform.agentManagement.knowledgeBases')}
												</label>
												<Badge variant="outline">
													{t(
														'platform.agentManagement.selectedKnowledge',
														{
															count: publishForm.knowledge_base_ids
																.length,
														},
													)}
												</Badge>
											</div>
											{knowledgeBases.length > 0 ||
											publishForm.knowledge_base_ids.length > 0 ? (
												<div className="grid max-h-36 gap-2 overflow-y-auto rounded-lg border bg-muted/10 p-3">
													{publishForm.knowledge_base_ids
														.filter(
															(knowledgeBaseId: string) =>
																!knowledgeBaseById.has(
																	knowledgeBaseId,
																),
														)
														.map((knowledgeBaseId: string) => (
															<label
																key={knowledgeBaseId}
																className="flex items-start gap-2 text-xs"
															>
																<Checkbox
																	checked
																	onCheckedChange={(checked) =>
																		handleTogglePublishList(
																			'knowledge_base_ids',
																			knowledgeBaseId,
																			checked === true,
																		)
																	}
																/>
																<span className="min-w-0">
																	<span className="block truncate font-medium">
																		{shortResourceId(
																			knowledgeBaseId,
																		)}
																	</span>
																	<span className="block truncate text-muted-foreground">
																		{t(
																			'platform.agentManagement.unavailableResource',
																		)}
																	</span>
																</span>
															</label>
														))}
													{knowledgeBases.map((knowledgeBase) => (
														<label
															key={knowledgeBase.id}
															className="flex items-start gap-2 text-xs"
														>
															<Checkbox
																checked={publishForm.knowledge_base_ids.includes(
																	knowledgeBase.id,
																)}
																onCheckedChange={(checked) =>
																	handleTogglePublishList(
																		'knowledge_base_ids',
																		knowledgeBase.id,
																		checked === true,
																	)
																}
															/>
															<span className="min-w-0">
																<span className="block truncate font-medium">
																	{knowledgeBaseLabel(
																		knowledgeBase,
																	)}
																</span>
																<span className="block truncate text-muted-foreground">
																	{shortResourceId(
																		knowledgeBase.id,
																	)}
																</span>
															</span>
														</label>
													))}
												</div>
											) : (
												<div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
													{t('platform.agentManagement.noKnowledge')}
												</div>
											)}
										</div>

										<div ref={agentToolsStepRef} className="grid gap-2">
											<label className="text-xs font-medium text-muted-foreground">
												{t('platform.agentManagement.tools')}
											</label>
											<div className="grid gap-2 rounded-lg border bg-muted/10 p-3">
												{selectedTemplate.tools.map((toolName: string) => (
													<label
														key={toolName}
														className="flex items-center gap-2 text-xs"
													>
														<Checkbox
															checked={publishForm.tools.includes(
																toolName,
															)}
															onCheckedChange={(checked) =>
																handleTogglePublishList(
																	'tools',
																	toolName,
																	checked === true,
																)
															}
														/>
														<span className="min-w-0 truncate font-mono">
															{toolName}
														</span>
													</label>
												))}
											</div>
										</div>

										<div className="grid gap-3 rounded-lg border bg-muted/10 p-3">
											<div className="flex flex-col gap-1">
												<div className="text-xs font-medium">
													{t('platform.agentManagement.accessScope')}
												</div>
												<div className="text-xs leading-5 text-muted-foreground">
													{t(
														'platform.agentManagement.accessScopeDescription',
													)}
													<span className="block">
														{t('platform.agentManagement.accessTenantHint', {
															tenant: publishTenant,
														})}
													</span>
												</div>
											</div>
											<div className="grid gap-3 lg:grid-cols-2">
												<div className="grid gap-2">
													<div className="flex items-center justify-between gap-2">
														<label className="text-xs font-medium text-muted-foreground">
															{t(
																'platform.agentManagement.allowedUsers',
															)}
														</label>
														<Badge variant="outline">
															{t(
																'platform.agentManagement.accessUsersCount',
																{
																	count: publishForm
																		.allowed_user_ids.length,
																},
															)}
														</Badge>
													</div>
													{publishAccessMembers.length > 0 ? (
														<div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border bg-background p-2">
															{publishAccessMembers.map((member) => (
																<label
																	key={member.user_id}
																	className="flex items-start gap-2 text-xs"
																>
																	<Checkbox
																		checked={publishForm.allowed_user_ids.includes(
																			member.user_id,
																		)}
																		disabled={
																			member.status ===
																			'inactive'
																		}
																		onCheckedChange={(checked) =>
																			handleTogglePublishList(
																				'allowed_user_ids',
																				member.user_id,
																				checked === true,
																			)
																		}
																	/>
																	<span className="grid min-w-0 gap-1">
																		<span className="truncate font-medium">
																			{member.display_name ||
																				member.user_id}
																		</span>
																		<span className="truncate font-mono text-muted-foreground">
																			{member.user_id}
																		</span>
																		<span className="flex flex-wrap gap-1">
																			<Badge
																				variant="outline"
																				className="text-[10px]"
																			>
																				{member.tenant}
																			</Badge>
																			{member.role ? (
																				<Badge
																					variant="secondary"
																					className="text-[10px]"
																				>
																					{member.role}
																				</Badge>
																			) : null}
																			{member.status ===
																			'inactive' ? (
																				<Badge
																					variant="outline"
																					className="text-[10px]"
																				>
																					{t(
																						'platform.members.inactive',
																					)}
																				</Badge>
																			) : null}
																		</span>
																	</span>
																</label>
															))}
														</div>
													) : (
														<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
															{t(
																'platform.agentManagement.noneConfigured',
															)}
														</div>
													)}
												</div>
												<div className="grid gap-2">
													<div className="flex items-center justify-between gap-2">
														<label className="text-xs font-medium text-muted-foreground">
															{t(
																'platform.agentManagement.allowedRoles',
															)}
														</label>
														<Badge variant="outline">
															{t(
																'platform.agentManagement.accessRolesCount',
																{
																	count: publishForm
																		.allowed_roles.length,
																},
															)}
														</Badge>
													</div>
													{publishRoleOptions.length > 0 ? (
														<div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border bg-background p-2">
															{publishRoleOptions.map((role) => (
																<label
																	key={role}
																	className="flex items-center gap-2 text-xs"
																>
																	<Checkbox
																		checked={publishForm.allowed_roles.includes(
																			role,
																		)}
																		onCheckedChange={(checked) =>
																			handleTogglePublishList(
																				'allowed_roles',
																				role,
																				checked === true,
																			)
																		}
																	/>
																	<span className="min-w-0 truncate font-mono">
																		{role}
																	</span>
																</label>
															))}
														</div>
													) : (
														<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
															{t(
																'platform.agentManagement.noneConfigured',
															)}
														</div>
													)}
												</div>
											</div>
											{publishForm.allowed_user_ids.length === 0 &&
											publishForm.allowed_roles.length === 0 ? (
												<Badge variant="outline" className="w-fit">
													{t('platform.agentManagement.accessOpen')}
												</Badge>
											) : null}
										</div>

										<div
											ref={agentRuntimeStepRef}
											className="grid gap-2 sm:grid-cols-2"
										>
											<div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/10 p-3">
												<div>
													<div className="text-xs font-medium">
														{t('platform.agentManagement.memory')}
													</div>
													<div className="text-xs text-muted-foreground">
														{publishForm.memory_enabled
															? t('platform.agentManagement.enabled')
															: t(
																	'platform.agentManagement.disabled',
																)}
													</div>
												</div>
												<Switch
													checked={publishForm.memory_enabled}
													onCheckedChange={(checked) =>
														setPublishForm((current: Record<string, any>) => ({
															...current,
															memory_enabled: checked,
														}))
													}
												/>
											</div>
											<div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/10 p-3">
												<div>
													<div className="text-xs font-medium">
														{t('platform.agentManagement.workflow')}
													</div>
													<div className="text-xs text-muted-foreground">
														{publishForm.workflow_enabled
															? t('platform.agentManagement.enabled')
															: t(
																	'platform.agentManagement.disabled',
																)}
													</div>
												</div>
												<Switch
													checked={publishForm.workflow_enabled}
													onCheckedChange={(checked) =>
														setPublishForm((current: Record<string, any>) => ({
															...current,
															workflow_enabled: checked,
														}))
													}
												/>
											</div>
										</div>

										<div className="grid gap-3 rounded-lg border bg-muted/10 p-3">
											<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
												<div>
													<div className="text-xs font-medium">
														{t('platform.agentManagement.releaseSummary')}
													</div>
													<div className="text-xs text-muted-foreground">
														{t(
															'platform.agentManagement.releaseSummaryDescription',
														)}
													</div>
												</div>
												<StateBadge
													state={publishBlocked ? 'blocked' : 'ready'}
													label={
														publishBlocked
															? t(
																	'platform.agentManagement.readiness.blocked',
																)
															: t(
																	'platform.agentManagement.releaseReady',
																)
													}
												/>
											</div>
											<div className="grid gap-2 sm:grid-cols-2">
												<div className="rounded-md border bg-background p-2">
													<div className="text-[11px] text-muted-foreground">
														{t('platform.agentManagement.releaseTenant')}
													</div>
													<div className="truncate text-xs font-medium">
														{publishTenant}
													</div>
												</div>
												<div className="rounded-md border bg-background p-2">
													<div className="text-[11px] text-muted-foreground">
														{t('platform.agentManagement.releaseModel')}
													</div>
													<div className="truncate text-xs font-medium">
														{publishSelectedModelLabel}
													</div>
												</div>
												<div className="rounded-md border bg-background p-2">
													<div className="text-[11px] text-muted-foreground">
														{t('platform.agentManagement.releaseKnowledge')}
													</div>
													<div className="truncate text-xs font-medium">
														{t(
															'platform.agentManagement.selectedKnowledge',
															{
																count: publishForm
																	.knowledge_base_ids.length,
															},
														)}
													</div>
												</div>
												<div className="rounded-md border bg-background p-2">
													<div className="text-[11px] text-muted-foreground">
														{t('platform.agentManagement.releaseTools')}
													</div>
													<div className="truncate text-xs font-medium">
														{t(
															'platform.agentManagement.wizard.toolsSelected',
															{
																count: publishForm.tools.length,
															},
														)}
													</div>
												</div>
												<div className="rounded-md border bg-background p-2">
													<div className="text-[11px] text-muted-foreground">
														{t('platform.agentManagement.releaseAccess')}
													</div>
													<div className="truncate text-xs font-medium">
														{publishAccessScopeSummary}
													</div>
												</div>
												<div className="rounded-md border bg-background p-2">
													<div className="text-[11px] text-muted-foreground">
														{t('platform.agentManagement.releaseRuntime')}
													</div>
													<div className="truncate text-xs font-medium">
														{publishRuntimeSummary}
													</div>
												</div>
											</div>
											{publishReleaseIssues.length > 0 ? (
												<div className="grid gap-1">
													{publishReleaseIssues.map((issue: string) => (
														<div
															key={issue}
															className="flex items-center gap-2 text-xs text-muted-foreground"
														>
															<AlertTriangle className="size-3.5 text-amber-500" />
															<span>{issue}</span>
														</div>
													))}
												</div>
											) : null}
											<div className="flex flex-wrap gap-2">
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={scrollToAgentRunner}
													disabled={
														!selectedRunAgentId &&
														activePlatformAgents.length === 0
													}
												>
													<Play />
													{t(
														'platform.agentManagement.releaseRunAfterPublish',
													)}
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={scrollToGovernance}
												>
													<ShieldCheck />
													{t(
														'platform.agentManagement.releaseOpenGovernance',
													)}
												</Button>
											</div>
										</div>

										<Button
											className="justify-center"
											onClick={() => void handlePublishAgent()}
											disabled={Boolean(publishingTemplateId) || publishBlocked}
										>
											{editingAgentId ? (
												<Save
													className={cn(
														publishingTemplateId && 'animate-pulse',
													)}
												/>
											) : (
												<BotMessageSquare
													className={cn(
														publishingTemplateId && 'animate-pulse',
													)}
												/>
											)}
											{publishingTemplateId
												? editingAgentId
													? t('platform.agentManagement.saving')
													: t('platform.agentManagement.publishing')
												: editingAgentId
													? t('platform.agentManagement.saveConfigured')
													: t(
															'platform.agentManagement.publishConfigured',
														)}
										</Button>
									</>
								) : (
									<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
										{t('platform.agentManagement.selectTemplateHint')}
									</div>
								)}
							</CardContent>
						</Card>

						<div>
							<h2 className="text-base font-semibold">
								{t('platform.agentManagement.published')}
							</h2>
							<p className="text-sm text-muted-foreground">
								{t('platform.agents.description')}
							</p>
						</div>
						{platformAgentsLoading && !platformAgents ? (
							<div className="grid gap-3">
								<Skeleton className="h-36 w-full" />
								<Skeleton className="h-36 w-full" />
							</div>
						) : publishedPlatformAgents.length === 0 ? (
							<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
								{t('platform.agentManagement.emptyAgents')}
							</div>
						) : (
							<div className="grid gap-3">
								{publishedPlatformAgents.map((agent) => {
									const agentKnowledgeBaseIds = agent.knowledge_base_ids ?? [];
									const agentTools = agent.tools ?? [];
										const agentAllowedUserIds = agent.allowed_user_ids ?? [];
										const agentAllowedRoles = agent.allowed_roles ?? [];
										const accessSummary = agent.access_summary;
										const isAgentAccessRestricted =
											agentAllowedUserIds.length > 0 ||
											agentAllowedRoles.length > 0;
									const isCurrentIdentityAllowedForAgent = agentAccessAllowed(
										agent,
										selectedIdentity,
									);
									const isArchived = agent.status !== 'published';
									const isArchiving = archivingAgentId === agent.id;
									const isBindingModel = bindingAgentModelId === agent.id;
									const isBindingKnowledge =
										bindingAgentKnowledgeId === agent.id;
									const isBindingTools = bindingAgentToolsId === agent.id;
									const isEnablingMemory =
										enablingAgentMemoryId === agent.id;
									const isEnablingWorkflow =
										enablingAgentWorkflowId === agent.id;
									const agentTemplate = agentTemplates.find(
										(template) => template.id === agent.template_id,
									);
									const agentTemplateTools = agentTemplate?.tools ?? [];
									const readiness = agent.readiness;
									const readinessState: HealthState = isArchived
										? 'todo'
										: readiness?.status ?? 'partial';
									const readinessLabel = isArchived
										? t('platform.agentManagement.archived')
										: t(
												`platform.agentManagement.readiness.${readinessState}`,
											);
									const modelCredential = agent.model_config_id
										? credentialById.get(agent.model_config_id)
										: undefined;
									const modelLabel = modelCredential
										? credentialLabel(modelCredential)
										: agent.model_config_id ||
											t('platform.agentManagement.noneConfigured');
									const knowledgeLabels = agentKnowledgeBaseIds.map(
										(knowledgeBaseId: string) => {
											const knowledgeBase =
												knowledgeBaseById.get(knowledgeBaseId);
											return knowledgeBase
												? knowledgeBaseLabel(knowledgeBase)
												: knowledgeBaseId;
										},
									);
									const isAgentBusy =
										Boolean(publishingTemplateId) ||
										isArchiving ||
										isBindingModel ||
										isBindingKnowledge ||
										isBindingTools ||
										isEnablingMemory ||
										isEnablingWorkflow;
									const canBindTemplateTools =
										agentTools.length === 0 &&
										!isArchived &&
										agentTemplateTools.length > 0;
									const approvalRequiredTools =
										readiness?.checks.approval_required_tools ??
										readiness?.issues.find(
										(issue: Record<string, any>) => issue.code === 'approval_required_tools',
										)?.tools ??
										[];
									const primaryApprovalTool = approvalRequiredTools[0];
									const repairActions: Array<{
										key: string;
										label: string;
										pendingLabel: string;
										icon: ComponentType<{ className?: string }>;
										pending: boolean;
										onClick: () => void;
									}> = [];
									if (!agent.model_config_id && !isArchived) {
										repairActions.push({
											key: 'missing_model',
											label: t('platform.agentManagement.bindModel'),
											pendingLabel: t(
												'platform.agentManagement.bindingModel',
											),
											icon: KeyRound,
											pending: isBindingModel,
											onClick: () => void handleBindDefaultModel(agent),
										});
									}
									if (
										agentKnowledgeBaseIds.length === 0 &&
										!isArchived
									) {
										repairActions.push({
											key: 'missing_knowledge',
											label: t('platform.agentManagement.bindKnowledge'),
											pendingLabel: t(
												'platform.agentManagement.bindingKnowledge',
											),
											icon: LibraryBig,
											pending: isBindingKnowledge,
											onClick: () =>
												void handleBindAvailableKnowledge(agent),
										});
									}
									if (canBindTemplateTools) {
										repairActions.push({
											key: 'missing_tools',
											label: t('platform.agentManagement.bindTools'),
											pendingLabel: t(
												'platform.agentManagement.bindingTools',
											),
											icon: Boxes,
											pending: isBindingTools,
											onClick: () => void handleBindTemplateTools(agent),
										});
									}
									if (primaryApprovalTool && !isArchived) {
										repairActions.push({
											key: 'approval_required_tools',
											label: t('platform.agentManagement.createToolApproval'),
											pendingLabel: t(
												'platform.agentManagement.createToolApproval',
											),
											icon: ShieldCheck,
											pending: false,
											onClick: () =>
												handlePrimeToolApproval(agent, primaryApprovalTool),
										});
									}
									if (!agent.memory_enabled && !isArchived) {
										repairActions.push({
											key: 'memory_disabled',
											label: t('platform.agentManagement.enableMemory'),
											pendingLabel: t(
												'platform.agentManagement.enablingMemory',
											),
											icon: Brain,
											pending: isEnablingMemory,
											onClick: () => void handleEnableAgentMemory(agent),
										});
									}
									if (!agent.workflow_enabled && !isArchived) {
										repairActions.push({
											key: 'workflow_disabled',
											label: t('platform.agentManagement.enableWorkflow'),
											pendingLabel: t(
												'platform.agentManagement.enablingWorkflow',
											),
											icon: Workflow,
											pending: isEnablingWorkflow,
											onClick: () => void handleEnableAgentWorkflow(agent),
										});
									}

									return (
										<Card
											key={agent.id}
											size="sm"
											className="rounded-lg shadow-none"
										>
											<CardHeader className="grid-cols-[1fr_auto] gap-3">
												<div className="min-w-0">
													<CardTitle className="truncate text-sm">
														{agent.name}
													</CardTitle>
													<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
														{agent.description}
													</p>
												</div>
												<div className="flex shrink-0 flex-col items-end gap-2">
													<StateBadge
														state={readinessState}
														label={readinessLabel}
													/>
													<div className="flex flex-wrap justify-end gap-2">
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() => handleEditAgent(agent)}
															disabled={
																isAgentBusy
															}
														>
															<Pencil />
															{t('platform.agentManagement.edit')}
														</Button>
														{!agent.model_config_id && !isArchived ? (
															<Button
																type="button"
																size="sm"
																variant="outline"
																onClick={() =>
																	void handleBindDefaultModel(
																		agent,
																	)
																}
																disabled={isAgentBusy}
															>
																<KeyRound
																	className={cn(
																		isBindingModel &&
																			'animate-pulse',
																	)}
																/>
																{isBindingModel
																	? t(
																			'platform.agentManagement.bindingModel',
																		)
																	: t(
																			'platform.agentManagement.bindModel',
																		)}
															</Button>
														) : null}
														{agentKnowledgeBaseIds.length === 0 &&
														!isArchived ? (
															<Button
																type="button"
																size="sm"
																variant="outline"
																onClick={() =>
																	void handleBindAvailableKnowledge(
																		agent,
																	)
																}
																disabled={isAgentBusy}
															>
																<LibraryBig
																	className={cn(
																		isBindingKnowledge &&
																			'animate-pulse',
																	)}
																/>
																{isBindingKnowledge
																	? t(
																			'platform.agentManagement.bindingKnowledge',
																		)
																	: t(
																			'platform.agentManagement.bindKnowledge',
																		)}
																</Button>
															) : null}
														{canBindTemplateTools ? (
															<Button
																type="button"
																size="sm"
																variant="outline"
																onClick={() =>
																	void handleBindTemplateTools(
																		agent,
																	)
																}
																disabled={isAgentBusy}
															>
																<Boxes
																	className={cn(
																		isBindingTools &&
																			'animate-pulse',
																	)}
																/>
																{isBindingTools
																	? t(
																			'platform.agentManagement.bindingTools',
																		)
																	: t(
																			'platform.agentManagement.bindTools',
																		)}
															</Button>
														) : null}
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() =>
																void handleArchiveAgent(agent)
															}
															disabled={
																isArchived ||
																isAgentBusy
															}
														>
															<Archive
																className={cn(
																	isArchiving && 'animate-pulse',
																)}
															/>
															{isArchiving
																? t(
																		'platform.agentManagement.archiving',
																	)
																: t(
																		'platform.agentManagement.archive',
																	)}
														</Button>
														<Button
															type="button"
															size="sm"
															variant={
																selectedRunAgentId === agent.id
																	? 'default'
																	: 'outline'
															}
															onClick={() =>
																handlePrimePublishedAgent(agent.id)
															}
															disabled={
																isArchived ||
																isAgentBusy ||
																!isCurrentIdentityAllowedForAgent
															}
														>
															<Play />
															{t('platform.agentManagement.runAgent')}
														</Button>
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() => handlePrimeAgentWorkflow(agent)}
															disabled={
																isArchived ||
																isAgentBusy ||
																!agent.workflow_enabled ||
																!isCurrentIdentityAllowedForAgent
															}
														>
															<Workflow />
															{t('platform.agentManagement.runWorkflow')}
														</Button>
													</div>
												</div>
											</CardHeader>
											<CardContent className="grid gap-3 text-xs">
												<div className="grid gap-2 sm:grid-cols-2">
													<div className="min-w-0">
														<div className="text-muted-foreground">
															{t('platform.agentManagement.tenant')}
														</div>
														<div
															className="mt-1 truncate font-mono"
															title={agent.tenant}
														>
															{agent.tenant}
														</div>
													</div>
													<div className="min-w-0">
														<div className="text-muted-foreground">
															{t(
																'platform.agentManagement.modelCredential',
															)}
														</div>
														<div
															className="mt-1 truncate font-mono"
															title={modelLabel}
														>
															{modelLabel}
														</div>
													</div>
												</div>
												{readiness ? (
													<div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
														<div className="flex flex-wrap gap-2">
															<Badge variant="outline">
																{t(
																	'platform.agentManagement.readinessModel',
																)}
																:{' '}
																{readiness.summary.model_configured
																	? t(
																			'platform.agentManagement.enabled',
																		)
																	: t(
																			'platform.agentManagement.disabled',
																		)}
															</Badge>
															<Badge variant="outline">
																{t(
																	'platform.agentManagement.readinessKnowledge',
																	{
																		count: readiness.summary
																			.knowledge_base_count,
																	},
																)}
															</Badge>
															<Badge variant="outline">
																{t(
																	'platform.agentManagement.readinessTools',
																	{
																		count: readiness.summary
																			.tool_count,
																	},
																)}
															</Badge>
															{readiness.summary
																.approval_required_tool_count > 0 ? (
																<Badge
																	variant="outline"
																	className="border-amber-500/30 bg-amber-500/10 text-amber-700"
																>
																	{t(
																		'platform.agentManagement.readinessApprovalTools',
																		{
																			count: readiness.summary
																				.approval_required_tool_count,
																		},
																	)}
																</Badge>
															) : null}
														</div>
														{readiness.issues.length > 0 ? (
															<div className="grid gap-1">
																{readiness.issues.map((issue: Record<string, any>) => (
																	<div
																		key={issue.code}
																		className="flex gap-2 text-xs leading-5 text-muted-foreground"
																	>
																		<span
																			className={cn(
																				'mt-2 size-1.5 shrink-0 rounded-full',
																				issue.severity ===
																					'blocking'
																					? 'bg-red-500'
																					: issue.severity ===
																						  'warning'
																						? 'bg-amber-500'
																						: 'bg-slate-400',
																			)}
																		/>
																		<span>{issue.message}</span>
																	</div>
																))}
															</div>
														) : (
															<div className="text-xs text-muted-foreground">
																{t(
																	'platform.agentManagement.readinessNoIssues',
																)}
															</div>
														)}
														{repairActions.length > 0 ? (
															<div className="flex flex-wrap items-center gap-2 border-t pt-3">
																<span className="text-xs font-medium text-foreground">
																	{t(
																		'platform.agentManagement.repairTitle',
																	)}
																</span>
																{repairActions.map((action) => {
																	const ActionIcon = action.icon;
																	return (
																		<Button
																			key={action.key}
																			type="button"
																			size="sm"
																			variant="outline"
																			onClick={action.onClick}
																			disabled={isAgentBusy}
																			className="h-8"
																		>
																			<ActionIcon
																				className={cn(
																					action.pending &&
																						'animate-pulse',
																				)}
																			/>
																			{action.pending
																				? action.pendingLabel
																				: action.label}
																		</Button>
																	);
																})}
															</div>
														) : readiness.issues.length > 0 ? (
															<div className="border-t pt-3 text-xs text-muted-foreground">
																{t(
																	'platform.agentManagement.repairHint',
																)}
															</div>
														) : null}
													</div>
												) : null}
												<div className="grid gap-2 sm:grid-cols-2">
													<div className="min-w-0">
														<div className="text-muted-foreground">
															{t(
																'platform.agentManagement.createdBy',
															)}
														</div>
														<div
															className="mt-1 truncate font-mono"
															title={agent.created_by}
														>
															{agent.created_by}
														</div>
													</div>
													<div className="min-w-0">
														<div className="text-muted-foreground">
															{t(
																'platform.agentManagement.createdAt',
															)}
														</div>
														<div className="mt-1 truncate font-mono">
															{formatTimestamp(agent.created_at)}
														</div>
													</div>
												</div>
												<div className="flex flex-wrap gap-2">
													<Badge
														variant="outline"
														className={cn(
															agent.memory_enabled &&
																'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
														)}
													>
														{t('platform.agentManagement.memory')}:{' '}
														{agent.memory_enabled
															? t('platform.agentManagement.enabled')
															: t(
																	'platform.agentManagement.disabled',
																)}
													</Badge>
													<Badge
														variant="outline"
														className={cn(
															agent.workflow_enabled &&
																'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
														)}
													>
														{t('platform.agentManagement.workflow')}:{' '}
														{agent.workflow_enabled
															? t('platform.agentManagement.enabled')
															: t(
																	'platform.agentManagement.disabled',
															)}
													</Badge>
													<Badge
														variant="outline"
														className={cn(
															!isCurrentIdentityAllowedForAgent &&
																'border-red-500/30 bg-red-500/10 text-red-700',
														)}
													>
															{accessSummary?.open_to_tenant
																? t(
																		'platform.agentManagement.accessTenantOpen',
																	)
																: isAgentAccessRestricted
																? isCurrentIdentityAllowedForAgent
																	? t(
																			'platform.agentRunner.accessAllowed',
																	)
																: t(
																		'platform.agentManagement.accessDenied',
																	)
																: t(
																		'platform.agentManagement.accessOpen',
																	)}
														</Badge>
														{accessSummary?.access_scope_valid === false ? (
															<Badge
																variant="outline"
																className="border-red-500/30 bg-red-500/10 text-red-700"
															>
																{t(
																	'platform.agentManagement.accessScopeInvalid',
																)}
															</Badge>
														) : null}
														{accessSummary ? (
															<Badge variant="outline">
																{t(
																	'platform.agentManagement.accessMatchedMembers',
																	{
																		count:
																			accessSummary.active_member_count,
																	},
																)}
															</Badge>
														) : null}
														{accessSummary &&
														accessSummary.inactive_member_count > 0 ? (
															<Badge variant="outline">
																{t(
																	'platform.agentManagement.accessInactiveMembers',
																	{
																		count:
																			accessSummary.inactive_member_count,
																	},
																)}
															</Badge>
														) : null}
														{agentAllowedUserIds.length > 0 ? (
														<Badge variant="outline">
															{t(
																'platform.agentManagement.accessUsersCount',
																{
																	count: agentAllowedUserIds.length,
																},
															)}
														</Badge>
													) : null}
													{agentAllowedRoles.length > 0 ? (
														<Badge variant="outline">
															{t(
																'platform.agentManagement.accessRolesCount',
																{
																	count: agentAllowedRoles.length,
																},
															)}
														</Badge>
													) : null}
												</div>
												<div className="grid gap-2">
													<div className="text-muted-foreground">
														{t(
															'platform.agentManagement.knowledgeBases',
														)}
													</div>
													{knowledgeLabels.length > 0 ? (
														<div className="flex flex-wrap gap-2">
															{knowledgeLabels.map((label: string) => (
																<Badge
																	key={label}
																	variant="outline"
																	className="max-w-full truncate"
																	title={label}
																>
																	{label}
																</Badge>
															))}
														</div>
													) : (
														<div className="text-muted-foreground">
															{t(
																'platform.agentManagement.noneConfigured',
															)}
														</div>
													)}
												</div>
												<div className="grid gap-2">
													<div className="text-muted-foreground">
														{t('platform.agentManagement.tools')}
													</div>
													<div className="flex flex-wrap gap-2">
														{agent.tools.map((toolName: string) => (
															<Badge
																key={toolName}
																variant="outline"
																className="max-w-full truncate font-mono"
																title={toolName}
															>
																{toolName}
															</Badge>
														))}
													</div>
												</div>
												<div className="grid gap-2">
													<div className="text-muted-foreground">
														{t('platform.agentManagement.capabilities')}
													</div>
													<div className="flex flex-wrap gap-2">
														{agent.capabilities.map((capability: string) => (
															<Badge
																key={capability}
																variant="secondary"
																className="max-w-full truncate font-mono"
																title={capability}
															>
																{capability}
															</Badge>
														))}
													</div>
												</div>
											</CardContent>
										</Card>
									);
								})}
							</div>
						)}
					</div>
				</section>
	);
}
