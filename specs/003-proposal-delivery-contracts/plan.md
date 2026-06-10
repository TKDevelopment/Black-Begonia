# Implementation Plan: Proposal Delivery and Embedded SignWell Signing

**Branch**: `003-proposal-delivery-contracts` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-proposal-delivery-contracts/spec.md`

## Summary

Fix floral proposal delivery so client emails always use the correct Black Begonia proposal-auth URL, newly submitted proposal versions appear first on the lead detail page, and the current passcode-auth client portal becomes the front door for a SignWell-backed signing workflow. The technical approach is to keep the florist's Canva proposal PDF as the creative source document, designate one active SignWell contract template from the CRM, generate a canonical combined proposal package at submission time, store that package in the existing floral proposal records, and embed the SignWell signing session inside the existing secure proposal-review experience while preserving decline, exit, and CRM history behavior.

## Technical Context

**Language/Version**: Angular 19 / TypeScript 5.8 for frontend work; Supabase Edge Functions TypeScript for backend proposal-delivery, document-package, and signing orchestration.

**Primary Dependencies**: Angular Material/CDK, Supabase client, Supabase Edge Functions, Netlify, Angular SSR/Express, Karma/Jasmine, Mailgun, Canva-origin florist PDFs, and SignWell embedded signing plus template APIs.

**Storage**: Supabase Postgres for proposal, contract-template selection, and signing metadata; Supabase Storage for canonical combined proposal packages; edge-function-managed third-party signing references and webhook payloads where applicable.

**Testing**: Karma/Jasmine unit tests by default; focused integration checks for floral proposal submission, proposal-access auth, embedded signing launch, decline flow continuity, lead detail ordering, and Supabase edge-function plus third-party signing boundaries.

**Target Platform**: Netlify-hosted Angular web application with SSR/server build pieces as needed, plus Supabase backend services and SignWell as an external signing dependency.

**Project Type**: Brownfield web application and CRM with public website, client portal, and CRM admin portal surfaces.

**Performance Goals**: Proposal submission should confirm within 30 seconds including contract preparation and combined-package creation; authenticated clients should be able to load the secure review experience and embedded signing surface within 5 seconds on a standard broadband connection once proposal assets are ready.

**Constraints**: Preserve brownfield behavior unless explicitly approved; no frontend service-role secrets; Supabase RLS and storage policies required for data changes; public site changes require product owner approval; Black Begonia passcode-auth remains the entry point; the canonical combined package is the preferred path and contract-only signing is fallback-only if the preferred path proves unworkable during implementation.

**Security Configuration**:
- `CLIENT_PORTAL_PROPOSAL_URL` is the authoritative backend email origin for proposal-auth delivery.
- `PROPOSAL_ACCESS_SIGNING_KEY` signs short-lived proposal-access refresh tokens and must remain backend-only.
- `SIGNWELL_WEBHOOK_TOKEN` should be configured for every deployed environment; unsigned webhook delivery is allowed only when `ALLOW_UNSIGNED_SIGNWELL_WEBHOOK=true` is intentionally set for controlled local testing.
- `SIGNWELL_EMBEDDED_SIGNING_URL_TEMPLATE` is optional and should contain `{{session_id}}` only when SignWell returns an embedded session id instead of a full URL.
- `FLORAL_PROPOSAL_BUCKET` and `PROPOSAL_SIGNED_URL_TTL_SECONDS` define the storage boundary and review-link lifetime for proposal packages.

**Scale/Scope**: Touches CRM lead detail proposal history, floral proposal builder submission flow, proposal-access auth and review UI, environment-aware proposal email delivery, the `floral_proposals` domain, floral proposal storage assets, related lead activity and email records, and new SignWell template/signing metadata for florist-managed contract delivery.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Surface classification**: CRM admin portal, client proposal-access portal, Supabase backend, and cross-cutting proposal-delivery code are affected. Public website pages, content, and SEO remain unchanged.
- **Brownfield preservation**: Preserve the floral proposal builder as the source of pricing data, the florist's manual Canva PDF workflow, proposal-auth email plus passcode entry, proposal-review decline and exit behavior, lead activity history, and current proposal version history semantics. Only the incorrect proposal-auth origin, stale lead-detail ordering, typed acceptance flow, and missing contract/signing workflow are authorized for change.
- **Supabase security**: All new proposal package, SignWell template, signing-session, and webhook metadata must remain behind approved edge-function boundaries. No SignWell secrets, Supabase service-role secrets, or Mailgun secrets may enter frontend code. New tables or columns must document RLS intent, admin-only write access, proposal-access read boundaries, and storage policy impact for combined proposal packages.
- **Webhook safety**: SignWell webhook delivery must authenticate with a shared secret in deployed environments, and any unsigned mode must be treated as local-only development behavior with explicit opt-in.
- **Testing plan**: Add focused Karma/Jasmine unit tests for lead-detail proposal ordering, proposal delivery origin handling, CRM contract-template configuration UI, proposal-access review changes, and services coordinating signing session display. Add focused integration-style checks for `submit-floral-proposal`, `verify-floral-proposal-access`, `submit-floral-proposal-response`, and any new SignWell-facing edge functions or webhook handlers. This continues the constitution requirement for meaningful proposal workflow coverage.
- **Frontend boundary plan**: The feature reinforces the existing separation between CRM admin and client portal routes inside the current Angular app. No frontend split is introduced, but the embedded signer must stay contained within the proposal-access surface and must not leak admin-only state into the client portal.
- **Proposal workflow rule**: The florist's manual Canva PDF upload path remains the primary creative document workflow. The builder continues to own structured proposal data and pricing history. The feature extends delivery with a SignWell-backed contract and embedded signing without reviving in-app proposal authoring.
- **Security and privacy**: Customer names, emails, addresses, passcodes, proposal PDFs, contracts, signatures, and signing evidence remain sensitive. The plan keeps authentication in Black Begonia, limits SignWell payloads to necessary mapped data, and preserves auditability of proposal versions and signing outcomes.

**Gate Result**: PASS. The spec authorizes the proposal-delivery and signing changes, keeps public-site behavior intact, and requires secure backend boundaries for all new signing-related work.

## Project Structure

### Documentation (this feature)

```text
specs/003-proposal-delivery-contracts/
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    embedded-signwell-proposal-contract.md
  tasks.md
```

### Source Code (repository root)

```text
src/
  app/
    components/public/          # Public website routes and content
    components/proposal-access/ # Client proposal access surface
    components/private/         # CRM admin portal
    core/                       # Auth, guards, models, SEO, Supabase services
    shared/                     # Shared public/private UI primitives
  environments/                 # Environment config

supabase/
  schemas/public/tables/        # Supabase table definitions
  edge_functions/               # Supabase Edge Functions
  s3_storage/                   # Storage bucket organization

scripts/                        # Build and sitemap helpers
.specify/                       # Spec Kit memory, templates, workflows
```

**Structure Decision**: Keep the existing Angular route surfaces intact. Extend the current floral proposal builder and proposal-access domains rather than creating a separate signing app. Add any SignWell coordination through new or updated Supabase edge functions and proposal-domain tables, with CRM-facing configuration UI under `src/app/components/private/` and client signing display under `src/app/components/proposal-access/`.

## Complexity Tracking

No constitution violations are currently identified. If any constitution violation is introduced later, it requires explicit justification and approval before implementation proceeds. If combined-package signing later proves impossible and the plan falls back to contract-only embedded signing, that fallback must be recorded as an implementation tradeoff rather than a constitution exception unless it creates a constitution violation, in which case the exception must be documented and approved.
