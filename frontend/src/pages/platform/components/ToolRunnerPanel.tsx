import { Code2, ListChecks, Play } from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';

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
	return (
		<section
			ref={sectionRef}
			className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]"
		>
			<div className="flex flex-col gap-3">
				<div className="flex items-start gap-2">
					<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/20">
						<Code2 className="size-4 text-muted-foreground" />
					</div>
					<div className="min-w-0">
						<h2 className="text-base font-semibold">
							{t('platform.toolRunner.title')}
						</h2>
						<p className="text-sm text-muted-foreground">
							{t('platform.toolRunner.description')}
						</p>
					</div>
				</div>

				<div className="grid gap-4 rounded-lg border bg-muted/10 p-4">
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

					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div className="min-w-0">
							{selectedToolCatalogItem || selectedToolDecision ? (
								<Badge
									variant={selectedToolAllowed ? 'outline' : 'destructive'}
									className={cn(
										selectedToolAllowed &&
											'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
									)}
								>
									{selectedToolAllowed
										? t('platform.policy.allowed')
										: t('platform.policy.denied')}
								</Badge>
							) : null}
							{selectedToolReason ? (
								<p className="mt-2 text-xs text-muted-foreground">
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
						<div className="flex flex-wrap justify-end gap-2">
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
					</div>

					{toolRunError ? (
						<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{t('platform.toolRunner.error')} {toolRunError}
						</div>
					) : null}
				</div>
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex items-center gap-2">
					<Code2 className="size-4 text-muted-foreground" />
					<h3 className="text-sm font-semibold">
						{t('platform.toolRunner.result')}
					</h3>
				</div>
				{toolRunResult ? (
					<pre className="min-h-72 overflow-auto rounded-lg border bg-muted/20 p-4 text-xs leading-5">
						{JSON.stringify(toolRunResult, null, 2)}
					</pre>
				) : (
					<div className="flex min-h-72 items-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
						{t('platform.toolRunner.emptyResult')}
					</div>
				)}
			</div>
		</section>
	);
}
