import {
  BotMessageSquare,
  CheckCircle2,
  Database,
  Ellipsis,
  Eye,
  Pencil,
  Play,
  RefreshCcw,
  ShieldCheck,
  UsersRound,
  Workflow,
  Wrench,
  X,
} from "lucide-react";
import {
  type ComponentType,
  type ReactNode,
  type RefObject,
  useState,
} from "react";

import { AgentTemplateList } from "./AgentManagementOverview";
import {
  AgentRunnerConversation,
  type AgentRunnerConversationTurn,
} from "./AgentRunnerConversation";
import { AgentRunnerResult } from "./AgentRunnerResult";
import {
  PlatformNotice,
  PlatformDetailDrawer,
  PlatformPageHeader,
  PlatformPageShell,
  PlatformSection,
  PlatformSectionHeader,
  StateBadge,
  type HealthState,
} from "./common";
import { PlatformEmptyState } from "./PlatformEmptyState";
import type {
  EnterpriseAgentRunResponse,
  EnterpriseAgentTemplate,
  EnterpriseAgentToolCall,
  EnterprisePublishedAgent,
  KnowledgeBaseView,
} from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface AgentOpsSummaryItem {
  label: string;
  value: number;
  helper: string;
}

interface AgentReleasePipelineStep {
  key: string;
  title: string;
  detail: string;
  state: HealthState;
  icon: ComponentType<{ className?: string }>;
}

function AgentMetaGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-0 overflow-hidden rounded-md border bg-background text-xs sm:grid-cols-2">
      {children}
    </div>
  );
}

