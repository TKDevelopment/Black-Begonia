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
const headers = (o: string) => {
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
const output = (o: string, s: number, b: unknown) =>
  new Response(s === 204 ? null : JSON.stringify(b), {
    status: s,
    headers: headers(o),
  });
const digest = async (v: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)),
    ),
  ].map((x) => x.toString(16).padStart(2, "0")).join("");
serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return output(origin, 204, {});
  if (req.method !== "POST" || !allowedOrigins.has(origin)) {
    return output(origin, 404, { state: "unavailable" });
  }
  try {
    const b = await req.json();
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const tokenDigest = await digest(String(b.token ?? ""));
    const { data: request } = await db.from("payment_requests").select(
      "payment_request_id",
    ).eq("token_digest", tokenDigest).eq("status", "active").single();
    const { data: a } = await db.from("payment_checkout_attempts").select("*")
      .eq("payment_checkout_attempt_id", String(b.attempt ?? "")).eq(
        "payment_request_id",
        request?.payment_request_id,
      ).eq("method", "paypal_venmo").single();
    if (!a?.provider_order_id) throw new Error("Attempt unavailable");
    const basic = btoa(
      `${Deno.env.get("PAYPAL_CLIENT_ID")}:${
        Deno.env.get("PAYPAL_CLIENT_SECRET")
      }`,
    );
    const ar = await fetch(
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
    const access = (await ar.json()).access_token;
    const cr = await fetch(
      `${
        Deno.env.get("PAYPAL_API_ORIGIN") ?? "https://api-m.sandbox.paypal.com"
      }/v2/checkout/orders/${encodeURIComponent(a.provider_order_id)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": a.capture_idempotency_key ??
            `capture-${a.payment_checkout_attempt_id}`,
        },
      },
    );
    const capture = await cr.json();
    if (!cr.ok) throw new Error("Capture failed");
    const status = String(capture.status);
    await db.from("payment_checkout_attempts").update({
      status: status === "COMPLETED"
        ? "processing"
        : status === "PENDING"
        ? "processing"
        : "failed",
      provider_capture_id: capture.purchase_units?.[0]?.payments?.captures?.[0]
        ?.id,
      last_verified_state: status,
    }).eq("payment_checkout_attempt_id", a.payment_checkout_attempt_id);
    return output(origin, 200, {
      state: status === "COMPLETED"
        ? "processing"
        : status === "PENDING"
        ? "processing"
        : "failed",
      attempt: a.payment_checkout_attempt_id,
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        function: "capture-venmo-order",
        message: error instanceof Error ? error.message : "capture failed",
      }),
    );
    return output(origin, 400, { state: "failed" });
  }
});
