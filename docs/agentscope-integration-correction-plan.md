# AgentFoundry / AgentScope 2.0 架构修正计划

## 1. 目的

本文档记录把 AgentFoundry 从“AgentScope 与 Foundry 平行执行”状态逐步收敛为以下边界的实施计划与历史状态：

> **AgentFoundry 负责企业产品控制面和治理；AgentScope 2.0 负责 Agent Application Runtime 与执行。**

修正不是推倒重写，也不是把企业 IAM、组织和审计主数据迁入 AgentScope。实施时应保留现有 API 和业务记录的连续性，通过稳定映射、事件投影和兼容层分阶段迁移。

正式职责边界见 [`agentscope-agentfoundry-boundary.md`](agentscope-agentfoundry-boundary.md)。本文中的阶段目标是迁移方向，不应被解读为当前实现已满足全部完成定义。

### 当前实施状态

| 阶段 | 状态 | 当前结果与限制 |
| --- | --- | --- |
| 0 | 已完成 | 通过明确的 `execution_mode`/`runtime_provider` 选择运行时；新 Agent 不再从 `template_id` 推断 AgentScope；存量 Agent 保持兼容。 |
| 1 | 已完成 | Gateway provider binding 和 capability 校验采用严格失败语义；未连接能力不会静默 fallback。 |
| 2 | 已完成 | AgentScope 事件可幂等投影为 Foundry Run、Tool Call 和 Audit 记录。 |
| 3 | 已完成 | 天气 Agent 建立 Session 生命周期和真实工具执行基准链路。 |
| 4 | 已完成 | 已发布 Agent 统一从显式 execution metadata 选择执行入口。 |
| 5 | 已完成 | 建立 Memory、Knowledge、Workflow 等运行资源的治理/执行边界；尚未迁移这些执行能力。 |
| 6 | 已完成 | 原生 provider 对未连接的 Memory、Knowledge/RAG、Workflow、Schedule、Team、Workspace/Sandbox capability 明确拒绝。 |
| 7 | 本文档收尾 | 核对并删除过时表述；保留显式 `foundry_compatibility` 和企业 Workflow 兼容路径。 |

对应提交依次为 `4e7bb38`、`293a8c7`、`0c3eabd`、`4e221eb`、`688a426`、`9d4d9df`、`00bf588`。这些提交完成的是安全边界和可验证的迁移基础，不等于 Memory、Knowledge/RAG、Workflow、Schedule、Team、Workspace/Sandbox 已经接入 AgentScope，也不等于 compatibility provider 已经清零。

## 2. 当前状态与问题

当前实现仍属于受控的混合过渡架构：

- Runtime 由 `execution_mode` 和 `runtime_provider` 明确选择，不再通过模板名称或 ID 推断。
- 天气 Agent 已使用 AgentScope `Agent`、`Toolkit`、模型和 Tool 完成真实推理、工具选择和 Session 生命周期。
- AgentScope 事件已幂等投影为 AgentFoundry 的 Run、Tool Call 和 Audit 记录。
- 原生 provider 的 capability binding 是严格的；请求未连接能力会明确失败。
- `foundry_compatibility` 仍为存量 Agent 提供显式兼容，企业 Workflow 也保留明确标记的兼容执行路径。

但当前还存在以下结构性问题：

1. Memory、Knowledge/RAG、Workflow、Schedule、Team 和 Workspace/Sandbox 尚未连接到当前原生 provider；现阶段只建立了边界和失败语义。
2. 存量 Agent 仍可能进入显式 `foundry_compatibility` 执行链，尚未完成清零和删除。
3. 企业 Workflow 执行仍是明确标记的 Foundry 兼容路径，尚未迁移到 AgentScope Schedule/Team 或其他运行原语。
4. 当前 Gateway 仍以本仓库已经接通的生命周期为限，尚未覆盖 AgentScope Application Service 的全部 Agent、Chat、Credential、Knowledge Base、Workspace 和 Schedule API。
5. AgentScope 技术 Trace、完整 Permission 决策和更多资源事件仍需继续纳入企业投影与生产可观测性。

