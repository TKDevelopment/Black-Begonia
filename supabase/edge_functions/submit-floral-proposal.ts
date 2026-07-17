import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SubmissionMode = "initial_booking" | "project_revision";

type RequestBody = {
  mode?: SubmissionMode;
  lead_id?: string | null;
  project_id?: string | null;
  floral_proposal_id?: string | null;
  pdf_storage_path?: string | null;
  pdf_file_name?: string | null;
  idempotency_key?: string | null;
};

type LeadRow = {
  lead_id: string;
  service_type: string;
  event_type: string | null;
  first_name: string;
  last_name: string;
  partner_first_name: string | null;
  partner_last_name: string | null;
  email: string;
  phone: string | null;
  event_date: string | null;
  ceremony_venue_name: string | null;
  ceremony_venue_city: string | null;
  ceremony_venue_state: string | null;
  ceremony_venue_address: string | null;
  ceremony_venue_zipcode: string | null;
  reception_venue_name: string | null;
  reception_venue_city: string | null;
  reception_venue_state: string | null;
  reception_venue_address: string | null;
  reception_venue_zipcode: string | null;
  budget_range: string | null;
  guest_count: number | null;
  inquiry_message: string | null;
  status: string;
  assigned_user_id: string | null;
  converted_project_id: string | null;
  converted_primary_contact_id: string | null;
};

type ProposalRow = {
  floral_proposal_id: string;
  lead_id: string;
  version: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  retainer_amount: number | null;
  final_balance_amount: number | null;
  retainer_due_date: string | null;
  final_balance_due_date: string | null;
  snapshot: Record<string, unknown> | null;
};

type SupabaseAdminClient = ReturnType<typeof createClient<any>>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FLORAL_PROPOSAL_BUCKET = Deno.env.get("FLORAL_PROPOSAL_BUCKET") ?? "floral-proposals";
const MAX_PDF_BYTES = 50 * 1024 * 1024;

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
  ].filter(([, value]) => !value.trim()).map(([name]) => name);

  if (missing.length) throw new Error(`Missing required configuration: ${missing.join(", ")}`);
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function optionalUuid(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw new Error("A malformed UUID was supplied.");
  }
  return trimmed;
}

function sanitizeFileName(fileName: string): string {
  return fileName.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ");
}

function projectNameFromLead(lead: LeadRow): string {
  const partner = [lead.partner_first_name, lead.partner_last_name].filter(Boolean).join(" ").trim();
  const client = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim();
  if (partner) return `${client} & ${partner}`;
  return client || lead.email;
}

async function authenticateCrmUser(req: Request, supabase: SupabaseAdminClient): Promise<string> {
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Response("Missing authorization token.", { status: 401 });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Response("Invalid authorization token.", { status: 401 });

  const { data: isInternal, error: roleError } = await supabase.rpc("is_internal_crm_user");
  if (roleError) {
    console.warn(JSON.stringify({ level: "WARN", function: "submit-floral-proposal", message: "Unable to evaluate CRM role through RPC.", error: roleError.message }));
  }

  if (roleError || isInternal !== true) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile) throw new Response("User is not authorized for CRM proposal booking.", { status: 403 });
  }

  return data.user.id;
}

async function verifyStoredPdf(
  supabase: SupabaseAdminClient,
  storagePath: string
): Promise<{ size: number; contentType: string }> {
  const { data, error } = await supabase.storage
    .from(FLORAL_PROPOSAL_BUCKET)
    .download(storagePath);

  if (error || !data) throw new Error("The submitted PDF could not be found in private storage.");

  const contentType = data.type || "application/pdf";
  if (contentType !== "application/pdf") {
    throw new Error("The submitted document must be a PDF.");
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("The submitted PDF is empty.");
  if (bytes.byteLength > MAX_PDF_BYTES) throw new Error("The submitted PDF exceeds the 50 MB storage limit.");

  const header = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.byteLength, 1024)));
  if (!header.startsWith("%PDF-")) throw new Error("The submitted PDF appears to be corrupt.");

  const bodySample = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.byteLength, 1024 * 1024)));
  if (/\/Encrypt\b/.test(bodySample)) {
    throw new Error("Password-protected PDFs cannot be submitted.");
  }

  return { size: bytes.byteLength, contentType };
}

async function getNextVersion(
  supabase: SupabaseAdminClient,
  table: "project_proposal_invoice_snapshots" | "project_proposal_document_versions",
  projectId: string
): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .select("version")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Number(data?.version ?? 0) + 1;
}

