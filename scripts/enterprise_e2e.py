#!/usr/bin/env python3
"""Run the repeatable enterprise acceptance suite.

The suite deliberately composes the existing isolated business and runtime test
fixtures.  This keeps acceptance data outside tracked repository paths while
exercising the same services used by the platform APIs.
"""

from __future__ import annotations

import sys
import unittest

from backend.test_agentscope_runtime_provider import AgentScopeRuntimeProviderTests
from backend.test_leave_requests import LeaveRequestsTest
from backend.test_reports import GovernedReportsTest
from backend.test_runtime_execution_context import RuntimeExecutionContextTest


ACCEPTANCE_CASES: tuple[type[unittest.TestCase], ...] = (
    LeaveRequestsTest,
    GovernedReportsTest,
    RuntimeExecutionContextTest,
    AgentScopeRuntimeProviderTests,
)


def build_suite() -> unittest.TestSuite:
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    for case in ACCEPTANCE_CASES:
        suite.addTests(loader.loadTestsFromTestCase(case))
    return suite


def main() -> int:
    print("AgentFoundry enterprise acceptance")
    print("- leave: real HTTP HR demo service, approval, same-session continuation, idempotency")
    print("- reports: governed queries, data scopes, masking, export approval, safe failures")
    print("- runtime: persisted ExecutionContext, lifecycle, continuation integrity, events")
    print("- AgentScope: real Permission types, execution-point checks, session/provider behavior")
    print()

    result = unittest.TextTestRunner(verbosity=2).run(build_suite())

    print()
    print("Acceptance environment notes:")
    print("- HR calls crossed a real local HTTP boundary and used an isolated temporary database.")
    print("- Report acceptance used isolated SQLite databases; production configuration requires PostgreSQL.")
    print("- AgentScope provider tests used a deterministic test Agent/model factory; no external LLM credential was exercised.")
    print("- All acceptance databases and runtime artifacts were created in temporary directories.")
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
