import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SIGNWELL_API_KEY = Deno.env.get("SIGNWELL_API_KEY") ?? "";
const SIGNWELL_WEBHOOK_TOKEN = Deno.env.get("SIGNWELL_WEBHOOK_TOKEN") ?? "";
const SIGNWELL_CLIENT_PLACEHOLDER_NAME = Deno.env.get("SIGNWELL_CLIENT_PLACEHOLDER_NAME") ?? "Client";
const SIGNWELL_API_BASE_URL =
  (Deno.env.get("SIGNWELL_API_BASE_URL") ?? "https://www.signwell.com/api/v1").replace(/\/$/, "");
const FLORAL_PROPOSAL_BUCKET = Deno.env.get("FLORAL_PROPOSAL_BUCKET") ?? "floral-proposals";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-signwell-webhook-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[segment];
  }, source);
}

export function readFirstString(source: Record<string, unknown>, paths: string[]): string | null {
  for (const path of paths) {
    const value = readPath(source, path);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function requireAuthorizedWebhook(req: Request, configuredToken = SIGNWELL_WEBHOOK_TOKEN): boolean {
  if (!configuredToken.trim()) return false;
  const urlToken = new URL(req.url).searchParams.get("token") ?? "";
  const headerToken = req.headers.get("x-signwell-webhook-token") ?? "";
  const supplied = urlToken.trim() || headerToken.trim();
  return safeEqual(supplied, configuredToken.trim());
}

export function normalizeDateValue(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
}

function visitObjects(value: unknown, visitor: (record: Record<string, unknown>) => string | null): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = visitObjects(item, visitor);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const direct = visitor(record);
  if (direct) return direct;
  for (const nested of Object.values(record)) {
    const found = visitObjects(nested, visitor);
    if (found) return found;
  }
  return null;
}

export function extractDateSigned(document: Record<string, unknown>): string | null {
  return visitObjects(document, (record) => {
    if (record["api_id"] !== "dateSigned") return null;
    const value = record["value"] ?? record["default_value"];
    return typeof value === "string" ? normalizeDateValue(value) : null;
  });
}

export function extractClientSignedAt(document: Record<string, unknown>, customerEmail: string): string | null {
  return visitObjects(document["recipients"], (record) => {
    const placeholder = typeof record["placeholder_name"] === "string" ? record["placeholder_name"] : "";
    const email = typeof record["email"] === "string" ? record["email"] : "";
    if (placeholder !== SIGNWELL_CLIENT_PLACEHOLDER_NAME && email.toLowerCase() !== customerEmail.toLowerCase()) return null;
    const signedAt = record["signed_at"];
    return typeof signedAt === "string" ? normalizeDateValue(signedAt) : null;
  });
}

export function resolveRetainerDueDate(dateSigned: string | null, signedAt: string | null): {
  date: string | null;
  mismatch: boolean;
  recovered: boolean;
} {
  const primary = normalizeDateValue(dateSigned);
  const fallback = normalizeDateValue(signedAt);
  return {
    date: primary ?? fallback,
    mismatch: Boolean(primary && fallback && primary !== fallback),
    recovered: !primary && Boolean(fallback),
  };
}

async function signWellDocument(documentId: string): Promise<Record<string, unknown>> {
  const providerResponse = await fetch(`${SIGNWELL_API_BASE_URL}/documents/${encodeURIComponent(documentId)}`, {
    headers: { "X-Api-Key": SIGNWELL_API_KEY, Accept: "application/json" },
  });
  if (!providerResponse.ok) throw new Error(`Unable to verify SignWell document (${providerResponse.status}).`);
  return await providerResponse.json() as Record<string, unknown>;
}

async function saveCompletedPdf(
  supabase: any,
  document: Record<string, unknown>,
  documentId: string,
  leadId: string,
  proposalId: string,
): Promise<string | null> {
  const completedUrl = readFirstString(document, ["completed_pdf_url", "completed_pdf.url"]);
  let pdfResponse: Response;
  if (completedUrl) {
    pdfResponse = await fetch(completedUrl);
  } else {
    pdfResponse = await fetch(`${SIGNWELL_API_BASE_URL}/documents/${encodeURIComponent(documentId)}/completed_pdf`, {
      headers: { "X-Api-Key": SIGNWELL_API_KEY, Accept: "application/pdf" },
    });
  }
  if (!pdfResponse.ok) return null;
  const bytes = new Uint8Array(await pdfResponse.arrayBuffer());
  if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return null;
  const path = `${leadId}/${proposalId}/signwell-completed.pdf`;
  const { error } = await supabase.storage.from(FLORAL_PROPOSAL_BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    cacheControl: "3600",
    upsert: true,
  });
  return error ? null : path;
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return response(405, { success: false, error: "Method not allowed." });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SIGNWELL_API_KEY || !SIGNWELL_WEBHOOK_TOKEN) {
    return response(503, { success: false, error: "Webhook configuration is incomplete." });
  }
  if (!requireAuthorizedWebhook(req)) return response(401, { success: false, error: "Unauthorized webhook." });

  try {
    const payload = await req.json() as Record<string, unknown>;
    const eventName = readFirstString(payload, [
      "event",
      "event.type",
      "event_type",
      "type",
      "name",
      "data.event",
      "data.event_type",
      "data.type",
    ]);
    if (!eventName || !["document_completed", "document_declined"].includes(eventName)) {
      return response(200, { success: true, ignored: true, event: eventName });
    }
    const documentId = readFirstString(payload, ["document.id", "document_id", "data.document.id", "data.document_id", "id"]);
    if (!documentId) return response(400, { success: false, error: "Document ID is required." });

    const document = await signWellDocument(documentId);
    const verifiedStatus = readFirstString(document, ["status", "document.status"])?.toLowerCase() ?? "";
    const completed = eventName === "document_completed" && verifiedStatus === "completed";
    const declined = eventName === "document_declined" && verifiedStatus === "declined";
    if (!completed && !declined) {
      return response(202, { success: true, ignored: true, reason: "Provider state is not terminal." });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: session, error: sessionError } = await supabase
      .from("proposal_signing_sessions")
      .select("proposal_signing_session_id,floral_proposal_id,status")
      .eq("provider_document_id", documentId)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return response(404, { success: false, error: "Signing session not found." });

    const { data: proposal, error: proposalError } = await supabase
      .from("floral_proposals")
      .select("floral_proposal_id,lead_id,version,status,customer_email,retainer_due_date")
      .eq("floral_proposal_id", session.floral_proposal_id)
      .single();
    if (proposalError || !proposal) throw proposalError ?? new Error("Proposal not found.");
    const nextProposalStatus = completed ? "accepted" : "declined";
    if (proposal.status === nextProposalStatus) {
      return response(200, { success: true, replayed: true, floral_proposal_id: proposal.floral_proposal_id });
    }
    if (["accepted", "declined"].includes(proposal.status) && proposal.status !== nextProposalStatus) {
      return response(409, { success: false, error: "Conflicting terminal proposal state." });
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads").select("lead_id,status").eq("lead_id", proposal.lead_id).single();
    if (leadError || !lead) throw leadError ?? new Error("Lead not found.");
    const now = new Date().toISOString();
    let retainerDueDate: string | null = null;
    let signedPackagePath: string | null = null;
    let dateResolution = { date: null as string | null, mismatch: false, recovered: false };

    if (completed) {
      dateResolution = resolveRetainerDueDate(
        extractDateSigned(document),
        extractClientSignedAt(document, proposal.customer_email),
      );
      retainerDueDate = dateResolution.date;
      signedPackagePath = await saveCompletedPdf(
        supabase,
        document,
        documentId,
        proposal.lead_id,
        proposal.floral_proposal_id,
      );
    }

    const proposalPatch = completed ? {
      status: "accepted",
      signing_status: "completed",
      signing_completed_at: now,
      signed_at: now,
      accepted_at: now,
      retainer_due_date: retainerDueDate,
      signed_package_storage_path: signedPackagePath,
      updated_at: now,
    } : {
      status: "declined",
      signing_status: "declined",
      signing_declined_at: now,
      declined_at: now,
      updated_at: now,
    };
    const { error: updateProposalError } = await supabase.from("floral_proposals")
      .update(proposalPatch).eq("floral_proposal_id", proposal.floral_proposal_id);
    if (updateProposalError) throw updateProposalError;

    const nextLeadStatus = completed ? "proposal_accepted" : "proposal_declined";
    const { error: updateLeadError } = await supabase.from("leads")
      .update({ status: nextLeadStatus, updated_at: now }).eq("lead_id", proposal.lead_id);
    if (updateLeadError) throw updateLeadError;

    await supabase.from("proposal_signing_sessions").update({
      status: completed ? "completed" : "declined",
      send_state: "sent",
      last_synced_at: now,
      last_error_message: null,
      webhook_payload_snapshot: payload,
      updated_at: now,
    }).eq("proposal_signing_session_id", session.proposal_signing_session_id);

    await supabase.from("lead_activity").insert({
      lead_id: proposal.lead_id,
      activity_type: completed ? "proposal_accepted" : "proposal_declined",
      activity_label: completed ? `Floral Proposal v${proposal.version} contract completed` : `Floral Proposal v${proposal.version} contract declined`,
      activity_description: completed ? "SignWell verified that the client completed the contract." : "SignWell verified that the client declined the contract.",
      performed_by: null,
      metadata: {
        floral_proposal_id: proposal.floral_proposal_id,
        provider_document_id: documentId,
        previous_status: lead.status,
        next_status: nextLeadStatus,
        retainer_due_date: retainerDueDate,
        date_signed_mismatch: dateResolution.mismatch,
        date_signed_recovered: dateResolution.recovered,
      },
    });

    return response(200, {
      success: true,
      floral_proposal_id: proposal.floral_proposal_id,
      signing_status: completed ? "completed" : "declined",
      retainer_due_date: retainerDueDate,
      signed_package_storage_path: signedPackagePath,
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "ERROR", function: "signwell-webhook", message: error instanceof Error ? error.message : "Webhook failed" }));
    return response(500, { success: false, error: error instanceof Error ? error.message : "Webhook failed." });
  }
}

if (import.meta.main) serve(handleRequest);
