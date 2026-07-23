# Enterprise Knowledge Assistant MVP

这个示例把 AgentScope 的 app service 落成一个企业级 AI 助手后端。它不是单个聊天脚本，而是一个可以继续接入企业系统的服务骨架：多租户工具、长期记忆、知识库/RAG、子 Agent 模板、工作区管理和 HTTP API 都在同一个 FastAPI 入口里。

如果你的目标是做完整的企业 Agent 平台，而不只是一个知识助手示例，先看 [PLATFORM.md](PLATFORM.md)。里面把平台模块、MVP 范围和迭代路线拆开了。

## 现在它在平台里的位置

当前目录不是“完整企业 Agent 平台”，而是平台的第 0 阶段：先把一个企业知识助手跑通，证明平台底座可用。

这个最小闭环包含四个东西：

1. 前端页面：仓库自带 Web UI，用来配置模型、创建 Agent、打开会话和提问。
2. 后端服务：`main.py` 启动 AgentScope app service，并挂上企业工具、知识库、记忆和租户隔离逻辑。
3. 企业数据：`fixtures/tenant_data.local.json` 先模拟政策、工单和部门指标，后续可以换成真实 HTTP API 或数据库。
4. 模型凭证：通过 Web UI 创建，不写进代码和 `.env`。

所以你现在要演示的是“企业 Agent 平台雏形”：一个平台里有前端、有后端、有模型配置、有企业工具、有知识库入口、有记忆，并且已经有第一个内置 Agent：`企业知识助手`。

## 它能做什么

- 多租户/多会话：服务继续使用 `X-User-ID` 作为用户隔离键；示例把 `acme:alice`、`globex:bob` 这种用户 id 解析成租户 id。
- 企业业务工具：`extra_agent_tools` 会按用户、Agent、Session 动态挂载只读工具，例如查政策、查工单、查部门指标。
- 企业连接器：`connectors.py` 提供 `mock` 和 `http` 两种数据源。默认跑内置 Acme/Globex mock 数据，改环境变量即可调用企业内部 HTTP 网关。
- 长期记忆：`extra_agent_middlewares` 会给每个用户/Agent/Session 独立挂载 `AgenticMemoryMiddleware`，记忆文件落在本示例的 `data/memory/` 下。
- 知识库/RAG：服务启用 `CollectionPerKbManager`、`QdrantStore` 和 `LocalBlobStore`。在 Web UI 中创建知识库、上传文档并把知识库挂到会话后，AgentScope 会自动把 RAG 能力接入 Agent。
- 工具权限：`permissions.py` 支持默认、租户、用户三层 allow/deny 策略，先用本地 JSON 配置表达“谁能调用哪个企业工具”。
- 工具审计：`audit.py` 会把企业工具调用写成 JSONL，包括用户、租户、Agent、Session、工具名、输入摘要、耗时和结果状态。
- 子 Agent 模板：注册了 `policy_researcher` 和 `workflow_operator` 两类企业子 Agent，leader Agent 可以通过团队工具创建它们。

## 文件结构

```text
examples/enterprise_knowledge_assistant/
├── .env.example      # 本地/部署环境变量模板
├── PLATFORM.md       # 企业 Agent 平台蓝图
├── README.md         # 落地说明
├── audit.py          # 工具调用审计日志
├── connectors.py     # mock/http 企业系统连接器
├── permissions.py    # 企业工具授权策略
├── fixtures/         # Acme/Globex 演示数据
└── main.py           # AgentScope app service 入口
```

## 5 分钟演示流程

从仓库根目录执行：

```bash
./scripts/start_enterprise_agent_platform.sh
```

脚本会检查并启动 Redis、企业助手后端和 Web UI。启动后打开：

```text
http://127.0.0.1:5173/platform
```

如果页面要求初始化连接，填：

```text
Server URL: http://127.0.0.1:8000
Username: acme:alice
```

然后在页面里的 `Agent 业务问答` 区域依次试这三条问题：

