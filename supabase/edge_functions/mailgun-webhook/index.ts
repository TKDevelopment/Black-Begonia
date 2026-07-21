import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const encoder = new TextEncoder();
const hex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
const equal = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};
async function verify(timestamp: string, token: string, signature: string) {
  const signingKey = (
    Deno.env.get("MG_WEBHOOK_SIGNING_KEY") ??
      Deno.env.get("MAILGUN_SIGNING_KEY") ??
      ""
  ).trim();
  if (
    !signingKey || !timestamp || !token ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 900
  ) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(
    await crypto.subtle.sign("HMAC", key, encoder.encode(timestamp + token)),
  );
  return equal(expected, signature);
}

serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers,
    });
  }
  const raw = await request.text();
  try {
    const body = JSON.parse(raw);
    const signature = body.signature ?? {};
    if (
      !await verify(
        String(signature.timestamp ?? ""),
        String(signature.token ?? ""),
        String(signature.signature ?? ""),
      )
    ) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers,
      });
    }
    const event = body["event-data"] ?? {};
    const messageId = String(event.message?.headers?.["message-id"] ?? "")
      .trim().replace(/^<|>$/g, "");
    if (!messageId) {
      return new Response(JSON.stringify({ received: true, matched: false }), {
        status: 200,
        headers,
      });
    }
    const eventType = String(event.event ?? "unknown");
    const eventIdentity = String(
      event.id ??
        await crypto.subtle.digest(
          "SHA-256",
          encoder.encode(`${messageId}:${eventType}:${event.timestamp}`),
        ).then(hex),
    );
    const eventAt = Number(event.timestamp)
      ? new Date(Number(event.timestamp) * 1000).toISOString()
      : new Date().toISOString();
    const payloadDigest = hex(
      await crypto.subtle.digest("SHA-256", encoder.encode(raw)),
    );
    const normalizedFacts = {
      severity: event.severity ?? null,
      reason:
        String(event.reason ?? event["delivery-status"]?.code ?? "").slice(
          0,
          80,
        ) || null,
    };
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const delivery = await db.from("payment_message_deliveries").select(
      "payment_message_delivery_id,status,project_id",
    ).eq("mailgun_message_id", messageId).maybeSingle();
    if (delivery.error) throw delivery.error;
    if (!delivery.data) {
      return new Response(JSON.stringify({ received: true, matched: false }), {
        status: 200,
        headers,
      });
    }
    const inserted = await db.from("payment_message_delivery_events").upsert({
      payment_message_delivery_id: delivery.data.payment_message_delivery_id,
      provider_event_identity: eventIdentity,
      event_type: eventType,
      provider_timestamp: eventAt,
      signature_verified_at: new Date().toISOString(),
      payload_digest: payloadDigest,
      normalized_facts: normalizedFacts,
    }, { onConflict: "provider_event_identity", ignoreDuplicates: true })
      .select("payment_message_delivery_event_id").maybeSingle();
    if (inserted.error) throw inserted.error;
    if (inserted.data) {
      const changes: Record<string, unknown> = {};
      if (eventType === "delivered") {
        changes.status = "delivered";
        changes.delivered_at = eventAt;
      } else if (
        eventType === "accepted" && delivery.data.status !== "delivered"
      ) {
        changes.status = "accepted";
        changes.accepted_at = eventAt;
      } else if (eventType === "failed") {
        const permanent = event.severity === "permanent";
        changes.status = permanent ? "permanent_failed" : "temporary_failed";
        changes.failed_at = eventAt;
        changes.failure_class = permanent
          ? "mailgun_permanent"
          : "mailgun_temporary";
        changes.redacted_error = "Mail provider reported a delivery failure";
      }
      if (Object.keys(changes).length) {
        const updated = await db.from("payment_message_deliveries").update(
          changes,
        ).eq(
          "payment_message_delivery_id",
          delivery.data.payment_message_delivery_id,
        );
        if (updated.error) throw updated.error;
        await db.rpc("create_payment_activity", {
          p_project_id: delivery.data.project_id,
          p_label: eventType === "delivered"
            ? "Payment email delivered"
            : eventType === "failed"
            ? "Payment email delivery failed"
            : "Payment email accepted",
          p_description: eventType === "failed"
            ? "Mailgun reported a normalized payment-message failure."
            : "Mailgun recorded a payment-message delivery outcome.",
          p_actor_type: "schedule",
          p_metadata: {
            delivery_id: delivery.data.payment_message_delivery_id,
            outcome: eventType,
          },
          p_actor_id: null,
        });
      }
    }
    return new Response(JSON.stringify({ received: true, matched: true }), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        function: "mailgun-webhook",
        message: error instanceof Error ? error.message : "processing failed",
      }),
    );
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers },
    );
  }
});
