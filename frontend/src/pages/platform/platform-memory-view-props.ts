import type { ComponentProps } from 'react';

import { MemoryViewPage } from './components/MemoryViewPage';

type MemoryViewPageProps = ComponentProps<typeof MemoryViewPage>;

export function createPlatformMemoryViewProps(
	props: MemoryViewPageProps,
): MemoryViewPageProps {
	return props;
}
