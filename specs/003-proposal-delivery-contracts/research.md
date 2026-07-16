# Research: Proposal Delivery and Embedded SignWell Signing

## Decision 1: Keep Black Begonia proposal-auth as the client entry point

- **Decision**: Preserve the existing email-plus-passcode proposal-auth flow and use it as the only client entry path before launching any embedded SignWell experience.
- **Rationale**: The current passcode flow already protects proposal access, fits the existing client portal, and preserves CRM history assumptions tied to proposal-auth and proposal-review routes. Replacing it with direct third-party entry would increase branding drift and reduce Black Begonia control over proposal history and decline behavior.
- **Alternatives considered**:
  - Redirect clients directly to SignWell from the email: rejected because it weakens the existing Black Begonia portal experience and splits proposal history.
  - Keep the portal only for PDF viewing and send signing elsewhere: rejected because it creates two separate client experiences for one proposal flow.

## Decision 2: Use SignWell-managed templates and field mapping instead of an in-house contract editor

- **Decision**: The florist will configure the reusable contract template in SignWell, including the field locations that accept CRM data and signature inputs, and Black Begonia will store only the active template reference and mapping metadata needed to populate it.
- **Rationale**: This matches the florist's preference to avoid building a template editor in-house and leans on SignWell for template setup, auto-fill fields, reusable templates, and embedded signing support.
- **Alternatives considered**:
  - Build a Black Begonia contract-template editor: rejected because it recreates the same template-authoring complexity the florist already rejected for proposals.
  - Upload plain contract PDFs and discover merge locations automatically at runtime: rejected because the workflow is not reliable from a raw PDF alone and duplicates field-placement behavior that SignWell already supports.

## Decision 3: Create one canonical combined proposal package at submission time

- **Decision**: On floral proposal submission, generate one canonical combined package with the florist-created Canva proposal PDF first and the SignWell-prepared contract second, then store that combined package as the proposal's review artifact in Black Begonia.
- **Rationale**: This was the chosen clarification path and keeps client review, stored proposal history, and embedded signing anchored to the same document package instead of separate review and signing artifacts.
- **Alternatives considered**:
  - Assemble a separate SignWell runtime packet on demand: rejected because it risks drift between what the client reviews and what they sign.
  - Sign only the contract while reviewing the proposal PDF separately: retained only as a fallback if the preferred combined-package path proves unworkable in implementation.

## Decision 4: Fix proposal-auth email origin from backend configuration, not frontend runtime state

- **Decision**: Proposal-access emails should use an environment-controlled client-facing portal origin sourced from backend configuration, with production pointing to `blackbegoniaflorals.com/proposal/auth`.
- **Rationale**: The current localhost bug indicates backend delivery is relying on an origin that is unsafe for production email generation. The authoritative email destination needs to come from deployment configuration rather than whichever host triggered the submission request.
- **Alternatives considered**:
  - Continue using request-origin or browser-origin values: rejected because those can leak local or staging hosts into client email delivery.
  - Hardcode the production hostname everywhere: rejected because staging and development environments still need environment-specific behavior.

## Decision 5: Track SignWell proposal-delivery metadata explicitly in the proposal domain

- **Decision**: Track the active SignWell contract template reference, contract revision used, combined-package storage reference, and signing status metadata directly in the floral proposal domain rather than burying everything in opaque notes.
- **Rationale**: The florist needs accurate proposal history, and the system must preserve which contract version was used, whether a signing session exists, and how the final outcome maps back to the proposal lifecycle.
- **Alternatives considered**:
  - Store all signing information only inside a proposal snapshot blob: rejected because operational querying, debugging, and future reporting become more difficult.
  - Store everything only in SignWell: rejected because Black Begonia would lose authoritative CRM-side history and make recovery harder.

## Decision 6: Preserve decline and exit behavior even when embedded signing is unavailable

- **Decision**: The client portal continues to support decline with notes and exit-secure-view independently of SignWell signing availability, and the system should surface a retryable signing-state error if the embedded signer cannot load.
- **Rationale**: Proposal clients still need a way to respond or leave safely when third-party signing is degraded. This reduces failure risk while preserving the current review-cycle continuity.
- **Alternatives considered**:
  - Block all client interaction when SignWell embed fails: rejected because it prevents decline feedback and stalls the proposal process unnecessarily.
  - Fall back immediately to direct third-party redirect: rejected because it breaks the chosen in-portal experience and complicates history handling.

## Decision 7: Add explicit SignWell integration boundaries in Supabase edge functions

- **Decision**: Keep SignWell orchestration in Supabase edge functions rather than frontend code, including template lookup, proposal-to-contract data mapping, package generation, signing-session creation, and webhook-driven status updates.
- **Rationale**: This keeps secrets out of the frontend, aligns with the repo's current proposal-delivery architecture, and allows proposal, email, storage, and signing updates to be coordinated transactionally as much as practical.
- **Alternatives considered**:
  - Call SignWell directly from the Angular client: rejected because it would expose privileged integration behavior and fragment workflow control.
  - Build a separate backend service outside Supabase for signing: rejected because the project already relies on Supabase edge functions for proposal lifecycle operations.

