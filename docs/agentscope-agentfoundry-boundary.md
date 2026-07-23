# AgentScope 2.0 与 AgentFoundry：正式定位、边界与集成原则

## 1. 结论

AgentScope 2.0 不是“只负责推理循环的 Python SDK”。它是面向生产的 Agent 开发与运行基础设施，包含两个相互配合的层次：

1. **Agent Framework / SDK**：Agent、模型、消息、工具、事件、Middleware、Permission、Memory、RAG、Workspace/Sandbox、Team/SubAgent 等开发与执行能力。
2. **Agent Application Service**：可独立运行或挂载到现有 FastAPI 应用的多租户、多会话 Agent 服务，提供 Agent、Chat、Session、Credential、Model、Knowledge Base、Schedule 和 Workspace 等 API 与运行期管理能力。

AgentFoundry 是面向企业的 Agent 产品控制面和治理平台。它负责把企业身份、组织、资产、发布、授权、审批、配额和审计要求，映射到 AgentScope 的运行服务与执行机制上。

因此，以下三种说法都不准确：

- “AgentScope 只是推理 SDK”——错误，忽略了 AgentScope Application Service。
- “租户、会话、权限、RAG、Workspace 都与 AgentScope 无关”——错误，这些是 AgentScope 2.0 明确提供或参与执行的能力。
- “AgentScope 已经是完整企业 IAM 和 AgentFoundry”——同样错误。AgentScope 当前不负责企业组织目录、成员生命周期、企业 RBAC 主数据、产品发布治理和企业合规账本。

正确关系不是简单的“平台 vs SDK”，而是：

> **AgentFoundry 是企业产品控制面和治理层；AgentScope 2.0 是核心 Agent 开发框架、应用运行服务和执行基础设施。**

## 2. AgentScope 2.0 的正式定位

AgentScope 2.0 的官方定位是“面向生产、易于使用的智能体框架”。其能力范围包括：

- Agent 推理循环、模型调用、消息和结构化输出。
- 工具、MCP、Skills、HITL、计划和语音。
- Event System 与 Agent/Tool Middleware。
- 工具与资源的细粒度 Permission。
- Memory、RAG 和 Knowledge Base。
- Workspace，以及 Local、Docker、Kubernetes 和第三方 Sandbox 后端。
- Team、SubAgent、MsgHub、A2A 和分布式执行。
- 多用户、多会话 Agent Service。
- Storage、Message Bus、后台任务和 Schedule。
- 本地、Serverless、Kubernetes 部署及 OpenTelemetry 可观测性。

这些能力分为“框架原语”和“应用服务”两层。不能因为采用进程内 SDK 模式就忽略 Application Service 的产品能力，也不能因为使用 Application Service 就把 AgentScope 当成企业 IAM 或完整企业 Agent 产品平台。

## 3. AgentScope Application Service 的实际边界

`agentscope.app.create_app()` 是 AgentScope 2.0 的正式服务入口，支持：

- 独立启动为 FastAPI 服务。
- 挂载到已有 FastAPI 应用。
- 使用可替换的 Storage、Message Bus 和 Workspace Manager。
- 可选启用 Knowledge Base Manager、解析器、分块器、Blob Store 和独立索引 Worker。
- 注入 ASGI Middleware、按请求创建的 Agent Middleware 和 Agent Tools。
- 注入自定义 Agent、SubAgent Templates 和 Resource Access Policy。

内建服务路由覆盖：

- Agent
- Chat
- Session
- Credential
- Model 与 TTS Model
- Knowledge Base
- Schedule
- Workspace

这意味着，在服务模式下 AgentScope 不只是接受一次 `invoke`：它能够管理运行时 Agent 配置、连续会话、聊天执行、模型和凭据构造、知识库运行、调度以及工作空间。

AgentFoundry 应优先复用这些能力，不应在自己的 Runtime Adapter 后面再造一套平行的 Session、Chat、Workspace、RAG、Schedule 或 Agent 执行引擎。确需增加企业治理元数据时，应通过映射、扩展点和事件汇聚完成。

这里描述的是 AgentScope 的产品能力和目标职责边界，并不表示当前 AgentFoundry 适配器已经接通所有服务。当前原生适配器已接通明确的 Runtime 选择、Agent 执行、天气工具、Session 生命周期、运行事件及企业 Run/Audit 投影；Memory、Knowledge/RAG、Workflow、Schedule、Team 和 Workspace/Sandbox 仍是未接通的 capability boundary，请求这些能力会在 provider 调用前明确失败。存量 Agent 仍可通过显式标记的 `foundry_compatibility` 路径运行，企业 Workflow 执行也仍保留显式兼容路径。

## 4. AgentFoundry 的正式定位

