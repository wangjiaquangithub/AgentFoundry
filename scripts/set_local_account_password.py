#!/usr/bin/env python3
"""Set an AgentFoundry local account password without editing the database."""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
for module_path in (str(ROOT), str(BACKEND)):
    if module_path not in sys.path:
        sys.path.insert(0, module_path)

from backend.persistence.database import create_database
from backend.services.local_authentication import LocalAuthenticationService


def main() -> None:
    parser = argparse.ArgumentParser(description="Set a local AgentFoundry account password.")
    parser.add_argument("--user-id", required=True)
    parser.add_argument(
        "--password-env",
        help="Read the password from this environment variable (intended for automation).",
    )
    args = parser.parse_args()
    database_url = os.environ.get("AGENTFOUNDRY_DATABASE_URL", "").strip()
    if not database_url:
        parser.error("AGENTFOUNDRY_DATABASE_URL is required")
    if args.password_env:
        password = os.environ.get(args.password_env)
        if password is None:
            parser.error(f"environment variable {args.password_env!r} is not set")
    else:
        password = getpass.getpass("New password: ")
        confirmation = getpass.getpass("Confirm password: ")
        if password != confirmation:
            parser.error("password confirmation does not match")
    LocalAuthenticationService(create_database(database_url)).set_password(
        user_id=args.user_id,
        password=password,
    )
    print(f"Password updated for {args.user_id}; existing sessions were revoked.")


if __name__ == "__main__":
    main()
