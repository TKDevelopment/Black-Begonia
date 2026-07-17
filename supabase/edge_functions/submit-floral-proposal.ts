import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  proposalId: string;
  pdfStoragePath: string;
  pdfFileName: string;
  idempotencyKey: string;
  expectedVersion: number;
};

export type ContractLead = {
  lead_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  service_type: string;
  event_date: string | null;
  status: string;
  ceremony_venue_address: string | null;
  ceremony_venue_city: string | null;
  ceremony_venue_state: string | null;
  ceremony_venue_zipcode: string | null;
  reception_venue_address: string | null;
  reception_venue_city: string | null;
  reception_venue_state: string | null;
  reception_venue_zipcode: string | null;
};

export type ProposalRow = {
  floral_proposal_id: string;
  lead_id: string;
  version: number;
  status: string;
  total_amount: number;
  snapshot: Record<string, unknown> | null;
};

type SigningSessionRow = {
  proposal_signing_session_id: string;
  provider_document_id: string | null;
  idempotency_key: string | null;
  send_state: string;
  status: string;
};

type SenderProfile = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
};

export type SignWellTemplateField = { api_id: string; value: string };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SIGNWELL_API_KEY = Deno.env.get("SIGNWELL_API_KEY") ?? "";
const SIGNWELL_TEMPLATE_ID = Deno.env.get("SIGNWELL_TEMPLATE_ID") ?? "";
const SIGNWELL_CLIENT_PLACEHOLDER_NAME =
  Deno.env.get("SIGNWELL_CLIENT_PLACEHOLDER_NAME") ?? "Client";
const SIGNWELL_SENDER_PLACEHOLDER_NAME =
  Deno.env.get("SIGNWELL_SENDER_PLACEHOLDER_NAME") ?? "Document Sender";
const SIGNWELL_SENDER_EMAIL = Deno.env.get("SIGNWELL_SENDER_EMAIL")?.trim().toLowerCase() ?? "";
const SIGNWELL_SENDER_NAME = Deno.env.get("SIGNWELL_SENDER_NAME")?.trim() ?? "";
const SIGNWELL_API_BASE_URL =
  (Deno.env.get("SIGNWELL_API_BASE_URL") ?? "https://www.signwell.com/api/v1").replace(/\/$/, "");