这些限制不影响已接通能力的回归验证，但在相应 provider binding 完成前，不得宣称运行期 Memory、Knowledge/RAG、Workflow、Schedule、Team 或 Workspace/Sandbox 已迁移。

## 3. 修正原则

### 3.1 单一执行事实源

- Agent 推理、模型调用、工具调用、Session/Chat 状态、AgentState、运行期 Memory/RAG 和 Workspace 以 AgentScope 为执行事实源。
- AgentFoundry 不根据自己的路由或检索结果再次执行同一业务工具，也不通过重放工具生成审计证据。
- Foundry 可以保存面向企业查询的投影，但投影必须能追溯到 AgentScope 的稳定标识和事件。

### 3.2 治理与执行分离

- Foundry/IAM 继续作为企业租户、组织、成员、角色、发布、可见性、审批、配额和保留政策的事实源。
- Foundry 将可信身份和授权结果转换为 AgentScope Resource Access Policy、Middleware、Tool 集合和 Permission Context。
- AgentScope 在资源访问和工具执行点再次强制执行权限。

### 3.3 先兼容迁移，再删除旧链路

- 不一次性删除现有 Foundry 本地运行逻辑。
- 新旧路径并存期间必须显式标记运行模式，不允许静默 fallback 后仍报告为 AgentScope 原生执行。
- 只有在数据映射、回归测试和可观测性全部通过后，才删除对应兼容代码。

### 3.4 优先采用进程内嵌入

第一阶段继续使用当前进程内 AgentScope Application Service，降低部署和迁移变量。Adapter 必须保留部署边界，使后续可以切换为独立 AgentScope 服务，但本轮修正不以拆分服务为前置条件。

### 3.5 按业务启用能力

不要求每个 Agent 使用 AgentScope 的全部功能。天气 Agent 使用 Session、Tool、Permission 和 Event 即可；知识助手再启用 KB/RAG；跨轮个性化再启用长期 Memory；稳定后台流程再评估 Schedule、Team/SubAgent 或其他合适原语。

## 4. 目标架构

```text
用户 / 企业系统
  -> AgentFoundry API
    -> 身份、租户、组织、发布、Policy、Approval、Quota
    -> AgentScope Integration Gateway
      -> AgentScope Application Service（先采用进程内嵌入）
        -> Agent / Chat / Session / AgentState
        -> Model / Credential
        -> Tool / Middleware / Permission / Event
        -> Memory / Knowledge Base / RAG
        -> Workspace / Schedule / Team（按业务需要）
    <- AgentScope 状态、事件、Trace 和运行结果
    -> Foundry Run / Tool Call / Evidence / Audit 幂等投影
  -> AgentFoundry API 响应
```

Integration Gateway 不应只有一次性 `invoke()`。目标接口至少覆盖：

- Agent runtime record 的创建、更新、发布映射和停用。
- Session 的创建、恢复、读取和关闭。
- Chat/Run 的启动、状态查询、取消和错误归一化。
- Credential、Model、Knowledge Base 和 Workspace 引用映射。
- 可信身份、资源范围、工具集合和 Permission Context 注入。
- AgentScope Event/Trace 到 Foundry Run、Tool Call 和 Audit 的投影。

## 5. 标识与事实源模型

必须建立明确的 ID 映射，禁止依赖名称或模板 ID 推断运行对象。

| Foundry 对象 | AgentScope 对象 | 事实源与用途 |
| --- | --- | --- |
| tenant/user/membership | trusted request identity / access policy context | Foundry/IAM 是主数据；Scope 消费可信上下文 |
| agent + agent_version | runtime agent record/template version | Foundry 管产品发布；Scope 管运行配置与实例化 |
| platform_session_id | AgentScope session_id | Scope 管历史、AgentState、Workspace 和运行绑定 |
| run_id | chat/run/provider execution reference | Scope 产生执行事实；Foundry保存企业业务投影 |
| tool_call_id | Scope tool event/call reference | Scope 产生调用事实；Foundry保存证据和查询索引 |
| knowledge asset id | AgentScope knowledge_base_id | Foundry管资产治理；Scope执行 ingestion/retrieval |
| workspace policy/reference | AgentScope workspace_id | Foundry管政策和配额；Scope管理运行空间 |

