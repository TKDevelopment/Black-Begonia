import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type FloralProposalRow = {
  floral_proposal_id: string;
  lead_id: string;
  is_active: boolean;
  version: number;
  customer_email: string;
  status: string;
};

type LeadRow = {
  lead_id: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  service_type: string;
  event_type: string | null;
  event_date: string | null;
};

type RequestBody = {
  floral_proposal_id: string;
  access_token: string;
  action: "accept" | "decline";
  feedback?: string | null;
  accepted_terms?: boolean;
  accepted_privacy_policy?: boolean;
  signature_name?: string | null;
};

type MailgunSuccessResponse = {
  id: string;
  message: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROPOSAL_ACCESS_SIGNING_KEY = Deno.env.get("PROPOSAL_ACCESS_SIGNING_KEY")!;
const MG_API_KEY = Deno.env.get("MG_API_KEY")!;
const MG_BASE_URL = Deno.env.get("MG_BASE_URL")!;
const MG_DOMAIN = Deno.env.get("MG_DOMAIN")!;
const MG_FROM_EMAIL = Deno.env.get("MG_FROM_EMAIL")!;
const MG_TO_REPLY = Deno.env.get("MG_TO_REPLY")!;

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
  console.log(JSON.stringify({ level: "INFO", function: "submit-floral-proposal-response", message, ...data }));
}

function logWarn(message: string, data?: Record<string, unknown>) {
  console.warn(JSON.stringify({ level: "WARN", function: "submit-floral-proposal-response", message, ...data }));
}

function logError(message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "ERROR", function: "submit-floral-proposal-response", message, ...data }));
}

function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function createHmacSignature(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(PROPOSAL_ACCESS_SIGNING_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
  return toBase64Url(new Uint8Array(signature));
}

async function verifyAccessToken(token: string): Promise<{ floral_proposal_id: string; email: string; exp: number } | null> {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  const expectedSignature = await createHmacSignature(encodedPayload);
  if (signature !== expectedSignature) return null;

  const payloadJson = new TextDecoder().decode(fromBase64Url(encodedPayload));
  const payload = JSON.parse(payloadJson) as { floral_proposal_id: string; email: string; exp: number };
  if (!payload.exp || Date.now() >= payload.exp * 1000) return null;
  return payload;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Not provided";
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" }).format(date);
}

function formatDisplayValue(value: string | null | undefined): string {
  if (!value) return "Not provided";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char: string) => char.toUpperCase());
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
  const response = await fetch(`${MG_BASE_URL}/v3/${MG_DOMAIN}/messages`, { method: "POST", headers: { Authorization: `Basic ${auth}` }, body: form });
  const rawText = await response.text();
  if (!response.ok) throw new Error(`Mailgun send failed (${response.status}): ${rawText}`);
  return JSON.parse(rawText) as MailgunSuccessResponse;
}

function buildClientSubject(lead: LeadRow, action: "accept" | "decline") {
  return action === "accept" ? `Floral Proposal accepted - thank you, ${lead.first_name}` : `We received your Floral Proposal feedback, ${lead.first_name}`;
}

