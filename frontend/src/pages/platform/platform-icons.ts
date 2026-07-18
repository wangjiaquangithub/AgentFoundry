import {
	AlertTriangle,
	BotMessageSquare,
	Boxes,
	Brain,
	Building2,
	Clock3,
	Database,
	FileClock,
	HardDrive,
	KeyRound,
	LibraryBig,
	ListChecks,
	Network,
	Play,
	Server,
	ShieldCheck,
	Upload,
	UserRound,
	Workflow,
} from 'lucide-react';

export const platformOverviewStatIcons = {
	agents: BotMessageSquare,
	credentials: KeyRound,
	knowledgeBases: LibraryBig,
	workflows: Workflow,
};

export const runtimeStatusIcons = {
	platform: Server,
	userTenant: UserRound,
	connector: Network,
	dataDir: HardDrive,
	auditPath: FileClock,
	auditStatus: ShieldCheck,
};

export const agentReleasePipelineIcons = {
	template: ListChecks,
	model: KeyRound,
	knowledge: LibraryBig,
	tools: Boxes,
	runtime: Brain,
	publish: BotMessageSquare,
	governance: ShieldCheck,
};

export const governanceHealthIcons = {
	tenants: Building2,
	identities: UserRound,
	pendingApprovals: AlertTriangle,
	auditEvents: FileClock,
};

export const capabilityIcons = {
	model: KeyRound,
	knowledge: Database,
	agent: BotMessageSquare,
	tools: Boxes,
	workflow: Clock3,
	tenant: ShieldCheck,
	audit: Network,
	config: Upload,
};

export const launchpadStepIcons = {
	members: UserRound,
	model: KeyRound,
	knowledge: LibraryBig,
	agent: BotMessageSquare,
	run: Play,
	governance: ShieldCheck,
};

export const platformConsoleIcons = {
	agents: BotMessageSquare,
	resources: Network,
	run: Play,
	governance: ShieldCheck,
};

export const workbenchIndicatorIcons = {
	agents: BotMessageSquare,
	approvals: ShieldCheck,
	workflows: Workflow,
	memory: Brain,
};

export const workbenchPrimaryActionIcons = {
	run: Play,
	workflow: Workflow,
	governance: ShieldCheck,
	memory: Brain,
};

export const workbenchReadinessIcons = {
	model: KeyRound,
	knowledge: LibraryBig,
	connectors: Network,
	members: UserRound,
	agents: BotMessageSquare,
	workflows: Workflow,
};

export const workbenchQuickActionIcons = {
	connectors: Network,
	publish: BotMessageSquare,
	run: Play,
	workflow: Workflow,
	governance: ShieldCheck,
	tools: Boxes,
};

export const rolloutPathIcons = {
	model: KeyRound,
	knowledge: LibraryBig,
	agent: BotMessageSquare,
	run: Play,
	governance: ShieldCheck,
	config: Upload,
};

export const firstAgentGuideIcons = {
	model: KeyRound,
	agent: BotMessageSquare,
	run: Play,
	governance: ShieldCheck,
};

export const orchestrationWorkbenchIcons = {
	template: ListChecks,
	model: KeyRound,
	knowledge: LibraryBig,
	tools: Boxes,
	policy: ShieldCheck,
	publish: BotMessageSquare,
	operate: Workflow,
};

export const monitoringStatIcons = {
	agentRuns: BotMessageSquare,
	workflowRuns: Workflow,
	toolAudit: ShieldCheck,
	pendingApprovals: Clock3,
};
