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

type ProposalRow = {
  proposal_id: string;
  lead_id: string;
  proposal_url: string;
  storage_path: string;
  is_active: boolean;
  version: number;
  file_name: string | null;
  customer_email: string;
  created_at: string;
  updated_at: string;
};

type RequestBody = {
  proposal_id: string;
  passcode: string;
  portal_url?: string;
};

type MailgunSuccessResponse = {
  id: string;
  message: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MG_API_KEY = Deno.env.get("MG_API_KEY")!;
const MG_BASE_URL = Deno.env.get("MG_BASE_URL")!;
const MG_DOMAIN = Deno.env.get("MG_DOMAIN")!;
const MG_FROM_EMAIL = Deno.env.get("MG_FROM_EMAIL")!;
const MG_TO_REPLY = Deno.env.get("MG_TO_REPLY")!;
const MG_REGION = (Deno.env.get("MG_REGION") ?? "us").toLowerCase();
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
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function requireEnv(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
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

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function buildClientSubject(lead: LeadRow, proposal: ProposalRow): string {
  return `Your floral proposal is ready, ${lead.first_name} - v${proposal.version}`;
}

function buildClientHtml(
  lead: LeadRow,
  proposal: ProposalRow,
  passcode: string,
  portalUrl: string,
): string {
  const detailRow = (label: string, value: string | number | null | undefined) => `
    <tr>
      <td style="padding: 12px 0; vertical-align: top; width: 180px; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6b6b; border-bottom: 1px solid #e9e2dc;">
        ${label}
      </td>
      <td style="padding: 12px 0; vertical-align: top; font-size: 15px; color: #111111; border-bottom: 1px solid #e9e2dc;">
        ${value ?? "Not provided"}
      </td>
    </tr>
  `;

  return `
    <div style="margin: 0; padding: 0; background-color: #f7f4f1;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f7f4f1; margin: 0; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 720px; background-color: #ffffff; border: 1px solid #ece5df; border-radius: 18px; overflow: hidden;">
              <tr>
                <td style="background-color: #111111; padding: 28px 36px; text-align: center;">
                  <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; letter-spacing: 0.28em; text-transform: uppercase; color: #ea938c; margin-bottom: 10px;">
                    Black Begonia Floral Co.
                  </div>
                  <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 30px; line-height: 1.2; color: #f7f4f1; margin: 0;">
                    Your Proposal Is Ready
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding: 40px 36px 20px 36px;">
                  <p style="margin: 0 0 18px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.75; color: #222222;">
                    Hi ${lead.first_name},
                  </p>

                  <p style="margin: 0 0 18px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.75; color: #222222;">
                    Your floral proposal is ready to review. Use the secure link below along with your 6-digit passcode to access it.
                  </p>

                  <div style="margin: 28px 0; border: 1px solid #ece5df; border-radius: 18px; background-color: #f7f4f1; padding: 24px; text-align: center;">
                    <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #7a746f;">
                      Proposal Passcode
                    </p>
                    <p style="margin: 14px 0 0 0; font-family: Georgia, 'Times New Roman', serif; font-size: 36px; letter-spacing: 0.18em; color: #111111;">
                      ${passcode}
                    </p>
                    <p style="margin: 16px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.7; color: #555555;">
                      Enter this code with your email address on the secure proposal page.
                    </p>
                  </div>

                  <p style="margin: 0 0 24px 0; text-align: center;">
                    <a href="${portalUrl}" style="display: inline-block; background-color: #111111; color: #f7f4f1; text-decoration: none; padding: 14px 24px; border-radius: 999px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase;">
                      Review Proposal
                    </a>
                  </p>

                  <div style="height: 1px; background-color: #ea938c; opacity: 0.65; margin: 0 0 24px 0;"></div>
                </td>
              </tr>

              <tr>
                <td style="padding: 0 36px 12px 36px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                    ${detailRow("Proposal Version", proposal.version)}
                    ${detailRow("Client", `${lead.first_name} ${lead.last_name}`)}
                    ${detailRow("Email", lead.email)}
                    ${detailRow("Service Type", formatDisplayValue(lead.service_type))}
                    ${detailRow("Event Type", formatDisplayValue(lead.event_type))}
                    ${detailRow("Event Date", formatDate(lead.event_date))}
                    ${detailRow("File", proposal.file_name ?? `Proposal v${proposal.version}.pdf`)}
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding: 24px 36px 40px 36px;">
                  <div style="background-color: #f7f4f1; border-left: 4px solid #ea938c; padding: 18px 18px;">
                    <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.75; color: #222222;">
                      Once inside the portal, you will be able to review the proposal and either accept it or decline it with notes so we can make revisions.
                    </p>
                  </div>

                  <p style="margin: 28px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.75; color: #222222;">
                    Warmly,<br />
                    <span style="font-family: Georgia, 'Times New Roman', serif; color: #111111; font-size: 18px;">Black Begonia Floral Co.</span>
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding: 18px 36px; background-color: #f7f4f1; border-top: 1px solid #ece5df; text-align: center;">
                  <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.6; letter-spacing: 0.08em; text-transform: uppercase; color: #7a746f;">
                    Thoughtful florals for beautifully personal celebrations
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildClientText(
  lead: LeadRow,
  proposal: ProposalRow,
  passcode: string,
  portalUrl: string,
): string {
  return `Hi ${lead.first_name},

Your floral proposal is ready to review.

Proposal version: ${proposal.version}
Service type: ${formatDisplayValue(lead.service_type)}
Event type: ${formatDisplayValue(lead.event_type)}
Event date: ${formatDate(lead.event_date)}
File: ${proposal.file_name ?? `Proposal v${proposal.version}.pdf`}

Secure proposal page:
${portalUrl}

Your 6-digit passcode:
${passcode}

Use your email address and this passcode on the secure proposal page to view, accept, or decline the proposal.

Warmly,
Black Begonia Floral Co.`;
}

function generateRequestId() {
  return crypto.randomUUID();
}

function normalizeMessageId(messageId: string | null | undefined): string {
  return String(messageId ?? "").trim().replace(/^<|>$/g, "");
}

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  if (local.length <= 2) return `${local[0] ?? "*"}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { error };
}

function logInfo(requestId: string, message: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({
    level: "INFO",
    requestId,
    function: "send-proposal-email",
    message,
    ...data,
  }));
}

function logWarn(requestId: string, message: string, data?: Record<string, unknown>) {
  console.warn(JSON.stringify({
    level: "WARN",
    requestId,
    function: "send-proposal-email",
    message,
    ...data,
  }));
}

function logError(requestId: string, message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({
    level: "ERROR",
    requestId,
    function: "send-proposal-email",
    message,
    ...data,
  }));
}

