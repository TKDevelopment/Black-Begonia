import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const encoder = new TextEncoder();
const bytesToHex = (bytes: Uint8Array) =>
  [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
const sha256 = async (value: string) =>
  bytesToHex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);

async function verifyStripeSignature(
  rawBody: string,
  header: string,
  secret: string,
): Promise<boolean> {
  if (!secret) return false;
  const parts = header.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) =>
    value
  );
  if (
    !timestamp || signatures.length === 0 ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
  ) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = bytesToHex(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(`${timestamp}.${rawBody}`),
      ),
    ),
  );
  return signatures.some((signature) => safeEqual(signature, expected));
}

async function stripeGet(path: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${Deno.env.get("STRIPE_RESTRICTED_KEY")}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Stripe verification failed (${response.status})`);
  }
  return await response.json();
}

serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: jsonHeaders,
    });
  }
  const rawBody = await request.text();
  try {
    const signature = request.headers.get("stripe-signature") ?? "";
    if (
      !await verifyStripeSignature(
        rawBody,
        signature,
        Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
      )
    ) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }
    const event = JSON.parse(rawBody);
    const source = event?.data?.object ?? {};
    let authoritative = source;
    let session: any;
    if (source.object === "checkout.session") {
      session = await stripeGet(
        `checkout/sessions/${encodeURIComponent(source.id)}`,
      );
    } else if (source.object === "payment_intent") {
      authoritative = await stripeGet(
        `payment_intents/${encodeURIComponent(source.id)}`,
      );
    } else if (source.object === "charge") {
      authoritative = await stripeGet(
        `charges/${encodeURIComponent(source.id)}`,
      );
    } else if (source.object === "refund") {
      authoritative = await stripeGet(
        `refunds/${encodeURIComponent(source.id)}`,
      );
      if (authoritative.charge) {
        const charge = await stripeGet(
          `charges/${encodeURIComponent(authoritative.charge)}`,
        );
        authoritative = {
          ...authoritative,
          payment_intent: charge.payment_intent,
          on_behalf_of: charge.on_behalf_of,
          transfer_data: charge.transfer_data,
          metadata: { ...charge.metadata, ...authoritative.metadata },
          currency: authoritative.currency ?? charge.currency,
        };
      }
    } else if (source.object === "dispute" && source.charge) {
      const charge = await stripeGet(
        `charges/${encodeURIComponent(source.charge)}`,
      );
      authoritative = {
        ...source,
        payment_intent: charge.payment_intent,
        on_behalf_of: charge.on_behalf_of,
        transfer_data: charge.transfer_data,
        metadata: { ...charge.metadata, ...source.metadata },
        currency: source.currency ?? charge.currency,
      };
    }
    if (!session) {
      const paymentIntentId = authoritative.payment_intent ?? authoritative.id;
      if (
        typeof paymentIntentId === "string" &&
        source.object !== "checkout.session"
      ) {
        const sessions = await stripeGet(
          `checkout/sessions?payment_intent=${
            encodeURIComponent(paymentIntentId)
          }&limit=1`,
        );
        session = sessions.data?.[0];
      }
    }
    const metadata =
      (session?.metadata ?? authoritative.metadata ?? {}) as Record<
        string,
        unknown
      >;
    const paymentContext = String(metadata["payment_context"] ?? "");
    const workshopAttemptId = String(
      metadata["workshop_payment_attempt_id"] ?? "",
    );
    const workshopRefundRequestId = String(
      metadata["workshop_refund_request_id"] ?? "",
    );
    const attemptId = String(
      session?.metadata?.payment_attempt_id ??
        authoritative.metadata?.payment_attempt_id ?? "",
    );
    const merchantId = String(
      authoritative.on_behalf_of ?? authoritative.transfer_data?.destination ??
        event.account ?? "platform",
    );
    const expectedMerchantId = Deno.env.get("STRIPE_MERCHANT_ID") ?? merchantId;
    let kind = "receipt";
    let status = "confirmed";
    let amountCents = Number(
      session?.amount_total ?? authoritative.amount_received ??
        authoritative.amount ?? 0,
    );
    if (event.type.includes("refund")) {
      kind = "refund";
      amountCents = Number(
        authoritative.amount ?? authoritative.amount_refunded ?? 0,
      );
    } else if (event.type.includes("dispute")) {
      kind = "dispute";
      amountCents = Number(authoritative.amount ?? 0);
    } else if (event.type.includes("canceled")) {
      kind = "void";
      status = "resolved";
    } else if (
      event.type.includes("payment_failed") || event.type.includes("expired")
    ) status = "failed";
    else if (event.type.includes("processing")) status = "pending";
    const providerObjectId = String(
      kind === "receipt"
        ? (authoritative.payment_intent ?? authoritative.id ?? session?.id ??
          event.id)
        : (source.id ?? authoritative.id ?? event.id),
    );
    const facts = {
      attemptId,
      kind,
      status,
      principalCents: amountCents,
      merchantFeeCents: authoritative.balance_transaction?.fee ?? null,
      currency: String(session?.currency ?? authoritative.currency ?? "")
        .toUpperCase(),
      merchantId,
      expectedMerchantId,
      providerObjectId,
    };
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const payloadDigest = await sha256(rawBody);
    if (paymentContext === "workshop") {
      const bookingEvents = new Set([
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "checkout.session.expired",
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
      ]);
      const financialEvents = new Set([
        "refund.created",
        "refund.updated",
        "charge.succeeded",
        "charge.dispute.created",
        "charge.dispute.closed",
      ]);
      if (
        !/^[0-9a-f-]{36}$/i.test(workshopAttemptId) ||
        !bookingEvents.has(String(event.type)) &&
          !financialEvents.has(String(event.type))
      ) {
        return new Response(
          JSON.stringify({ received: true, ignored: true }),
          { status: 200, headers: jsonHeaders },
        );
      }
      const providerPaymentId = String(
        session?.payment_intent ?? authoritative.payment_intent ??
          (source.object === "payment_intent" ? authoritative.id : ""),
      );
      const workshopAmount = Number(
        session?.amount_total ?? authoritative.amount_received ??
          authoritative.amount ?? 0,
      );
      const workshopCurrency = String(
        session?.currency ?? authoritative.currency ?? "",
      ).toUpperCase();
      if (financialEvents.has(String(event.type))) {
        let financialKind = "fee";
        let financialState = "confirmed";
        let financialAmount = workshopAmount;
        let financialProviderObjectId = String(
          source.id ?? authoritative.id ?? event.id,
        );
        if (String(event.type).includes("refund")) {
          financialKind = "refund";
          financialAmount = Number(
            authoritative.amount ?? authoritative.amount_refunded ?? 0,
          );
          financialState = authoritative.status === "failed"
            ? "failed"
            : authoritative.status === "pending"
            ? "pending"
            : "confirmed";
        } else if (String(event.type).includes("dispute")) {
          financialKind = String(event.type).endsWith(".closed")
            ? "reversal"
            : "dispute";
          financialAmount = Number(authoritative.amount ?? 0);
        } else if (source.object === "charge") {
          const balanceTransactionId =
            typeof authoritative.balance_transaction ===
                "string"
              ? authoritative.balance_transaction
              : "";
          if (balanceTransactionId) {
            const balanceTransaction = await stripeGet(
              `balance_transactions/${
                encodeURIComponent(balanceTransactionId)
              }`,
            );
            financialAmount = Number(balanceTransaction.fee ?? 0);
            financialProviderObjectId = balanceTransactionId;
          } else {
            financialAmount = Number(
              authoritative.balance_transaction?.fee ?? 0,
            );
          }
        }
        if (String(event.type) === "charge.succeeded") {
          const chargeReconciliation = await db.rpc(
            "reconcile_workshop_stripe_event",
            {
              p_provider_event_id: String(event.id),
              p_event_type: "payment_intent.succeeded",
              p_provider_object_id: providerPaymentId || String(source.id),
              p_provider_object_type: "payment_intent",
              p_event_occurred_at: new Date(Number(event.created) * 1000)
                .toISOString(),
              p_signature_verified_at: new Date().toISOString(),
              p_payload_digest: payloadDigest,
              p_payment_attempt_id: workshopAttemptId,
              p_provider_payment_id: providerPaymentId || null,
              p_amount_minor: workshopAmount,
              p_currency: workshopCurrency,
              p_command_key: crypto.randomUUID(),
            },
          );
          if (chargeReconciliation.error) throw chargeReconciliation.error;
        }
        const financial = await db.rpc("manage_workshop_financials", {
          p_action: "record_provider_fact",
          p_payload: {
            kind: financialKind,
            state: financialState,
            amountMinor: financialAmount,
            currency: workshopCurrency,
            providerObjectId: financialProviderObjectId,
            providerObjectType: String(source.object ?? "unknown"),
            providerEventId: String(event.type) === "charge.succeeded"
              ? `${event.id}:fee`
              : String(event.id),
            eventType: String(event.type) === "charge.succeeded"
              ? "charge.succeeded.fee"
              : String(event.type),
            occurredAt: new Date(Number(event.created) * 1000).toISOString(),
            payloadDigest,
            paymentAttemptId: workshopAttemptId,
            refundRequestId: isUuid(workshopRefundRequestId)
              ? workshopRefundRequestId
              : null,
          },
          p_command_key: crypto.randomUUID(),
        });
        if (financial.error) throw financial.error;
        return new Response(
          JSON.stringify({
            received: true,
            duplicate: financial.data?.replayed === true,
          }),
          { status: 200, headers: jsonHeaders },
        );
      }
      const reconciled = await db.rpc("reconcile_workshop_stripe_event", {
        p_provider_event_id: String(event.id),
        p_event_type: String(event.type),
        p_provider_object_id: String(source.id ?? session?.id ?? event.id),
        p_provider_object_type: String(source.object ?? "unknown"),
        p_event_occurred_at: new Date(Number(event.created) * 1000)
          .toISOString(),
        p_signature_verified_at: new Date().toISOString(),
        p_payload_digest: payloadDigest,
        p_payment_attempt_id: workshopAttemptId,
        p_provider_payment_id: providerPaymentId || null,
        p_amount_minor: workshopAmount,
        p_currency: workshopCurrency,
        p_command_key: crypto.randomUUID(),
      });
      if (reconciled.error) throw reconciled.error;
      return new Response(
        JSON.stringify({
          received: true,
          duplicate: reconciled.data?.replayed === true,
        }),
        { status: 200, headers: jsonHeaders },
      );
    }
    const inserted = await db.from("payment_provider_events").upsert({
      provider: "stripe",
      provider_event_id: event.id,
      provider_object_id: providerObjectId,
      provider_object_type: String(source.object ?? "unknown"),
      event_type: event.type,
      event_occurred_at: new Date(Number(event.created) * 1000).toISOString(),
      signature_verified_at: new Date().toISOString(),
      payload_digest: payloadDigest,
      normalized_facts: facts,
      payment_checkout_attempt_id: attemptId || null,
    }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true })
      .select("payment_provider_event_id,processing_state").maybeSingle();
    if (inserted.error) throw inserted.error;
    let stored = inserted.data;
    if (!stored) {
      const existing = await db.from("payment_provider_events").select(
        "payment_provider_event_id,processing_state",
      ).eq("provider", "stripe").eq("provider_event_id", event.id).single();
      if (existing.error) throw existing.error;
      if (["processed", "duplicate"].includes(existing.data.processing_state)) {
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { status: 200, headers: jsonHeaders },
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
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        function: "stripe-payment-webhook",
        message: error instanceof Error ? error.message : "processing failed",
      }),
    );
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
