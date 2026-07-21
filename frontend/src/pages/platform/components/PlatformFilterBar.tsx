import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface PlatformFilterBarProps {
	children: ReactNode;
	resultLabel: ReactNode;
	clearLabel: string;
	onClear: () => void;
	clearDisabled?: boolean;
}

export function PlatformFilterBar({
	children,
	resultLabel,
	clearLabel,
	onClear,
	clearDisabled,
}: PlatformFilterBarProps) {
	return (
		<div className="grid gap-3 border-y bg-background/80 py-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Badge variant="outline">{resultLabel}</Badge>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={onClear}
					disabled={clearDisabled}
				>
					{clearLabel}
				</Button>
			</div>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">{children}</div>
		</div>
	);
}
