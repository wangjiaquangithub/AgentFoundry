import { ArrowRight } from 'lucide-react';
import type { ComponentType } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { StateBadge, type HealthState } from './common';

export interface LaunchpadStep {
	key: string;
	title: string;
	description: string;
	actionLabel: string;
	icon: ComponentType<{ className?: string }>;
	state: HealthState;
	onClick: () => void;
}

interface LaunchpadPanelProps {
	steps: LaunchpadStep[];
	primaryStep: LaunchpadStep;
	labels: {
		title: string;
		description: string;
		state: HealthState;
		stateLabel: string;
		progress: string;
		primaryAction: string;
		states: Record<HealthState, string>;
	};
}

export function LaunchpadPanel({
	steps,
	primaryStep,
	labels,
}: LaunchpadPanelProps) {
	return (
		<section className="grid gap-3 rounded-lg border bg-muted/10 p-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="text-base font-semibold">{labels.title}</h2>
						<StateBadge state={labels.state} label={labels.stateLabel} />
						<Badge variant="outline">{labels.progress}</Badge>
					</div>
					<p className="text-sm text-muted-foreground">{labels.description}</p>
				</div>
				<Button
					type="button"
					size="sm"
					onClick={primaryStep.onClick}
					className="w-full sm:w-auto"
				>
					{labels.primaryAction}
					<ArrowRight className="size-4" />
				</Button>
			</div>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{steps.map((step) => {
					const Icon = step.icon;

					return (
						<div
							key={step.key}
							className="grid gap-3 rounded-lg border bg-background p-3"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex size-9 items-center justify-center rounded-lg border bg-muted/30">
									<Icon className="size-4 text-muted-foreground" />
								</div>
								<StateBadge state={step.state} label={labels.states[step.state]} />
							</div>
							<div className="min-w-0">
								<h3 className="text-sm font-medium">{step.title}</h3>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{step.description}
								</p>
							</div>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={step.onClick}
							>
								{step.actionLabel}
								<ArrowRight className="size-4" />
							</Button>
						</div>
					);
				})}
			</div>
		</section>
	);
}
