// @ts-nocheck

import { ToolCatalogPanel } from './ToolCatalogPanel';

interface DashboardToolCatalogSectionProps {
	[key: string]: any;
}

export function DashboardToolCatalogSection({
	t,
	configManagementRef,
	availableToolItems,
	publishedPlatformAgents,
	toolCatalogLoading,
	toolCatalogError,
	refetchToolCatalog,
}: DashboardToolCatalogSectionProps) {
	return (
		<ToolCatalogPanel
			sectionRef={configManagementRef}
			availableToolItems={availableToolItems}
			publishedPlatformAgents={publishedPlatformAgents}
			toolCatalogLoading={toolCatalogLoading}
			toolCatalogError={toolCatalogError}
			onRefetchToolCatalog={refetchToolCatalog}
			t={t}
		/>
	);
}