```text
帮我查一下 INC-1001 的工单状态
远程办公制度怎么说？
总结 engineering 部门指标
```

你应该在右侧看到每次运行的回答、自动选择的企业工具、工具参数、路由来源、权限决策、工具返回结果，以及最近的审计日志。这个演示验证的是平台最小闭环，不是最终产品形态。

开发演示的工具调用审计日志默认写在：

```bash
tail -f examples/enterprise_knowledge_assistant/data/audit/tool_calls.jsonl
```

如果你要手动启动，可以按下面的分步命令操作。

## 手动启动服务

### 数据库迁移

AgentFoundry 的生产数据层目标是 PostgreSQL。本地 JSON/JSONL 和 SQLite
只用于开发、smoke 验证、导入导出或兼容路径，不是生产事实来源。

先设置 PostgreSQL 连接串：

```bash
export AGENTFOUNDRY_DATABASE_URL=postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry
```

然后从 AgentFoundry 仓库根目录执行迁移：

```bash
./scripts/migrate_agentfoundry.sh
```

脚本会优先使用 `uv --with psycopg[binary]` 运行 PostgreSQL 迁移；如果不用
`uv`，请先在当前 Python 环境安装 `psycopg`。

先安装项目依赖：

```bash
cd /Users/wangjiaquan/project/agentscope
uv pip install -e ".[full]"
```

启动 Redis。当前示例用 Redis 做服务存储：

```bash
docker run --rm -p 6379:6379 redis:7
```

可选：复制环境变量模板。

```bash
cd /Users/wangjiaquan/project/agentscope/examples/enterprise_knowledge_assistant
cp .env.example .env
```

`main.py` 启动时会自动读取本目录下的 `.env`。

如果你要让 `Agent 业务问答` 先用模型判断该调用哪个工具，再在模型不可用时退回规则路由，可以在 `.env` 里补下面这些配置。这里不要写进真实凭证到仓库，只放本地 `.env`：

```bash
ENTERPRISE_AGENT_ROUTER_BASE_URL=https://your-model-compatible-endpoint
ENTERPRISE_AGENT_ROUTER_API_KEY=replace-with-local-secret
ENTERPRISE_AGENT_ROUTER_MODEL=your-router-model
ENTERPRISE_AGENT_ROUTER_PROVIDER=openai
ENTERPRISE_AGENT_ROUTER_TIMEOUT_SECONDS=8
```

如果你的接口是 Anthropic Messages 兼容格式，把 provider 改成：

```bash
ENTERPRISE_AGENT_ROUTER_PROVIDER=anthropic
```

启动企业助手服务：

```bash
python3 main.py
```

也可以从仓库根目录直接用 `uv` 启动，并让 `uv` 补齐服务、存储和 RAG 依赖：

```bash
cd /Users/wangjiaquan/project/agentscope
uv run --extra service --extra storage --extra rag python examples/enterprise_knowledge_assistant/main.py
```

默认服务地址是 `http://localhost:8000`。OpenAPI 文档在 `http://localhost:8000/docs`。

如果要配合仓库里的 Web UI：

```bash
cd /Users/wangjiaquan/project/agentscope/examples/web_ui
pnpm install
pnpm dev
```

然后在 UI 中把 API endpoint 指向 `http://localhost:8000`，用户名填 `acme:alice`。

## 第一条真实闭环

1. 启动 Redis 和本服务。
2. 在 `/docs` 或 Web UI 中创建模型凭证。AgentScope app service 会把凭证存进服务存储，示例本身不从 `.env` 读取模型 API key。
3. 创建 Agent/Session，并给 Session 配置聊天模型；如果要用 RAG，再创建 embedding 模型配置。
4. 创建知识库，上传制度、FAQ、产品手册、事故复盘等企业文档，等待索引完成。
5. 把知识库挂到 Session。
6. 用不同 `X-User-ID` 测试租户隔离，例如：

```text
X-User-ID: acme:alice
X-User-ID: globex:bob
```

