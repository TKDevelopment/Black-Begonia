# Research: Manual Proposal Booking

## Decision: Project-owned proposal document history and active invoice snapshots

**Decision**: Each confirmed PDF submission creates a project-owned proposal document version and an invoice snapshot. The most recent confirmed version is active; historical versions remain viewable from the project.

**Rationale**: The florist must be able to revise proposal invoice data after booking without losing the financial state that was active at each signed submission. Future income/expense dashboards need a stable active snapshot while preserving historical documentation.

**Alternatives considered**:
- Mutating one proposal record in place: rejected because historical signed proposal versions would be lost.
- Freezing proposal invoice data after booking: rejected by clarification; post-booking revisions are required.

## Decision: Retire SignWell and proposal-access portal completely

**Decision**: Remove SignWell submission, SignWell webhook processing, provider session storage, embedded signer UI, passcode access, proposal response submission, and proposal access email delivery from the proposal workflow.

**Rationale**: The approved workflow moves client review/signature outside the CRM. The CRM stores the already-signed PDF for record keeping and project booking.

**Alternatives considered**:
- Leave SignWell code dormant behind flags: rejected because it keeps obsolete secrets, schema, routes, and failure modes.
- Keep portal URLs read-only: rejected because legacy proposal/signature portal URLs must be not found or inaccessible.

## Decision: Hard-delete obsolete signing/portal schema and data

**Decision**: The cleanup migration drops `proposal_signing_sessions` and removes signing/portal columns from `floral_proposals`, including passcode, provider, signing status/reference, accepted terms/privacy, signature metadata, decline feedback, and signed package fields.

**Rationale**: Clarification selected hard deletion over archival. The records exist only to support the retired provider/portal workflow.

**Alternatives considered**:
- Archive tables for audit: rejected by clarification.
- Keep nullable legacy columns: rejected because they invite future code to depend on retired workflow state.

## Decision: Preserve builder invoice data but migrate signed PDFs to project context

**Decision**: Keep floral proposal builder invoice/planning structures, line items, components, shopping list, tax region, markup, labor, totals, and snapshots. Move signed PDF references into project document version history and the active project snapshot relationship.

**Rationale**: The builder remains the operational planning tool. The signed PDF is now evidence of booking or revision, and belongs to the project record after conversion.

**Alternatives considered**:
- Store the signed PDF only on `floral_proposals`: rejected because post-booking project revisions need project-centered history.
- Create a completely new builder for projects: rejected because existing builder behavior should be preserved.

## Decision: Reuse private proposal storage with project-oriented paths

**Decision**: Continue using the private PDF storage capability, with object paths and metadata referencing projects and document versions. The existing `floral-proposals` bucket can remain if policies and naming are updated to reflect project-owned signed documents.

**Rationale**: The bucket already enforces private PDF storage and MIME constraints. Reusing it reduces migration risk while still removing SignWell semantics.

**Alternatives considered**:
- Create a new bucket immediately: viable, but adds migration and policy churn without functional benefit unless product naming requires it.
- Public PDF URLs: rejected because signed agreements are private customer/project records.

## Decision: Converted leads remain as linked history

**Decision**: On initial confirmed submission, create or update a booked project, link the original lead through `converted_project_id`/`source_lead_id`, set conversion metadata, and remove the lead from active lead pipelines.

**Rationale**: The CRM already has converted lead/project relationships. Preserving the lead gives audit and context while project becomes the operational record.

**Alternatives considered**:
- Delete the lead after conversion: rejected because it would discard historical inquiry context.
- Keep the lead active after booking: rejected because it would confuse pipeline state.

## Decision: Add a new cleanup migration for existing environments

**Decision**: Implement this refactor through a new executable migration, while updating declarative schema artifacts to represent the final state.

**Rationale**: Existing environments may already have Spec 003 SignWell artifacts. A forward migration is safer and auditable for brownfield databases.

**Alternatives considered**:
- Editing only old migrations: rejected because it does not clean already-applied environments.
- Manual database cleanup: rejected because Spec Kit requires executable migrations for schema changes.
