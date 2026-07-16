import {
  normalizeEmbeddedSigningUrl,
} from "./verify-floral-proposal-access.ts";
import {
  normalizeSigningStatus,
  readFirstString,
} from "./signwell-webhook.ts";

Deno.test("normalizeEmbeddedSigningUrl prefers webhook snapshot URLs over embedded session ids", () => {
  const snapshotUrl = normalizeEmbeddedSigningUrl({
    provider: "signwell",
    provider_document_id: "document-001",
    provider_embedded_session_id: "session-001",
    status: "ready",
    webhook_payload_snapshot: {
      embedded_signing_url: "https://signwell.example.test/embed/from-snapshot",
    },
    updated_at: "2026-06-10T12:00:00.000Z",
  });

  if (snapshotUrl !== "https://signwell.example.test/embed/from-snapshot") {
    throw new Error(`Expected webhook snapshot URL to be preferred, received "${snapshotUrl}".`);
  }
});

Deno.test("normalizeEmbeddedSigningUrl preserves direct embedded session URLs and safely handles missing sessions", () => {
  const directUrl = normalizeEmbeddedSigningUrl({
    provider: "signwell",
    provider_document_id: "document-001",
    provider_embedded_session_id: "https://signwell.example.test/embed/direct-url",
    status: "ready",
    webhook_payload_snapshot: null,
    updated_at: "2026-06-10T12:00:00.000Z",
  });
  const missingUrl = normalizeEmbeddedSigningUrl(null);

  if (directUrl !== "https://signwell.example.test/embed/direct-url") {
    throw new Error(`Expected direct embedded signing URL to pass through, received "${directUrl}".`);
  }

  if (missingUrl !== null) {
    throw new Error("Expected null when no signing session exists.");
  }
});

Deno.test("normalizeSigningStatus reconciles signwell webhook events into proposal statuses", () => {
  const signed = normalizeSigningStatus("completed", "document.executed");
  const declined = normalizeSigningStatus("voided", "recipient.declined");
  const viewed = normalizeSigningStatus("in_progress", "document.viewed");
  const failed = normalizeSigningStatus("expired", "document.error");
  const ready = normalizeSigningStatus(null, null);

  if (signed !== "signed") {
    throw new Error(`Expected signed status, received "${signed}".`);
  }

  if (declined !== "declined") {
    throw new Error(`Expected declined status, received "${declined}".`);
  }

  if (viewed !== "viewed") {
    throw new Error(`Expected viewed status, received "${viewed}".`);
  }

  if (failed !== "failed") {
    throw new Error(`Expected failed status, received "${failed}".`);
  }

  if (ready !== "ready") {
    throw new Error(`Expected fallback ready status, received "${ready}".`);
  }
});

Deno.test("readFirstString locates floral proposal context across nested webhook payload shapes", () => {
  const payload = {
    data: {
      metadata: {
        floral_proposal_id: "proposal-001",
      },
      recipient: {
        name: "Avery Bloom",
      },
    },
    document: {
      embedded_signing_url: "https://signwell.example.test/embed/proposal-001",
    },
  };

  const floralProposalId = readFirstString(payload, [
    "floral_proposal_id",
    "metadata.floral_proposal_id",
    "data.metadata.floral_proposal_id",
  ]);
  const signerName = readFirstString(payload, [
    "signer_name",
    "recipient.name",
    "data.recipient.name",
  ]);
  const embeddedSigningUrl = readFirstString(payload, [
    "embedded_signing_url",
    "data.embedded_signing_url",
    "document.embedded_signing_url",
  ]);

  if (floralProposalId !== "proposal-001") {
    throw new Error(`Expected floral proposal id proposal-001, received "${floralProposalId}".`);
  }

  if (signerName !== "Avery Bloom") {
    throw new Error(`Expected signer name Avery Bloom, received "${signerName}".`);
  }

  if (embeddedSigningUrl !== "https://signwell.example.test/embed/proposal-001") {
    throw new Error(`Unexpected embedded signing URL: ${embeddedSigningUrl}`);
  }
});
