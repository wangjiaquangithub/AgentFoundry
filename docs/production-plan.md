# AgentFoundry Production Plan

本文档用于冻结 AgentFoundry 从当前可运行原型走向生产级企业 Agent 平台的建设边界。它不是需求清单，也不是一次性大重构计划；它的作用是防止后续执行时不断泛化、重复拆分或把 AgentScope 与 AgentFoundry 混成一个系统。

## 1. 总目标

AgentFoundry 的总目标是成为一个生产级企业 Agent 平台，负责企业内 Agent 的创建、运行、治理、观测和集成。

生产级在这里不是指“页面看起来完整”，而是至少满足以下条件：

- 有清晰的平台边界：AgentFoundry 管理企业控制面，AgentScope 2.0 作为核心和首选运行平台执行 Agent。
- 有稳定的核心模型：Tenant、User、Agent、Tool、Workflow、Run、KnowledgeBase、Memory、Audit、ModelConfig 等对象关系明确。
- 有可维护的后端分层：API、Service、Repository、Runtime Adapter、Policy、Audit、Integration 分层逐步形成。
- 有稳定的运行边界：AgentScope 通过 Runtime Adapter 被后端调用，前端和业务服务不直接依赖 AgentScope 具体数据类型或部署方式。
- 有生产数据层：核心数据进入数据库和迁移体系，本地 JSON/JSONL 只保留为开发或导入导出用途。
- 有企业治理能力：权限、审批、审计、工具策略、租户隔离、配置管理、运行记录可追踪。
- 有真实可用的控制台：`/platform/*` 每个页面都是清晰的 SaaS 工作区，不是所有能力堆在一个长页面里。
- 有可验证闭环：企业知识助手作为第一个内置 Agent，能完成模型配置、知识检索、运行、来源展示、记忆和审计闭环。
- 有部署与运维基础：配置、启动、健康检查、日志、错误处理、测试和 smoke 验证可重复。

一句话边界：

```text
AgentFoundry = 企业 Agent 控制面 + 平台后端 + SaaS 控制台
AgentScope 2.0 = 核心和首选 Agent Framework / Application Service
```

## 2. 当前状态判断

当前系统不是单文件 demo，也还不是生产级系统。

它已经具备产品原型和平台骨架：

- 前端是 React、TypeScript、Vite 的控制台应用。
- 后端是 Python API 服务。
- `/platform/*` 路由已经拆成平台总览、Agent、Run、Workflow、Tool、Approval、Tenant、Memory、Settings 等页面。
- 已有开发期本地数据、知识兜底、运行记录、记忆、工具、审批、租户和运行时边界的初步能力。
- 已经开始引入 `backend/services/`、`backend/repositories/`、`backend/runtime.py` 这类生产化方向的模块。

它还不应被称为生产级：

- 核心业务逻辑仍有较多集中在 `backend/main.py`。
- 请求/响应 schema、service、repository 和 API route 还没有完全分层。
- 生产数据库、迁移、事务、索引和租户级数据约束还没有建立。
- 知识库还没有完整的文档上传、切片、embedding、向量检索、rerank 和检索日志链路。
- AgentScope 是核心运行平台，但不是 AgentFoundry 的企业控制面或业务数据层。
- 前端部分页面仍需要继续从“卡片堆叠”整理成企业控制台工作区。
- 认证、授权、审计不可篡改、部署、可观测性和后台任务还没有达到生产要求。

## 3. 系统边界

AgentFoundry 自己负责：

- 租户、用户、成员、角色和权限。
- Agent 模板、配置、发布、版本和运行记录。
- 工具目录、工具策略、工具调用、审批和审计。
- 知识库元数据、文档生命周期、检索记录和来源证据。
- 长期记忆的作用域、保留策略、写入和读取记录。
- 工作流模板、触发、运行、人工审批和运行历史。
- 模型配置、runtime 配置、平台设置和健康状态。
- 企业 SaaS 控制台和平台 API。

