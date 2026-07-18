import type {
	EnterpriseConnectorConfigSaveRequest,
	EnterpriseConnectorSavedConfig,
	EnterpriseConnectorTestRequest,
} from '@/api';
import type { ConnectorTestFormState } from './platform-defaults';

const defaultConnectorPolicyPath = '/tenants/{tenant}/policies/search';
const defaultConnectorTicketPath = '/tenants/{tenant}/tickets/{ticket_id}';
const defaultConnectorMetricsPath =
	'/tenants/{tenant}/departments/{department}/metrics';

function connectorTimeoutFromForm(form: ConnectorTestFormState) {
	const timeout = Number.parseFloat(form.timeout_seconds);

	return Number.isFinite(timeout) && timeout > 0 ? timeout : 5;
}

export function connectorFormPatchFromSavedConfig(
	current: ConnectorTestFormState,
	config: EnterpriseConnectorSavedConfig,
): ConnectorTestFormState {
	return {
		...current,
		base_url: config.base_url,
		token: '',
		tenant: config.tenant,
		policy_path: config.policy_path || current.policy_path,
		ticket_path: config.ticket_path || current.ticket_path,
		metrics_path: config.metrics_path || current.metrics_path,
		timeout_seconds:
			Number.isFinite(config.timeout_seconds) && config.timeout_seconds > 0
				? String(config.timeout_seconds)
				: current.timeout_seconds,
		enabled: config.enabled,
	};
}

export function connectorSavePayloadFromForm(
	form: ConnectorTestFormState,
	baseUrl: string,
): EnterpriseConnectorConfigSaveRequest {
	return {
		base_url: baseUrl,
		token: form.token.trim() || undefined,
		tenant: form.tenant.trim() || 'acme',
		policy_path: form.policy_path.trim() || defaultConnectorPolicyPath,
		ticket_path: form.ticket_path.trim() || defaultConnectorTicketPath,
		metrics_path: form.metrics_path.trim() || defaultConnectorMetricsPath,
		timeout_seconds: connectorTimeoutFromForm(form),
		enabled: form.enabled,
	};
}

export function connectorTestPayloadFromForm(
	form: ConnectorTestFormState,
	baseUrl: string,
): EnterpriseConnectorTestRequest {
	return {
		base_url: baseUrl,
		token: form.token.trim() || undefined,
		tenant: form.tenant.trim() || 'acme',
		policy_keyword: form.policy_keyword.trim() || 'remote',
		ticket_id: form.ticket_id.trim() || 'INC-1001',
		department: form.department.trim() || 'engineering',
		policy_path: form.policy_path.trim() || defaultConnectorPolicyPath,
		ticket_path: form.ticket_path.trim() || defaultConnectorTicketPath,
		metrics_path: form.metrics_path.trim() || defaultConnectorMetricsPath,
		timeout_seconds: connectorTimeoutFromForm(form),
	};
}
