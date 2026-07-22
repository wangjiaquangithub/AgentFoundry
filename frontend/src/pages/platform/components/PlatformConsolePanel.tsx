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
		<section className="rounded-md border bg-white">
			<div className="border-b px-4 py-3">
				<h2 className="text-sm font-semibold">{labels.title}</h2>
				<p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
					{labels.description}
				</p>
			</div>
			<div className="divide-y">
				{items.map((item) => {
					const Icon = item.icon;

					return (
						<div
							key={item.key}
							className="grid gap-3 px-4 py-3 transition-colors hover:bg-slate-50 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
						>
							<div className="flex size-8 items-center justify-center rounded-md border bg-slate-50">
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
								className="justify-self-start md:justify-self-end"
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
