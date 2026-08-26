import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ClaimedMessage {
  queue_id: string;
  communication_type: string;
  recipient_email: string | null;
  token_purpose: string | null;
  template_version: string;
  booking_id: string | null;
  expires_at: string | null;
  attempt_count: number;
}

interface BookingMessageFacts {
  contactName: string;
  workshopTitle: string;
  startAt: string;
  endAt: string;
  timezone: string;
  venueName: string;
  locality: string;
  region: string;
  activeQuantity: number;
}

const encoder = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_")
    .replaceAll("=", "");
const digest = async (value: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
const newToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
const isEmail = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 320 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const safeCategory = (value: unknown) => {
  const message = value instanceof Error ? value.message : String(value ?? "");
  if (/timeout|network|fetch|temporar/i.test(message)) {
    return "provider_temporary";
  }
  if (/recipient|email/i.test(message)) return "recipient_unavailable";
  return "processor_failure";
};
const envValue = (...names: string[]) =>
  names.map((name) => (Deno.env.get(name) ?? "").trim()).find(Boolean) ?? "";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character] ?? character));

const formatWorkshopDate = (facts: BookingMessageFacts) => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: facts.timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(facts.startAt));
  } catch {
    return "Your reserved workshop date";
  }
};

const formatWorkshopTime = (facts: BookingMessageFacts) => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: facts.timezone,
      hour: "numeric",
      minute: "2-digit",
    });
    return `${formatter.format(new Date(facts.startAt))} – ${
      formatter.format(new Date(facts.endAt))
    }`;
  } catch {
    return "See your secure confirmation";
  }
};

