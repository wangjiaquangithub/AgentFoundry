import { Clock3, X } from 'lucide-react';

import type { EnterpriseAgentRunResponse } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AgentRunnerConversationTurn {
	id: string;
	agentId: string;
	question: string;
	answer: string;
	createdAt: string;
	response: EnterpriseAgentRunResponse;
}

interface AgentRunnerConversationProps {
	turns: AgentRunnerConversationTurn[];
	activeResponse: EnterpriseAgentRunResponse | null;
	loading: boolean;
	error: string | null;
	labels: {
		title: string;
		clear: string;
		loading: string;
		empty: string;
		selectedTool: string;
		notRouted: string;
	};
	onClear: () => void;
	onSelectTurn: (turn: AgentRunnerConversationTurn) => void;
}

export function AgentRunnerConversation({
	turns,
	activeResponse,
	loading,
	error,
	labels,
	onClear,
	onSelectTurn,
}: AgentRunnerConversationProps) {
	return (
		<div className="grid gap-2">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
					<Clock3 className="size-4" />
					<span>{labels.title}</span>
				</div>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={onClear}
					disabled={loading || turns.length === 0}
				>
					<X className="size-4" />
					{labels.clear}
				</Button>
			</div>
			{error ? (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
					{error}
				</div>
			) : null}
			{loading && turns.length === 0 ? (
				<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
					{labels.loading}
				</div>
			) : turns.length > 0 ? (
				<div className="grid max-h-72 gap-2 overflow-auto rounded-md border bg-background p-2">
					{turns.map((turn) => {
						const createdAt = new Date(turn.createdAt);
						const createdAtText = Number.isNaN(createdAt.getTime())
							? turn.createdAt
							: createdAt.toLocaleString();
						const isActive = activeResponse === turn.response;

						return (
							<button
								key={turn.id}
								type="button"
								onClick={() => {
									onSelectTurn(turn);
								}}
								className={cn(
									'grid gap-2 rounded-md border p-3 text-left transition hover:bg-muted/50',
									isActive && 'border-primary bg-primary/5',
								)}
							>
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="outline" className="font-mono">
										{createdAtText}
									</Badge>
									<Badge
										variant={turn.response.routed ? 'outline' : 'destructive'}
										className={cn(
											turn.response.routed &&
												'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
										)}
									>
										{turn.response.routed
											? turn.response.tool_name || labels.selectedTool
											: labels.notRouted}
									</Badge>
								</div>
								<div className="grid gap-1">
									<p className="line-clamp-2 break-words text-xs font-medium">
										{turn.question}
									</p>
									<p className="line-clamp-2 break-words text-xs leading-5 text-muted-foreground">
										{turn.answer}
									</p>
								</div>
							</button>
						);
					})}
				</div>
			) : (
				<div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
					{labels.empty}
				</div>
			)}
		</div>
	);
}
