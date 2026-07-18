import type { ComponentType } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StateBadge, type HealthState } from './common';

export interface WorkbenchReadinessItem {
	key: string;
	title: string;
	description: string;
	state: HealthState;
	icon: ComponentType<{ className?: string }>;
	onClick: () => void;
}

export interface WorkbenchQuickAction {
	key: string;
	label: string;
	icon: ComponentType<{ className?: string }>;
	onClick: () => void;
}

export interface WorkbenchRiskItem {
	key: string;
	label: string;
	state: HealthState;
	onClick: () => void;
}

interface WorkbenchReadinessPanelProps {
	readinessItems: WorkbenchReadinessItem[];
	quickActions: WorkbenchQuickAction[];
	riskItems: WorkbenchRiskItem[];
	labels: {
		readinessTitle: string;
		readinessDescription: string;
		readinessProgress: string;
		quickActionsTitle: string;
		riskTitle: string;
		riskEmpty: string;
		states: Record<HealthState, string>;
	};
}

export function WorkbenchReadinessPanel({
	readinessItems,
	quickActions,
	riskItems,
	labels,
}: WorkbenchReadinessPanelProps) {
	return (
		<div className="grid gap-3 rounded-lg border bg-muted/10 p-3 xl:grid-cols-[1.5fr_0.9fr]">
			<div className="grid gap-3">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h3 className="text-sm font-medium">{labels.readinessTitle}</h3>
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							{labels.readinessDescription}
						</p>
					</div>
					<Badge variant="outline">{labels.readinessProgress}</Badge>
				</div>
				<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
					{readinessItems.map((item) => {
						const ItemIcon = item.icon;

						return (
							<button
								key={item.key}
								type="button"
								onClick={item.onClick}
								className="grid min-h-28 gap-2 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="grid size-8 place-items-center rounded-md border bg-muted/20">
										<ItemIcon className="size-4 text-muted-foreground" />
									</div>
									<StateBadge state={item.state} label={labels.states[item.state]} />
								</div>
								<div className="min-w-0">
									<h4 className="text-xs font-medium">{item.title}</h4>
									<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
										{item.description}
									</p>
								</div>
							</button>
						);
					})}
				</div>
			</div>

			<div className="grid content-start gap-3">
				<div className="rounded-lg border bg-background p-3">
					<h3 className="text-sm font-medium">{labels.quickActionsTitle}</h3>
					<div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
						{quickActions.map((action) => {
							const ActionIcon = action.icon;

							return (
								<Button
									key={action.key}
									type="button"
									variant="outline"
									size="sm"
									onClick={action.onClick}
									className="justify-start"
								>
									<ActionIcon className="size-4" />
									{action.label}
								</Button>
							);
						})}
					</div>
				</div>

				<div className="rounded-lg border bg-background p-3">
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-sm font-medium">{labels.riskTitle}</h3>
						<Badge variant={riskItems.length > 0 ? 'secondary' : 'outline'}>
							{riskItems.length}
						</Badge>
					</div>
					<div className="mt-3 grid gap-2">
						{riskItems.length > 0 ? (
							riskItems.map((risk) => (
								<button
									key={risk.key}
									type="button"
									onClick={risk.onClick}
									className="flex items-center justify-between gap-3 rounded-md border bg-muted/10 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									<span className="min-w-0 leading-5">{risk.label}</span>
									<StateBadge state={risk.state} label={labels.states[risk.state]} />
								</button>
							))
						) : (
							<p className="rounded-md border bg-muted/10 px-3 py-2 text-xs leading-5 text-muted-foreground">
								{labels.riskEmpty}
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
