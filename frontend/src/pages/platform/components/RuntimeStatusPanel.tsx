import { RefreshCcw } from 'lucide-react';
import type { ComponentType, RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { PlatformNotice } from './common';

export interface RuntimeStatusItem {
	label: string;
	value: string;
	icon: ComponentType<{ className?: string }>;
}

interface RuntimeStatusPanelProps {
	governanceRef: RefObject<HTMLElement | null>;
	platformLoading: boolean;
	hasPlatformStatus: boolean;
	platformError: unknown;
	runtimeItems: RuntimeStatusItem[];
	onRefreshPlatform: () => void;
	labels: {
		title: string;
		description: string;
		refreshStatus: string;
		error: string;
	};
}

export function RuntimeStatusPanel({
	governanceRef,
	platformLoading,
	hasPlatformStatus,
	platformError,
	runtimeItems,
	onRefreshPlatform,
	labels,
}: RuntimeStatusPanelProps) {
	return (
		<section ref={governanceRef} className="flex flex-col gap-3">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h2 className="text-base font-semibold">{labels.title}</h2>
					<p className="text-sm text-muted-foreground">{labels.description}</p>
				</div>
				<Button
					size="sm"
					variant="outline"
					onClick={onRefreshPlatform}
					disabled={platformLoading}
				>
					<RefreshCcw className={cn(platformLoading && 'animate-spin')} />
					{labels.refreshStatus}
				</Button>
			</div>
			{platformError ? <PlatformNotice>{labels.error}</PlatformNotice> : null}
			{platformLoading && !hasPlatformStatus ? (
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
				</div>
			) : (
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					{runtimeItems.map((item) => {
						const Icon = item.icon;

						return (
							<div
								key={item.label}
								className="grid grid-cols-[auto_1fr] gap-3 rounded-lg border bg-muted/10 p-3"
							>
								<div className="flex size-8 items-center justify-center rounded-lg border bg-background">
									<Icon className="size-4 text-muted-foreground" />
								</div>
								<div className="min-w-0">
									<div className="text-xs text-muted-foreground">{item.label}</div>
									<div className="mt-1 truncate font-mono text-xs" title={item.value}>
										{item.value}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