7. 让助手回答类似问题：

```text
查一下 remote 政策，然后结合知识库说明工程团队远程办公规则。
INC-1001 当前是什么状态？
总结 engineering 部门当前运营指标。
```

这条闭环能同时验证：模型调用、租户隔离、企业工具、长期记忆、RAG 和会话状态。

如果要确认平台确实记录了工具调用，可以查看本地审计日志：

```bash
tail -f /Users/wangjiaquan/project/agentscope/examples/enterprise_knowledge_assistant/data/audit/tool_calls.jsonl
```

## 接下来要做什么

如果知识库暂时先这样，下一步应该把“平台能力”补出来，而不是继续堆文档：

1. 平台首页：显示已发布 Agent、最近会话、模型状态、知识库状态、工具审计入口。
2. Agent 管理：把 `企业知识助手` 做成可配置模板，支持复制出客服助手、数据分析助手等。
3. 默认开发配置：让本地演示自动带上 API endpoint、默认用户和示例问题。
4. 真实系统接入：把 `fixtures/tenant_data.local.json` 换成企业 HTTP API、工单系统、数据库或 BI。
5. 权限生产化：把可信代理认证继续扩展到真实登录态，并按租户、部门、角色生成工具授权策略。

## 接真实企业系统

默认配置是：

```bash
ENTERPRISE_CONNECTOR=mock
```

如果你只是想先把内置 Acme/Globex 假数据换成自己的本地数据，不需要改 Python 代码。复制样例 JSON 后改内容：

```bash
cd /Users/wangjiaquan/project/agentscope/examples/enterprise_knowledge_assistant
cp fixtures/tenant_data.example.json fixtures/tenant_data.local.json
```

然后在 `.env` 里加：

```bash
ENTERPRISE_CONNECTOR=mock
ENTERPRISE_FIXTURE_PATH=/Users/wangjiaquan/project/agentscope/examples/enterprise_knowledge_assistant/fixtures/tenant_data.local.json
```

JSON 顶层按租户组织，租户名要和 `X-User-ID` 冒号前的部分一致，例如 `acme:alice` 会读取 `acme`。每个租户目前有三块数据：

```json
{
  "tenants": {
    "acme": {
      "policies": {},
      "tickets": {},
      "metrics": {}
    }
  }
}
```

要接内部 HTTP 网关，改成：

```bash
ENTERPRISE_CONNECTOR=http
ENTERPRISE_API_BASE_URL=https://internal-api.example.com
ENTERPRISE_API_TOKEN=replace-with-real-token
```

默认 HTTP connector 会调用这三个只读接口：

```http
GET /tenants/{tenant}/policies/search?keyword=remote
GET /tenants/{tenant}/tickets/{ticket_id}
GET /tenants/{tenant}/departments/{department}/metrics
```

建议返回结构：

```json
{
  "matches": {
    "remote": "Engineering may work remotely up to three days per week."
  },
  "available_policy_keys": ["remote", "expense", "security"]
}
```

```json
{
  "found": true,
  "ticket": {
    "status": "investigating",
    "owner": "platform-oncall",
    "summary": "Intermittent latency on the billing API."
  }
}
```

```json
{
  "found": true,
  "metrics": {
    "active_projects": 12,
    "open_incidents": 1,
    "sla": "99.94%"
  },
  "available_departments": ["engineering", "support"]
}
```

如果你的内部 API 路径不同，可以只改环境变量：

```bash
ENTERPRISE_POLICY_PATH=/v1/orgs/{tenant}/policy-search
ENTERPRISE_TICKET_PATH=/v1/orgs/{tenant}/tickets/{ticket_id}
ENTERPRISE_METRICS_PATH=/v1/orgs/{tenant}/departments/{department}/summary
```

如果返回结构不同，就在 `connectors.py` 里替换 `HttpEnterpriseConnector` 的归一化逻辑。`main.py` 不需要变，因为 Agent 工具只依赖 `EnterpriseConnector` 这个抽象。

