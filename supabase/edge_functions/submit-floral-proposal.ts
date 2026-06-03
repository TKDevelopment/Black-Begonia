import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type LeadRow = {
  lead_id: string;
  first_name: string;
  last_name: string;
  email: string;
  service_type: string;
  event_type: string | null;
  event_date: string | null;
  status: string;
};

type FloralProposalRow = {
  floral_proposal_id: string;
  version: number;
  is_active: boolean;
  status: string;
  snapshot?: Record<string, unknown> | null;
};

type MailgunSuccessResponse = {
  id: string;
  message: string;
};

type EmailMessageRow = {
  email_message_id: string;
};

type RequestLineComponent = {
  display_order: number;
  catalog_item_id?: string | null;
  catalog_item_name: string;
  quantity_per_unit: number;
  extended_quantity: number;
  base_unit_cost: number;
  applied_markup_percent: number;
  sell_unit_price: number;
  subtotal: number;
  reserve_percent?: number;
  snapshot?: Record<string, unknown>;
};

type RequestLineItem = {
  display_order: number;
  line_item_type: "product" | "fee" | "discount";
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  description?: string | null;
  image_storage_path?: string | null;
  image_alt_text?: string | null;
  image_caption?: string | null;
  notes?: string | null;
  snapshot?: Record<string, unknown>;
  components?: RequestLineComponent[];
};

type RequestBody = {
  floral_proposal_id?: string | null;
  lead_id: string;
  tax_region_id?: string | null;
  portal_url?: string | null;
  line_items: RequestLineItem[];
  shopping_list_items?: Record<string, unknown>[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  terms_version?: string;
  privacy_policy_version?: string;
  snapshot?: Record<string, unknown>;
  pdf_base64?: string | null;
  pdf_file_name?: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROPOSAL_ACCESS_SIGNING_KEY = Deno.env.get("PROPOSAL_ACCESS_SIGNING_KEY")!;
const MG_API_KEY = Deno.env.get("MG_API_KEY")!;
const MG_BASE_URL = Deno.env.get("MG_BASE_URL")!;
const MG_DOMAIN = Deno.env.get("MG_DOMAIN")!;
const MG_FROM_EMAIL = Deno.env.get("MG_FROM_EMAIL")!;
const MG_TO_REPLY = Deno.env.get("MG_TO_REPLY")!;
const CLIENT_PORTAL_PROPOSAL_URL = Deno.env.get("CLIENT_PORTAL_PROPOSAL_URL") ?? "";
const FLORAL_PROPOSAL_BUCKET = Deno.env.get("FLORAL_PROPOSAL_BUCKET") ?? "floral-proposals";

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

function requireEnv(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  return { error };
}

function logInfo(message: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "INFO", function: "submit-floral-proposal", message, ...data }));
}

function logError(message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "ERROR", function: "submit-floral-proposal", message, ...data }));
}

async function hashPasscode(passcode: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(passcode));
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function generatePasscode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Not provided";
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

function formatDisplayValue(value: string | null | undefined): string {
  if (!value) return "Not provided";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
}

function buildStoragePath(leadId: string, version: number): string {
  return `${leadId}/floral-proposal-v${version}-${Date.now()}.pdf`;
}

function normalizeProviderMessageId(messageId: string | null | undefined): string | null {
  const normalized = String(messageId ?? "").trim().replace(/^<|>$/g, "");
  return normalized || null;
}


export function decodePdfBase64(pdfBase64: string): Uint8Array {
  return Uint8Array.from(atob(pdfBase64), (char) => char.charCodeAt(0));
}

export function buildProposalSubmissionSnapshot(args: {
  existingSnapshot?: Record<string, unknown> | null;
  incomingSnapshot?: Record<string, unknown> | null;
  submittedAt: string;
  pdfFileName?: string | null;
}): Record<string, unknown> {
  return {
    ...(args.existingSnapshot ?? {}),
    ...(args.incomingSnapshot ?? {}),
    proposal_status: "submitted",
    submitted_at: args.submittedAt,
    submitted_pdf_file_name: args.pdfFileName ?? null,
    generated_by: "submit-floral-proposal",
    generated_at: args.submittedAt,
  };
}

