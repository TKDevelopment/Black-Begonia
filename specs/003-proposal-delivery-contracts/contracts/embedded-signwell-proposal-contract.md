# Contract: Embedded SignWell Proposal Delivery Workflow

## Purpose

Defines the workflow contract between the floral proposal builder, Supabase proposal-delivery edge functions, SignWell contract-template and embedded-signing flows, and the Black Begonia client proposal-access portal.

## Workflow Preconditions

Before client delivery can begin:

- The florist has entered the floral proposal workflow from an eligible lead state.
- Proposal data exists and has been finalized in the floral proposal builder.
- A valid florist-created proposal PDF has been uploaded.
- One active SignWell contract template has been designated for floral proposal submissions.
- Required SignWell field mappings for customer and proposal data are configured.
- The client-facing proposal-auth origin is configured for the active environment.

## Canonical Delivery Artifact

The primary workflow uses one canonical combined proposal package:

- Part 1: florist-created Canva proposal PDF
- Part 2: SignWell-filled contract document

This combined package is the source of truth for:

- client review in the secure portal
- embedded SignWell signing
- proposal history references inside the CRM
- final delivered proposal-package retrieval

## CRM Submission Inputs

Required:

- `floral_proposal_id`
- `lead_id`
- `proposal_version`
- `finalized proposal data snapshot`
- `valid proposal PDF`
- `customer_email`
- `active SignWell contract template reference`
- `required SignWell field mapping data`
- `pricing totals`
- `line_items`

Optional:

- `shopping_list_items`
- `tax_region_id`
- `proposal notes or snapshot metadata`
- `fallback contract-only signing flag` for future controlled rollout only

## Backend Orchestration Rules

On successful florist submission:

1. Validate finalized proposal data and florist-supplied PDF.
2. Validate that one active SignWell contract template exists.
3. Validate that all required mapped contract fields have source data.
4. Retrieve the active SignWell template reference and contract metadata.
5. Map lead and proposal data into the configured SignWell field set.
6. Generate the filled contract document.
7. Append the filled contract to the submitted proposal PDF.
8. Store the combined package as the canonical proposal review artifact.
9. Record SignWell template and signing metadata on the proposal record.
10. Send the client proposal-access email with the Black Begonia proposal-auth link and passcode.

## Client Portal Rules

After passcode authentication:

- The client remains inside the Black Begonia proposal-access portal.
- The client reviews the canonical combined proposal package.
- The contract portion is signable through embedded SignWell inside the secure portal.
- The client may still:
  - decline with notes
  - exit secure view
  - complete the required signatures

## Decline and Exit Rules

- Decline must remain available even if the embedded signer cannot be loaded.
- Exit secure view must not mark the package as signed or declined.
- Decline and exit behavior must preserve CRM history and future florist follow-up behavior.

## Signing Outputs

Successful signing must produce:

- Updated proposal signing status
- Stored signing completion timestamp
- Stored provider document/session reference
- A recoverable final signed package or signing artifact reference
- CRM-visible proposal history and lead activity updates

## Failure Modes

The system must handle these failures explicitly:

- Missing active SignWell contract template
- Missing required mapped contract data
- Combined-package generation failure
- Incorrect proposal-auth origin configuration
- Embedded SignWell launch failure after client authentication
- Signing status reconciliation or webhook failure

## Fallback Rule

If the canonical combined-package signing path proves unworkable during implementation, the approved fallback is:

- keep Black Begonia portal review of the full combined proposal package
- limit embedded SignWell signing to the contract portion only
- preserve the same passcode-auth entry path and CRM history

This fallback is not the default workflow and requires explicit implementation notes if activated.
