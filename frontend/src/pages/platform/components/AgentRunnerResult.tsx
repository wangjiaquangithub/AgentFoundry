import {
  AlertTriangle,
  BotMessageSquare,
  Brain,
  CheckCircle2,
  ChevronDown,
  Code2,
  Database,
  FileClock,
  LibraryBig,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { knowledgeBaseLabel } from "../platform-utils";
import type {
  EnterpriseAgentRunResponse,
  EnterpriseAgentToolCall,
  KnowledgeBaseView,
} from "@/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface AgentRunnerResultProps {
  result: EnterpriseAgentRunResponse | null;
  loading: boolean;
  error: string | null;
  toolCalls: EnterpriseAgentToolCall[];
  toolCallBadgeText: string;
  routingLabel?: string | null;
  routingText?: string | null;
  connectorSourceText?: string | null;
  modelLabel: string;
  knowledgeLabels: string[];
  knowledgeBaseById: Map<string, KnowledgeBaseView>;
  onInspectAudit: () => void;
  t: Translate;
}

function AgentRunnerNotice({ children }: { children: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function MetadataGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-0 overflow-hidden rounded-md border bg-background text-xs sm:grid-cols-2">
      {children}
    </div>
  );
}

function MetadataRow({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  tone?: "success" | "warning" | "danger";
}) {
  return (
    <div className="grid min-w-0 gap-1 border-b px-3 py-2 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "min-w-0 break-words text-xs font-medium leading-5 [overflow-wrap:anywhere]",
          mono && "font-mono",
          tone === "success" && "text-emerald-700",
          tone === "warning" && "text-amber-700",
          tone === "danger" && "text-destructive",
        )}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function StatusLine({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 min-w-0 max-w-full items-start gap-1 rounded-md border px-2 py-1 text-xs font-medium leading-5 whitespace-normal break-words [overflow-wrap:anywhere] [&_svg]:mt-0.5 [&_svg]:shrink-0",
        tone === "success" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
        tone === "warning" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-700",
        tone === "danger" &&
          "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {children}
    </span>
  );
}