function buildClientSubject(lead: LeadRow, version: number): string {
  return `Your Floral Proposal is ready, ${lead.first_name} - v${version}`;
}

function buildClientHtml(lead: LeadRow, version: number, passcode: string, portalUrl: string, totalAmount: number): string {
  return `
    <div style="margin:0;padding:0;background-color:#f7f4f1;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f7f4f1;margin:0;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:720px;background-color:#ffffff;border:1px solid #ece5df;border-radius:18px;overflow:hidden;">
              <tr>
                <td style="background-color:#111111;padding:28px 36px;text-align:center;">
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:0.28em;text-transform:uppercase;color:#ea938c;margin-bottom:10px;">Black Begonia Floral Co.</div>
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;color:#f7f4f1;">Your Floral Proposal Is Ready</div>
                </td>
              </tr>
              <tr>
                <td style="padding:40px 36px 20px 36px;">
                  <p style="margin:0 0 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.75;color:#222222;">Hi ${lead.first_name},</p>
                  <p style="margin:0 0 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.75;color:#222222;">Your Floral Proposal is ready to review. Use the secure link below together with your 6-digit passcode to access it.</p>
                  <div style="margin:28px 0;border:1px solid #ece5df;border-radius:18px;background-color:#f7f4f1;padding:24px;text-align:center;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#7a746f;">Floral Proposal Passcode</p>
                    <p style="margin:14px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:36px;letter-spacing:0.18em;color:#111111;">${passcode}</p>
                  </div>
                  <p style="margin:0 0 24px 0;text-align:center;">
                    <a href="${portalUrl}" style="display:inline-block;background-color:#111111;color:#f7f4f1;text-decoration:none;padding:14px 24px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;">Review Floral Proposal</a>
                  </p>
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#222222;">Proposal version: ${version}<br/>Service type: ${formatDisplayValue(lead.service_type)}<br/>Event date: ${formatDate(lead.event_date)}<br/>Proposal total: ${formatCurrency(totalAmount)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildClientText(lead: LeadRow, version: number, passcode: string, portalUrl: string, totalAmount: number): string {
  return `Hi ${lead.first_name},\n\nYour Floral Proposal is ready to review.\n\nProposal version: ${version}\nService type: ${formatDisplayValue(lead.service_type)}\nEvent date: ${formatDate(lead.event_date)}\nProposal total: ${formatCurrency(totalAmount)}\n\nSecure Floral Proposal page:\n${portalUrl}\n\nYour 6-digit passcode:\n${passcode}\n\nWarmly,\nBlack Begonia Floral Co.`;
}

async function sendMailgunMessage(args: { to: string; subject: string; text: string; html: string; replyTo?: string }) {
  const form = new FormData();
  form.append("from", MG_FROM_EMAIL);
  form.append("to", args.to);
  form.append("subject", args.subject);
  form.append("text", args.text);
  form.append("html", args.html);
  form.append("o:tracking-clicks", "no");
  form.append("o:tracking-opens", "no");
  if (args.replyTo) form.append("h:Reply-To", args.replyTo);

  const auth = btoa(`api:${MG_API_KEY}`);
  const response = await fetch(`${MG_BASE_URL}/v3/${MG_DOMAIN}/messages`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
    body: form,
  });

  const rawText = await response.text();
  if (!response.ok) throw new Error(`Mailgun send failed (${response.status}): ${rawText}`);
  return JSON.parse(rawText) as MailgunSuccessResponse;
}

async function isInternalCrmUser(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, is_active, user_roles!inner(role)")
    .eq("id", userId)
    .in("user_roles.role", ["admin", "staff"])
    .maybeSingle();

  if (error) {
    logError("CRM role lookup failed", { error: sanitizeError(error), user_id: userId });
    return false;
  }

  return Boolean(data?.is_active);
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { success: false, error: "Method not allowed." });

  let uploadedPdfPath: string | null = null;
  let createdProposalId: string | null = null;
  let reusedDraftProposalId: string | null = null;
  let deactivatedProposalIds: string[] = [];

  try {
    requireEnv("SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
    requireEnv("PROPOSAL_ACCESS_SIGNING_KEY", PROPOSAL_ACCESS_SIGNING_KEY);
    requireEnv("MG_API_KEY", MG_API_KEY);
    requireEnv("MG_BASE_URL", MG_BASE_URL);
    requireEnv("MG_DOMAIN", MG_DOMAIN);
    requireEnv("MG_FROM_EMAIL", MG_FROM_EMAIL);
    requireEnv("MG_TO_REPLY", MG_TO_REPLY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return jsonResponse(401, { success: false, error: "Missing authorization token." });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return jsonResponse(401, { success: false, error: "Unable to validate user session." });

    if (!(await isInternalCrmUser(supabase, user.id))) {
      return jsonResponse(403, { success: false, error: "You do not have permission to submit Floral Proposals." });
    }

    const body = await req.json() as RequestBody;
    const requestedProposalId = String(body.floral_proposal_id ?? "").trim() || null;
    const leadId = String(body.lead_id ?? "").trim();
    const portalUrl = String(body.portal_url ?? "").trim() || CLIENT_PORTAL_PROPOSAL_URL;

    if (!leadId) return jsonResponse(400, { success: false, error: "Missing lead_id." });
    if (!portalUrl) return jsonResponse(500, { success: false, error: "Floral Proposal portal URL is not configured." });
    if (!Array.isArray(body.line_items) || !body.line_items.length) {
      return jsonResponse(400, { success: false, error: "At least one Floral Proposal line item is required." });
    }
    if (!body.pdf_base64?.trim()) {
      return jsonResponse(400, { success: false, error: "A finalized Floral Proposal PDF is required before submission." });
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("lead_id, first_name, last_name, email, service_type, event_type, event_date, status")
      .eq("lead_id", leadId)
      .single<LeadRow>();

    if (leadError || !lead) return jsonResponse(404, { success: false, error: "Lead not found." });
    if (lead.status !== "nurturing" && lead.status !== "proposal_declined") {
      return jsonResponse(409, { success: false, error: `Cannot submit a Floral Proposal from status ${lead.status}.` });
    }

    const { data: existingProposals, error: proposalsError } = await supabase
      .from("floral_proposals")
      .select("floral_proposal_id, version, is_active, status, snapshot")
      .eq("lead_id", leadId)
      .returns<FloralProposalRow[]>();

    if (proposalsError) throw proposalsError;

    const reusableDraft = requestedProposalId
      ? (existingProposals ?? []).find((proposal) =>
          proposal.floral_proposal_id === requestedProposalId &&
          proposal.is_active &&
          proposal.status === "draft"
        ) ?? null
      : null;

    const proposalVersion = reusableDraft
      ? reusableDraft.version
      : (existingProposals ?? []).reduce((max, proposal) => Math.max(max, proposal.version), 0) + 1;

    const pdfBytes = decodePdfBase64(body.pdf_base64);

    uploadedPdfPath = buildStoragePath(leadId, proposalVersion);
    const { error: uploadError } = await supabase.storage.from(FLORAL_PROPOSAL_BUCKET).upload(uploadedPdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: false,
      cacheControl: "3600",
    });
    if (uploadError) throw uploadError;

    if (!reusableDraft) {
      deactivatedProposalIds = (existingProposals ?? [])
        .filter((proposal) => proposal.is_active)
        .map((proposal) => proposal.floral_proposal_id);
    }

    if (deactivatedProposalIds.length) {
      const { error: deactivateError } = await supabase
        .from("floral_proposals")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("floral_proposal_id", deactivatedProposalIds);
      if (deactivateError) throw deactivateError;
    }

    const passcode = generatePasscode();
    const passcodeHash = await hashPasscode(passcode);
    const existingReusableSnapshot =
      (reusableDraft?.snapshot as Record<string, unknown> | null | undefined) ?? {};
    const submissionTimestamp = new Date().toISOString();
    const snapshot = buildProposalSubmissionSnapshot({
      existingSnapshot: reusableDraft ? existingReusableSnapshot : {},
      incomingSnapshot: body.snapshot ?? {},
      submittedAt: submissionTimestamp,
      pdfFileName: body.pdf_file_name ?? null,
    });

    let proposal: { floral_proposal_id: string; version: number };

    if (reusableDraft) {
      reusedDraftProposalId = reusableDraft.floral_proposal_id;
      const { data: updatedProposal, error: proposalUpdateError } = await supabase
        .from("floral_proposals")
        .update({
          tax_region_id: body.tax_region_id ?? null,
          is_active: true,
          status: "submitted",
          customer_email: lead.email,
          passcode_hash: passcodeHash,
          pdf_storage_path: uploadedPdfPath,
          finalized_at: snapshot["finalized_at"] ?? null,
          edit_reopened_at: snapshot["edit_reopened_at"] ?? null,
          submitted_at: submissionTimestamp,
          subtotal: body.subtotal,
          tax_rate: body.tax_rate,
          tax_amount: body.tax_amount,
          total_amount: body.total_amount,
          terms_version: body.terms_version ?? "v1",
          privacy_policy_version: body.privacy_policy_version ?? "v1",
          snapshot,
          updated_at: new Date().toISOString(),
        })
        .eq("floral_proposal_id", reusableDraft.floral_proposal_id)
        .select("floral_proposal_id, version")
        .single<{ floral_proposal_id: string; version: number }>();

      if (proposalUpdateError || !updatedProposal) {
        throw proposalUpdateError ?? new Error("Unable to submit the existing Floral Proposal draft.");
      }

      proposal = updatedProposal;
    } else {
      const { data: insertedProposal, error: proposalInsertError } = await supabase
        .from("floral_proposals")
        .insert({
          lead_id: leadId,
          tax_region_id: body.tax_region_id ?? null,
          version: proposalVersion,
          is_active: true,
          status: "submitted",
          customer_email: lead.email,
          passcode_hash: passcodeHash,
          pdf_storage_path: uploadedPdfPath,
          finalized_at: snapshot["finalized_at"] ?? null,
          edit_reopened_at: snapshot["edit_reopened_at"] ?? null,
          submitted_at: submissionTimestamp,
          subtotal: body.subtotal,
          tax_rate: body.tax_rate,
          tax_amount: body.tax_amount,
          total_amount: body.total_amount,
          terms_version: body.terms_version ?? "v1",
          privacy_policy_version: body.privacy_policy_version ?? "v1",
          snapshot,
          created_by: user.id,
        })
        .select("floral_proposal_id, version")
        .single<{ floral_proposal_id: string; version: number }>();

      if (proposalInsertError || !insertedProposal) {
        throw proposalInsertError ?? new Error("Unable to create Floral Proposal.");
      }

      proposal = insertedProposal;
      createdProposalId = insertedProposal.floral_proposal_id;

      const { data: insertedLineItems, error: lineItemError } = await supabase
        .from("floral_proposal_line_items")
        .insert(body.line_items.map((lineItem) => ({
          floral_proposal_id: proposal.floral_proposal_id,
          display_order: lineItem.display_order,
          line_item_type: lineItem.line_item_type,
          item_name: lineItem.item_name,
          quantity: lineItem.quantity,
          unit_price: lineItem.unit_price,
          subtotal: lineItem.subtotal,
          description: lineItem.description ?? null,
          image_storage_path: lineItem.image_storage_path ?? null,
          image_alt_text: lineItem.image_alt_text ?? null,
          image_caption: lineItem.image_caption ?? null,
          notes: lineItem.notes ?? null,
          snapshot: lineItem.snapshot ?? {},
        })))
        .select("floral_proposal_line_item_id, display_order");

      if (lineItemError) throw lineItemError;

      const lineItemIdsByOrder = new Map<number, string>();
      for (const row of insertedLineItems ?? []) {
        lineItemIdsByOrder.set(row.display_order, row.floral_proposal_line_item_id);
      }

      const componentRows = body.line_items.flatMap((lineItem) => {
        const lineItemId = lineItemIdsByOrder.get(lineItem.display_order);
        if (!lineItemId) return [];
        return (lineItem.components ?? []).map((component) => ({
          floral_proposal_line_item_id: lineItemId,
          display_order: component.display_order,
          catalog_item_id: component.catalog_item_id ?? null,
          catalog_item_name: component.catalog_item_name,
          quantity_per_unit: component.quantity_per_unit,
          extended_quantity: component.extended_quantity,
          base_unit_cost: component.base_unit_cost,
          applied_markup_percent: component.applied_markup_percent,
          sell_unit_price: component.sell_unit_price,
          subtotal: component.subtotal,
          reserve_percent: component.reserve_percent ?? 0,
          snapshot: component.snapshot ?? {},
        }));
      });

      if (componentRows.length) {
        const { error: componentError } = await supabase.from("floral_proposal_components").insert(componentRows);
        if (componentError) throw componentError;
      }

      if (body.shopping_list_items?.length) {
        const { data: shoppingList, error: shoppingListError } = await supabase
          .from("floral_proposal_shopping_lists")
          .insert({ floral_proposal_id: proposal.floral_proposal_id, status: "generated" })
          .select("floral_proposal_shopping_list_id")
          .single<{ floral_proposal_shopping_list_id: string }>();

        if (shoppingListError || !shoppingList) {
          throw shoppingListError ?? new Error("Unable to create shopping list.");
        }

        const { error: shoppingListItemsError } = await supabase.from("floral_proposal_shopping_list_items").insert(
          body.shopping_list_items.map((item) => ({
            floral_proposal_shopping_list_id: shoppingList.floral_proposal_shopping_list_id,
            vendor_id: item["vendor_id"] ?? null,
            vendor_item_pack_id: item["vendor_item_pack_id"] ?? null,
            catalog_item_id: item["catalog_item_id"] ?? null,
            item_name: item["item_name"],
            item_type: item["item_type"],
            unit_type: item["unit_type"],
            required_units: item["required_units"],
            reserve_percent: item["reserve_percent"] ?? 0,
            reserve_units: item["reserve_units"] ?? 0,
            total_units_to_buy: item["total_units_to_buy"] ?? item["required_units"] ?? 0,
            units_per_pack: item["units_per_pack"] ?? null,
            required_pack_count: item["required_pack_count"] ?? null,
            estimated_pack_cost: item["estimated_pack_cost"] ?? null,
            total_estimated_cost: item["total_estimated_cost"] ?? null,
            notes: item["notes"] ?? null,
          })),
        );
        if (shoppingListItemsError) throw shoppingListItemsError;
      }
    }

    const emailSubject = buildClientSubject(lead, proposal.version);
    const emailText = buildClientText(lead, proposal.version, passcode, portalUrl, body.total_amount);
    const emailHtml = buildClientHtml(lead, proposal.version, passcode, portalUrl, body.total_amount);

    const { data: emailMessage, error: emailMessageError } = await supabase
      .from("email_messages")
      .insert({
        related_table: "floral_proposals",
        related_id: proposal.floral_proposal_id,
        inquiry_type: "floral_proposal",
        provider: "mailgun",
        to_email: lead.email,
        to_name: `${lead.first_name} ${lead.last_name}`.trim(),
        from_email: MG_FROM_EMAIL,
        reply_to_email: MG_TO_REPLY,
        subject: emailSubject,
        template_key: "client_floral_proposal_notification",
        message_role: "client_proposal_access",
        status: "pending",
        tags: ["floral-proposal", "client-notification"],
        metadata: {
          lead_id: lead.lead_id,
          floral_proposal_id: proposal.floral_proposal_id,
          floral_proposal_version: proposal.version,
          proposal_total: body.total_amount,
          portal_url: portalUrl,
        },
      })
      .select("email_message_id")
      .single<EmailMessageRow>();

    if (emailMessageError || !emailMessage) {
      throw emailMessageError ?? new Error("Unable to create floral proposal email log row.");
    }

    try {
      const mailgunResponse = await sendMailgunMessage({
        to: lead.email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
        replyTo: MG_TO_REPLY,
      });

      const normalizedProviderMessageId = normalizeProviderMessageId(mailgunResponse.id);
      const emailAcceptedAt = new Date().toISOString();
      const { error: emailUpdateError } = await supabase
        .from("email_messages")
        .update({
          provider_message_id: normalizedProviderMessageId,
          status: "accepted",
          sent_at: emailAcceptedAt,
          accepted_at: emailAcceptedAt,
          last_event_at: emailAcceptedAt,
        })
        .eq("email_message_id", emailMessage.email_message_id);

      if (emailUpdateError) throw emailUpdateError;
    } catch (emailError) {
      const failedAt = new Date().toISOString();
      await supabase
        .from("email_messages")
        .update({
          status: "failed",
          failure_reason: emailError instanceof Error ? emailError.message : "Floral proposal email send failed.",
          failed_at: failedAt,
          last_event_at: failedAt,
        })
        .eq("email_message_id", emailMessage.email_message_id);
      throw emailError;
    }

    const now = new Date().toISOString();
    const { error: leadUpdateError } = await supabase.from("leads").update({ status: "proposal_submitted", updated_at: now }).eq("lead_id", leadId);
    if (leadUpdateError) throw leadUpdateError;

    const { error: activityError } = await supabase.from("lead_activity").insert({
      lead_id: leadId,
      activity_type: "status_changed",
      activity_label: `Floral Proposal v${proposal.version} submitted`,
      activity_description: "A Floral Proposal was generated, stored, and emailed to the client.",
      performed_by: user.id,
      metadata: {
        floral_proposal_id: proposal.floral_proposal_id,
        floral_proposal_version: proposal.version,
        previous_status: lead.status,
        next_status: "proposal_submitted",
        customer_email: lead.email,
        pdf_storage_path: uploadedPdfPath,
        pdf_supplied: Boolean(body.pdf_base64),
        submitted_pdf_file_name: body.pdf_file_name ?? null,
      },
    });
    if (activityError) throw activityError;

    logInfo("Floral Proposal submission completed", {
      floral_proposal_id: proposal.floral_proposal_id,
      lead_id: leadId,
      version: proposal.version,
      draft_reused: Boolean(reusableDraft),
    });
    return jsonResponse(200, { success: true, floral_proposal_id: proposal.floral_proposal_id, version: proposal.version });
  } catch (error) {
    logError("Floral Proposal submission failed", {
      error: sanitizeError(error),
      uploaded_pdf_path: uploadedPdfPath,
      created_floral_proposal_id: createdProposalId,
      reused_draft_proposal_id: reusedDraftProposalId,
      deactivated_proposal_ids: deactivatedProposalIds,
    });
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      if (createdProposalId) await supabase.from("floral_proposals").delete().eq("floral_proposal_id", createdProposalId);
      if (reusedDraftProposalId) {
        await supabase
          .from("floral_proposals")
          .update({
            status: "draft",
            passcode_hash: "draft",
            pdf_storage_path: null,
            updated_at: new Date().toISOString(),
          })
          .eq("floral_proposal_id", reusedDraftProposalId);
      }
      if (deactivatedProposalIds.length) {
        await supabase
          .from("floral_proposals")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .in("floral_proposal_id", deactivatedProposalIds);
      }
      if (uploadedPdfPath) await supabase.storage.from(FLORAL_PROPOSAL_BUCKET).remove([uploadedPdfPath]);
    } catch (rollbackError) {
      logError("Rollback failed", { error: sanitizeError(rollbackError) });
    }

    return jsonResponse(500, { success: false, error: error instanceof Error ? error.message : "Floral Proposal submission failed." });
  }
}

if (import.meta.main) {
  serve(handleRequest);
}
