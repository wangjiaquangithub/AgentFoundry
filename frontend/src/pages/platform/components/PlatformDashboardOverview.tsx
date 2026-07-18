import { Building2, ListChecks } from 'lucide-react';
import type { ComponentType } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StateBadge, StatCard, type HealthState, type StatCardProps } from './common';

type NextStepMode = 'model' | 'publish' | 'configure' | 'governance' | 'run';

interface PlatformDashboardOverviewProps {
	serverUrl: string;
	username: string;
	connectionState: HealthState;
	stats: StatCardProps[];
	nextStepMode: NextStepMode;
	nextStepIcon: ComponentType<{ className?: string }>;
	nextStepPrimaryDisabled: boolean;
	publishingTemplateId: string | null;
	labels: {
		eyebrow: string;
		title: string;
		subtitle: string;
		server: string;
		user: string;
		health: string;
		connectionState: string;
		nextStepEyebrow: string;
		nextStepTitle: string;
		nextStepDescription: string;
		nextStepManual: string;
		nextStepAction: string;
		publishing: string;
	};
	onStartPublishing: () => void;
	onPrimaryAction: () => void;
}

export function PlatformDashboardOverview({
	serverUrl,
	username,
	connectionState,
	stats,
	nextStepMode,
	nextStepIcon: NextStepIcon,
	nextStepPrimaryDisabled,
	publishingTemplateId,
	labels,
	onStartPublishing,
	onPrimaryAction,
}: PlatformDashboardOverviewProps) {
	return (
		<>
			<section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<Building2 className="size-4" />
						<span>{labels.eyebrow}</span>
					</div>
					<h1 className="text-2xl font-semibold tracking-normal">{labels.title}</h1>
					<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
						{labels.subtitle}
					</p>
				</div>
				<div className="grid min-w-0 gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:min-w-80">
					<div className="flex items-center justify-between gap-3">
						<span className="text-muted-foreground">{labels.server}</span>
						<span className="truncate font-mono" title={serverUrl}>
							{serverUrl}
						</span>
					</div>
					<div className="flex items-center justify-between gap-3">
						<span className="text-muted-foreground">{labels.user}</span>
						<span className="truncate font-mono" title={username}>
							{username}
						</span>
					</div>
					<div className="flex items-center justify-between gap-3">
						<span className="text-muted-foreground">{labels.health}</span>
						<StateBadge state={connectionState} label={labels.connectionState} />
					</div>
				</div>
			</section>

			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{stats.map((stat) => (
					<StatCard key={stat.label} {...stat} />
				))}
			</section>

			<section className="grid gap-4 rounded-lg border bg-muted/10 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<ListChecks className="size-4" />
						<span>{labels.nextStepEyebrow}</span>
					</div>
					<h2 className="text-base font-semibold">{labels.nextStepTitle}</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{labels.nextStepDescription}
					</p>
				</div>
				<div className="flex flex-wrap gap-2 lg:justify-end">
					{nextStepMode === 'publish' ? (
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onStartPublishing}
						>
							<ListChecks className="size-4" />
							{labels.nextStepManual}
						</Button>
					) : null}
					<Button
						type="button"
						size="sm"
						onClick={onPrimaryAction}
						disabled={nextStepPrimaryDisabled}
					>
						<NextStepIcon
							className={cn(
								'size-4',
								nextStepMode === 'publish' &&
									publishingTemplateId &&
									'animate-pulse',
							)}
						/>
						{nextStepMode === 'publish' && publishingTemplateId
							? labels.publishing
							: labels.nextStepAction}
					</Button>
				</div>
			</section>
		</>
	);
}
