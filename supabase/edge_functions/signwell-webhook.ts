import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SigningSessionLookupRow = {
  proposal_signing_session_id: string;
  floral_proposal_id: string;
  provider: string;
  provider_document_id: string | null;
  provider_embedded_session_id: string | null;
  status: string;
};

type FloralProposalRow = {
  floral_proposal_id: string;
  lead_id: string;
  version: number;
  status: string;
};

type LeadRow = {
  lead_id: string;
  status: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SIGNWELL_WEBHOOK_TOKEN = Deno.env.get("SIGNWELL_WEBHOOK_TOKEN") ?? "";
const ALLOW_UNSIGNED_SIGNWELL_WEBHOOK =
  Deno.env.get("ALLOW_UNSIGNED_SIGNWELL_WEBHOOK") === "true";

const REQUIRED_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const OPTIONAL_ENV_VARS = [
  "SIGNWELL_WEBHOOK_TOKEN",
  "ALLOW_UNSIGNED_SIGNWELL_WEBHOOK",
] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signwell-webhook-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  return { error };
}

function logInfo(message: string, data?: Record<string, unknown>) {
  console.log(
    JSON.stringify({ level: "INFO", function: "signwell-webhook", message, ...data })
  );
}

function logWarn(message: string, data?: Record<string, unknown>) {
  console.warn(
    JSON.stringify({ level: "WARN", function: "signwell-webhook", message, ...data })
  );
}

function logError(message: string, data?: Record<string, unknown>) {
  console.error(
    JSON.stringify({ level: "ERROR", function: "signwell-webhook", message, ...data })
  );
}

function requireEnv(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}

export function requireAuthorizedWebhook(req: Request): boolean {
  if (!SIGNWELL_WEBHOOK_TOKEN.trim()) {
    return ALLOW_UNSIGNED_SIGNWELL_WEBHOOK;
  }

  const headerToken =
    req.headers.get("x-signwell-webhook-token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  return headerToken.trim() === SIGNWELL_WEBHOOK_TOKEN.trim();
}

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object") return undefined;
    return segment in (value as Record<string, unknown>)
      ? (value as Record<string, unknown>)[segment]
      : undefined;
  }, source);
}

export function readFirstString(
  source: Record<string, unknown>,
  paths: string[]
): string | null {
  for (const path of paths) {
    const value = readPath(source, path);
    if (typeof value === "string" && value.trim().length) {
      return value.trim();
    }
  }

  return null;
}

export function normalizeSigningStatus(
  rawStatus: string | null,
  rawEvent: string | null
): "ready" | "viewed" | "signed" | "declined" | "failed" {
  const normalized = `${rawStatus ?? ""} ${rawEvent ?? ""}`.toLowerCase();

  if (
    normalized.includes("signed") ||
    normalized.includes("completed") ||
    normalized.includes("executed")
  ) {
    return "signed";
  }

  if (
    normalized.includes("declined") ||
    normalized.includes("rejected") ||
    normalized.includes("voided") ||
    normalized.includes("cancelled")
  ) {
    return "declined";
  }

  if (
    normalized.includes("failed") ||
    normalized.includes("error") ||
    normalized.includes("expired")
  ) {
    return "failed";
  }

  if (
    normalized.includes("viewed") ||
    normalized.includes("opened") ||
    normalized.includes("reviewed") ||
    normalized.includes("in_progress")
  ) {
    return "viewed";
  }

  return "ready";
}