AgentFoundry 是企业 Agent 产品控制面和治理平台，主要负责：

- 对接企业 IAM、SSO 和身份生命周期。
- 企业租户、组织树、部门、角色、成员、邀请和停用。
- Agent 产品目录、模板、版本、发布、下线、可见性和访问入口。
- 企业模型、工具、连接器、凭据引用和知识资产治理。
- 企业授权政策、审批、配额、计费、运营和合规要求。
- 把可信身份和授权结果转换为 AgentScope 可执行的上下文、工具集合、Middleware 和 Permission Context。
- 跨运行时统一的 Run、Tool Call Evidence 和企业审计查询模型。
- 平台 API、控制台和外部系统集成。

AgentFoundry 不是另一个 Agent 框架。它不应自行重复实现 AgentScope 已提供且满足业务要求的 reasoning loop、工具协议、Session 状态机、Workspace、RAG、Team/SubAgent 或 Schedule Runtime。

## 5. 企业租户、账号、组织、角色与成员关系

### 5.1 它们与 AgentScope 有关系，但不是同一层职责

企业身份数据会直接影响 AgentScope 的资源访问、会话归属、Workspace 隔离、工具可用性和 Permission 决策，因此不能说它们“与 AgentScope 没关系”。

但 AgentScope 当前的 `ResourceAccessPolicyBase` 明确规定：Policy 可以从外部 IAM、LDAP、请求上下文等来源读取授权规则，但它**有意不在 AgentScope Storage 中管理 users、groups、memberships 或 resource-share records**。

所以正式边界是：

- **AgentFoundry/企业 IAM 是企业身份和授权政策的事实源。**
- **AgentScope 消费可信身份上下文，并在运行时完成资源隔离和实际执行点授权。**

### 5.2 AgentScope 当前不是完整企业 IAM

当前 AgentScope Application Service 的身份入口是 `X-User-ID`，源码将其标记为“Temporary header-based identity; will be replaced by JWT auth”。`UserRecord` 也只是基础记录，没有组织树、部门、邀请、成员状态和企业角色模型。

因此不能把一个外部传入的 `X-User-ID` 等同于已经完成：

- 登录认证和令牌签发。
- 企业租户确认。
- 组织成员资格校验。
- 企业角色和权限计算。
- 用户邀请、停用和离职回收。
- SSO、SCIM 或企业目录同步。

这些仍应由 AgentFoundry 或外部企业 IAM 提供。

### 5.3 “多租户”必须精确理解

AgentScope 官方提供多租户、多会话服务和生产级隔离能力。当前内建服务的数据访问主要按 `user_id`/owner 隔离，并允许通过 Resource Access Policy、请求级 Middleware、工具工厂和 Workspace Manager 扩展租户策略。

因此应区分：

1. **企业租户主数据**：企业、组织、成员、角色、邀请、SSO 绑定和生命周期，由 AgentFoundry/IAM 管理。
2. **Agent 运行时隔离**：某个可信主体能访问哪些 Agent、Credential、Knowledge Base、Session、Workspace 和 Tool，由 AgentScope 在运行服务和执行点落实。

不要虚构 AgentScope 当前已经内建完整的企业 `tenant_id -> organization -> department -> membership -> role` 数据模型；也不要在 Foundry 中重复实现 AgentScope 已有的 owner/session/workspace/resource 隔离。

### 5.4 两类“角色”不能混淆

- 企业 RBAC 角色，如管理员、开发者、审计员，是 AgentFoundry/IAM 的治理概念。
- Team/SubAgent 中的 leader、worker 或 researcher，是 AgentScope 的 Agent 运行角色。

企业角色可以决定是否允许创建或调用某类 Agent，但不能直接替代 AgentScope Team 的运行语义。

## 6. Session、Run 与审计的边界

### 6.1 Session

AgentScope Application Service 的 `SessionRecord` 实际保存：

- `user_id`、`agent_id`、source、schedule 和 team 关系。
- Workspace 绑定。
- Chat、fallback 和 TTS Model 配置。
- Knowledge Base 绑定与 RAG 参数。
- 每轮执行后更新的 `AgentState`。

因此，运行时 Session、消息历史、AgentState、Workspace 和模型/知识绑定属于 AgentScope 的实质能力，Foundry 不应默认重做。

AgentFoundry 可以保存 Session 的企业归属、产品入口、授权索引和 Scope Session ID 映射。每次访问仍必须重新执行企业授权，不能仅凭 session id 放行。

### 6.2 Run

Run 是一次可审计的业务执行，一个 Session 可以包含多个 Run。

- AgentScope 产生执行状态、事件、工具调用、Trace 和 provider/runtime reference。
- AgentFoundry 将其归一化为企业 Run、Tool Call Evidence、审批证据和查询索引。

