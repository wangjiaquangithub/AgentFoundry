import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { ComponentType } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StateBadge, type HealthState } from './common';

export interface FirstAgentGuideStep {
	key: string;
	title: string;
	detail: string;
	actionLabel: string;
	icon: ComponentType<{ className?: string }>;
	state: HealthState;
	onClick: () => void;
}

interface FirstAgentGuideProps {
	steps: FirstAgentGuideStep[];
	primaryStep: FirstAgentGuideStep;
	publishingTemplateId: string | null;
	labels: {
		title: string;
		description: string;
		publishing: string;
		states: Record<HealthState, string>;
	};
}

export function FirstAgentGuide({
	steps,
	primaryStep,
	publishingTemplateId,
	labels,
}: FirstAgentGuideProps) {
	const PrimaryIcon = primaryStep.icon;
	const primaryPublishing = primaryStep.key === 'agent' && Boolean(publishingTemplateId);

	return (
		<div className="grid gap-3 rounded-lg border bg-background p-3">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<h3 className="text-sm font-medium">{labels.title}</h3>
					<p className="mt-1 text-xs leading-5 text-muted-foreground">
						{labels.description}
					</p>
				</div>
				<Button
					type="button"
					size="sm"
					onClick={primaryStep.onClick}
					disabled={primaryPublishing}
				>
					<PrimaryIcon
						className={cn('size-4', primaryPublishing && 'animate-pulse')}
					/>
					{primaryPublishing ? labels.publishing : primaryStep.actionLabel}
				</Button>
			</div>
			<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
				{steps.map((step, index) => {
					const StepIcon = step.icon;
					const done = step.state === 'ready';

					return (
						<button
							key={step.key}
							type="button"
							onClick={step.onClick}
							className="grid min-h-28 gap-2 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-center gap-2">
									<div
										className={cn(
											'grid size-8 place-items-center rounded-md border',
											done
												? 'bg-primary text-primary-foreground'
												: 'bg-background',
										)}
									>
										{done ? (
											<CheckCircle2 className="size-4" />
										) : (
											<StepIcon className="size-4 text-muted-foreground" />
										)}
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
									{step.detail}
								</p>
							</div>
							<div className="mt-auto flex items-center gap-1 text-xs font-medium text-primary">
								<span>{step.actionLabel}</span>
								<ArrowRight className="size-3" />
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
