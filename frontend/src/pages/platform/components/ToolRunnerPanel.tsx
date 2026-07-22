import { CheckCircle2, Code2, Eye, ListChecks, Play, XCircle } from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useState } from 'react';

import type {
	EnterpriseToolCatalogItem,
	EnterpriseToolDecision,
	EnterpriseToolRunResponse,
} from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface ToolInputConfig {
	inputKey: string;
	labelKey: string;
	defaultValue: string;
}

interface ToolRunnerPanelProps {
	sectionRef: RefObject<HTMLElement | null>;
	selectedToolName: string;
	availableToolItems: EnterpriseToolCatalogItem[];
	toolCatalogLoading: boolean;
	selectedToolConfig?: ToolInputConfig;
	selectedToolCatalogItem?: EnterpriseToolCatalogItem | null;
	selectedToolInputValue: string;
	selectedToolInputKey?: string;
	toolApprovalId: string;
	selectedToolDecision?: EnterpriseToolDecision;
	selectedToolAllowed: boolean;
	selectedToolReason: string;
	creatingRunApproval: string | null;
	platformError: Error | string | null;
	runningTool: boolean;
	toolRunError: string | null;
	toolRunResult: EnterpriseToolRunResponse | null;
	onSelectedToolNameChange: (value: string) => void;
	onToolRunErrorChange: (value: string | null) => void;
	onToolInputsChange: Dispatch<SetStateAction<Record<string, string>>>;
	onToolApprovalIdChange: (value: string) => void;
	onCreateRunApproval: (requestType: 'tool_run') => void | Promise<unknown>;
	onRunEnterpriseTool: () => void | Promise<void>;
	t: Translate;
}

