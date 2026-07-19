import { platformOnboardingDisplayStateForStatus } from './platform-onboarding-display';

type PlatformOnboardingDisplayValues = Parameters<
	typeof platformOnboardingDisplayStateForStatus
>[0];
type PlatformOnboardingDisplayOptions = Parameters<
	typeof platformOnboardingDisplayStateForStatus
>[1];

export function createPlatformOnboardingPageState(values: {
	onboarding: PlatformOnboardingDisplayValues;
	onboardingOptions: PlatformOnboardingDisplayOptions;
}) {
	const onboardingDisplay = platformOnboardingDisplayStateForStatus(
		values.onboarding,
		values.onboardingOptions,
	);

	return {
		firstAgentGuidePrimaryStep: onboardingDisplay.firstAgentGuidePrimaryStep,
		firstAgentGuideSteps: onboardingDisplay.firstAgentGuideSteps,
		rolloutPathSteps: onboardingDisplay.rolloutPathSteps,
	};
}
