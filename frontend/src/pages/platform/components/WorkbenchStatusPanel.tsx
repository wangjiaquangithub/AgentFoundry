import { ArrowRight } from 'lucide-react';
import type { ComponentType } from 'react';

import { StateBadge, type HealthState } from './common';
import { cn } from '@/lib/utils';

export interface WorkbenchIndicator {
	key: string;
	label: string;
	value: string | number;
	helper: string;
	icon: ComponentType<{ className?: string }>;
	state: HealthState;
	onClick: () => void;
}

export interface WorkbenchActionCard {
	key: string;
	title: string;
	description: string;
	actionLabel: string;
	icon: ComponentType<{ className?: string }>;
	primary: boolean;
	onClick: () => void;
}

interface WorkbenchStatusPanelProps {
	indicators: WorkbenchIndicator[];
	actions: WorkbenchActionCard[];
	labels: {
		statusTitle: string;
		statusDescription: string;
		statusState: HealthState;
		statusStateLabel: string;
		states: Record<HealthState, string>;
	};
}

export function WorkbenchStatusPanel({
	indicators,
	actions,
	labels,
}: WorkbenchStatusPanelProps) {
	return (
		<div className="grid gap-3 lg:grid-cols-[1.1fr_1.4fr]">
			<div className="grid gap-3 rounded-lg border bg-background p-3">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<h3 className="text-sm font-medium">{labels.statusTitle}</h3>
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							{labels.statusDescription}
						</p>
					</div>
					<StateBadge
						state={labels.statusState}
						label={labels.statusStateLabel}
					/>
				</div>
				<div className="grid gap-2 sm:grid-cols-2">
					{indicators.map((item) => {
						const ItemIcon = item.icon;

						return (
							<button
								key={item.key}
								type="button"
								onClick={item.onClick}
								className="grid gap-2 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<div className="flex items-center justify-between gap-3">
									<div className="grid size-8 place-items-center rounded-md border bg-background">
										<ItemIcon className="size-4 text-muted-foreground" />
									</div>
									<StateBadge state={item.state} label={labels.states[item.state]} />
								</div>
								<div className="text-lg font-semibold tabular-nums">{item.value}</div>
								<div className="min-w-0">
									<div className="text-xs font-medium">{item.label}</div>
									<p className="mt-1 text-xs leading-5 text-muted-foreground">
										{item.helper}
									</p>
								</div>
							</button>
						);
					})}
				</div>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				{actions.map((action) => {
					const ActionIcon = action.icon;

					return (
						<button
							key={action.key}
							type="button"
							onClick={action.onClick}
							className={cn(
								'grid min-h-32 gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
								action.primary
									? 'bg-primary text-primary-foreground hover:bg-primary/90'
									: 'bg-background hover:border-primary/30 hover:bg-primary/5',
							)}
						>
							<div className="flex items-start justify-between gap-3">
								<div
									className={cn(
										'grid size-9 place-items-center rounded-md border',
										action.primary
											? 'border-primary-foreground/30 bg-primary-foreground/10'
											: 'bg-background',
									)}
								>
									<ActionIcon className="size-4" />
								</div>
								<ArrowRight className="mt-1 size-4 shrink-0" />
							</div>
							<div className="min-w-0">
								<h3 className="text-sm font-medium">{action.title}</h3>
								<p
									className={cn(
										'mt-1 line-clamp-2 text-xs leading-5',
										action.primary
											? 'text-primary-foreground/80'
											: 'text-muted-foreground',
									)}
								>
									{action.description}
								</p>
							</div>
							<div className="text-xs font-medium">{action.actionLabel}</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
