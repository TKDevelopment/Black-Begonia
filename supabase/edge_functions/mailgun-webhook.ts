import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MG_WEBHOOK_SIGNING_KEY = Deno.env.get("MG_WEBHOOK_SIGNING_KEY")!;

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

function generateRequestId() {
  return crypto.randomUUID();
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

function normalizeMessageId(messageId: string | null | undefined): string {
  return String(messageId ?? "").trim().replace(/^<|>$/g, "");
}

function maskMessageId(messageId: string | null | undefined): string | null {
  if (!messageId) return null;
  if (messageId.length <= 12) return `${messageId.slice(0, 4)}***`;
  return `${messageId.slice(0, 8)}***${messageId.slice(-8)}`;
}

function truncate(value: string | null | undefined, max = 300): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function logInfo(requestId: string, message: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({
    level: "INFO",
    requestId,
    function: "mailgun-webhook",
    message,
    ...data,
  }));
}

function logWarn(requestId: string, message: string, data?: Record<string, unknown>) {
  console.warn(JSON.stringify({
    level: "WARN",
    requestId,
    function: "mailgun-webhook",
    message,
    ...data,
  }));
}

function logError(requestId: string, message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({
    level: "ERROR",
    requestId,
    function: "mailgun-webhook",
    message,
    ...data,
  }));
}

async function verifySignature(timestamp: string, token: string, signature: string) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(MG_WEBHOOK_SIGNING_KEY);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signed = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(timestamp + token),
  );

  const computed = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === signature;
}

function mapMailgunEventToStatus(eventType: string): {
  status: string;
  failureSeverity?: string | null;
} {
  switch (eventType) {
    case "accepted":
      return { status: "accepted" };
    case "delivered":
      return { status: "delivered" };
    case "opened":
      return { status: "opened" };
    case "clicked":
      return { status: "clicked" };
    case "complained":
      return { status: "complained" };
    case "unsubscribed":
      return { status: "unsubscribed" };
    case "temporary_fail":
      return { status: "failed", failureSeverity: "temporary" };
    case "permanent_fail":
      return { status: "failed", failureSeverity: "permanent" };
    default:
      return { status: "accepted" };
  }
}