AgentScope 负责：

- Agent 推理循环。
- 模型调用。
- runtime 内部工具调用机制。
- runtime 内部 memory/RAG 原语。
- 多 Agent 协作和分布式执行能力。

调用关系必须保持为：

```text
Frontend Console
  -> AgentFoundry Backend API
    -> Platform Services
      -> Runtime Adapter
        -> AgentScope Framework / Application Service
```

禁止形成以下耦合：

- 前端直接调用 AgentScope。
- 页面组件直接理解 AgentScope 内部结构。
- 平台 service 到处 import AgentScope 具体实现。
- 因 AgentScope 升级而大面积修改 AgentFoundry 前端、数据模型或 API contract。

## 4. 目标架构

目标后端结构：

```text
backend/
  api/             HTTP routes, request schemas, response schemas
  services/        tenant, agent, tool, workflow, knowledge, memory services
  repositories/    database access, transactions, query objects
  runtime/         runtime adapter contracts and providers
  policy/          authorization, approval, quota, retention decisions
  audit/           audit writer and audit query model
  integrations/    external APIs, enterprise connectors
  workers/         ingestion, indexing, workflow jobs, async runs
```

目标前端结构：

```text
frontend/src/
  pages/platform/
    shell/          platform layout, navigation, route chrome
    agents/         agent list, detail, publish, run entry
    runs/           run queue, run detail, evidence, trace
    workflows/      templates, triggers, run history
    tools/          catalog, policy, test runner
    approvals/      approval queue and decision view
    tenants/        workspace, members, connectors, access
    memory/         memory records, policies, operations
    settings/       model config, runtime config, governance
  api/              typed API client and DTOs
  components/       shared UI primitives only
```

目标生产部署：

```text
Frontend static app
Backend API service
Database
Object/document storage
Vector store
Background workers
Runtime provider service or local runtime adapter
Observability and audit sinks
```

## 5. 阶段目标

### 阶段 0：规划冻结

目的：先把目标、阶段、验收和不做事项写清楚，后续执行按文档推进。

范围：

- 明确 AgentFoundry 的用户、系统边界和生产级定义。
- 明确 AgentScope 在系统中的位置。
- 明确阶段拆分和每阶段验收标准。
- 明确后续执行规则，避免一个任务无限扩张。

验收标准：

- 存在本文档。
- 文档包含总目标、系统边界、阶段目标、验收标准和不做清单。
- 后续任意执行任务都能指向本文档中的一个阶段和一个切片。

### 阶段 1：后端服务边界

目的：把当前后端从“大 API 文件”整理成可维护的平台服务结构。

范围：

- 提取 request/response schema。
- 拆分 API route 与业务 service。
- 固化 repository 接口，即使底层仍暂时使用本地 JSON/JSONL。
- 固化 Runtime Adapter contract。
- 确保 Agent、Tool、Workflow、Tenant、Memory、Knowledge、Audit 的服务边界清楚。

不做：

- 不在本阶段引入复杂数据库迁移。
- 不重写所有业务逻辑。
- 不直接深度接入 AgentScope 内部。

验收标准：

- `backend/main.py` 只保留应用装配、兼容入口和少量 glue code。
- 新增或整理后的 service 能被单元测试覆盖。
- API 请求体不再被 FastAPI 误判为 query 参数。
- smoke 脚本通过。
- 现有前端调用不破。

### 阶段 2：生产数据层

目的：建立真正的系统记录，而不是依赖本地 JSON 文件作为事实来源。

范围：

- 选择并接入关系数据库，优先 PostgreSQL；本地开发可用 SQLite 兼容路径。
- 建立 migrations。
- 建立核心表：tenants、users、memberships、agents、agent_versions、agent_runs、tools、tool_policies、tool_calls、approvals、knowledge_bases、documents、document_chunks、retrieval_events、memory_items、audit_events、model_configs。
- 建立 repository transaction 边界。
- 提供从开发 JSON/JSONL 到数据库的迁移或 seed 机制。

