import { ArrowRight, Workflow } from 'lucide-react';
import type { ComponentType, RefObject } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { StateBadge, type HealthState } from './common';

export interface OrchestrationWorkbenchStep {
	key: string;
	title: string;
	description: string;
	detail: string;
	state: HealthState;
	icon: ComponentType<{ className?: string }>;
	onClick: () => void;
	actionLabel: string;
}

interface OrchestrationWorkbenchPanelProps {
	sectionRef: RefObject<HTMLElement | null>;
	steps: OrchestrationWorkbenchStep[];
	primaryStep: OrchestrationWorkbenchStep;
	labels: {
		eyebrow: string;
		title: string;
		description: string;
		progress: string;
		agents: string;
		approvals: string;
		primaryAction: string;
		step: (index: number) => string;
		states: Record<HealthState, string>;
	};
}

export function OrchestrationWorkbenchPanel({
	sectionRef,
	steps,
	primaryStep,
	labels,
}: OrchestrationWorkbenchPanelProps) {
	return (
		<section ref={sectionRef} className="grid gap-4 rounded-lg border bg-background p-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<Workflow className="size-4" />
						<span>{labels.eyebrow}</span>
					</div>
					<h2 className="text-base font-semibold">{labels.title}</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{labels.description}
					</p>
				</div>
				<div className="flex flex-wrap gap-2 lg:justify-end">
					<Badge variant="outline">{labels.progress}</Badge>
					<Badge variant="outline">{labels.agents}</Badge>
					<Badge variant="outline">{labels.approvals}</Badge>
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
			</div>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				{steps.map((step, index) => {
					const StepIcon = step.icon;

					return (
						<button
							key={step.key}
							type="button"
							onClick={step.onClick}
							className="grid min-h-40 gap-3 rounded-lg border bg-muted/10 p-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex min-w-0 items-center gap-2">
									<div className="grid size-8 shrink-0 place-items-center rounded-md border bg-background">
										<StepIcon className="size-4" />
									</div>
									<div className="text-xs font-medium text-muted-foreground">
										{labels.step(index + 1)}
									</div>
								</div>
								<StateBadge state={step.state} label={labels.states[step.state]} />
							</div>
							<div className="min-w-0">
								<h3 className="text-sm font-medium">{step.title}</h3>
								<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
									{step.description}
								</p>
							</div>
							<div
								className="line-clamp-2 rounded-md bg-background px-2 py-1.5 text-xs leading-5 text-muted-foreground"
								title={step.detail}
							>
								{step.detail}
							</div>
							<div className="mt-auto flex items-center justify-between gap-2 text-xs font-medium">
								<span>{step.actionLabel}</span>
								<ArrowRight className="size-4 shrink-0" />
							</div>
						</button>
					);
				})}
			</div>
		</section>
	);
}
