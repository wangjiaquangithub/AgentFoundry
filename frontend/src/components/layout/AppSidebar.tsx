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
	Settings,
	ShieldCheck,
	UsersRound,
	Wrench,
} from 'lucide-react';
import { useOnborda } from 'onborda';
import { useNavigate, useLocation } from 'react-router-dom';

import AgentScope from '@/assets/images/agentscope.svg?react';
import { CHAT_TOUR_NAME } from '@/components/tour/chatTourSteps';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import i18n from '@/i18n';
import { useTranslation } from '@/i18n/useI18n';

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

	const platformItems = [
		{ key: 'platform-dashboard', label: '平台总览', path: '/platform', icon: LayoutDashboard },
		{ key: 'platform-agents', label: 'Agent 管理', path: '/platform/agents', icon: Bot },
		{ key: 'platform-tools', label: '工具目录', path: '/platform/tools', icon: Wrench },
		{ key: 'platform-workflows', label: '工作流', path: '/platform/workflows', icon: GitBranch },
		{ key: 'platform-approvals', label: '审批治理', path: '/platform/approvals', icon: ShieldCheck },
		{ key: 'platform-runs', label: '运行台', path: '/platform/runs', icon: PlayCircle },
		{ key: 'platform-tenants', label: '租户成员', path: '/platform/tenants', icon: UsersRound },
		{ key: 'platform-memory', label: '长期记忆', path: '/platform/memory', icon: Brain },
		{ key: 'platform-settings', label: '平台设置', path: '/platform/settings', icon: Boxes },
	];

	return (
		<Sidebar collapsible="none" className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r">
			<SidebarHeader>
				<div className="flex items-center justify-center h-12 mt-2">
					<AgentScope className="size-8 items-center justify-center rounded-lg" />
				</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{platformItems.map((item) => {
								const Icon = item.icon;
								const isActive =
									location.pathname === item.path ||
									(item.path === '/platform' && location.pathname === '/');

								return (
									<SidebarMenuItem key={item.key}>
										<SidebarMenuButton
											tooltip={{ children: item.label, hidden: false }}
											isActive={isActive}
											onClick={() => navigate(item.path)}
											className="px-2.5 md:px-2"
										>
											<Icon />
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
							<SidebarMenuItem key={'chat'}>
								<SidebarMenuButton
									tooltip={{ children: t('common.chat'), hidden: false }}
									isActive={
										location.pathname === '/chat' ||
										location.pathname.startsWith('/chat/')
									}
									onClick={() => navigate('/chat')}
									className="px-2.5 md:px-2"
								>
									<BotMessageSquare />
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip={{ children: t('common.schedule'), hidden: false }}
									isActive={location.pathname === '/schedule'}
									onClick={() => navigate('/schedule')}
									className="px-2"
								>
									<Calendars />
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip={{ children: t('common.credential'), hidden: false }}
									isActive={location.pathname === '/credential'}
									onClick={() => navigate('/credential')}
									className="px-2"
								>
									<KeyRound />
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip={{ children: t('common.knowledge'), hidden: false }}
									isActive={location.pathname === '/knowledge'}
									onClick={() => navigate('/knowledge')}
									className="px-2"
								>
									<LibraryBig />
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
							tooltip={{
								children: i18n.language.startsWith('zh')
									? t('common.switchToEn')
									: t('common.switchToZh'),
								hidden: false,
							}}
							onClick={handleToggleLanguage}
							className="px-2"
						>
							<Languages />
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							tooltip={{ children: t('tour.trigger'), hidden: false }}
							onClick={handleStartTour}
							className="px-2"
						>
							<Compass />
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							tooltip={{ children: t('common.settings'), hidden: false }}
							isActive={location.pathname === '/setup'}
							onClick={() => navigate('/setup')}
							className="px-2"
						>
							<Settings />
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
