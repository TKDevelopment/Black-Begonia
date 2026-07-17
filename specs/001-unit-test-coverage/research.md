# Research: Unit Test Coverage

## Decision: Use the existing Angular Karma/Jasmine stack

**Rationale**: The constitution names Karma/Jasmine as the default for Angular unit tests, and `angular.json` already defines the Angular Karma test target. Keeping the existing stack avoids introducing test-runner migration risk during a brownfield coverage push.

**Alternatives considered**: Migrating to Jest or Vitest was rejected because it would add framework conversion work, new browser mocking behavior, and unrelated configuration churn before coverage gaps are closed.

## Decision: Make untested eligible source visible in coverage reporting

**Rationale**: `tsconfig.spec.json` currently includes spec files and declarations. A coverage target can be misleading if source files without tests never enter instrumentation. Implementation should use the Angular/Karma coverage path plus an inclusion strategy or coverage manifest that reveals eligible untested files.

**Alternatives considered**: Counting only files imported by existing specs was rejected because it can overstate coverage and hide missing tests. Requiring 80% for every file was rejected during clarification because it may over-prioritize low-risk files over critical workflows.

## Decision: Measure workflow buckets separately from aggregate coverage

**Rationale**: The clarified spec requires at least 80% aggregate coverage and at least 80% for inquiry, lead generation/CRM, proposal building/review, and authorization/access. A workflow coverage manifest lets implementation group files by business workflow and verify the per-area target without changing application architecture.

**Alternatives considered**: A single aggregate threshold was rejected because easy files could mask critical workflow gaps. A strict per-file threshold was rejected because it is too rigid for generated, type-only, bootstrap, and low-risk files.

## Decision: Reuse existing colocated spec files before adding new ones

**Rationale**: The repo already has many colocated `.spec.ts` files for public components, lead components, guards, Supabase repositories, and services. Extending those files keeps test ownership near the unit and avoids duplicate test suites.

**Alternatives considered**: Creating centralized workflow spec folders was rejected for normal unit coverage because it would separate tests from source ownership. Centralized helpers remain acceptable for repeated fixtures or mocks.

## Decision: Mock external and browser-facing dependencies

**Rationale**: Unit tests must be deterministic and must not rely on live Supabase, email, storage, Canva, browser popups, network availability, production credentials, or real customer records. Typed test doubles should cover success, failure, and edge states.

**Alternatives considered**: Running tests against local or remote Supabase was rejected for unit testing because it introduces data setup, policy, and availability risk. Such checks belong in focused integration or e2e work if separately planned.

## Decision: Test environments only where behavior changes

**Rationale**: The app has `environment.ts`, `environment.dev.ts`, and `environment.prod.ts`. The spec requires all three contexts where applicable, so tests should cover environment-dependent services and safety checks without duplicating identical behavior.

**Alternatives considered**: Repeating every workflow test against all environment files was rejected because it increases runtime and maintenance without improving confidence when behavior is identical.

## Decision: Document exclusions explicitly

**Rationale**: Generated output, type-only definitions, static constants, and bootstrap-only wiring can distort coverage work. A documented exclusion list keeps the 95% eligible-unit criterion auditable and prevents informal skip decisions.

**Alternatives considered**: Hiding files through blanket coverage ignore settings was rejected because it obscures why code is excluded.

## Decision: Prioritize branch-heavy follow-up coverage gaps

**Rationale**: The latest coverage report shows 63.29% statements, 40.08% branches, 63.58% functions, and 64.81% lines. Branches are the largest deficit, requiring roughly 1,198 additional covered branches to reach the 80% target. The next implementation pass should therefore start with units that contain many conditional paths and important workflow decisions: Supabase repositories, CRM contacts/organizations/tasks pages, CRM modals, proposal template renderer/studio behavior, lead detail/proposal builder conditionals, and public auth/portfolio pages.

**Alternatives considered**: Continuing broad file-by-file coverage expansion was rejected because it could improve statement totals while leaving the branch target far behind. Focusing only on large components was rejected because repository and modal error paths carry significant branch coverage and business-risk value.

## Decision: Treat the coverage gap backlog as planning input, not a new product workflow

**Rationale**: The backlog identifies source units and behavior categories that need tests, but it does not create new user-facing behavior. Capturing it as planning data keeps implementation tasks concrete while preserving the brownfield requirement that public website, proposal, CRM, and Supabase behavior remain unchanged unless a separately approved defect is found.

**Alternatives considered**: Creating a new application feature or runtime coverage dashboard was rejected because the current need is test coverage and acceptance evidence, not production functionality.
