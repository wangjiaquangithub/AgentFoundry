import { AlertTriangle } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type HealthState = 'ready' | 'partial' | 'todo' | 'blocked';

type PlatformIcon = ComponentType<{ className?: string }>;

export interface PlatformPageShellProps {
	children: ReactNode;
	className?: string;
}

export function PlatformPageShell({ children, className }: PlatformPageShellProps) {
	return (
		<main className="h-full overflow-y-auto bg-slate-50/70">
			<div
				className={cn(
					'mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8',
					className,
				)}
			>
				{children}
			</div>
		</main>
	);
}

export interface PlatformPageHeaderProps {
	icon: PlatformIcon;
	eyebrow: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	aside?: ReactNode;
}

export function PlatformPageHeader({
	icon: Icon,
	eyebrow,
	title,
	description,
	actions,
	aside,
}: PlatformPageHeaderProps) {
	return (
		<section className="flex flex-col gap-4 border-b bg-background/60 pb-5 lg:flex-row lg:items-start lg:justify-between">
			<div className="min-w-0">
				<div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
					<span className="grid size-7 place-items-center rounded-md border bg-background">
						<Icon className="size-4" />
					</span>
					<span className="min-w-0 truncate">{eyebrow}</span>
				</div>
				<h1 className="text-2xl font-semibold tracking-normal text-foreground">
					{title}
				</h1>
				{description ? (
					<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
						{description}
					</p>
				) : null}
			</div>
			{actions || aside ? (
				<div className="flex min-w-0 flex-col gap-3 lg:items-end">
					{actions ? (
						<div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div>
					) : null}
					{aside}
				</div>
			) : null}
		</section>
	);
}

export interface PlatformConnectionCardProps {
	serverUrl: string;
	username: string;
	hasErrors: boolean;
	labels: {
		server: string;
		user: string;
		health: string;
		connected: string;
		partial: string;
	};
}

export function PlatformConnectionCard({
	serverUrl,
	username,
	hasErrors,
	labels,
}: PlatformConnectionCardProps) {
	return (
		<div className="grid min-w-0 gap-2 rounded-lg border bg-background p-3 text-xs shadow-sm sm:min-w-80">
			<div className="flex items-center justify-between gap-3">
				<span className="text-muted-foreground">{labels.server}</span>
				<span className="truncate font-mono" title={serverUrl}>
					{serverUrl}
				</span>
			</div>
			<div className="flex items-center justify-between gap-3">
				<span className="text-muted-foreground">{labels.user}</span>
				<span className="truncate font-mono" title={username}>
					{username}
				</span>
			</div>
			<div className="flex items-center justify-between gap-3">
				<span className="text-muted-foreground">{labels.health}</span>
				<StateBadge
					state={hasErrors ? 'partial' : 'ready'}
					label={hasErrors ? labels.partial : labels.connected}
				/>
			</div>
		</div>
	);
}

export interface StatCardProps {
	label: string;
	value: ReactNode;
	helper?: ReactNode;
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
			{helper ? (
				<CardContent className="text-xs leading-5 text-muted-foreground">
					{helper}
				</CardContent>
			) : null}
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
