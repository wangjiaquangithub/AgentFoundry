import type { ComponentProps } from 'react';

import { ToolsViewPage } from './components/ToolsViewPage';

type ToolsViewPageProps = ComponentProps<typeof ToolsViewPage>;

export function createPlatformToolsViewProps(
	props: ToolsViewPageProps,
): ToolsViewPageProps {
	return props;
}