function buildClientHtml(lead: LeadRow, proposal: FloralProposalRow, action: "accept" | "decline", feedback: string) {
  const bodyCopy = action === "accept"
    ? "Thank you for accepting your Floral Proposal. We have recorded your response and signature."
    : "Thank you for reviewing your Floral Proposal and sharing feedback. Your notes have been recorded so a revised version can be prepared.";
  const feedbackBlock = action === "decline" && feedback
    ? `<div style="margin-top:24px;background-color:#f7f4f1;border-left:4px solid #ea938c;padding:18px;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#222222;">${feedback}</p></div>`
    : "";

  return `
    <div style="margin:0;padding:0;background-color:#f7f4f1;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f7f4f1;margin:0;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:720px;background-color:#ffffff;border:1px solid #ece5df;border-radius:18px;overflow:hidden;">
              <tr>
                <td style="background-color:#111111;padding:28px 36px;text-align:center;">
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:0.28em;text-transform:uppercase;color:#ea938c;margin-bottom:10px;">Black Begonia Floral Co.</div>
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;color:#f7f4f1;">${action === "accept" ? "Floral Proposal Accepted" : "Feedback Received"}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:40px 36px;">
                  <p style="margin:0 0 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.75;color:#222222;">Hi ${lead.first_name},</p>
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.75;color:#222222;">${bodyCopy}</p>
                  <p style="margin:24px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#222222;">Floral Proposal version: ${proposal.version}<br/>Service type: ${formatDisplayValue(lead.service_type)}<br/>Event date: ${formatDate(lead.event_date)}</p>
                  ${feedbackBlock}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildClientText(lead: LeadRow, proposal: FloralProposalRow, action: "accept" | "decline", feedback: string) {
  return action === "accept"
    ? `Hi ${lead.first_name},\n\nThank you for accepting your Floral Proposal. We have recorded your response and signature.\n\nFloral Proposal version: ${proposal.version}\nService type: ${formatDisplayValue(lead.service_type)}\nEvent date: ${formatDate(lead.event_date)}\n\nWarmly,\nBlack Begonia Floral Co.`
    : `Hi ${lead.first_name},\n\nThank you for reviewing your Floral Proposal and sharing feedback. We have recorded your notes so a revised version can be prepared.\n\nFloral Proposal version: ${proposal.version}\nFeedback: ${feedback}\n\nWarmly,\nBlack Begonia Floral Co.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { success: false, error: "Method not allowed." });

  try {
    requireEnv("SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
    requireEnv("PROPOSAL_ACCESS_SIGNING_KEY", PROPOSAL_ACCESS_SIGNING_KEY);
    requireEnv("MG_API_KEY", MG_API_KEY);
    requireEnv("MG_BASE_URL", MG_BASE_URL);
    requireEnv("MG_DOMAIN", MG_DOMAIN);
    requireEnv("MG_FROM_EMAIL", MG_FROM_EMAIL);
    requireEnv("MG_TO_REPLY", MG_TO_REPLY);

    const body = await req.json() as RequestBody;
    const floralProposalId = String(body.floral_proposal_id ?? "").trim();
    const accessToken = String(body.access_token ?? "").trim();
    const action = body.action;
    const feedback = String(body.feedback ?? "").trim();
    const acceptedTerms = Boolean(body.accepted_terms);
    const acceptedPrivacyPolicy = Boolean(body.accepted_privacy_policy);
    const signatureName = String(body.signature_name ?? "").trim();

    if (!floralProposalId || !accessToken) return jsonResponse(400, { success: false, error: "Missing Floral Proposal access context." });
    if (action !== "accept" && action !== "decline") return jsonResponse(400, { success: false, error: "Invalid Floral Proposal response action." });
    if (action === "decline" && !feedback) return jsonResponse(400, { success: false, error: "Feedback is required when declining a Floral Proposal." });
    if (action === "accept" && (!acceptedTerms || !acceptedPrivacyPolicy || !signatureName)) {
      return jsonResponse(400, { success: false, error: "Terms, privacy acknowledgement, and signature name are required to accept the Floral Proposal." });
    }

    const tokenPayload = await verifyAccessToken(accessToken);
    if (!tokenPayload || tokenPayload.floral_proposal_id !== floralProposalId) {
      logWarn("Response rejected due to invalid access token", { floral_proposal_id: floralProposalId });
      return jsonResponse(401, { success: false, error: "Your Floral Proposal access session is invalid or expired." });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: proposal, error: proposalError } = await supabase
      .from("floral_proposals")
      .select("floral_proposal_id, lead_id, is_active, version, customer_email, status")
      .eq("floral_proposal_id", floralProposalId)
      .single<FloralProposalRow>();

    if (proposalError || !proposal) return jsonResponse(404, { success: false, error: "Floral Proposal not found." });
    if (!proposal.is_active || proposal.status !== "submitted") return jsonResponse(409, { success: false, error: "This Floral Proposal is no longer active." });
    if (proposal.customer_email.trim().toLowerCase() !== tokenPayload.email.trim().toLowerCase()) {
      return jsonResponse(401, { success: false, error: "Your Floral Proposal access session is invalid." });
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("lead_id, status, first_name, last_name, email, service_type, event_type, event_date")
      .eq("lead_id", proposal.lead_id)
      .single<LeadRow>();

    if (leadError || !lead) return jsonResponse(404, { success: false, error: "Lead not found." });

    const nextStatus = action === "accept" ? "proposal_accepted" : "proposal_declined";
    const proposalStatus = action === "accept" ? "accepted" : "declined";
    const now = new Date().toISOString();

    const { error: proposalUpdateError } = await supabase.from("floral_proposals").update({
      status: proposalStatus,
      accepted_terms: action === "accept" ? acceptedTerms : false,
      accepted_privacy_policy: action === "accept" ? acceptedPrivacyPolicy : false,
      accepted_at: action === "accept" ? now : null,
      declined_at: action === "decline" ? now : null,
      signed_at: action === "accept" ? now : null,
      signing_status: action === "accept" ? "signed" : "declined",
      signing_completed_at: action === "accept" ? now : null,
      signing_declined_at: action === "decline" ? now : null,
      signature_name: action === "accept" ? signatureName : null,
      signature_ip: req.headers.get("x-forwarded-for") ?? null,
      signature_user_agent: req.headers.get("user-agent") ?? null,
      decline_feedback: action === "decline" ? feedback : null,
      updated_at: now,
    }).eq("floral_proposal_id", floralProposalId);

    if (proposalUpdateError) return jsonResponse(500, { success: false, error: "Unable to update Floral Proposal status." });

    const { error: leadUpdateError } = await supabase.from("leads").update({ status: nextStatus, updated_at: now }).eq("lead_id", lead.lead_id);
    if (leadUpdateError) return jsonResponse(500, { success: false, error: "Unable to update lead status." });

    const { error: activityError } = await supabase.from("lead_activity").insert({
      lead_id: lead.lead_id,
      activity_type: "status_changed",
      activity_label: action === "accept" ? `Floral Proposal v${proposal.version} accepted` : `Floral Proposal v${proposal.version} declined`,
      activity_description: action === "accept" ? "Client accepted the active Floral Proposal from the secure proposal page." : feedback,
      performed_by: null,
      metadata: {
        floral_proposal_id: proposal.floral_proposal_id,
        floral_proposal_version: proposal.version,
        previous_status: lead.status,
        next_status: nextStatus,
        response_action: action,
        customer_email: proposal.customer_email,
        feedback: action === "decline" ? feedback : null,
        accepted_terms: action === "accept" ? acceptedTerms : null,
        accepted_privacy_policy: action === "accept" ? acceptedPrivacyPolicy : null,
        signature_name: action === "accept" ? signatureName : null,
      },
    });
    if (activityError) return jsonResponse(500, { success: false, error: "Lead status updated, but activity logging failed." });

    const { error: signingSessionUpdateError } = await supabase
      .from("proposal_signing_sessions")
      .update({
        status: action === "accept" ? "signed" : "declined",
        last_synced_at: now,
        updated_at: now,
        last_error_message: null,
      })
      .eq("floral_proposal_id", floralProposalId);

    if (signingSessionUpdateError) {
      logError("Signing session update failed", {
        floral_proposal_id: floralProposalId,
        error: sanitizeError(signingSessionUpdateError),
      });
    }

    try {
      await sendMailgunMessage({
        to: proposal.customer_email,
        subject: buildClientSubject(lead, action),
        text: buildClientText(lead, proposal, action, feedback),
        html: buildClientHtml(lead, proposal, action, feedback),
        replyTo: MG_TO_REPLY,
      });
    } catch (emailError) {
      logError("Follow-up email failed", { floral_proposal_id: proposal.floral_proposal_id, error: sanitizeError(emailError) });
    }

    logInfo("Floral Proposal response processed", { floral_proposal_id: proposal.floral_proposal_id, lead_id: lead.lead_id, action, next_status: nextStatus });
    return jsonResponse(200, { success: true, floral_proposal_id: proposal.floral_proposal_id, lead_id: lead.lead_id, action, lead_status: nextStatus });
  } catch (error) {
    logError("Unhandled function error", { error: sanitizeError(error) });
    return jsonResponse(500, { success: false, error: error instanceof Error ? error.message : "Unhandled server error." });
  }
});
