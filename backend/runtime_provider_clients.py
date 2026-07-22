"""Provider-native runtime invocation clients.

This module stays behind ``backend.runtime.RuntimeProviderInvocationClient``.
It does not import AgentScope or store secrets; callers provide a resolver for
runtime auth references when a concrete deployment is ready to send requests.
"""

from __future__ import annotations

import asyncio
import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, Mapping, Protocol


SecretResolver = Callable[[str], str | None]


@dataclass(frozen=True)
class HttpInvocationResponse:
    """HTTP response returned by the injectable transport."""

    status_code: int
    body: bytes
    headers: Mapping[str, str] | None = None


class HttpInvocationTransport(Protocol):
    """Synchronous transport used by the async client through ``to_thread``."""

    def __call__(
        self,
        *,
        url: str,
        body: bytes,
        headers: Mapping[str, str],
        timeout_seconds: float,
    ) -> HttpInvocationResponse:
        """Send a provider invocation request."""
        ...


class AgentScopeProviderHttpInvocationClient:
    """Invoke AgentScope's provider-native runtime over HTTP."""

    def __init__(
        self,
        *,
        secret_resolver: SecretResolver | None = None,
        transport: HttpInvocationTransport | None = None,
        timeout_seconds: float = 30.0,
        invocation_path: str = "/invoke",
    ) -> None:
        self._secret_resolver = secret_resolver
        self._transport = transport or _urllib_transport
        self._timeout_seconds = timeout_seconds
        self._invocation_path = invocation_path

    async def invoke(self, envelope: Mapping[str, Any]) -> Mapping[str, Any]:
        """POST the platform-owned envelope to the configured provider endpoint."""
        endpoint = _required_text(envelope, "endpoint")
        auth_ref = _required_text(envelope, "auth_ref")
        token = self._resolve_token(auth_ref)
        url = _invocation_url(endpoint, self._invocation_path)
        body = json.dumps(envelope, separators=(",", ":"), sort_keys=True).encode(
            "utf-8",
        )
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"

        try:
            response = await asyncio.to_thread(
                self._transport,
                url=url,
                body=body,
                headers=headers,
                timeout_seconds=self._timeout_seconds,
            )
        except urllib.error.HTTPError as exc:
            response_body = exc.read()
            return _failed_response(
                message=f"AgentScope runtime HTTP request failed with status {exc.code}.",
                status_code=exc.code,
                response_body=response_body,
                secrets=(auth_ref, token),
            )
        except urllib.error.URLError as exc:
            return _failed_response(
                message="AgentScope runtime HTTP request failed.",
                response_body=str(exc.reason).encode("utf-8"),
                secrets=(auth_ref, token),
            )
        except Exception as exc:  # noqa: BLE001 - provider boundary must normalize.
            return _failed_response(
                message="AgentScope runtime HTTP request failed.",
                response_body=str(exc).encode("utf-8"),
                secrets=(auth_ref, token),
            )

        return _provider_response_from_http_response(
            response,
            secrets=(auth_ref, token),
        )

    def _resolve_token(self, auth_ref: str) -> str | None:
        if self._secret_resolver is None:
            return None
        token = self._secret_resolver(auth_ref)
        if token is None:
            return None
        token_text = str(token).strip()
        return token_text or None


def _urllib_transport(
    *,
    url: str,
    body: bytes,
    headers: Mapping[str, str],
    timeout_seconds: float,
) -> HttpInvocationResponse:
    request = urllib.request.Request(
        url,
        data=body,
        headers=dict(headers),
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        return HttpInvocationResponse(
            status_code=response.status,
            body=response.read(),
            headers=dict(response.headers.items()),
        )


def _provider_response_from_http_response(
    response: HttpInvocationResponse,
    *,
    secrets: tuple[str | None, ...],
) -> Mapping[str, Any]:
    payload = _decode_json_response(response.body, secrets=secrets)
    if not isinstance(payload, Mapping):
        return _failed_response(
            message="AgentScope runtime HTTP response must be a JSON object.",
            status_code=response.status_code,
            response_body=response.body,
            secrets=secrets,
        )
    sanitized = _sanitize(payload, secrets=secrets)
    if response.status_code < 200 or response.status_code >= 300:
        error = sanitized.get("error")
        return {
            "answer": str(sanitized.get("answer") or ""),
            "status": "failed",
            "error": (
                str(error).strip()
                if error
                else f"AgentScope runtime HTTP request failed with status {response.status_code}."
            ),
            "raw": {
                "http_status": response.status_code,
                "response": dict(sanitized),
            },
        }
    return dict(sanitized)


def _decode_json_response(
    body: bytes,
    *,
    secrets: tuple[str | None, ...],
) -> Any:
    text = body.decode("utf-8", errors="replace")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "status": "failed",
            "error": "AgentScope runtime HTTP response was not valid JSON.",
            "raw": {"response_text": _sanitize(text, secrets=secrets)},
        }


def _failed_response(
    *,
    message: str,
    status_code: int | None = None,
    response_body: bytes | None = None,
    secrets: tuple[str | None, ...],
) -> Mapping[str, Any]:
    raw: dict[str, Any] = {}
    if status_code is not None:
        raw["http_status"] = status_code
    if response_body:
        raw["response_text"] = _sanitize(
            response_body.decode("utf-8", errors="replace"),
            secrets=secrets,
        )
    return {
        "answer": "",
        "status": "failed",
        "error": message,
        "raw": raw,
    }


def _invocation_url(endpoint: str, invocation_path: str) -> str:
    parsed = urllib.parse.urlparse(endpoint)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("AgentScope runtime endpoint must be an HTTP(S) URL.")
    if parsed.path and parsed.path != "/":
        return endpoint
    path = invocation_path if invocation_path.startswith("/") else f"/{invocation_path}"
    return urllib.parse.urlunparse(parsed._replace(path=path))


def _required_text(payload: Mapping[str, Any], field: str) -> str:
    value = payload.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Provider invocation envelope requires {field}.")
    return value.strip()


def _sanitize(value: Any, *, secrets: tuple[str | None, ...]) -> Any:
    redactions = tuple(secret for secret in secrets if secret)
    if isinstance(value, str):
        sanitized = value
        for secret in redactions:
            sanitized = sanitized.replace(secret, "<redacted>")
        return sanitized
    if isinstance(value, Mapping):
        return {
            str(key): _sanitize(item, secrets=secrets)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_sanitize(item, secrets=secrets) for item in value]
    if isinstance(value, tuple):
        return tuple(_sanitize(item, secrets=secrets) for item in value)
    return value
