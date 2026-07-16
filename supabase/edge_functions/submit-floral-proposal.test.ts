import {
  buildCanonicalPackageMetadata,
  buildContractMergeFields,
  buildProposalMergeData,
  buildProposalSubmissionSnapshot,
  decodePdfBase64,
  resolveContractPdfUrl,
  resolvePortalUrl,
  validateRequiredFieldMap,
} from "./submit-floral-proposal.ts";

Deno.test("decodePdfBase64 decodes florist-uploaded proposal PDFs", () => {
  const bytes = decodePdfBase64("JVBERi0=");

  const decoded = new TextDecoder().decode(bytes);
  if (decoded !== "%PDF-") {
    throw new Error(`Expected decoded PDF signature, received "${decoded}"`);
  }
});

Deno.test("buildProposalSubmissionSnapshot marks the proposal as submitted", () => {
  const submittedAt = "2026-06-02T18:30:00.000Z";
  const snapshot = buildProposalSubmissionSnapshot({
    existingSnapshot: {
      proposal_status: "finalized",
      finalized_at: "2026-06-02T17:00:00.000Z",
      edit_reopened_at: "2026-06-02T17:30:00.000Z",
    },
    incomingSnapshot: {
      totals: { total_amount: 831.6 },
    },
    submittedAt,
    pdfFileName: "canva-proposal.pdf",
  });

  if (snapshot["proposal_status"] !== "submitted") {
    throw new Error("Expected proposal_status to be submitted.");
  }

  if (snapshot["submitted_at"] !== submittedAt) {
    throw new Error("Expected submitted_at to match the submission timestamp.");
  }

  if (snapshot["submitted_pdf_file_name"] !== "canva-proposal.pdf") {
    throw new Error("Expected uploaded PDF file name to be preserved.");
  }

  if (snapshot["finalized_at"] !== "2026-06-02T17:00:00.000Z") {
    throw new Error("Expected finalized_at to survive submission snapshot merging.");
  }
});

Deno.test("resolvePortalUrl preserves production delivery hosts over local request origins", () => {
  const resolvedLocal = resolvePortalUrl("http://localhost:4200/proposal/auth");
  const resolvedProduction = resolvePortalUrl(
    "https://blackbegoniaflorals.com/proposal/auth"
  );

  if (resolvedLocal !== "http://localhost:4200/proposal/auth") {
    throw new Error(`Expected unresolved local portal URL in the test environment, received "${resolvedLocal}".`);
  }

  if (resolvedProduction !== "https://blackbegoniaflorals.com/proposal/auth") {
    throw new Error(`Expected production portal URL to be preserved, received "${resolvedProduction}".`);
  }
});

Deno.test("proposal merge validation identifies missing contract fields and ignores reserved metadata", () => {
  const mergeData = buildProposalMergeData({
    lead: {
      lead_id: "lead-test-001",
      first_name: "Avery",
      last_name: "Bloom",
      email: "avery@example.test",
      service_type: "wedding",
      event_type: "wedding",
      event_date: "2026-10-24",
      status: "proposal_submitted",
    },
    proposalVersion: 4,
    subtotal: 770,
    taxRate: 0.08,
    taxAmount: 61.6,
    totalAmount: 831.6,
    lineItemsCount: 3,
  });

  const requiredFieldMap = {
    customer_name: "lead.full_name",
    customer_email: "lead.email",
    proposal_total: {
      source: "proposal.total_amount",
      provider_field_id: "total_due",
    },
    missing_field: "lead.phone",
    __signwell: {
      contract_pdf_url_template:
        "https://provider.example.test/contracts/{{template_id}}/{{template_revision}}",
    },
  };

  const missingFields = validateRequiredFieldMap(requiredFieldMap, mergeData);
  const contractMergeFields = buildContractMergeFields(requiredFieldMap, mergeData);

  if (missingFields.length !== 1 || missingFields[0] !== "missing_field") {
    throw new Error(`Expected only missing_field to fail validation, received ${JSON.stringify(missingFields)}.`);
  }

  if (contractMergeFields["customer_name"] !== "Avery Bloom") {
    throw new Error("Expected customer_name merge field to map to the lead full name.");
  }

  if (contractMergeFields["total_due"] !== 831.6) {
    throw new Error(`Expected provider field total_due to receive the proposal total, received ${JSON.stringify(contractMergeFields["total_due"])}.`);
  }

  if ("__signwell" in contractMergeFields) {
    throw new Error("Reserved provider metadata should not be emitted as a merge field.");
  }
});

Deno.test("canonical package metadata and contract PDF URL resolution preserve the combined package workflow", () => {
  const metadata = buildCanonicalPackageMetadata({
    leadId: "lead-test-001",
    uploadedPdfFileName: "canva-proposal.pdf",
    proposalVersion: 3,
  });

  if (!String(metadata.combinedPdfStoragePath).includes("lead-test-001/floral-proposal-package-v3-")) {
    throw new Error(`Unexpected combined storage path: ${metadata.combinedPdfStoragePath}`);
  }

  if (metadata.combinedPdfFileName !== "canva-proposal.pdf") {
    throw new Error(`Expected uploaded florist PDF file name to be preserved, received "${metadata.combinedPdfFileName}".`);
  }

  const directUrl = resolveContractPdfUrl({
    providerTemplateId: "template-001",
    providerTemplateRevision: "rev-2026",
    providerConfig: {
      contract_pdf_url: "https://provider.example.test/contracts/current.pdf",
    },
  });
  const templatedUrl = resolveContractPdfUrl({
    providerTemplateId: "template-001",
    providerTemplateRevision: "rev-2026",
    providerConfig: {
      contract_pdf_url_template:
        "https://provider.example.test/contracts/{{template_id}}/{{template_revision}}.pdf",
    },
  });

  if (directUrl !== "https://provider.example.test/contracts/current.pdf") {
    throw new Error(`Expected direct contract PDF URL to win, received "${directUrl}".`);
  }

  if (
    templatedUrl !==
    "https://provider.example.test/contracts/template-001/rev-2026.pdf"
  ) {
    throw new Error(`Unexpected templated contract PDF URL: ${templatedUrl}`);
  }
});
