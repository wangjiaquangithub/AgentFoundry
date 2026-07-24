"""Password authentication and revocable server-side browser sessions."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase, create_database


PBKDF2_ALGORITHM = "pbkdf2_sha256"
PBKDF2_ITERATIONS = 310_000
SESSION_LIFETIME_SECONDS = 8 * 60 * 60
LOCK_THRESHOLD = 5
LOCK_SECONDS = 15 * 60


class LocalAuthenticationError(ValueError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def _now() -> datetime:
    return datetime.now(UTC)


def _iso(value: datetime) -> str:
    return value.isoformat()


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class LocalAuthenticationService:
    database: SQLiteDatabase | PostgresDatabase
    session_lifetime_seconds: int = SESSION_LIFETIME_SECONDS

    @property
    def _sqlite(self) -> bool:
        return isinstance(self.database, SQLiteDatabase)

    def _sql(self, value: str) -> str:
        return value if self._sqlite else value.replace("?", "%s")

    @staticmethod
    def _dict(row: Any) -> dict[str, Any]:
        return dict(row)

    def _one(self, connection: Any, sql: str, parameters: tuple[Any, ...]) -> dict[str, Any] | None:
        row = connection.execute(self._sql(sql), parameters).fetchone()
        return None if row is None else self._dict(row)

    @staticmethod
    def validate_password(password: str) -> None:
        if len(password) < 8 or len(password) > 256:
            raise LocalAuthenticationError(422, "password must contain 8 to 256 characters")

    def set_password(self, *, user_id: str, password: str) -> None:
        self.validate_password(password)
        salt = secrets.token_bytes(16)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
        timestamp = _iso(_now())
        salt_hex, digest_hex = salt.hex(), digest.hex()
        with self.database.transaction() as connection:
            if self._one(connection, "SELECT id FROM users WHERE id=?", (user_id,)) is None:
                raise LocalAuthenticationError(404, "account was not found")
            existing = self._one(connection, "SELECT user_id FROM local_account_credentials WHERE user_id=?", (user_id,))
            if existing:
                connection.execute(self._sql("""UPDATE local_account_credentials
                    SET password_hash=?, password_salt=?, algorithm=?, iterations=?,
                        failed_attempts=0, locked_until=NULL, updated_at=? WHERE user_id=?"""),
                    (digest_hex, salt_hex, PBKDF2_ALGORITHM, PBKDF2_ITERATIONS, timestamp, user_id))
                connection.execute(self._sql("UPDATE login_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL"),
                                   (timestamp, user_id))
            else:
                connection.execute(self._sql("""INSERT INTO local_account_credentials
                    (user_id, password_hash, password_salt, algorithm, iterations,
                     failed_attempts, locked_until, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)"""),
                    (user_id, digest_hex, salt_hex, PBKDF2_ALGORITHM, PBKDF2_ITERATIONS,
                     timestamp, timestamp))

    def authenticate(self, *, tenant_id: str, identifier: str, password: str) -> dict[str, Any]:
        normalized = identifier.strip().lower()
        timestamp = _now()
        password_failed = False
        with self.database.transaction() as connection:
            account = self._one(connection, """SELECT users.id AS user_id, users.display_name,
                    users.email, users.status AS user_status, memberships.id AS membership_id,
                    memberships.status AS membership_status, memberships.role,
                    credentials.password_hash, credentials.password_salt,
                    credentials.algorithm, credentials.iterations,
                    credentials.failed_attempts, credentials.locked_until
                FROM users JOIN memberships ON memberships.user_id=users.id
                LEFT JOIN local_account_credentials credentials ON credentials.user_id=users.id
                WHERE memberships.tenant_id=? AND (lower(users.email)=? OR lower(users.id)=?)""",
                (tenant_id, normalized, normalized))
            if account is None or not account.get("password_hash"):
                raise LocalAuthenticationError(401, "invalid tenant, account, or password")
            if account.get("algorithm") != PBKDF2_ALGORITHM:
                raise LocalAuthenticationError(401, "invalid tenant, account, or password")
            locked_until = account.get("locked_until")
            if locked_until and datetime.fromisoformat(locked_until) > timestamp:
                raise LocalAuthenticationError(401, "invalid tenant, account, or password")
            candidate = hashlib.pbkdf2_hmac(
                "sha256", password.encode("utf-8"), bytes.fromhex(account["password_salt"]),
                int(account["iterations"]),
            ).hex()
            if not hmac.compare_digest(candidate, account["password_hash"]):
                attempts = int(account.get("failed_attempts") or 0) + 1
                lock_value = _iso(timestamp + timedelta(seconds=LOCK_SECONDS)) if attempts >= LOCK_THRESHOLD else None
                connection.execute(self._sql("UPDATE local_account_credentials SET failed_attempts=?, locked_until=?, updated_at=? WHERE user_id=?"),
                                   (attempts, lock_value, _iso(timestamp), account["user_id"]))
                password_failed = True
            else:
                if account["user_status"] != "active" or account["membership_status"] != "active":
                    raise LocalAuthenticationError(403, "account or tenant membership is inactive")
                connection.execute(self._sql("UPDATE local_account_credentials SET failed_attempts=0, locked_until=NULL, updated_at=? WHERE user_id=?"),
                                   (_iso(timestamp), account["user_id"]))
        if password_failed:
            raise LocalAuthenticationError(401, "invalid tenant, account, or password")
        return {key: account[key] for key in (
            "user_id", "display_name", "email", "membership_id", "role"
        )} | {"tenant_id": tenant_id}

    def create_session(self, identity: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        token = secrets.token_urlsafe(48)
        timestamp = _now()
        expires_at = timestamp + timedelta(seconds=self.session_lifetime_seconds)
        with self.database.transaction() as connection:
            connection.execute(self._sql("""INSERT INTO login_sessions
                (token_hash, user_id, tenant_id, membership_id, expires_at,
                 revoked_at, created_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?, NULL, ?, ?)"""),
                (_token_hash(token), identity["user_id"], identity["tenant_id"],
                 identity["membership_id"], _iso(expires_at), _iso(timestamp), _iso(timestamp)))
        return token, identity | {"expires_at": _iso(expires_at)}

    def resolve_session(self, token: str) -> dict[str, Any] | None:
        if not token:
            return None
        timestamp = _now()
        with self.database.transaction() as connection:
            session = self._one(connection, """SELECT login_sessions.*, users.display_name,
                    users.email, users.status AS user_status, memberships.status AS membership_status,
                    memberships.role
                FROM login_sessions JOIN users ON users.id=login_sessions.user_id
                JOIN memberships ON memberships.id=login_sessions.membership_id
                WHERE login_sessions.token_hash=?""", (_token_hash(token),))
            if session is None or session.get("revoked_at") or datetime.fromisoformat(session["expires_at"]) <= timestamp:
                return None
            if session["user_status"] != "active" or session["membership_status"] != "active":
                connection.execute(self._sql("UPDATE login_sessions SET revoked_at=? WHERE token_hash=?"),
                                   (_iso(timestamp), session["token_hash"]))
                return None
            connection.execute(self._sql("UPDATE login_sessions SET last_seen_at=? WHERE token_hash=?"),
                               (_iso(timestamp), session["token_hash"]))
        return {
            "user_id": session["user_id"], "tenant_id": session["tenant_id"],
            "membership_id": session["membership_id"], "display_name": session["display_name"],
            "email": session["email"], "role": session["role"], "expires_at": session["expires_at"],
        }

    def revoke_session(self, token: str) -> None:
        if not token:
            return
        with self.database.transaction() as connection:
            connection.execute(self._sql("UPDATE login_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL"),
                               (_iso(_now()), _token_hash(token)))


def build_local_authentication_service() -> LocalAuthenticationService | None:
    database_url = os.getenv("AGENTFOUNDRY_DATABASE_URL", "").strip()
    return LocalAuthenticationService(create_database(database_url)) if database_url else None
