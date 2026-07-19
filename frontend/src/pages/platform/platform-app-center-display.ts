import { appCenterDetailResourcesForSelection } from './app-center-detail-resources';
import {
	appCenterAgentDisplayStateForStatus,
	appCenterDetailHealthState,
	appCenterDetailResourceValuesForSelection,
	appCenterOperationsStateForStatus,
	agentReadinessIssues,
	agentReadinessState,
	operationsHeadlineText,
} from './platform-utils';

export interface PlatformAppCenterDisplayState {
	agentDisplayState: ReturnType<typeof appCenterAgentDisplayStateForStatus>;
	detailState: {
		detailResources: ReturnType<typeof appCenterDetailResourcesForSelection>;
		detailIssues: ReturnType<typeof appCenterDetailHealthState>['issues'];
		detailStatus: ReturnType<typeof appCenterDetailHealthState>['status'];
		operationsHeadline: ReturnType<typeof operationsHeadlineText>;
	};
	operationsState: ReturnType<typeof appCenterOperationsStateForStatus>;
}

export function platformAppCenterDisplayStateForStatus(values: {
	agentDisplay: Parameters<typeof appCenterAgentDisplayStateForStatus>[0];
	detail: {
		selection: Omit<
			Parameters<typeof appCenterDetailResourceValuesForSelection>[0],
			'agent' | 'template'
		>;
		resourceLabels: Parameters<typeof appCenterDetailResourcesForSelection>[1];
		health: Omit<
			Parameters<typeof appCenterDetailHealthState>[0],
			'agentReadiness' | 'agentIssues' | 'hasAgent' | 'hasTemplate'
		>;
		headline: {
			activeAgentCount: number;
			pendingApprovalCount: number;
		};
		headlineLabels: Parameters<typeof operationsHeadlineText>[1];
	};
	operations: Parameters<typeof appCenterOperationsStateForStatus>[0];
}): PlatformAppCenterDisplayState {
	const operationsState = appCenterOperationsStateForStatus(values.operations);
	const detailResourceValues = appCenterDetailResourceValuesForSelection(
		{
			...values.detail.selection,
			agent: operationsState.inspectedAgent,
			template: operationsState.inspectedTemplate,
		},
	);
	const detailHealth = appCenterDetailHealthState({
		...values.detail.health,
		hasAgent: Boolean(operationsState.inspectedAgent),
		agentReadiness: agentReadinessState(operationsState.inspectedAgent),
		agentIssues: agentReadinessIssues(operationsState.inspectedAgent),
		hasTemplate: Boolean(operationsState.inspectedTemplate),
	});

	return {
		agentDisplayState: appCenterAgentDisplayStateForStatus(values.agentDisplay),
		detailState: {
			detailResources: appCenterDetailResourcesForSelection(
				{
					agent: detailResourceValues.agent,
					template: detailResourceValues.template,
				},
				values.detail.resourceLabels,
			),
			detailIssues: detailHealth.issues,
			detailStatus: detailHealth.status,
			operationsHeadline: operationsHeadlineText(
				{
					...values.detail.headline,
					blockedOrPartialAgentCount: operationsState.blockedOrPartialAgents.length,
				},
				values.detail.headlineLabels,
			),
		},
		operationsState,
	};
}
