import {
	AlertTriangle,
	BotMessageSquare,
	Brain,
	CheckCircle2,
	Code2,
	Database,
	FileClock,
	LibraryBig,
	ShieldCheck,
	XCircle,
} from 'lucide-react';

import type {
	EnterpriseAgentRunResponse,
	EnterpriseAgentToolCall,
	KnowledgeBaseView,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { knowledgeBaseLabel } from '../platform-utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface AgentRunnerResultProps {
	result: EnterpriseAgentRunResponse | null;
	toolCalls: EnterpriseAgentToolCall[];
	toolCallBadgeText: string;
	routingLabel?: string | null;
	routingText?: string | null;
	connectorSourceText?: string | null;
	modelLabel: string;
	knowledgeLabels: string[];
	knowledgeBaseById: Map<string, KnowledgeBaseView>;
	onInspectAudit: () => void;
	t: Translate;
}

function AgentRunnerNotice({ children }: { children: string }) {
	return (
		<div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
			<AlertTriangle className="mt-0.5 size-4 shrink-0" />
			<span className="min-w-0 break-words">{children}</span>
		</div>
	);
}

function scoreText(score: unknown) {
	return typeof score === 'number' && Number.isFinite(score) ? score.toFixed(3) : '-';
}

function timestampText(value?: string) {
	if (!value) return value;
	const createdAt = new Date(value);
	return Number.isNaN(createdAt.getTime()) ? value : createdAt.toLocaleString();
}