## Decision 8: Normalize lead service types before persistence

- **Decision**: Public inquiry forms and CRM lead creation may continue using catalog labels, legacy keys, or friendly lead-source labels, but `LeadRepositoryService` normalizes them to exact Supabase enum values before inserting or updating leads.
- **Rationale**: Supabase rejects enum values such as `wedding-full-service`, `Baby Showers`, `Corporate Events`, or `referral` with a 400 response because the database accepts canonical values such as `full-service wedding`, `baby shower`, `corporate`, and `other`. Lead service type and source are also used later by proposal delivery, contract merge workflows, filtering, and reporting, so canonical persistence prevents downstream proposal-package failures.
- **Alternatives considered**:
  - Change every form option value to database enum values: rejected because CRM display labels, legacy keys, and friendly source labels still appear in edit flows and tests.
  - Loosen the database enums: rejected because it would preserve inconsistent lead data and weaken proposal workflow routing.

## Decision 9: Treat event dates as date-only calendar values

- **Decision**: Public inquiry and CRM lead event dates are normalized to `YYYY-MM-DD` before persistence, and date-only values are displayed or emailed by constructing calendar dates rather than JavaScript UTC instants.
- **Rationale**: Browser date inputs emit date-only strings such as `2026-11-28`. `new Date('2026-11-28')` treats that value as midnight UTC, which displays as November 27 in US Eastern time. Event dates are business calendar dates, not moments in time, so they must not shift by timezone.
- **Alternatives considered**:
  - Store event dates as timestamps: rejected because event dates do not need time-of-day semantics and would keep creating timezone edge cases.
  - Add a day during display: rejected because it would mask the symptom while breaking users in other timezones or for already timestamped values.

## Operational setup guidance

- `CLIENT_PORTAL_PROPOSAL_URL` must point to the deployed Black Begonia proposal-auth route used in client emails. Production should use `https://blackbegoniaflorals.com/proposal/auth`.
- `PROPOSAL_ACCESS_SIGNING_KEY` signs proposal-access refresh tokens for the secure portal and must never be exposed to the frontend.
- `SIGNWELL_WEBHOOK_TOKEN` should be configured in every deployed Supabase environment and mirrored in SignWell webhook delivery settings.
- `ALLOW_UNSIGNED_SIGNWELL_WEBHOOK=true` is acceptable only for controlled local development when SignWell cannot supply the shared webhook token header.
- `SIGNWELL_EMBEDDED_SIGNING_URL_TEMPLATE` is optional and should be left blank when SignWell returns a full embedded signing URL. If only a session id is returned, the template must contain `{{session_id}}`.
- `FLORAL_PROPOSAL_BUCKET` should remain scoped to proposal-package storage only, and `PROPOSAL_SIGNED_URL_TTL_SECONDS` should stay short-lived so review links expire automatically.

## Affected implementation inventory

### Routes and UI surfaces

- CRM admin proposal workflow under `src/app/components/private/floral-proposal-builder/`
- CRM lead proposal history under `src/app/components/private/leads/lead-detail/` and `src/app/components/private/leads/components/lead-proposal-history-card/`
- Client proposal access routes under `src/app/components/proposal-access/proposal-auth/` and `src/app/components/proposal-access/proposal-review/`

### Angular services, guards, repositories, and models

- Proposal-access session models and services under `src/app/core/proposal-access/`
- Proposal-access route protection in `src/app/core/guards/proposal-access.guard.ts`
- Floral proposal workflow and builder services under `src/app/core/supabase/services/`
- Floral proposal, contract-template, and signing-session repositories under `src/app/core/supabase/repositories/`
- Proposal domain models under `src/app/core/models/`
- Floral service catalog normalization under `src/app/core/floral-services/floral-service-catalog.ts`
- Lead `service_type` and `source` persistence normalization under `src/app/core/supabase/repositories/lead-repository.service.ts`
- Date-only normalization and display helpers under `src/app/core/utils/date-only.ts`
- Supabase edge-function email date formatting in `supabase/edge_functions/send-inquiry-emails.ts` and proposal email helpers

### Supabase schemas and storage

- Proposal delivery metadata in `supabase/schemas/public/tables/floral_proposals.sql`
- Active contract template records in `supabase/schemas/public/tables/proposal_contract_templates.sql`
- Embedded signing session records in `supabase/schemas/public/tables/proposal_signing_sessions.sql`
- Canonical combined proposal-package assets in the `FLORAL_PROPOSAL_BUCKET` storage boundary

### Supabase edge functions

- `supabase/edge_functions/submit-floral-proposal.ts`
- `supabase/edge_functions/send-proposal-email.ts`
- `supabase/edge_functions/resend-floral-proposal-email.ts`
- `supabase/edge_functions/verify-floral-proposal-access.ts`
- `supabase/edge_functions/submit-floral-proposal-response.ts`
- `supabase/edge_functions/signwell-webhook.ts`
