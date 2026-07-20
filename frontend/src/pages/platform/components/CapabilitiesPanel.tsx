import { ArrowRight } from 'lucide-react';
import type { ComponentType } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StateBadge, type HealthState } from './common';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface CapabilityItem {
	title: string;
	description: string;
	metric: string;
	actionLabel: string;
	status: string;
	state: HealthState;
	icon: ComponentType<{ className?: string }>;
	onClick: () => void;
}

interface CapabilitiesPanelProps {
	capabilities: CapabilityItem[];
	t: Translate;
}

export function CapabilitiesPanel({ capabilities, t }: CapabilitiesPanelProps) {
	return (
		<section className="flex flex-col gap-3">
			<div>
				<h2 className="text-base font-semibold">
					{t('platform.capabilities.title')}
				</h2>
				<p className="text-sm text-muted-foreground">
					{t('platform.capabilities.description')}
				</p>
			</div>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{capabilities.map((capability) => {
					const Icon = capability.icon;

					return (
						<Card
							key={capability.title}
							size="sm"
							className="rounded-lg shadow-none transition hover:border-primary/30 hover:bg-primary/5"
						>
							<CardHeader className="grid-cols-[auto_1fr_auto] items-start gap-3">
								<div className="flex size-8 items-center justify-center rounded-lg border bg-background">
									<Icon className="size-4 text-muted-foreground" />
								</div>
								<div className="min-w-0">
									<CardTitle className="truncate text-sm">
										{capability.title}
									</CardTitle>
									<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
										{capability.description}
									</p>
								</div>
								<StateBadge state={capability.state} label={capability.status} />
							</CardHeader>
							<CardContent>
								<div className="mb-3 text-sm font-medium">{capability.metric}</div>
								<Button
									size="sm"
									variant="ghost"
									className="px-0"
									onClick={capability.onClick}
								>
									<ArrowRight />
									{capability.actionLabel}
								</Button>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</section>
	);
}