映射记录至少包含：Foundry ID、Scope ID、Scope 版本/类型、tenant、状态、创建时间、更新时间和最后同步事件位置。所有事件投影必须以 Scope event/call reference 做幂等键。

## 6. 分阶段实施计划

### 阶段 0：冻结边界并建立架构护栏

目标：先阻止继续扩大平行运行时。

实施：

- 修正 `backend/runtime.py` 中过时的 Adapter 描述和 capability 文案。
- 建立当前能力清单，逐项标明 `foundry_governance`、`agentscope_runtime` 或 `migration_compatibility`。
- 增加架构测试或静态检查，禁止新的 Agent 模板通过 `template_id` 硬编码选择 Runtime。
- 明确禁止在新业务中增加 Foundry 自有 reasoning loop、运行期 Memory/RAG 或工具路由实现。
- 为所有 Run 增加准确的 `execution_mode`、Scope provider reference 和 fallback reason。

验收：

- 文档、运行时描述和代码命名使用同一套边界定义。
- 任意 Run 都能准确区分 `agentscope_native` 与 `foundry_compatibility`。
- fallback 不会被记录为 AgentScope 原生成功。

### 阶段 1：扩展 Integration Gateway 与事件投影

目标：先建立可承载完整 AgentScope 生命周期的集成层，再迁移业务 Agent。

实施：

- 将单一 `invoke()` 扩展为 Agent、Session、Chat/Run 和 Event 的明确接口；保留旧接口作为兼容 facade。
- 定义 Foundry ID 与 Scope ID 映射 repository 和状态模型。
- 使用 AgentScope Event System、Tool Middleware、Permission 事件和 Trace 产生标准运行事件。
- 建立事件归一化器，将 Scope 事件幂等写入 Foundry Run、Tool Call Evidence 和 Audit。
- 明确原始 payload 的脱敏、大小限制、保留策略和错误分类。
- 禁止事件消费者再次执行工具或根据最终文本猜测工具调用。

验收：

- 同一 Scope 事件重复消费不会生成重复 Tool Call 或 Audit。
- Run、Tool Call 和 Audit 均能反查 Scope agent/session/execution/event reference。
- 模型错误、工具错误、权限拒绝和外部服务错误能够被分别查询。

### 阶段 2：完成天气 Agent 的 Session 化基准链路

目标：把已跑通的天气 Agent 从单轮 SDK 特例升级为完整 AgentScope Application Service 基准实现。

实施：

- 发布天气 Agent 时创建或更新对应的 Scope runtime agent record，不再依赖模板 ID 分支。
- 首次请求创建 Scope Session；后续相同 Foundry session 恢复同一 Scope Session 和 Chat 历史。
- 通过可信请求上下文注入 tenant、user、获授权天气工具和 Permission Context。
- 地理编码和天气调用继续由 AgentScope Tool 执行；Foundry 只投影调用证据和审计。
- 删除天气专用 `_uses_agentscope_native_runtime()` 选择逻辑，改为根据已发布 Agent 的 runtime binding 调度。
- 验证 Session 隔离：跨用户、跨租户不能读取或继续他人会话。

验收：

- “北京明天天气”和“上海未来三天天气”均由真实 API 返回，并可查 Scope Session、Foundry Run、Tool Call 和 Audit。
- 同一 Session 的追问可以利用历史，例如“那后天呢”，且不由 Foundry 手工拼接历史。
- 不存在城市、天气 API 失败和 Permission 拒绝不会产生虚假天气答案。
- 不再存在天气模板专用 Runtime 分支。

### 阶段 3：统一所有 Agent 的执行入口