## 租户和权限

本示例为了让多租户逻辑可见，约定冒号前面是租户，后面是用户：

```text
acme:alice -> tenant acme
globex:bob -> tenant globex
```

生产环境里应该把 `tenant_for_user` 替换成 JWT claims、API Gateway header 或 IAM 查询。只读工具现在通过企业授权策略控制可用范围；写操作工具不要照搬这个权限策略，应该接审批、审计和更严格的 `PermissionContext`。

企业工具权限由 `permissions.py` 控制，默认策略内置在代码里，也可以通过 JSON 文件覆盖：

```bash
ENTERPRISE_TOOL_POLICY_PATH=/path/to/tool_policy.json
ENTERPRISE_TOOL_POLICY_MODE=strict
```

策略结构示例：

```json
{
  "defaults": {
    "allow": ["enterprise_lookup_policy"]
  },
  "tenants": {
    "acme": {
      "allow": ["enterprise_lookup_policy"],
      "users": {
        "acme:alice": {
          "allow": [
            "enterprise_lookup_policy",
            "enterprise_get_ticket_status",
            "enterprise_summarize_department_metrics"
          ]
        }
      }
    }
  }
}
```

`deny` 优先级高于 `allow`。`ENTERPRISE_TOOL_POLICY_MODE=permissive` 时，没有命中策略的工具会放行，方便本地开发；设为 `strict` 后，必须命中 allow 规则才会放行。

## 可配置项