async function findExistingDocumentByPath(
  supabase: SupabaseAdminClient,
  storagePath: string
) {
  const { data, error } = await supabase
    .from("project_proposal_document_versions")
    .select("project_proposal_document_version_id, project_id, source_lead_id, source_floral_proposal_id, invoice_snapshot_id, storage_path, submitted_at")
    .eq("storage_bucket", FLORAL_PROPOSAL_BUCKET)
    .eq("storage_path", storagePath)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function resolveProject(
  supabase: SupabaseAdminClient,
  mode: SubmissionMode,
  lead: LeadRow | null,
  projectId: string | null
): Promise<string> {
  if (mode === "project_revision") {
    if (!projectId) throw new Error("project_id is required for project revisions.");
    const { data, error } = await supabase
      .from("projects")
      .select("project_id")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("The selected project could not be found.");
    return projectId;
  }

  if (!lead) throw new Error("lead_id is required for initial booking.");
  if (lead.converted_project_id) return lead.converted_project_id;

  const { data: existingProject, error: existingError } = await supabase
    .from("projects")
    .select("project_id")
    .eq("source_lead_id", lead.lead_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingProject?.project_id) return String(existingProject.project_id);

  const { data, error } = await supabase
    .from("projects")
    .insert({
      project_name: projectNameFromLead(lead),
      service_type: lead.service_type,
      event_type: lead.event_type,
      event_date: lead.event_date,
      ceremony_venue_name: lead.ceremony_venue_name,
      ceremony_venue_city: lead.ceremony_venue_city,
      ceremony_venue_state: lead.ceremony_venue_state,
      ceremony_venue_address: lead.ceremony_venue_address,
      ceremony_venue_zipcode: lead.ceremony_venue_zipcode,
      reception_venue_name: lead.reception_venue_name,
      reception_venue_city: lead.reception_venue_city,
      reception_venue_state: lead.reception_venue_state,
      reception_venue_address: lead.reception_venue_address,
      reception_venue_zipcode: lead.reception_venue_zipcode,
      budget_range: lead.budget_range,
      guest_count: lead.guest_count,
      style_notes: lead.inquiry_message,
      status: "booked",
      source_lead_id: lead.lead_id,
      primary_contact_id: lead.converted_primary_contact_id,
      assigned_user_id: lead.assigned_user_id,
      booked_at: new Date().toISOString(),
    })
    .select("project_id")
    .single();

  if (error) throw error;
  return String(data.project_id);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { success: false, error: "Method not allowed." });

  try {
    requireConfiguration();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userId = await authenticateCrmUser(req, supabase);
    const body = (await req.json()) as RequestBody;

    const mode = body.mode ?? "initial_booking";
    if (mode !== "initial_booking" && mode !== "project_revision") {
      return jsonResponse(400, { success: false, error: "mode must be initial_booking or project_revision." });
    }

    const floralProposalId = optionalUuid(body.floral_proposal_id);
    const leadId = optionalUuid(body.lead_id);
    const projectId = optionalUuid(body.project_id);
    const pdfStoragePath = requiredString(body.pdf_storage_path, "pdf_storage_path");
    const pdfFileName = sanitizeFileName(requiredString(body.pdf_file_name, "pdf_file_name"));
    requiredString(body.idempotency_key, "idempotency_key");

    if (!pdfFileName.toLowerCase().endsWith(".pdf")) {
      return jsonResponse(400, { success: false, error: "The submitted document must use a .pdf file name." });
    }

    const existingDocument = await findExistingDocumentByPath(supabase, pdfStoragePath);
    if (existingDocument) {
      return jsonResponse(200, {
        success: true,
        project_id: existingDocument.project_id,
        lead_id: existingDocument.source_lead_id,
        floral_proposal_id: existingDocument.source_floral_proposal_id,
        proposal_document_version_id: existingDocument.project_proposal_document_version_id,
        active_invoice_snapshot_id: existingDocument.invoice_snapshot_id,
        signed_pdf_storage_path: existingDocument.storage_path,
        submitted_at: existingDocument.submitted_at,
      });
    }

    const pdf = await verifyStoredPdf(supabase, pdfStoragePath);

    const { data: proposal, error: proposalError } = floralProposalId
      ? await supabase
        .from("floral_proposals")
        .select("floral_proposal_id, lead_id, version, subtotal, tax_rate, tax_amount, total_amount, retainer_amount, final_balance_amount, retainer_due_date, final_balance_due_date, snapshot")
        .eq("floral_proposal_id", floralProposalId)
        .maybeSingle()
      : { data: null, error: null };

    if (proposalError) throw proposalError;
    if (floralProposalId && !proposal) {
      return jsonResponse(422, { success: false, error: "The selected floral proposal could not be found." });
    }

    const resolvedLeadId = leadId ?? (proposal as ProposalRow | null)?.lead_id ?? null;
    const { data: lead, error: leadError } = resolvedLeadId
      ? await supabase
        .from("leads")
        .select("lead_id, service_type, event_type, first_name, last_name, partner_first_name, partner_last_name, email, phone, event_date, ceremony_venue_name, ceremony_venue_city, ceremony_venue_state, ceremony_venue_address, ceremony_venue_zipcode, reception_venue_name, reception_venue_city, reception_venue_state, reception_venue_address, reception_venue_zipcode, budget_range, guest_count, inquiry_message, status, assigned_user_id, converted_project_id, converted_primary_contact_id")
        .eq("lead_id", resolvedLeadId)
        .maybeSingle()
      : { data: null, error: null };

    if (leadError) throw leadError;
    if (mode === "initial_booking" && !lead) {
      return jsonResponse(422, { success: false, error: "The selected lead could not be found." });
    }

    const bookedProjectId = await resolveProject(
      supabase,
      mode,
      lead as LeadRow | null,
      projectId
    );

    const version = await getNextVersion(supabase, "project_proposal_invoice_snapshots", bookedProjectId);
    const proposalRow = proposal as ProposalRow | null;

    await supabase
      .from("project_proposal_invoice_snapshots")
      .update({ is_active: false })
      .eq("project_id", bookedProjectId)
      .eq("is_active", true);

    await supabase
      .from("project_proposal_document_versions")
      .update({ is_active: false })
      .eq("project_id", bookedProjectId)
      .eq("is_active", true);

    const now = new Date().toISOString();
    const snapshotBody = {
      ...(proposalRow?.snapshot ?? {}),
      submitted_pdf_file_name: pdfFileName,
      submitted_pdf_storage_path: pdfStoragePath,
      submitted_at: now,
      submission_mode: mode,
    };

    const { data: snapshot, error: snapshotError } = await supabase
      .from("project_proposal_invoice_snapshots")
      .insert({
        project_id: bookedProjectId,
        source_lead_id: (lead as LeadRow | null)?.lead_id ?? null,
        source_floral_proposal_id: proposalRow?.floral_proposal_id ?? null,
        version,
        snapshot: snapshotBody,
        subtotal: proposalRow?.subtotal ?? 0,
        tax_rate: proposalRow?.tax_rate ?? 0,
        tax_amount: proposalRow?.tax_amount ?? 0,
        total_amount: proposalRow?.total_amount ?? 0,
        retainer_amount: proposalRow?.retainer_amount ?? 0,
        final_balance_amount: proposalRow?.final_balance_amount ?? proposalRow?.total_amount ?? 0,
        retainer_due_date: proposalRow?.retainer_due_date ?? null,
        final_balance_due_date: proposalRow?.final_balance_due_date ?? null,
        created_by: userId,
        is_active: true,
      })
      .select("project_proposal_invoice_snapshot_id")
      .single();

    if (snapshotError) throw snapshotError;

    const { data: documentVersion, error: documentError } = await supabase
      .from("project_proposal_document_versions")
      .insert({
        project_id: bookedProjectId,
        source_lead_id: (lead as LeadRow | null)?.lead_id ?? null,
        source_floral_proposal_id: proposalRow?.floral_proposal_id ?? null,
        invoice_snapshot_id: snapshot.project_proposal_invoice_snapshot_id,
        version,
        file_name: pdfFileName,
        storage_bucket: FLORAL_PROPOSAL_BUCKET,
        storage_path: pdfStoragePath,
        content_type: pdf.contentType,
        file_size_bytes: pdf.size,
        uploaded_by: userId,
        submitted_at: now,
        is_active: true,
      })
      .select("project_proposal_document_version_id")
      .single();

    if (documentError) throw documentError;

    const { error: projectUpdateError } = await supabase
      .from("projects")
      .update({
        status: "booked",
        booked_at: now,
        active_proposal_invoice_snapshot_id: snapshot.project_proposal_invoice_snapshot_id,
        active_proposal_document_version_id: documentVersion.project_proposal_document_version_id,
        updated_at: now,
      })
      .eq("project_id", bookedProjectId);

    if (projectUpdateError) throw projectUpdateError;

    if (mode === "initial_booking" && lead) {
      const { error: leadUpdateError } = await supabase
        .from("leads")
        .update({
          status: "converted",
          converted_project_id: bookedProjectId,
          converted_primary_contact_id: lead.converted_primary_contact_id,
          converted_at: now,
          updated_at: now,
        })
        .eq("lead_id", lead.lead_id);

      if (leadUpdateError) throw leadUpdateError;
    }

    if (proposalRow) {
      await supabase
        .from("floral_proposals")
        .update({
          status: "accepted",
          submitted_at: now,
          submitted_by: userId,
          finalized_snapshot: snapshotBody,
          updated_at: now,
        })
        .eq("floral_proposal_id", proposalRow.floral_proposal_id);
    }

    return jsonResponse(200, {
      success: true,
      project_id: bookedProjectId,
      lead_id: (lead as LeadRow | null)?.lead_id ?? null,
      floral_proposal_id: proposalRow?.floral_proposal_id ?? null,
      proposal_document_version_id: documentVersion.project_proposal_document_version_id,
      active_invoice_snapshot_id: snapshot.project_proposal_invoice_snapshot_id,
      signed_pdf_storage_path: pdfStoragePath,
      submitted_at: now,
    });
  } catch (error) {
    if (error instanceof Response) {
      return jsonResponse(error.status, { success: false, error: await error.text() });
    }

    const message = error instanceof Error ? error.message : "Submission failed.";
    const status = /required|malformed|pdf|document|empty|corrupt|password|storage limit/i.test(message)
      ? 400
      : /not found|eligible/i.test(message)
        ? 422
        : 500;

    console.error(JSON.stringify({ level: "ERROR", function: "submit-floral-proposal", message }));
    return jsonResponse(status, { success: false, error: message });
  }
});