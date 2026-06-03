# Quickstart: Unit Test Coverage Plan

## 1. Confirm Active Feature

```powershell
.specify\scripts\powershell\check-prerequisites.ps1 -Json -PathsOnly
```

Expected active feature directory:

```text
specs/001-unit-test-coverage
```

## 2. Capture Baseline

Run the current test suite with coverage:

```powershell
npm run test -- --watch=false --browsers=ChromeHeadless --code-coverage
```

Record:

- Overall statement, branch, function, and line coverage.
- Files not represented in coverage.
- Existing `.spec.ts` files that only test creation.
- Candidate exclusions with reasons.
- Branch-heavy files and workflows that can close the current 40.08% branch baseline fastest.

Latest known baseline:

- Statements: 63.29% (3154/4983), about 833 covered statements short of 80%.
- Branches: 40.08% (1203/3001), about 1,198 covered branches short of 80%.
- Functions: 63.58% (716/1126), about 185 covered functions short of 80%.
- Lines: 64.81% (3037/4686), about 712 covered lines short of 80%.

## 3. Build the Coverage Manifest

Group eligible units into:

- Inquiry
- Lead generation/CRM
- Proposal building/review
- Authorization/access
- General frontend

Flag generated, type-only, static configuration, bootstrap-only, and other approved exclusions separately.

## 4. Expand Tests by Priority

1. Supabase repositories: lead inspiration URLs, document templates, tasks, contacts, organizations, activities, catalog items, tax regions, and activity logs.
2. Private CRM pages: contacts, organizations, and tasks initial load, loading/error/empty states, search/filter, create/edit/delete, linked-record behavior, feedback, and repository failures.
3. CRM modals: contact, organization, task, project-link, and proposal-template modals for create/edit hydration, validation, payload normalization, guards, and emits.
4. Proposal template renderer/studio: node rendering, escaping, missing assets, layout, preset selection, load/save/publish, validation, and error states.
5. Lead detail and proposal builder branch expansion: conditional UI states, alternate statuses, failure branches, helper edge cases, empty linked data, delete paths, and cancel paths.
6. Public auth and portfolio pages: validation, auth/session failures, navigation, loading, empty gallery, and failed gallery fetches.
7. Remaining inquiry, authorization/access, shared UI, and eligible components/services needed to reach overall, per-workflow, and 95% eligible-unit targets.

Missing colocated specs to create or exclude during this pass:

- `catalog-items.component.ts`
- `catalog-item-upsert-modal.component.ts`
- `tax-regions.component.ts`
- `tax-region-upsert-modal.component.ts`
- `proposal-template-studio.component.ts`
- `proposal-template-upsert-modal.component.ts`
- `proposal-template-canva.service.ts`
- `proposal-template-scene-renderer.service.ts`
- Prioritized repository/service files listed in the plan.

## 5. Verify Final Acceptance

Run the final coverage command and confirm:

- 80% or higher overall statements, branches, functions, and lines.
- 80% or higher statements, branches, functions, and lines for every critical workflow area.
- 95% or higher eligible frontend units have tests or documented exclusions.
- The latest prioritized coverage gap backlog is resolved by tests or documented exclusions.
- No tests use live production services, real customer records, production credentials, or external network availability.

Checkpoint commands used during implementation:

```powershell
npm run test:coverage
npx ng test --watch=false --browsers=ChromeHeadless --code-coverage --include <focused-spec>
```

Current focused checkpoint notes:

- US2 inquiry/lead focused specs pass, but imported-code coverage remains below the 80% acceptance target.
- US3 proposal focused specs pass, but imported-code coverage remains below the 80% acceptance target.
- US4 environment focused specs pass and exceed 80% for statements, functions, and lines; branches are just below 80%.
- US5 authorization/access focused specs pass, but imported-code coverage remains below the 80% acceptance target.
- `npm run build` exits successfully in the current local environment, but prerender logs Supabase URL errors when `set-env.cts` writes placeholder `undefined` Supabase values because real deploy-time secrets are absent.

## 6. Moving Forward

For future frontend changes:

- Add or update related `.spec.ts` files in the same change.
- Prefer behavioral assertions over creation-only tests.
- Use synthetic fixtures and typed test doubles.
- Document any exclusion with a specific reason.
