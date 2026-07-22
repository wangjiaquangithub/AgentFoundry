import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PlatformFilterBarProps {
	children: ReactNode;
	resultLabel: ReactNode;
	clearLabel: string;
	onClear: () => void;
	clearDisabled?: boolean;
	className?: string;
}

export function PlatformFilterBar({
	children,
	resultLabel,
	clearLabel,
	onClear,
	clearDisabled,
	className,
}: PlatformFilterBarProps) {
	return (
		<div className={cn('grid gap-3 border-y bg-muted/15 px-3 py-3', className)}>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Badge variant="secondary" className="rounded-md font-normal">
					{resultLabel}
				</Badge>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={onClear}
					disabled={clearDisabled}
					className="h-8"
				>
					{clearLabel}
				</Button>
			</div>
			<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">{children}</div>
		</div>
	);
}
