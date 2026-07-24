import { type FormEvent, useState } from 'react';

import { ApiError, getBaseUrl } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';

export function LoginPage() {
	const { login } = useAuth();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setBusy(true);
		setError('');
		const form = new FormData(event.currentTarget);
		try {
			await login({
				tenant_id: String(form.get('tenant_id') || '').trim(),
				identifier: String(form.get('identifier') || '').trim(),
				password: String(form.get('password') || ''),
			});
		} catch (cause) {
			setError(cause instanceof ApiError ? cause.detail : '登录服务暂时不可用，请稍后重试');
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="grid min-h-screen place-items-center bg-slate-50 px-4">
			<Card className="w-full max-w-md shadow-sm">
				<CardHeader className="space-y-3">
					<div className="grid size-11 place-items-center rounded-lg bg-foreground font-semibold text-background">AF</div>
					<div><CardTitle>登录 AgentFoundry</CardTitle><CardDescription>使用租户内已启用的企业账号继续。</CardDescription></div>
				</CardHeader>
				<CardContent>
					<form className="grid gap-4" onSubmit={submit}>
						<div className="grid gap-1.5"><Label htmlFor="tenant_id">租户 ID</Label><Input id="tenant_id" name="tenant_id" autoComplete="organization" required /></div>
						<div className="grid gap-1.5"><Label htmlFor="identifier">邮箱或账号 ID</Label><Input id="identifier" name="identifier" autoComplete="username" required /></div>
						<div className="grid gap-1.5"><Label htmlFor="password">密码</Label><Input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required /></div>
						{error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
						<Button type="submit" disabled={busy}>{busy ? '正在登录…' : '登录'}</Button>
					</form>
					<div className="mt-5 border-t pt-4 text-xs text-muted-foreground">服务：{getBaseUrl()}</div>
				</CardContent>
			</Card>
		</div>
	);
}
