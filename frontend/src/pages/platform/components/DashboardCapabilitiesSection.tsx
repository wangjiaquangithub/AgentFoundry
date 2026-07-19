// @ts-nocheck

import { CapabilitiesPanel } from './CapabilitiesPanel';

interface DashboardCapabilitiesSectionProps {
	[key: string]: any;
}

export function DashboardCapabilitiesSection({
	t,
	capabilities,
}: DashboardCapabilitiesSectionProps) {
	return <CapabilitiesPanel capabilities={capabilities} t={t} />;
}
