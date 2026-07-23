"""Canonical request identity access for authenticated API routes."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, Request


_MISSING = object()


@dataclass(frozen=True)
class RequestIdentity:
    """Identity context normalized by request authentication middleware."""

    user_id: str | None
    tenant_id: str | None
    authenticated: bool
    source: str


def get_request_identity(request: Request) -> RequestIdentity:
    """Return canonical middleware identity state, failing closed when absent."""

    state = request.state
    user_id = getattr(state, "authenticated_user_id", _MISSING)
    tenant_id = getattr(state, "authenticated_tenant_id", _MISSING)
    authenticated = getattr(state, "identity_authenticated", _MISSING)
    source = getattr(state, "identity_source", _MISSING)

    if (
        user_id is _MISSING
        or tenant_id is _MISSING
        or authenticated is _MISSING
        or source is _MISSING
        or (user_id is not None and not isinstance(user_id, str))
        or (tenant_id is not None and not isinstance(tenant_id, str))
        or not isinstance(authenticated, bool)
        or not isinstance(source, str)
        or not source
    ):
        raise HTTPException(
            status_code=401,
            detail="request identity context is unavailable",
        )

    return RequestIdentity(
        user_id=user_id,
        tenant_id=tenant_id,
        authenticated=authenticated,
        source=source,
    )
