# Research: Project Details Workflow

## Decision: Use Operational Payment-Gated Project Statuses

Project statuses will be `awaiting_deposit`, `booked`, `awaiting_final_payment`, `final_prep`, `completed`, and `canceled`.

**Rationale**: The florist wants status to communicate the next operational attention point, not just a passive lifecycle stage. This makes the Projects table useful for daily triage and ties project status directly to deposit and final-payment readiness.

**Alternatives considered**:
- Keep legacy statuses like `inquiry_converted` and `proposal`: rejected because the project already exists after contract submission and these labels no longer describe operational needs.
- Use separate payment state and project state only: deferred until full payments screens exist; current UX benefits from a single table status that highlights immediate action.

## Decision: Add Project-Level Payment Records Now, Leave Stripe For Later

Introduce project payment records for deposit and final payment with amount, due date, paid date, status, and method/source. Manual methods include Venmo, check, cash, and similar external payments. Stripe metadata fields may be reserved but Stripe integration and payment detail screens remain future work.

**Rationale**: The status lifecycle cannot safely advance from Awaiting Deposit to Booked or from Awaiting Final Payment to Final Prep without payment records. Manual logging is required because not every payment will come through Stripe.

**Alternatives considered**:
- Boolean flags only: rejected because due dates, paid dates, amounts, and payment method/source are needed for the financial summary and later reporting.
- Full payment management now: rejected because Stripe and dedicated payment detail screens are a separate feature.

## Decision: Refresh 45-Day Status Automatically Through Idempotent Backend Logic

Booked projects with unpaid final payment will automatically move to Awaiting Final Payment 45 days before the event date. The first implementation should use idempotent Supabase-side logic called before project list/detail reads and after payment changes.

**Rationale**: This provides automatic behavior from the CRM user's perspective without introducing a new scheduled worker or edge function. The logic remains testable, repeatable, and safe to call often.

**Alternatives considered**:
- Pure frontend date checks: rejected because status would be display-only and could drift from stored state.
- Scheduled edge function: deferred until the project needs background status changes without CRM access.

## Decision: Reuse CRM List Components And Lead Search Logic Pattern

Projects list should use `SearchFilterBarComponent`, `EntityTableShellComponent`, `EntityTableCellDirective`, and `StatusBadgeComponent`, with a computed filtered list mirroring the leads table search/filter style.

**Rationale**: The requirement is consistency with leads, contacts, and organizations. Reusing shared components reduces UI drift and concentrates behavior in familiar patterns.

**Alternatives considered**:
- Keep the current sidebar/list plus inline details: rejected because it does not match the requested CRM table screens.
- Build a project-specific table from scratch: rejected because shared table behavior already exists.

## Decision: Separate Project Details Into Focused Child Components

The details route should compose header/quick actions, edit modal, financial summary, payment log modal, proposal documents, revision comparison, and activity panel as focused child components.

**Rationale**: The detail page has several independent data concerns. Small components keep tests focused and avoid a large projects component that mixes table, detail, payment, and document behavior.

**Alternatives considered**:
- Keep all detail behavior in `ProjectsComponent`: rejected because current component is already doing list/detail/document responsibilities.

## Decision: Proposal Document Status Uses Stored Status Plus Derived Active State

Document rows keep stored document status for submitted/missing/error-like states. Active, inactive, and initial/revised grouping are derived from document version, active document reference, and revision category.

**Rationale**: The user wants to see version, file, submitted, status, and action while also distinguishing permanent initial signed agreement from active revised proposals. Stored status and active/inactive meaning are different concepts.

**Alternatives considered**:
- Overload status with Active/Inactive only: rejected because it would hide document submission or availability state.
- Add a signed-agreement status to revised proposals: rejected because revised proposal PDFs do not include a new signed agreement in this workflow.

## Decision: Revision Comparison Is Invoice And Document Metadata Only

Compare proposal total, subtotal/tax/final balance when available, version, submitted date, document status, active/inactive state, and file metadata. Do not compare PDF text or visual content.

**Rationale**: Reliable invoice/document metadata already exists or is planned. PDF text and visual diffing would materially expand scope and reliability risk.

**Alternatives considered**:
- Extract PDF text: rejected for first pass because Canva PDFs may not produce consistent text.
- Visual PDF comparison: rejected as a separate advanced document-analysis feature.

## Decision: Activity Timeline Shows System-Generated Project Events Only

Show meaningful events for project creation/conversion, project edits, status changes, payment records, proposal revisions, document submissions, and financial snapshot changes. Manual notes are deferred.

**Rationale**: System-generated events are enough to support traceability without adding a notes feature and moderation/editing concerns.

**Alternatives considered**:
- Include manual notes immediately: deferred because notes require create/edit/delete UX and separate permissions/validation decisions.

## Decision: Dedicated Payment Details Screens Are Out Of Scope

The project details page may provide quick manual logging and financial summary, but it will not introduce a payment index or payment details route.

**Rationale**: The clarified spec explicitly keeps Stripe and full payment screens as future work. This feature should create the operational data foundation without building a full payment module.

**Alternatives considered**:
- Build payment details now: rejected because it would broaden the feature beyond project details and revision workflow.
