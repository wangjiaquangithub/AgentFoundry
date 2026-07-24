"""Local account login and revocable HttpOnly cookie sessions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, NoReturn

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from api.request_authentication import DEFAULT_SESSION_COOKIE_NAME
from api.request_identity import get_request_identity
from services.local_authentication import LocalAuthenticationError, LocalAuthenticationService


class LoginRequest(BaseModel):
    tenant_id: str = Field(min_length=1, max_length=64)
    identifier: str = Field(min_length=1, max_length=320)
    password: str = Field(min_length=1, max_length=256)


@dataclass(frozen=True)
class AuthenticationRouteDependencies:
    service: Callable[[], LocalAuthenticationService | None]
    production_mode: bool
    cookie_name: str = DEFAULT_SESSION_COOKIE_NAME


def _raise(exc: LocalAuthenticationError) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _public_identity(identity: dict[str, object]) -> dict[str, object]:
    return {key: identity.get(key) for key in (
        "user_id", "tenant_id", "membership_id", "display_name", "email", "role", "expires_at"
    )}


def create_authentication_router(deps: AuthenticationRouteDependencies) -> APIRouter:
    router = APIRouter(prefix="/api/auth", tags=["authentication"])

    def service() -> LocalAuthenticationService:
        instance = deps.service()
        if instance is None:
            raise HTTPException(status_code=503, detail="local account authentication is unavailable")
        return instance

    @router.post("/login")
    def login(payload: LoginRequest, response: Response) -> dict[str, object]:
        authentication = service()
        try:
            identity = authentication.authenticate(**payload.model_dump())
            token, session = authentication.create_session(identity)
        except LocalAuthenticationError as exc:
            _raise(exc)
        response.set_cookie(
            key=deps.cookie_name,
            value=token,
            max_age=authentication.session_lifetime_seconds,
            httponly=True,
            secure=deps.production_mode,
            samesite="lax",
            path="/",
        )
        return _public_identity(session)

    @router.post("/logout", status_code=204)
    def logout(request: Request, response: Response) -> Response:
        authentication = service()
        authentication.revoke_session(request.cookies.get(deps.cookie_name, ""))
        response.delete_cookie(
            key=deps.cookie_name,
            httponly=True,
            secure=deps.production_mode,
            samesite="lax",
            path="/",
        )
        response.status_code = 204
        return response

    @router.get("/me")
    def me(request: Request) -> dict[str, object]:
        identity = get_request_identity(request)
        if not identity.authenticated or identity.source != "local_cookie_session":
            raise HTTPException(status_code=401, detail="local account login is required")
        session = getattr(request.state, "login_session", None)
        if not isinstance(session, dict):
            raise HTTPException(status_code=401, detail="local account session is unavailable")
        return _public_identity(session)

    return router
