"""Minimal tests for explicit Agent runtime execution selection."""

import unittest

from api.schemas import EnterpriseAgentPublishRequest
from runtime import (
    AGENTSCOPE_NATIVE_EXECUTION_MODE,
    FOUNDRY_COMPATIBILITY_EXECUTION_MODE,
    resolve_runtime_execution_selection,
)
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


if __name__ == "__main__":
    unittest.main()
