import { AlertTriangle } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type HealthState = 'ready' | 'partial' | 'todo' | 'blocked';

export interface StatCardProps {
	label: string;
	value: number;
	helper: string;
	icon: ComponentType<{ className?: string }>;
	loading?: boolean;
}

export function StatCard({ label, value, helper, icon: Icon, loading }: StatCardProps) {
	return (
		<Card size="sm" className="min-h-28 rounded-lg shadow-none">
			<CardHeader className="grid-cols-[1fr_auto] gap-3">
				<div className="min-w-0">
					<CardTitle className="truncate text-sm text-muted-foreground">
						{label}
					</CardTitle>
					{loading ? (
						<Skeleton className="mt-3 h-8 w-16" />
					) : (
						<div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
					)}
				</div>
				<div className="flex size-9 items-center justify-center rounded-lg border bg-muted/40">
					<Icon className="size-4 text-muted-foreground" />
				</div>
			</CardHeader>
			<CardContent className="text-xs text-muted-foreground">{helper}</CardContent>
		</Card>
	);
}

export function StateBadge({ state, label }: { state: HealthState; label: string }) {
	const className = cn(
		state === 'ready' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
		state === 'partial' && 'border-amber-500/30 bg-amber-500/10 text-amber-700',
		state === 'todo' && 'border-slate-500/30 bg-slate-500/10 text-slate-700',
		state === 'blocked' && 'border-red-500/30 bg-red-500/10 text-red-700',
	);

	return (
		<Badge variant="outline" className={className}>
			{label}
		</Badge>
	);
}

export function PlatformNotice({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				'flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800',
				className,
			)}
		>
			<AlertTriangle className="mt-0.5 size-4 shrink-0" />
			<span className="min-w-0 break-words">{children}</span>
		</div>
	);
}