function AgentMetaItem({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  tone?: "danger";
}) {
  return (
    <div className="grid min-w-0 gap-1 border-b px-3 py-2 last:border-b-0 sm:border-r sm:last:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0 sm:[&:nth-child(2n)]:border-r-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "min-w-0 truncate text-sm font-medium",
          mono && "font-mono",
          tone === "danger" && "text-red-700",
        )}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function AgentCompactList({
  icon: Icon,
  label,
  items,
  empty,
  mono = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  items: string[];
  empty: string;
  mono?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-2 rounded-md border bg-background p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      {items.length > 0 ? (
        <div className="grid min-w-0 divide-y overflow-hidden rounded-md border bg-white">
          {items.map((item) => (
            <div
              key={item}
              className={cn(
                "min-w-0 truncate px-3 py-2 text-xs leading-5",
                mono && "font-mono",
              )}
              title={item}
            >
              {item}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
          {empty}
        </div>
      )}
    </div>
  );
}

function readinessStateForAgent(agent: EnterprisePublishedAgent): HealthState {
  if (agent.readiness?.status === "ready") return "ready";
  if (agent.readiness?.status === "blocked") return "blocked";
  if (agent.readiness?.status === "partial") return "partial";
  if (agent.status === "active") return "ready";
  if (agent.status === "archived") return "blocked";
  return "todo";
}

function readinessLabelForAgent(agent: EnterprisePublishedAgent, t: Translate) {
  const state = readinessStateForAgent(agent);
  if (state === "ready")
    return t("platform.agentManagement.lifecycle.readiness.ready");
  if (state === "partial")
    return t("platform.agentManagement.lifecycle.readiness.partial");
  if (state === "blocked")
    return t("platform.agentManagement.lifecycle.readiness.blocked");
  return t("platform.agentManagement.lifecycle.readiness.todo");
}

interface AgentsViewPageProps {
  t: Translate;
  platformAgentsError: string | null;
  platformAgentsLoading: boolean;
  platformAgents: unknown;
  agentManagementRef: RefObject<HTMLElement | null>;
  agentTemplateStepRef: RefObject<HTMLDivElement | null>;
  agentRunnerRef: RefObject<HTMLElement | null>;
  agentOpsSummary: AgentOpsSummaryItem[];
  agentReleasePipeline: AgentReleasePipelineStep[];
  nextAgentSetupStep: { title: string } | null;
  selectedRunAgent: EnterprisePublishedAgent | null;
  selectedRunAgentReadinessState: HealthState;
  selectedRunAgentReadinessLabel: string;
  selectedRunAgentModelLabel: string;
  selectedRunAgentKnowledgeCount: number;
  selectedRunAgentKnowledgeLabels: string[];
  selectedRunAgentToolCount: number;
  selectedRunAgentAccessAllowed: boolean;
  selectedRunAgentAccessLabel: string;
  agentTemplates: EnterpriseAgentTemplate[];
  selectedTemplateId: string | null;
  publishingTemplateId: string | null;
  activePlatformAgents: EnterprisePublishedAgent[];
  selectedRunAgentId: string;
  agentQuestion: string;
  agentApprovalId: string;
  agentSampleQuestions: string[];
  selectedAgentConversation: AgentRunnerConversationTurn[];
  agentRunResult: EnterpriseAgentRunResponse | null;
  agentRunsLoading: boolean;
  agentRunsError: string | null;
  runningAgent: boolean;
  agentRunError: string | null;
  agentToolCalls: EnterpriseAgentToolCall[];
  agentToolCallBadgeText: string;
  agentRoutingLabel?: string | null;
  agentRoutingText?: string | null;
  agentRunConnectorSourceText?: string | null;
  agentRunModelLabel: string;
  agentRunKnowledgeLabels: string[];
  knowledgeBaseById: Map<string, KnowledgeBaseView>;
  refetchPlatformAgents: () => Promise<unknown>;
  scrollToAgentRunner: () => void;
  handleNextAgentSetupStep: () => void;
  handlePrimeAgentWorkflow: (agent: EnterprisePublishedAgent) => void;
  handleEditAgent: (agent: EnterprisePublishedAgent) => void;
  scrollToGovernance: () => void;
  handleConfigureTemplate: (template: EnterpriseAgentTemplate) => void;
  handleSelectRunAgent: (agentId: string) => void;
  setAgentQuestion: (value: string) => void;
  setAgentRunError: (value: string | null) => void;
  setAgentApprovalId: (value: string) => void;
  handleClearAgentConversation: () => void;
  handleSelectAgentRun: (
    turn: AgentRunnerConversationTurn,
  ) => Promise<void> | void;
  handleRunEnterpriseAgent: () => Promise<void> | void;
  handleInspectAgentRunAudit: () => void;
}

interface AgentLifecycleWorkspaceProps {
  t: Translate;
  agents: EnterprisePublishedAgent[];
  selectedAgent: EnterprisePublishedAgent | null;
  selectedAgentReadinessState: HealthState;
  selectedAgentReadinessLabel: string;
  selectedAgentModelLabel: string;
  selectedAgentKnowledgeLabels: string[];
  selectedAgentKnowledgeCount: number;
  selectedAgentToolCount: number;
  selectedAgentAccessAllowed: boolean;
  selectedAgentAccessLabel: string;
  onSelectAgent: (agentId: string) => void;
  onRunAgent: (agentId?: string) => void;
  onRunWorkflow: (agent: EnterprisePublishedAgent) => void;
  onEditAgent: (agent: EnterprisePublishedAgent) => void;
  onOpenGovernance: () => void;
  onOpenConfiguration: () => void;
}

function AgentLifecycleWorkspace({
  t,
  agents,
  selectedAgent,
  selectedAgentReadinessState,
  selectedAgentReadinessLabel,
  selectedAgentModelLabel,
  selectedAgentKnowledgeLabels,
  selectedAgentKnowledgeCount,
  selectedAgentToolCount,
  selectedAgentAccessAllowed,
  selectedAgentAccessLabel,
  onSelectAgent,
  onRunAgent,
  onRunWorkflow,
  onEditAgent,
  onOpenGovernance,
  onOpenConfiguration,
}: AgentLifecycleWorkspaceProps) {
  const selectedAgentCapabilities = selectedAgent?.capabilities ?? [];
  const selectedAgentTools = selectedAgent?.tools ?? [];
  const [agentDrawerOpen, setAgentDrawerOpen] = useState(false);
  const hasAgents = agents.length > 0;

  return (
    <PlatformSection>
      <PlatformSectionHeader
        title={t("platform.agentManagement.lifecycle.title")}
        description={t("platform.agentManagement.lifecycle.description")}
        actions={
          <Badge
            variant="outline"
            className="max-w-full bg-white max-[520px]:hidden"
          >
            {t("platform.agentManagement.lifecycle.onlineAgents", {
              count: agents.length,
            })}
          </Badge>
        }
      />

      <div className="grid min-w-0 gap-3 p-3 max-[520px]:p-2">
        <div className="grid grid-cols-[minmax(0,1.35fr)_7rem_6.5rem_7.5rem_7rem_auto] gap-3 border-b px-3 pb-2 text-xs font-medium text-muted-foreground max-xl:hidden">
          <span>{t("platform.agentManagement.lifecycle.inventory")}</span>
          <span>{t("platform.agentManagement.lifecycle.toolBindings")}</span>
          <span>{t("platform.agentManagement.knowledgeBases")}</span>
          <span>{t("platform.agentManagement.workflow")}</span>
          <span>{t("platform.agentManagement.lifecycle.accessScope")}</span>
          <span className="text-right">{t("platform.quickActions.title")}</span>
        </div>
        {hasAgents ? (
          <div className="overflow-hidden rounded-md border bg-white">
            {agents.map((agent) => {
              const isSelected = selectedAgent?.id === agent.id;
              const readinessState = readinessStateForAgent(agent);

              return (
                <div
                  key={agent.id}
                  className={cn(
                    "grid w-full min-w-0 gap-3 border-b px-3 py-3 text-left transition-colors last:border-b-0 max-[520px]:gap-2 max-[520px]:px-2",
                    "hover:bg-slate-50",
                    "xl:grid-cols-[minmax(0,1.35fr)_7rem_6.5rem_7.5rem_7rem_auto] xl:items-center",
                    isSelected && "bg-primary/5",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-col gap-2 min-[521px]:flex-row min-[521px]:items-start min-[521px]:justify-between 2xl:justify-start">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium max-[520px]:whitespace-normal max-[520px]:break-words max-[520px]:text-[13px] max-[520px]:leading-5">
                          {agent.name}
                        </div>
                        <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                          <UsersRound className="size-3.5 shrink-0" />
                          <span className="truncate font-mono">
                            {agent.tenant}
                          </span>
                        </div>
                      </div>
                      <StateBadge
                        state={readinessState}
                        label={readinessLabelForAgent(agent, t)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs max-[520px]:grid-cols-1 xl:contents">
                    <span className="rounded-md border bg-background px-2 py-1 text-center tabular-nums xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:text-left">
                      {t("platform.agentManagement.lifecycle.toolsCount", {
                        count: agent.tools.length,
                      })}
                    </span>
                    <span className="rounded-md border bg-background px-2 py-1 text-center tabular-nums xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:text-left">
                      {t("platform.agentManagement.lifecycle.knowledgeCount", {
                        count: agent.knowledge_base_ids.length,
                      })}
                    </span>
                    <span className="rounded-md border bg-background px-2 py-1 text-center xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:text-left">
                      {agent.workflow_enabled
                        ? t("platform.agentManagement.lifecycle.workflowMode")
                        : t("platform.agentManagement.lifecycle.directMode")}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "hidden truncate text-xs font-medium xl:block",
                      !selectedAgentAccessAllowed &&
                        isSelected &&
                        "text-red-700",
                    )}
                  >
                    {isSelected ? selectedAgentAccessLabel : agent.status}
                  </span>
                  <div className="flex min-w-0 flex-wrap justify-start gap-2 xl:justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onRunAgent(agent.id)}
                      className="max-[520px]:flex-1"
                    >
                      <Play />
                      {t("platform.agentManagement.runAgent")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onSelectAgent(agent.id);
                        setAgentDrawerOpen(true);
                      }}
                      className="max-[520px]:flex-1"
                    >
                      <Eye />
                      {t("platform.actions.viewModule")}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={t("platform.quickActions.title")}
                        >
                          <Ellipsis className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-44">
                        <DropdownMenuItem onSelect={() => onEditAgent(agent)}>
                          <Pencil className="size-4" />
                          {t("platform.agentManagement.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => onRunWorkflow(agent)}
                          disabled={!agent.workflow_enabled}
                        >
                          <Workflow className="size-4" />
                          {t("platform.agentManagement.workflow")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            onSelectAgent(agent.id);
                            onOpenGovernance();
                          }}
                        >
                          <ShieldCheck className="size-4" />
                          {t("platform.agentManagement.lifecycle.governance")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4 rounded-md border border-dashed bg-slate-50/60 px-4 py-6 text-center max-[520px]:px-3">
            <PlatformEmptyState
              variant="noData"
              title={t("platform.agentManagement.lifecycle.emptyTitle")}
              description={t(
                "platform.agentManagement.lifecycle.emptyDescription",
              )}
              className="border-0 bg-transparent p-0"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mx-auto max-[520px]:w-full"
              onClick={onOpenConfiguration}
            >
              <Workflow />
              {t("platform.agentManagement.configuration")}
            </Button>
          </div>
        )}

        <PlatformDetailDrawer
          open={agentDrawerOpen && Boolean(selectedAgent)}
          onOpenChange={setAgentDrawerOpen}
          title={
            selectedAgent?.name ??
            t("platform.agentManagement.lifecycle.selectTitle")
          }
          description={selectedAgent?.description}
        >
          {selectedAgent ? (
            <>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StateBadge
                      state={selectedAgentReadinessState}
                      label={selectedAgentReadinessLabel}
                    />
                  </div>
                </div>
                <div className="flex min-w-0 flex-wrap gap-2 max-[520px]:w-full">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setAgentDrawerOpen(false);
                      onRunAgent(selectedAgent.id);
                    }}
                  >
                    <Play />
                    {t("platform.agentManagement.runAgent")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onEditAgent(selectedAgent)}
                  >
                    <Pencil />
                    {t("platform.agentManagement.edit")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAgentDrawerOpen(false);
                      onRunWorkflow(selectedAgent);
                    }}
                    disabled={!selectedAgent.workflow_enabled}
                  >
                    <Workflow />
                    {t("platform.agentManagement.workflow")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAgentDrawerOpen(false);
                      onOpenGovernance();
                    }}
                  >
                    <ShieldCheck />
                    {t("platform.agentManagement.lifecycle.governance")}
                  </Button>
                </div>
              </div>

              <AgentMetaGrid>
                <AgentMetaItem
                  label={t("platform.agentManagement.modelCredential")}
                  value={selectedAgentModelLabel}
                  mono
                />
                <AgentMetaItem
                  label={t("platform.agentManagement.lifecycle.toolBindings")}
                  value={selectedAgentToolCount}
                />
                <AgentMetaItem
                  label={t("platform.agentManagement.knowledgeBases")}
                  value={selectedAgentKnowledgeCount}
                />
                <AgentMetaItem
                  label={t("platform.agentManagement.lifecycle.accessScope")}
                  value={selectedAgentAccessLabel}
                  tone={!selectedAgentAccessAllowed ? "danger" : undefined}
                />
                <AgentMetaItem
                  label={t("platform.agentManagement.memory")}
                  value={
                    selectedAgent.memory_enabled
                      ? t("platform.agentManagement.enabled")
                      : t("platform.agentManagement.disabled")
                  }
                />
                <AgentMetaItem
                  label={t("platform.agentManagement.workflow")}
                  value={
                    selectedAgent.workflow_enabled
                      ? t("platform.agentManagement.enabled")
                      : t("platform.agentManagement.disabled")
                  }
                />
              </AgentMetaGrid>

              <div className="grid gap-3 lg:grid-cols-2">
                <AgentCompactList
                  icon={Wrench}
                  label={t(
                    "platform.agentManagement.lifecycle.toolsAndPermissions",
                  )}
                  items={selectedAgentTools}
                  empty={t("platform.agentManagement.lifecycle.noTools")}
                  mono
                />
                <AgentCompactList
                  icon={Database}
                  label={t(
                    "platform.agentManagement.lifecycle.knowledgeAndCapabilities",
                  )}
                  items={[
                    ...selectedAgentKnowledgeLabels,
                    ...selectedAgentCapabilities,
                  ]}
                  empty={t(
                    "platform.agentManagement.lifecycle.noKnowledgeOrCapabilities",
                  )}
                />
              </div>

              <div className="grid min-w-0 gap-1 border-t pt-3 text-xs">
                <div className="text-[11px] text-muted-foreground">ID</div>
                <div
                  className="min-w-0 break-words font-mono leading-5 text-muted-foreground"
                  title={selectedAgent.id}
                >
                  {selectedAgent.id}
                </div>
              </div>
            </>
          ) : null}
        </PlatformDetailDrawer>
      </div>
    </PlatformSection>
  );
}

export function AgentsViewPage({
  t,
  platformAgentsError,
  platformAgentsLoading,
  platformAgents,
  agentManagementRef,
  agentTemplateStepRef,
  agentRunnerRef,
  agentOpsSummary,
  agentReleasePipeline,
  nextAgentSetupStep,
  selectedRunAgent,
  selectedRunAgentReadinessState,
  selectedRunAgentReadinessLabel,
  selectedRunAgentModelLabel,
  selectedRunAgentKnowledgeCount,
  selectedRunAgentKnowledgeLabels,
  selectedRunAgentToolCount,
  selectedRunAgentAccessAllowed,
  selectedRunAgentAccessLabel,
  agentTemplates,
  selectedTemplateId,
  publishingTemplateId,
  activePlatformAgents,
  selectedRunAgentId,
  agentQuestion,
  agentApprovalId,
  agentSampleQuestions,
  selectedAgentConversation,
  agentRunResult,
  agentRunsLoading,
  agentRunsError,
  runningAgent,
  agentRunError,
  agentToolCalls,
  agentToolCallBadgeText,
  agentRoutingLabel,
  agentRoutingText,
  agentRunConnectorSourceText,
  agentRunModelLabel,
  agentRunKnowledgeLabels,
  knowledgeBaseById,
  refetchPlatformAgents,
  scrollToAgentRunner,
  handleNextAgentSetupStep,
  handlePrimeAgentWorkflow,
  handleEditAgent,
  scrollToGovernance,
  handleConfigureTemplate,
  handleSelectRunAgent,
  setAgentQuestion,
  setAgentRunError,
  setAgentApprovalId,
  handleClearAgentConversation,
  handleSelectAgentRun,
  handleRunEnterpriseAgent,
  handleInspectAgentRunAudit,
}: AgentsViewPageProps) {
  const [runnerOpen, setRunnerOpen] = useState(false);
  const runnerStateLabel = selectedRunAgent
    ? selectedRunAgentReadinessLabel
    : t("platform.agentRunner.noInstances");
  const platformAgentsInitialLoading =
    platformAgentsLoading && !platformAgents;
  const metricIcons = [BotMessageSquare, CheckCircle2, Database, Wrench];
  const runDisabledReason = !selectedRunAgentId
    ? t("platform.agentRunner.noInstances")
    : !selectedRunAgentAccessAllowed
      ? selectedRunAgentAccessLabel
      : !agentQuestion.trim()
        ? t("platform.agentRunner.question")
        : null;
  const clearAgentRunnerState = () => {
    setAgentRunError(null);
    setAgentApprovalId("");
    setAgentQuestion("");
    void handleClearAgentConversation();
  };
  const handleOpenAgentRunner = (agentId?: string) => {
    const targetAgentId = agentId ?? selectedRunAgent?.id;
    if (!targetAgentId) return;
    clearAgentRunnerState();
    if (targetAgentId !== selectedRunAgent?.id) {
      handleSelectRunAgent(targetAgentId);
    }
    setRunnerOpen(true);
    window.setTimeout(() => {
      scrollToAgentRunner();
      agentRunnerRef.current?.focus();
    }, 0);
  };
  const handleCloseAgentRunner = () => {
    setRunnerOpen(false);
    clearAgentRunnerState();
  };
  const handleOpenAgentConfiguration = () => {
    window.setTimeout(() => {
      agentTemplateStepRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  return (
    <PlatformPageShell className="min-w-0 max-w-full overflow-x-hidden max-[520px]:gap-3 max-[520px]:px-2 max-[520px]:[overflow-wrap:anywhere] max-[520px]:[&_h1]:text-xl max-[520px]:[&_h1]:leading-6 max-[520px]:[&_h1]:[overflow-wrap:anywhere] max-[520px]:[&_p]:[overflow-wrap:anywhere]">
      <PlatformPageHeader
        icon={BotMessageSquare}
        eyebrow={t("platform.agentManagement.title")}
        title={t("platform.agentManagement.title")}
        description={t("platform.agentManagement.description")}
        actions={
          <Button
            size="sm"
            variant="outline"
            aria-label={t("platform.actions.refreshStatus")}
            onClick={() => void refetchPlatformAgents()}
            disabled={platformAgentsLoading}
            className="max-[520px]:size-8 max-[520px]:p-0"
          >
            <RefreshCcw className={cn(platformAgentsLoading && "animate-spin")} />
            <span className="max-[520px]:sr-only">
              {t("platform.actions.refreshStatus")}
            </span>
          </Button>
        }
      />

      {platformAgentsError ? (
        <PlatformNotice>
          {t("platform.agentManagement.loadError")}
        </PlatformNotice>
      ) : null}

      <section className="grid overflow-hidden border-y border-slate-200 bg-white grid-cols-2 xl:grid-cols-4">
        {agentOpsSummary.map((item, index) => {
          const MetricIcon = metricIcons[index % metricIcons.length];
          return (
            <div
              key={item.label}
              className="grid min-h-[4.5rem] grid-cols-[minmax(0,1fr)_auto] gap-2 border-t px-3 py-2 first:border-t-0 even:border-l sm:min-h-[5rem] sm:gap-3 sm:px-4 sm:py-3 xl:border-l xl:border-t-0 xl:first:border-l-0 xl:[&:nth-child(4n+1)]:border-l-0"
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-muted-foreground">
                  {item.label}
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">
                  {item.value}
                </div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">
                  {item.helper}
                </div>
              </div>
              <div className="grid size-7 place-items-center rounded-md bg-slate-100 text-slate-600 sm:size-8">
                <MetricIcon className="size-3.5 sm:size-4" />
              </div>
            </div>
          );
        })}
      </section>

      <div className="grid min-w-0 max-w-full items-start gap-4 overflow-x-hidden">
        <section ref={agentManagementRef} className="grid min-w-0 gap-4">
          <AgentLifecycleWorkspace
            t={t}
            agents={activePlatformAgents}
            selectedAgent={selectedRunAgent}
            selectedAgentReadinessState={selectedRunAgentReadinessState}
            selectedAgentReadinessLabel={selectedRunAgentReadinessLabel}
            selectedAgentModelLabel={selectedRunAgentModelLabel}
            selectedAgentKnowledgeLabels={selectedRunAgentKnowledgeLabels}
            selectedAgentKnowledgeCount={selectedRunAgentKnowledgeCount}
            selectedAgentToolCount={selectedRunAgentToolCount}
            selectedAgentAccessAllowed={selectedRunAgentAccessAllowed}
            selectedAgentAccessLabel={selectedRunAgentAccessLabel}
            onSelectAgent={handleSelectRunAgent}
            onRunAgent={handleOpenAgentRunner}
            onRunWorkflow={handlePrimeAgentWorkflow}
            onEditAgent={handleEditAgent}
            onOpenGovernance={scrollToGovernance}
            onOpenConfiguration={handleOpenAgentConfiguration}
          />
        </section>

        <details
          open={activePlatformAgents.length === 0}
          className="group min-w-0 overflow-hidden border-y border-slate-200 bg-white"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-slate-50/70 px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring max-[520px]:px-3 [&::-webkit-details-marker]:hidden">
            <span>{t("platform.agentManagement.configuration")}</span>
            <span className="truncate text-xs font-normal text-muted-foreground max-[520px]:hidden group-open:hidden">
              {t("platform.agentManagement.configurationCollapsedHint")}
            </span>
            <span className="hidden text-xs font-normal text-muted-foreground max-[520px]:hidden group-open:inline">
              {t("platform.agentManagement.collapse")}
            </span>
          </summary>
          <div className="grid min-w-0 gap-4 border-t p-3 max-[520px]:p-2">
            <div className="grid min-w-0 gap-3">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">
                    {t("platform.agentManagement.pipeline.title")}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t("platform.agentManagement.pipeline.description")}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleNextAgentSetupStep}
                  disabled={!nextAgentSetupStep}
                  className="max-[520px]:w-full"
                >
                  <Workflow />
                  {nextAgentSetupStep
                    ? t("platform.agentManagement.wizard.nextAction")
                    : t("platform.agentManagement.wizard.readyAction")}
                </Button>
              </div>
              <div className="grid min-w-0 gap-2">
                {agentReleasePipeline.map((step) => {
                  const StepIcon = step.icon;
                  return (
                    <div
                      key={step.key}
                      className="grid min-w-0 gap-3 rounded-md border bg-background px-3 py-2 max-[520px]:gap-2 max-[520px]:px-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="grid size-8 place-items-center rounded-md border bg-white text-slate-600">
                        <StepIcon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {step.title}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {step.detail}
                        </div>
                      </div>
                      <StateBadge
                        state={step.state}
                        label={t(
                          `platform.agentManagement.wizard.states.${step.state}`,
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <section ref={agentTemplateStepRef} className="grid min-w-0 gap-3">
              <AgentTemplateList
                templates={agentTemplates}
                selectedTemplateId={selectedTemplateId}
                loading={platformAgentsLoading}
                hasLoaded={Boolean(platformAgents)}
                publishingTemplateId={publishingTemplateId}
                labels={{
                  title: t("platform.agentManagement.templates"),
                  empty: t("platform.agentManagement.emptyTemplates"),
                  configure: t("platform.agentManagement.configure"),
                }}
                onConfigureTemplate={handleConfigureTemplate}
              />
            </section>
          </div>
        </details>

        {runnerOpen ? (
          <PlatformSection>
            <PlatformSectionHeader
              title={t("platform.agentManagement.runnerSection.title")}
              description={t(
                "platform.agentManagement.runnerSection.description",
              )}
              actions={
                <div className="flex items-center gap-2">
                  <StateBadge
                    state={selectedRunAgentReadinessState}
                    label={runnerStateLabel}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t("common.close")}
                    onClick={handleCloseAgentRunner}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              }
            />
            <div className="grid min-w-0 items-start gap-4 p-3 max-[520px]:p-2 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <section
                ref={agentRunnerRef}
                tabIndex={-1}
                className="grid min-w-0 gap-4 outline-none"
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
                    <BotMessageSquare className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">
                      {t("platform.agentRunner.title")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t("platform.agentRunner.description")}
                    </p>
                  </div>
                </div>

                {platformAgentsInitialLoading ? (
                  <div
                    role="status"
                    className="rounded-md border bg-slate-50/60 p-4 text-sm text-muted-foreground max-[520px]:p-3"
                  >
                    {t("common.loading")}
                  </div>
                ) : activePlatformAgents.length === 0 ? (
                  <div className="grid gap-3 rounded-md border border-dashed bg-slate-50/60 p-4 text-sm text-muted-foreground max-[520px]:p-3">
                    <div>{t("platform.agentRunner.noInstances")}</div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-fit max-[520px]:w-full"
                      onClick={handleOpenAgentConfiguration}
                    >
                      <Workflow />
                      {t("platform.agentManagement.configuration")}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-2">
                      <label
                        htmlFor="agent-runner-instance"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        {t("platform.agentRunner.instance")}
                      </label>
                      <Select
                        value={selectedRunAgentId}
                        onValueChange={handleSelectRunAgent}
                        disabled={activePlatformAgents.length === 0}
                      >
                        <SelectTrigger
                          id="agent-runner-instance"
                          className="w-full min-w-0"
                        >
                          <SelectValue
                            placeholder={t(
                              "platform.agentRunner.selectInstance",
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {activePlatformAgents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              <span className="block max-w-full truncate">
                                {agent.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedRunAgent ? (
                      <AgentMetaGrid>
                        <AgentMetaItem
                          label={t("platform.audit.tenant")}
                          value={selectedRunAgent.tenant}
                          mono
                        />
                        <AgentMetaItem
                          label={t("platform.agentManagement.modelCredential")}
                          value={selectedRunAgentModelLabel}
                        />
                        <AgentMetaItem
                          label={t("platform.agentManagement.knowledgeBases")}
                          value={selectedRunAgentKnowledgeLabels.length}
                        />
                        <AgentMetaItem
                          label={t(
                            "platform.agentManagement.lifecycle.toolBindings",
                          )}
                          value={selectedRunAgentToolCount}
                        />
                        <AgentMetaItem
                          label={t(
                            "platform.agentManagement.lifecycle.accessScope",
                          )}
                          value={selectedRunAgentAccessLabel}
                          tone={
                            !selectedRunAgentAccessAllowed
                              ? "danger"
                              : undefined
                          }
                        />
                      </AgentMetaGrid>
                    ) : null}

                    <div className="grid gap-2">
                      <label
                        htmlFor="agent-runner-question"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        {t("platform.agentRunner.question")}
                      </label>
                      <Textarea
                        id="agent-runner-question"
                        value={agentQuestion}
                        onChange={(event) => {
                          setAgentQuestion(event.target.value);
                          setAgentRunError(null);
                        }}
                        placeholder={t("platform.agentRunner.placeholder")}
                        aria-describedby={
                          runDisabledReason
                            ? "agent-runner-run-help"
                            : undefined
                        }
                        className="min-h-28 resize-y"
                      />
                    </div>

                    <details className="group overflow-hidden rounded-md border bg-slate-50/60">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                        <span>{t("platform.agentRunner.approvalId")}</span>
                        <span className="group-open:hidden">
                          {t(
                            "platform.agentManagement.configurationCollapsedHint",
                          )}
                        </span>
                        <span className="hidden group-open:inline">
                          {t("platform.agentManagement.collapse")}
                        </span>
                      </summary>
                      <div className="border-t p-3">
                        <label
                          htmlFor="agent-runner-approval-id"
                          className="sr-only"
                        >
                          {t("platform.agentRunner.approvalId")}
                        </label>
                        <Input
                          id="agent-runner-approval-id"
                          value={agentApprovalId}
                          onChange={(event) => {
                            setAgentApprovalId(event.target.value);
                            setAgentRunError(null);
                          }}
                          placeholder={t(
                            "platform.agentRunner.approvalIdPlaceholder",
                          )}
                          className="font-mono"
                        />
                      </div>
                    </details>

                    <div className="grid min-w-0 gap-2">
                      <Button
                        className="w-fit max-[520px]:w-full"
                        onClick={handleRunEnterpriseAgent}
                        disabled={
                          runningAgent ||
                          !agentQuestion.trim() ||
                          !selectedRunAgentId ||
                          !selectedRunAgentAccessAllowed
                        }
                        aria-describedby={
                          runDisabledReason
                            ? "agent-runner-run-help"
                            : undefined
                        }
                      >
                        <Play className={cn(runningAgent && "animate-pulse")} />
                        {runningAgent
                          ? t("platform.agentRunner.running")
                          : t("platform.agentRunner.run")}
                      </Button>
                      {runDisabledReason ? (
                        <div
                          id="agent-runner-run-help"
                          className="text-xs leading-5 text-muted-foreground"
                        >
                          {runDisabledReason}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid min-w-0 gap-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        {t("platform.agentRunner.samples")}
                      </div>
                      <div className="flex min-w-0 flex-wrap gap-2">
                        {agentSampleQuestions.map((sample) => (
                          <Button
                            key={sample}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="max-w-full justify-start whitespace-normal text-left max-[520px]:w-full"
                            onClick={() => {
                              setAgentQuestion(sample);
                              setAgentRunError(null);
                            }}
                          >
                            {sample}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <AgentRunnerConversation
                      turns={selectedAgentConversation}
                      activeResponse={agentRunResult}
                      loading={agentRunsLoading}
                      error={agentRunsError}
                      labels={{
                        title: t("platform.agentRunner.conversation"),
                        clear: t("platform.agentRunner.clearConversation"),
                        loading: t("common.loading"),
                        empty: t("platform.agentRunner.conversationEmpty"),
                        selectedTool: t("platform.agentRunner.selectedTool"),
                        notRouted: t("platform.agentRunner.notRouted"),
                      }}
                      onClear={handleClearAgentConversation}
                      onSelectTurn={(turn) => void handleSelectAgentRun(turn)}
                    />

                    {agentRunError ? (
                      <div
                        role="alert"
                        className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                      >
                        {t("platform.agentRunner.error")} {agentRunError}
                      </div>
                    ) : null}
                  </>
                )}
              </section>

              <section className="grid min-w-0 gap-3">
                <AgentRunnerResult
                  result={agentRunResult}
                  loading={runningAgent}
                  error={agentRunError}
                  toolCalls={agentToolCalls}
                  toolCallBadgeText={agentToolCallBadgeText}
                  routingLabel={agentRoutingLabel}
                  routingText={agentRoutingText}
                  connectorSourceText={agentRunConnectorSourceText}
                  modelLabel={agentRunModelLabel}
                  knowledgeLabels={agentRunKnowledgeLabels}
                  knowledgeBaseById={knowledgeBaseById}
                  onInspectAudit={handleInspectAgentRunAudit}
                  t={t}
                />
              </section>
            </div>
          </PlatformSection>
        ) : null}
      </div>
    </PlatformPageShell>
  );
}
