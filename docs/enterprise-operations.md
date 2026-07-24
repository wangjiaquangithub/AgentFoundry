# AgentFoundry 企业业务运行与部署指南

## 1. 适用范围

本文说明 AgentFoundry 企业身份、授权、AgentScope 运行时、请假审批、受治理报表和审计链路的运行方式。当前实现用于企业业务端到端演示和后续生产化的工程基线，不代表已经完成生产安全认证、高可用设计或全部 AgentScope 能力接入。

详细的产品职责和数据事实源边界见 [`agentscope-agentfoundry-boundary.md`](agentscope-agentfoundry-boundary.md)。

## 2. AgentFoundry 与 AgentScope 的职责

AgentFoundry 是企业产品控制面和治理层，负责：

- 租户、账号、组织、部门、岗位、直属领导和成员关系。
- 企业角色、权限点、资源授权，以及 RBAC 与 ABAC 决策。
- Agent 产品、发布、调用入口、审批、报表目录和数据治理。
- 构造可信 `ExecutionContext`，向运行时传递允许使用的工具和资源范围。
- 汇聚企业 Run、工具调用、审批、授权 Decision、运行事件和审计记录。

AgentScope 2.0 是核心 Agent 开发和运行基础设施，负责：

- Agent 推理、对话 Session、消息历史和 Agent 状态。
- 模型调用、工具选择、Middleware、Event、Trace 和运行时资源隔离。
- 在实际工具执行点使用 `PermissionContext` 再次检查权限。
- 审批后在原 Session 上继续执行。

企业授权采用双层强制：AgentFoundry 决定主体是否可以调用 Agent、工具或业务动作，并生成可信上下文；AgentScope 在工具和资源实际访问点再次执行 Permission 检查。提示词、前端隐藏按钮和客户端传入的角色都不是授权依据。

AgentFoundry 不重新实现 AgentScope 的 reasoning loop、Session、Team、Workspace、RAG 或 Schedule Runtime。当前没有业务需要或尚未接入原生 Adapter 的能力，会明确报告不支持，不会静默伪装为原生 AgentScope 执行。

## 3. AgentScope 部署模式

### 3.1 进程内 Framework / 嵌入式服务

AgentScope 作为固定版本 Python 包安装到 AgentFoundry 后端环境，由 Runtime Adapter 在进程内调用。此模式不需要单独启动 AgentScope 服务，也不需要在服务器 checkout AgentScope 源码。

```bash
PYTHON_BIN=/opt/agentfoundry/venv/bin/python ./scripts/start_agentfoundry.sh
```

只有开发 AgentScope 本身或联调未发布版本时，才需要显式使用源码目录：

```bash
AGENTSCOPE_DIR=/path/to/agentscope ./scripts/start_agentfoundry.sh
```

本地存在同级 `../agentscope` checkout 时，开发脚本也可自动发现它。

### 3.2 独立 Application Service

AgentScope Application Service 可以独立部署，由 AgentFoundry Runtime Adapter 通过受信服务接口访问。该模式适合独立扩缩容、故障隔离和运行资源池治理。生产镜像仍应安装固定版本 AgentScope 包，不应依赖运行服务器上的源码仓库。

无论使用哪种模式，职责边界不变：AgentFoundry 管企业身份、产品和治理；AgentScope 管 Agent Session 与执行。原生 provider 不可用时运行必须明确失败并产生审计，不允许静默回退到 `foundry_compatibility`。

## 4. 身份、组织和授权

企业身份模型支持租户成员、组织单元、岗位、主部门、辅助组织关系和直属领导。账号停用后禁止发起新运行和审批，但历史记录继续保留。组织、账号和成员关系采用停用或归档语义，避免破坏历史审计主体。

授权服务统一计算：

```text
authorize(subject, action, resource, environment) -> decision
```

Decision 包含允许结果、原因码、匹配的角色绑定、有效数据范围、策略版本和唯一 Decision ID。数据范围包括本人、直接下属、部门、部门树、显式部门、租户和无权限。敏感 API、Agent 调用、工具调用、审批和报表查询均应使用该 Decision，而不是直接信任旧的 `allowed_roles` 或客户端 Header。

后端认证层构造并签名短时有效的 `ExecutionContext`，主要包含租户、主体、成员关系、组织、直属领导、角色、权限、资源授权、数据范围、认证方法和策略版本。进入 AgentScope 后，它会映射为 Session metadata、owner/user、PermissionContext、Middleware 上下文和 Credential/资源范围。

Session 恢复、角色变化、账号停用或审批决定后必须重新计算权限，不能永久信任 Session 创建时的角色快照。

当前预留 OIDC 身份源、外部身份链接和 claim 同步接口，但本验收环境没有部署真实 OIDC Provider。可信身份仍由 AgentFoundry 后端认证边界负责。

## 5. 可信代理身份边界

生产环境的可信身份 Header 是网关到后端的内部协议。浏览器和普通 API 客户端不得自行构造用户、租户、角色或数据范围 Header。

至少配置：

```bash
export AGENTFOUNDRY_ENV=production
export UVICORN_RELOAD=0
export CORS_ALLOW_ORIGINS=https://agentfoundry.example.com
export AGENTFOUNDRY_IDENTITY_PROXY_SECRET='replace-with-at-least-32-random-characters'
```

身份代理使用共享密钥对身份载荷签名，并限制时间窗口。生产部署还应在网络层确保后端只接受来自可信网关的此类 Header，轮换密钥，并在 TLS 终止、重放防护和代理日志中避免泄露身份载荷。

## 6. 请假助手业务链路

