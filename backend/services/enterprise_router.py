"""Service helpers for enterprise agent route normalization."""

from typing import Any


class PlatformEnterpriseRouterService:
    """Normalize and deduplicate enterprise agent tool routes."""

    def __init__(
        self,
        *,
        tool_names: set[str],
        tool_input_fields: dict[str, str],
        default_source: str,
    ) -> None:
        self._tool_names = tool_names
        self._tool_input_fields = tool_input_fields
        self._default_source = default_source

    def dedupe_routes(
        self,
        routes: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        deduped: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()

        for route in routes:
            if not route.get("routed"):
                continue

            tool_name = str(route.get("tool_name", "")).strip()
            if tool_name not in self._tool_names:
                continue

            raw_inputs = route.get("inputs")
            if not isinstance(raw_inputs, dict):
                continue

            input_field = self._tool_input_fields[tool_name]
            input_value = str(raw_inputs.get(input_field, "")).strip()
            if not input_value:
                continue

            dedupe_key = (tool_name, input_value.lower())
            if dedupe_key in seen:
                continue

            seen.add(dedupe_key)
            deduped.append(
                {
                    "routed": True,
                    "tool_name": tool_name,
                    "inputs": {input_field: input_value},
                    "reason": str(
                        route.get("reason") or "Matched enterprise tool route.",
                    ),
                    "source": str(route.get("source", self._default_source)),
                },
            )

        return deduped
