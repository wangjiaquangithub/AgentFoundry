import { Onborda, OnbordaProvider } from 'onborda';
import { useMemo } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import { RouteError } from '@/components/error/RouteError';
import { AppLayout } from '@/components/layout/AppLayout';
import { buildChatTour } from '@/components/tour/chatTourSteps';
import { TourCard } from '@/components/tour/TourCard';
import { LOCAL_SERVER_URL } from '@/config/localDefaults';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { UploadProvider } from '@/context/UploadContext';
import { useTranslation } from '@/i18n/useI18n';
import { ChatPage } from '@/pages/chat';
import { CredentialPage } from '@/pages/credential';
import { KnowledgePage } from '@/pages/knowledge';
import { LoginPage } from '@/pages/login';
import { PlatformPage } from '@/pages/platform';
import { EnterpriseGovernancePage } from '@/pages/platform/EnterpriseGovernancePage';
import { SchedulePage } from '@/pages/schedule';
import { SetupPage } from '@/pages/setup';

if (!localStorage.getItem('server_url')) localStorage.setItem('server_url', LOCAL_SERVER_URL);

function SetupPageRoute() {
	const navigate = useNavigate();
	return (
		<>
			<div className="h-screen">
				<SetupPage onComplete={() => navigate('/')} />
			</div>
			<Toaster richColors position="top-right" />
		</>
	);
}

const router = createBrowserRouter([
	{
		element: <AppLayout />,
		errorElement: <RouteError />,
		children: [
			{
				// Content-level boundary: a crash in a page replaces only
				// the Outlet area, so AppLayout (the icon rail / nav) stays
				// usable. The parent route keeps its own errorElement as a
				// last-resort catch-all for AppLayout/AppSidebar crashes.
				errorElement: <RouteError />,
				children: [
					{ path: '/', element: <Navigate to="/platform" replace /> },
					{ path: '/platform', element: <PlatformPage view="dashboard" /> },
					{ path: '/platform/agents', element: <PlatformPage view="agents" /> },
					{ path: '/platform/tools', element: <PlatformPage view="tools" /> },
					{ path: '/platform/connectors', element: <PlatformPage view="connectors" /> },
					{ path: '/platform/workflows', element: <PlatformPage view="workflows" /> },
					{ path: '/platform/approvals', element: <PlatformPage view="approvals" /> },
					{ path: '/platform/runs', element: <PlatformPage view="runs" /> },
					{ path: '/platform/tenants', element: <PlatformPage view="tenants" /> },
					{ path: '/platform/enterprise', element: <EnterpriseGovernancePage /> },
					{ path: '/platform/memory', element: <PlatformPage view="memory" /> },
					{ path: '/platform/settings', element: <PlatformPage view="settings" /> },
					{
						path: '/chat/:agentId?/:sessionId?/:memberId?',
						element: <ChatPage />,
					},
					{ path: '/schedule', element: <SchedulePage /> },
					{ path: '/credential', element: <CredentialPage /> },
					{ path: '/knowledge', element: <KnowledgePage /> },
					{ path: '/knowledge/:kbId', element: <KnowledgePage /> },
				],
			},
		],
	},
	{ path: '/setup', element: <SetupPageRoute />, errorElement: <RouteError /> },
]);

function App() {
	const { t } = useTranslation();
	const tours = useMemo(() => [buildChatTour(t)], [t]);
	const { account, loading } = useAuth();
	if (loading) return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-muted-foreground">正在恢复登录状态…</div>;
	if (!account) return <><LoginPage /><Toaster richColors position="top-right" /></>;

	return (
		<OnbordaProvider>
			<Onborda
				steps={tours}
				cardComponent={TourCard}
				shadowOpacity="0.6"
				cardTransition={{ type: 'spring', duration: 0.4 }}
			>
				<UploadProvider>
					<RouterProvider router={router} />
				</UploadProvider>
				<Toaster richColors position="top-right" />
			</Onborda>
		</OnbordaProvider>
	);
}

export default function AppRoot() {
	return <AuthProvider><App /></AuthProvider>;
}