async function findSigningSession(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
): Promise<SigningSessionLookupRow | null> {
  const floralProposalId = readFirstString(payload, [
    "floral_proposal_id",
    "metadata.floral_proposal_id",
    "data.floral_proposal_id",
    "data.metadata.floral_proposal_id",
    "document.metadata.floral_proposal_id",
  ]);

  if (floralProposalId) {
    const { data, error } = await supabase
      .from("proposal_signing_sessions")
      .select("proposal_signing_session_id, floral_proposal_id, provider, provider_document_id, provider_embedded_session_id, status")
      .eq("floral_proposal_id", floralProposalId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<SigningSessionLookupRow>();

    if (error) throw error;
    if (data) return data;
  }

  const providerDocumentId = readFirstString(payload, [
    "document_id",
    "data.document_id",
    "document.id",
    "data.document.id",
  ]);

  if (providerDocumentId) {
    const { data, error } = await supabase
      .from("proposal_signing_sessions")
      .select("proposal_signing_session_id, floral_proposal_id, provider, provider_document_id, provider_embedded_session_id, status")
      .eq("provider_document_id", providerDocumentId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<SigningSessionLookupRow>();

    if (error) throw error;
    if (data) return data;
  }

  const providerEmbeddedSessionId = readFirstString(payload, [
    "embedded_signing_session_id",
    "embedded_session_id",
    "data.embedded_signing_session_id",
    "data.embedded_session_id",
    "document.embedded_signing_session_id",
  ]);

  if (!providerEmbeddedSessionId) return null;

  const { data, error } = await supabase
    .from("proposal_signing_sessions")
    .select("proposal_signing_session_id, floral_proposal_id, provider, provider_document_id, provider_embedded_session_id, status")
    .eq("provider_embedded_session_id", providerEmbeddedSessionId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<SigningSessionLookupRow>();

  if (error) throw error;
  return data ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { success: false, error: "Method not allowed." });

  if (!requireAuthorizedWebhook(req)) {
    logWarn("Webhook rejected due to invalid token");
    return jsonResponse(401, { success: false, error: "Unauthorized webhook request." });
  }

  try {
    requireEnv("SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);

    logInfo("Environment contract resolved", {
      required_env_vars: REQUIRED_ENV_VARS,
      optional_env_vars: OPTIONAL_ENV_VARS,
      webhook_token_configured: Boolean(SIGNWELL_WEBHOOK_TOKEN.trim()),
      unsigned_webhook_mode: ALLOW_UNSIGNED_SIGNWELL_WEBHOOK,
    });

    if (!SIGNWELL_WEBHOOK_TOKEN.trim() && !ALLOW_UNSIGNED_SIGNWELL_WEBHOOK) {
      logError("Webhook secret missing while unsigned mode is disabled");
      return jsonResponse(503, {
        success: false,
        error:
          "SignWell webhook authentication is not configured. Set SIGNWELL_WEBHOOK_TOKEN or explicitly allow unsigned webhook mode.",
      });
    }

    const payload = (await req.json()) as Record<string, unknown>;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const signingSession = await findSigningSession(supabase, payload);

    if (!signingSession) {
      logWarn("Signing session not found for webhook payload");
      return jsonResponse(202, { success: true, ignored: true });
    }

    const rawStatus = readFirstString(payload, [
      "status",
      "data.status",
      "document.status",
      "data.document.status",
    ]);
    const rawEvent = readFirstString(payload, [
      "event",
      "event_type",
      "type",
      "data.event",
    ]);
    const normalizedStatus = normalizeSigningStatus(rawStatus, rawEvent);
    const providerDocumentId =
      readFirstString(payload, [
        "document_id",
        "data.document_id",
        "document.id",
        "data.document.id",
      ]) ?? signingSession.provider_document_id;
    const providerEmbeddedSessionId =
      readFirstString(payload, [
        "embedded_signing_session_id",
        "embedded_session_id",
        "data.embedded_signing_session_id",
        "data.embedded_session_id",
        "document.embedded_signing_session_id",
      ]) ?? signingSession.provider_embedded_session_id;
    const embeddedSigningUrl = readFirstString(payload, [
      "embedded_signing_url",
      "data.embedded_signing_url",
      "document.embedded_signing_url",
      "signing_url",
    ]);
    const signerName = readFirstString(payload, [
      "signer_name",
      "data.signer_name",
      "recipient.name",
      "data.recipient.name",
    ]);
    const declineReason = readFirstString(payload, [
      "decline_reason",
      "data.decline_reason",
      "message",
      "reason",
    ]);
    const now = new Date().toISOString();

    const { error: signingSessionUpdateError } = await supabase
      .from("proposal_signing_sessions")
      .update({
        provider_document_id: providerDocumentId,
        provider_embedded_session_id: providerEmbeddedSessionId,
        status: normalizedStatus,
        last_synced_at: now,
        last_error_message: null,
        webhook_payload_snapshot: {
          ...payload,
          embedded_signing_url: embeddedSigningUrl,
        },
        updated_at: now,
      })
      .eq("proposal_signing_session_id", signingSession.proposal_signing_session_id);

    if (signingSessionUpdateError) throw signingSessionUpdateError;

    const { data: proposal, error: proposalError } = await supabase
      .from("floral_proposals")
      .select("floral_proposal_id, lead_id, version, status")
      .eq("floral_proposal_id", signingSession.floral_proposal_id)
      .single<FloralProposalRow>();

    if (proposalError || !proposal) throw proposalError ?? new Error("Floral Proposal not found.");

    const proposalPatch: Record<string, unknown> = {
      signing_status: normalizedStatus,
      updated_at: now,
    };

    if (normalizedStatus === "signed") {
      proposalPatch["status"] = "accepted";
      proposalPatch["accepted_at"] = now;
      proposalPatch["signed_at"] = now;
      proposalPatch["signing_completed_at"] = now;
      proposalPatch["signing_declined_at"] = null;
      proposalPatch["signature_name"] = signerName;
    }

    if (normalizedStatus === "declined") {
      proposalPatch["status"] = "declined";
      proposalPatch["declined_at"] = now;
      proposalPatch["signing_declined_at"] = now;
      proposalPatch["signing_completed_at"] = null;
      proposalPatch["decline_feedback"] = declineReason;
    }

    const { error: proposalUpdateError } = await supabase
      .from("floral_proposals")
      .update(proposalPatch)
      .eq("floral_proposal_id", proposal.floral_proposal_id);

    if (proposalUpdateError) throw proposalUpdateError;

    if (normalizedStatus === "signed" || normalizedStatus === "declined") {
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("lead_id, status")
        .eq("lead_id", proposal.lead_id)
        .single<LeadRow>();

      if (leadError || !lead) {
        throw leadError ?? new Error("Lead not found.");
      }

      const nextLeadStatus =
        normalizedStatus === "signed" ? "proposal_accepted" : "proposal_declined";

      const { error: leadUpdateError } = await supabase
        .from("leads")
        .update({ status: nextLeadStatus, updated_at: now })
        .eq("lead_id", lead.lead_id);

      if (leadUpdateError) throw leadUpdateError;

      const { error: activityError } = await supabase.from("lead_activity").insert({
        lead_id: lead.lead_id,
        activity_type: "status_changed",
        activity_label:
          normalizedStatus === "signed"
            ? `Floral Proposal v${proposal.version} signed`
            : `Floral Proposal v${proposal.version} declined`,
        activity_description:
          normalizedStatus === "signed"
            ? "Client completed embedded SignWell signing from the secure proposal portal."
            : declineReason ?? "Client declined the SignWell signing flow.",
        performed_by: null,
        metadata: {
          floral_proposal_id: proposal.floral_proposal_id,
          floral_proposal_version: proposal.version,
          previous_status: lead.status,
          next_status: nextLeadStatus,
          signing_provider: signingSession.provider,
          signing_status: normalizedStatus,
          provider_document_id: providerDocumentId,
          provider_embedded_session_id: providerEmbeddedSessionId,
          signer_name: signerName,
          decline_reason: declineReason,
        },
      });

      if (activityError) throw activityError;
    }

    logInfo("Signing webhook processed", {
      floral_proposal_id: proposal.floral_proposal_id,
      proposal_signing_session_id: signingSession.proposal_signing_session_id,
      signing_status: normalizedStatus,
      raw_event: rawEvent,
      raw_status: rawStatus,
    });

    return jsonResponse(200, { success: true, floral_proposal_id: proposal.floral_proposal_id, signing_status: normalizedStatus });
  } catch (error) {
    logError("Unhandled webhook error", { error: sanitizeError(error) });
    return jsonResponse(500, { success: false, error: error instanceof Error ? error.message : "Unhandled webhook error." });
  }
});