Foundry 的 Run 记录是跨 Runtime 的企业业务记录，不应通过再次执行工具来生成证据。

### 6.3 Trace 与企业审计

AgentScope 提供 Event System、Middleware 和 OpenTelemetry Trace，并允许按请求注入 auth、audit logging 和 tenant isolation Middleware。这些是审计数据的重要来源和扩展点。

但技术 Trace 不自动等于满足企业保留、不可篡改、权限查询和合规导出的审计账本。企业审计事实模型和保留政策由 AgentFoundry 负责，运行事实由 AgentScope 事件提供。

## 7. 权限的正式分工

AgentScope 的 `PermissionContext` 和 Permission Engine 会在工具执行点根据 mode、working directories、allow、deny 和 ask rules 作出决策。这是真正的运行时强制执行能力，不应由 Foundry 的入口检查替代。

完整链路应为：

```text
企业 IAM / AgentFoundry Policy
  -> 认证用户、租户、组织与企业角色
  -> 计算 Agent、工具和资源授权
  -> 生成可信运行上下文、可用工具、Middleware 与 Permission Context
  -> AgentScope 在 Session、资源和工具实际访问点再次强制执行
  -> AgentScope 产生标准事件和 Trace
  -> AgentFoundry 写入企业 Run、Evidence 与 Audit Record
```

原则：

- Foundry 负责企业政策定义和可信身份计算。
- Scope 负责运行时隔离和执行点 enforcement。
- 未授权工具不应先暴露给模型，再依赖模型“自觉不调用”。
- Scope 不应相信未经认证的客户端自行声明 tenant、user 或 role。
- Foundry 不应只在 API 入口检查一次后绕过 Scope Permission。

## 8. 责任与事实源矩阵

| 能力 | 治理/事实源 | 运行与执行 | 边界 |
|---|---|---|---|
| 登录、SSO、账号生命周期 | AgentFoundry/企业 IAM | Foundry 将可信身份传入 Scope | Scope 当前不是完整认证系统 |
| 企业租户、组织、部门、角色、成员 | AgentFoundry/企业 IAM | Scope 消费计算后的身份和资源范围 | Scope Policy 明确不管理 group/membership 主数据 |
| Agent 产品、版本、发布和可见性 | AgentFoundry | Scope 保存/实例化运行时 Agent 配置 | 产品版本与 Runtime Record 建立稳定映射 |
| Session 企业归属和访问政策 | AgentFoundry | Scope 管 Session、历史、AgentState 和 Workspace | Foundry 可保存索引，不再造 Session Runtime |
| Chat 与 Agent 推理 | Foundry 选择已发布配置 | AgentScope | Foundry 不实现平行 reasoning loop |
| 企业 Credential 治理 | AgentFoundry | Scope Service 管运行时 Credential 与模型构造 | 密钥值避免复制和审计泄露 |
| 工具目录与业务授权 | AgentFoundry | Scope Toolkit、Tool、Middleware 和 Permission 执行 | 只注入获授权工具并在执行点检查 |
| 企业知识资产与可见性 | AgentFoundry | Scope KB ingestion、index、retrieval 和 RAG Middleware | 元数据治理与检索执行分层 |
| Workspace/Sandbox 政策 | AgentFoundry | Scope Workspace Manager/Sandbox | Foundry 定义配额和允许后端，Scope 建立隔离空间 |
| Schedule 产品政策 | AgentFoundry | Scope Schedule 与后台执行 | Foundry 管允许谁创建什么任务，Scope 执行 |
| Team/SubAgent 发布政策 | AgentFoundry | Scope Team/SubAgent Runtime | 企业角色不等于 Agent 团队角色 |
| Run 和工具证据 | AgentFoundry 统一事实模型 | Scope 提供事件、状态和引用 | Foundry 不重放真实工具 |
| 技术 Trace | Scope 产生 | OTel backend/Foundry 汇聚 | Trace 不等同于企业合规账本 |
| 企业审计和保留 | AgentFoundry | 消费 Scope 事件与 Foundry 控制面事件 | 形成可查询、可导出、受控保留的记录 |

上表是职责与目标事实源矩阵。当前实现仅完成 Agent、天气工具、Session、Permission/Event 和企业投影相关连接；Credential Service、Knowledge Base/RAG、Memory、Workspace/Sandbox、Schedule、Team/SubAgent 等条目仍需要后续适配器集成，不能把 AgentScope “提供该能力”写成 Foundry “已经接通该能力”。

## 9. 标准集成架构

