import { Building2, ListChecks } from 'lucide-react';
import type { ComponentType } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
	PlatformConnectionCard,
	PlatformPageHeader,
	StatCard,
	type HealthState,
	type StatCardProps,
} from './common';

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
			<PlatformPageHeader
				icon={Building2}
				eyebrow={labels.eyebrow}
				title={labels.title}
				description={labels.subtitle}
				aside={
					<PlatformConnectionCard
						serverUrl={serverUrl}
						username={username}
						hasErrors={connectionState !== 'ready'}
						labels={{
							server: labels.server,
							user: labels.user,
							health: labels.health,
							connected: labels.connectionState,
							partial: labels.connectionState,
						}}
					/>
				}
			/>

			<section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{stats.map((stat) => (
						<StatCard key={stat.label} {...stat} />
					))}
				</div>

				<div className="grid gap-3 rounded-md border bg-background p-4">
					<div className="min-w-0">
						<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
							<ListChecks className="size-4" />
							<span>{labels.nextStepEyebrow}</span>
						</div>
						<h2 className="text-base font-semibold">{labels.nextStepTitle}</h2>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">
							{labels.nextStepDescription}
						</p>
					</div>
					<div className="flex flex-wrap gap-2 border-t pt-3">
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
				</div>
			</section>
		</>
	);
}
