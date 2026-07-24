import { Building2, FileCheck2, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react';
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PlatformPageHeader, PlatformPageShell } from './components/common';
import { enterpriseApi, type EnterpriseRecord } from '@/api';
import { getBaseUrl, getUserId } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type Dataset = Record<string, EnterpriseRecord[]>;

const value = (record: EnterpriseRecord, key: string) => String(record[key] ?? '—');
const short = (input: unknown) => {
	const text = typeof input === 'string' ? input : JSON.stringify(input ?? '');
	return text.length > 100 ? `${text.slice(0, 97)}…` : text || '—';
};
const keyOf = (record: EnterpriseRecord) => String(record.id ?? record.code ?? JSON.stringify(record));

function DataTable({ rows, columns, empty = '暂无记录', actions }: { rows: EnterpriseRecord[]; columns: Array<[string, string]>; empty?: string; actions?: (row: EnterpriseRecord) => ReactNode }) {
	return (
		<div className="overflow-x-auto rounded-md border bg-white">
			<table className="w-full min-w-[680px] text-left text-xs">
				<thead className="border-b bg-slate-50 text-slate-500"><tr>{columns.map(([key, label]) => <th className="px-3 py-2 font-medium" key={key}>{label}</th>)}{actions ? <th className="px-3 py-2 font-medium">操作</th> : null}</tr></thead>
				<tbody>{rows.length ? rows.map((row) => <tr className="border-b last:border-0" key={keyOf(row)}>{columns.map(([key]) => <td className="max-w-72 px-3 py-2 align-top" key={key} title={short(row[key])}>{short(row[key])}</td>)}{actions ? <td className="px-3 py-2">{actions(row)}</td> : null}</tr>) : <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={columns.length + (actions ? 1 : 0)}>{empty}</td></tr>}</tbody>
			</table>
		</div>
	);
}

function Field({ label, name, type = 'text', required = true, defaultValue, placeholder }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; placeholder?: string }) {
	return <div className="grid gap-1.5"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} /></div>;
}

function FormCard({ title, description, children, onSubmit, submit = '保存' }: { title: string; description?: string; children: ReactNode; onSubmit: (data: FormData) => Promise<void>; submit?: string }) {
	const [busy, setBusy] = useState(false);
	const handle = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault(); setBusy(true);
		try { await onSubmit(new FormData(event.currentTarget)); (event.target as HTMLFormElement).reset(); toast.success(`${title}已完成`); }
		catch (error) { toast.error(error instanceof Error ? error.message : `${title}失败`); }
		finally { setBusy(false); }
	};
	return <Card><CardHeader><CardTitle>{title}</CardTitle>{description ? <CardDescription>{description}</CardDescription> : null}</CardHeader><CardContent><form className="grid gap-3" onSubmit={handle}>{children}<Button disabled={busy} type="submit">{busy ? '处理中…' : submit}</Button></form></CardContent></Card>;
}

