import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const configuredOrigins = (Deno.env.get("PAYMENT_ALLOWED_ORIGINS") ?? "").split(",").map(
  (v) => v.trim(),
).filter(Boolean);
const allowedOrigins = new Set([
  ...configuredOrigins,
  "http://localhost:4200",
  "http://127.0.0.1:4200",
]);
const requestRates = new Map<string, { count: number; resetAt: number }>();
const withinCheckoutLimit = (key: string) => {
  const now = Date.now();
  const entry = requestRates.get(key);
  if (!entry || entry.resetAt <= now) {
    requestRates.set(key, { count: 1, resetAt: now + 300_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 12;
};
const hdr = (o: string) => {
  const result = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
  if (allowedOrigins.has(o)) result.set("Access-Control-Allow-Origin", o);
  return result;
};
const out = (o: string, s: number, b: unknown) =>
  new Response(s === 204 ? null : JSON.stringify(b), {
    status: s,
    headers: hdr(o),
  });
const hash = async (v: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)),
    ),
  ].map((x) => x.toString(16).padStart(2, "0")).join("");
const paypalToken = async () => {
  const basic = btoa(
    `${Deno.env.get("PAYPAL_CLIENT_ID")}:${
      Deno.env.get("PAYPAL_CLIENT_SECRET")
    }`,
  );
  const r = await fetch(
    `${
      Deno.env.get("PAYPAL_API_ORIGIN") ?? "https://api-m.sandbox.paypal.com"
    }/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    },
  );
  if (!r.ok) throw new Error("PayPal authorization failed");
  return (await r.json()).access_token as string;
};
serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return out(origin, 204, {});
  if (req.method !== "POST" || !allowedOrigins.has(origin)) {
    return out(origin, 404, { error: "Request unavailable" });
  }
  const clientAddress = req.headers.get("x-forwarded-for")?.split(",")[0]
    ?.trim() ?? "unknown";
  if (!withinCheckoutLimit(clientAddress)) {
    return out(origin, 429, { error: "Payment option is temporarily unavailable" });
  }
  let attemptId: string | undefined;
  try {
    const b = await req.json();
    const token = String(b.token ?? "");
    const method = String(b.method ?? "");
    const digest = await hash(token);
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    if (method === "cash" || method === "check") {
      const { data, error } = await db.rpc("record_payment_intention", {
        p_token_digest: digest,
        p_method: method,
        p_command_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return out(origin, 200, {
        kind: "intention",
        method,
        instructions: data.instruction_snapshot,
        pauseEndsAt: data.pause_ends_at,
      });
    }
    if (method === "venmo") {
      const { data: settings } = await db.from("payment_collection_settings")
        .select("venmo_enabled,venmo_business_target").single();
      if (!settings?.venmo_enabled) {
        const { data, error } = await db.rpc("record_payment_intention", {
          p_token_digest: digest,
          p_method: "venmo_business_profile",
          p_command_key: crypto.randomUUID(),
        });
        if (error) throw error;
        return out(origin, 200, {
          kind: "manual_venmo",
          approvedTarget: settings?.venmo_business_target,
          reference: data.reference,
          amountCents: undefined,
        });
      }
    }
    const providerMethod = method === "stripe_card"
      ? "stripe_card"
      : "paypal_venmo";
    const idempotency = crypto.randomUUID();
    const reserved = await db.rpc("reserve_payment_checkout", {
      p_token_digest: digest,
      p_method: providerMethod,
      p_command_key: idempotency,
    });
    if (reserved.error) throw reserved.error;
    if (reserved.data.state === "method_locked") {
      return out(origin, 409, {
        error: "PAYMENT_METHOD_LOCKED",
        attempt: reserved.data.attemptId,
      });
    }
    const a = reserved.data.attempt;
    attemptId = a.payment_checkout_attempt_id;
    if (reserved.data.state === "existing" && a.provider_handoff_url) {
      return out(
        origin,
        200,
        providerMethod === "stripe_card"
          ? {
            kind: "redirect",
            url: a.provider_handoff_url,
            attempt: attemptId,
          }
          : {
            kind: "paypal_order",
            orderId: a.provider_order_id,
            attempt: attemptId,
            clientId: Deno.env.get("PAYPAL_CLIENT_ID"),
          },
      );
    }
    if (providerMethod === "stripe_card") {
      const form = new URLSearchParams({
        mode: "payment",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]":
          "Black Begonia floral payment",
        "line_items[0][price_data][unit_amount]": String(
          Math.round(Number(a.principal_amount) * 100),
        ),
        "line_items[0][quantity]": "1",
        "metadata[payment_request_id]": a.payment_request_id,
        "metadata[payment_attempt_id]": attemptId!,
        success_url: `${Deno.env.get("PAYMENT_PUBLIC_ORIGIN")}/pay/${
          encodeURIComponent(token)
        }/status?attempt=${attemptId}`,
        cancel_url: `${Deno.env.get("PAYMENT_PUBLIC_ORIGIN")}/pay/${
          encodeURIComponent(token)
        }`,
        "expires_at": String(
          Math.floor(new Date(a.expires_at).getTime() / 1000),
        ),
      });
      const sr = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("STRIPE_RESTRICTED_KEY")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": idempotency,
        },
        body: form,
      });
      if (!sr.ok) throw new Error("Stripe checkout failed");
      const session = await sr.json();
      await db.rpc("finalize_payment_checkout", {
        p_attempt_id: attemptId,
        p_state: "active",
        p_provider_id: session.id,
        p_handoff_url: session.url,
        p_client_token: null,
        p_error: null,
      });
      return out(origin, 200, {
        kind: "redirect",
        url: session.url,
        attempt: attemptId,
      });
    }
    const access = await paypalToken();
    const pr = await fetch(
      `${
        Deno.env.get("PAYPAL_API_ORIGIN") ?? "https://api-m.sandbox.paypal.com"
      }/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": idempotency,
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            custom_id: attemptId,
            invoice_id: `BB-${attemptId}`,
            amount: {
              currency_code: "USD",
              value: Number(a.principal_amount).toFixed(2),
            },
            payee: { merchant_id: Deno.env.get("PAYPAL_MERCHANT_ID") },
          }],
        }),
      },
    );
    if (!pr.ok) throw new Error("Venmo order failed");
    const order = await pr.json();
    await db.rpc("finalize_payment_checkout", {
      p_attempt_id: attemptId,
      p_state: "active",
      p_provider_id: order.id,
      p_handoff_url: null,
      p_client_token: null,
      p_error: null,
    });
    return out(origin, 200, {
      kind: "paypal_order",
      orderId: order.id,
      attempt: attemptId,
      clientId: Deno.env.get("PAYPAL_CLIENT_ID"),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        function: "create-payment-checkout",
        attemptId,
        message: error instanceof Error ? error.message : "checkout failed",
      }),
    );
    if (attemptId) {
      const db = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await db.rpc("finalize_payment_checkout", {
        p_attempt_id: attemptId,
        p_state: "failed",
        p_provider_id: null,
        p_handoff_url: null,
        p_client_token: null,
        p_error: "provider_unavailable",
      });
    }
    return out(origin, 400, {
      error: "Payment option is temporarily unavailable",
    });
  }
});