目标：所有新发布 Agent 默认由 AgentScope 执行，Foundry 本地执行链只作为显式迁移兼容层。

实施：

- Agent 版本发布时生成不可变的 runtime binding，记录 Scope agent/template、模型、工具、KB、Memory 和 Workspace 配置引用。
- 运行 API 只负责鉴权、策略计算、Session 解析、调用 Gateway 和投影事件。
- 将 Foundry 的本地路由、工具执行、答案拼装从主路径移出，放入命名明确的 compatibility provider。
- 未建立 Scope binding 的旧 Agent 返回明确迁移状态，或在显式 feature flag 下进入兼容路径；不得静默选择。
- 为取消、超时、重试和幂等提交定义统一语义。

验收：

- 新发布 Agent 不增加任何模板 ID 分支即可进入 AgentScope。
- 主运行 API 不再直接检索 Memory/Knowledge、选择业务工具或格式化业务答案。
- compatibility provider 的调用量、Agent 清单和下线计划可查询。

### 阶段 4：迁移 Knowledge 与 Memory 执行

目标：消除知识检索和运行期记忆的双重事实源。

实施：

- Foundry 保留知识资产目录、可见性、保留、审批和绑定政策；AgentScope KB 负责 ingestion、index、retrieval 和 RAG 执行。
- 建立 Foundry knowledge asset 到 Scope knowledge base 的稳定映射和同步状态。
- Scope retrieval event 投影为 Foundry retrieval evidence 和 audit，而不是 Foundry再次检索。
- Foundry 保留 Memory 治理政策和用户控制；Scope AgenticMemory/Session state 负责运行期读写。
- 现有 JSON/JSONL Memory 仅作为迁移源或开发 fixture，不继续作为生产执行事实源。
- 制定历史数据迁移、去重、删除传播和用户可见性验证方案。

验收：

- 一个知识查询只有一套检索执行结果，Foundry evidence 能关联 Scope retrieval reference。
- Memory 的读取、写入、删除和隔离均有单一执行来源。
- 关闭 compatibility flag 后，Agent 运行链不调用 Foundry 自有检索和记忆评分代码。

### 阶段 5：收敛 Workflow、Schedule 与后台执行

目标：区分企业流程编排与 Agent Runtime，不再默认由 Foundry 自建所有执行能力。

实施：

- 对现有 Workflow 分类：企业业务编排、人工审批流程、Agent 内部协作、定时 Agent 任务。
- 企业审批、跨系统治理流程可继续由 Foundry 管理；Agent 内部 Team/SubAgent、Schedule 和运行期任务优先交给 Scope。
- 对保留在 Foundry 的流程，步骤中的 Agent 执行必须通过统一 Gateway，不得绕过 Session、Permission 和 Event。
- 建立 workflow_run/step 与 Scope session/run/event 的映射。

验收：

- 每类 Workflow 都有明确 owner，不存在两个引擎同时推进同一步骤。
- 定时任务和后台 Agent 执行具备同样的身份、权限、Run、Tool Call 和 Audit 证据。
- 人工审批恢复执行时保持幂等，不重复调用已成功工具。

### 阶段 6：删除平行运行时并完成生产门禁

目标：在所有存量 Agent 迁移完成后删除临时兼容能力。

实施：

- 根据 compatibility provider 使用清单逐个迁移或下线存量 Agent。
- 删除 Foundry 主链路中的本地 reasoning、工具路由、运行期 Knowledge/Memory 和业务答案拼装代码。
- 删除模板特例、失效 feature flag、旧字段和无法追溯 Scope reference 的临时数据结构。
- 完成故障演练、容量测试、升级/回滚测试和 AgentScope 版本兼容矩阵。
- 决定生产采用进程内嵌入还是独立服务；该决定基于扩缩容、隔离和运维要求，不改变职责边界。

验收：

