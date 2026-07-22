import { ArrowRight } from 'lucide-react';
import type { ComponentType } from 'react';

import { Button } from '@/components/ui/button';

export interface PlatformConsoleItem {
	key: string;
	title: string;
	description: string;
	actionLabel: string;
	icon: ComponentType<{ className?: string }>;
	onClick: () => void;
}

interface PlatformConsolePanelProps {
	items: PlatformConsoleItem[];
	labels: {
		title: string;
		description: string;
	};
}

export function PlatformConsolePanel({
	items,
	labels,
}: PlatformConsolePanelProps) {
	return (
		<section className="grid gap-4 border-t py-4">
			<div className="min-w-0">
				<h2 className="text-base font-semibold">{labels.title}</h2>
				<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
					{labels.description}
				</p>
			</div>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				{items.map((item) => {
					const Icon = item.icon;

					return (
						<div
							key={item.key}
							className="grid gap-3 rounded-md border bg-muted/10 p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
						>
							<div className="flex size-8 items-center justify-center rounded-md bg-background">
								<Icon className="size-4 text-muted-foreground" />
							</div>
							<div className="min-w-0">
								<h3 className="text-sm font-medium">{item.title}</h3>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{item.description}
								</p>
							</div>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={item.onClick}
							>
								{item.actionLabel}
								<ArrowRight className="size-4" />
							</Button>
						</div>
					);
				})}
			</div>
		</section>
	);
}
