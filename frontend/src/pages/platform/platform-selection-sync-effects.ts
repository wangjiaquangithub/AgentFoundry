import { useEffect } from 'react';

import type { ToolPolicyDraftValue } from './components/TenantGovernancePanel';
import {
	agentRunResultForSelectedAgent,
	selectedRunAgentIdForAvailableAgents,
	workflowSelectionForAvailableTemplates,
	type AgentConversationMap,
} from './platform-agent-runner';
import { connectorFormWithPlatformDefaults } from './platform-connector-helpers';
import type { ConnectorTestFormState } from './platform-defaults';
import { toolPolicyDraftFromDecisions } from './platform-tool-policy-helpers';
import type {
	EnterpriseAgentRunResponse,
	EnterprisePlatformConnectorsResponse,
	EnterprisePublishedAgent,
	EnterpriseToolCatalogItem,
	EnterpriseToolDecision,
	EnterpriseWorkflowTemplate,
} from '@/api';

type StateSetter<T> = (value: T | ((current: T) => T)) => void;
type RefreshHandler = () => void | Promise<void>;

function toolPolicyDraftsAreEqual(
	current: Record<string, ToolPolicyDraftValue>,
	next: Record<string, ToolPolicyDraftValue>,
) {
	const currentKeys = Object.keys(current);
	const nextKeys = Object.keys(next);

	if (currentKeys.length !== nextKeys.length) {
		return false;
	}

	return nextKeys.every((key) => current[key] === next[key]);
}

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
		const nextDraft = toolPolicyDraftFromDecisions({
			tools: values.availableToolItems,
			allowedTools: values.selectedIdentityAllowedTools,
			deniedTools: values.selectedIdentityDeniedTools,
		});

		handlers.setToolPolicyDraft((current) =>
			toolPolicyDraftsAreEqual(current, nextDraft) ? current : nextDraft,
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
		const connectorDefaultsAppliedRef = values.connectorDefaultsAppliedRef;

		if (!connectors || connectorDefaultsAppliedRef.current) {
			return;
		}

		connectorDefaultsAppliedRef.current = true;
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
