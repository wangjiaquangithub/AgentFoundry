import { platformConnectorDisplayStateForStatus } from './platform-connector-display';

type PlatformConnectorDisplayValues = Parameters<typeof platformConnectorDisplayStateForStatus>[0];

export function createPlatformConnectorPageState(values: PlatformConnectorDisplayValues) {
	const connectorDisplay = platformConnectorDisplayStateForStatus(values);
	const connectorOperationsState = connectorDisplay.operationsState;

	return {
		connectorState: connectorOperationsState.connectorState,
		savedConnectorConfigs: connectorOperationsState.savedConnectorConfigs,
		activeConnectorTenant: connectorOperationsState.activeConnectorTenant,
		activeSavedConnectorConfig: connectorOperationsState.activeSavedConnectorConfig,
		connectorDraftIssues: connectorOperationsState.connectorDraftIssues,
		connectorDraftState: connectorOperationsState.connectorDraftState,
		connectorTestPassed: connectorOperationsState.connectorTestPassed,
		connectorRuntimeState: connectorOperationsState.connectorRuntimeState,
		connectorRuntimeSourceText: connectorOperationsState.connectorRuntimeSourceText,
	};
}
