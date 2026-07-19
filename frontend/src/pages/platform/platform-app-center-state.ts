import { platformAppCenterDisplayStateForStatus } from './platform-app-center-display';

type PlatformAppCenterDisplayValues = Parameters<
	typeof platformAppCenterDisplayStateForStatus
>[0];

export function createPlatformAppCenterPageState(values: PlatformAppCenterDisplayValues) {
	const appCenterDisplay = platformAppCenterDisplayStateForStatus(values);
	const appCenterOperationsState = appCenterDisplay.operationsState;
	const appCenterDetailState = appCenterDisplay.detailState;

	return {
		blockedOrPartialPlatformAgents: appCenterOperationsState.blockedOrPartialAgents,
		appCenterAgents: appCenterOperationsState.appCenterAgents,
		inspectedAppCenterAgent: appCenterOperationsState.inspectedAgent,
		inspectedAppCenterTemplate: appCenterOperationsState.inspectedTemplate,
		appCenterPrimaryDisabled: appCenterOperationsState.primaryDisabled,
		agentOpsSummary: appCenterOperationsState.agentOpsSummary,
		topOperationsAgents: appCenterOperationsState.topOperationsAgents,
		operationsAgentIssueText:
			appCenterDisplay.agentDisplayState.operationsAgentIssueText,
		agentResourceText: appCenterDisplay.agentDisplayState.agentResourceText,
		appCenterDetailResources: appCenterDetailState.detailResources,
		appCenterDetailIssues: appCenterDetailState.detailIssues,
		appCenterDetailStatus: appCenterDetailState.detailStatus,
		operationsHeadline: appCenterDetailState.operationsHeadline,
	};
}
