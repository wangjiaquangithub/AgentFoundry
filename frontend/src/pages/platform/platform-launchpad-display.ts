import type { EnterprisePlatformMember } from '@/api';
import type { HealthState } from './components/common';
import type { LaunchpadStep } from './components/LaunchpadPanel';
import {
	activePlatformMemberCountForMembers,
	capabilityItemsForStatus,
	launchpadPrimaryStepForSteps,
	launchpadStateForCounts,
	launchpadStepsForStatus,
	launchpadTargetActionsForNavigation,
	readyLaunchpadStepCountForSteps,
} from './platform-utils';

type LaunchpadStepOptions = Parameters<typeof launchpadStepsForStatus>[1];

export function platformCapabilityItemsDisplayStateForStatus(
	options: Parameters<typeof capabilityItemsForStatus>[0],
) {
	return capabilityItemsForStatus(options);
}

export interface PlatformLaunchpadDisplayState {
	activeMemberCount: number;
	primaryStep: LaunchpadStep;
	readyCount: number;
	state: HealthState;
	steps: LaunchpadStep[];
	totalCount: number;
}

export function platformLaunchpadDisplayStateForStatus(
	values: {
		members: EnterprisePlatformMember[];
		credentialCount: number;
		knowledgeBaseCount: number;
		activeAgentCount: number;
		readyAgentCount: number;
		hasAgentRunResult: boolean;
		hasSelectedRunAgent: boolean;
		auditEventCount: number;
		pendingApprovalCount: number;
	},
	options: {
		icons: LaunchpadStepOptions['icons'];
		navigationActions: Parameters<typeof launchpadTargetActionsForNavigation>[0];
		fallbackAction: () => void;
		labels: LaunchpadStepOptions['labels'];
	},
): PlatformLaunchpadDisplayState {
	const activeMemberCount = activePlatformMemberCountForMembers(values.members);
	const steps = launchpadStepsForStatus(
		{
			activeMemberCount,
			credentialCount: values.credentialCount,
			knowledgeBaseCount: values.knowledgeBaseCount,
			activeAgentCount: values.activeAgentCount,
			readyAgentCount: values.readyAgentCount,
			hasAgentRunResult: values.hasAgentRunResult,
			hasSelectedRunAgent: values.hasSelectedRunAgent,
			auditEventCount: values.auditEventCount,
			pendingApprovalCount: values.pendingApprovalCount,
		},
		{
			icons: options.icons,
			actions: launchpadTargetActionsForNavigation(options.navigationActions),
			fallbackAction: options.fallbackAction,
			labels: options.labels,
		},
	);
	const readyCount = readyLaunchpadStepCountForSteps(steps);
	const totalCount = steps.length;

	return {
		activeMemberCount,
		primaryStep: launchpadPrimaryStepForSteps(steps),
		readyCount,
		state: launchpadStateForCounts({ readyCount, totalCount }),
		steps,
		totalCount,
	};
}
