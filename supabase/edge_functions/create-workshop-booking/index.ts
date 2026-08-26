import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const configuredOrigins = (Deno.env.get("WORKSHOP_ALLOWED_ORIGINS") ?? "")
  .split(",").map((value) => value.trim()).filter(Boolean);
const allowedOrigins = new Set([
  ...configuredOrigins,
  "http://localhost:4200",
  "http://127.0.0.1:4200",
]);
const requestRates = new Map<string, { count: number; resetAt: number }>();
const encoder = new TextEncoder();
const safeCodes = new Set([
  "unavailable",
  "quantity_changed",
  "registration_closed",
  "terms_changed",
  "insufficient_capacity",
  "payment_method_unavailable",
  "invalid_request",
]);

const headers = (origin: string) => {
  const result = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
  if (allowedOrigins.has(origin)) {
    result.set("Access-Control-Allow-Origin", origin);
  }
  return result;
};
const respond = (origin: string, status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: headers(origin),
  });
const withinLimit = (key: string) => {
  const now = Date.now();
  const current = requestRates.get(key);
  if (!current || current.resetAt <= now) {
    requestRates.set(key, { count: 1, resetAt: now + 300_000 });
    return true;
  }
  current.count += 1;
  return current.count <= 20;
};
const digest = async (value: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
const tokenForCommand = async (commandKey: string) => {
  const secret = Deno.env.get("WORKSHOP_TOKEN_SIGNING_SECRET") ?? "";
  if (secret.length < 32) throw new Error("token_signing_unavailable");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(commandKey)),
  );
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};
const isUuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
const isEmail = (value: unknown) =>
  typeof value === "string" && value.length <= 320 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const safeDatabaseCode = (error: unknown) => {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
  return [...safeCodes].find((code) => message.includes(code)) ??
    "invalid_request";
};

async function createStripeSession(
  attempt: Record<string, unknown>,
  commandKey: string,
) {
  const priceId = String(attempt["stripePriceId"] ?? "");
  const quantity = Number(attempt["quantity"]);
  const attemptId = String(attempt["paymentAttemptId"] ?? "");
  if (
    !priceId.startsWith("price_") || !Number.isSafeInteger(quantity) ||
    quantity <= 0 || !isUuid(attemptId)
  ) {
    throw new Error("stripe_attempt_unavailable");
  }
  const publicOrigin = (Deno.env.get("WORKSHOP_PUBLIC_ORIGIN") ?? "")
    .replace(/\/+$/, "");
  if (!/^https?:\/\/[^/]+/.test(publicOrigin)) {
    throw new Error("workshop_public_origin_unavailable");
  }
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": String(quantity),
    "metadata[payment_context]": "workshop",
    "metadata[workshop_payment_attempt_id]": attemptId,
    success_url:
      `${publicOrigin}/workshop-booking/status?checkout_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${publicOrigin}/workshops`,
  });
  const response = await fetch(
    "https://api.stripe.com/v1/checkout/sessions",
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${Deno.env.get("STRIPE_RESTRICTED_KEY") ?? ""}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": commandKey,
      },
      body: form,
    },
  );
  if (!response.ok) throw new Error("stripe_checkout_unavailable");
  const session = await response.json() as Record<string, unknown>;
  if (
    typeof session["id"] !== "string" || typeof session["url"] !== "string" ||
    !String(session["url"]).startsWith("https://checkout.stripe.com/")
  ) {
    throw new Error("stripe_checkout_unavailable");
  }
  return session;
}

serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") return respond(origin, 204, {});
  if (request.method !== "POST" || !allowedOrigins.has(origin)) {
    return respond(origin, 404, { code: "unavailable" });
  }
  const clientAddress = request.headers.get("x-forwarded-for")?.split(",")[0]
    ?.trim() ?? "unknown";
  if (!withinLimit(clientAddress)) {
    return respond(origin, 429, { code: "rate_limited" });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const command = String(body["command"] ?? "");
    const db = createClient<any>(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    if (command === "create_hold") {
      const contact = body["contact"] as Record<string, unknown> | undefined;
      const slug = String(body["occurrenceSlug"] ?? "");
      const quantity = Number(body["quantity"]);
      const termsVersion = Number(body["termsVersion"]);
      const commandKey = body["commandKey"];
      if (
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
        !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20 ||
        !Number.isSafeInteger(termsVersion) || termsVersion < 1 ||
        !isUuid(commandKey) || !contact ||
        typeof contact["name"] !== "string" ||
        contact["name"].trim().length < 1 ||
        contact["name"].trim().length > 160 ||
        !isEmail(contact["email"]) ||
        (contact["phone"] != null &&
          (typeof contact["phone"] !== "string" ||
            contact["phone"].length > 40))
      ) {
        return respond(origin, 400, { code: "invalid_request" });
      }
      const bookingToken = await tokenForCommand(String(commandKey));
      const result = await db.rpc("create_workshop_seat_hold", {
        p_occurrence_slug: slug,
        p_quantity: quantity,
        p_contact_name: contact["name"].trim(),
        p_contact_email: String(contact["email"]).trim().toLowerCase(),
        p_contact_phone: typeof contact["phone"] === "string"
          ? contact["phone"].trim() || null
          : null,
        p_terms_version: termsVersion,
        p_status_token_digest: await digest(bookingToken),
        p_command_key: commandKey,
        p_hold_minutes: 15,
      });
      if (result.error) {
        const code = safeDatabaseCode(result.error);
        const status = code === "insufficient_capacity" ? 409 : 400;
        return respond(origin, status, {
          code: code === "insufficient_capacity" ? "unavailable" : code,
        });
      }
      return respond(origin, 200, {
        state: "held",
        bookingToken,
        supportReference: result.data.supportReference,
        quantity: result.data.quantity,
        priceMinor: result.data.priceMinor,
        totalMinor: result.data.totalMinor,
        currency: result.data.currency,
        effectiveExpiresAt: result.data.effectiveExpiresAt,
        methods: result.data.methods,
      });
    }

    if (command === "choose_payment") {
      const bookingToken = String(body["bookingToken"] ?? "");
      const method = String(body["method"] ?? "");
      const commandKey = body["commandKey"];
      if (
        bookingToken.length < 32 || bookingToken.length > 256 ||
        !["stripe", "direct_venmo"].includes(method) || !isUuid(commandKey)
      ) {
        return respond(origin, 400, { code: "invalid_request" });
      }
      const attempt = await db.rpc("switch_workshop_payment_method", {
        p_status_token_digest: await digest(bookingToken),
        p_method: method,
        p_command_key: commandKey,
        p_venmo_target: method === "direct_venmo"
          ? Deno.env.get("WORKSHOP_VENMO_TARGET") ?? null
          : null,
        p_stripe_hold_minutes: 30,
        p_venmo_hold_hours: 24,
      });
      if (attempt.error) {
        return respond(origin, 400, {
          code: safeDatabaseCode(attempt.error),
        });
      }
      if (method === "direct_venmo") {
        return respond(origin, 200, {
          state: "pending_manual_payment",
          method,
          approvedTarget: attempt.data.approvedTarget,
          amountMinor: attempt.data.amountMinor,
          currency: attempt.data.currency,
          reference: attempt.data.reference,
          effectiveExpiresAt: attempt.data.effectiveExpiresAt,
        });
      }

      const session = await createStripeSession(attempt.data, String(commandKey));
      const attached = await db.rpc("attach_workshop_stripe_checkout", {
        p_payment_attempt_id: attempt.data.paymentAttemptId,
        p_provider_checkout_id: session["id"],
        p_command_key: crypto.randomUUID(),
      });
      if (attached.error) {
        await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${
            encodeURIComponent(String(session["id"]))
          }/expire`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${Deno.env.get("STRIPE_RESTRICTED_KEY") ?? ""}`,
            },
          },
        );
        throw new Error("stripe_checkout_unavailable");
      }
      return respond(origin, 200, {
        state: "redirect",
        method,
        url: session["url"],
        effectiveExpiresAt: attempt.data.effectiveExpiresAt,
      });
    }

    return respond(origin, 400, { code: "invalid_request" });
  } catch {
    console.error(JSON.stringify({
      function: "create-workshop-booking",
      code: "request_failed",
    }));
    return respond(origin, 502, { code: "unavailable" });
  }
});
