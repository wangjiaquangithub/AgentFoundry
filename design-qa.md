# Platform UI QA

Scope: `/platform/*`

Date: 2026-07-20

## Checks

- `cd frontend && npm run build`
- Headless Chrome desktop viewport `1440x1100`
  - `/platform`
  - `/platform/agents`
  - `/platform/runs`
  - `/platform/tenants`
  - `/platform/memory`
  - `/platform/tools`
  - `/platform/workflows`
  - `/platform/approvals`
  - `/platform/settings`
- Headless Chrome mobile viewport `390x1000`
  - `/platform`

## Results

- Build: passed
- Desktop route rendering: passed
- Mobile route rendering: passed
- Horizontal page overflow: passed
- Local QA screenshots: `design-qa-screenshots/`

final result: passed
