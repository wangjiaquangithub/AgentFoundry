# AgentFoundry System Roadmap

本文档用于收口 AgentFoundry 的系统定位、模块边界和后续实施顺序。它不是重新设计一套平台，而是在当前可运行原型基础上，把已经完成的部分、仍然松散的部分和下一步要做的事情讲清楚。

## 1. 平台定位

AgentFoundry 是一个企业 Agent 平台，不是单个聊天助手，也不是 AgentScope 的前端壳。

它要解决的是企业里创建、运行、治理和观测 Agent 的问题：

- 业务团队可以使用知识助手、客服助手、数据分析助手等不同 Agent。
- 平台管理员可以统一管理模型、Agent、工具、知识库、权限、审计和运行状态。
- 开发团队可以把企业系统封装成工具或连接器，让 Agent 在权限范围内调用。
- 运维和安全团队可以追踪每次运行、工具调用、审批和数据访问。

第一阶段的落地目标是先跑通一个企业知识助手闭环，再把这套能力扩展成可复用平台。

## 2. 当前系统边界

当前仓库是独立产品仓库：

```text
agentfoundry/
  frontend/   React + TypeScript + Vite 控制台
  backend/    Python 后端 API 和平台服务
  docs/       产品、架构和路线文档
  scripts/    本地启动和验证脚本
```

AgentScope 不应该和 AgentFoundry 混成一个系统。推荐本地目录关系是：

```text
agentfoundry-stack/
  agentscope/     AgentScope 框架仓库
  agentfoundry/   AgentFoundry 产品仓库
```

AgentFoundry 负责平台能力，AgentScope 负责 Agent 运行时能力。两者通过后端 runtime adapter 连接。

## 3. AgentScope 的角色

AgentScope 在 AgentFoundry 里应该扮演 Agent Runtime，而不是整个平台后端。

推荐调用链：

```text
Frontend Console
  -> AgentFoundry Backend API
    -> Runtime Adapter
      -> AgentScope
        -> Model / Tool / Memory / RAG / Multi-Agent Runtime
```

这样做的好处：

- 前端不直接依赖 AgentScope。
- 平台 API 可以稳定承载租户、权限、审计、配置和运行记录。
- 后续可以替换或并存多个 runtime，例如 AgentScope、LangGraph、自研 runtime 或远程 Agent 服务。
- AgentScope 升级时，主要影响 adapter 和 runtime 层，不应该大面积影响控制台和平台数据模型。

当前后端可以继续调用 AgentScope，但需要逐步把调用收口到明确的 runtime adapter，而不是让平台各处直接耦合 AgentScope 细节。

## 4. 信息架构状态

平台信息架构已经完成第一层拆分：路由已经拆开。

当前主要路由：

```text
/platform             总览和运营入口
/platform/agents      Agent 管理
/platform/runs        运行控制台
/platform/workflows   工作流
/platform/tools       工具目录和工具运行
/platform/approvals   审批队列
/platform/tenants     租户、成员和连接器
/platform/memory      长期记忆
/platform/settings    模型、运行时和系统配置
```

现在要继续做的是第二层拆分：每个页面内部的信息架构。

不是重新拆一次平台，而是把每个页面从“很多卡片纵向堆叠”整理成清晰的企业控制台工作区：

- 左侧或顶部放列表、筛选和状态。
- 主区域放当前对象详情。
- 操作区只展示当前上下文相关动作。
- 审计、历史、配置等信息放在明确 tab、侧栏或详情区域中。
- 页面不再依赖用户一路向下滚动才能理解全部功能。

已完成：

- `/platform/agents`：已整理成 Agent 管理工作区。
- `/platform/runs`：已整理成运行队列、运行详情和审计摘要。

下一步优先：

- `/platform/workflows`
- `/platform/tools`
- `/platform/tenants`
- `/platform/memory`
- `/platform/settings`

## 5. 企业 Agent 核心模型

当前系统已经有不少核心概念，但还需要把它们收口成稳定的平台模型。

核心对象应该包括：

| 对象 | 作用 | 当前关注点 |
| --- | --- | --- |
| Tenant | 企业、部门或业务空间 | 数据隔离、成员、连接器、策略 |
| User | 平台用户 | 身份、角色、默认租户 |
| Agent | 可发布的智能体 | 模型、工具、知识库、记忆、运行策略 |
| Tool | Agent 可调用能力 | 参数、权限、审批、审计 |
| Workflow | 自动化流程 | 步骤、触发、版本、运行历史 |
| Run | 一次 Agent 或 Workflow 执行 | 状态、输入、输出、耗时、错误 |
| KnowledgeBase | 企业知识库 | 文档、索引、检索、权限 |
| Memory | 长期记忆 | 用户偏好、历史事实、作用域 |
| AuditEvent | 审计事件 | 工具调用、配置变更、审批、检索 |
| ModelConfig | 模型配置 | chat model、embedding model、rerank model |

现在不是从零创建这些概念，而是要明确它们之间的关系：

```text
Tenant
  -> Users
  -> Agents
    -> Tools
    -> KnowledgeBases
    -> Memory Scope
    -> Runs
  -> Workflows
    -> Workflow Runs
  -> Audit Events
  -> Model Configs
```

后续后端和前端都应该围绕这些对象推进，避免每个页面自己定义一套临时结构。

