import { ArrowRight, RefreshCcw, ShieldCheck } from 'lucide-react';
import type { ComponentType } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PlatformNotice, StateBadge, type HealthState } from './common';

export interface GovernanceHealthItem {
	label: string;
	value: number;
	helper: string;
	state: HealthState;
	icon: ComponentType<{ className?: string }>;
}

interface GovernanceHealthPanelProps {
	items: GovernanceHealthItem[];
	error: string | null;
	loading: boolean;
	onRefresh: () => void;
	onOpenDetails: () => void;
	labels: {
		eyebrow: string;
		title: string;
		description: string;
		refresh: string;
		openDetails: string;
		stateLabel: (state: HealthState) => string;
	};
}

export function GovernanceHealthPanel({
	items,
	error,
	loading,
	onRefresh,
	onOpenDetails,
	labels,
}: GovernanceHealthPanelProps) {
	return (
		<section className="grid gap-4 rounded-lg border bg-background p-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
						<ShieldCheck className="size-4" />
						<span>{labels.eyebrow}</span>
					</div>
					<h2 className="text-base font-semibold">{labels.title}</h2>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
						{labels.description}
					</p>
				</div>
				<div className="flex flex-wrap gap-2 lg:justify-end">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onRefresh}
						disabled={loading}
					>
						<RefreshCcw className={cn('size-4', loading && 'animate-spin')} />
						{labels.refresh}
					</Button>
					<Button type="button" size="sm" onClick={onOpenDetails}>
						<ArrowRight className="size-4" />
						{labels.openDetails}
					</Button>
				</div>
			</div>

			{error ? <PlatformNotice>{error}</PlatformNotice> : null}

			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{items.map((item) => {
					const Icon = item.icon;
					return (
						<div key={item.label} className="rounded-lg border bg-muted/20 p-3">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="text-xs text-muted-foreground">{item.label}</div>
									<div className="mt-1 text-2xl font-semibold tabular-nums">
										{item.value}
									</div>
								</div>
								<div className="rounded-md border bg-background p-2 text-muted-foreground">
									<Icon className="size-4" />
								</div>
							</div>
							<div className="mt-3 flex items-center justify-between gap-3">
								<p className="min-w-0 text-xs leading-5 text-muted-foreground">
									{item.helper}
								</p>
								<StateBadge state={item.state} label={labels.stateLabel(item.state)} />
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
