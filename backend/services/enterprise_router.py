"""Service helpers for enterprise agent route normalization."""

import json
import re
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

    def build_model_prompt(self, question: str) -> tuple[str, str]:
        tool_schema = {
            "enterprise_lookup_policy": {
                "description": "Query tenant policy snippets.",
                "inputs": {"keyword": "remote | expense | security"},
            },
            "enterprise_get_ticket_status": {
                "description": "Query a tenant ticket by id.",
                "inputs": {"ticket_id": "INC-1001"},
            },
            "enterprise_summarize_department_metrics": {
                "description": "Summarize tenant department metrics.",
                "inputs": {"department": "engineering | support | sales"},
            },
        }
        system_prompt = (
            "You route one enterprise business question to one allowed read-only "
            "tool. Return strict JSON only. Do not explain outside JSON. "
            "Allowed tools and inputs: "
            f"{json.dumps(tool_schema, ensure_ascii=False)}. "
            "If no tool fits, return "
            '{"routed": false, "reason": "why no tool fits", "source": "model"}. '
            "If a tool fits, return "
            '{"routed": true, "tool_name": "enterprise_get_ticket_status", '
            '"inputs": {"ticket_id": "INC-1001"}, '
            '"reason": "why this tool fits", "source": "model"}.'
        )
        user_prompt = f"Business question:\n{question}\n\nReturn JSON only."
        return system_prompt, user_prompt

    def build_model_endpoint(self, base_url: str, provider: str) -> str:
        normalized = base_url.rstrip("/")
        if provider == "anthropic":
            if normalized.endswith("/v1/messages") or normalized.endswith("/messages"):
                return normalized
            if normalized.endswith("/v1"):
                return f"{normalized}/messages"
            return f"{normalized}/v1/messages"

        if normalized.endswith("/v1/chat/completions") or normalized.endswith(
            "/chat/completions",
        ):
            return normalized
        if normalized.endswith("/v1"):
            return f"{normalized}/chat/completions"
        return f"{normalized}/v1/chat/completions"

    def build_model_request(
        self,
        *,
        provider: str,
        api_key: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
    ) -> tuple[dict[str, str], dict[str, Any]]:
        if provider == "anthropic":
            return (
                {
                    "content-type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
                {
                    "model": model,
                    "max_tokens": 500,
                    "temperature": 0,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                },
            )

        return (
            {
                "authorization": f"Bearer {api_key}",
                "content-type": "application/json",
            },
            {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0,
                "max_tokens": 500,
            },
        )

    def parse_model_route_content(self, content: str) -> dict[str, Any]:
        return self.normalize_model_route(self.parse_router_json(content))

    def extract_model_response_content(
        self,
        *,
        provider: str,
        response_payload: dict[str, Any],
    ) -> str:
        if provider == "anthropic":
            content_blocks = response_payload.get("content")
            if not isinstance(content_blocks, list):
                raise EnterpriseRouterError("Router response is missing content.")
            return "\n".join(
                str(block.get("text", ""))
                for block in content_blocks
                if isinstance(block, dict)
            ).strip()

        choices = response_payload.get("choices")
        if not isinstance(choices, list) or not choices:
            raise EnterpriseRouterError("Router response is missing choices.")
        message = choices[0].get("message")
        if not isinstance(message, dict):
            raise EnterpriseRouterError("Router response is missing message.")
        return str(message.get("content", "")).strip()

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

    def ticket_routes_for_question(self, question: str) -> list[dict[str, Any]]:
        return [
            {
                "routed": True,
                "tool_name": "enterprise_get_ticket_status",
                "inputs": {"ticket_id": ticket_id},
                "reason": "Detected a ticket id in the question.",
                "source": self._default_source,
            }
            for ticket_id in re.findall(r"\b[A-Z]{2,5}-\d+\b", question.upper())
        ]

    def policy_routes_for_question(self, question: str) -> list[dict[str, Any]]:
        normalized = question.lower()
        policy_keywords = {
            "remote": ("remote", "Remote-work policy request."),
            "远程": ("remote", "Detected a remote-work policy request."),
            "办公": ("remote", "Detected an office or remote-work policy request."),
            "expense": ("expense", "Detected an expense policy request."),
            "报销": ("expense", "Detected an expense policy request."),
            "费用": ("expense", "Detected an expense policy request."),
            "security": ("security", "Detected a security policy request."),
            "安全": ("security", "Detected a security policy request."),
            "policy": ("remote", "Detected a policy request."),
            "制度": ("remote", "Detected a policy request."),
        }

        return [
            {
                "routed": True,
                "tool_name": "enterprise_lookup_policy",
                "inputs": {"keyword": keyword},
                "reason": reason,
                "source": self._default_source,
            }
            for marker, (keyword, reason) in policy_keywords.items()
            if marker in normalized or marker in question
        ]

    def department_routes_for_question(self, question: str) -> list[dict[str, Any]]:
        normalized = question.lower()
        department_keywords = {
            "engineering": ("engineering", "Detected engineering metrics request."),
            "工程": ("engineering", "Detected engineering metrics request."),
            "研发": ("engineering", "Detected engineering metrics request."),
            "support": ("support", "Detected support metrics request."),
            "客服": ("support", "Detected support metrics request."),
            "支持": ("support", "Detected support metrics request."),
            "sales": ("sales", "Detected sales metrics request."),
            "销售": ("sales", "Detected sales metrics request."),
        }

        return [
            {
                "routed": True,
                "tool_name": "enterprise_summarize_department_metrics",
                "inputs": {"department": department},
                "reason": reason,
                "source": self._default_source,
            }
            for marker, (department, reason) in department_keywords.items()
            if marker in normalized or marker in question
        ]

    def fallback_route(self) -> dict[str, Any]:
        return {
            "routed": False,
            "reason": (
                "No demo route matched. Try a ticket id, a policy keyword, "
                "or a department metrics request."
            ),
            "source": self._default_source,
        }

    def primary_route_or_fallback(
        self,
        routes: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if routes:
            return routes[0]

        return self.fallback_route()