async function sendMailgunMessage(
  requestId: string,
  args: {
    to: string;
    subject: string;
    text: string;
    html: string;
    replyTo?: string;
    tags?: string[];
    variables?: Record<string, unknown>;
  },
) {
  const form = new FormData();
  form.append("from", MG_FROM_EMAIL);
  form.append("to", args.to);
  form.append("subject", args.subject);
  form.append("text", args.text);
  form.append("html", args.html);
  form.append("o:tracking-clicks", "no");
  form.append("o:tracking-opens", "no");

  if (args.replyTo) {
    form.append("h:Reply-To", args.replyTo);
  }

  for (const tag of args.tags ?? []) {
    form.append("o:tag", tag);
  }

  if (args.variables) {
    form.append("v:variables", JSON.stringify(args.variables));
  }

  const auth = btoa(`api:${MG_API_KEY}`);
  const url = `${MG_BASE_URL}/v3/${MG_DOMAIN}/messages`;

  logInfo(requestId, "Sending Mailgun request", {
    mailgun_url: url,
    from_email: MG_FROM_EMAIL,
    to_email: maskEmail(args.to),
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
    },
    body: form,
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Mailgun send failed (${response.status}): ${rawText}`);
  }

  return JSON.parse(rawText) as MailgunSuccessResponse;
}

serve(async (req) => {
  const requestId = generateRequestId();
  const startedAt = Date.now();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    requireEnv("SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
    requireEnv("MG_API_KEY", MG_API_KEY);
    requireEnv("MG_BASE_URL", MG_BASE_URL);
    requireEnv("MG_DOMAIN", MG_DOMAIN);
    requireEnv("MG_FROM_EMAIL", MG_FROM_EMAIL);
    requireEnv("MG_TO_REPLY", MG_TO_REPLY);

    const body = (await req.json()) as RequestBody;
    const proposalId = body?.proposal_id;
    const passcode = String(body?.passcode ?? "").trim();
    const portalUrl = resolvePortalUrl(body?.portal_url);

    if (!proposalId) {
      return jsonResponse(400, { error: "Missing proposal_id" });
    }

    if (!/^\d{6}$/.test(passcode)) {
      return jsonResponse(400, { error: "Missing or invalid passcode" });
    }

    if (!portalUrl) {
      return jsonResponse(400, { error: "Missing portal_url" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("proposal_id, lead_id, proposal_url, storage_path, is_active, version, file_name, customer_email, created_at, updated_at")
      .eq("proposal_id", proposalId)
      .single<ProposalRow>();

    if (proposalError || !proposal) {
      logError(requestId, "Proposal fetch failed", {
        proposal_id: proposalId,
        error: proposalError ? sanitizeError(proposalError) : null,
      });
      return jsonResponse(404, { error: "Proposal not found" });
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("lead_id, first_name, last_name, email, service_type, event_type, event_date, status")
      .eq("lead_id", proposal.lead_id)
      .single<LeadRow>();

    if (leadError || !lead) {
      logError(requestId, "Lead fetch failed", {
        lead_id: proposal.lead_id,
        error: leadError ? sanitizeError(leadError) : null,
      });
      return jsonResponse(404, { error: "Lead not found" });
    }

    if (lead.email.trim().toLowerCase() !== proposal.customer_email.trim().toLowerCase()) {
      logWarn(requestId, "Lead email and proposal customer_email differ", {
        proposal_id: proposal.proposal_id,
        proposal_customer_email: maskEmail(proposal.customer_email),
        lead_email: maskEmail(lead.email),
      });
    }

    const clientSubject = buildClientSubject(lead, proposal);
    const metadata = {
      proposal_id: proposal.proposal_id,
      lead_id: lead.lead_id,
      proposal_version: proposal.version,
      proposal_file_name: proposal.file_name,
      service_type: lead.service_type,
      event_type: lead.event_type,
      lead_status: lead.status,
      portal_url: portalUrl,
    };

    const { data: pendingRow, error: insertError } = await supabase
      .from("email_messages")
      .insert({
        related_table: "proposals",
        related_id: proposal.proposal_id,
        inquiry_type: lead.event_type ?? lead.service_type,
        to_email: proposal.customer_email,
        to_name: `${lead.first_name} ${lead.last_name}`,
        from_email: MG_FROM_EMAIL,
        reply_to_email: MG_TO_REPLY,
        subject: clientSubject,
        template_key: "client_proposal_access",
        message_role: "client_proposal_access",
        status: "pending",
        tags: ["proposal", "client-proposal-access"],
        metadata,
        mailgun_region: MG_REGION,
      })
      .select("email_message_id")
      .single<{ email_message_id: string }>();

    if (insertError || !pendingRow) {
      logError(requestId, "Failed to create pending email_messages row", {
        proposal_id: proposal.proposal_id,
        error: insertError ? sanitizeError(insertError) : null,
      });
      return jsonResponse(500, { error: "Failed to initialize email log row" });
    }

    try {
      const now = new Date().toISOString();
      const mailgunResponse = await sendMailgunMessage(requestId, {
        to: proposal.customer_email,
        subject: clientSubject,
        text: buildClientText(lead, proposal, passcode, portalUrl),
        html: buildClientHtml(lead, proposal, passcode, portalUrl),
        replyTo: MG_TO_REPLY,
        tags: ["proposal", "client-proposal-access"],
        variables: metadata,
      });

      const providerMessageId = normalizeMessageId(mailgunResponse.id);

      const { error: updateError } = await supabase
        .from("email_messages")
        .update({
          provider_message_id: providerMessageId,
          status: "accepted",
          sent_at: now,
          accepted_at: now,
          last_event_at: now,
        })
        .eq("email_message_id", pendingRow.email_message_id);

      if (updateError) {
        throw new Error(`Email log update failed: ${updateError.message}`);
      }

      return jsonResponse(200, {
        success: true,
        proposal_id: proposal.proposal_id,
        lead_id: lead.lead_id,
        provider_message_id: providerMessageId,
        summary: {
          duration_ms: Date.now() - startedAt,
          request_id: requestId,
        },
      });
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : "Unknown send error";

      await supabase
        .from("email_messages")
        .update({
          status: "failed",
          failure_reason: failureMessage,
          failed_at: new Date().toISOString(),
          last_event_at: new Date().toISOString(),
        })
        .eq("email_message_id", pendingRow.email_message_id);

      logError(requestId, "Proposal email send flow failed", {
        proposal_id: proposal.proposal_id,
        error: sanitizeError(error),
      });

      return jsonResponse(500, {
        success: false,
        error: failureMessage,
        request_id: requestId,
      });
    }
  } catch (error) {
    logError(requestId, "Unhandled function error", {
      duration_ms: Date.now() - startedAt,
      error: sanitizeError(error),
    });

    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unhandled server error",
      request_id: requestId,
    });
  }
});
