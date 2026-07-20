"""Service helpers for enterprise agent route normalization."""

import json
from typing import Any


class EnterpriseRouterError(Exception):
    """Raised when enterprise model routing cannot produce a valid route."""


class PlatformEnterpriseRouterService:
    """Normalize and deduplicate enterprise agent tool routes."""

    def __init__(
        self,
        *,
        tool_names: set[str],
        tool_input_fields: dict[str, str],
        default_source: str,
        model_source: str,
    ) -> None:
        self._tool_names = tool_names
        self._tool_input_fields = tool_input_fields
        self._default_source = default_source
        self._model_source = model_source

    def parse_model_route_content(self, content: str) -> dict[str, Any]:
        return self.normalize_model_route(self.parse_router_json(content))

    def parse_router_json(self, content: str) -> dict[str, Any]:
        text = content.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise EnterpriseRouterError("Router response is not valid JSON.")
            try:
                data = json.loads(text[start : end + 1])
            except json.JSONDecodeError as exc:
                raise EnterpriseRouterError(
                    "Router response is not valid JSON.",
                ) from exc

        if not isinstance(data, dict):
            raise EnterpriseRouterError("Router JSON must be an object.")
        return data

    def normalize_model_route(self, data: dict[str, Any]) -> dict[str, Any]:
        routed = bool(data.get("routed"))
        reason = str(data.get("reason") or "Model router decision.").strip()

        if not routed:
            return {
                "routed": False,
                "reason": reason,
                "source": self._model_source,
            }

        tool_name = str(data.get("tool_name", "")).strip()
        if tool_name not in self._tool_names:
            raise EnterpriseRouterError(
                f"Router selected unsupported tool: {tool_name or '<empty>'}",
            )

        raw_inputs = data.get("inputs")
        if not isinstance(raw_inputs, dict):
            raise EnterpriseRouterError("Router inputs must be a JSON object.")

        input_field = self._tool_input_fields[tool_name]
        input_value = str(raw_inputs.get(input_field, "")).strip()
        if not input_value:
            raise EnterpriseRouterError(
                f"Router omitted required input: {input_field}",
            )

        return {
            "routed": True,
            "tool_name": tool_name,
            "inputs": {input_field: input_value},
            "reason": reason,
            "source": self._model_source,
        }

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