不做：

- 不在本阶段追求多地域、高可用或复杂分库。
- 不把所有历史开发文件都当作生产数据模型。

验收标准：

- 新环境可以通过 migrations 创建完整 schema。
- 平台核心操作写入数据库。
- 租户级查询有明确过滤。
- 本地开发数据可 seed。
- smoke 和关键 API 测试通过。

### 阶段 3：企业知识助手闭环

目的：把第一个内置 Agent 做成真实可用的企业知识助手，而不是只展示假数据。

范围：

- 完成知识库对象、文档上传、切片、索引和检索 API。
- 接入 embedding model 配置。
- 可选接入 rerank。
- Agent 运行时能读取绑定知识库并返回来源证据。
- 检索事件写入 retrieval log 和 audit event。
- 长期记忆与知识库明确区分。

不做：

- 不同时开发大量不同 Agent。
- 不把开发期知识兜底包装成生产 RAG。
- 不让前端自己拼接 RAG 结果。

验收标准：

- 用户能创建知识库并上传文档。
- 用户能创建或启用企业知识助手并绑定知识库。
- 用户提问后，回答包含来源、检索命中、运行记录和审计记录。
- 没有 embedding 配置时，系统给出明确状态和引导，而不是静默失败。

### 阶段 4：Agent Runtime 与 AgentScope Adapter

目的：让 AgentFoundry 能稳定调用 AgentScope，同时保留替换 runtime 的能力。

范围：

- 定义 runtime provider 配置和能力描述。
- 实现 AgentScope adapter 的最小可用调用链。
- 统一 RuntimeInvocationRequest 和 RuntimeInvocationResult。
- 将模型、工具、知识、记忆和审批上下文传入 runtime。
- 将 runtime 结果落回 run、tool_call、memory、audit、evidence。

不做：

- 不让 AgentScope 成为平台数据层。
- 不把 AgentScope 源码复制进 AgentFoundry。
- 不为了单个 provider 破坏 provider-neutral API。

验收标准：

- 至少一个 Agent run 通过 AgentScope adapter 执行。
- run 结果标识 runtime provider、耗时、状态和证据。
- AgentScope 失败时有平台级错误记录和前端可读反馈。
- 平台仍可保留 mock/local adapter 作为开发和测试 provider。

### 阶段 5：企业 SaaS 控制台

目的：让 `/platform/*` 成为可长期使用的企业控制台，而不是长页面演示。

范围：

- 每个 route 有清晰的信息架构：列表、筛选、详情、操作、历史。
- 页面间导航稳定，状态空白、加载、失败、成功都有处理。
- Agent、Run、Tool、Workflow、Tenant、Memory、Settings 页面完成工作区化。
- API 错误显示为具体可行动反馈。
- 前端类型与后端 contract 对齐。

不做：

- 不做营销首页。
- 不为了视觉效果牺牲企业控制台的信息密度。
- 不把所有能力塞回 `/platform` 总览页。

验收标准：

- 用户不需要纵向滚动一个巨大页面才能找到核心功能。
- 每个页面都有主要任务路径和清晰空状态。
- `/platform/*` 在桌面和移动宽度下无明显重叠、截断和错位。
- Playwright 或等价截图检查覆盖关键页面。

### 阶段 6：治理、安全与运维

目的：补齐企业生产系统必须具备的控制、追踪和运维能力。

范围：

- 身份认证和会话管理。
- 租户级授权、角色和权限。
- 工具调用审批和策略执行。
- 审计事件不可变写入和查询。
- 配置密钥管理，不把敏感凭证写入前端或仓库。
- 健康检查、结构化日志、错误追踪。
- 部署配置、环境变量、启动脚本和 README。

不做：

