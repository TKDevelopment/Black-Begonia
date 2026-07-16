import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type FloralProposalRow = {
  floral_proposal_id: string;
  lead_id: string;
  version: number;
  customer_email: string;
  passcode_hash: string;
  pdf_storage_path: string | null;
  pdf_url: string | null;
  combined_pdf_storage_path: string | null;
  combined_pdf_file_name: string | null;
  signing_provider: string | null;
  signing_status: string | null;
  signing_session_reference: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  decline_feedback: string | null;
  is_active: boolean;
  status: string;
  snapshot: Record<string, unknown> | null;
  created_at: string;
};

type LeadRow = {
  lead_id: string;
  first_name: string;
  last_name: string;
  service_type: string;
  event_type: string | null;
  event_date: string | null;
};

type SigningSessionRow = {
  provider: string;
  provider_document_id: string | null;
  provider_embedded_session_id: string | null;
  status: string;
  webhook_payload_snapshot: Record<string, unknown> | null;
  updated_at: string;
};

type RequestBody = {
  email?: string;
  passcode?: string;
  floral_proposal_id?: string;
  access_token?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROPOSAL_ACCESS_SIGNING_KEY = Deno.env.get("PROPOSAL_ACCESS_SIGNING_KEY")!;
const PROPOSAL_SIGNED_URL_TTL_SECONDS = Number(Deno.env.get("PROPOSAL_SIGNED_URL_TTL_SECONDS") ?? "3600");
const FLORAL_PROPOSAL_BUCKET = Deno.env.get("FLORAL_PROPOSAL_BUCKET") ?? "floral-proposals";
const SIGNWELL_EMBEDDED_SIGNING_URL_TEMPLATE =
  Deno.env.get("SIGNWELL_EMBEDDED_SIGNING_URL_TEMPLATE") ?? "";

const REQUIRED_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PROPOSAL_ACCESS_SIGNING_KEY",
] as const;

const OPTIONAL_ENV_VARS = [
  "PROPOSAL_SIGNED_URL_TTL_SECONDS",
  "FLORAL_PROPOSAL_BUCKET",
  "SIGNWELL_EMBEDDED_SIGNING_URL_TEMPLATE",
] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function requireEnv(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { error };
}

function logInfo(message: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "INFO", function: "verify-floral-proposal-access", message, ...data }));
}

function logWarn(message: string, data?: Record<string, unknown>) {
  console.warn(JSON.stringify({ level: "WARN", function: "verify-floral-proposal-access", message, ...data }));
}

function logError(message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "ERROR", function: "verify-floral-proposal-access", message, ...data }));
}

export function normalizeEmbeddedSigningUrl(
  signingSession: SigningSessionRow | null
): string | null {
  if (!signingSession) return null;

  const snapshotUrl = signingSession.webhook_payload_snapshot?.["embedded_signing_url"];
  if (typeof snapshotUrl === "string" && snapshotUrl.trim().length) {
    return snapshotUrl.trim();
  }

  const embeddedSessionValue = signingSession.provider_embedded_session_id?.trim();
  if (!embeddedSessionValue) return null;

  if (/^https?:\/\//i.test(embeddedSessionValue)) {
    return embeddedSessionValue;
  }

  if (SIGNWELL_EMBEDDED_SIGNING_URL_TEMPLATE.includes("{{session_id}}")) {
    return SIGNWELL_EMBEDDED_SIGNING_URL_TEMPLATE.replace(
      "{{session_id}}",
      encodeURIComponent(embeddedSessionValue)
    );
  }

  return null;
}

