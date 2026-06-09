import {
  buildProposalSubmissionSnapshot,
  decodePdfBase64,
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
