# Research: Proposal Workflow Reset

## Decision: Make manual PDF upload the only required submission path in the initial release

**Rationale**: The clarified spec says manual PDF upload must always work and Canva import must not block the release. This gives the florist a dependable submission path immediately and removes risk that OAuth, Canva library browsing, or import conversion delays the core workflow reset.

**Alternatives considered**: Requiring both manual upload and Canva import in the same release was rejected because it couples the main workflow to a secondary integration. Supporting only Canva import was rejected because it conflicts with the constitution’s requirement that drag-and-drop manual upload remain available.

## Decision: Treat Canva import as an optional secondary convenience path only if it can be decoupled from template-studio behavior

**Rationale**: Existing Canva integration code is tightly tied to proposal-template studio import flows. The feature direction no longer supports in-app template authoring, so any Canva reuse must be limited to bringing a completed document into the submission modal as a PDF, not reviving template design workflows.

**Alternatives considered**: Preserving the current Canva studio experience was rejected because it directly conflicts with retiring in-app template authoring. Removing all Canva-related code immediately was rejected because optional import remains an approved secondary path if it can be simplified safely.

## Decision: Replace template-driven PDF generation with florist-supplied proposal PDFs

**Rationale**: The current workflow service and `submit-floral-proposal` edge function still accept renderer contracts, HTML, and optional server-generated PDFs. The new workflow no longer needs in-app template rendering, Gotenberg-based PDF generation, or template-derived render contracts as the primary delivery path. The florist’s PDF becomes the artifact sent to the client, while the builder remains the structured proposal-data source.

**Alternatives considered**: Keeping generated PDFs as a fallback was rejected because it preserves the complexity this feature is explicitly removing. Generating PDFs from simplified in-app layouts was rejected because it still keeps proposal design responsibility inside the CRM.

## Decision: Introduce an explicit finalized proposal-data state before document submission

**Rationale**: The spec requires a florist to finalize proposal data, see only `Edit Proposal Data` and `Submit Proposal Document`, and re-enter editing only intentionally. The current builder has draft and submitted behavior but no explicit finalization gate. Adding a clear finalized state makes the workflow testable and enforces that proposal data is reviewed before any client document is sent.

**Alternatives considered**: Letting draft proposals submit directly was rejected because it weakens the florist’s review checkpoint and conflicts with the spec’s locked-data workflow. Treating finalization as only a UI flag was rejected because the backend and client-review cycle need an auditable state transition.

## Decision: Require edit and re-finalization before every replacement document submission

**Rationale**: The clarified spec explicitly states the proposal builder is the authoritative source of data and that a replacement PDF must only be possible after the florist returns to the builder, corrects the proposal data, and finalizes again. This keeps proposal history and client-delivered documents aligned.

**Alternatives considered**: Allowing a replacement PDF without reopening proposal data was rejected because it would let the client document diverge from stored proposal calculations. Allowing replacement only when data is unchanged was rejected because it adds ambiguous state rules without meeting the clarified requirement.

## Decision: Preserve proposal history and financial traceability in existing proposal tables and line-item records

**Rationale**: The constitution requires proposal data to remain available for future reporting, checkout/payment-adjacent workflows, catalog usage analysis, and tax preparation. Existing `floral_proposals`, `floral_proposal_line_items`, `floral_proposal_components`, and shopping-list tables already hold the structured data needed for that future state, so the workflow reset should continue using them as the long-lived system of record.

**Alternatives considered**: Moving finalized proposal data into a new upload-only document table was rejected because it would split structured proposal history away from the builder. Storing only PDFs after finalization was rejected because it would lose downstream reporting value.

## Decision: Stage template schema cleanup so workflow continuity is preserved during the refactor

**Rationale**: The current database still includes `document_templates` and `floral_proposals.template_id`. The feature goal is to remove template functionality, but the client approval cycle and proposal history cannot be destabilized during the same change. Planning should therefore remove template dependencies from active workflow code first, null out or stop writing obsolete fields, and retire schema artifacts in controlled steps that preserve existing proposal records and foreign-key safety.

**Alternatives considered**: Leaving template tables and foreign keys fully active long-term was rejected because it preserves confusing legacy coupling. Dropping template tables immediately without first removing runtime references was rejected because it would create high regression risk across builder, workflow service, models, and edge functions.

## Decision: Preserve the existing proposal-auth and proposal-review cycle after submission

**Rationale**: The feature changes how the proposal document is created and attached, not how the client receives, authenticates into, reviews, accepts, or declines the proposal. Keeping the current portal access and response cycle minimizes risk and honors the spec’s requirement that the same approval or decline workflow continue after submission.

**Alternatives considered**: Redesigning client review pages at the same time was rejected because it expands the scope beyond the workflow reset. Replacing the passcode/email flow was rejected because it is unrelated to the core template-removal objective.

## Decision: Retire proposal-template routes, sidebar entries, services, and tests as a single domain removal

**Rationale**: The template workflow is spread across admin routes, sidebar navigation, CRM components, renderer services, document-template services, and proposal-template-specific tests. Treating it as one retired domain keeps the implementation and cleanup coherent and prevents partial removal that leaves dead navigation or unused dependencies.

**Alternatives considered**: Hiding template routes while leaving the rest of the domain in place was rejected because the spec explicitly calls for removing all traces of template functionality. Moving template code behind feature flags was rejected because there is no approved need to restore it later.