- compatibility provider 调用量持续为零并已删除。
- 所有发布 Agent 都有 Scope runtime binding。
- 所有执行 Run 都能追溯到 Scope Session/Run/Event；所有企业审计都能追溯到原始运行事实。
- AgentScope 不可用时系统明确失败或进入经过批准的降级模式，不伪造答案、不静默切换为平行 Runtime。

## 7. 测试与发布门禁

每个阶段至少执行：

```bash
python3 -m compileall -q backend scripts
git diff --check
./scripts/smoke_agentfoundry.sh
```

同时逐步增加以下专项测试：

- Runtime binding 与 ID 映射的 repository 测试。
- Session 创建、恢复、跨用户和跨租户隔离测试。
- Scope Event 到 Run/Tool Call/Audit 的幂等投影测试。
- Tool Permission allow/deny/ask 和审批恢复测试。
- 模型超时、工具超时、外部服务失败、取消与重试测试。
- Knowledge retrieval 和 Memory 删除传播测试。
- AgentScope 依赖版本升级兼容测试。

发布门禁：

- 不允许测试通过直接编辑数据库或伪造 Scope 事件。
- 不提交运行产生的 JSON、JSONL、数据库、Workspace 或 Trace 临时文件。
- 新 Agent 不得依赖模板名称或 ID 硬编码选择 Runtime。
- 新运行能力必须同时提供权限检查、事件、Run 投影和审计证据。
- 任一迁移阶段都必须支持回滚到上一已知版本，但回滚不能造成同一工具重复执行。

## 8. 原建议实施顺序与任务切片

以下顺序保留为历史实施依据；实际完成状态以上文“当前实施状态”为准：

1. **P0：阶段 0 与阶段 1**——修正契约、运行标识和事件投影，这是所有后续迁移的前提。
2. **P0：阶段 2**——以天气 Agent 建立完整 Session、Permission、Event 和审计基准链路。
3. **P1：阶段 3**——让所有新 Agent 进入统一 Scope Runtime，停止扩大技术债。
4. **P1：阶段 4**——收敛 Knowledge 和 Memory 双重事实源。
5. **P2：阶段 5**——按流程类型收敛 Workflow/Schedule/Team 的执行边界。
6. **P2：阶段 6**——存量迁移完成后删除兼容层并补齐生产门禁。

每个代码任务只应覆盖一个可独立验收的切片。例如“建立 Session ID 映射”与“迁移所有 Memory”不应放在同一个提交中。

## 9. 本计划明确不做的事项

- 不修改 AgentScope 仓库来迁就 AgentFoundry 的现有数据模型。
- 不把企业组织、成员、角色和 IAM 主数据迁入 AgentScope Storage。
- 不为了展示“全面使用”而给天气 Agent 强行加入 RAG、长期 Memory、Team 或 Schedule。
- 不在本轮修正中同时重做前端视觉、计费、生产部署或完整认证体系。
- 不以支持更多 Runtime 为由继续维护一套 Foundry 自有 Agent Runtime。
- 不在缺少事件幂等和权限验证时一次性迁移全部 Agent。

## 10. 最终完成定义（尚未全部达到）

完整架构迁移最终必须同时满足。当前阶段 0-7 只完成了明确选择、严格 provider/capability 边界、Session/事件投影和兼容路径治理，其中以下关于全部资源迁移及 compatibility provider 删除的条件仍未达到：

- AgentFoundry 是企业身份、组织、产品发布、政策、审批、配额和企业审计的控制面。
- AgentScope 是所有发布 Agent 的实际 Application Runtime 和执行事实源。
- Session、Chat、AgentState、工具执行、运行期 Knowledge/Memory 和 Workspace 不再由 Foundry 平行实现。
- Foundry Run、Tool Call、Evidence 和 Audit 是 Scope 事件的幂等企业投影，并保留稳定的双向引用。
- 不存在按天气或其他模板硬编码的特殊 Runtime 路径。
- compatibility provider 已清零并删除。
- 外部服务、模型或 AgentScope 失败时返回真实、明确、可审计的失败，不生成虚假业务结果。
