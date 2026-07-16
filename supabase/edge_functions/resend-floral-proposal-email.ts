import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  floral_proposal_id: string;
  portal_url?: string | null;
};

type FloralProposalRow = {
  floral_proposal_id: string;
  lead_id: string;
  is_active: boolean;
  version: number;
  customer_email: string;
};

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

type MailgunSuccessResponse = {
  id: string;
  message: string;
};

type EmailMessageRow = {
  email_message_id: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MG_API_KEY = Deno.env.get("MG_API_KEY")!;
const MG_BASE_URL = Deno.env.get("MG_BASE_URL")!;
const MG_DOMAIN = Deno.env.get("MG_DOMAIN")!;
const MG_FROM_EMAIL = Deno.env.get("MG_FROM_EMAIL")!;
const MG_TO_REPLY = Deno.env.get("MG_TO_REPLY")!;
const CLIENT_PORTAL_PROPOSAL_URL = Deno.env.get("CLIENT_PORTAL_PROPOSAL_URL") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function isLocalPortalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
  } catch {
    return false;
  }
}

function resolvePortalUrl(requestedPortalUrl: string | null | undefined): string {
  const requested = String(requestedPortalUrl ?? '').trim();
  const configured = CLIENT_PORTAL_PROPOSAL_URL.trim();

  if (configured && (!requested || isLocalPortalUrl(requested))) {
    return configured;
  }

  return requested || configured;
}

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
  console.log(JSON.stringify({ level: "INFO", function: "resend-floral-proposal-email", message, ...data }));
}

function logError(message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "ERROR", function: "resend-floral-proposal-email", message, ...data }));
}

async function hashPasscode(passcode: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(passcode));
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function generatePasscode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeProviderMessageId(messageId: string | null | undefined): string | null {
  const normalized = String(messageId ?? "").trim().replace(/^<|>$/g, "");
  return normalized || null;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Not provided";
  const dateOnlyMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = dateOnlyMatch
    ? new Date(Date.UTC(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      ))
    : new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: dateOnlyMatch ? "UTC" : "America/New_York",
  }).format(date);
}