function renderMessage(
  message: ClaimedMessage,
  token: string | null,
  facts: BookingMessageFacts | null,
) {
  const origin = envValue("WORKSHOP_PUBLIC_ORIGIN").replace(/\/+$/, "");
  if (!/^https?:\/\/[^/]+$/.test(origin)) {
    throw new Error("public origin unavailable");
  }
  const templates: Record<string, [string, string]> = {
    booking_confirmation: [
      "Your Black Begonia workshop booking is confirmed",
      "Your payment has been confirmed and your workshop seats are reserved.",
    ],
    replacement_status_access: [
      "Your Black Begonia workshop booking access",
      "A replacement booking access code was requested.",
    ],
    waitlist_offer: [
      "Workshop seats are available",
      "Seats are temporarily available for your workshop waitlist request.",
    ],
    current_address_privacy_verification: [
      "Verify your workshop data request",
      "Use this code to verify the personal-data request sent to your current address.",
    ],
    proposed_email_confirmation: [
      "Confirm your new workshop contact email",
      "Use this code to confirm this address before it becomes your workshop contact email.",
    ],
    cancellation_notice: [
      "Your workshop booking was updated",
      "A cancellation was recorded for your workshop booking.",
    ],
    reschedule_prompt: [
      "Your workshop schedule changed",
      "Please review the available response for your workshop booking.",
    ],
    refund_notice: [
      "Your workshop refund was updated",
      "A refund update is available for your workshop booking.",
    ],
  };
  const selected = templates[message.communication_type];
  if (!selected) throw new Error("template unavailable");
  const isConfirmation = message.communication_type === "booking_confirmation";
  const subject = isConfirmation && facts
    ? `Your ${facts.workshopTitle} workshop is confirmed!`
    : selected[0];
  const headline = isConfirmation ? "Your workshop is confirmed!" : selected[0];
  const introduction = isConfirmation
    ? "Your payment is confirmed and your seats are reserved. We’re so excited to design beautiful arrangements with you!"
    : selected[1];
  let destination = `${origin}/workshop-booking/status`;
  if (
    ["privacy_verification", "replacement_email"].includes(
      message.token_purpose ?? "",
    )
  ) {
    destination = `${origin}/workshop-booking/privacy`;
  } else if (token && message.token_purpose === "status_access") {
    destination = `${origin}/workshop-booking/status#access=${
      encodeURIComponent(token)
    }`;
  }

  const factLines = facts
    ? [
      facts.workshopTitle,
      `${formatWorkshopDate(facts)} at ${formatWorkshopTime(facts)}`,
      `${facts.venueName}, ${facts.locality}, ${facts.region}`,
      `${facts.activeQuantity} ${
        facts.activeQuantity === 1 ? "seat" : "seats"
      } booked`,
    ]
    : [];
  let text = `${introduction}\n\n`;
  if (factLines.length) text += `${factLines.join("\n")}\n\n`;
  if (token) {
    text += message.token_purpose === "status_access"
      ? `Open your secure booking confirmation directly:\n${destination}\n\n`
      : `Open ${destination} and enter this single-purpose code:\n\n${token}\n\n`;
  }
  if (isConfirmation) {
    text +=
      "Your accepted Workshop Terms & Conditions, including cancellation and refund information, are available on your secure confirmation page.\n\n";
  }
  text +=
    "Questions? Email becca@blackbegoniaflorals.com or call (401) 871-4996. Do not forward secure access links or codes.";

  const factsHtml = facts
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-collapse:collapse;background:#fbf7f4;border:1px solid #eadfd9;border-radius:10px">
        <tr><td style="padding:18px 20px;border-bottom:1px solid #eadfd9"><span style="display:block;color:#9a625b;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">Workshop</span><span style="display:block;margin-top:5px;color:#332a27;font-family:Georgia,serif;font-size:20px">${
      escapeHtml(facts.workshopTitle)
    }</span></td></tr>
        <tr><td style="padding:16px 20px;border-bottom:1px solid #eadfd9"><strong style="color:#9a625b">When:</strong> ${
      escapeHtml(formatWorkshopDate(facts))
    } · ${escapeHtml(formatWorkshopTime(facts))}</td></tr>
        <tr><td style="padding:16px 20px;border-bottom:1px solid #eadfd9"><strong style="color:#9a625b">Where:</strong> ${
      escapeHtml(facts.venueName)
    }, ${escapeHtml(facts.locality)}, ${escapeHtml(facts.region)}</td></tr>
        <tr><td style="padding:16px 20px"><strong style="color:#9a625b">Seats:</strong> ${facts.activeQuantity} ${
      facts.activeQuantity === 1 ? "seat" : "seats"
    } booked</td></tr>
      </table>`
    : "";
  const tokenHtml = token && message.token_purpose !== "status_access"
    ? `<p style="margin:18px 0;padding:14px;background:#f6efeb;border:1px solid #e4d6cf;border-radius:8px;font-family:monospace;overflow-wrap:anywhere">${
      escapeHtml(token)
    }</p>`
    : "";
  const buttonLabel = message.token_purpose === "status_access"
    ? "View my workshop confirmation"
    : "Open secure workshop access";
  const html =
    `<!doctype html><html><body style="margin:0;background:#f4efeb;color:#413733;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4efeb"><tr><td align="center" style="padding:32px 14px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fffdfb;border:1px solid #eadfd9;border-radius:14px;box-shadow:0 16px 40px rgba(65,45,38,.1)">
        <tr><td style="padding:34px 34px 16px;text-align:center"><p style="margin:0;color:#a65d55;font-size:11px;font-weight:700;letter-spacing:2.2px;text-transform:uppercase">Black Begonia Florals</p><h1 style="margin:12px 0 0;color:#332a27;font-family:Georgia,serif;font-size:34px;font-weight:normal;line-height:1.08">${
      escapeHtml(headline)
    }</h1></td></tr>
        <tr><td style="padding:12px 34px 34px"><p style="margin:0;color:#655a55;font-size:16px;line-height:1.7;text-align:center">${
      escapeHtml(introduction)
    }</p>${factsHtml}${tokenHtml}${
      token
        ? `<p style="margin:26px 0;text-align:center"><a href="${
          escapeHtml(destination)
        }" style="display:inline-block;padding:14px 22px;border-radius:4px;background:#bd6f67;color:#fff;font-size:13px;font-weight:700;letter-spacing:.7px;text-decoration:none;text-transform:uppercase">${buttonLabel}</a></p>`
        : ""
    }${
      isConfirmation
        ? '<p style="margin:22px 0;color:#71645e;font-size:13px;line-height:1.65">Your accepted Workshop Terms &amp; Conditions, including cancellation and refund information, are available on your secure confirmation page.</p>'
        : ""
    }<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #eadfd9;color:#71645e;font-size:13px;line-height:1.7;text-align:center">Questions? <a href="mailto:becca@blackbegoniaflorals.com" style="color:#9a554e">becca@blackbegoniaflorals.com</a><br><a href="tel:+14018714996" style="color:#9a554e">(401) 871-4996</a><br><span style="font-size:11px">Please do not forward secure access links or codes.</span></p></td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
  return { subject, text, html };
}

