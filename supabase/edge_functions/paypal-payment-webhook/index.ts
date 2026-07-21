import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const apiOrigin = Deno.env.get("PAYPAL_API_ORIGIN") ??
  "https://api-m.sandbox.paypal.com";
const digest = async (value: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ].map((byte) => byte.toString(16).padStart(2, "0")).join("");

async function paypalToken() {
  const credentials = btoa(
    `${Deno.env.get("PAYPAL_CLIENT_ID")}:${
      Deno.env.get("PAYPAL_CLIENT_SECRET")
    }`,
  );
  const response = await fetch(`${apiOrigin}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    throw new Error(`PayPal authorization failed (${response.status})`);
  }
  return String((await response.json()).access_token);
}

async function paypalGet(path: string, accessToken: string) {
  const response = await fetch(`${apiOrigin}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`PayPal verification failed (${response.status})`);
  }
  return await response.json();
}

serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers,
    });
  }
  const rawBody = await request.text();
  try {
    const event = JSON.parse(rawBody);
    const accessToken = await paypalToken();
    const verification = await fetch(
      `${apiOrigin}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: request.headers.get("paypal-auth-algo"),
          cert_url: request.headers.get("paypal-cert-url"),
          transmission_id: request.headers.get("paypal-transmission-id"),
          transmission_sig: request.headers.get("paypal-transmission-sig"),
          transmission_time: request.headers.get("paypal-transmission-time"),
          webhook_id: Deno.env.get("PAYPAL_WEBHOOK_ID"),
          webhook_event: event,
        }),
      },
    );
    if (
      !verification.ok ||
      (await verification.json()).verification_status !== "SUCCESS"
    ) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers,
      });
    }
    const resource = event.resource ?? {};
    const resourceType = String(
      resource.resource_type ?? resource.object ?? "capture",
    ).toLowerCase();
    const related = resource.supplementary_data?.related_ids ?? {};
    let orderId = String(
      related.order_id ?? (resourceType.includes("order") ? resource.id : ""),
    );
    const captureId = String(
      related.capture_id ??
        (resourceType.includes("capture") ? resource.id : ""),
    );
    const capture = captureId
      ? await paypalGet(
        `/v2/payments/captures/${encodeURIComponent(captureId)}`,
        accessToken,
      )
      : resource;
    orderId = orderId ||
      String(capture?.supplementary_data?.related_ids?.order_id ?? "");
    const order = orderId
      ? await paypalGet(
        `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
        accessToken,
      )
      : null;
    const unit = order?.purchase_units?.[0];
    const attemptId = String(unit?.custom_id ?? "");
    const amount = resource.amount ?? capture?.amount ?? unit?.amount ?? {};
    let kind = "receipt";
    let status = "confirmed";
    const type = String(event.event_type ?? "");
    if (type.includes("REFUND")) kind = "refund";
    else if (type.includes("REVERSED") || type.includes("REVERSAL")) {
      kind = "reversal";
    } else if (type.includes("DISPUTE")) kind = "dispute";
    else if (type.includes("VOIDED")) {
      kind = "void";
      status = "resolved";
    }
    if (type.includes("PENDING")) status = "pending";
    else if (type.includes("DENIED") || type.includes("DECLINED")) {
      status = "failed";
    }
    const merchantId = String(
      capture?.payee?.merchant_id ?? unit?.payee?.merchant_id ?? "",
    );
    const expectedMerchantId = Deno.env.get("PAYPAL_MERCHANT_ID") ?? merchantId;
    const providerObjectId = String(
      kind === "receipt"
        ? (capture?.id ?? resource.id ?? event.id)
        : (resource.id ?? capture?.id ?? event.id),
    );
    const facts = {
      attemptId,
      kind,
      status,
      principalCents: Math.round(Number(amount.value ?? 0) * 100),
      merchantFeeCents: null,
      currency: String(amount.currency_code ?? "").toUpperCase(),
      merchantId,
      expectedMerchantId,
      providerObjectId,
    };
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const inserted = await db.from("payment_provider_events").upsert({
      provider: "paypal",
      provider_event_id: event.id,
      provider_object_id: providerObjectId,
      provider_object_type: resourceType,
      event_type: type,
      event_occurred_at: event.create_time ?? new Date().toISOString(),
      signature_verified_at: new Date().toISOString(),
      payload_digest: await digest(rawBody),
      normalized_facts: facts,
      payment_checkout_attempt_id: attemptId || null,
    }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true })
      .select("payment_provider_event_id").maybeSingle();
    if (inserted.error) throw inserted.error;
    let stored = inserted.data;
    if (!stored) {
      const existing = await db.from("payment_provider_events").select(
        "payment_provider_event_id,processing_state",
      ).eq("provider", "paypal").eq("provider_event_id", event.id).single();
      if (existing.error) throw existing.error;
      if (["processed", "duplicate"].includes(existing.data.processing_state)) {
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { status: 200, headers },
        );
      }
      stored = existing.data;
    }
    const reconciled = await db.rpc("reconcile_payment_event", {
      p_provider_event_id: stored.payment_provider_event_id,
      p_facts: facts,
    });
    if (reconciled.error) throw reconciled.error;
    if (reconciled.data?.state === "failed") {
      throw new Error("Payment reconciliation failed");
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        function: "paypal-payment-webhook",
        message: error instanceof Error ? error.message : "processing failed",
      }),
    );
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers },
    );
  }
});
