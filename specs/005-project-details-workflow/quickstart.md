# Quickstart: Project Details Workflow

## Preconditions

- Run the feature on branch `005-project-details-workflow`.
- Apply the project details workflow migration after the manual proposal booking migration.
- Use an authenticated internal CRM user.
- Have at least three test projects:
  - One newly converted project with signed initial document and unpaid deposit.
  - One booked project with event date within 45 days and unpaid final payment.
  - One project with initial document plus at least two revised proposal documents.

## Verify Projects List

1. Open `/admin/projects`.
2. Confirm the page has CRM-standard padding and a table, not the old sidebar/detail split.
3. Confirm columns: Project, Service Type, Event Date, Status, Actions.
4. Search by project name, service type, event type, venue text, and status label.
5. Filter by status, event type, and service type.
6. Click reset and confirm search/filters clear.
7. Click a project row/action and confirm `/admin/projects/:projectId` opens.

## Verify Project Details

1. Open a project details page.
2. Confirm raw source lead UUID is not displayed.
3. Confirm quick actions are visible:
   - Edit project information.
   - Revise proposal.
   - Open active PDF when available.
4. Confirm the financial summary shows active proposal total, deposit status, final-payment status, and outstanding balance where available.
5. Confirm the Payments card shows payment history rows with payment kind, status, due date, paid date, amount, and method, or a section-level empty state.
6. Confirm missing financial values are shown as unavailable, not as `$0.00`.
7. Confirm the activity timeline shows project/payment/proposal events or a section-level empty state.
8. Confirm the activity timeline uses a constrained vertical scroll area when activity history grows beyond the card height.
9. Confirm customer name, partner name, customer email, phone, and preferred contact method are visible when linked source lead data exists.
10. Confirm planner name, email, and phone are visible when linked source lead data exists.
11. Confirm ceremony and reception addresses plus ceremony, reception, and event start times are visible, with unavailable values shown as `Not set`.
12. Confirm activity entries expose useful record metadata when event metadata exists.
13. Confirm the first project information card shows project status without an adjacent General/Wedding event-type label.
14. Toggle CRM dark mode and confirm project detail cards, nested stat cells, proposal documents, financial summary, payments, and activity sections follow the dark theme.

## Verify Edit Modal

1. Open Edit Project Information.
2. Confirm editable fields include project name, event type, service type, event date, venue/location, style notes, internal notes, and status.
3. Confirm Event Type is a dropdown with General and Wedding.
4. Confirm Service Type is a dropdown that changes its options based on the selected Event Type.
5. Confirm ceremony and reception location fields are grouped compactly and ZIP fields remain aligned with the rest of each location row on desktop widths.
6. Confirm event start, ceremony start, and reception start times can be edited when linked source lead data is loaded.
7. Toggle CRM dark mode and confirm the modal panel, grouped field areas, labels, controls, and action buttons follow the dark theme.
8. Confirm source lead, proposal documents, invoice snapshots, and payment records are not editable in this modal.
9. Save a project name, timing, or note change.
10. Confirm details refresh and an activity event is recorded.
11. Reopen the modal, make a change, cancel, and confirm no change persists.

## Verify Payment-Gated Statuses

1. Open a newly converted project with no deposit recorded.
2. Confirm status is Awaiting Deposit.
3. Manually record a deposit payment with amount, due date, paid date, status, and method such as Venmo/check/cash.
4. Confirm project status changes to Booked.
5. Open a Booked project with event date within 45 days and unpaid final payment.
6. Refresh/load projects and confirm it automatically moves to Awaiting Final Payment.
7. Manually record final payment.
8. Confirm project status changes to Final Prep.
9. Mark a project Completed or Canceled and confirm automatic final-payment refresh does not change that status.
10. Toggle CRM dark mode and confirm the Log Payment modal follows the dark theme.

## Verify Proposal Documents

1. Open a project with only the initial signed proposal/services agreement.
2. Confirm the proposal documents section shows the single document without tabs.
3. Open a project with revised proposals.
4. Confirm tabs appear for Initial Proposal and Services Agreement and Revised Proposals.
5. Confirm the initial document remains visible and inactive.
6. Confirm revised proposals are ordered oldest to most recent and the newest revised proposal is active.
7. Confirm every row shows version, file, submitted, status, and Open PDF.
8. Open a PDF and confirm it uses private signed URL behavior.

## Verify Revision Comparison

1. Open a project with at least two revised proposals.
2. Launch Compare Revisions.
3. Select two revised versions.
4. Confirm comparison includes invoice totals, version numbers, submitted dates, status, active/inactive state, and file info.
5. Confirm no PDF text or visual comparison is attempted.
6. Test a version missing invoice data and confirm the UI explains the limitation while showing available metadata.

## Verify Measurable Outcomes

1. Load at least 25 sample projects and confirm a known project can be found by search or filters in under 30 seconds.
2. Open a project details page and confirm the active proposal total can be identified within 10 seconds.
3. For projects with multiple revised proposals, compare two revised versions and confirm whether the proposal total changed in at least 9 of 10 attempts where comparison data exists.
4. Open the activity timeline and confirm the most recent proposal revision or document submission can be identified within 15 seconds.
5. Manually record deposit or final payment examples for Venmo, check, and cash, and confirm the expected project status update succeeds in at least 95% of attempts.

## Regression Checks

- Existing lead details still load.
- Existing proposal builder still opens.
- Revise Proposal from project details still routes into the existing revision workflow.
- Contacts and organizations project linking still works.
- Public website routes are unchanged.
- Client proposal-access behavior is unchanged by this feature.

## Implementation Validation Notes

- Production build succeeds after allowing Angular font inlining network access.
- The automated Karma/Jasmine suite reported `TOTAL: 479 SUCCESS` during the npm-script run, but the wrapper process did not exit before the command timeout in this shell session.
- A direct non-watch Angular CLI retry was blocked by Chrome GPU/cache locking after the first Karma run, not by test failures.
- Manual quickstart scenarios still require a seeded Supabase environment with project payment records, proposal document versions, and invoice snapshots.
