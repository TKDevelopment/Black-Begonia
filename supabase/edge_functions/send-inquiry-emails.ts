import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  preferred_contact_method: string | null;
  event_date: string | null;
  ceremony_venue_name: string | null;
  ceremony_venue_city: string | null;
  ceremony_venue_state: string | null;
  reception_venue_name: string | null;
  reception_venue_city: string | null;
  reception_venue_state: string | null;
  budget_range: string | null;
  guest_count: number | null;
  inquiry_message: string | null;
  source: string;
  status: string;
  assigned_user_id: string | null;
  decline_reason: string | null;
  converted_project_id: string | null;
  converted_primary_contact_id: string | null;
  converted_at: string | null;
  declined_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
};

type RequestBody = {
  lead_id: string;
  lead_type?: string;
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function requireEnv(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}

export function formatDate(dateString: string | null): string {
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

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function buildClientSubject(lead: LeadRow): string {
  return `We received your floral inquiry, ${lead.first_name}!`;
}

function buildBusinessSubject(lead: LeadRow): string {
  return `New floral inquiry: ${lead.first_name} ${lead.last_name}`;
}

function isWeddingLead(lead: LeadRow): boolean {
  return lead.service_type.trim().toLowerCase() === "wedding";
}

function buildClientHtml(lead: LeadRow): string {
  const partnerName = lead.partner_first_name
    ? `${lead.partner_first_name} ${lead.partner_last_name ?? ""}`.trim()
    : null;

  const showWeddingFields = isWeddingLead(lead);

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
                    Inquiry Received
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding: 40px 36px 20px 36px;">
                  <p style="margin: 0 0 18px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.75; color: #222222;">
                    Hi ${lead.first_name},
                  </p>

                  <p style="margin: 0 0 18px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.75; color: #222222;">
                    Thank you so much for reaching out to <span style="color: #ea938c; font-weight: 600;">Black Begonia Floral Co.</span>.
                    We’ve received your inquiry and are so honored to be considered for your event.
                  </p>

                  <p style="margin: 0 0 28px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.75; color: #222222;">
                    Below is a copy of the information we received for your records.
                  </p>

                  <div style="height: 1px; background-color: #ea938c; opacity: 0.65; margin: 0 0 24px 0;"></div>
                </td>
              </tr>

              <tr>
                <td style="padding: 0 36px 12px 36px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                    ${detailRow("Name", `${lead.first_name} ${lead.last_name}`)}
                    ${partnerName ? detailRow("Partner", partnerName) : ""}
                    ${detailRow("Email", lead.email)}
                    ${detailRow("Phone", lead.phone)}
                    ${detailRow("Service Type", formatDisplayValue(lead.service_type))}
                    ${detailRow("Event Date", formatDate(lead.event_date))}
                    ${showWeddingFields ? detailRow("Ceremony Venue", lead.ceremony_venue_name) : ""}
                    ${showWeddingFields ? detailRow("Reception Venue", lead.reception_venue_name) : ""}
                    ${showWeddingFields ? detailRow("Budget", lead.budget_range) : ""}
                    ${showWeddingFields ? detailRow("Guest Count", lead.guest_count) : ""}
                    ${detailRow("Preferred Contact", formatDisplayValue(lead.preferred_contact_method))}
                    ${detailRow("Notes", lead.inquiry_message)}
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding: 24px 36px 40px 36px;">
                  <div style="background-color: #f7f4f1; border-left: 4px solid #ea938c; padding: 18px 18px;">
                    <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.75; color: #222222;">
                      We’ll review your details and be in touch as soon as possible. In the meantime, please feel free to reply directly to this email if there is anything you’d like to add.
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

function buildClientText(lead: LeadRow): string {
  const showWeddingFields = isWeddingLead(lead);

  return `Hi ${lead.first_name},

Thank you so much for reaching out to Black Begonia Floral Co.
We’ve received your inquiry and are so honored to be considered for your event.

Below is a copy of the information we received for your records:

Name: ${lead.first_name} ${lead.last_name}
Partner: ${lead.partner_first_name ? `${lead.partner_first_name} ${lead.partner_last_name ?? ""}`.trim() : "Not provided"}
Email: ${lead.email}
Phone: ${lead.phone ?? "Not provided"}
Service Type: ${formatDisplayValue(lead.service_type)}
Event Date: ${formatDate(lead.event_date)}
${showWeddingFields ? `Ceremony Venue: ${lead.ceremony_venue_name ?? "Not provided"}` : ""}
${showWeddingFields ? `Reception Venue: ${lead.reception_venue_name ?? "Not provided"}` : ""}
${showWeddingFields ? `Budget: ${lead.budget_range ?? "Not provided"}` : ""}
${showWeddingFields ? `Guest Count: ${lead.guest_count ?? "Not provided"}` : ""}
Preferred Contact Method: ${formatDisplayValue(lead.preferred_contact_method)}
Notes: ${lead.inquiry_message ?? "Not provided"}

We’ll review your details and be in touch as soon as possible. In the meantime, feel free to reply directly to this email if there is anything you’d like to add.

Warmly,
Black Begonia Floral Co.`;
}

function buildBusinessHtml(lead: LeadRow, leadType: string): string {
  const partnerName = lead.partner_first_name
    ? `${lead.partner_first_name} ${lead.partner_last_name ?? ""}`.trim()
    : null;

  const showWeddingFields = isWeddingLead(lead);

  const detailRow = (label: string, value: string | number | null | undefined) => `
    <tr>
      <td style="padding: 12px 0; vertical-align: top; width: 190px; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6b6b; border-bottom: 1px solid #e9e2dc;">
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
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 760px; background-color: #ffffff; border: 1px solid #ece5df; border-radius: 18px; overflow: hidden;">
              
              <tr>
                <td style="background-color: #111111; padding: 28px 36px;">
                  <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; letter-spacing: 0.28em; text-transform: uppercase; color: #ea938c; margin-bottom: 10px;">
                    Black Begonia Floral Co.
                  </div>
                  <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 30px; line-height: 1.2; color: #f7f4f1; margin: 0 0 10px 0;">
                    New Inquiry Submitted
                  </div>
                  <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #ddd4cd;">
                    A new inquiry has been submitted through the website.
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding: 28px 36px 8px 36px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="padding: 0 0 18px 0;">
                        <div style="display: inline-block; background-color: #f7f4f1; color: #111111; border: 1px solid #ead8d4; border-radius: 999px; padding: 8px 14px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;">
                          Lead Type: ${formatDisplayValue(leadType)}
                        </div>
                      </td>
                    </tr>
                  </table>

                  <div style="height: 1px; background-color: #ea938c; opacity: 0.65; margin: 0 0 18px 0;"></div>
                </td>
              </tr>

              <tr>
                <td style="padding: 0 36px 12px 36px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                    ${detailRow("Name", `${lead.first_name} ${lead.last_name}`)}
                    ${showWeddingFields ? (partnerName ? detailRow("Partner", partnerName) : detailRow("Partner", "Not provided")) : ""}
                    ${detailRow("Email", lead.email)}
                    ${detailRow("Phone", lead.phone)}
                    ${detailRow("Service Type", formatDisplayValue(lead.service_type))}
                    ${detailRow("Event Type", formatDisplayValue(lead.event_type))}
                    ${detailRow("Event Date", formatDate(lead.event_date))}
                    ${showWeddingFields ? detailRow("Ceremony Venue", lead.ceremony_venue_name) : ""}
                    ${showWeddingFields ? detailRow("Reception Venue", lead.reception_venue_name) : ""}
                    ${showWeddingFields ? detailRow("Budget", lead.budget_range) : ""}
                    ${showWeddingFields ? detailRow("Guest Count", lead.guest_count) : ""}
                    ${detailRow("Preferred Contact", formatDisplayValue(lead.preferred_contact_method))}
                    ${detailRow("Lead Source", formatDisplayValue(lead.source))}
                    ${detailRow("Lead Status", formatDisplayValue(lead.status))}
                    ${detailRow("Notes", lead.inquiry_message)}
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding: 24px 36px 36px 36px;">
                  <div style="background-color: #f7f4f1; border-left: 4px solid #ea938c; padding: 18px 18px;">
                    <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.75; color: #222222;">
                      Replying to this email should go directly to the client at
                      <span style="color: #111111; font-weight: 600;">${lead.email}</span>.
                    </p>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding: 18px 36px; background-color: #f7f4f1; border-top: 1px solid #ece5df; text-align: center;">
                  <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.6; letter-spacing: 0.08em; text-transform: uppercase; color: #7a746f;">
                    Website Inquiry Notification
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

function buildBusinessText(lead: LeadRow, leadType: string): string {
  const showWeddingFields = isWeddingLead(lead);

  return `New Inquiry Submitted

A new inquiry has been submitted through the website.

Created At: ${lead.created_at}
Lead Type: ${formatDisplayValue(leadType)}
Name: ${lead.first_name} ${lead.last_name}
${showWeddingFields ? `Partner: ${
    lead.partner_first_name
      ? `${lead.partner_first_name} ${lead.partner_last_name ?? ""}`.trim()
      : "Not provided"
  }` : ""}
Email: ${lead.email}
Phone: ${lead.phone ?? "Not provided"}
Service Type: ${formatDisplayValue(lead.service_type)}
Event Type: ${formatDisplayValue(lead.event_type)}
Event Date: ${formatDate(lead.event_date)}
${showWeddingFields ? `Ceremony Venue: ${lead.ceremony_venue_name ?? "Not provided"}` : ""}
${showWeddingFields ? `Reception Venue: ${lead.reception_venue_name ?? "Not provided"}` : ""}
${showWeddingFields ? `Budget: ${lead.budget_range ?? "Not provided"}` : ""}
${showWeddingFields ? `Guest Count: ${lead.guest_count ?? "Not provided"}` : ""}
Preferred Contact Method: ${formatDisplayValue(lead.preferred_contact_method)}
Lead Source: ${formatDisplayValue(lead.source)}
Lead Status: ${formatDisplayValue(lead.status)}
Notes: ${lead.inquiry_message ?? "Not provided"}

Replying to this email should go directly to the client at ${lead.email}.`;
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
    function: "send-inquiry-emails",
    message,
    ...data,
  }));
}

function logWarn(requestId: string, message: string, data?: Record<string, unknown>) {
  console.warn(JSON.stringify({
    level: "WARN",
    requestId,
    function: "send-inquiry-emails",
    message,
    ...data,
  }));
}

function logError(requestId: string, message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({
    level: "ERROR",
    requestId,
    function: "send-inquiry-emails",
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
  logInfo(requestId, "Preparing Mailgun payload", {
    to_email: maskEmail(args.to),
    reply_to_email: maskEmail(args.replyTo),
    subject: args.subject,
    tags: args.tags ?? [],
    has_variables: Boolean(args.variables),
    text_length: args.text.length,
    html_length: args.html.length,
  });

  const form = new FormData();
  form.append("from", MG_FROM_EMAIL);
  form.append("to", args.to);
  form.append("subject", args.subject);
  form.append("text", args.text);
  form.append("html", args.html);

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
    region: MG_REGION,
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

  logInfo(requestId, "Mailgun response received", {
    status: response.status,
    ok: response.ok,
    to_email: maskEmail(args.to),
    response_preview: rawText.slice(0, 500),
  });

  if (!response.ok) {
    throw new Error(`Mailgun send failed (${response.status}): ${rawText}`);
  }

  const parsed = JSON.parse(rawText) as MailgunSuccessResponse;

  logInfo(requestId, "Mailgun message accepted", {
    to_email: maskEmail(args.to),
    raw_provider_message_id: parsed.id,
    normalized_provider_message_id: normalizeMessageId(parsed.id),
    provider_message: parsed.message,
  });

  return parsed;
}

async function handleRequest(req: Request): Promise<Response> {
  const requestId = generateRequestId();
  const startedAt = Date.now();

  logInfo(requestId, "Incoming request received", {
    method: req.method,
    url: req.url,
  });

  if (req.method === "OPTIONS") {
    logInfo(requestId, "Handling CORS preflight");
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    logWarn(requestId, "Rejected non-POST request", {
      method: req.method,
    });

    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    logInfo(requestId, "Validating required environment variables");

    requireEnv("SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
    requireEnv("MG_API_KEY", MG_API_KEY);
    requireEnv("MG_BASE_URL", MG_BASE_URL);
    requireEnv("MG_DOMAIN", MG_DOMAIN);
    requireEnv("MG_FROM_EMAIL", MG_FROM_EMAIL);
    requireEnv("MG_TO_REPLY", MG_TO_REPLY);

    logInfo(requestId, "Environment validation passed", {
      mg_base_url: MG_BASE_URL,
      mg_domain: MG_DOMAIN,
      mg_from_email: MG_FROM_EMAIL,
      mg_to_reply: MG_TO_REPLY,
      mg_region: MG_REGION,
    });

    const body = (await req.json()) as RequestBody;

    logInfo(requestId, "Request body parsed", {
      lead_id: body?.lead_id ?? null,
      lead_type: body?.lead_type ?? null,
    });

    const leadId = body?.lead_id;
    const leadType = body?.lead_type ?? "general";

    if (!leadId) {
      logWarn(requestId, "Missing lead_id in request body");
      return jsonResponse(400, { error: "Missing lead_id" });
    }

    logInfo(requestId, "Creating Supabase service client");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    logInfo(requestId, "Fetching lead from database", {
      lead_id: leadId,
    });

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("lead_id", leadId)
      .single<LeadRow>();

    if (leadError || !lead) {
      logError(requestId, "Lead fetch failed", {
        lead_id: leadId,
        error: leadError ? sanitizeError(leadError) : null,
      });

      return jsonResponse(404, { error: "Lead not found" });
    }

    logInfo(requestId, "Lead fetched successfully", {
      lead_id: lead.lead_id,
      client_email: maskEmail(lead.email),
      service_type: lead.service_type,
      event_type: lead.event_type,
      preferred_contact_method: lead.preferred_contact_method,
      event_date: lead.event_date,
      source: lead.source,
      status: lead.status,
    });

    const clientSubject = buildClientSubject(lead);
    const businessSubject = buildBusinessSubject(lead);

    const clientTemplateKey = "client_inquiry_confirmation";
    const businessTemplateKey = "business_inquiry_notification";

    const commonMetadata = {
      lead_id: lead.lead_id,
      lead_type: leadType,
      service_type: lead.service_type,
      event_type: lead.event_type,
      source: lead.source,
      status: lead.status,
    };

    logInfo(requestId, "Email content prepared", {
      client_subject: clientSubject,
      business_subject: businessSubject,
      client_template_key: clientTemplateKey,
      business_template_key: businessTemplateKey,
      metadata: commonMetadata,
    });

    logInfo(requestId, "Creating pending email_messages rows");

    const { data: pendingRows, error: insertError } = await supabase
      .from("email_messages")
      .insert([
        {
          related_table: "leads",
          related_id: lead.lead_id,
          inquiry_type: leadType,
          to_email: lead.email,
          to_name: `${lead.first_name} ${lead.last_name}`,
          from_email: MG_FROM_EMAIL,
          reply_to_email: MG_TO_REPLY,
          subject: clientSubject,
          template_key: clientTemplateKey,
          message_role: "client_confirmation",
          status: "pending",
          tags: ["lead", "client-confirmation"],
          metadata: commonMetadata,
          mailgun_region: MG_REGION,
        },
        {
          related_table: "leads",
          related_id: lead.lead_id,
          inquiry_type: leadType,
          to_email: MG_TO_REPLY,
          to_name: "Black Begonia Floral Designs",
          from_email: MG_FROM_EMAIL,
          reply_to_email: lead.email,
          subject: businessSubject,
          template_key: businessTemplateKey,
          message_role: "business_notification",
          status: "pending",
          tags: ["lead", "business-notification"],
          metadata: commonMetadata,
          mailgun_region: MG_REGION,
        },
      ])
      .select("email_message_id, message_role");

    if (insertError || !pendingRows) {
      logError(requestId, "Failed to insert pending email_messages rows", {
        lead_id: lead.lead_id,
        error: insertError ? sanitizeError(insertError) : null,
      });

      return jsonResponse(500, { error: "Failed to initialize email log rows" });
    }

    logInfo(requestId, "Pending email_messages rows created", {
      pending_rows: pendingRows,
    });

    const clientRow = pendingRows.find((r) => r.message_role === "client_confirmation");
    const businessRow = pendingRows.find((r) => r.message_role === "business_notification");

    if (!clientRow || !businessRow) {
      logError(requestId, "Failed to map inserted email rows", {
        pending_rows: pendingRows,
      });

      return jsonResponse(500, { error: "Failed to map inserted email rows" });
    }

    logInfo(requestId, "Mapped email rows successfully", {
      client_email_message_id: clientRow.email_message_id,
      business_email_message_id: businessRow.email_message_id,
    });

    const results: Array<Record<string, unknown>> = [];

    try {
      const now = new Date().toISOString();

      logInfo(requestId, "Sending client confirmation email", {
        email_message_id: clientRow.email_message_id,
        to_email: maskEmail(lead.email),
        reply_to_email: maskEmail(MG_TO_REPLY),
      });

      const mgResponse = await sendMailgunMessage(requestId, {
        to: lead.email,
        subject: clientSubject,
        text: buildClientText(lead),
        html: buildClientHtml(lead),
        replyTo: MG_TO_REPLY,
        tags: ["lead", "client-confirmation"],
        variables: commonMetadata,
      });

      const normalizedProviderMessageId = normalizeMessageId(mgResponse.id);

      logInfo(requestId, "Updating client email_messages row after Mailgun success", {
        email_message_id: clientRow.email_message_id,
        raw_provider_message_id: mgResponse.id,
        normalized_provider_message_id: normalizedProviderMessageId,
      });

      const { error: clientUpdateError } = await supabase
        .from("email_messages")
        .update({
          provider_message_id: normalizedProviderMessageId,
          status: "accepted",
          sent_at: now,
          accepted_at: now,
          last_event_at: now,
        })
        .eq("email_message_id", clientRow.email_message_id);

      if (clientUpdateError) {
        logError(requestId, "Failed to update client email row after send", {
          email_message_id: clientRow.email_message_id,
          provider_message_id: normalizedProviderMessageId,
          error: sanitizeError(clientUpdateError),
        });

        throw new Error(`Client email DB update failed: ${clientUpdateError.message}`);
      }

      logInfo(requestId, "Client email send flow completed successfully", {
        email_message_id: clientRow.email_message_id,
        provider_message_id: normalizedProviderMessageId,
      });

      results.push({
        message_role: "client_confirmation",
        success: true,
        provider_message_id: normalizedProviderMessageId,
      });
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : "Unknown send error";

      logError(requestId, "Client email send flow failed", {
        email_message_id: clientRow.email_message_id,
        to_email: maskEmail(lead.email),
        error: sanitizeError(error),
      });

      const { error: clientFailUpdateError } = await supabase
        .from("email_messages")
        .update({
          status: "failed",
          failure_reason: failureMessage,
          failed_at: new Date().toISOString(),
          last_event_at: new Date().toISOString(),
        })
        .eq("email_message_id", clientRow.email_message_id);

      if (clientFailUpdateError) {
        logError(requestId, "Failed to persist client failure status", {
          email_message_id: clientRow.email_message_id,
          error: sanitizeError(clientFailUpdateError),
        });
      }

      results.push({
        message_role: "client_confirmation",
        success: false,
        error: failureMessage,
      });
    }

    try {
      const now = new Date().toISOString();

      logInfo(requestId, "Sending business notification email", {
        email_message_id: businessRow.email_message_id,
        to_email: maskEmail(MG_TO_REPLY),
        reply_to_email: maskEmail(lead.email),
      });

      const mgResponse = await sendMailgunMessage(requestId, {
        to: MG_TO_REPLY,
        subject: businessSubject,
        text: buildBusinessText(lead, leadType),
        html: buildBusinessHtml(lead, leadType),
        replyTo: lead.email,
        tags: ["lead", "business-notification"],
        variables: commonMetadata,
      });

      const normalizedProviderMessageId = normalizeMessageId(mgResponse.id);

      logInfo(requestId, "Updating business email_messages row after Mailgun success", {
        email_message_id: businessRow.email_message_id,
        raw_provider_message_id: mgResponse.id,
        normalized_provider_message_id: normalizedProviderMessageId,
      });

      const { error: businessUpdateError } = await supabase
        .from("email_messages")
        .update({
          provider_message_id: normalizedProviderMessageId,
          status: "accepted",
          sent_at: now,
          accepted_at: now,
          last_event_at: now,
        })
        .eq("email_message_id", businessRow.email_message_id);

      if (businessUpdateError) {
        logError(requestId, "Failed to update business email row after send", {
          email_message_id: businessRow.email_message_id,
          provider_message_id: normalizedProviderMessageId,
          error: sanitizeError(businessUpdateError),
        });

        throw new Error(`Business email DB update failed: ${businessUpdateError.message}`);
      }

      logInfo(requestId, "Business email send flow completed successfully", {
        email_message_id: businessRow.email_message_id,
        provider_message_id: normalizedProviderMessageId,
      });

      results.push({
        message_role: "business_notification",
        success: true,
        provider_message_id: normalizedProviderMessageId,
      });
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : "Unknown send error";

      logError(requestId, "Business email send flow failed", {
        email_message_id: businessRow.email_message_id,
        to_email: maskEmail(MG_TO_REPLY),
        error: sanitizeError(error),
      });

      const { error: businessFailUpdateError } = await supabase
        .from("email_messages")
        .update({
          status: "failed",
          failure_reason: failureMessage,
          failed_at: new Date().toISOString(),
          last_event_at: new Date().toISOString(),
        })
        .eq("email_message_id", businessRow.email_message_id);

      if (businessFailUpdateError) {
        logError(requestId, "Failed to persist business failure status", {
          email_message_id: businessRow.email_message_id,
          error: sanitizeError(businessFailUpdateError),
        });
      }

      results.push({
        message_role: "business_notification",
        success: false,
        error: failureMessage,
      });
    }

    const successCount = results.filter((r) => r.success === true).length;
    const failureCount = results.length - successCount;
    const durationMs = Date.now() - startedAt;

    logInfo(requestId, "Function completed", {
      lead_id: lead.lead_id,
      lead_type: leadType,
      success_count: successCount,
      failure_count: failureCount,
      duration_ms: durationMs,
      results,
    });

    return jsonResponse(200, {
      success: failureCount === 0,
      lead_id: lead.lead_id,
      lead_type: leadType,
      results,
      summary: {
        total: results.length,
        success_count: successCount,
        failure_count: failureCount,
        duration_ms: durationMs,
        request_id: requestId,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    logError(requestId, "Unhandled function error", {
      duration_ms: durationMs,
      error: sanitizeError(error),
    });

    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unhandled server error",
      request_id: requestId,
    });
  }
}

if (import.meta.main) {
  serve(handleRequest);
}
