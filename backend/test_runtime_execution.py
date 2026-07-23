"""Minimal tests for explicit Agent runtime execution selection."""

import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from api.schemas import EnterpriseAgentPublishRequest
from runtime import (
    AGENTSCOPE_PLATFORM_ADAPTER,
    AGENTSCOPE_NATIVE_EXECUTION_MODE,
    FOUNDRY_COMPATIBILITY_EXECUTION_MODE,
    FoundryCompatibilityRuntimeAdapter,
    RuntimeGateway,
    RuntimeGatewayError,
    resolve_runtime_execution_selection,
)
from backend.persistence.database import create_sqlite_database
from backend.persistence.migrations import apply_migrations
from backend.persistence.runtime_bindings import RuntimeBindingRecord, RuntimeBindingRepository
from services.agents import PlatformAgentService, PlatformAgentServiceError


class RuntimeExecutionSelectionTest(unittest.TestCase):
    def test_legacy_agent_template_does_not_implicitly_select_agentscope(self) -> None:
        selection = resolve_runtime_execution_selection(
            {"template_id": "weather_forecast_assistant"},
        )

        self.assertEqual(
            selection.execution_mode,
            FOUNDRY_COMPATIBILITY_EXECUTION_MODE,
        )
        self.assertEqual(selection.runtime_provider, "local-dev-runtime")

    def test_explicit_native_mode_selects_agentscope(self) -> None:
        selection = resolve_runtime_execution_selection(
            {
                "template_id": "any_template",
                "execution_mode": "agentscope_native",
                "runtime_provider": "agentscope",
            },
        )

        self.assertEqual(selection.execution_mode, AGENTSCOPE_NATIVE_EXECUTION_MODE)
        self.assertEqual(selection.runtime_provider, "agentscope")

    def test_new_agent_schema_defaults_to_compatibility_runtime(self) -> None:
        request = EnterpriseAgentPublishRequest(template_id="any_template")

        self.assertEqual(request.execution_mode, FOUNDRY_COMPATIBILITY_EXECUTION_MODE)
        self.assertEqual(request.runtime_provider, "local-dev-runtime")

    def test_runtime_config_requires_supported_mode_and_provider(self) -> None:
        self.assertEqual(
            PlatformAgentService.validate_runtime_execution_config(
                execution_mode=" agentscope_native ",
                runtime_provider=" agentscope ",
            ),
            ("agentscope_native", "agentscope"),
        )
        with self.assertRaises(PlatformAgentServiceError):
            PlatformAgentService.validate_runtime_execution_config(
                execution_mode="template_selected",
                runtime_provider="agentscope",
            )
        with self.assertRaises(PlatformAgentServiceError):
            PlatformAgentService.validate_runtime_execution_config(
                execution_mode="foundry_compatibility",
                runtime_provider=" ",
            )

    def test_gateway_routes_only_explicit_registered_providers(self) -> None:
        native_adapter = replace(AGENTSCOPE_PLATFORM_ADAPTER, provider_client=None)
        gateway = RuntimeGateway(
            {
                "agentscope": native_adapter,
                "local-dev-runtime": FoundryCompatibilityRuntimeAdapter(),
            },
        )

        self.assertIs(
            gateway.adapter_for(
                {
                    "execution_mode": "agentscope_native",
                    "runtime_provider": "agentscope",
                },
            ),
            native_adapter,
        )
        compatibility = gateway.describe(
            {
                "execution_mode": "foundry_compatibility",
                "runtime_provider": "local-dev-runtime",
                "fallback_reason": "Migration window remains open.",
            },
        )
        self.assertEqual(compatibility["fallback_reason"], "Migration window remains open.")
        with self.assertRaises(RuntimeGatewayError):
            gateway.adapter_for(
                {
                    "execution_mode": "agentscope_native",
                    "runtime_provider": "missing-provider",
                },
            )

    def test_unknown_binding_mode_fails_explicitly(self) -> None:
        with self.assertRaises(ValueError):
            resolve_runtime_execution_selection(
                {
                    "runtime_binding": {
                        "execution_mode": "template_selected",
                        "runtime_provider": "agentscope",
                    },
                },
            )

    def test_runtime_binding_repository_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            database_url = f"sqlite:///{Path(temp_dir) / 'runtime.db'}"
            apply_migrations(database_url)
            repository = RuntimeBindingRepository(create_sqlite_database(database_url))
            record = RuntimeBindingRecord(
                foundry_agent_id="agent-1",
                foundry_version_id="version-1",
                tenant_id="tenant-1",
                execution_mode="agentscope_native",
                runtime_provider="agentscope",
                scope_application_id="application-1",
                scope_agent_id="scope-agent-1",
                scope_version="1",
                scope_type="react",
                status="active",
                fallback_reason=None,
                last_event_cursor="event-1",
                created_at="2026-07-23T00:00:00Z",
                updated_at="2026-07-23T00:00:00Z",
            )

            self.assertEqual(repository.upsert(record), record)
            self.assertEqual(
                repository.get(tenant_id="tenant-1", foundry_version_id="version-1"),
                record,
            )


if __name__ == "__main__":
    unittest.main()