export function ToolRunnerPanel({
	sectionRef,
	selectedToolName,
	availableToolItems,
	toolCatalogLoading,
	selectedToolConfig,
	selectedToolCatalogItem,
	selectedToolInputValue,
	selectedToolInputKey,
	toolApprovalId,
	selectedToolDecision,
	selectedToolAllowed,
	selectedToolReason,
	creatingRunApproval,
	platformError,
	runningTool,
	toolRunError,
	toolRunResult,
	onSelectedToolNameChange,
	onToolRunErrorChange,
	onToolInputsChange,
	onToolApprovalIdChange,
	onCreateRunApproval,
	onRunEnterpriseTool,
	t,
}: ToolRunnerPanelProps) {
	const [resultDetailOpen, setResultDetailOpen] = useState(false);
	const selectedToolLabel =
		selectedToolCatalogItem?.name || selectedToolName || t('platform.toolRunner.selectTool');
	const resultEntries = toolRunResult?.result
		? Object.entries(toolRunResult.result).slice(0, 4)
		: [];
	const resultJson = toolRunResult ? JSON.stringify(toolRunResult, null, 2) : '';

	return (
		<section
			ref={sectionRef}
			className="overflow-hidden rounded-lg border bg-background"
		>
			<div className="border-b p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 gap-3">
						<div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
							<Code2 className="size-4 text-muted-foreground" />
						</div>
						<div className="min-w-0">
							<h2 className="text-base font-semibold">
								{t('platform.toolRunner.title')}
							</h2>
							<p className="mt-1 text-sm leading-5 text-muted-foreground">
								{t('platform.toolRunner.description')}
							</p>
						</div>
					</div>
					{selectedToolCatalogItem || selectedToolDecision ? (
						<Badge
							variant={selectedToolAllowed ? 'outline' : 'destructive'}
							className={cn(
								'shrink-0',
								selectedToolAllowed &&
									'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
							)}
						>
							{selectedToolAllowed ? (
								<CheckCircle2 className="size-3" />
							) : (
								<XCircle className="size-3" />
							)}
							{selectedToolAllowed
								? t('platform.policy.allowed')
								: t('platform.policy.denied')}
						</Badge>
					) : null}
				</div>
			</div>

			<div className="grid gap-4 p-4 xl:grid-cols-[minmax(340px,0.62fr)_minmax(0,1fr)]">
				<div className="grid content-start gap-4">
					<div className="rounded-lg border bg-background/80 p-3">
						<div className="text-xs font-medium text-muted-foreground">
							{t('platform.toolRunner.selectTool')}
						</div>
						<div className="mt-2 min-w-0 truncate font-mono text-sm font-semibold">
							{selectedToolLabel}
						</div>
						{selectedToolReason ? (
							<p className="mt-2 text-xs leading-5 text-muted-foreground">
								{selectedToolReason}
							</p>
						) : null}
						{(selectedToolCatalogItem || selectedToolDecision) &&
						!selectedToolAllowed ? (
							<p className="mt-2 text-xs text-destructive">
								{t('platform.toolRunner.notAllowed')}
							</p>
						) : null}
					</div>

					<div className="grid gap-2">
						<label className="text-xs font-medium text-muted-foreground">
							{t('platform.toolRunner.selectTool')}
						</label>
						<Select
							value={selectedToolName}
							onValueChange={(value) => {
								onSelectedToolNameChange(value);
								onToolRunErrorChange(null);
							}}
							disabled={toolCatalogLoading || availableToolItems.length === 0}
						>
							<SelectTrigger className="w-full font-mono">
								<SelectValue placeholder={t('platform.toolRunner.selectTool')} />
							</SelectTrigger>
							<SelectContent>
								{availableToolItems.map((tool) => (
									<SelectItem key={tool.name} value={tool.name}>
										{tool.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="grid gap-2">
						<label className="text-xs font-medium text-muted-foreground">
							{selectedToolConfig
								? t(`platform.toolRunner.${selectedToolConfig.labelKey}`)
								: (selectedToolCatalogItem?.input_key ??
									t('platform.toolRunner.input'))}
						</label>
						<Input
							value={selectedToolInputValue}
							onChange={(event) =>
								onToolInputsChange((current) => ({
									...current,
									[selectedToolName]: event.target.value,
								}))
							}
							disabled={!selectedToolInputKey}
						/>
					</div>

					<div className="grid gap-2">
						<label className="text-xs font-medium text-muted-foreground">
							{t('platform.toolRunner.approvalId')}
						</label>
						<Input
							value={toolApprovalId}
							onChange={(event) => onToolApprovalIdChange(event.target.value)}
							placeholder={t('platform.toolRunner.approvalIdPlaceholder')}
							className="font-mono"
						/>
					</div>

					<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
						<Button
							variant="outline"
							onClick={() => void onCreateRunApproval('tool_run')}
							disabled={
								creatingRunApproval === 'tool_run' ||
								Boolean(platformError) ||
								!selectedToolInputKey ||
								!selectedToolAllowed
							}
						>
							<ListChecks
								className={cn(
									creatingRunApproval === 'tool_run' && 'animate-pulse',
								)}
							/>
							{creatingRunApproval === 'tool_run'
								? t('platform.toolRunner.requestingApproval')
								: t('platform.toolRunner.requestApproval')}
						</Button>
						<Button
							onClick={() => void onRunEnterpriseTool()}
							disabled={
								runningTool ||
								Boolean(platformError) ||
								!selectedToolInputKey ||
								!selectedToolAllowed
							}
						>
							<Play className={cn(runningTool && 'animate-pulse')} />
							{runningTool
								? t('platform.toolRunner.running')
								: t('platform.toolRunner.run')}
						</Button>
					</div>

					{toolRunError ? (
						<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{t('platform.toolRunner.error')} {toolRunError}
						</div>
					) : null}
				</div>

				<div className="grid content-start gap-3 rounded-lg border bg-muted/20 p-4">
					<div className="flex items-center justify-between gap-3">
						<div className="flex min-w-0 items-center gap-2">
							<Code2 className="size-4 shrink-0 text-muted-foreground" />
							<h3 className="truncate text-sm font-semibold">
								{t('platform.toolRunner.result')}
							</h3>
						</div>
						{toolRunResult ? (
							<Badge variant="outline" className="bg-background font-mono">
								{selectedToolLabel}
							</Badge>
						) : null}
					</div>
					{toolRunResult ? (
						<>
							<div className="grid gap-2 rounded-lg border bg-background p-3 text-sm">
								<div className="flex items-center justify-between gap-3">
									<span className="text-muted-foreground">
										{t('platform.toolRunner.resultSummary')}
									</span>
									<Badge
										variant={toolRunResult.allowed ? 'outline' : 'destructive'}
										className={cn(
											toolRunResult.allowed &&
												'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
										)}
									>
										{toolRunResult.allowed
											? t('platform.policy.allowed')
											: t('platform.policy.denied')}
									</Badge>
								</div>
								<div className="grid gap-2 sm:grid-cols-2">
									<div className="min-w-0">
										<div className="text-xs text-muted-foreground">
											{t('platform.toolRunner.selectTool')}
										</div>
										<div className="truncate font-mono font-medium">
											{toolRunResult.tool_name}
										</div>
									</div>
									<div className="min-w-0">
										<div className="text-xs text-muted-foreground">
											{t('platform.toolRunner.approvalId')}
										</div>
										<div className="truncate font-mono font-medium">
											{toolRunResult.approval_id || '-'}
										</div>
									</div>
								</div>
							</div>
							<div className="rounded-lg border bg-background">
								<div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
									{t('platform.toolRunner.resultPreview')}
								</div>
								{resultEntries.length > 0 ? (
									<div className="divide-y text-sm">
										{resultEntries.map(([key, value]) => (
											<div
												key={key}
												className="grid gap-1 px-3 py-2 sm:grid-cols-[10rem_minmax(0,1fr)]"
											>
												<span className="truncate font-mono text-xs text-muted-foreground">
													{key}
												</span>
												<span className="truncate font-mono text-xs">
													{typeof value === 'string'
														? value
														: JSON.stringify(value)}
												</span>
											</div>
										))}
									</div>
								) : (
									<div className="px-3 py-6 text-sm text-muted-foreground">
										{t('platform.toolRunner.noResultYet')}
									</div>
								)}
							</div>
							<Sheet open={resultDetailOpen} onOpenChange={setResultDetailOpen}>
								<SheetTrigger asChild>
									<Button type="button" variant="outline" className="justify-self-start">
										<Eye className="size-4" />
										{t('platform.toolRunner.viewResultDetail')}
									</Button>
								</SheetTrigger>
								<SheetContent className="w-full sm:max-w-xl">
									<SheetHeader className="border-b pr-12">
										<SheetTitle>{t('platform.toolRunner.resultDetail')}</SheetTitle>
										<SheetDescription>
											{selectedToolLabel}
										</SheetDescription>
									</SheetHeader>
									<div className="min-h-0 flex-1 overflow-auto p-4">
										<pre className="rounded-lg border bg-background p-4 text-xs leading-5">
											{resultJson}
										</pre>
									</div>
								</SheetContent>
							</Sheet>
						</>
					) : (
						<div className="flex min-h-40 items-center rounded-lg border border-dashed bg-background p-6 text-sm text-muted-foreground">
							{t('platform.toolRunner.emptyResult')}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
