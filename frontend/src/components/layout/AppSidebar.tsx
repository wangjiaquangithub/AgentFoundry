import {
	BotMessageSquare,
	Bot,
	Boxes,
	Brain,
	Calendars,
	Compass,
	GitBranch,
	KeyRound,
	Languages,
	LayoutDashboard,
	LibraryBig,
	PlayCircle,
	PlugZap,
	Settings,
	ShieldCheck,
	UsersRound,
	Wrench,
} from 'lucide-react';
import { useOnborda } from 'onborda';
import type { ComponentType } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { CHAT_TOUR_NAME } from '@/components/tour/chatTourSteps';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import i18n from '@/i18n';
import { useTranslation } from '@/i18n/useI18n';

type SidebarItem = {
	key: string;
	label: string;
	path: string;
	icon: ComponentType<{ className?: string }>;
	end?: boolean;
};

const platformGroups: Array<{ label: string; items: SidebarItem[] }> = [
	{
		label: 'Operate',
		items: [
			{ key: 'platform-dashboard', label: '平台总览', path: '/platform', icon: LayoutDashboard, end: true },
			{ key: 'platform-runs', label: '运行监控', path: '/platform/runs', icon: PlayCircle },
			{ key: 'platform-approvals', label: '审批队列', path: '/platform/approvals', icon: ShieldCheck },
			{ key: 'platform-connectors', label: 'Runtime Providers', path: '/platform/connectors', icon: PlugZap },
		],
	},
	{
		label: 'Build',
		items: [
			{ key: 'platform-agents', label: 'Agents', path: '/platform/agents', icon: Bot },
			{ key: 'platform-tools', label: 'Tools', path: '/platform/tools', icon: Wrench },
			{ key: 'platform-memory', label: 'Knowledge / Memory', path: '/platform/memory', icon: Brain },
			{ key: 'platform-workflows', label: 'Workflows', path: '/platform/workflows', icon: GitBranch },
		],
	},
	{
		label: 'Govern',
		items: [
			{ key: 'platform-tenants', label: 'Members / Tenants', path: '/platform/tenants', icon: UsersRound },
		],
	},
	{
		label: 'Configure',
		items: [
			{ key: 'platform-settings', label: 'Models / Settings', path: '/platform/settings', icon: Boxes },
		],
	},
];

export function AppSidebar() {
	const navigate = useNavigate();
	const location = useLocation();
	const { t } = useTranslation();
	const { startOnborda } = useOnborda();

	const handleStartTour = () => {
		if (!location.pathname.startsWith('/chat')) {
			// Page not mounted yet — leave a flag, navigate, and let the
			// ChatTourController auto-trigger after ChatPage mounts.
			sessionStorage.setItem('force_tour', '1');
			navigate('/chat');
		} else {
			startOnborda(CHAT_TOUR_NAME);
		}
	};

	const handleToggleLanguage = () => {
		const next = i18n.language.startsWith('zh') ? 'en' : 'zh';
		i18n.changeLanguage(next);
	};

	const isActivePath = (item: SidebarItem) => {
		if (item.end) {
			return location.pathname === item.path || (item.path === '/platform' && location.pathname === '/');
		}
		return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
	};

	return (
		<Sidebar collapsible="none" className="border-r">
			<SidebarHeader className="border-b px-4 py-4">
				<div className="flex items-center gap-3">
					<div className="grid size-9 shrink-0 place-items-center rounded-md bg-foreground text-sm font-semibold text-background">
						AF
					</div>
					<div className="min-w-0">
						<div className="truncate text-sm font-semibold">AgentFoundry</div>
						<div className="truncate text-xs text-sidebar-foreground/60">
							Enterprise Agent Console
						</div>
					</div>
				</div>
			</SidebarHeader>
			<SidebarContent className="py-2">
				{platformGroups.map((group) => (
					<SidebarGroup key={group.label}>
						<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{group.items.map((item) => {
									const Icon = item.icon;

									return (
										<SidebarMenuItem key={item.key}>
											<SidebarMenuButton
												tooltip={item.label}
												isActive={isActivePath(item)}
												onClick={() => navigate(item.path)}
											>
												<Icon />
												<span>{item.label}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
				<SidebarGroup>
					<SidebarGroupLabel>Workbench</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem key={'chat'}>
								<SidebarMenuButton
									tooltip={t('common.chat')}
									isActive={
										location.pathname === '/chat' ||
										location.pathname.startsWith('/chat/')
									}
									onClick={() => navigate('/chat')}
								>
									<BotMessageSquare />
									<span>{t('common.chat')}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip={t('common.schedule')}
									isActive={location.pathname === '/schedule'}
									onClick={() => navigate('/schedule')}
								>
									<Calendars />
									<span>{t('common.schedule')}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip={t('common.credential')}
									isActive={location.pathname === '/credential'}
									onClick={() => navigate('/credential')}
								>
									<KeyRound />
									<span>{t('common.credential')}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip={t('common.knowledge')}
									isActive={location.pathname === '/knowledge'}
									onClick={() => navigate('/knowledge')}
								>
									<LibraryBig />
									<span>{t('common.knowledge')}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							tooltip={
								i18n.language.startsWith('zh')
									? t('common.switchToEn')
									: t('common.switchToZh')
							}
							onClick={handleToggleLanguage}
						>
							<Languages />
							<span>
								{i18n.language.startsWith('zh')
									? t('common.switchToEn')
									: t('common.switchToZh')}
							</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							tooltip={t('tour.trigger')}
							onClick={handleStartTour}
						>
							<Compass />
							<span>{t('tour.trigger')}</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							tooltip={t('common.settings')}
							isActive={location.pathname === '/setup'}
							onClick={() => navigate('/setup')}
						>
							<Settings />
							<span>{t('common.settings')}</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
