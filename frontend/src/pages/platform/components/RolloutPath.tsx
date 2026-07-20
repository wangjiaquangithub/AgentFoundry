import { ArrowRight } from 'lucide-react';
import type { ComponentType } from 'react';

import { Badge } from '@/components/ui/badge';
import { StateBadge, type HealthState } from './common';

export interface RolloutPathStep {
	key: string;
	title: string;
	description: string;
	actionLabel: string;
	icon: ComponentType<{ className?: string }>;
	state: HealthState;
	onClick: () => void;
}

interface RolloutPathProps {
	steps: RolloutPathStep[];
	labels: {
		title: string;
		description: string;
		progress: string;
		states: Record<HealthState, string>;
	};
}

export function RolloutPath({ steps, labels }: RolloutPathProps) {
	return (
		<div className="grid gap-3 rounded-lg border bg-background p-3">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<h3 className="text-sm font-medium">{labels.title}</h3>
					<p className="mt-1 text-xs leading-5 text-muted-foreground">
						{labels.description}
					</p>
				</div>
				<Badge variant="outline">{labels.progress}</Badge>
			</div>
			<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
				{steps.map((step, index) => {
					const StepIcon = step.icon;

					return (
						<button
							key={step.key}
							type="button"
							onClick={step.onClick}
							className="group grid min-h-36 gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-center gap-2">
									<div className="grid size-8 place-items-center rounded-md border bg-background">
										<StepIcon className="size-4 text-muted-foreground" />
									</div>
									<span className="text-xs font-medium text-muted-foreground">
										{index + 1}
									</span>
								</div>
								<StateBadge state={step.state} label={labels.states[step.state]} />
							</div>
							<div className="min-w-0">
								<h4 className="text-xs font-medium">{step.title}</h4>
								<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
									{step.description}
								</p>
							</div>
							<div className="mt-auto flex items-center gap-1 text-xs font-medium text-primary">
								<span>{step.actionLabel}</span>
								<ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
