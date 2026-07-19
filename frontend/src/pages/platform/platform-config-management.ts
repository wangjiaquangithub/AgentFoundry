import type {
	EnterprisePlatformConfigExportResponse,
	EnterprisePlatformConfigImportRequest,
	EnterprisePlatformConfigImportResponse,
} from '@/api';

export type PlatformConfigManagementRequestText = {
	loadError: string;
	importSuccess: (values: { members: number; agents: number }) => string;
	parseError: string;
	importError: string;
};

export type PlatformConfigCopyActionHandlers = {
	setImportText: (text: string) => void;
	copyText: (text: string) => void | Promise<void>;
};

export type PlatformConfigLoadActionHandlers = {
	setLoading: (loading: boolean) => void;
	clearError: () => void;
	exportConfig: () =>
		| EnterprisePlatformConfigExportResponse
		| Promise<EnterprisePlatformConfigExportResponse>;
	setExport: (response: EnterprisePlatformConfigExportResponse) => void;
	setImportText: (updater: (current: string) => string) => void;
	setError: (message: string) => void;
};

export type PlatformConfigImportActionHandlers = {
	setImporting: (importing: boolean) => void;
	clearError: () => void;
	clearResult: () => void;
	importConfig: (
		request: EnterprisePlatformConfigImportRequest,
	) =>
		| EnterprisePlatformConfigImportResponse
		| Promise<EnterprisePlatformConfigImportResponse>;
	setResult: (message: string) => void;
	refreshDependentViews: () => void | Promise<void>;
	handleError: (error: unknown) => void;
};

export type PlatformConfigManagementHandlerValues = {
	platformConfigExport: EnterprisePlatformConfigExportResponse | null;
	platformConfigImportText: string;
	platformConfigImportMode: EnterprisePlatformConfigImportRequest['mode'];
	text: PlatformConfigManagementRequestText;
};

export type PlatformConfigManagementHandlerActions = {
	setImportText: (text: string) => void;
	copyText: (text: string) => void | Promise<void>;
	setImporting: (importing: boolean) => void;
	clearError: () => void;
	clearResult: () => void;
	importConfig: (
		request: EnterprisePlatformConfigImportRequest,
	) =>
		| EnterprisePlatformConfigImportResponse
		| Promise<EnterprisePlatformConfigImportResponse>;
	setResult: (message: string) => void;
	refreshDependentViews: () => void | Promise<void>;
	setError: (message: string) => void;
};

export function formatPlatformConfigExport(
	config: EnterprisePlatformConfigExportResponse,
): string {
	return JSON.stringify(config, null, 2);
}

export function platformConfigImportTextForExport(values: {
	exportResponse: EnterprisePlatformConfigExportResponse;
	currentImportText: string;
}): string {
	if (values.currentImportText.trim()) {
		return values.currentImportText;
	}

	return formatPlatformConfigExport(values.exportResponse);
}

export function parsePlatformConfigImportText(text: string): Record<string, unknown> {
	return JSON.parse(text) as Record<string, unknown>;
}

export function platformConfigImportSuccessMessage(
	response: EnterprisePlatformConfigImportResponse,
	text: PlatformConfigManagementRequestText,
): string {
	return text.importSuccess({
		members: response.counts.members,
		agents: response.counts.agents,
	});
}

export function platformConfigLoadErrorMessage(
	error: unknown,
	text: PlatformConfigManagementRequestText,
): string {
	return error instanceof Error ? error.message : text.loadError;
}

export function platformConfigImportErrorMessage(
	error: unknown,
	text: PlatformConfigManagementRequestText,
): string {
	if (error instanceof SyntaxError) {
		return text.parseError;
	}

	return error instanceof Error ? error.message : text.importError;
}

export async function runPlatformConfigLoadAction(
	text: PlatformConfigManagementRequestText,
	handlers: PlatformConfigLoadActionHandlers,
) {
	handlers.setLoading(true);
	handlers.clearError();
	try {
		const response = await handlers.exportConfig();
		handlers.setExport(response);
		handlers.setImportText((current) =>
			platformConfigImportTextForExport({
				exportResponse: response,
				currentImportText: current,
			}),
		);
	} catch (error) {
		handlers.setError(platformConfigLoadErrorMessage(error, text));
	} finally {
		handlers.setLoading(false);
	}
}

export async function runPlatformConfigCopyAction(
	config: EnterprisePlatformConfigExportResponse | null,
	handlers: PlatformConfigCopyActionHandlers,
) {
	if (!config) {
		return;
	}

	const text = formatPlatformConfigExport(config);
	handlers.setImportText(text);
	await handlers.copyText(text);
}

export async function runPlatformConfigImportAction(
	values: {
		importText: string;
		importMode: EnterprisePlatformConfigImportRequest['mode'];
		text: PlatformConfigManagementRequestText;
	},
	handlers: PlatformConfigImportActionHandlers,
) {
	handlers.setImporting(true);
	handlers.clearError();
	handlers.clearResult();
	try {
		const parsed = parsePlatformConfigImportText(values.importText);
		const response = await handlers.importConfig({
			mode: values.importMode,
			config: parsed,
		});
		handlers.setResult(
			platformConfigImportSuccessMessage(response, values.text),
		);
		await handlers.refreshDependentViews();
	} catch (error) {
		handlers.handleError(error);
	} finally {
		handlers.setImporting(false);
	}
}

export function createPlatformConfigManagementHandlers(
	values: PlatformConfigManagementHandlerValues,
	actions: PlatformConfigManagementHandlerActions,
) {
	async function handleCopyPlatformConfig() {
		await runPlatformConfigCopyAction(values.platformConfigExport, {
			setImportText: actions.setImportText,
			copyText: actions.copyText,
		});
	}

	async function handleImportPlatformConfig() {
		await runPlatformConfigImportAction(
			{
				importText: values.platformConfigImportText,
				importMode: values.platformConfigImportMode,
				text: values.text,
			},
			{
				setImporting: actions.setImporting,
				clearError: actions.clearError,
				clearResult: actions.clearResult,
				importConfig: actions.importConfig,
				setResult: actions.setResult,
				refreshDependentViews: actions.refreshDependentViews,
				handleError: (error) =>
					actions.setError(platformConfigImportErrorMessage(error, values.text)),
			},
		);
	}

	return {
		handleCopyPlatformConfig,
		handleImportPlatformConfig,
	};
}
