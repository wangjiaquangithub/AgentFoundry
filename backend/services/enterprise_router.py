"""Service helpers for enterprise agent route normalization."""

import json
import re
from collections.abc import Mapping
from typing import Any

import httpx


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

    def model_router_env_present(self, env: Mapping[str, str]) -> bool:
        return any(
            env.get(name, "").strip()
            for name in (
                "ENTERPRISE_AGENT_ROUTER_BASE_URL",
                "ENTERPRISE_AGENT_ROUTER_API_KEY",
                "ENTERPRISE_AGENT_ROUTER_MODEL",
            )
        )

    def missing_model_router_config_names(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
    ) -> list[str]:
        return [
            name
            for name, value in (
                ("ENTERPRISE_AGENT_ROUTER_BASE_URL", base_url),
                ("ENTERPRISE_AGENT_ROUTER_API_KEY", api_key),
                ("ENTERPRISE_AGENT_ROUTER_MODEL", model),
            )
            if not value
        ]

    def normalize_model_provider(self, provider: str) -> str:
        return provider.strip().lower() or "openai"

    def normalize_model_timeout_seconds(self, timeout_value: str) -> float:
        try:
            return max(1.0, float(timeout_value))
        except ValueError:
            return 8.0

    def build_model_router_config(
        self,
        env: Mapping[str, str],
    ) -> dict[str, Any] | None:
        base_url = env.get("ENTERPRISE_AGENT_ROUTER_BASE_URL", "").strip()
        api_key = env.get("ENTERPRISE_AGENT_ROUTER_API_KEY", "").strip()
        model = env.get("ENTERPRISE_AGENT_ROUTER_MODEL", "").strip()

        if not base_url and not api_key and not model:
            return None

        missing = self.missing_model_router_config_names(
            base_url=base_url,
            api_key=api_key,
            model=model,
        )
        if missing:
            raise EnterpriseRouterError(
                "Router env is incomplete: missing " + ", ".join(missing),
            )

        return {
            "base_url": base_url,
            "api_key": api_key,
            "model": model,
            "provider": self.normalize_model_provider(
                env.get("ENTERPRISE_AGENT_ROUTER_PROVIDER", "openai"),
            ),
            "timeout_seconds": self.normalize_model_timeout_seconds(
                env.get("ENTERPRISE_AGENT_ROUTER_TIMEOUT_SECONDS", "8"),
            ),
        }

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

    def parse_model_response_payload(
        self,
        *,
        provider: str,
        response_payload: dict[str, Any],
    ) -> dict[str, Any]:
        content = self.extract_model_response_content(
            provider=provider,
            response_payload=response_payload,
        )
        if not content:
            raise EnterpriseRouterError("Router response content is empty.")

        return self.parse_model_route_content(content)

    async def route_question_with_model_config(
        self,
        question: str,
        *,
        config: dict[str, Any],
    ) -> dict[str, Any]:
        system_prompt, user_prompt = self.build_model_prompt(question)
        endpoint = self.build_model_endpoint(
            config["base_url"],
            config["provider"],
        )
        headers, payload = self.build_model_request(
            provider=config["provider"],
            api_key=config["api_key"],
            model=config["model"],
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        try:
            async with httpx.AsyncClient(
                timeout=config["timeout_seconds"],
            ) as client:
                response = await client.post(endpoint, headers=headers, json=payload)
                response.raise_for_status()
                response_payload = response.json()
        except httpx.HTTPStatusError as exc:
            raise EnterpriseRouterError(
                f"Router HTTP error: {exc.response.status_code}",
            ) from exc
        except httpx.HTTPError as exc:
            raise EnterpriseRouterError(
                f"Router request failed: {exc.__class__.__name__}",
            ) from exc
        except json.JSONDecodeError as exc:
            raise EnterpriseRouterError("Router HTTP response is not JSON.") from exc

        return self.parse_model_response_payload(
            provider=config["provider"],
            response_payload=response_payload,
        )

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

    def routing_mode_for(self, routes: list[dict[str, Any]]) -> str:
        sources: list[str] = []
        for route in routes:
            source = str(route.get("source", self._default_source))
            if source not in sources:
                sources.append(source)

        return "+".join(sources) if sources else self._default_source

    def routing_state_for(self, routes: list[dict[str, Any]]) -> dict[str, str]:
        routing_mode = self.routing_mode_for(routes)
        return {
            "routing_mode": routing_mode,
            "routing_source": routing_mode,
        }

    def decision_with_routing_context(
        self,
        decision: dict[str, Any],
        *,
        routing_reason: str,
        routing_source: str,
        routing_mode: str,
        routing_error: str | None = None,
    ) -> dict[str, Any]:
        payload = {
            **decision,
            "routing_reason": routing_reason,
            "routing_source": routing_source,
            "routing_mode": routing_mode,
        }
        if routing_error:
            payload["routing_error"] = routing_error

        return payload

    def unrouted_decision_for_question(
        self,
        question: str,
        *,
        routing_source: str,
        routing_mode: str,
        routing_error: str | None = None,
    ) -> dict[str, Any]:
        route = self.primary_rule_route_for_question(question)
        reason = str(route["reason"])
        return self.decision_with_routing_context(
            {"reason": reason},
            routing_reason=reason,
            routing_source=routing_source,
            routing_mode=routing_mode,
            routing_error=routing_error,
        )

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

    def generic_metrics_route_for_question(
        self,
        question: str,
        existing_routes: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        normalized = question.lower()
        has_metrics_route = any(
            route.get("tool_name") == "enterprise_summarize_department_metrics"
            for route in existing_routes
        )
        if (
            has_metrics_route
            or (
                "部门" not in question
                and "指标" not in question
                and "metrics" not in normalized
            )
        ):
            return []

        return [
            {
                "routed": True,
                "tool_name": "enterprise_summarize_department_metrics",
                "inputs": {"department": "engineering"},
                "reason": "Detected a generic department metrics request.",
                "source": self._default_source,
            },
        ]

    def rule_routes_for_question(self, question: str) -> list[dict[str, Any]]:
        routes: list[dict[str, Any]] = []
        routes.extend(self.ticket_routes_for_question(question))
        routes.extend(self.policy_routes_for_question(question))
        routes.extend(self.department_routes_for_question(question))
        routes.extend(self.generic_metrics_route_for_question(question, routes))
        return self.dedupe_routes(routes)

    def merge_model_route_with_rule_routes(
        self,
        *,
        model_route: dict[str, Any],
        rule_routes: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        model_routes = [model_route] if model_route.get("routed") else []
        return self.dedupe_routes(model_routes + rule_routes)

    async def select_routes_for_question(
        self,
        question: str,
        *,
        env: Mapping[str, str],
    ) -> tuple[list[dict[str, Any]], str | None]:
        rule_routes = self.rule_routes_for_question(question)
        if not self.model_router_env_present(env):
            return rule_routes, None

        try:
            config = self.build_model_router_config(env)
            if config is None:
                raise EnterpriseRouterError("Router model is not configured.")

            model_route = await self.route_question_with_model_config(
                question,
                config=config,
            )
        except EnterpriseRouterError as exc:
            return rule_routes, str(exc)

        return (
            self.merge_model_route_with_rule_routes(
                model_route=model_route,
                rule_routes=rule_routes,
            ),
            None,
        )

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

    def primary_rule_route_for_question(self, question: str) -> dict[str, Any]:
        return self.primary_route_or_fallback(
            self.rule_routes_for_question(question),
        )