- 不在没有部署目标前过度设计云厂商细节。
- 不把本地开发便利性误认为生产安全。

验收标准：

- 未授权用户不能访问租户数据。
- 工具调用、审批、配置变更和 Agent run 都有审计记录。
- 敏感配置不进入 git。
- 新机器能按 README 启动开发环境。
- 后端、前端、smoke、关键集成测试可重复运行。

## 6. 执行规则

后续不要使用一个巨大的“把 AgentFoundry 做成生产级系统”的执行任务持续推进。这个目标太粗，会导致上下文污染、边界漂移和重复建设。

推荐方式：

1. 规划任务只负责写文档、冻结边界和决定顺序。
2. 执行任务每次只选择一个阶段中的一个切片。
3. 每个切片必须有明确改动范围、验收标准和验证命令。
4. 每个切片完成后再决定是否提交推送。
5. 如果发现计划不对，先修改规划文档，再继续执行，不在代码任务中临时扩大范围。

执行任务命名建议：

```text
阶段 1.1：提取后端请求 schema
阶段 1.2：拆分 Agent service
阶段 1.3：拆分 Tool service 与 policy service
阶段 2.1：引入数据库和 migration 基线
阶段 3.1：建立知识库文档上传和切片模型
阶段 4.1：实现 AgentScope runtime adapter 最小调用链
阶段 5.1：重构 /platform/workflows 工作区
阶段 6.1：引入租户级授权中间件
```

每个执行任务必须回答：

- 属于哪个阶段？
- 本次只改哪些文件或模块？
- 不改哪些相邻模块？
- 完成后用什么验证？
- 是否需要提交推送？

## 7. 优先执行顺序

建议不要先做“大而全 UI”，也不要直接接完整 AgentScope。

更稳的顺序是：

1. 阶段 1.1：提取后端请求 schema，降低 `backend/main.py` 复杂度。
2. 阶段 1.2：拆分 Agent、Run、Tool 的 service 边界。
3. 阶段 1.3：把 Runtime Adapter contract 固化，保留 local/mock provider。
4. 阶段 5.1：继续整理 `/platform/workflows`、`/platform/tools` 等页面工作区。
5. 阶段 2.1：引入数据库和 migration 基线。
6. 阶段 3.1：做知识库上传、切片、索引和检索链路。
7. 阶段 4.1：接 AgentScope adapter 的最小真实调用链。
8. 阶段 6.1：补认证、授权、审计不可变和部署运维。

原因：

- 先拆后端边界，后续接数据库和 AgentScope 才不会牵一发动全身。
- 先保住当前可运行闭环，避免为了生产化把原型打断。
- 知识库和 AgentScope 都依赖清晰的 service、repository、runtime contract。
- UI 工作区化可以并行推进，但必须跟 API contract 对齐。

## 8. 不做清单

为了防止范围失控，以下事项暂时不做：

- 不把 AgentFoundry 改成 AgentScope 仓库的一部分。
- 不把 AgentScope 当成整个平台后端。
- 不一次性重写全部后端。
- 不一次性重做全部前端页面。
- 不同时开发多个行业 Agent。
- 不在生产数据层建立前宣称生产级完成。
- 不把本地 JSON/JSONL 当成生产数据库。
- 不在没有鉴权和密钥管理前处理真实企业敏感数据。
- 不为了演示效果添加无法落库、无法审计的假功能。
- 不在一个任务里同时做架构、UI、数据库、RAG、AgentScope、部署。

## 9. 决策记录

- AgentFoundry 是独立仓库和独立产品。
- AgentScope 与 AgentFoundry 分离，通过后端 Runtime Adapter 连接。
- 当前先保留本地开发存储，但目标是数据库和迁移体系。
- 企业知识助手是第一个核心 Agent 闭环。
- `/platform/*` 是企业 SaaS 控制台，不是营销页，也不是单页 demo。
- 规划和执行分开；执行必须小块、可验收、可提交。
