import { ListChecks } from 'lucide-react';

import type { EnterpriseSubagentTemplate, EnterpriseToolDecision } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { PlatformNotice } from './common';

interface PolicySubagentsPanelProps {
	platformLoading: boolean;
	hasPlatformStatus: boolean;
	platformError: unknown;
	toolPolicyMode: string;
	policyDecisions: EnterpriseToolDecision[];
	subagentTemplates: EnterpriseSubagentTemplate[];
	labels: {
		policyTitle: string;
		policyDescription: string;
		policyMode: string;
		policyError: string;
		policyEmpty: string;
		policyAllowed: string;
		policyDenied: string;
		subagentsTitle: string;
		subagentsDescription: string;
		subagentsError: string;
		subagentsEmpty: string;
		subagentPermission: string;
		subagentOverrideEnabled: string;
		subagentOverrideDisabled: string;
	};
}

export function PolicySubagentsPanel({
	platformLoading,
	hasPlatformStatus,
	platformError,
	toolPolicyMode,
	policyDecisions,
	subagentTemplates,
	labels,
}: PolicySubagentsPanelProps) {
	const loadingInitialStatus = platformLoading && !hasPlatformStatus;

	return (
		<section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
			<div className="flex flex-col gap-3">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="text-base font-semibold">{labels.policyTitle}</h2>
						<p className="text-sm text-muted-foreground">
							{labels.policyDescription}
						</p>
					</div>
					<Badge variant="outline" className="font-mono">
						{labels.policyMode}: {toolPolicyMode}
					</Badge>
				</div>
				{loadingInitialStatus ? (
					<div className="grid gap-3">
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-20 w-full" />
					</div>
				) : platformError ? (
					<PlatformNotice>{labels.policyError}</PlatformNotice>
				) : policyDecisions.length === 0 ? (
					<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
						{labels.policyEmpty}
					</div>
				) : (
					<div className="grid gap-3">
						{policyDecisions.map((decision) => (
							<Card key={decision.name} size="sm" className="rounded-lg shadow-none">
								<CardHeader className="grid-cols-[1fr_auto] gap-3">
									<div className="min-w-0">
										<CardTitle className="truncate font-mono text-sm">
											{decision.name}
										</CardTitle>
										<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
											{decision.reason}
										</p>
									</div>
									<Badge
										variant={decision.allowed ? 'outline' : 'destructive'}
										className={cn(
											decision.allowed &&
												'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
										)}
									>
										{decision.allowed
											? labels.policyAllowed
											: labels.policyDenied}
									</Badge>
								</CardHeader>
							</Card>
						))}
					</div>
				)}
			</div>

			<div className="flex flex-col gap-3">
				<div>
					<h2 className="text-base font-semibold">{labels.subagentsTitle}</h2>
					<p className="text-sm text-muted-foreground">
						{labels.subagentsDescription}
					</p>
				</div>
				{loadingInitialStatus ? (
					<div className="grid gap-3">
						<Skeleton className="h-24 w-full" />
						<Skeleton className="h-24 w-full" />
					</div>
				) : platformError ? (
					<PlatformNotice>{labels.subagentsError}</PlatformNotice>
				) : subagentTemplates.length === 0 ? (
					<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
						{labels.subagentsEmpty}
					</div>
				) : (
					<div className="grid gap-3">
						{subagentTemplates.map((template) => (
							<Card key={template.type} size="sm" className="rounded-lg shadow-none">
								<CardHeader>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<CardTitle className="truncate font-mono text-sm">
												{template.type}
											</CardTitle>
											<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
												{template.description}
											</p>
										</div>
										<ListChecks className="size-4 shrink-0 text-muted-foreground" />
									</div>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-2">
									<Badge variant="outline" className="font-mono">
										{labels.subagentPermission}: {template.permission_mode}
									</Badge>
									<Badge variant="outline">
										{template.override_leader_mode
											? labels.subagentOverrideEnabled
											: labels.subagentOverrideDisabled}
									</Badge>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
