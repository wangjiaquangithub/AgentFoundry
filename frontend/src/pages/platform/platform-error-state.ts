export type PlatformPageErrorSources = {
	agentsError: unknown;
	credentialsError: unknown;
	knowledgeError: unknown;
	schedulesError: unknown;
	platformError: unknown;
	connectorsError: unknown;
	governanceError: unknown;
	platformMembersError: unknown;
	platformAgentsError: unknown;
	toolCatalogError: unknown;
	auditError: unknown;
	workflowTemplatesError: unknown;
	workflowRunsError: unknown;
	scenariosError: unknown;
	opsTasksError: unknown;
	approvalError: unknown;
	platformConfigError: unknown;
	agentRunsError: unknown;
};

export function platformPageHasErrors(sources: PlatformPageErrorSources): boolean {
	return Object.values(sources).some(Boolean);
}

const platformNetworkErrorPatterns = [
	'failed to fetch',
	'networkerror',
	'network error',
	'load failed',
	'typeerror: fetch',
	'fetch failed',
	'failed to load',
];

export const platformServiceUnavailableTitle = '无法连接平台服务';
export const platformServiceUnavailableDescription =
	'请确认后端服务已启动，或稍后重试。';

export function platformErrorMessage(error: unknown): string | null {
	if (error instanceof Error) {
		const { message } = error;
		return message;
	}

	if (typeof error === 'string') {
		return error;
	}

	return null;
}

export function isPlatformNetworkError(error: unknown): boolean {
	const message = platformErrorMessage(error);

	if (!message) {
		return false;
	}

	const normalizedMessage = message.toLowerCase();
	return platformNetworkErrorPatterns.some((pattern) =>
		normalizedMessage.includes(pattern),
	);
}

export function normalizePlatformErrorMessage(
	error: unknown,
	fallbackMessage = platformServiceUnavailableDescription,
): string {
	if (isPlatformNetworkError(error)) {
		return platformServiceUnavailableDescription;
	}

	return platformErrorMessage(error) || fallbackMessage;
}