export function AgentRunnerResult({
	result,
	toolCalls,
	toolCallBadgeText,
	routingLabel,
	routingText,
	connectorSourceText,
	modelLabel,
	knowledgeLabels,
	knowledgeBaseById,
	onInspectAudit,
	t,
}: AgentRunnerResultProps) {
	const evidence = result?.evidence;
	const memoryHits = result?.memory_hits ?? [];
	const knowledgeHits = result?.knowledge_hits ?? [];

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-2">
				<BotMessageSquare className="size-4 text-muted-foreground" />
				<h3 className="text-sm font-semibold">{t('platform.agentRunner.answer')}</h3>
			</div>

			{result ? (
				<div className="grid gap-3">
					<div className="rounded-lg border bg-muted/10 p-4">
						<div className="mb-3 flex flex-wrap items-center gap-2">
							<Badge
								variant={result.routed ? 'outline' : 'destructive'}
								className={cn(
									result.routed &&
										'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
								)}
							>
								{result.routed
									? toolCallBadgeText
									: t('platform.agentRunner.notRouted')}
							</Badge>
							<Badge variant="outline" className="font-mono">
								{result.user_id} / {result.tenant}
							</Badge>
							{result.connector ? (
								<Badge variant="outline" className="max-w-full font-mono">
									{t('platform.agentRunner.runtimeConnector')}: {result.connector}
								</Badge>
							) : null}
							{connectorSourceText ? (
								<Badge variant="outline" className="max-w-full">
									{t('platform.agentRunner.connectorSource')}: {connectorSourceText}
								</Badge>
							) : null}
							{result.agent_name || result.agent_id ? (
								<Badge variant="outline">{result.agent_name || result.agent_id}</Badge>
							) : null}
							{routingText ? (
								<Badge
									variant="outline"
									className={cn(
										routingLabel === 'model' &&
											'border-sky-500/30 bg-sky-500/10 text-sky-700',
										routingLabel === 'rules' &&
											'border-amber-500/30 bg-amber-500/10 text-amber-700',
									)}
								>
									{t('platform.agentRunner.routingSource')}: {routingText}
								</Badge>
							) : null}
						</div>
						<p className="whitespace-pre-wrap text-sm leading-6">{result.answer}</p>
					</div>

					{evidence ? (
						<div className="grid gap-3 rounded-lg border bg-muted/10 p-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<FileClock className="size-4 text-muted-foreground" />
									<div className="text-xs font-medium text-muted-foreground">
										{t('platform.agentRunner.evidence')}
									</div>
								</div>
								<Button type="button" variant="outline" size="sm" onClick={onInspectAudit}>
									<ShieldCheck className="size-4" />
									{t('platform.agentRunner.viewAuditEvidence')}
								</Button>
							</div>
							<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
								<div className="rounded-md border bg-background/60 p-2">
									<div className="text-[11px] text-muted-foreground">
										{t('platform.agentRunner.runId')}
									</div>
									<div className="truncate font-mono text-xs">{evidence.run_id}</div>
								</div>
								<div className="rounded-md border bg-background/60 p-2">
									<div className="text-[11px] text-muted-foreground">
										{t('platform.agentRunner.sessionId')}
									</div>
									<div className="truncate font-mono text-xs">{evidence.session_id}</div>
								</div>
								<div className="rounded-md border bg-background/60 p-2">
									<div className="text-[11px] text-muted-foreground">
										{t('platform.agentRunner.auditScope')}
									</div>
									<div className="truncate font-mono text-xs">
										{evidence.user_id} / {evidence.tenant}
									</div>
								</div>
							</div>
							<div className="flex flex-wrap gap-2">
								<Badge variant="outline">
									{t('platform.agentRunner.toolCallsAllowed', {
										count: evidence.allowed_tool_call_count,
									})}
								</Badge>
								<Badge
									variant="outline"
									className={cn(
										evidence.denied_tool_call_count > 0 &&
											'border-destructive/30 bg-destructive/10 text-destructive',
									)}
								>
									{t('platform.agentRunner.toolCallsDenied', {
										count: evidence.denied_tool_call_count,
									})}
								</Badge>
								<Badge
									variant="outline"
									className={cn(
										evidence.approval_required_count > 0 &&
											'border-amber-500/30 bg-amber-500/10 text-amber-700',
									)}
								>
									{t('platform.agentRunner.approvalRequiredCount', {
										count: evidence.approval_required_count,
									})}
								</Badge>
								{evidence.approval_ids.length > 0 ? (
									<Badge variant="outline" className="max-w-full font-mono">
										{t('platform.agentRunner.approvalIds')}: {evidence.approval_ids.join(', ')}
									</Badge>
								) : null}
								<Badge variant="outline">
									{t('platform.agentRunner.knowledgeHitCount', {
										count: evidence.knowledge_hit_count,
									})}
								</Badge>
								<Badge variant="outline">
									{t('platform.agentRunner.memoryHitCount', {
										count: evidence.memory_hit_count,
									})}
								</Badge>
								<Badge
									variant="outline"
									className={cn(
										evidence.memory_saved &&
											'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
									)}
								>
									{evidence.memory_saved
										? t('platform.agentRunner.memorySaved')
										: t('platform.agentRunner.memoryNotSaved')}
								</Badge>
							</div>
						</div>
					) : null}

					{result.routing_error ? (
						<AgentRunnerNotice>
							{`${t('platform.agentRunner.fallbackNotice')} ${result.routing_error}`}
						</AgentRunnerNotice>
					) : null}

					<div className="grid gap-2 rounded-lg border bg-muted/10 p-3">
						<div className="text-xs font-medium text-muted-foreground">
							{t('platform.agentRunner.runtimeConfig')}
						</div>
						<div className="flex flex-wrap gap-2">
							<Badge variant="outline" className="max-w-full font-mono">
								{t('platform.agentRunner.configuredTenant')}:{' '}
								{result.configured_tenant || t('platform.agentManagement.noneConfigured')}
							</Badge>
							<Badge variant="outline" className="max-w-full font-mono">
								{t('platform.agentRunner.runtimeConnector')}: {result.connector || '-'}
							</Badge>
							<Badge variant="outline" className="max-w-full">
								{t('platform.agentRunner.connectorSource')}: {connectorSourceText || '-'}
							</Badge>
							<Badge variant="outline" className="max-w-full truncate">
								{t('platform.agentManagement.modelCredential')}: {modelLabel}
							</Badge>
							<Badge
								variant="outline"
								className={cn(
									result.memory_enabled &&
										'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
								)}
							>
								{t('platform.agentManagement.memory')}:{' '}
								{result.memory_enabled
									? t('platform.agentManagement.enabled')
									: t('platform.agentManagement.disabled')}
							</Badge>
							<Badge
								variant="outline"
								className={cn(
									result.workflow_enabled &&
										'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
								)}
							>
								{t('platform.agentManagement.workflow')}:{' '}
								{result.workflow_enabled
									? t('platform.agentManagement.enabled')
									: t('platform.agentManagement.disabled')}
							</Badge>
						</div>
						<div className="grid gap-2">
							<div className="text-xs text-muted-foreground">
								{t('platform.agentManagement.knowledgeBases')}
							</div>
							{knowledgeLabels.length > 0 ? (
								<div className="flex flex-wrap gap-2">
									{knowledgeLabels.map((label) => (
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
								<div className="text-xs text-muted-foreground">
									{t('platform.agentManagement.noneConfigured')}
								</div>
							)}
						</div>
						<div className="grid gap-2">
							<div className="text-xs text-muted-foreground">
								{t('platform.agentManagement.tools')}
							</div>
							{(result.configured_tools ?? []).length > 0 ? (
								<div className="flex flex-wrap gap-2">
									{(result.configured_tools ?? []).map((toolName) => (
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
							) : (
								<div className="text-xs text-muted-foreground">
									{t('platform.agentManagement.noneConfigured')}
								</div>
							)}
						</div>
					</div>

					<div className="grid gap-2 rounded-lg border bg-muted/10 p-3">
						<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
							<Brain className="size-4" />
							<span>{t('platform.agentRunner.memoryHits')}</span>
						</div>
						<div className="flex flex-wrap gap-2">
							<Badge
								variant="outline"
								className={cn(
									result.memory_saved &&
										'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
								)}
							>
								{result.memory_saved
									? t('platform.agentRunner.memorySaved')
									: `${t('platform.agentManagement.memory')}: ${
											result.memory_enabled
												? t('platform.agentManagement.enabled')
												: t('platform.agentManagement.disabled')
										}`}
							</Badge>
							{result.memory_scope ? (
								<Badge variant="outline" className="max-w-full truncate font-mono">
									{t('platform.agentRunner.memoryScope')}: {result.memory_scope.tenant}/
									{result.memory_scope.user_id}/{result.memory_scope.agent_id}
								</Badge>
							) : null}
						</div>
						{memoryHits.length > 0 ? (
							<div className="grid gap-2">
								{memoryHits.map((hit, index) => {
									const toolNames = hit.tool_names ?? [];

									return (
										<div
											key={hit.id || `${hit.source}-${index}`}
											className="grid gap-2 rounded-md border bg-background p-3"
										>
											<div className="flex flex-wrap items-center gap-2">
												<Badge
													variant="outline"
													className="max-w-full truncate font-mono"
													title={hit.source}
												>
													<FileClock className="size-3" />
													{t('platform.agentRunner.memorySource')}: {hit.source}
												</Badge>
												<Badge variant="outline" className="font-mono">
													{t('platform.agentRunner.memoryScore')}: {scoreText(hit.score)}
												</Badge>
												{timestampText(hit.created_at) ? (
													<Badge variant="outline" className="font-mono">
														{timestampText(hit.created_at)}
													</Badge>
												) : null}
												{toolNames.map((toolName) => (
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
											<p className="whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
												{hit.snippet}
											</p>
										</div>
									);
								})}
							</div>
						) : (
							<div className="text-xs text-muted-foreground">
								{t('platform.agentRunner.memoryHitsEmpty')}
							</div>
						)}
					</div>

					<div className="grid gap-2 rounded-lg border bg-muted/10 p-3">
						<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
							<LibraryBig className="size-4" />
							<span>{t('platform.agentRunner.knowledgeHits')}</span>
						</div>
						{result.knowledge_error ? (
							<AgentRunnerNotice>
								{`${t('platform.agentRunner.knowledgeError')} ${result.knowledge_error}`}
							</AgentRunnerNotice>
						) : null}
						{knowledgeHits.length > 0 ? (
							<div className="grid gap-2">
								{knowledgeHits.map((hit, index) => {
									const knowledgeBase = knowledgeBaseById.get(hit.knowledge_base_id);
									const label = knowledgeBase
										? knowledgeBaseLabel(knowledgeBase)
										: hit.knowledge_base_id;
									const source =
										hit.source || hit.document_id || hit.knowledge_base_id;

									return (
										<div
											key={`${hit.knowledge_base_id}-${hit.document_id}-${hit.chunk_index ?? index}`}
											className="grid gap-2 rounded-md border bg-background p-3"
										>
											<div className="flex flex-wrap items-center gap-2">
												<Badge variant="outline" className="max-w-full truncate" title={label}>
													{label}
												</Badge>
												<Badge
													variant="outline"
													className="max-w-full truncate font-mono"
													title={source}
												>
													<Database className="size-3" />
													{t('platform.agentRunner.knowledgeSource')}: {source}
												</Badge>
												<Badge variant="outline" className="font-mono">
													{t('platform.agentRunner.knowledgeScore')}: {scoreText(hit.score)}
												</Badge>
											</div>
											<p className="whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
												{hit.snippet}
											</p>
										</div>
									);
								})}
							</div>
						) : (
							<div className="text-xs text-muted-foreground">
								{t('platform.agentRunner.knowledgeHitsEmpty')}
							</div>
						)}
					</div>

					<div className="flex items-center gap-2">
						<Code2 className="size-4 text-muted-foreground" />
						<h3 className="text-sm font-semibold">{t('platform.agentRunner.trace')}</h3>
					</div>
					<div className="grid gap-3">
						<div className="text-xs font-medium text-muted-foreground">
							{t('platform.agentRunner.toolCalls')}
						</div>
						{toolCalls.map((toolCall, index) => {
							const toolName =
								toolCall.tool_name || t('platform.agentRunner.notRouted');
							const callRoutingLabel =
								toolCall.routing_source || toolCall.decision?.routing_source;
							const callRoutingText =
								callRoutingLabel === 'model'
									? t('platform.agentRunner.routingModel')
									: callRoutingLabel === 'rules'
										? t('platform.agentRunner.routingRules')
										: callRoutingLabel;
							const callConnectorSourceText =
								toolCall.connector_source === 'saved_config'
									? t('platform.agentRunner.connectorSourceSaved')
									: toolCall.connector_source === 'global'
										? t('platform.agentRunner.connectorSourceGlobal')
										: toolCall.connector_source;
							const decisionPayload = {
								allowed: toolCall.allowed,
								connector: toolCall.connector,
								connector_source: toolCall.connector_source,
								routing_source: toolCall.routing_source,
								routing_reason: toolCall.routing_reason,
								...toolCall.decision,
							};

							return (
								<div key={`${toolName}-${index}`} className="grid gap-3 rounded-lg border bg-muted/10 p-3">
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant="outline" className="max-w-full truncate font-mono">
											{toolName}
										</Badge>
										<Badge
											variant={toolCall.allowed ? 'outline' : 'destructive'}
											className={cn(
												toolCall.allowed &&
													'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
											)}
										>
											{toolCall.allowed ? (
												<CheckCircle2 className="size-3" />
											) : (
												<XCircle className="size-3" />
											)}
											{toolCall.allowed
												? t('platform.policy.allowed')
												: t('platform.policy.denied')}
										</Badge>
										{toolCall.approval_required ? (
											<Badge
												variant="outline"
												className="border-amber-500/30 bg-amber-500/10 text-amber-700"
											>
												{t('platform.agentRunner.approvalRequired')}
											</Badge>
										) : null}
										{toolCall.approval_id ? (
											<Badge variant="outline" className="font-mono">
												{t('platform.agentRunner.approvalId')}: {toolCall.approval_id}
											</Badge>
										) : null}
										{callRoutingText ? (
											<Badge
												variant="outline"
												className={cn(
													callRoutingLabel === 'model' &&
														'border-sky-500/30 bg-sky-500/10 text-sky-700',
													callRoutingLabel === 'rules' &&
														'border-amber-500/30 bg-amber-500/10 text-amber-700',
												)}
											>
												{t('platform.agentRunner.routingSource')}: {callRoutingText}
											</Badge>
										) : null}
										{toolCall.connector ? (
											<Badge variant="outline" className="max-w-full truncate font-mono">
												{t('platform.agentRunner.runtimeConnector')}: {toolCall.connector}
											</Badge>
										) : null}
										{callConnectorSourceText ? (
											<Badge variant="outline" className="max-w-full">
												{t('platform.agentRunner.connectorSource')}: {callConnectorSourceText}
											</Badge>
										) : null}
									</div>

									{toolCall.answer ? (
										<p className="whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
											{toolCall.answer}
										</p>
									) : null}

									<div className="grid gap-3 lg:grid-cols-3">
										<div className="grid gap-2">
											<div className="text-xs font-medium text-muted-foreground">
												{t('platform.agentRunner.inputs')}
											</div>
											<pre className="overflow-auto rounded-md bg-background p-3 font-mono text-xs leading-5">
												{JSON.stringify(toolCall.inputs ?? {}, null, 2)}
											</pre>
										</div>
										<div className="grid gap-2">
											<div className="text-xs font-medium text-muted-foreground">
												{t('platform.agentRunner.decision')}
											</div>
											<pre className="overflow-auto rounded-md bg-background p-3 font-mono text-xs leading-5">
												{JSON.stringify(decisionPayload, null, 2)}
											</pre>
										</div>
										<div className="grid gap-2">
											<div className="text-xs font-medium text-muted-foreground">
												{t('platform.agentRunner.result')}
											</div>
											<pre className="overflow-auto rounded-md bg-background p-3 font-mono text-xs leading-5">
												{JSON.stringify(toolCall.result ?? {}, null, 2)}
											</pre>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			) : (
				<div className="flex min-h-72 items-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
					{t('platform.agentRunner.emptyResult')}
				</div>
			)}
		</div>
	);
}