export function EnterpriseGovernancePage() {
	const [data, setData] = useState<Dataset>({});
	const [errors, setErrors] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [reportResult, setReportResult] = useState<EnterpriseRecord | null>(null);
	const [runEvidence, setRunEvidence] = useState<EnterpriseRecord | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		const calls: Array<[string, () => Promise<{ items: EnterpriseRecord[] }>]> = [
			['users', enterpriseApi.users], ['units', enterpriseApi.units], ['memberships', enterpriseApi.memberships],
			['roles', enterpriseApi.roles], ['bindings', enterpriseApi.roleBindings], ['decisions', enterpriseApi.authorizationDecisions],
			['leaves', enterpriseApi.leaveRequests], ['approvals', enterpriseApi.approvalCases], ['reports', enterpriseApi.reports],
			['queries', enterpriseApi.reportQueries], ['exports', enterpriseApi.reportExports], ['identityAudit', enterpriseApi.identityMutations],
			['leaveAudit', enterpriseApi.leaveAudit], ['reportAudit', enterpriseApi.reportAudit],
		];
		const organizationCall = enterpriseApi.organizations();
		const results = await Promise.allSettled(calls.map(([, call]) => call()));
		const next: Dataset = {}; const failures: string[] = [];
		results.forEach((result, index) => { const name = calls[index][0]; if (result.status === 'fulfilled') next[name] = result.value.items; else failures.push(`${name}: ${result.reason instanceof Error ? result.reason.message : '加载失败'}`); });
		const org: EnterpriseRecord = await organizationCall.catch((error: unknown) => { failures.push(`organizations: ${error instanceof Error ? error.message : '加载失败'}`); return {}; });
		next.organizations = Array.isArray(org.organizations) ? org.organizations as EnterpriseRecord[] : [];
		setData(next); setErrors(failures); setLoading(false);
	}, []);

	useEffect(() => { void load(); }, [load]);
	const refreshAfter = async (operation: () => Promise<unknown>) => { await operation(); await load(); };
	const reportOptions = useMemo(() => data.reports ?? [], [data.reports]);

	return (
		<PlatformPageShell>
			<PlatformPageHeader icon={Building2} eyebrow="Govern / Enterprise" title="企业治理与业务协同" description="统一管理账号组织、RBAC + ABAC、请假审批恢复、受治理报表和审计证据。所有操作均由后端权限再次强制校验。" actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} />刷新</Button>} aside={<div className="text-xs text-muted-foreground"><div>服务：{getBaseUrl()}</div><div>当前账号：{getUserId()}</div></div>} />
			{errors.length ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">部分模块因当前账号权限或服务状态不可用：{errors.join('；')}</div> : null}
			<Tabs defaultValue="identity">
				<TabsList className="flex h-auto w-full flex-wrap justify-start"><TabsTrigger value="identity"><UsersRound />身份组织</TabsTrigger><TabsTrigger value="authorization"><ShieldCheck />角色权限</TabsTrigger><TabsTrigger value="leave"><FileCheck2 />请假审批</TabsTrigger><TabsTrigger value="reports">报表治理</TabsTrigger><TabsTrigger value="audit">审计证据</TabsTrigger></TabsList>

				<TabsContent value="identity" className="grid gap-4">
					<div className="grid gap-4 xl:grid-cols-3">
						<FormCard title="新增账号" onSubmit={async (form) => refreshAfter(() => enterpriseApi.createUser({ display_name: form.get('display_name'), email: form.get('email'), role: form.get('role') }))}><Field label="姓名" name="display_name" /><Field label="邮箱" name="email" type="email" /><Field label="初始角色" name="role" defaultValue="employee" /></FormCard>
						<FormCard title="新建组织" onSubmit={async (form) => refreshAfter(() => enterpriseApi.createOrganization(String(form.get('name'))))}><Field label="组织名称" name="name" /></FormCard>
						<FormCard title="新建部门" onSubmit={async (form) => refreshAfter(() => enterpriseApi.createUnit({ organization_id: form.get('organization_id'), name: form.get('name'), unit_type: 'department' }))}><Field label="组织 ID" name="organization_id" placeholder={value(data.organizations?.[0] ?? {}, 'id')} /><Field label="部门名称" name="name" /></FormCard>
					</div>
					<Card><CardHeader><CardTitle>账号与成员</CardTitle><CardDescription>账号停用后不能启动新运行或审批，历史审计保留。</CardDescription></CardHeader><CardContent><DataTable rows={data.users ?? []} columns={[["display_name","姓名"],["email","邮箱"],["role","角色"],["status","账号状态"],["membership_id","成员 ID"]]} actions={(row) => row.status === 'active' ? <Button size="sm" variant="outline" onClick={() => void refreshAfter(() => enterpriseApi.deactivateUser(value(row, 'id')))}>停用</Button> : <Badge variant="secondary">已停用</Badge>} /></CardContent></Card>
					<div className="grid gap-4 xl:grid-cols-2"><FormCard title="设置主部门" onSubmit={async (form) => refreshAfter(() => enterpriseApi.assignUnit(String(form.get('membership_id')), { organization_unit_id: form.get('unit_id'), assignment_type: 'primary' }))}><Field label="成员 ID" name="membership_id" /><Field label="部门 ID" name="unit_id" /></FormCard><FormCard title="设置直属领导" onSubmit={async (form) => refreshAfter(() => enterpriseApi.setManager(String(form.get('membership_id')), String(form.get('manager_id'))))}><Field label="员工成员 ID" name="membership_id" /><Field label="领导成员 ID" name="manager_id" /></FormCard></div>
					<DataTable rows={data.units ?? []} columns={[["name","组织单元"],["unit_type","类型"],["id","ID"],["parent_id","上级"]]} />
				</TabsContent>

				<TabsContent value="authorization" className="grid gap-4">
					<div className="grid gap-4 xl:grid-cols-2"><FormCard title="创建自定义角色" onSubmit={async (form) => refreshAfter(() => enterpriseApi.createRole({ code: form.get('code'), name: form.get('name'), description: form.get('description'), permission_codes: String(form.get('permissions')).split(',').map((item) => item.trim()).filter(Boolean) }))}><Field label="角色代码" name="code" /><Field label="角色名称" name="name" /><Field label="说明" name="description" required={false} /><Field label="权限点（逗号分隔）" name="permissions" placeholder="report.read, report.query" /></FormCard><FormCard title="绑定角色与数据范围" onSubmit={async (form) => refreshAfter(() => enterpriseApi.createRoleBinding({ role_id: form.get('role_id'), subject_type: form.get('subject_type'), subject_id: form.get('subject_id'), data_scope: form.get('data_scope'), scope_config: {} }))}><Field label="角色 ID" name="role_id" /><Field label="主体类型" name="subject_type" defaultValue="membership" /><Field label="主体 ID" name="subject_id" /><Field label="数据范围" name="data_scope" defaultValue="self" /></FormCard></div>
					<DataTable rows={data.roles ?? []} columns={[["code","角色"],["name","名称"],["permission_codes","权限点"],["built_in","内置"]]} />
					<DataTable rows={data.bindings ?? []} columns={[["role_id","角色 ID"],["subject_type","主体类型"],["subject_id","主体 ID"],["data_scope","数据范围"]]} />
					<Card><CardHeader><CardTitle>最近授权决策</CardTitle></CardHeader><CardContent><DataTable rows={data.decisions ?? []} columns={[["action","动作"],["resource_type","资源"],["allowed","允许"],["reason_code","原因"],["effective_scope","有效范围"],["decision_id","Decision ID"]]} /></CardContent></Card>
				</TabsContent>

				<TabsContent value="leave" className="grid gap-4">
					<FormCard title="发起请假" description="创建后先校验 HR 余额与冲突，再解析直属领导并进入审批；批准前不会正式提交 HR。" submit="提交审批" onSubmit={async (form) => refreshAfter(() => enterpriseApi.createLeaveRequest({ leave_type: form.get('leave_type'), start_date: form.get('start_date'), end_date: form.get('end_date'), reason: form.get('reason'), agent_id: 'leave-assistant' }))}><div className="grid gap-3 md:grid-cols-3"><Field label="请假类型" name="leave_type" defaultValue="annual" /><Field label="开始日期" name="start_date" type="date" /><Field label="结束日期" name="end_date" type="date" /></div><div className="grid gap-1.5"><Label htmlFor="reason">原因</Label><Textarea id="reason" name="reason" required /></div></FormCard>
					<Card><CardHeader><CardTitle>待我审批</CardTitle><CardDescription>审批决定绑定不可变申请摘要；批准后由申请人恢复同一 Session 的业务 Run。</CardDescription></CardHeader><CardContent><DataTable rows={data.approvals ?? []} columns={[["id","审批 ID"],["requester_id","申请人"],["status","状态"],["business_run_id","业务 Run"],["summary_hash","摘要"]]} actions={(row) => <div className="flex gap-2"><Button size="sm" onClick={() => void refreshAfter(() => enterpriseApi.decideApproval(value(row, 'id'), 'approve', '批准'))}>批准</Button><Button size="sm" variant="destructive" onClick={() => void refreshAfter(() => enterpriseApi.decideApproval(value(row, 'id'), 'reject', '拒绝'))}>拒绝</Button></div>} /></CardContent></Card>
					<Card><CardHeader><CardTitle>我的请假与运行恢复</CardTitle></CardHeader><CardContent><DataTable rows={data.leaves ?? []} columns={[["business_run_id","业务 Run"],["status","状态"],["leave_type","类型"],["start_date","开始"],["end_date","结束"],["hr_request_id","HR 单号"]]} actions={(row) => <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void enterpriseApi.runEvents(value(row, 'business_run_id')).then(setRunEvidence)}>证据</Button>{['approved','submit_failed'].includes(value(row, 'status')) ? <Button size="sm" onClick={() => void refreshAfter(() => enterpriseApi.resumeRun(value(row, 'business_run_id')))}>恢复执行</Button> : null}</div>} /></CardContent></Card>
					{runEvidence ? <Card><CardHeader><CardTitle>业务 Run 证据链</CardTitle></CardHeader><CardContent><pre className="max-h-96 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(runEvidence, null, 2)}</pre></CardContent></Card> : null}
				</TabsContent>

				<TabsContent value="reports" className="grid gap-4">
					<FormCard title="受治理报表查询" description="只接受报表定义声明的参数；网关强制租户、数据范围、脱敏、行数与超时。" submit="查询" onSubmit={async (form) => { const raw = String(form.get('parameters') || '{}'); setReportResult(await enterpriseApi.queryReport(String(form.get('report')), JSON.parse(raw) as EnterpriseRecord)); }}><div className="grid gap-1.5"><Label htmlFor="report">报表代码</Label><select className="h-9 rounded-md border bg-white px-3" id="report" name="report" required>{reportOptions.map((report) => <option value={value(report, 'code')} key={value(report, 'code')}>{value(report, 'name')}（{value(report, 'code')}）</option>)}</select></div><div className="grid gap-1.5"><Label htmlFor="parameters">参数 JSON</Label><Textarea id="parameters" name="parameters" defaultValue="{}" /></div></FormCard>
					<DataTable rows={reportOptions} columns={[["code","代码"],["name","报表"],["supported_scopes","范围"],["sensitive_fields","敏感字段"],["max_rows","最大行数"],["export_policy","导出策略"]]} actions={(row) => <Button size="sm" variant="outline" onClick={() => void enterpriseApi.exportReport(value(row, 'code'), {}).then(() => load())}>申请导出</Button>} />
					{reportResult ? <Card><CardHeader><CardTitle>查询结果</CardTitle><CardDescription>Decision：{value(reportResult, 'authorization_decision_id')} · 范围：{value(reportResult, 'effective_scope')} · 行数：{value(reportResult, 'row_count')}</CardDescription></CardHeader><CardContent><DataTable rows={Array.isArray(reportResult.rows) ? reportResult.rows as EnterpriseRecord[] : []} columns={Object.keys((reportResult.rows as EnterpriseRecord[] | undefined)?.[0] ?? {}).map((key) => [key, key])} /></CardContent></Card> : null}
					<div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle>查询历史</CardTitle></CardHeader><CardContent><DataTable rows={data.queries ?? []} columns={[["report_code","报表"],["effective_scope","范围"],["row_count","行数"],["status","状态"],["authorization_decision_id","Decision"]]} /></CardContent></Card><Card><CardHeader><CardTitle>导出记录</CardTitle></CardHeader><CardContent><DataTable rows={data.exports ?? []} columns={[["report_code","报表"],["status","状态"],["approval_case_id","审批"],["authorization_decision_id","Decision"]]} /></CardContent></Card></div>
				</TabsContent>

				<TabsContent value="audit" className="grid gap-4">
					<div className="rounded-md border bg-white p-3 text-xs text-muted-foreground">审计页面只显示脱敏元数据与引用，不展示 Credential、原始报表结果、内部提示词或完整请假原因。</div>
					<Card><CardHeader><CardTitle>身份与组织变更</CardTitle></CardHeader><CardContent><DataTable rows={data.identityAudit ?? []} columns={[["action","动作"],["actor_id","操作者"],["subject_id","对象"],["before_summary","变更前"],["after_summary","变更后"],["occurred_at","时间"]]} /></CardContent></Card>
					<Card><CardHeader><CardTitle>请假与审批审计</CardTitle></CardHeader><CardContent><DataTable rows={data.leaveAudit ?? []} columns={[["action","动作"],["actor_id","操作者"],["business_run_id","业务 Run"],["runtime_execution_id","执行"],["authorization_decision_id","Decision"],["outcome","结果"],["occurred_at","时间"]]} /></CardContent></Card>
					<Card><CardHeader><CardTitle>报表审计</CardTitle></CardHeader><CardContent><DataTable rows={data.reportAudit ?? []} columns={[["action","动作"],["actor_id","操作者"],["resource_id","报表"],["authorization_decision_id","Decision"],["outcome","结果"],["metadata","安全摘要"],["occurred_at","时间"]]} /></CardContent></Card>
				</TabsContent>
			</Tabs>
		</PlatformPageShell>
	);
}
