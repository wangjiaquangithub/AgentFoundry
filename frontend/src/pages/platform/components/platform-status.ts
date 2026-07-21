export type PlatformOperationalStatus =
	| 'pending'
	| 'draft'
	| 'approved'
	| 'rejected'
	| 'running'
	| 'success'
	| 'failed'
	| 'cancelled'
	| 'disabled'
	| 'blocked';

const statusMap: Record<string, PlatformOperationalStatus> = {
	pending: 'pending',
	draft: 'draft',
	approved: 'approved',
	enabled: 'approved',
	rejected: 'rejected',
	denied: 'rejected',
	running: 'running',
	in_progress: 'running',
	success: 'success',
	completed: 'success',
	complete: 'success',
	failed: 'failed',
	error: 'failed',
	blocked: 'blocked',
	partial: 'blocked',
	cancelled: 'cancelled',
	canceled: 'cancelled',
	disabled: 'disabled',
};

export const platformStatusClassNames: Record<
	PlatformOperationalStatus,
	string
> = {
	pending: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
	draft: 'border-slate-500/30 bg-slate-500/10 text-slate-700',
	approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
	rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
	running: 'border-sky-500/30 bg-sky-500/10 text-sky-700',
	success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
	failed: 'border-destructive/30 bg-destructive/10 text-destructive',
	cancelled: 'border-slate-500/30 bg-slate-500/10 text-slate-700',
	disabled: 'border-slate-500/30 bg-slate-500/10 text-slate-700',
	blocked: 'border-orange-500/30 bg-orange-500/10 text-orange-700',
};

export function normalizePlatformStatus(
	status?: string | null,
): PlatformOperationalStatus {
	if (!status) {
		return 'pending';
	}

	return statusMap[status.toLowerCase()] ?? 'pending';
}

export function platformStatusClassName(status?: string | null) {
	return platformStatusClassNames[normalizePlatformStatus(status)];
}