function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createHmacSignature(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(PROPOSAL_ACCESS_SIGNING_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
  return toBase64Url(new Uint8Array(signature));
}

async function createAccessToken(payload: Record<string, unknown>): Promise<string> {
  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await createHmacSignature(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function verifyAccessToken(token: string): Promise<{ floral_proposal_id: string; email: string; exp: number } | null> {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await createHmacSignature(encodedPayload);
  if (signature !== expectedSignature) return null;

  const payloadJson = new TextDecoder().decode(fromBase64Url(encodedPayload));
  const payload = JSON.parse(payloadJson) as {
    floral_proposal_id: string;
    email: string;
    exp: number;
  };

  if (!payload.exp || Date.now() >= payload.exp * 1000) return null;
  return payload;
}

async function hashPasscode(passcode: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(passcode));
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    requireEnv("SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
    requireEnv("PROPOSAL_ACCESS_SIGNING_KEY", PROPOSAL_ACCESS_SIGNING_KEY);

    logInfo("Environment contract resolved", {
      required_env_vars: REQUIRED_ENV_VARS,
      optional_env_vars: OPTIONAL_ENV_VARS,
      signed_url_ttl_seconds: PROPOSAL_SIGNED_URL_TTL_SECONDS,
      floral_proposal_bucket: FLORAL_PROPOSAL_BUCKET,
      has_embedded_signing_url_template:
        SIGNWELL_EMBEDDED_SIGNING_URL_TEMPLATE.includes("{{session_id}}"),
    });

    const body = await req.json() as RequestBody;
    const email = String(body.email ?? "").trim().toLowerCase();
    const passcode = String(body.passcode ?? "").trim();
    const floralProposalId = String(body.floral_proposal_id ?? "").trim();
    const accessToken = String(body.access_token ?? "").trim();
    const isRefreshRequest = Boolean(floralProposalId && accessToken);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let verifiedEmail = email;
    let proposal: FloralProposalRow | undefined;

    if (isRefreshRequest) {
      const tokenPayload = await verifyAccessToken(accessToken);
      if (!tokenPayload || tokenPayload.floral_proposal_id !== floralProposalId) {
        logWarn("Proposal access refresh denied", { floral_proposal_id: floralProposalId });
        return jsonResponse(401, {
          success: false,
          error: "Your Floral Proposal access session is invalid or expired.",
        });
      }

      verifiedEmail = tokenPayload.email.trim().toLowerCase();

      const { data: refreshedProposal, error: proposalError } = await supabase
        .from("floral_proposals")
        .select("floral_proposal_id, lead_id, version, customer_email, passcode_hash, pdf_storage_path, pdf_url, combined_pdf_storage_path, combined_pdf_file_name, signing_provider, signing_status, signing_session_reference, accepted_at, declined_at, decline_feedback, is_active, status, snapshot, created_at")
        .eq("floral_proposal_id", floralProposalId)
        .maybeSingle<FloralProposalRow>();

      if (proposalError) {
        logError("Proposal refresh lookup failed", {
          floral_proposal_id: floralProposalId,
          error: sanitizeError(proposalError),
        });
        return jsonResponse(500, { success: false, error: "Unable to refresh Floral Proposal access." });
      }

      if (
        !refreshedProposal ||
        !refreshedProposal.is_active ||
        refreshedProposal.customer_email.trim().toLowerCase() !== verifiedEmail
      ) {
        return jsonResponse(401, {
          success: false,
          error: "Your Floral Proposal access session is invalid.",
        });
      }

      proposal = refreshedProposal;
    } else {
      if (!email) return jsonResponse(400, { success: false, error: "Missing email." });
      if (!/^\d{6}$/.test(passcode)) return jsonResponse(400, { success: false, error: "Missing or invalid passcode." });

      const passcodeHash = await hashPasscode(passcode);

      const { data: proposals, error: proposalsError } = await supabase
        .from("floral_proposals")
        .select("floral_proposal_id, lead_id, version, customer_email, passcode_hash, pdf_storage_path, pdf_url, combined_pdf_storage_path, combined_pdf_file_name, signing_provider, signing_status, signing_session_reference, accepted_at, declined_at, decline_feedback, is_active, status, snapshot, created_at")
        .eq("customer_email", email)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .returns<FloralProposalRow[]>();

      if (proposalsError) {
        logError("Proposal lookup failed", { error: sanitizeError(proposalsError) });
        return jsonResponse(500, { success: false, error: "Unable to verify Floral Proposal access." });
      }

      proposal = (proposals ?? []).find(
        (row) => row.passcode_hash === passcodeHash && row.status === "submitted"
      );
      if (!proposal) {
        logWarn("Proposal access denied", { email });
        return jsonResponse(200, { success: false, error: "The email or passcode is not valid." });
      }
    }

    if (!proposal) {
      return jsonResponse(404, {
        success: false,
        error: "Floral Proposal not found.",
      });
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("lead_id, first_name, last_name, service_type, event_type, event_date")
      .eq("lead_id", proposal.lead_id)
      .single<LeadRow>();

    if (leadError || !lead) {
      logError("Lead lookup failed", { floral_proposal_id: proposal.floral_proposal_id, error: leadError ? sanitizeError(leadError) : null });
      return jsonResponse(404, { success: false, error: "Proposal lead not found." });
    }

    const { data: signingSession, error: signingSessionError } = await supabase
      .from("proposal_signing_sessions")
      .select("provider, provider_document_id, provider_embedded_session_id, status, webhook_payload_snapshot, updated_at")
      .eq("floral_proposal_id", proposal.floral_proposal_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<SigningSessionRow>();

    if (signingSessionError) {
      logError("Signing session lookup failed", {
        floral_proposal_id: proposal.floral_proposal_id,
        error: sanitizeError(signingSessionError),
      });
      return jsonResponse(500, { success: false, error: "Unable to load Floral Proposal signing details." });
    }

    const reviewStoragePath = proposal.combined_pdf_storage_path ?? proposal.pdf_storage_path;
    let pdfUrl = proposal.pdf_url;
    if (reviewStoragePath) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage.from(FLORAL_PROPOSAL_BUCKET).createSignedUrl(reviewStoragePath, PROPOSAL_SIGNED_URL_TTL_SECONDS);
      if (signedUrlError || !signedUrlData?.signedUrl) {
        logError("Signed URL creation failed", { floral_proposal_id: proposal.floral_proposal_id, error: signedUrlError ? sanitizeError(signedUrlError) : null });
        return jsonResponse(500, { success: false, error: "Unable to generate a secure Floral Proposal link." });
      }
      pdfUrl = signedUrlData.signedUrl;
    }

    const authenticatedAt = new Date();
    const expiresAt = new Date(authenticatedAt.getTime() + PROPOSAL_SIGNED_URL_TTL_SECONDS * 1000);
    const nextAccessToken = await createAccessToken({
      floral_proposal_id: proposal.floral_proposal_id,
      email: verifiedEmail,
      exp: Math.floor(expiresAt.getTime() / 1000),
    });
    const submittedFileName =
      typeof proposal.snapshot?.["submitted_pdf_file_name"] === "string" &&
      proposal.snapshot["submitted_pdf_file_name"].trim().length
        ? proposal.snapshot["submitted_pdf_file_name"].trim()
        : `floral-proposal-v${proposal.version}.pdf`;
    const responseAction =
      proposal.status === "accepted"
        ? "accept"
        : proposal.status === "declined"
          ? "decline"
          : null;
    const respondedAt =
      responseAction === "accept"
        ? proposal.accepted_at
        : responseAction === "decline"
          ? proposal.declined_at
          : null;
    const embeddedSigningUrl = normalizeEmbeddedSigningUrl(signingSession ?? null);

    logInfo("Floral Proposal access granted", {
      floral_proposal_id: proposal.floral_proposal_id,
      lead_id: lead.lead_id,
      email: verifiedEmail,
      expires_at: expiresAt.toISOString(),
      refreshed: isRefreshRequest,
    });

    return jsonResponse(200, {
      success: true,
      session: {
        floral_proposal_id: proposal.floral_proposal_id,
        lead_id: lead.lead_id,
        customer_email: proposal.customer_email,
        client_name: `${lead.first_name} ${lead.last_name}`.trim(),
        service_type: lead.service_type,
        event_type: lead.event_type,
        event_date: lead.event_date,
        proposal_version: proposal.version,
        version: proposal.version,
        file_name: proposal.combined_pdf_file_name ?? submittedFileName,
        pdf_url: pdfUrl,
        combined_pdf_url: pdfUrl,
        combined_file_name: proposal.combined_pdf_file_name ?? submittedFileName,
        signing_provider: signingSession?.provider ?? proposal.signing_provider,
        signing_status: signingSession?.status ?? proposal.signing_status,
        signing_session_reference: proposal.signing_session_reference,
        embedded_signing_url: embeddedSigningUrl,
        access_token: nextAccessToken,
        authenticated_at: authenticatedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        response_action: responseAction,
        response_feedback:
          responseAction === "decline" ? proposal.decline_feedback : null,
        responded_at: respondedAt,
      },
    });
  } catch (error) {
    logError("Unhandled function error", { error: sanitizeError(error) });
    return jsonResponse(500, { success: false, error: error instanceof Error ? error.message : "Unhandled server error." });
  }
});