```text
用户 / 企业系统
  -> AgentFoundry API / Console
    -> 企业 IAM、组织、Agent 产品、Policy、Approval、Audit
    -> AgentScope Runtime Adapter
      -> AgentScope Application Service
         或嵌入式 AgentScope Framework
        -> Agent / Chat / Session / Credential / Model
        -> Tool / Permission / Event / Middleware
        -> Memory / RAG / Knowledge Base
        -> Workspace / Sandbox / Schedule / Team
        -> Storage / Message Bus / Background Workers
      -> 模型、业务系统、MCP 与外部服务
    -> 统一 Run / Tool Evidence / Enterprise Audit
```

Runtime Adapter 的作用是：

- 隔离 AgentScope 版本、部署方式和具体数据类型。
- 映射 Foundry 产品 ID 与 Scope Runtime ID。
- 传递可信身份、授权、工具和资源上下文。
- 将 Scope 事件和结果归一化为 Foundry 企业记录。

Adapter 不是重复实现 AgentScope 服务能力的理由。AgentScope 应是 AgentFoundry 的核心、首选 Agent Runtime Platform；保留 Adapter 抽象是为了兼容边界和部署灵活性，而不是弱化或绕开 AgentScope。

## 10. 两种正确部署模式

### 10.1 进程内嵌入

```text
AgentFoundry Backend Process
  ├─ Foundry API 与企业治理服务
  ├─ Runtime Adapter
  └─ AgentScope Framework / 嵌入式 Application Service
```

AgentScope 作为 Python 依赖安装，不需要单独启动 AgentScope 服务，也不要求服务器上 checkout AgentScope 源码仓库。适合单体部署、低调用开销和共同扩缩容。

### 10.2 独立 AgentScope Application Service

```text
AgentFoundry Backend
  -> 鉴权后的 Runtime Adapter / Service Client
    -> AgentScope Application Service
      -> Storage / Message Bus / Workspace / Workers
```

适合独立扩缩容、故障隔离、资源池隔离、多集群和后台任务。AgentFoundry 应通过稳定 API 使用 AgentScope 的 Agent、Chat、Session、KB、Schedule 和 Workspace 服务，而不应只封装一个狭窄的 `invoke` 后把其余能力全部重做。

部署方式不改变职责边界。正式部署通常安装固定版本的软件包或构建镜像；只有参与 AgentScope 本身开发时才需要拉取其源码仓库。

## 11. 能力使用原则

AgentScope 能力应“按业务需要充分复用”，而不是机械地“每个 Agent 启用全部功能”。

- 简单天气查询需要 Agent、模型、真实 HTTP Tool、Permission/Event 和 Session，不需要为了证明集成而强行加入 RAG 或 SubAgent。
- 企业文档问答才需要 Knowledge Base/RAG。
- 跨轮个性化才需要长期 Memory。
- 稳定多阶段业务才需要 Workflow、Schedule 或 Team/SubAgent。
- 需要隔离文件和代码执行时才启用合适的 Workspace/Sandbox。

“使用 AgentScope 的全部价值”是指不重复开发它已有的适用能力，不是让所有 Agent 无条件开启所有特性。

## 12. 基于 AgentScope 2.0 源码的核实依据

本结论基于 AgentScope 仓库 `main` 分支提交 `89ce2cf` 的以下正式材料和源码：

- `README.md`、`README_zh.md`：生产级 Agent Framework、多租户与多会话服务、Workspace/Sandbox、Permission、Middleware、RAG、Team、部署和 OTel 定位。
- `src/agentscope/app/_app.py`：`create_app()`、独立运行/挂载模式、Storage、Message Bus、Workspace、KB、Middleware、Tool、Agent 和 Access Policy 扩展点。
- `src/agentscope/app/_router/`：Agent、Chat、Credential、Knowledge Base、Model、Schedule、Session、TTS Model 和 Workspace 路由。
- `src/agentscope/app/deps.py`：当前 `X-User-ID` 临时身份入口及未来 JWT 说明。
- `src/agentscope/app/access/_policy.py`：外部 IAM/LDAP 集成，以及不管理 users、groups、memberships 和 share records 的明确边界。
- `src/agentscope/app/storage/_model/_session.py`：Session 的 user、agent、team、workspace、model、knowledge 和 AgentState 数据。
- `src/agentscope/app/storage/_model/_user.py`：当前 UserRecord 不包含企业组织与成员模型。
- `src/agentscope/permission/`：PermissionContext 和工具执行点权限机制。

这是一份产品与架构边界规范，不等于宣称 AgentFoundry 当前实现已经完整复用了上述能力。当前实现符合度应另行审计，不能反向改变 AgentScope 2.0 的正式定位。

当前混合架构的具体问题、迁移阶段和验收门禁见
[`agentscope-integration-correction-plan.md`](agentscope-integration-correction-plan.md)。
