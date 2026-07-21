import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmDetail {
	label: ReactNode;
	value: ReactNode;
}

export interface PlatformConfirmActionProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: ReactNode;
	description?: ReactNode;
	actionLabel: ReactNode;
	cancelLabel: ReactNode;
	targetLabel: ReactNode;
	targetValue: ReactNode;
	impactScopeLabel: ReactNode;
	impactScope: ReactNode;
	consequenceLabel: ReactNode;
	consequence: ReactNode;
	details?: ConfirmDetail[];
	children?: ReactNode;
	variant?: 'default' | 'destructive';
	loading?: boolean;
	onConfirm: () => void | Promise<void>;
}

export function PlatformConfirmAction({
	open,
	onOpenChange,
	title,
	description,
	actionLabel,
	cancelLabel,
	targetLabel,
	targetValue,
	impactScopeLabel,
	impactScope,
	consequenceLabel,
	consequence,
	details,
	children,
	variant = 'default',
	loading,
	onConfirm,
}: PlatformConfirmActionProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="grid max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description ? (
						<DialogDescription>{description}</DialogDescription>
					) : null}
				</DialogHeader>

				<div className="min-h-0 overflow-y-auto pr-1">
					<div className="grid gap-3 rounded-lg border bg-background p-3 text-xs">
						<div className="grid gap-1">
							<span className="font-medium text-muted-foreground">
								{targetLabel}
							</span>
							<span className="break-words">{targetValue}</span>
						</div>
						<div className="grid gap-1">
							<span className="font-medium text-muted-foreground">
								{impactScopeLabel}
							</span>
							<span className="break-words">{impactScope}</span>
						</div>
						<div className="grid gap-1">
							<span className="font-medium text-muted-foreground">
								{consequenceLabel}
							</span>
							<span className="break-words">{consequence}</span>
						</div>
						{details?.map((detail, index) => (
							<div key={index} className="grid gap-1">
								<span className="font-medium text-muted-foreground">
									{detail.label}
								</span>
								<span className="break-words">{detail.value}</span>
							</div>
						))}
						{children}
					</div>
				</div>

				<DialogFooter className="sticky bottom-0">
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={loading}
					>
						{cancelLabel}
					</Button>
					<Button
						type="button"
						variant={variant === 'destructive' ? 'destructive' : 'default'}
						onClick={() => void onConfirm()}
						disabled={loading}
					>
						{actionLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
