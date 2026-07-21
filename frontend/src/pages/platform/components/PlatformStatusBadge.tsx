import {
	CheckCircle2,
	CircleDashed,
	Clock3,
	FileClock,
	Loader2,
	OctagonAlert,
	XCircle,
} from 'lucide-react';

import {
	normalizePlatformStatus,
	platformStatusClassNames,
	type PlatformOperationalStatus,
} from './platform-status';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const statusIcons = {
	pending: Clock3,
	draft: FileClock,
	approved: CheckCircle2,
	rejected: XCircle,
	running: Loader2,
	success: CheckCircle2,
	failed: XCircle,
	cancelled: CircleDashed,
	disabled: CircleDashed,
	blocked: OctagonAlert,
} satisfies Record<PlatformOperationalStatus, typeof Clock3>;

interface PlatformStatusBadgeProps {
	status?: string | null;
	label?: string;
	t?: Translate;
	className?: string;
}

export function PlatformStatusBadge({
	status,
	label,
	t,
	className,
}: PlatformStatusBadgeProps) {
	const normalizedStatus = normalizePlatformStatus(status);
	const Icon = statusIcons[normalizedStatus];

	return (
		<Badge
			variant="outline"
			className={cn(platformStatusClassNames[normalizedStatus], className)}
		>
			<Icon
				className={cn(normalizedStatus === 'running' && 'animate-spin')}
				aria-hidden="true"
			/>
			{label ?? t?.(`platform.statuses.${normalizedStatus}`) ?? normalizedStatus}
		</Badge>
	);
}