async function loadBookingMessageFacts(
  db: ReturnType<typeof createClient<any>>,
  bookingId: string | null,
): Promise<BookingMessageFacts | null> {
  if (!bookingId) return null;
  const booking = await db.from("workshop_bookings")
    .select("contact_name,active_quantity,workshop_occurrence_id")
    .eq("workshop_booking_id", bookingId)
    .maybeSingle();
  if (booking.error || !booking.data) return null;
  const occurrence = await db.from("workshop_occurrences")
    .select(
      "title_snapshot,start_at,end_at,timezone,venue_name,locality,region",
    )
    .eq("workshop_occurrence_id", booking.data.workshop_occurrence_id)
    .maybeSingle();
  if (occurrence.error || !occurrence.data) return null;
  return {
    contactName: String(booking.data.contact_name ?? "").trim(),
    workshopTitle: String(occurrence.data.title_snapshot ?? "Workshop").trim(),
    startAt: String(occurrence.data.start_at ?? ""),
    endAt: String(occurrence.data.end_at ?? ""),
    timezone: String(occurrence.data.timezone ?? "America/New_York"),
    venueName: String(occurrence.data.venue_name ?? "").trim(),
    locality: String(occurrence.data.locality ?? "").trim(),
    region: String(occurrence.data.region ?? "").trim(),
    activeQuantity: Number(booking.data.active_quantity ?? 0),
  };
}

async function sendMail(
  recipient: string,
  subject: string,
  text: string,
  html: string,
  deliveryId: string,
) {
  const domain = envValue("MG_DOMAIN", "MAILGUN_DOMAIN").toLowerCase();
  const apiKey = envValue("MG_API_KEY", "MAILGUN_API_KEY");
  const sender = envValue(
    "WORKSHOP_MAIL_FROM",
    "MG_FROM_EMAIL",
    "MAILGUN_FROM",
  );
  const replyTo = envValue("MG_TO_REPLY", "MAILGUN_REPLY_TO");
  const region = (envValue("MG_REGION") || "us").toLowerCase();
  if (!domain || !apiKey || !sender) throw new Error("provider unavailable");
  if (domain.includes("://") || domain.includes("/") || domain.includes("@")) {
    throw new Error("provider unavailable");
  }
  const apiOrigin = (envValue("MG_BASE_URL", "MAILGUN_API_ORIGIN") ||
    (region === "eu"
      ? "https://api.eu.mailgun.net"
      : "https://api.mailgun.net"))
    .replace(/\/+$/, "");
  if (
    !["https://api.mailgun.net", "https://api.eu.mailgun.net"].includes(
      apiOrigin,
    )
  ) {
    throw new Error("provider unavailable");
  }
  const form = new FormData();
  form.set("from", sender);
  form.set("to", recipient);
  form.set("subject", subject);
  form.set("text", text);
  form.set("html", html);
  if (replyTo) form.set("h:Reply-To", replyTo);
  form.set("v:workshop_message_queue_id", deliveryId);
  form.set("o:tag", "workshop");
  const response = await fetch(
    `${apiOrigin}/v3/${encodeURIComponent(domain)}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`api:${apiKey}`)}` },
      body: form,
    },
  );
  const payload = await response.json().catch(() => ({})) as Record<
    string,
    unknown
  >;
  return {
    accepted: response.ok,
    retryable: response.status === 429 || response.status >= 500,
    providerMessageId: typeof payload["id"] === "string"
      ? payload["id"].replace(/[<>\r\n]/g, "").slice(0, 200)
      : "",
    category: response.ok ? null : `provider_http_${response.status}`,
  };
}

