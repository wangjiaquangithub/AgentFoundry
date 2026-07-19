import type { FirstAgentGuideStep } from './components/FirstAgentGuide';
import type { RolloutPathStep } from './components/RolloutPath';
import {
	firstAgentGuidePrimaryStepForSteps,
	firstAgentGuideStepsForStatus,
	rolloutPathStepsForStatus,
} from './platform-utils';

export interface PlatformOnboardingDisplayState {
	firstAgentGuidePrimaryStep: FirstAgentGuideStep;
	firstAgentGuideSteps: FirstAgentGuideStep[];
	rolloutPathSteps: RolloutPathStep[];
}

export function platformOnboardingDisplayStateForStatus(
	values: {
		credentialCount: number;
		knowledgeBaseCount: number;
		readyAgentCount: number;
		activeAgentCount: number;
		hasAgentRunResult: boolean;
		hasSelectedRunAgent: boolean;
		auditEventCount: number;
		pendingApprovalCount: number;
		hasPlatformConfigExport: boolean;
	},
	options: {
		firstAgentGuide: Parameters<typeof firstAgentGuideStepsForStatus>[1];
		rolloutPath: Parameters<typeof rolloutPathStepsForStatus>[1];
	},
): PlatformOnboardingDisplayState {
	const rolloutPathSteps = rolloutPathStepsForStatus(
		{
			credentialCount: values.credentialCount,
			knowledgeBaseCount: values.knowledgeBaseCount,
			readyAgentCount: values.readyAgentCount,
			activeAgentCount: values.activeAgentCount,
			hasAgentRunResult: values.hasAgentRunResult,
			hasSelectedRunAgent: values.hasSelectedRunAgent,
			auditEventCount: values.auditEventCount,
			pendingApprovalCount: values.pendingApprovalCount,
			hasPlatformConfigExport: values.hasPlatformConfigExport,
		},
		options.rolloutPath,
	);
	const firstAgentGuideSteps = firstAgentGuideStepsForStatus(
		{
			credentialCount: values.credentialCount,
			readyAgentCount: values.readyAgentCount,
			activeAgentCount: values.activeAgentCount,
			hasAgentRunResult: values.hasAgentRunResult,
			hasSelectedRunAgent: values.hasSelectedRunAgent,
			auditEventCount: values.auditEventCount,
			pendingApprovalCount: values.pendingApprovalCount,
		},
		options.firstAgentGuide,
	);

	return {
		firstAgentGuidePrimaryStep:
			firstAgentGuidePrimaryStepForSteps(firstAgentGuideSteps),
		firstAgentGuideSteps,
		rolloutPathSteps,
	};
}