function formatDisplayValue(value: string | null | undefined): string {
  if (!value) return "Not provided";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function buildClientSubject(lead: LeadRow, version: number): string {
  return `Floral Proposal access resent, ${lead.first_name} - v${version}`;
}

function buildClientHtml(lead: LeadRow, version: number, passcode: string, portalUrl: string): string {
  return `
    <div style="margin:0;padding:0;background-color:#f7f4f1;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f7f4f1;margin:0;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:720px;background-color:#ffffff;border:1px solid #ece5df;border-radius:18px;overflow:hidden;">
              <tr>
                <td style="background-color:#111111;padding:28px 36px;text-align:center;">
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:0.28em;text-transform:uppercase;color:#ea938c;margin-bottom:10px;">Black Begonia Floral Co.</div>
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;color:#f7f4f1;">Your Floral Proposal Access Was Resent</div>
                </td>
              </tr>
              <tr>
                <td style="padding:40px 36px 20px 36px;">
                  <p style="margin:0 0 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.75;color:#222222;">Hi ${lead.first_name},</p>
                  <p style="margin:0 0 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.75;color:#222222;">We resent access to your active Floral Proposal. Use the secure link below together with your new 6-digit passcode.</p>
                  <div style="margin:28px 0;border:1px solid #ece5df;border-radius:18px;background-color:#f7f4f1;padding:24px;text-align:center;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#7a746f;">New Floral Proposal Passcode</p>
                    <p style="margin:14px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:36px;letter-spacing:0.18em;color:#111111;">${passcode}</p>
                  </div>
                  <p style="margin:0 0 24px 0;text-align:center;">
                    <a href="${portalUrl}" style="display:inline-block;background-color:#111111;color:#f7f4f1;text-decoration:none;padding:14px 24px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;">Review Floral Proposal</a>
                  </p>
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#222222;">Floral Proposal version: ${version}<br/>Service type: ${formatDisplayValue(lead.service_type)}<br/>Event date: ${formatDate(lead.event_date)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildClientText(lead: LeadRow, version: number, passcode: string, portalUrl: string): string {
  return `Hi ${lead.first_name},\n\nWe resent access to your active Floral Proposal.\n\nFloral Proposal version: ${version}\nService type: ${formatDisplayValue(lead.service_type)}\nEvent date: ${formatDate(lead.event_date)}\n\nSecure Floral Proposal page:\n${portalUrl}\n\nYour new 6-digit passcode:\n${passcode}\n\nWarmly,\nBlack Begonia Floral Co.`;
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { success: false, error: "Method not allowed." });

  try {
    requireEnv("SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
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
      return jsonResponse(403, { success: false, error: "You do not have permission to resend Floral Proposal access." });
    }

    const body = await req.json() as RequestBody;
    const floralProposalId = String(body.floral_proposal_id ?? "").trim();
    const portalUrl = resolvePortalUrl(body.portal_url);

    if (!floralProposalId) return jsonResponse(400, { success: false, error: "Missing floral_proposal_id." });
    if (!portalUrl) return jsonResponse(500, { success: false, error: "Floral Proposal portal URL is not configured." });

    const { data: proposal, error: proposalError } = await supabase
      .from("floral_proposals")
      .select("floral_proposal_id, lead_id, is_active, version, customer_email")
      .eq("floral_proposal_id", floralProposalId)
      .single<FloralProposalRow>();

    if (proposalError || !proposal) return jsonResponse(404, { success: false, error: "Floral Proposal not found." });
    if (!proposal.is_active) return jsonResponse(409, { success: false, error: "Only the active Floral Proposal can be resent." });

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("lead_id, first_name, last_name, email, service_type, event_type, event_date, status")
      .eq("lead_id", proposal.lead_id)
      .single<LeadRow>();

    if (leadError || !lead) return jsonResponse(404, { success: false, error: "Lead not found." });

    const passcode = generatePasscode();
    const passcodeHash = await hashPasscode(passcode);
    const now = new Date().toISOString();

    const { error: proposalUpdateError } = await supabase
      .from("floral_proposals")
      .update({ passcode_hash: passcodeHash, updated_at: now })
      .eq("floral_proposal_id", proposal.floral_proposal_id);

    if (proposalUpdateError) throw proposalUpdateError;

    const emailSubject = buildClientSubject(lead, proposal.version);
    const emailText = buildClientText(lead, proposal.version, passcode, portalUrl);
    const emailHtml = buildClientHtml(lead, proposal.version, passcode, portalUrl);

    let emailMessageId: string | null = null;
    try {
      const { data: emailMessage, error: emailMessageError } = await supabase
        .from("email_messages")
        .insert({
          related_table: "floral_proposals",
          related_id: proposal.floral_proposal_id,
          inquiry_type: "floral_proposal",
          provider: "mailgun",
          to_email: proposal.customer_email,
          to_name: `${lead.first_name} ${lead.last_name}`.trim(),
          from_email: MG_FROM_EMAIL,
          reply_to_email: MG_TO_REPLY,
          subject: emailSubject,
          template_key: "client_floral_proposal_resend",
          message_role: "client_proposal_access_resend",
          status: "pending",
          tags: ["floral-proposal", "client-notification", "resend"],
          metadata: {
            lead_id: lead.lead_id,
            floral_proposal_id: proposal.floral_proposal_id,
            floral_proposal_version: proposal.version,
            portal_url: portalUrl,
          },
        })
        .select("email_message_id")
        .single<EmailMessageRow>();

      if (emailMessageError) {
        logError("Failed to create floral proposal resend email log row", {
          floral_proposal_id: proposal.floral_proposal_id,
          error: sanitizeError(emailMessageError),
        });
      } else {
        emailMessageId = emailMessage?.email_message_id ?? null;
      }
    } catch (emailLogError) {
      logError("Unexpected resend email log error", {
        floral_proposal_id: proposal.floral_proposal_id,
        error: sanitizeError(emailLogError),
      });
    }

    try {
      const mailgunResponse = await sendMailgunMessage({
        to: proposal.customer_email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
        replyTo: MG_TO_REPLY,
      });

      if (emailMessageId) {
        const acceptedAt = new Date().toISOString();
        const { error: emailUpdateError } = await supabase
          .from("email_messages")
          .update({
            provider_message_id: normalizeProviderMessageId(mailgunResponse.id),
            status: "accepted",
            sent_at: acceptedAt,
            accepted_at: acceptedAt,
            last_event_at: acceptedAt,
          })
          .eq("email_message_id", emailMessageId);

        if (emailUpdateError) {
          logError("Failed to update resend email log row after send", {
            email_message_id: emailMessageId,
            error: sanitizeError(emailUpdateError),
          });
        }
      }
    } catch (emailError) {
      if (emailMessageId) {
        const failedAt = new Date().toISOString();
        await supabase
          .from("email_messages")
          .update({
            status: "failed",
            failure_reason: emailError instanceof Error ? emailError.message : "Floral proposal resend email failed.",
            failed_at: failedAt,
            last_event_at: failedAt,
          })
          .eq("email_message_id", emailMessageId);
      }
      throw emailError;
    }

    const { error: activityError } = await supabase.from("lead_activity").insert({
      lead_id: lead.lead_id,
      activity_type: "email",
      activity_label: `Floral Proposal v${proposal.version} access resent`,
      activity_description: "A new Floral Proposal passcode was generated and emailed to the client.",
      performed_by: user.id,
      metadata: {
        floral_proposal_id: proposal.floral_proposal_id,
        floral_proposal_version: proposal.version,
        customer_email: proposal.customer_email,
        portal_url: portalUrl,
      },
    });

    if (activityError) {
      logError("Lead activity insert failed after floral proposal resend", {
        floral_proposal_id: proposal.floral_proposal_id,
        lead_id: lead.lead_id,
        error: sanitizeError(activityError),
      });
    }

    logInfo("Floral Proposal access resent", { floral_proposal_id: proposal.floral_proposal_id, lead_id: lead.lead_id, version: proposal.version });
    return jsonResponse(200, { success: true, floral_proposal_id: proposal.floral_proposal_id, lead_id: lead.lead_id, version: proposal.version });
  } catch (error) {
    logError("Unhandled function error", { error: sanitizeError(error) });
    return jsonResponse(500, { success: false, error: error instanceof Error ? error.message : "Unhandled server error." });
  }
});