| 环境变量 | 默认值 | 作用 |
| --- | --- | --- |
| `AGENTFOUNDRY_ENV` | `development` | 部署模式；设为 `production` 时强制使用运行时可用的 PostgreSQL |
| `AGENTFOUNDRY_DATABASE_URL` | 本地 PostgreSQL URL | 生产事实数据层连接；SQLite 仅限本地开发兼容 |
| `AGENTFOUNDRY_LOG_LEVEL` | `INFO` | 后端日志级别，支持 `DEBUG/INFO/WARNING/ERROR/CRITICAL` |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_DB` | `0` | Redis db |
| `REDIS_PASSWORD` | 空 | Redis 密码 |
| `AGENTSCOPE_REDIS_BUS` | `0` | 设为 `1` 后使用 Redis message bus |
| `AGENTSCOPE_ENABLE_INDEX_WORKER` | `1` | 设为 `0` 后 API 进程不启动内嵌索引 worker |
| `QDRANT_URL` | 空 | 设定后使用远程 Qdrant |
| `QDRANT_API_KEY` | 空 | Qdrant API key |
| `ENTERPRISE_CONNECTOR` | `mock` | 企业连接器，支持 `mock` 或 `http` |
| `ENTERPRISE_API_BASE_URL` | 空 | 内部企业 API base URL，`http` connector 必填 |
| `ENTERPRISE_API_TOKEN` | 空 | 内部企业 API bearer token |
| `ENTERPRISE_API_TIMEOUT_SECONDS` | `5` | 企业 API 超时时间 |
| `ENTERPRISE_POLICY_PATH` | `/tenants/{tenant}/policies/search` | 政策查询路径 |
| `ENTERPRISE_TICKET_PATH` | `/tenants/{tenant}/tickets/{ticket_id}` | 工单查询路径 |
| `ENTERPRISE_METRICS_PATH` | `/tenants/{tenant}/departments/{department}/metrics` | 部门指标路径 |
| `ENTERPRISE_AUDIT_ENABLED` | `1` | 是否写入企业工具审计日志 |
| `ENTERPRISE_AUDIT_LOG_PATH` | 空 | 自定义企业工具审计 JSONL 路径，仅用于开发兼容 |
| `ENTERPRISE_TOOL_POLICY_PATH` | 空 | 自定义企业工具授权策略 JSON 路径，仅用于开发兼容 |
| `ENTERPRISE_TOOL_POLICY_MODE` | `permissive` | 工具授权模式，支持 `permissive` 或 `strict` |
| `ENTERPRISE_AGENT_ROUTER_BASE_URL` | 空 | 可选模型路由 endpoint；为空时只用内置规则路由 |
| `ENTERPRISE_AGENT_ROUTER_API_KEY` | 空 | 可选模型路由 API key |
| `ENTERPRISE_AGENT_ROUTER_MODEL` | 空 | 可选模型路由模型名 |
| `ENTERPRISE_AGENT_ROUTER_PROVIDER` | `openai` | 路由接口协议，支持 `openai` 或 `anthropic` |
| `ENTERPRISE_AGENT_ROUTER_TIMEOUT_SECONDS` | `8` | 模型路由超时时间 |
| `HOST` | `0.0.0.0` | Uvicorn host |
| `PORT` | `8000` | Uvicorn port |
| `UVICORN_RELOAD` | `1` | 是否开启 reload；生产环境必须设为 `0` |
| `CORS_ALLOW_ORIGINS` | `*` | 逗号分隔的 CORS origin；生产环境必须显式列出 origin，禁止空值和 `*` |
| `AGENTFOUNDRY_IDENTITY_PROXY_SECRET` | 空 | 可信入口代理身份签名密钥；生产环境必填且至少 32 字符 |

开发环境保留热重载和宽松 CORS 默认值。生产部署必须覆盖这两个值；服务会在
应用装配阶段拒绝不安全配置：

```bash
AGENTFOUNDRY_ENV=production
UVICORN_RELOAD=0
CORS_ALLOW_ORIGINS=https://console.example.com,https://admin.example.com
AGENTFOUNDRY_IDENTITY_PROXY_SECRET=<从密钥管理系统注入的随机值>
```

### 请求身份认证边界

开发环境继续兼容直接传入 `X-User-ID` 和 `X-Tenant-ID`。生产环境不再无条件
信任这两个头：可信入口代理必须同时传入
`X-AgentFoundry-Identity-Timestamp` 和
`X-AgentFoundry-Identity-Signature`。签名是以下 UTF-8 文本使用
`AGENTFOUNDRY_IDENTITY_PROXY_SECRET` 计算的 HMAC-SHA256 十六进制值：

```text
v1
<Unix 秒级时间戳>
<X-User-ID>
<X-Tenant-ID 或空字符串>
```

身份断言仅在前后 5 分钟内有效；签名缺失、过期或不匹配均返回 HTTP 401。
`GET /health` 和 `GET /ready` 不要求身份，供编排平台探测。该边界用于可信
代理到 AgentFoundry 的内部跳转，尚不替代面向用户的 OAuth/OIDC 登录、会话
撤销和平台 RBAC。

### 健康探针

- `GET /health` 是进程存活探针；只要 API 进程可以响应就返回 HTTP 200。
- `GET /ready` 是流量就绪探针；数据库运行时可用时返回 HTTP 200 和
  `status=ready`，未配置或运行时不可用时返回 HTTP 503 和
  `status=not_ready`。负载均衡器和编排平台应只在该接口返回 200 时导入流量。

## 从 MVP 到生产

- 认证：在现有可信代理签名边界上接入 OAuth/OIDC 登录与会话管理，并把租户、部门、角色、数据权限写进 claims 或后端权限服务。
- 工具：继续按当前 connector 抽象扩展数据库、工单、CRM、BI、代码执行沙箱等真实工具。
- 权限与审计：当前只读工具已有本地授权策略和 JSONL 审计作为开发兼容路径；生产环境需要通过 PostgreSQL 审计事件、IAM/RBAC、写操作审批流、trace id 和错误码形成可追踪记录。
- RAG：本地 Qdrant 适合开发；生产建议使用远程 Qdrant 或托管向量库，并把 blob store 换成 S3/OSS/内部对象存储。
- 部署：单进程 MVP 可以启用内嵌 index worker；多进程或多节点时，把 `AGENTSCOPE_ENABLE_INDEX_WORKER=0` 用在 API 进程，并部署独立索引 worker。
