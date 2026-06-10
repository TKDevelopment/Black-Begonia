# Quickstart: Proposal Delivery and Embedded SignWell Signing

## Goal

Verify the end-to-end proposal-delivery workflow where Black Begonia preserves its secure portal, SignWell supplies the reusable contract and embedded signing experience, and the canonical combined proposal package is the document clients review and sign.

## Preconditions

- A lead exists in a submission-eligible floral proposal state.
- The florist has finalized proposal data in the floral proposal builder.
- A florist-created Canva proposal PDF is ready for upload.
- One active SignWell contract template is configured for floral proposal use.
- Required SignWell field mappings for client and proposal data are configured.
- Proposal-auth delivery environment variables are configured for the correct client-facing hostname.

## Required configuration

- Frontend environment:
  - `proposalPortalUrl`
- Supabase edge function secrets:
  - `CLIENT_PORTAL_PROPOSAL_URL`
  - `PROPOSAL_ACCESS_SIGNING_KEY`
  - `MG_API_KEY`
  - `MG_BASE_URL`
  - `MG_DOMAIN`
  - `MG_FROM_EMAIL`
  - `MG_TO_REPLY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Supabase edge function optional settings:
  - `FLORAL_PROPOSAL_BUCKET`
  - `PROPOSAL_SIGNED_URL_TTL_SECONDS`
  - `SIGNWELL_EMBEDDED_SIGNING_URL_TEMPLATE`
  - `SIGNWELL_WEBHOOK_TOKEN`
  - `ALLOW_UNSIGNED_SIGNWELL_WEBHOOK`

## Security notes

- Production webhook delivery should always configure `SIGNWELL_WEBHOOK_TOKEN`.
- `ALLOW_UNSIGNED_SIGNWELL_WEBHOOK=true` should be used only for controlled local testing.
- `SIGNWELL_EMBEDDED_SIGNING_URL_TEMPLATE` should contain `{{session_id}}` only if SignWell returns an embedded session id instead of a full URL.
- Review links are intentionally short-lived and are regenerated through the proposal-access flow.

## Scenario 1: Submit a proposal and deliver the correct client link

1. Open the floral proposal builder for an eligible lead.
2. Upload the finalized Canva proposal PDF and submit the proposal.
3. Confirm the submission succeeds and the lead status advances into the submitted proposal state.
4. Confirm the lead detail page shows the newest proposal version first in the Floral Proposals section.
5. Inspect the generated client email content and confirm the proposal-auth button points to the correct client-facing route for the active environment, with production using `blackbegoniaflorals.com/proposal/auth`.

## Scenario 2: Build the canonical combined proposal package

1. Submit a finalized floral proposal while an active SignWell contract template is configured.
2. Confirm the backend retrieves the active SignWell contract template and maps lead or proposal values into the required fields.
3. Confirm the system creates one canonical combined proposal package:
   - florist-created proposal PDF first
   - filled contract second
4. Confirm the combined package is stored as the proposal's client-review artifact and historical record.
5. Confirm the proposal record captures which SignWell template and revision were used.

## Scenario 3: Review and sign inside the secure client portal

1. Open the proposal-auth link from the client email.
2. Authenticate with the client email address and six-digit passcode.
3. Confirm the secure portal loads the canonical combined proposal package.
4. Confirm the embedded SignWell signing experience is available for the contract portion without leaving the Black Begonia portal.
5. Complete the required contract signatures.
6. Confirm signing completion updates proposal status history and preserves CRM traceability.

## Scenario 4: Decline or exit without signing

1. Authenticate through the proposal-auth flow.
2. Open the secure review experience.
3. Choose `Decline` and provide revision notes.
4. Confirm decline notes are recorded and the florist's CRM history updates correctly.
5. Repeat the review flow and choose `Exit Secure View`.
6. Confirm the client can leave without corrupting the active signing session or proposal history.

## Scenario 5: Error handling and submission blocking

1. Attempt to submit a floral proposal with no active SignWell contract template.
2. Confirm submission is blocked with a clear florist-facing explanation.
3. Attempt to submit with missing required mapped contract data.
4. Confirm submission is blocked and the missing fields are identified.
5. Simulate an embedded SignWell launch failure after successful passcode authentication.
6. Confirm the client can still decline or exit safely while the system surfaces a retryable signing error and a `Retry Signing Session` action.

## Expected Verification Notes

- The canonical combined proposal package is the only review and signing artifact used in the primary workflow.
- The existing passcode-auth proposal-access flow remains the portal entry point.
- The florist's manual Canva PDF workflow remains unchanged except for contract attachment and embedded signing.
- Proposal history, lead activity, and delivery metadata remain coherent across submission, review, decline, and signing completion.