function CompactSection({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-3 rounded-md border bg-background p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-4" />
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function CollapsibleSection({
  icon: Icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group min-w-0 overflow-hidden rounded-md border bg-background"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0" />
          <span className="truncate">{title}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid min-w-0 gap-3 border-t p-3">{children}</div>
    </details>
  );
}

function scoreText(score: unknown) {
  return typeof score === "number" && Number.isFinite(score)
    ? score.toFixed(3)
    : "-";
}

function timestampText(value?: string) {
  if (!value) return value;
  const createdAt = new Date(value);
  return Number.isNaN(createdAt.getTime()) ? value : createdAt.toLocaleString();
}

function listText(items: string[]) {
  return items.length > 0 ? items.join(", ") : "-";
}

function knowledgeMetadataText(
  metadata: Record<string, unknown> | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function AgentRunnerResult({
  result,
  loading,
  error,
  toolCalls,
  toolCallBadgeText,
  routingLabel,
  routingText,
  connectorSourceText,
  modelLabel,
  knowledgeLabels,
  knowledgeBaseById,
  onInspectAudit,
  t,
}: AgentRunnerResultProps) {
  const evidence = result?.evidence;
  const memoryHits = result?.memory_hits ?? [];
  const knowledgeHits = result?.knowledge_hits ?? [];
  const resultStatus = loading
    ? "loading"
    : error
      ? "error"
      : result
        ? "success"
        : "empty";

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <BotMessageSquare className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          {t("platform.agentRunner.answer")}
        </h3>
      </div>

      {resultStatus === "loading" ? (
        <div
          role="status"
          className="flex min-w-0 items-start gap-3 rounded-md border bg-slate-50 px-3 py-4 text-sm leading-6 text-muted-foreground"
        >
          <Loader2 className="mt-1 size-4 shrink-0 animate-spin" />
          <span className="min-w-0 break-words">
            {t("platform.agentRunner.running")}
          </span>
        </div>
      ) : resultStatus === "error" ? (
        <div
          role="alert"
          className="flex min-w-0 items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-4 text-sm leading-6 text-destructive"
        >
          <AlertTriangle className="mt-1 size-4 shrink-0" />
          <span className="min-w-0 break-words">
            {t("platform.agentRunner.error")} {error}
          </span>
        </div>
      ) : result ? (
        <div className="grid min-w-0 gap-3">
          <div className="grid min-w-0 gap-3 border-t py-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusLine tone={result.routed ? "success" : "danger"}>
                {result.routed
                  ? toolCallBadgeText
                  : t("platform.agentRunner.notRouted")}
              </StatusLine>
              {routingText ? (
                <StatusLine
                  tone={
                    routingLabel === "model"
                      ? "success"
                      : routingLabel === "rules"
                        ? "warning"
                        : undefined
                  }
                >
                  {t("platform.agentRunner.routingSource")}: {routingText}
                </StatusLine>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
              {result.answer}
            </p>
          </div>

          {evidence ? (
            <CompactSection
              icon={FileClock}
              title={t("platform.agentRunner.evidence")}
            >
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-wrap gap-2">
                  <StatusLine tone="success">
                    {t("platform.agentRunner.toolCallsAllowed", {
                      count: evidence.allowed_tool_call_count,
                    })}
                  </StatusLine>
                  <StatusLine
                    tone={
                      evidence.denied_tool_call_count > 0 ? "danger" : undefined
                    }
                  >
                    {t("platform.agentRunner.toolCallsDenied", {
                      count: evidence.denied_tool_call_count,
                    })}
                  </StatusLine>
                  <StatusLine
                    tone={
                      evidence.approval_required_count > 0
                        ? "warning"
                        : undefined
                    }
                  >
                    {t("platform.agentRunner.approvalRequiredCount", {
                      count: evidence.approval_required_count,
                    })}
                  </StatusLine>
                  <StatusLine>
                    {t("platform.agentRunner.knowledgeHitCount", {
                      count: evidence.knowledge_hit_count,
                    })}
                  </StatusLine>
                  <StatusLine>
                    {t("platform.agentRunner.memoryHitCount", {
                      count: evidence.memory_hit_count,
                    })}
                  </StatusLine>
                  <StatusLine tone={evidence.memory_saved ? "success" : undefined}>
                    {evidence.memory_saved
                      ? t("platform.agentRunner.memorySaved")
                      : t("platform.agentRunner.memoryNotSaved")}
                  </StatusLine>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onInspectAudit}
                  className="shrink-0 max-[520px]:w-full"
                >
                  <ShieldCheck className="size-4" />
                  {t("platform.agentRunner.viewAuditEvidence")}
                </Button>
              </div>
              <CollapsibleSection
                icon={ShieldCheck}
                title={t("platform.agentRunner.auditScope")}
              >
                <MetadataGrid>
                  <MetadataRow
                    label={t("platform.agentRunner.runId")}
                    value={evidence.run_id}
                    mono
                  />
                  <MetadataRow
                    label={t("platform.agentRunner.sessionId")}
                    value={evidence.session_id}
                    mono
                  />
                  <MetadataRow
                    label={t("platform.agentRunner.auditScope")}
                    value={`${evidence.user_id} / ${evidence.tenant}`}
                    mono
                  />
                  {evidence.approval_ids.length > 0 ? (
                    <MetadataRow
                      label={t("platform.agentRunner.approvalIds")}
                      value={evidence.approval_ids.join(", ")}
                      mono
                    />
                  ) : null}
                </MetadataGrid>
              </CollapsibleSection>
            </CompactSection>
          ) : null}

          {result.routing_error ? (
            <AgentRunnerNotice>
              {`${t("platform.agentRunner.fallbackNotice")} ${result.routing_error}`}
            </AgentRunnerNotice>
          ) : null}

          <CollapsibleSection
            icon={Database}
            title={t("platform.agentRunner.runtimeConfig")}
          >
            <MetadataGrid>
              <MetadataRow
                label={t("platform.agentRunner.auditScope")}
                value={`${result.user_id} / ${result.tenant}`}
                mono
              />
              <MetadataRow
                label={t("platform.agentRunner.instance")}
                value={result.agent_name || result.agent_id || "-"}
              />
              <MetadataRow
                label={t("platform.agentRunner.configuredTenant")}
                value={
                  result.configured_tenant ||
                  t("platform.agentManagement.noneConfigured")
                }
                mono
              />
              <MetadataRow
                label={t("platform.agentRunner.runtimeConnector")}
                value={result.connector || "-"}
                mono
              />
              <MetadataRow
                label={t("platform.agentRunner.connectorSource")}
                value={connectorSourceText || "-"}
              />
              <MetadataRow
                label={t("platform.agentManagement.modelCredential")}
                value={modelLabel}
              />
              {result.runtime_adapter ? (
                <>
                  <MetadataRow
                    label={t("platform.agentRunner.runtimeAdapter")}
                    value={result.runtime_adapter.name}
                  />
                  <MetadataRow
                    label={t("platform.agentRunner.runtimeProvider")}
                    value={result.runtime_adapter.provider}
                    mono
                  />
                  <MetadataRow
                    label={t("platform.agentRunner.runtimeMode")}
                    value={result.runtime_adapter.mode}
                    mono
                  />
                </>
              ) : null}
              <MetadataRow
                label={t("platform.agentManagement.memory")}
                value={
                  result.memory_enabled
                    ? t("platform.agentManagement.enabled")
                    : t("platform.agentManagement.disabled")
                }
                tone={result.memory_enabled ? "success" : undefined}
              />
              <MetadataRow
                label={t("platform.agentManagement.workflow")}
                value={
                  result.workflow_enabled
                    ? t("platform.agentManagement.enabled")
                    : t("platform.agentManagement.disabled")
                }
                tone={result.workflow_enabled ? "success" : undefined}
              />
              <MetadataRow
                label={t("platform.agentManagement.knowledgeBases")}
                value={listText(knowledgeLabels)}
              />
              <MetadataRow
                label={t("platform.agentManagement.tools")}
                value={listText(result.configured_tools ?? [])}
                mono
              />
            </MetadataGrid>
          </CollapsibleSection>

          <CollapsibleSection
            icon={Brain}
            title={t("platform.agentRunner.memoryHits")}
          >
            {result.memory_scope ? (
              <MetadataGrid>
                <MetadataRow
                  label={t("platform.agentRunner.memoryScope")}
                  value={`${result.memory_scope.tenant}/${result.memory_scope.user_id}/${result.memory_scope.agent_id}`}
                  mono
                />
                <MetadataRow
                  label={t("platform.agentManagement.memory")}
                  value={
                    result.memory_saved
                      ? t("platform.agentRunner.memorySaved")
                      : result.memory_enabled
                        ? t("platform.agentManagement.enabled")
                        : t("platform.agentManagement.disabled")
                  }
                  tone={result.memory_saved ? "success" : undefined}
                />
              </MetadataGrid>
            ) : null}
            {memoryHits.length > 0 ? (
              <div className="grid min-w-0 gap-2">
                {memoryHits.map((hit, index) => {
                  const toolNames = hit.tool_names ?? [];

                  return (
                    <div
                      key={hit.id || `${hit.source}-${index}`}
                      className="grid min-w-0 gap-2 rounded-md border bg-white p-3"
                    >
                      <MetadataGrid>
                        <MetadataRow
                          label={t("platform.agentRunner.memorySource")}
                          value={hit.source}
                          mono
                        />
                        <MetadataRow
                          label={t("platform.agentRunner.memoryScore")}
                          value={scoreText(hit.score)}
                          mono
                        />
                        {timestampText(hit.created_at) ? (
                          <MetadataRow
                            label={t("platform.audit.time")}
                            value={timestampText(hit.created_at)}
                            mono
                          />
                        ) : null}
                        {toolNames.length > 0 ? (
                          <MetadataRow
                            label={t("platform.agentRunner.toolCalls")}
                            value={toolNames.join(", ")}
                            mono
                          />
                        ) : null}
                      </MetadataGrid>
                      <p className="whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                        {hit.snippet}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-dashed bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                {t("platform.agentRunner.memoryHitsEmpty")}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            icon={LibraryBig}
            title={t("platform.agentRunner.knowledgeHits")}
          >
            {result.knowledge_error ? (
              <AgentRunnerNotice>
                {`${t("platform.agentRunner.knowledgeError")} ${result.knowledge_error}`}
              </AgentRunnerNotice>
            ) : null}
            {knowledgeHits.length > 0 ? (
              <div className="grid min-w-0 gap-2">
                {knowledgeHits.map((hit, index) => {
                  const knowledgeBase = knowledgeBaseById.get(
                    hit.knowledge_base_id,
                  );
                  const label = knowledgeBase
                    ? knowledgeBaseLabel(knowledgeBase)
                    : hit.knowledge_base_id;
                  const source =
                    hit.source || hit.document_id || hit.knowledge_base_id;
                  const provider = knowledgeMetadataText(
                    hit.metadata,
                    "provider",
                  );
                  const isDevFallback = hit.metadata?.dev_fallback === true;

                  return (
                    <div
                      key={`${hit.knowledge_base_id}-${hit.document_id}-${hit.chunk_index ?? index}`}
                      className="grid min-w-0 gap-2 rounded-md border bg-white p-3"
                    >
                      <MetadataGrid>
                        <MetadataRow
                          label={t("platform.agentManagement.knowledgeBases")}
                          value={label}
                        />
                        <MetadataRow
                          label={t("platform.agentRunner.knowledgeSource")}
                          value={source}
                          mono
                        />
                        <MetadataRow
                          label={t("platform.agentRunner.knowledgeScore")}
                          value={scoreText(hit.score)}
                          mono
                        />
                        {provider ? (
                          <MetadataRow
                            label={t("platform.agentRunner.knowledgeProvider")}
                            value={provider}
                            mono
                          />
                        ) : null}
                        {isDevFallback ? (
                          <MetadataRow
                            label={t(
                              "platform.agentRunner.devKnowledgeFallback",
                            )}
                            value={t(
                              "platform.agentRunner.devKnowledgeFallback",
                            )}
                            tone="warning"
                          />
                        ) : null}
                      </MetadataGrid>
                      <p className="whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                        {hit.snippet}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-dashed bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                {t("platform.agentRunner.knowledgeHitsEmpty")}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            icon={Code2}
            title={t("platform.agentRunner.trace")}
          >
            <div className="grid min-w-0 gap-2">
              <div className="text-xs font-medium text-muted-foreground">
                {t("platform.agentRunner.toolCalls")}
              </div>
              {toolCalls.map((toolCall, index) => {
                const toolName =
                  toolCall.tool_name || t("platform.agentRunner.notRouted");
                const callRoutingLabel =
                  toolCall.routing_source || toolCall.decision?.routing_source;
                const callRoutingText =
                  callRoutingLabel === "model"
                    ? t("platform.agentRunner.routingModel")
                    : callRoutingLabel === "rules"
                      ? t("platform.agentRunner.routingRules")
                      : callRoutingLabel;
                const callConnectorSourceText =
                  toolCall.connector_source === "saved_config"
                    ? t("platform.agentRunner.connectorSourceSaved")
                    : toolCall.connector_source === "global"
                      ? t("platform.agentRunner.connectorSourceGlobal")
                      : toolCall.connector_source;
                const decisionPayload = {
                  allowed: toolCall.allowed,
                  connector: toolCall.connector,
                  connector_source: toolCall.connector_source,
                  routing_source: toolCall.routing_source,
                  routing_reason: toolCall.routing_reason,
                  ...toolCall.decision,
                };

                return (
                  <div
                    key={`${toolName}-${index}`}
                    className="grid min-w-0 gap-3 rounded-md border bg-background p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusLine
                        tone={toolCall.allowed ? "success" : "danger"}
                      >
                        {toolCall.allowed ? (
                          <CheckCircle2 className="size-3" />
                        ) : (
                          <XCircle className="size-3" />
                        )}
                        {toolCall.allowed
                          ? t("platform.policy.allowed")
                          : t("platform.policy.denied")}
                      </StatusLine>
                      {toolCall.approval_required ? (
                        <StatusLine tone="warning">
                          {t("platform.agentRunner.approvalRequired")}
                        </StatusLine>
                      ) : null}
                    </div>
                    <MetadataGrid>
                      <MetadataRow
                        label={t("platform.agentRunner.toolCalls")}
                        value={toolName}
                        mono
                      />
                      {toolCall.approval_id ? (
                        <MetadataRow
                          label={t("platform.agentRunner.approvalId")}
                          value={toolCall.approval_id}
                          mono
                        />
                      ) : null}
                      {callRoutingText ? (
                        <MetadataRow
                          label={t("platform.agentRunner.routingSource")}
                          value={callRoutingText}
                          tone={
                            callRoutingLabel === "rules" ? "warning" : undefined
                          }
                        />
                      ) : null}
                      {toolCall.connector ? (
                        <MetadataRow
                          label={t("platform.agentRunner.runtimeConnector")}
                          value={toolCall.connector}
                          mono
                        />
                      ) : null}
                      {callConnectorSourceText ? (
                        <MetadataRow
                          label={t("platform.agentRunner.connectorSource")}
                          value={callConnectorSourceText}
                        />
                      ) : null}
                    </MetadataGrid>

                    {toolCall.answer ? (
                      <p className="whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                        {toolCall.answer}
                      </p>
                    ) : null}

                    <details className="rounded-md border bg-muted/20">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                        {t("platform.agentRunner.toolCalls")}
                      </summary>
                      <div className="grid min-w-0 gap-3 border-t p-3">
                        <div className="grid min-w-0 gap-2">
                          <div className="text-xs font-medium text-muted-foreground">
                            {t("platform.agentRunner.inputs")}
                          </div>
                          <pre className="min-w-0 max-w-full max-h-72 overflow-auto rounded-md bg-background p-3 font-mono text-xs leading-5">
                            {JSON.stringify(toolCall.inputs ?? {}, null, 2)}
                          </pre>
                        </div>
                        <div className="grid min-w-0 gap-2">
                          <div className="text-xs font-medium text-muted-foreground">
                            {t("platform.agentRunner.decision")}
                          </div>
                          <pre className="min-w-0 max-w-full max-h-72 overflow-auto rounded-md bg-background p-3 font-mono text-xs leading-5">
                            {JSON.stringify(decisionPayload, null, 2)}
                          </pre>
                        </div>
                        <div className="grid min-w-0 gap-2">
                          <div className="text-xs font-medium text-muted-foreground">
                            {t("platform.agentRunner.result")}
                          </div>
                          <pre className="min-w-0 max-w-full max-h-72 overflow-auto rounded-md bg-background p-3 font-mono text-xs leading-5">
                            {JSON.stringify(toolCall.result ?? {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        </div>
      ) : (
        <div className="rounded-md border border-dashed bg-slate-50 px-3 py-4 text-sm leading-6 text-muted-foreground">
          {t("platform.agentRunner.emptyResult")}
        </div>
      )}
    </div>
  );
}
