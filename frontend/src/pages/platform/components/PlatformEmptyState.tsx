import { AlertTriangle, FileSearch, LockKeyhole, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';

export type PlatformEmptyStateVariant = 'noData' | 'filtered' | 'noAccess' | 'error';

interface PlatformEmptyStateProps {
	variant: PlatformEmptyStateVariant;
	title: ReactNode;
	description?: ReactNode;
	actionLabel?: ReactNode;
	onAction?: () => void;
	className?: string;
}

const icons = {
	noData: FileSearch,
	filtered: SearchX,
	noAccess: LockKeyhole,
	error: AlertTriangle,
} satisfies Record<PlatformEmptyStateVariant, typeof FileSearch>;

export function PlatformEmptyState({
	variant,
	title,
	description,
	actionLabel,
	onAction,
	className,
}: PlatformEmptyStateProps) {
	const Icon = icons[variant];

	return (
		<Empty
			className={cn(
				'min-h-56 rounded-md border border-dashed bg-muted/15 px-4 py-8 text-center',
				className,
			)}
		>
			<EmptyHeader>
				<EmptyMedia variant="icon" className="mx-auto size-10 rounded-md border bg-background">
					<Icon />
				</EmptyMedia>
				<EmptyTitle className="text-sm font-semibold">{title}</EmptyTitle>
				{description ? <EmptyDescription className="max-w-md">{description}</EmptyDescription> : null}
			</EmptyHeader>
			{actionLabel && onAction ? (
				<EmptyContent>
					<Button type="button" size="sm" variant="outline" onClick={onAction}>
						{actionLabel}
					</Button>
				</EmptyContent>
			) : null}
		</Empty>
	);
}
