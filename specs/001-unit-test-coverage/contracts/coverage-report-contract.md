# Contract: Coverage Report and Exclusion Evidence

## Purpose

Defines the evidence required to accept the unit-test coverage feature as complete.

## Coverage Command

The implementation must provide a repeatable command that:

- Runs the Angular Karma/Jasmine unit suite in headless mode.
- Produces a clear pass/fail result.
- Produces statement, branch, function, and line coverage.
- Makes eligible untested source files visible in the report or in the companion coverage manifest.

Recommended command shape:

```powershell
npm run test -- --watch=false --browsers=ChromeHeadless --code-coverage
```

## Required Report Fields

The final verification evidence must include:

- `overall.statements`
- `overall.branches`
- `overall.functions`
- `overall.lines`
- `workflow.inquiry.statements|branches|functions|lines`
- `workflow.lead_generation_crm.statements|branches|functions|lines`
- `workflow.proposal_building_review.statements|branches|functions|lines`
- `workflow.authorization_access.statements|branches|functions|lines`
- `eligible_units.total`
- `eligible_units.with_spec_or_exclusion`
- `excluded_units[]`
- `coverage_gap_backlog[].name`
- `coverage_gap_backlog[].status`
- `coverage_gap_backlog[].evidence`

## Acceptance Rules

- Overall statements, branches, functions, and lines must each be at least 80%.
- Each critical workflow area must each have statements, branches, functions, and lines at least 80%.
- At least 95% of eligible frontend units must have a corresponding spec file or documented exclusion.
- All critical workflow success and failure paths must have explicit behavioral assertions.
- Every prioritized coverage gap backlog item must be resolved by added behavioral tests or documented exclusion evidence.
- Branch coverage must receive priority until the latest 40.08% baseline is materially improved toward the 80% target.
- No report evidence may include real customer data, production credentials, service-role keys, or live external service dependency.

## Future-Code Coverage Gate

Every frontend change after this coverage feature must satisfy one of these outcomes before merge:

- A colocated Karma/Jasmine spec is added or updated for each changed eligible unit under `src/app` or `src/environments`.
- A documented exclusion is added to `specs/001-unit-test-coverage/coverage-manifest.md` for files with no executable behavior.
- The changed unit is already covered by an existing spec, and the change updates that spec when behavior, validation, routing, persistence intent, environment behavior, or user feedback changes.

The gate is considered passing only when the headless coverage command succeeds,
overall coverage remains at or above 80% for statements, branches, functions, and
lines, critical workflow buckets remain at or above 80% where measurable, and the
eligible-unit spec-or-exclusion ratio remains at or above 95%.

## Exclusion Record Format

Each exclusion must record:

```text
path: <project-relative path>
reason: <generated | type-only | static configuration | bootstrap-only | external declaration | approved other>
notes: <short explanation>
```

## Failure Handling

If coverage is below target, the report must identify:

- Workflow area or source path below target.
- Missing success/failure path if known.
- Whether the gap is a missing test, creation-only test, flaky test, or proposed exclusion.
- Any unresolved prioritized backlog item still blocking the 80% statement, branch, function, or line target.

## Prioritized Backlog Evidence

The final evidence must identify the resolution status for:

- Supabase repositories: lead inspiration URL, document template, task, contact, organization, activity, catalog item, tax region, and activity log repositories.
- Private CRM pages: contacts, organizations, and tasks.
- CRM modals: contact upsert, contact project link, organization upsert, organization project link, task upsert, and proposal template upsert.
- Proposal template renderer and studio: scene renderer, template upsert modal, proposal template studio, and proposal template canvas behavior.
- Lead detail and floral proposal builder branch expansion.
- Public auth and portfolio pages: portfolio detail, portfolio, login, password recovery, and change password.
- Missing colocated specs: catalog items, catalog item upsert modal, tax regions, tax region upsert modal, proposal template studio, proposal template upsert modal, proposal template canvas service, proposal template scene renderer service, and prioritized repository/service files.
