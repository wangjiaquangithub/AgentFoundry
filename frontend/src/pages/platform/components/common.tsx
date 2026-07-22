import {
	AlertTriangle,
	Bot,
	Boxes,
	Brain,
	GitBranch,
	LayoutDashboard,
	PlayCircle,
	PlugZap,
	ShieldCheck,
	UsersRound,
	Wrench,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type HealthState = 'ready' | 'partial' | 'todo' | 'blocked';

type PlatformIcon = ComponentType<{ className?: string }>;

const platformSections: Array<{
	group: 'Build' | 'Operate' | 'Govern' | 'Configure';
	label: string;
	path: string;
	icon: PlatformIcon;
	end?: boolean;
}> = [
	{ group: 'Operate', label: '总览', path: '/platform', icon: LayoutDashboard, end: true },
	{ group: 'Build', label: 'Agents', path: '/platform/agents', icon: Bot },
	{ group: 'Build', label: 'Tools', path: '/platform/tools', icon: Wrench },
	{ group: 'Build', label: 'Knowledge / Memory', path: '/platform/memory', icon: Brain },
	{ group: 'Build', label: 'Workflows', path: '/platform/workflows', icon: GitBranch },
	{ group: 'Operate', label: 'Runs', path: '/platform/runs', icon: PlayCircle },
	{ group: 'Operate', label: 'Approvals', path: '/platform/approvals', icon: ShieldCheck },
	{ group: 'Operate', label: 'Runtime Providers', path: '/platform/connectors', icon: PlugZap },
	{ group: 'Govern', label: 'Members / Tenants', path: '/platform/tenants', icon: UsersRound },
	{ group: 'Configure', label: 'Models / Settings', path: '/platform/settings', icon: Boxes },
];

const platformSectionGroups = [
	{ label: 'Operate', items: platformSections.filter((item) => item.group === 'Operate') },
	{ label: 'Build', items: platformSections.filter((item) => item.group === 'Build') },
	{ label: 'Govern', items: platformSections.filter((item) => item.group === 'Govern') },
	{ label: 'Configure', items: platformSections.filter((item) => item.group === 'Configure') },
];

export interface PlatformPageShellProps {
	children: ReactNode;
	className?: string;
}

export function PlatformPageShell({ children, className }: PlatformPageShellProps) {
	return (
		<main className="agentfoundry-platform h-full min-h-0 flex-1 overflow-y-auto bg-slate-100">
			<div className="mx-auto grid w-full max-w-[1520px] gap-0 lg:grid-cols-[248px_minmax(0,1fr)]">
				<PlatformDesktopNav />
				<div
					className={cn(
						'flex min-w-0 flex-col gap-3 px-3 py-3 sm:px-5 sm:py-4 lg:px-6 xl:px-8',
						className,
					)}
				>
					<PlatformSectionNav />
					{children}
				</div>
			</div>
		</main>
	);
}

function PlatformDesktopNav() {
	return (
		<aside className="sticky top-0 hidden h-screen min-h-0 border-r bg-white px-3 py-4 lg:block">
			<div className="mb-4 border-b px-2 pb-4">
				<div className="text-base font-semibold tracking-normal text-foreground">AgentFoundry</div>
				<p className="mt-1 text-xs leading-5 text-muted-foreground">
					企业级 Agent 平台控制台
				</p>
			</div>
			<nav aria-label="平台导航" className="space-y-4">
				{platformSectionGroups.map((group) => (
					<div key={group.label}>
						<div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-normal text-slate-500">
							{group.label}
						</div>
						<div className="grid gap-0.5">
							{group.items.map(({ label, path, icon: Icon, end }) => (
								<NavLink
									key={path}
									to={path}
									end={end}
									className={({ isActive }) =>
										cn(
											'flex h-9 items-center gap-2 rounded-md px-2.5 text-sm transition-colors',
											'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
											isActive
												? 'bg-slate-900 text-white shadow-[inset_3px_0_0_hsl(var(--primary))]'
												: 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
										)
									}
								>
									<Icon className="size-4 shrink-0" />
									<span className="min-w-0 truncate">{label}</span>
								</NavLink>
							))}
						</div>
					</div>
				))}
			</nav>
		</aside>
	);
}

function PlatformSectionNav() {
	return (
		<nav
			aria-label="平台模块"
			className="sticky top-0 z-20 -mx-3 border-b bg-white/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-white/85 sm:-mx-5 sm:px-5 lg:hidden"
		>
			<div className="flex items-center gap-2 overflow-x-auto">
				{platformSections.map(({ label, path, icon: Icon, end }) => (
					<NavLink
						key={path}
						to={path}
						end={end}
						className={({ isActive }) =>
							cn(
								'inline-flex h-8 shrink-0 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors',
								'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
								isActive
									? 'border-primary bg-primary text-primary-foreground'
									: 'border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
							)
						}
					>
						<Icon className="size-4" />
						<span>{label}</span>
					</NavLink>
				))}
			</div>
		</nav>
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
		<section className="flex flex-col gap-3 rounded-md border bg-white px-4 py-4 sm:px-5 lg:flex-row lg:items-start lg:justify-between">
			<div className="min-w-0">
				<div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
					<span className="grid size-7 place-items-center rounded-md border bg-slate-50 text-slate-700">
						<Icon className="size-4" />
					</span>
					<span className="min-w-0 truncate">{eyebrow}</span>
				</div>
				<h1 className="text-xl font-semibold tracking-normal text-foreground sm:text-2xl">
					{title}
				</h1>
				{description ? (
					<p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">
						{description}
					</p>
				) : null}
			</div>
			{actions || aside ? (
				<div className="flex min-w-0 flex-col gap-3 lg:items-end">
					{actions ? (
						<div className="flex flex-wrap gap-2 lg:max-w-lg lg:justify-end">{actions}</div>
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
		<div className="grid min-w-0 gap-2 border-l px-3 py-1 text-xs sm:min-w-80">
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
		<div className="grid min-h-[4.5rem] grid-cols-[1fr_auto] gap-2 border-l border-border/70 bg-white px-4 py-3 first:border-l-0 max-sm:border-l-0 max-sm:border-t max-sm:first:border-t-0">
			<div className="min-w-0">
				<div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
				{loading ? (
					<Skeleton className="mt-2.5 h-6 w-14" />
				) : (
					<div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</div>
				)}
				{helper ? (
					<div className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</div>
				) : null}
			</div>
			<div className="flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
				<Icon className="size-4" />
			</div>
		</div>
	);
}

export function PlatformMetricsGrid({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<section
			className={cn(
				'overflow-hidden rounded-md border bg-white sm:grid sm:grid-cols-2 xl:grid-cols-4',
				className,
			)}
		>
			{children}
		</section>
	);
}

export function PlatformSection({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<section
			className={cn(
				'rounded-md border bg-white',
				className,
			)}
		>
			{children}
		</section>
	);
}

export function PlatformSectionHeader({
	title,
	description,
	actions,
	className,
}: {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				'flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between',
				className,
			)}
		>
			<div className="min-w-0">
				<h2 className="text-sm font-semibold text-foreground">{title}</h2>
				{description ? (
					<p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
				) : null}
			</div>
			{actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
		</div>
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
				'flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800',
				className,
			)}
		>
			<AlertTriangle className="mt-0.5 size-4 shrink-0" />
			<span className="min-w-0 break-words">{children}</span>
		</div>
	);
}

export interface PlatformDetailDrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: ReactNode;
	description?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	className?: string;
}

export function PlatformDetailDrawer({
	open,
	onOpenChange,
	title,
	description,
	children,
	footer,
	className,
}: PlatformDetailDrawerProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				className={cn(
					'w-full gap-0 overflow-hidden p-0 sm:max-w-lg lg:max-w-xl',
					className,
				)}
			>
				<SheetHeader className="border-b bg-background pr-12">
					<SheetTitle>{title}</SheetTitle>
					{description ? (
						<SheetDescription className="leading-6">{description}</SheetDescription>
					) : null}
				</SheetHeader>
				<div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
				{footer ? (
					<SheetFooter className="shrink-0 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
						{footer}
					</SheetFooter>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
