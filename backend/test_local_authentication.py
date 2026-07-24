from __future__ import annotations

import hashlib
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

from backend.persistence.database import create_database
from backend.persistence.migrations import apply_migrations
from backend.services.local_authentication import (
    LocalAuthenticationError,
    LocalAuthenticationService,
)


class LocalAuthenticationServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.url = f"sqlite:///{Path(self.temp_dir.name) / 'authentication.db'}"
        apply_migrations(self.url)
        self.database = create_database(self.url)
        self.service = LocalAuthenticationService(self.database)
        timestamp = datetime.now(UTC).isoformat()
        with self.database.transaction() as connection:
            connection.execute(
                "INSERT INTO tenants (id, name, status, created_at, updated_at) "
                "VALUES ('tenant-a', 'Tenant A', 'active', ?, ?)",
                (timestamp, timestamp),
            )
            connection.execute(
                "INSERT INTO users (id, display_name, email, status, created_at, updated_at) "
                "VALUES ('alice', 'Alice', 'alice@example.invalid', 'active', ?, ?)",
                (timestamp, timestamp),
            )
            connection.execute(
                """INSERT INTO memberships
                (id, tenant_id, user_id, role, workspace_ids, status, version, source,
                 created_at, updated_at)
                VALUES ('mem-alice', 'tenant-a', 'alice', 'employee', '[]', 'active',
                        1, 'test', ?, ?)""",
                (timestamp, timestamp),
            )
        self.service.set_password(user_id="alice", password="correct-password")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_authenticate_and_session_token_is_hashed(self) -> None:
        identity = self.service.authenticate(
            tenant_id="tenant-a", identifier="alice@example.invalid", password="correct-password"
        )
        token, session = self.service.create_session(identity)
        self.assertEqual(session["user_id"], "alice")
        self.assertEqual(self.service.resolve_session(token)["tenant_id"], "tenant-a")
        with self.database.connect() as connection:
            row = connection.execute("SELECT token_hash FROM login_sessions").fetchone()
        self.assertNotEqual(row["token_hash"], token)
        self.assertEqual(row["token_hash"], hashlib.sha256(token.encode()).hexdigest())

    def test_wrong_password_and_inactive_user_are_rejected(self) -> None:
        with self.assertRaises(LocalAuthenticationError) as wrong:
            self.service.authenticate(
                tenant_id="tenant-a", identifier="alice", password="incorrect-password"
            )
        self.assertEqual(wrong.exception.status_code, 401)
        with self.database.transaction() as connection:
            connection.execute("UPDATE users SET status='inactive' WHERE id='alice'")
        with self.assertRaises(LocalAuthenticationError) as inactive:
            self.service.authenticate(
                tenant_id="tenant-a", identifier="alice", password="correct-password"
            )
        self.assertEqual(inactive.exception.status_code, 403)

    def test_repeated_failures_lock_account_and_inactive_user_revokes_session(self) -> None:
        for _ in range(5):
            with self.assertRaises(LocalAuthenticationError):
                self.service.authenticate(
                    tenant_id="tenant-a", identifier="alice", password="incorrect-password"
                )
        with self.assertRaises(LocalAuthenticationError) as locked:
            self.service.authenticate(
                tenant_id="tenant-a", identifier="alice", password="correct-password"
            )
        self.assertEqual(locked.exception.status_code, 401)
        with self.database.transaction() as connection:
            connection.execute(
                "UPDATE local_account_credentials SET failed_attempts=0, locked_until=NULL "
                "WHERE user_id='alice'"
            )
        identity = self.service.authenticate(
            tenant_id="tenant-a", identifier="alice", password="correct-password"
        )
        token, _ = self.service.create_session(identity)
        with self.database.transaction() as connection:
            connection.execute("UPDATE users SET status='inactive' WHERE id='alice'")
        self.assertIsNone(self.service.resolve_session(token))

    def test_unknown_password_algorithm_is_rejected(self) -> None:
        with self.database.transaction() as connection:
            connection.execute(
                "UPDATE local_account_credentials SET algorithm='unsupported' WHERE user_id='alice'"
            )
        with self.assertRaises(LocalAuthenticationError) as unsupported:
            self.service.authenticate(
                tenant_id="tenant-a", identifier="alice", password="correct-password"
            )
        self.assertEqual(unsupported.exception.status_code, 401)

    def test_logout_and_password_reset_revoke_sessions(self) -> None:
        identity = self.service.authenticate(
            tenant_id="tenant-a", identifier="alice", password="correct-password"
        )
        token, _ = self.service.create_session(identity)
        self.service.revoke_session(token)
        self.assertIsNone(self.service.resolve_session(token))
        second_token, _ = self.service.create_session(identity)
        self.service.set_password(user_id="alice", password="new-password-123")
        self.assertIsNone(self.service.resolve_session(second_token))
        self.service.authenticate(
            tenant_id="tenant-a", identifier="alice", password="new-password-123"
        )


if __name__ == "__main__":
    unittest.main()
