import type { ComponentProps } from 'react';

import { SettingsViewPage } from './components/SettingsViewPage';

type SettingsViewPageProps = ComponentProps<typeof SettingsViewPage>;

export function createPlatformSettingsViewProps(
	props: SettingsViewPageProps,
): SettingsViewPageProps {
	return props;
}
