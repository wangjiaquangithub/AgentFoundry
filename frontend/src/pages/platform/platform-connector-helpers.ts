import type {
	EnterpriseConnectorConfigSaveRequest,
	EnterpriseConnectorConfigSaveResponse,
	EnterpriseConnectorSavedConfig,
	EnterpriseConnectorTestRequest,
	EnterpriseConnectorTestResponse,
	EnterprisePlatformConnectorsResponse,
} from '@/api';
import type { ConnectorTestFormState } from './platform-defaults';

const defaultConnectorPolicyPath = '/tenants/{tenant}/policies/search';
const defaultConnectorTicketPath = '/tenants/{tenant}/tickets/{ticket_id}';
const defaultConnectorMetricsPath =
	'/tenants/{tenant}/departments/{department}/metrics';

export type ConnectorSavedConfigLoadActionHandlers = {
	setConnectorTestForm: (
		update: (previous: ConnectorTestFormState) => ConnectorTestFormState,
	) => void;
	setConnectorTestResult: (result: EnterpriseConnectorTestResponse | null) => void;
	setConnectorTestError: (error: string | null) => void;
	setConnectorSaveError: (error: string | null) => void;
	setConnectorSaveSuccess: (message: string | null) => void;
};

export type ConnectorTestActionHandlers = {
	setTestingConnector: (testing: boolean) => void;
	clearError: () => void;
	handleValidationError: (error: string) => void;
	testConnector: (
		payload: EnterpriseConnectorTestRequest,
	) => EnterpriseConnectorTestResponse | Promise<EnterpriseConnectorTestResponse>;
	setConnectorTestResult: (result: EnterpriseConnectorTestResponse) => void;
	handleError: (error: unknown) => void;
};

export type ConnectorSaveActionHandlers = {
	setSavingConnectorConfig: (saving: boolean) => void;
	clearMessages: () => void;
	handleValidationError: (error: string) => void;
	saveConnectorConfig: (
		payload: EnterpriseConnectorConfigSaveRequest,
	) =>
		| EnterpriseConnectorConfigSaveResponse
		| Promise<EnterpriseConnectorConfigSaveResponse>;
	setConnectors: (
		update: (
			previous: EnterprisePlatformConnectorsResponse | null,
		) => EnterprisePlatformConnectorsResponse | null,
	) => void;
	setConnectorTestForm: (
		update: (previous: ConnectorTestFormState) => ConnectorTestFormState,
	) => void;
	setConnectorSaveSuccess: (message: string) => void;
	saveSuccessMessage: (tenant: string) => string;
	refreshDependentViews: () => void | Promise<void>;
	handleError: (error: unknown) => void;
};

function connectorTimeoutFromForm(form: ConnectorTestFormState) {
	const timeout = Number.parseFloat(form.timeout_seconds);

	return Number.isFinite(timeout) && timeout > 0 ? timeout : 5;
}

export function connectorBaseUrlFromForm(
	form: ConnectorTestFormState,
): string {
	return form.base_url.trim();
}

export function connectorDraftValidationError(values: {
	baseUrl: string;
	draftIssues: string[];
	baseUrlRequiredMessage: string;
}): string | null {
	if (!values.baseUrl) {
		return values.baseUrlRequiredMessage;
	}

	return values.draftIssues[0] || null;
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

export function connectorFormWithPlatformDefaults(values: {
	current: ConnectorTestFormState;
	connectors: EnterprisePlatformConnectorsResponse;
}): ConnectorTestFormState {
	const { current, connectors } = values;
	const savedConfig = connectors.saved_configs[0];

	return {
		...current,
		base_url: savedConfig?.base_url || current.base_url,
		token: '',
		tenant:
			savedConfig?.tenant ||
			connectors.identities[0]?.tenant ||
			current.tenant ||
			'acme',
		policy_path:
			savedConfig?.policy_path ||
			connectors.http_paths.policy ||
			current.policy_path ||
			defaultConnectorPolicyPath,
		ticket_path:
			savedConfig?.ticket_path ||
			connectors.http_paths.ticket ||
			current.ticket_path ||
			defaultConnectorTicketPath,
		metrics_path:
			savedConfig?.metrics_path ||
			connectors.http_paths.metrics ||
			current.metrics_path ||
			defaultConnectorMetricsPath,
		timeout_seconds: savedConfig
			? String(savedConfig.timeout_seconds)
			: current.timeout_seconds,
		enabled: savedConfig?.enabled ?? current.enabled,
	};
}

export function connectorsWithSavedConfigs(
	current: EnterprisePlatformConnectorsResponse | null,
	savedConfigs: EnterprisePlatformConnectorsResponse['saved_configs'],
) {
	return current
		? {
				...current,
				saved_configs: savedConfigs,
			}
		: current;
}

export function connectorFormWithoutToken(
	form: ConnectorTestFormState,
): ConnectorTestFormState {
	return {
		...form,
		token: '',
	};
}

export function runConnectorSavedConfigLoadAction(
	config: EnterpriseConnectorSavedConfig,
	handlers: ConnectorSavedConfigLoadActionHandlers,
) {
	handlers.setConnectorTestForm((previous) =>
		connectorFormPatchFromSavedConfig(previous, config),
	);
	handlers.setConnectorTestResult(null);
	handlers.setConnectorTestError(null);
	handlers.setConnectorSaveError(null);
	handlers.setConnectorSaveSuccess(null);
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

export async function runConnectorTestAction(
	values: {
		form: ConnectorTestFormState;
		draftIssues: string[];
		baseUrlRequiredMessage: string;
	},
	handlers: ConnectorTestActionHandlers,
): Promise<EnterpriseConnectorTestResponse | null> {
	const baseUrl = connectorBaseUrlFromForm(values.form);
	const validationError = connectorDraftValidationError({
		baseUrl,
		draftIssues: values.draftIssues,
		baseUrlRequiredMessage: values.baseUrlRequiredMessage,
	});
	if (validationError) {
		handlers.handleValidationError(validationError);
		return null;
	}

	handlers.setTestingConnector(true);
	handlers.clearError();
	try {
		const response = await handlers.testConnector(
			connectorTestPayloadFromForm(values.form, baseUrl),
		);
		handlers.setConnectorTestResult(response);
		return response;
	} catch (error) {
		handlers.handleError(error);
		return null;
	} finally {
		handlers.setTestingConnector(false);
	}
}

export async function runConnectorSaveAction(
	values: {
		form: ConnectorTestFormState;
		draftIssues: string[];
		baseUrlRequiredMessage: string;
	},
	handlers: ConnectorSaveActionHandlers,
) {
	const baseUrl = connectorBaseUrlFromForm(values.form);
	const validationError = connectorDraftValidationError({
		baseUrl,
		draftIssues: values.draftIssues,
		baseUrlRequiredMessage: values.baseUrlRequiredMessage,
	});
	if (validationError) {
		handlers.handleValidationError(validationError);
		return;
	}

	handlers.setSavingConnectorConfig(true);
	handlers.clearMessages();
	try {
		const response = await handlers.saveConnectorConfig(
			connectorSavePayloadFromForm(values.form, baseUrl),
		);
		handlers.setConnectors((previous) =>
			connectorsWithSavedConfigs(previous, response.saved_configs),
		);
		handlers.setConnectorTestForm(connectorFormWithoutToken);
		handlers.setConnectorSaveSuccess(
			handlers.saveSuccessMessage(response.config.tenant),
		);
		await handlers.refreshDependentViews();
	} catch (error) {
		handlers.handleError(error);
	} finally {
		handlers.setSavingConnectorConfig(false);
	}
}