## 6. 知识库现状和影响

当前知识库可以先保持轻量，不影响继续优化平台骨架。但如果要让企业知识助手真正生产化，需要补齐知识库模型。

知识库至少需要两层模型。

数据库侧对象：

```text
KnowledgeBase
Document
DocumentChunk
EmbeddingRecord
RetrievalLog
```

AI 配置侧对象：

```text
Chat Model
Embedding Model
Rerank Model
Vector Store
```

短期策略：

- 先保留当前知识库 demo 或 mock 数据。
- 继续优化 `/platform/memory`、知识状态、Agent 绑定入口和运行闭环。
- 把企业知识助手作为第一个内置 Agent，而不是马上分散去做很多 Agent。

中期策略：

- 增加文档上传。
- 增加切片和索引任务。
- 增加检索 API。
- Agent 运行时通过后端调用知识库检索。
- 每次检索写入审计和 retrieval log。

## 7. MVP 闭环

第一版 MVP 不追求大而全，目标是让一个企业知识助手完整跑通。

MVP 应该包含：

1. 配置模型。
2. 创建或启用企业知识助手。
3. 创建或选择知识库。
4. 上传或使用示例文档。
5. 将知识库和工具绑定到 Agent。
6. 发起一次 Agent Run。
7. Agent 能调用工具或检索知识。
8. 用户能查看回答、来源、运行状态和审计记录。
9. 平台能保存会话、运行记录和长期记忆。

验收标准：

- 非开发人员可以按 README 在本地启动平台。
- 用户可以在控制台完成一次知识助手问答。
- 管理员可以看到 Agent、工具、运行和审计记录。
- 这套闭环可以复用到第二个 Agent。

## 8. 后端分层目标

后端不应该只是一组 demo API。建议逐步收口成以下分层：

```text
API Layer
  负责 HTTP 接口、请求校验、响应结构

Service Layer
  负责 Agent、Workflow、Tool、Knowledge、Tenant 等业务逻辑

Runtime Layer
  负责调用 AgentScope 或其他 Agent runtime

Provider Layer
  负责模型、向量库、对象存储、外部系统连接器

Persistence Layer
  负责数据库、文件存储、JSONL 迁移

Audit Layer
  负责工具调用、配置变更、审批、检索、运行事件记录
```

短期可以继续使用本地 JSON 和 JSONL。中期需要迁移到数据库，至少要让 Agent、Run、Workflow、Tool、AuditEvent 有稳定存储。

## 9. 前端实施路线

只优化 `/platform/*`，不扩散到无关页面。

推荐按块提交：

| 顺序 | 页面 | 目标 |
| --- | --- | --- |
| 1 | `/platform/agents` | 已完成，Agent 工作区 |
| 2 | `/platform/runs` | 已完成，运行控制台 |
| 3 | `/platform/workflows` | 工作流编排、步骤详情、运行入口 |
| 4 | `/platform/tools` | 工具目录、权限、试运行、调用记录 |
| 5 | `/platform/tenants` | 租户、成员、连接器、访问控制 |
| 6 | `/platform/memory` | 长期记忆、范围、来源、清理操作 |
| 7 | `/platform/settings` | 模型配置、runtime、系统健康、环境配置 |
| 8 | `/platform` | 总览页只保留关键指标和入口，不承载所有功能 |

每一块的提交原则：

- 只提交当前页面相关文件。
- 不混入无关 dirty 文件。
- 每页先做信息架构，再做视觉细节。
- 桌面和移动端都要能看，不允许内容重叠。
- 保留已有业务能力，不因为 UI 重构丢功能。

## 10. 后端实施路线

推荐后端按以下顺序推进：

1. 梳理当前 API，标注哪些是 mock、哪些是真能力。
2. 为核心对象定义稳定 schema。
3. 增加 runtime adapter，收口 AgentScope 调用。
4. 将 Agent run、Workflow run、Audit event 从 JSONL 逐步迁移到数据库。
5. 增加知识库模型和检索 API。
6. 增加工具权限和审批策略的持久化。
7. 增加多租户隔离和用户登录适配。
8. 增加运行指标、错误统计和成本统计。

## 11. 近期开发计划

当前最合理的三步：

### Step 1: 完成 `/platform/*` 页面内部拆分

先继续做 `/platform/workflows`，然后是 `/platform/tools`。这两页和 Agent 运行闭环最紧。

目标是让控制台从“页面 demo”变成“可操作的企业 SaaS 控制台”。

### Step 2: 收口 AgentScope runtime 边界

新增或整理后端 runtime adapter，把平台后端和 AgentScope 之间的关系固定下来。

目标是让 AgentScope 后续升级时不会牵动整个平台。

### Step 3: 补知识库模型

知识库先不用做复杂，但需要有最小数据模型和检索日志。

目标是让企业知识助手从 demo 数据走向真正的 RAG 闭环。

## 12. 非目标

当前阶段不做这些事：

- 不重新设计整个产品。
- 不把 AgentScope 代码复制进 AgentFoundry。
- 不同时做很多 Agent 模板。
- 不先做复杂的权限后台。
- 不先做生产级部署。
- 不把 `/platform` 做回一个超长总览页面。

当前阶段的核心是：把已有原型收口成清晰平台骨架，然后围绕企业知识助手跑通真实闭环。
