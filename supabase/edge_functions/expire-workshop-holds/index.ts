import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();
const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const digest = async (value: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");

async function stripeRequest(
  path: string,
  method: "GET" | "POST" = "GET",
) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${Deno.env.get("STRIPE_RESTRICTED_KEY") ?? ""}`,
    },
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`stripe_request_failed_${response.status}`);
  }
  return data;
}

serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: jsonHeaders,
    });
  }
  const expectedSecret = Deno.env.get("WORKSHOP_SCHEDULER_SECRET") ?? "";
  const suppliedSecret = request.headers.get("x-workshop-scheduler-secret") ??
    "";
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: jsonHeaders,
    });
  }

  try {
    const db = createClient<any>(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const due = await db.from("workshop_payment_attempts")
      .select(
        "workshop_payment_attempt_id,provider_checkout_id,amount_minor,currency,effective_expires_at",
      )
      .eq("provider", "stripe")
      .eq("state", "active")
      .not("provider_checkout_id", "is", null)
      .lte("effective_expires_at", new Date().toISOString())
      .order("effective_expires_at")
      .limit(50);
    if (due.error) throw new Error("due_attempts_unavailable");

    for (const attempt of due.data ?? []) {
      const checkoutId = String(attempt.provider_checkout_id);
      const session = await stripeRequest(
        `checkout/sessions/${encodeURIComponent(checkoutId)}`,
      );
      const metadata = session["metadata"] as Record<string, unknown> | undefined;
      if (
        metadata?.["payment_context"] !== "workshop" ||
        metadata?.["workshop_payment_attempt_id"] !==
          attempt.workshop_payment_attempt_id
      ) {
        throw new Error("stripe_metadata_mismatch");
      }

      if (session["payment_status"] === "paid") {
        const paymentIntentId = String(session["payment_intent"] ?? "");
        const paymentIntent = paymentIntentId
          ? await stripeRequest(
            `payment_intents/${encodeURIComponent(paymentIntentId)}`,
          )
          : {};
        const facts = JSON.stringify({
          sessionId: checkoutId,
          paymentIntentId,
          amountMinor: session["amount_total"],
          currency: session["currency"],
          paymentStatus: session["payment_status"],
        });
        const reconciled = await db.rpc("reconcile_workshop_stripe_event", {
          p_provider_event_id: `expiry-recovery:${checkoutId}`,
          p_event_type: "checkout.session.completed",
          p_provider_object_id: checkoutId,
          p_provider_object_type: "checkout.session",
          p_event_occurred_at: new Date(
            Number(paymentIntent["created"] ?? session["created"]) * 1000,
          ).toISOString(),
          p_signature_verified_at: new Date().toISOString(),
          p_payload_digest: await digest(facts),
          p_payment_attempt_id: attempt.workshop_payment_attempt_id,
          p_provider_payment_id: paymentIntentId,
          p_amount_minor: Number(session["amount_total"] ?? 0),
          p_currency: String(session["currency"] ?? "").toUpperCase(),
          p_command_key: crypto.randomUUID(),
        });
        if (reconciled.error) throw new Error("paid_session_reconciliation_failed");
      } else if (session["status"] === "open") {
        await stripeRequest(
          `checkout/sessions/${encodeURIComponent(checkoutId)}/expire`,
          "POST",
        );
      }
    }

    const expired = await db.rpc("expire_workshop_holds", { p_limit: 100 });
    if (expired.error) throw new Error("hold_expiration_failed");
    return new Response(
      JSON.stringify({
        processedStripeAttempts: due.data?.length ?? 0,
        expiredCount: expired.data?.expiredCount ?? 0,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    console.error(JSON.stringify({
      function: "expire-workshop-holds",
      code: error instanceof Error ? error.message : "expiration_failed",
    }));
    return new Response(JSON.stringify({ error: "Expiration failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