const SIGNWELL_TEST_MODE = Deno.env.get("SIGNWELL_TEST_MODE") === "true";
const FLORAL_PROPOSAL_BUCKET = Deno.env.get("FLORAL_PROPOSAL_BUCKET") ?? "floral-proposals";
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const SIGNED_PDF_URL_TTL_SECONDS = 15 * 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireConfiguration(): void {
  const missing = [
    ["SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
    ["SIGNWELL_API_KEY", SIGNWELL_API_KEY],
    ["SIGNWELL_TEMPLATE_ID", SIGNWELL_TEMPLATE_ID],
    ["SIGNWELL_CLIENT_PLACEHOLDER_NAME", SIGNWELL_CLIENT_PLACEHOLDER_NAME],
  ].filter(([, value]) => !value.trim()).map(([name]) => name);

  if (missing.length) throw new Error(`Missing required configuration: ${missing.join(", ")}`);
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

export function roundCurrency(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function subtractCalendarDays(dateValue: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) throw new Error("eventDate must be a valid date.");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function formatSignWellDateTime(dateValue: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) throw new Error("SignWell date values must use YYYY-MM-DD source dates.");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error("SignWell date values must be valid calendar dates.");
  }

  return date.toISOString();
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function buildCityStateZipcode(
  city: string | null,
  state: string | null,
  zipcode: string | null,
): string {
  const normalizedCity = city?.trim() ?? "";
  const stateZip = [state?.trim().toUpperCase(), zipcode?.trim()].filter(Boolean).join(" ");
  return [normalizedCity, stateZip].filter(Boolean).join(", ");
}

function completeVenue(lead: ContractLead, prefix: "ceremony" | "reception"): boolean {
  const values = prefix === "ceremony"
    ? [lead.ceremony_venue_address, lead.ceremony_venue_city, lead.ceremony_venue_state, lead.ceremony_venue_zipcode]
    : [lead.reception_venue_address, lead.reception_venue_city, lead.reception_venue_state, lead.reception_venue_zipcode];
  return values.every((value) => Boolean(value?.trim()));
}

export function validateServiceVenueData(lead: ContractLead): string[] {
  const service = lead.service_type.trim().toLowerCase();
  const requiresCeremony = ["full-service wedding", "ceremony-only wedding", "elopement"].includes(service);
  const requiresReception = ["full-service wedding", "reception-only wedding"].includes(service);
  const missing: string[] = [];
  if (requiresCeremony && !completeVenue(lead, "ceremony")) missing.push("complete ceremony address");
  if (requiresReception && !completeVenue(lead, "reception")) missing.push("complete reception address");
  return missing;
}

export function buildTemplateFields(args: {
  lead: ContractLead;
  finalBalanceAmount: number;
  retainerAmount: number;
  finalBalanceDueDate: string;
}): SignWellTemplateField[] {
  const { lead } = args;
  if (!lead.event_date) throw new Error("Event date is required.");
  return [
    { api_id: "clientName", value: lead.first_name.trim() },
    { api_id: "serviceType", value: lead.service_type.trim() },
    { api_id: "eventDate", value: formatSignWellDateTime(lead.event_date) },
    { api_id: "ceremonyAddress", value: lead.ceremony_venue_address?.trim() ?? "" },
    { api_id: "ceremonyCityStateZipcode", value: buildCityStateZipcode(lead.ceremony_venue_city, lead.ceremony_venue_state, lead.ceremony_venue_zipcode) },
    { api_id: "receptionAddress", value: lead.reception_venue_address?.trim() ?? "" },
    { api_id: "receptionCityStateZipcode", value: buildCityStateZipcode(lead.reception_venue_city, lead.reception_venue_state, lead.reception_venue_zipcode) },
    { api_id: "clientEmail", value: lead.email.trim().toLowerCase() },
    { api_id: "clientPhone", value: lead.phone?.trim() ?? "" },
    { api_id: "retainerAmount", value: formatCurrency(args.retainerAmount) },
    { api_id: "finalBalanceAmount", value: formatCurrency(args.finalBalanceAmount) },
    { api_id: "finalBalanceDueDate", value: formatSignWellDateTime(args.finalBalanceDueDate) },
    { api_id: "clientFullName", value: `${lead.first_name} ${lead.last_name}`.trim() },
  ];
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}

async function readResponsePrefix(response: Response, byteCount: number): Promise<Uint8Array> {
  if (!response.body) throw new Error("Proposal PDF could not be inspected.");

  const reader = response.body.getReader();
  const prefix = new Uint8Array(byteCount);
  let offset = 0;
  try {
    while (offset < byteCount) {
      const { done, value } = await reader.read();
      if (done) break;
      const bytesToCopy = Math.min(value.length, byteCount - offset);
      prefix.set(value.subarray(0, bytesToCopy), offset);
      offset += bytesToCopy;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return prefix.subarray(0, offset);
}

export function buildSignWellCreatePayload(args: {
  templateId: string;
  placeholderName: string;
  lead: ContractLead;
  proposal: ProposalRow;
  senderName: string;
  senderEmail: string;
  senderPlaceholderName: string;
  pdfFileName: string;
  pdfFileUrl: string;
  templateFields: SignWellTemplateField[];
  testMode: boolean;
}) {
  return {
    test_mode: args.testMode,
    template_id: args.templateId,
    name: `Black Begonia Floral Contract - ${args.lead.first_name} ${args.lead.last_name}`,
    recipients: [{
      id: "1",
      placeholder_name: args.placeholderName,
      name: `${args.lead.first_name} ${args.lead.last_name}`.trim(),
      email: args.lead.email.trim().toLowerCase(),
    }, {
      id: "2",
      placeholder_name: args.senderPlaceholderName,
      name: args.senderName,
      email: args.senderEmail,
    }],
    draft: true,
    embedded_signing: false,
    apply_signing_order: true,
    metadata: {
      floral_proposal_id: args.proposal.floral_proposal_id,
      lead_id: args.lead.lead_id,
      proposal_version: String(args.proposal.version),
    },
    template_fields: args.templateFields,
    files: [{ name: args.pdfFileName, file_url: args.pdfFileUrl }],
  };
}

function providerDocumentId(value: Record<string, unknown>): string | null {
  for (const key of ["id", "document_id"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function signWellOperation(path: string): string {
  if (path === "/document_templates/documents") return "create-from-template request";
  if (path.endsWith("/send")) return "send request";
  if (path.startsWith("/documents/")) return "document lookup";
  return "request";
}

function redactProviderDetail(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"']+/gi, "[URL redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .trim();
}

function collectProviderErrors(
  value: unknown,
  path = "",
  messages: string[] = [],
  depth = 0,
): string[] {
  if (messages.length >= 8 || depth > 6 || value == null) return messages;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const detail = redactProviderDetail(String(value));
    if (detail) messages.push(path ? `${path}: ${detail}` : detail);
    return messages;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectProviderErrors(item, path ? `${path}[${index}]` : `[${index}]`, messages, depth + 1));
    return messages;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = ["errors", "meta"].includes(key) ? path : (path ? `${path}.${key}` : key);
      collectProviderErrors(child, childPath, messages, depth + 1);
      if (messages.length >= 8) break;
    }
  }
  return messages;
}

function providerErrorDetails(body: unknown, responseText: string): string {
  const messages = collectProviderErrors(body);
  if (messages.length) return messages.join("; ").slice(0, 1200);
  return redactProviderDetail(responseText).slice(0, 1200);
}

async function signWellRequest(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const operation = signWellOperation(path);
  const response = await fetch(`${SIGNWELL_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "X-Api-Key": SIGNWELL_API_KEY,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
  }
  if (!response.ok) {
    const details = providerErrorDetails(body, text);
    console.error(JSON.stringify({
      level: "ERROR",
      function: "submit-floral-proposal",
      event: "signwell_request_failed",
      operation,
      provider_status: response.status,
      provider_details: details || null,
    }));
    const message = `SignWell ${operation} failed (${response.status})${details ? `: ${details}` : "."}`;
    throw new Error(message);
  }
  return body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
}

export function isSentStatus(status: unknown): boolean {
  return typeof status === "string" && ["sent", "pending", "viewed", "completed", "declined"].includes(status.toLowerCase());
}

export function isHistoricalTerminalSession(status: string): boolean {
  return ["declined", "completed"].includes(status);
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { success: false, error: "Method not allowed." });

  try {
    requireConfiguration();
    const authorization = req.headers.get("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) return jsonResponse(401, { success: false, error: "Authentication is required." });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) return jsonResponse(401, { success: false, error: "Authentication is invalid." });

    const body = await req.json() as Partial<RequestBody>;
    const proposalId = requiredString(body.proposalId, "proposalId");
    const pdfStoragePath = requiredString(body.pdfStoragePath, "pdfStoragePath");
    const pdfFileName = requiredString(body.pdfFileName, "pdfFileName");
    const idempotencyKey = requiredString(body.idempotencyKey, "idempotencyKey");
    const expectedVersion = Number(body.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new Error("expectedVersion is invalid.");

    const { data: proposalData, error: proposalError } = await supabase
      .from("floral_proposals")
      .select("floral_proposal_id,lead_id,version,status,total_amount,snapshot")
      .eq("floral_proposal_id", proposalId)
      .single();
    if (proposalError || !proposalData) throw proposalError ?? new Error("Proposal not found.");
    const proposal = proposalData as ProposalRow;
    if (proposal.version !== expectedVersion) return jsonResponse(409, { success: false, error: "The proposal changed. Reload before finalizing." });
    if (!["draft", "declined"].includes(proposal.status)) return jsonResponse(409, { success: false, error: "This proposal can no longer be finalized." });
    if (!pdfStoragePath.includes(proposal.lead_id) || !pdfStoragePath.includes(proposal.floral_proposal_id)) {
      return jsonResponse(400, { success: false, error: "The PDF storage path does not belong to this proposal." });
    }

    const { data: leadData, error: leadError } = await supabase
      .from("leads")
      .select("lead_id,first_name,last_name,email,phone,service_type,event_date,status,ceremony_venue_address,ceremony_venue_city,ceremony_venue_state,ceremony_venue_zipcode,reception_venue_address,reception_venue_city,reception_venue_state,reception_venue_zipcode")
      .eq("lead_id", proposal.lead_id)
      .single();
    if (leadError || !leadData) throw leadError ?? new Error("Lead not found.");
    const lead = leadData as ContractLead;
    if (!lead.first_name?.trim() || !lead.last_name?.trim() || !lead.email?.trim() || !lead.event_date) {
      return jsonResponse(422, { success: false, error: "Client name, email, and event date are required." });
    }
    const missingVenues = validateServiceVenueData(lead);
    if (missingVenues.length) return jsonResponse(422, { success: false, error: `Complete the following lead data: ${missingVenues.join(", ")}.` });

    const { data: senderProfileData, error: senderProfileError } = await supabase
      .from("profiles")
      .select("email,first_name,last_name,display_name")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (senderProfileError) throw senderProfileError;
    const senderProfile = senderProfileData as SenderProfile | null;
    const senderEmail = SIGNWELL_SENDER_EMAIL
      || (senderProfile?.email ?? userData.user.email ?? "").trim().toLowerCase();
    if (!senderEmail) {
      return jsonResponse(422, { success: false, error: "The submitting florist needs an email address before sending through SignWell." });
    }
    const senderName = SIGNWELL_SENDER_NAME
      || senderProfile?.display_name?.trim()
      || [senderProfile?.first_name?.trim(), senderProfile?.last_name?.trim()].filter(Boolean).join(" ")
      || String(userData.user.user_metadata?.["full_name"] ?? userData.user.user_metadata?.["name"] ?? "").trim()
      || senderEmail.split("@")[0];
    if (senderEmail === lead.email.trim().toLowerCase()) {
      return jsonResponse(422, {
        success: false,
        error: "The SignWell Document Sender and client must use different email addresses. Configure SIGNWELL_SENDER_EMAIL with the florist's signing email or use a different client email for this test.",
      });
    }

    const finalBalanceAmount = roundCurrency(Number(proposal.total_amount));
    const retainerAmount = roundCurrency(finalBalanceAmount * 0.30);
    const finalBalanceDueDate = subtractCalendarDays(lead.event_date, 30);
    const templateFields = buildTemplateFields({ lead, finalBalanceAmount, retainerAmount, finalBalanceDueDate });

    const { data: existingData, error: sessionLookupError } = await supabase
      .from("proposal_signing_sessions")
      .select("proposal_signing_session_id,provider_document_id,idempotency_key,send_state,status")
      .eq("floral_proposal_id", proposalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sessionLookupError) throw sessionLookupError;
    let session = existingData as SigningSessionRow | null;
    let documentId = session?.provider_document_id ?? null;

    // A declined/completed historical session must never be reused for a new
    // florist revision. Keep the old row for audit and create a fresh document.
    if (session && isHistoricalTerminalSession(session.status)) {
      session = null;
      documentId = null;
    }

    let pdfFileUrl: string | null = null;
    if (!documentId) {
      const storage = supabase.storage.from(FLORAL_PROPOSAL_BUCKET);
      const { data: pdfInfo, error: pdfInfoError } = await storage.info(pdfStoragePath);
      if (pdfInfoError || !pdfInfo) {
        throw pdfInfoError ?? new Error("Proposal PDF metadata could not be retrieved.");
      }

      const pdfSize = Number(pdfInfo.size ?? pdfInfo.metadata?.["size"]);
      if (!Number.isFinite(pdfSize) || pdfSize < 5 || pdfSize > MAX_PDF_BYTES) {
        return jsonResponse(422, {
          success: false,
          error: "The uploaded file is empty, too large, or has unavailable size metadata.",
        });
      }

      const { data: signedPdf, error: signedPdfError } = await storage.createSignedUrl(
        pdfStoragePath,
        SIGNED_PDF_URL_TTL_SECONDS,
      );
      if (signedPdfError || !signedPdf?.signedUrl) {
        throw signedPdfError ?? new Error("A secure proposal PDF URL could not be created.");
      }

      const signatureResponse = await fetch(signedPdf.signedUrl, {
        headers: { Accept: "application/pdf", Range: "bytes=0-4" },
      });
      if (!signatureResponse.ok) {
        await signatureResponse.body?.cancel().catch(() => undefined);
        throw new Error(`Proposal PDF could not be inspected (${signatureResponse.status}).`);
      }
      const pdfPrefix = await readResponsePrefix(signatureResponse, 5);
      if (!hasPdfSignature(pdfPrefix)) {
        return jsonResponse(422, { success: false, error: "The uploaded file is not a valid PDF." });
      }

      pdfFileUrl = signedPdf.signedUrl;
    }

    await supabase.from("floral_proposals").update({
      canva_pdf_storage_path: pdfStoragePath,
      canva_pdf_file_name: pdfFileName,
      pdf_storage_path: pdfStoragePath,
      final_balance_amount: finalBalanceAmount,
      retainer_amount: retainerAmount,
      final_balance_due_date: finalBalanceDueDate,
      retainer_due_date: null,
      updated_at: new Date().toISOString(),
    }).eq("floral_proposal_id", proposalId);

    if (documentId) {
      const providerDocument = await signWellRequest(`/documents/${encodeURIComponent(documentId)}`);
      if (isSentStatus(providerDocument["status"])) {
        const reconciledAt = new Date().toISOString();
        await supabase.from("floral_proposals").update({
          status: "submitted",
          signing_provider: "signwell",
          signing_status: "sent",
          signing_session_reference: documentId,
          submitted_at: reconciledAt,
          finalized_at: reconciledAt,
          submitted_by: userData.user.id,
          updated_at: reconciledAt,
        }).eq("floral_proposal_id", proposalId);
        await supabase.from("proposal_signing_sessions").update({
          send_state: "sent",
          status: "sent",
          last_synced_at: reconciledAt,
          last_error_message: null,
          updated_at: reconciledAt,
        }).eq("provider_document_id", documentId);
        if (["nurturing", "proposal_declined"].includes(lead.status)) {
          await supabase.from("leads").update({ status: "proposal_submitted", updated_at: reconciledAt })
            .eq("lead_id", lead.lead_id);
        }
        if (proposal.status !== "submitted") {
          await supabase.from("lead_activity").insert({
            lead_id: lead.lead_id,
            activity_type: "proposal_sent",
            activity_label: `Floral Proposal v${proposal.version} send reconciled`,
            activity_description: "The existing SignWell document was confirmed as sent without creating a duplicate.",
            performed_by: userData.user.id,
            metadata: { floral_proposal_id: proposalId, provider_document_id: documentId, reconciled: true },
          });
        }
        return jsonResponse(200, {
          success: true,
          floral_proposal_id: proposalId,
          version: proposal.version,
          signwell_document_id: documentId,
          signing_status: String(providerDocument["status"]),
          pdf_storage_path: pdfStoragePath,
        });
      }
    } else {
      const createPayload = buildSignWellCreatePayload({
        templateId: SIGNWELL_TEMPLATE_ID,
        placeholderName: SIGNWELL_CLIENT_PLACEHOLDER_NAME,
        lead,
        proposal,
        senderName,
        senderEmail,
        senderPlaceholderName: SIGNWELL_SENDER_PLACEHOLDER_NAME,
        pdfFileName,
        pdfFileUrl: pdfFileUrl!,
        templateFields,
        testMode: SIGNWELL_TEST_MODE,
      });
      const created = await signWellRequest("/document_templates/documents", {
        method: "POST",
        body: JSON.stringify(createPayload),
      });
      documentId = providerDocumentId(created);
      if (!documentId) throw new Error("SignWell did not return a document ID.");

      const sessionPayload = {
        floral_proposal_id: proposalId,
        provider: "signwell",
        provider_document_id: documentId,
        idempotency_key: idempotencyKey,
        send_state: "draft_created",
        status: "draft_created",
        last_synced_at: new Date().toISOString(),
        last_error_message: null,
      };
      const write = session
        ? supabase.from("proposal_signing_sessions").update(sessionPayload).eq("proposal_signing_session_id", session.proposal_signing_session_id)
        : supabase.from("proposal_signing_sessions").insert(sessionPayload);
      const { error: sessionWriteError } = await write;
      if (sessionWriteError) throw sessionWriteError;
    }

    await supabase.from("proposal_signing_sessions").update({ send_state: "sending", status: "sending", updated_at: new Date().toISOString() })
      .eq("provider_document_id", documentId);

    let sent: Record<string, unknown>;
    try {
      sent = await signWellRequest(`/documents/${encodeURIComponent(documentId)}/send`, {
        method: "POST",
        body: JSON.stringify({ test_mode: SIGNWELL_TEST_MODE, apply_signing_order: true, embedded_signing: false }),
      });
    } catch (sendError) {
      const reconciled = await signWellRequest(`/documents/${encodeURIComponent(documentId)}`);
      if (!isSentStatus(reconciled["status"])) {
        await supabase.from("proposal_signing_sessions").update({ send_state: "failed", status: "failed", last_error_message: sendError instanceof Error ? sendError.message : "Send failed." })
          .eq("provider_document_id", documentId);
        throw sendError;
      }
      sent = reconciled;
    }

    const now = new Date().toISOString();
    const { error: proposalUpdateError } = await supabase.from("floral_proposals").update({
      status: "submitted",
      signing_provider: "signwell",
      signing_status: "sent",
      signing_session_reference: documentId,
      submitted_at: now,
      finalized_at: now,
      submitted_by: userData.user.id,
      updated_at: now,
    }).eq("floral_proposal_id", proposalId);
    if (proposalUpdateError) throw proposalUpdateError;

    await supabase.from("proposal_signing_sessions").update({ send_state: "sent", status: "sent", last_synced_at: now, last_error_message: null, updated_at: now })
      .eq("provider_document_id", documentId);
    const previousLeadStatus = lead.status;
    if (["nurturing", "proposal_declined"].includes(previousLeadStatus)) {
      await supabase.from("leads").update({ status: "proposal_submitted", updated_at: now }).eq("lead_id", lead.lead_id);
    }
    if (previousLeadStatus !== "proposal_submitted") {
      await supabase.from("lead_activity").insert({
        lead_id: lead.lead_id,
        activity_type: "proposal_sent",
        activity_label: `Floral Proposal v${proposal.version} sent for signature`,
        activity_description: "SignWell emailed the contract and appended Canva proposal directly to the client.",
        performed_by: userData.user.id,
        metadata: { floral_proposal_id: proposalId, provider_document_id: documentId, previous_status: previousLeadStatus, next_status: "proposal_submitted" },
      });
    }

    return jsonResponse(200, {
      success: true,
      floral_proposal_id: proposalId,
      version: proposal.version,
      signwell_document_id: documentId,
      signing_status: String(sent["status"] ?? "sent"),
      pdf_storage_path: pdfStoragePath,
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "ERROR", function: "submit-floral-proposal", message: error instanceof Error ? error.message : "Submission failed" }));
    return jsonResponse(500, { success: false, error: error instanceof Error ? error.message : "Floral Proposal submission failed." });
  }
}

if (import.meta.main) serve(handleRequest);
