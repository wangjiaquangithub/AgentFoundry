import { useEffect } from 'react';

type RefreshHandler = () => void | Promise<void>;

export type PlatformDataLoadEffectValues = {
	selectedIdentityUserId: string;
	selectedRunAgentId: string;
};

export type PlatformDataLoadEffectHandlers = {
	refetchApprovals: RefreshHandler;
	refetchAuditEvents: RefreshHandler;
	refetchConnectors: RefreshHandler;
	refetchGovernance: RefreshHandler;
	refetchMembers: RefreshHandler;
	refetchOpsTasks: RefreshHandler;
	refetchPlatformAgents: RefreshHandler;
	refetchPlatformConfigExport: RefreshHandler;
	refetchScenarios: RefreshHandler;
	refetchToolCatalog: RefreshHandler;
	refetchWorkflowRuns: RefreshHandler;
	refetchWorkflowTemplates: RefreshHandler;
};

export function usePlatformDataLoadEffects(
	values: PlatformDataLoadEffectValues,
	handlers: PlatformDataLoadEffectHandlers,
) {
	useEffect(() => {
		void handlers.refetchConnectors();
		void handlers.refetchGovernance();
		void handlers.refetchMembers();
		void handlers.refetchPlatformAgents();
		void handlers.refetchAuditEvents();
		void handlers.refetchWorkflowTemplates();
		void handlers.refetchWorkflowRuns();
		void handlers.refetchScenarios();
		void handlers.refetchOpsTasks();
		void handlers.refetchApprovals();
		void handlers.refetchPlatformConfigExport();
	}, []);

	useEffect(() => {
		void handlers.refetchToolCatalog();
	}, [values.selectedRunAgentId, values.selectedIdentityUserId]);
}
