import { useEffect } from 'react';
import { useNavigate, useRouteError } from 'react-router-dom';

import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary. React Router renders this in place of the
 * crashed route element instead of its bare developer overlay, so end
 * users get a friendly, localized message plus recovery actions (retry /
 * go home) rather than a raw stack trace. The full error (with stack) is
 * still logged to the console for developers.
 */
export function RouteError() {
	const error = useRouteError();
	const navigate = useNavigate();

	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div className="flex h-full w-full items-center justify-center bg-muted/20 p-6">
			<div
				role="alert"
				className="grid w-full max-w-lg gap-4 rounded-lg border bg-background p-6 text-left shadow-sm"
			>
				<div className="grid gap-2">
					<p className="text-xs font-medium uppercase text-muted-foreground">
						AgentFoundry Platform
					</p>
					<h1 className="text-xl font-semibold">无法加载页面</h1>
					<p className="text-sm leading-6 text-muted-foreground">
						请确认平台 API 或运行时服务已启动，或稍后重试。技术细节已记录到浏览器控制台。
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" onClick={() => navigate(0)}>
						重试
					</Button>
					<Button onClick={() => navigate('/platform')}>返回平台总览</Button>
				</div>
			</div>
		</div>
	);
}