serve(async (request) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("WORKSHOP_MESSAGE_CRON_SECRET") ?? "";
  const serviceInvocation = serviceKey.length > 0 &&
    request.headers.get("authorization") === `Bearer ${serviceKey}`;
  const scheduledInvocation = cronSecret.length > 0 &&
    request.headers.get("x-cron-secret") === cronSecret;
  if (
    request.method !== "POST" || (!serviceInvocation && !scheduledInvocation)
  ) {
    return new Response("Not found", { status: 404 });
  }
  const body = await request.json().catch(() => ({})) as Record<
    string,
    unknown
  >;
  const requestedLimit = Number(body["batchLimit"] ?? 25);
  const batchLimit = Number.isSafeInteger(requestedLimit) &&
      requestedLimit >= 1 && requestedLimit <= 100
    ? requestedLimit
    : 25;
  const worker = `workshop-mail-${crypto.randomUUID()}`;
  const db = createClient<any>(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
    { auth: { persistSession: false } },
  );
  const claimed = await db.rpc("claim_workshop_communications", {
    p_worker: worker,
    p_limit: batchLimit,
  });
  if (claimed.error) {
    return Response.json({ state: "unavailable" }, { status: 503 });
  }
  const report = { claimed: 0, accepted: 0, retrying: 0, failed: 0 };
  for (const message of (claimed.data ?? []) as ClaimedMessage[]) {
    report.claimed += 1;
    const outcomeKey = crypto.randomUUID();
    let rawToken: string | null = null;
    try {
      if (!isEmail(message.recipient_email)) {
        throw new Error("recipient unavailable");
      }
      rawToken = message.token_purpose ? newToken() : null;
      const bookingFacts =
        message.communication_type === "booking_confirmation" ||
          message.communication_type === "replacement_status_access"
          ? await loadBookingMessageFacts(db, message.booking_id)
          : null;
      const rendered = renderMessage(message, rawToken, bookingFacts);
      const payloadDigest = await digest(
        `${rendered.subject}\n${rendered.text}\n${rendered.html}`,
      );
      const recipientDigest = await digest(
        message.recipient_email.toLowerCase(),
      );
      const provider = await sendMail(
        message.recipient_email,
        rendered.subject,
        rendered.text,
        rendered.html,
        message.queue_id,
      );
      if (provider.accepted) {
        const completed = await db.rpc("complete_workshop_message_delivery", {
          p_queue_id: message.queue_id,
          p_worker: worker,
          p_provider_message_id: provider.providerMessageId,
          p_recipient_digest: recipientDigest,
          p_payload_digest: payloadDigest,
          p_token_digest: rawToken ? await digest(rawToken) : null,
          p_command_key: outcomeKey,
        });
        if (completed.error) throw new Error("delivery persistence failed");
        report.accepted += 1;
        continue;
      }
      const retryAt = provider.retryable
        ? new Date(
          Date.now() +
            Math.min(30, 2 ** Math.max(1, message.attempt_count)) * 60_000,
        ).toISOString()
        : null;
      const recorded = await db.rpc("record_workshop_communication_outcome", {
        p_queue_id: message.queue_id,
        p_worker: worker,
        p_outcome: provider.retryable ? "retryable" : "permanent",
        p_provider_message_id: null,
        p_recipient_digest: recipientDigest,
        p_payload_digest: payloadDigest,
        p_error_category: provider.category,
        p_retry_at: retryAt,
        p_command_key: outcomeKey,
      });
      if (recorded.error) throw new Error("outcome persistence failed");
      if (provider.retryable && recorded.data?.state === "queued") {
        report.retrying += 1;
      } else {
        report.failed += 1;
      }
    } catch (error) {
      const retryable = safeCategory(error) !== "recipient_unavailable";
      const recorded = await db.rpc("record_workshop_communication_outcome", {
        p_queue_id: message.queue_id,
        p_worker: worker,
        p_outcome: retryable ? "retryable" : "permanent",
        p_provider_message_id: null,
        p_recipient_digest: isEmail(message.recipient_email)
          ? await digest(message.recipient_email.toLowerCase())
          : "unavailable",
        p_payload_digest: "unavailable",
        p_error_category: safeCategory(error),
        p_retry_at: retryable
          ? new Date(Date.now() + 5 * 60_000).toISOString()
          : null,
        p_command_key: outcomeKey,
      });
      if (!recorded.error && retryable && recorded.data?.state === "queued") {
        report.retrying += 1;
      } else {
        report.failed += 1;
      }
    } finally {
      rawToken = null;
    }
  }
  return Response.json({ state: "processed", ...report }, {
    headers: { "Cache-Control": "no-store" },
  });
});
