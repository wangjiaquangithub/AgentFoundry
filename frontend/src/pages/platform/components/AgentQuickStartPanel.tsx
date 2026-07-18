import {
	ArrowRight,
	BotMessageSquare,
	KeyRound,
	LibraryBig,
	Workflow,
} from 'lucide-react';

import type { AgentView } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StateBadge } from './common';

interface AgentQuickStartPanelProps {
	agentsLoading: boolean;
	featuredAgents: AgentView[];
	onNavigate: (path: string) => void;
	labels: {
		agentsTitle: string;
		agentsDescription: string;
		openChat: string;
		emptyAgents: string;
		noPrompt: string;
		openAgent: string;
		editable: string;
		readOnly: string;
		invitable: string;
		quickActionsTitle: string;
		quickActionsDescription: string;
		configureModel: string;
		manageKnowledge: string;
		manageWorkflow: string;
	};
}

export function AgentQuickStartPanel({
	agentsLoading,
	featuredAgents,
	onNavigate,
	labels,
}: AgentQuickStartPanelProps) {
	return (
		<section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h2 className="text-base font-semibold">{labels.agentsTitle}</h2>
						<p className="text-sm text-muted-foreground">
							{labels.agentsDescription}
						</p>
					</div>
					<Button size="sm" variant="outline" onClick={() => onNavigate('/chat')}>
						<BotMessageSquare />
						{labels.openChat}
					</Button>
				</div>

				{agentsLoading ? (
					<div className="grid gap-3">
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-20 w-full" />
					</div>
				) : featuredAgents.length === 0 ? (
					<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
						{labels.emptyAgents}
					</div>
				) : (
					<div className="grid gap-3">
						{featuredAgents.map((agent) => (
							<Card key={agent.id} size="sm" className="rounded-lg shadow-none">
								<CardHeader className="grid-cols-[1fr_auto] gap-3">
									<div className="min-w-0">
										<CardTitle className="truncate text-sm">
											{agent.data.name}
										</CardTitle>
										<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
											{agent.data.system_prompt || labels.noPrompt}
										</p>
									</div>
									<Button
										size="icon-sm"
										variant="ghost"
										tooltip={labels.openAgent}
										onClick={() => onNavigate(`/chat/${agent.id}`)}
									>
										<ArrowRight />
									</Button>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-2">
									<StateBadge
										state={agent.editable ? 'ready' : 'partial'}
										label={agent.editable ? labels.editable : labels.readOnly}
									/>
									{agent.data.invite_config?.invitable ? (
										<Badge variant="outline">{labels.invitable}</Badge>
									) : null}
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>

			<div className="flex flex-col gap-3">
				<div>
					<h2 className="text-base font-semibold">{labels.quickActionsTitle}</h2>
					<p className="text-sm text-muted-foreground">
						{labels.quickActionsDescription}
					</p>
				</div>
				<div className="grid gap-2">
					<Button
						className="justify-between"
						variant="outline"
						onClick={() => onNavigate('/credential')}
					>
						<span className="inline-flex items-center gap-2">
							<KeyRound />
							{labels.configureModel}
						</span>
						<ArrowRight className="size-4" />
					</Button>
					<Button
						className="justify-between"
						variant="outline"
						onClick={() => onNavigate('/knowledge')}
					>
						<span className="inline-flex items-center gap-2">
							<LibraryBig />
							{labels.manageKnowledge}
						</span>
						<ArrowRight className="size-4" />
					</Button>
					<Button
						className="justify-between"
						variant="outline"
						onClick={() => onNavigate('/schedule')}
					>
						<span className="inline-flex items-center gap-2">
							<Workflow />
							{labels.manageWorkflow}
						</span>
						<ArrowRight className="size-4" />
					</Button>
				</div>
			</div>
		</section>
	);
}
