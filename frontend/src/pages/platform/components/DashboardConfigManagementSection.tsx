// @ts-nocheck

import { ConfigManagementPanel } from './ConfigManagementPanel';

interface DashboardConfigManagementSectionProps {
	[key: string]: any;
}

export function DashboardConfigManagementSection({
	t,
	platformConfigExport,
	platformConfigLoading,
	platformConfigError,
	platformConfigImportResult,
	platformConfigImportMode,
	platformConfigImportText,
	importingPlatformConfig,
	refetchPlatformConfigExport,
	handleCopyPlatformConfig,
	handleImportPlatformConfig,
	setPlatformConfigImportMode,
	setPlatformConfigImportText,
}: DashboardConfigManagementSectionProps) {
	return (
		<ConfigManagementPanel
			platformConfigExport={platformConfigExport}
			platformConfigLoading={platformConfigLoading}
			platformConfigError={platformConfigError}
			platformConfigImportResult={platformConfigImportResult}
			platformConfigImportMode={platformConfigImportMode}
			platformConfigImportText={platformConfigImportText}
			importingPlatformConfig={importingPlatformConfig}
			onRefetchPlatformConfigExport={refetchPlatformConfigExport}
			onCopyPlatformConfig={handleCopyPlatformConfig}
			onImportPlatformConfig={handleImportPlatformConfig}
			onPlatformConfigImportModeChange={setPlatformConfigImportMode}
			onPlatformConfigImportTextChange={setPlatformConfigImportText}
			t={t}
		/>
	);
}
