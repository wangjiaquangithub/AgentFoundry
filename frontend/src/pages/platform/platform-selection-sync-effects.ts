import { useEffect } from 'react';

import type {
	EnterpriseAgentRunResponse,
	EnterprisePlatformConnectorsResponse,
	EnterprisePublishedAgent,
	EnterpriseToolCatalogItem,
	EnterpriseToolDecision,
	EnterpriseWorkflowTemplate,
} from '@/api';
import {
	agentRunResultForSelectedAgent,
	selectedRunAgentIdForAvailableAgents,
	workflowSelectionForAvailableTemplates,
	type AgentConversationMap,
} from './platform-agent-runner';
import { connectorFormWithPlatformDefaults } from './platform-connector-helpers';
import type { ConnectorTestFormState } from './platform-defaults';
import { toolPolicyDraftFromDecisions } from './platform-tool-policy-helpers';
import type { ToolPolicyDraftValue } from './components/TenantGovernancePanel';

type StateSetter<T> = (value: T | ((current: T) => T)) => void;
type RefreshHandler = () => void | Promise<void>;

export type PlatformSelectionSyncEffectValues = {
	activePlatformAgents: EnterprisePublishedAgent[];
	agentConversations: AgentConversationMap;
	availableToolItems: EnterpriseToolCatalogItem[];
	connectorDefaultsAppliedRef: { current: boolean };
	connectors: EnterprisePlatformConnectorsResponse | null;
	enterpriseIdentities: { user_id: string }[];
	readyPlatformAgents: EnterprisePublishedAgent[];
	selectedIdentityAllowedTools: EnterpriseToolDecision[];
	selectedIdentityDeniedTools: EnterpriseToolDecision[];
	selectedIdentityUserId: string;
	selectedRunAgentId: string;
	selectedWorkflowType: string;
	workflowTemplates: EnterpriseWorkflowTemplate[];
};

export type PlatformSelectionSyncEffectHandlers = {
	refetchAgentRuns: RefreshHandler;
	setAgentRunResult: StateSetter<EnterpriseAgentRunResponse | null>;
	setConnectorTestForm: StateSetter<ConnectorTestFormState>;
	setSelectedIdentityUserId: StateSetter<string>;
	setSelectedRunAgentId: StateSetter<string>;
	setSelectedWorkflowType: StateSetter<string>;
	setToolPolicyDraft: StateSetter<Record<string, ToolPolicyDraftValue>>;
	setToolPolicySaveError: StateSetter<string | null>;
	setToolPolicySaveSuccess: StateSetter<string | null>;
	setWorkflowInputs: StateSetter<Record<string, string>>;
};

export function usePlatformSelectionSyncEffects(
	values: PlatformSelectionSyncEffectValues,
	handlers: PlatformSelectionSyncEffectHandlers,
) {
	useEffect(() => {
		handlers.setToolPolicyDraft(
			toolPolicyDraftFromDecisions({
				tools: values.availableToolItems,
				allowedTools: values.selectedIdentityAllowedTools,
				deniedTools: values.selectedIdentityDeniedTools,
			}),
		);
		handlers.setToolPolicySaveError(null);
		handlers.setToolPolicySaveSuccess(null);
	}, [
		values.availableToolItems,
		values.selectedIdentityAllowedTools,
		values.selectedIdentityDeniedTools,
	]);

	useEffect(() => {
		if (!values.selectedIdentityUserId && values.enterpriseIdentities.length) {
			handlers.setSelectedIdentityUserId(
				values.enterpriseIdentities[0].user_id,
			);
		}
	}, [values.enterpriseIdentities, values.selectedIdentityUserId]);

	useEffect(() => {
		const connectors = values.connectors;

		if (!connectors || values.connectorDefaultsAppliedRef.current) {
			return;
		}

		values.connectorDefaultsAppliedRef.current = true;
		handlers.setConnectorTestForm((previous) =>
			connectorFormWithPlatformDefaults({
				current: previous,
				connectors,
			}),
		);
	}, [values.connectors]);

	useEffect(() => {
		const nextAgentId = selectedRunAgentIdForAvailableAgents({
			currentAgentId: values.selectedRunAgentId,
			activeAgents: values.activePlatformAgents,
			readyAgents: values.readyPlatformAgents,
		});

		if (nextAgentId !== values.selectedRunAgentId) {
			handlers.setSelectedRunAgentId(nextAgentId);
		}
	}, [
		values.activePlatformAgents,
		values.readyPlatformAgents,
		values.selectedRunAgentId,
	]);

	useEffect(() => {
		if (!values.selectedRunAgentId) {
			handlers.setAgentRunResult(null);
			return;
		}

		handlers.setAgentRunResult((current) =>
			agentRunResultForSelectedAgent({
				current,
				agentConversations: values.agentConversations,
				agentId: values.selectedRunAgentId,
			}),
		);
	}, [values.selectedRunAgentId]);

	useEffect(() => {
		void handlers.refetchAgentRuns();
	}, [values.selectedRunAgentId, values.selectedIdentityUserId]);

	useEffect(() => {
		const nextSelection = workflowSelectionForAvailableTemplates({
			workflowTemplates: values.workflowTemplates,
			selectedWorkflowType: values.selectedWorkflowType,
		});

		if (nextSelection) {
			handlers.setSelectedWorkflowType(nextSelection.workflowType);
			handlers.setWorkflowInputs(nextSelection.inputs);
		}
	}, [values.selectedWorkflowType, values.workflowTemplates]);
}
