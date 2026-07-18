import type {
	EnterprisePlatformConfigExportResponse,
	EnterprisePlatformConfigImportResponse,
} from '@/api';

export type PlatformConfigManagementRequestText = {
	loadError: string;
	importSuccess: (values: { members: number; agents: number }) => string;
	parseError: string;
	importError: string;
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
