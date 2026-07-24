"""Trusted-proxy request identity authentication for production traffic."""

from __future__ import annotations

import hashlib
import hmac
import re
import time
from dataclasses import dataclass
from typing import Any, Callable, Mapping

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


USER_ID_HEADER = "X-User-ID"
TENANT_ID_HEADER = "X-Tenant-ID"
IDENTITY_TIMESTAMP_HEADER = "X-AgentFoundry-Identity-Timestamp"
IDENTITY_SIGNATURE_HEADER = "X-AgentFoundry-Identity-Signature"
IDENTITY_SIGNATURE_VERSION = "v1"
MAX_IDENTITY_AGE_SECONDS = 300
AUTHENTICATION_EXEMPT_PATHS = frozenset({"/health", "/ready"})
ANONYMOUS_AUTHENTICATION_PATHS = frozenset({"/api/auth/login"})
DEFAULT_SESSION_COOKIE_NAME = "agentfoundry_session"
VALID_USER_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$")
VALID_TENANT_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
VALID_SIGNATURE = re.compile(r"^[0-9a-f]{64}$")


class RequestAuthenticationError(ValueError):
    """Raised when a production request has no trusted proxy identity."""


@dataclass(frozen=True)
class AuthenticatedRequestIdentity:
    """Canonical identity asserted by the trusted ingress proxy."""

    user_id: str
    tenant_id: str | None


def build_identity_signature(
    *,
    shared_secret: str,
    timestamp: str,
    user_id: str,
    tenant_id: str | None,
) -> str:
    """Build the canonical HMAC-SHA256 identity signature."""

    payload = "\n".join(
        (
            IDENTITY_SIGNATURE_VERSION,
            timestamp,
            user_id,
            tenant_id or "",
        )
    )
    return hmac.new(
        shared_secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def authenticate_proxy_identity(
    headers: Mapping[str, str],
    *,
    shared_secret: str,
    now: float | None = None,
) -> AuthenticatedRequestIdentity:
    """Validate a fresh, signed identity assertion from the ingress proxy."""

    user_id = str(headers.get(USER_ID_HEADER) or "")
    tenant_id = str(headers.get(TENANT_ID_HEADER) or "")
    timestamp = str(headers.get(IDENTITY_TIMESTAMP_HEADER) or "")
    signature = str(headers.get(IDENTITY_SIGNATURE_HEADER) or "").lower()

    if not shared_secret:
        raise RequestAuthenticationError("identity proxy secret is not configured")
    if not VALID_USER_ID.fullmatch(user_id):
        raise RequestAuthenticationError("user identity is missing or invalid")
    if tenant_id and not VALID_TENANT_ID.fullmatch(tenant_id):
        raise RequestAuthenticationError("tenant identity is invalid")
    if not timestamp.isdigit():
        raise RequestAuthenticationError("identity timestamp is missing or invalid")
    if not VALID_SIGNATURE.fullmatch(signature):
        raise RequestAuthenticationError("identity signature is missing or invalid")

    current_time = time.time() if now is None else now
    if abs(current_time - int(timestamp)) > MAX_IDENTITY_AGE_SECONDS:
        raise RequestAuthenticationError("identity assertion is expired")

    expected_signature = build_identity_signature(
        shared_secret=shared_secret,
        timestamp=timestamp,
        user_id=user_id,
        tenant_id=tenant_id or None,
    )
    if not hmac.compare_digest(signature, expected_signature):
        raise RequestAuthenticationError("identity signature does not match")

    return AuthenticatedRequestIdentity(
        user_id=user_id,
        tenant_id=tenant_id or None,
    )


class RequestIdentityAuthenticationMiddleware(BaseHTTPMiddleware):
    """Require signed proxy identity headers for production API requests."""

    def __init__(
        self,
        app: Any,
        *,
        production_mode: bool,
        shared_secret: str | None,
        local_authentication_service: Callable[[], Any | None] | None = None,
        session_cookie_name: str = DEFAULT_SESSION_COOKIE_NAME,
    ) -> None:
        super().__init__(app)
        self.production_mode = production_mode
        self.shared_secret = shared_secret or ""
        self.local_authentication_service = local_authentication_service
        self.session_cookie_name = session_cookie_name

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        normalized_path = request.url.path.rstrip("/") or "/"
        if normalized_path in AUTHENTICATION_EXEMPT_PATHS:
            self._set_request_identity_state(request, source="probe_exempt")
            return await call_next(request)

        token = request.cookies.get(self.session_cookie_name, "")
        if token and self.local_authentication_service is not None:
            service = self.local_authentication_service()
            identity = service.resolve_session(token) if service is not None else None
            if identity is not None:
                self._set_request_identity_state(
                    request,
                    user_id=identity["user_id"],
                    tenant_id=identity["tenant_id"],
                    authenticated=True,
                    source="local_cookie_session",
                )
                request.state.login_session = identity
                return await call_next(request)

        if normalized_path in ANONYMOUS_AUTHENTICATION_PATHS:
            self._set_request_identity_state(request, source="anonymous_authentication")
            return await call_next(request)

        if not self.production_mode:
            user_id = request.headers.get(USER_ID_HEADER)
            self._set_request_identity_state(
                request,
                user_id=user_id,
                tenant_id=request.headers.get(TENANT_ID_HEADER),
                authenticated=bool(user_id),
                source="development_headers",
            )
            return await call_next(request)

        try:
            identity = authenticate_proxy_identity(
                request.headers,
                shared_secret=self.shared_secret,
            )
        except RequestAuthenticationError:
            self._set_request_identity_state(request, source="rejected")
            return JSONResponse(
                {"detail": "request identity authentication failed"},
                status_code=401,
            )

        self._set_request_identity_state(
            request,
            user_id=identity.user_id,
            tenant_id=identity.tenant_id,
            authenticated=True,
            source="trusted_proxy_hmac",
        )
        return await call_next(request)

    @staticmethod
    def _set_request_identity_state(
        request: Request,
        *,
        user_id: str | None = None,
        tenant_id: str | None = None,
        authenticated: bool = False,
        source: str,
    ) -> None:
        request.state.identity_authenticated = authenticated
        request.state.authenticated_user_id = user_id
        request.state.authenticated_tenant_id = tenant_id
        request.state.identity_source = source