请假流程使用独立 HR HTTP 服务，不直接修改 HR 数据库：

1. 员工通过已发布请假 Agent 发起请求。
2. AgentScope Agent 收集日期、类型和原因，选择余额与冲突检查工具。
3. AgentFoundry 授权服务校验 Agent 和工具权限，并解析同租户直属领导。
4. 受治理工具通过真实 HTTP 查询 HR 余额和日期冲突。
5. 校验成功后生成不可变申请摘要、审批 Case、业务 Run 和 continuation；提交工具此时不得执行。
6. 直属领导在审批中心批准或拒绝，申请人不能审批自己的申请。
7. 批准后使用同一个 AgentScope `session_id` 恢复，创建新的 `runtime_execution_id`，并重新校验账号、权限、审批和申请摘要。
8. `submit_leave_request` 携带审批引用和幂等键调用 HR 服务，获得唯一业务单号。
9. 拒绝、过期、余额不足、日期冲突、HR 超时或 5xx 都不得产生虚假成功结果。

一个业务过程使用稳定的 `business_run_id` 和 `session_id`；开始和每次恢复是不同的 runtime execution。重复批准、恢复或网络重试不会创建第二张 HR 单据。

## 7. 报表助手和数据权限

AgentScope 只向模型暴露报表目录、说明、查询和导出四类受治理工具。Agent 不获得生产数据库凭据，也不能传入任意 SQL、表名或自由排序表达式。

查询网关负责：

- 强制租户过滤，并根据授权 Decision 注入本人、直接下属、部门或显式部门范围。
- 校验固定报表参数 schema、日期范围、超时和最大行数。
- 根据角色隐藏、部分脱敏或拒绝敏感字段。
- 使用固定版本的参数化 SQL 或存储查询标识。
- 为敏感导出创建审批，并对导出文件设置到期和下载授权。
- 记录报表版本、参数摘要、数据范围、返回行数和结果摘要，不记录敏感结果全文。

生产目标数据库是 PostgreSQL，并应使用只读报表账号。当前企业 E2E 为了可重复和无外部依赖，使用临时 SQLite 数据库验证相同的权限和查询治理逻辑；它不能替代 PostgreSQL 连接、查询计划和超时行为的生产验收。

## 8. 运行、审批与审计证据

运行详情应能关联：

- 企业用户、租户、Agent 与版本。
- AgentScope Session、每次 runtime execution 和 provider event。
- 工具调用、Permission 结果和授权 Decision。
- 请假审批等待、决定、恢复和 HR 业务单号。
- 报表参数摘要、有效数据范围、脱敏、行数和导出行为。
- 安全错误分类，不包含内部提示词、SQL、Credential、Token 或原始敏感响应。

外部调用使用幂等键；provider event 使用唯一事件 ID 去重。业务状态与跨事务 Runtime/HR 投递应采用 Outbox 或等价可靠投递方式。技术 Trace 是运行证据来源，但不等同于企业审计账本；AgentFoundry 负责可查询的企业审计投影和保留政策。

## 9. PostgreSQL 初始化和启动

配置生产目标数据库：

```bash
export AGENTFOUNDRY_DATABASE_URL=postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry
```

执行迁移并按需导入开发种子：

```bash
./scripts/migrate_agentfoundry.sh
./scripts/seed_agentfoundry.sh
```

当前迁移从 `0001_core_schema.sql` 到 `0014_governed_reporting.sql`，覆盖核心目录、运行投影、企业身份组织、授权、ExecutionContext、请假审批和受治理报表。

启动服务：

```bash
./scripts/start_agentfoundry.sh
```

平台入口为 `/platform`，企业身份、授权、审批和报表工作区入口为 `/platform/enterprise`。生产探针：

```text
GET /health
GET /ready
```

`/health` 表示进程存活；`/ready` 用于确认服务是否具备接收流量的依赖条件。部署系统应使用 `/ready` 控制流量切换，而不是只检查端口。

## 10. 验证命令

基础检查：

```bash
python3 -m compileall -q backend scripts
git diff --check
./scripts/smoke_agentfoundry.sh
```

企业业务验收：

```bash
./scripts/smoke_enterprise_e2e.sh
```

该脚本验证请假 HTTP 边界、审批后同 Session 恢复、幂等提交、报表数据范围与脱敏、越权拒绝、ExecutionContext、AgentScope Permission、provider 明确失败以及相关运行投影。测试数据和数据库均放在临时目录，不应提交 JSON、JSONL、SQLite、导出文件、日志或运行时 Workspace。

前端发布前执行：

```bash
cd frontend
npm run build
npm run lint
```

## 11. 当前限制

- 企业报表 E2E 使用临时 SQLite；PostgreSQL 是生产目标，但本验收未证明真实 PostgreSQL 的性能、连接池、故障切换和查询超时。
- 已定义 OIDC 同步接口和身份映射边界，尚未部署真实 OIDC Provider，也未实现完整 AD/LDAP 生命周期。
- 请假 continuation 验收使用真实 AgentScope Permission 类型和确定性 Agent/model factory；它验证运行时边界、Session、工具与恢复，但不证明外部 LLM 的自由推理质量。
- Knowledge Base/RAG、Workspace/Sandbox、Schedule、Team/SubAgent 和部分 Memory 能力尚未完整接入原生 Runtime Adapter。
- 显式标记的 `foundry_compatibility` 存量路径仍保留；原生 AgentScope 请求不会静默回退到该路径。
- 当前系统是可运行的企业业务基线，仍需完成生产级密钥托管、不可变审计存储、灾备、高可用、容量测试和安全认证。