serve(async (req) => {
  const requestId = generateRequestId();
  const startedAt = Date.now();

  logInfo(requestId, "Incoming webhook request received", {
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

    if (!SUPABASE_URL) throw new Error("Missing required env var: SUPABASE_URL");
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing required env var: SUPABASE_SERVICE_ROLE_KEY");
    if (!MG_WEBHOOK_SIGNING_KEY) throw new Error("Missing required env var: MG_WEBHOOK_SIGNING_KEY");

    logInfo(requestId, "Environment validation passed");

    const body = await req.json();

    logInfo(requestId, "Webhook payload parsed", {
      top_level_keys: body && typeof body === "object" ? Object.keys(body) : [],
      has_signature: Boolean(body?.signature),
      has_event_data: Boolean(body?.["event-data"]),
    });

    const signatureBlock = body?.signature;
    const eventData = body?.["event-data"];

    if (!signatureBlock || !eventData) {
      logWarn(requestId, "Invalid webhook payload shape", {
        has_signature: Boolean(signatureBlock),
        has_event_data: Boolean(eventData),
        payload_preview: truncate(JSON.stringify(body)),
      });

      return jsonResponse(400, { error: "Invalid Mailgun webhook payload" });
    }

    const timestamp = String(signatureBlock.timestamp ?? "");
    const token = String(signatureBlock.token ?? "");
    const signature = String(signatureBlock.signature ?? "");

    logInfo(requestId, "Extracted signature fields", {
      has_timestamp: Boolean(timestamp),
      has_token: Boolean(token),
      has_signature: Boolean(signature),
      timestamp,
      token_preview: truncate(token, 20),
      signature_preview: truncate(signature, 20),
    });

    const isValid = await verifySignature(timestamp, token, signature);

    logInfo(requestId, "Webhook signature verification completed", {
      is_valid: isValid,
    });

    if (!isValid) {
      logWarn(requestId, "Rejected webhook due to invalid signature", {
        timestamp,
        token_preview: truncate(token, 20),
        signature_preview: truncate(signature, 20),
      });

      return jsonResponse(401, { error: "Invalid webhook signature" });
    }

    const eventType = String(eventData.event ?? "");
    const rawProviderMessageId = String(eventData.message?.headers?.["message-id"] ?? "");
    const providerMessageId = normalizeMessageId(rawProviderMessageId);
    const providerEventId = eventData.id ?? null;
    const eventTimestampSeconds = Number(eventData.timestamp ?? 0);
    const eventTimestamp = eventTimestampSeconds
      ? new Date(eventTimestampSeconds * 1000).toISOString()
      : new Date().toISOString();

    logInfo(requestId, "Normalized webhook provider message id", {
      raw_provider_message_id: rawProviderMessageId || null,
      normalized_provider_message_id: providerMessageId || null,
      masked_normalized_provider_message_id: maskMessageId(providerMessageId),
    });

    logInfo(requestId, "Parsed Mailgun event data", {
      event_type: eventType,
      provider_event_id: providerEventId,
      provider_message_id: maskMessageId(providerMessageId),
      event_timestamp: eventTimestamp,
      recipient: eventData.recipient ?? null,
      severity: eventData.severity ?? null,
      reason: truncate(
        eventData.reason ||
        eventData["delivery-status"]?.description ||
        null,
      ),
    });

    if (!providerMessageId) {
      logWarn(requestId, "Ignoring webhook because provider_message_id is missing", {
        event_type: eventType,
        provider_event_id: providerEventId,
      });

      return jsonResponse(200, {
        success: true,
        ignored: true,
        reason: "No provider_message_id found in webhook",
      });
    }

    logInfo(requestId, "Creating Supabase service client");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    logInfo(requestId, "Fetching local email_messages row", {
      provider_message_id: maskMessageId(providerMessageId),
    });

    const { data: messageRow, error: fetchError } = await supabase
      .from("email_messages")
      .select("email_message_id, status")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();

    if (fetchError) {
      logError(requestId, "Failed to fetch email_messages row", {
        provider_message_id: maskMessageId(providerMessageId),
        error: sanitizeError(fetchError),
      });

      return jsonResponse(500, { error: "Failed to fetch email message row" });
    }

    if (!messageRow) {
      logWarn(requestId, "No local email_messages row found for provider_message_id", {
        provider_message_id: maskMessageId(providerMessageId),
        event_type: eventType,
      });

      return jsonResponse(200, {
        success: true,
        ignored: true,
        reason: "No local email_message found for provider_message_id",
        provider_message_id: providerMessageId,
      });
    }

    logInfo(requestId, "Matched webhook to local email message", {
      email_message_id: messageRow.email_message_id,
      current_status: messageRow.status,
      provider_message_id: maskMessageId(providerMessageId),
    });

    const mapped = mapMailgunEventToStatus(eventType);

    logInfo(requestId, "Mapped Mailgun event to local status", {
      event_type: eventType,
      mapped_status: mapped.status,
      failure_severity: mapped.failureSeverity ?? null,
    });

    const updatePayload: Record<string, unknown> = {
      status: mapped.status,
      last_event_at: eventTimestamp,
      provider_event_id: providerEventId,
    };

    if (mapped.failureSeverity) {
      updatePayload.failure_severity = mapped.failureSeverity;
      updatePayload.failure_reason =
        eventData.reason ||
        eventData["delivery-status"]?.description ||
        eventData["severity"] ||
        "Mailgun reported a failure";
      updatePayload.failed_at = eventTimestamp;
    }

    if (eventType === "delivered") {
      updatePayload.delivered_at = eventTimestamp;
    }

    if (eventType === "accepted") {
      updatePayload.accepted_at = eventTimestamp;
    }

    logInfo(requestId, "Prepared email_messages update payload", {
      email_message_id: messageRow.email_message_id,
      update_payload: updatePayload,
    });

    const { error: updateError } = await supabase
      .from("email_messages")
      .update(updatePayload)
      .eq("email_message_id", messageRow.email_message_id);

    if (updateError) {
      logError(requestId, "Failed to update email_messages row", {
        email_message_id: messageRow.email_message_id,
        provider_message_id: maskMessageId(providerMessageId),
        error: sanitizeError(updateError),
      });

      return jsonResponse(500, { error: "Failed to update email_messages" });
    }

    logInfo(requestId, "email_messages row updated successfully", {
      email_message_id: messageRow.email_message_id,
      new_status: mapped.status,
    });

    logInfo(requestId, "Inserting email_events history row", {
      email_message_id: messageRow.email_message_id,
      provider_event_id: providerEventId,
      event_type: eventType,
    });

    const { error: eventInsertError } = await supabase
      .from("email_events")
      .insert({
        email_message_id: messageRow.email_message_id,
        provider: "mailgun",
        provider_event_id: providerEventId,
        provider_message_id: providerMessageId,
        event_type: eventType,
        event_timestamp: eventTimestamp,
        raw_payload: body,
      });

    if (eventInsertError) {
      logError(requestId, "Failed to insert email_events row", {
        email_message_id: messageRow.email_message_id,
        provider_event_id: providerEventId,
        provider_message_id: maskMessageId(providerMessageId),
        error: sanitizeError(eventInsertError),
      });

      return jsonResponse(500, { error: "Failed to insert email_events row" });
    }

    const durationMs = Date.now() - startedAt;

    logInfo(requestId, "Webhook processed successfully", {
      email_message_id: messageRow.email_message_id,
      provider_event_id: providerEventId,
      provider_message_id: maskMessageId(providerMessageId),
      event_type: eventType,
      status: mapped.status,
      duration_ms: durationMs,
    });

    return jsonResponse(200, {
      success: true,
      email_message_id: messageRow.email_message_id,
      provider_message_id: providerMessageId,
      event_type: eventType,
      status: mapped.status,
      request_id: requestId,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    logError(requestId, "Unhandled webhook function error", {
      duration_ms: durationMs,
      error: sanitizeError(error),
    });

    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unhandled server error",
      request_id: requestId,
    });
  }
});