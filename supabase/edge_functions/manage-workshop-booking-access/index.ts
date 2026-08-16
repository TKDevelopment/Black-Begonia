import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const configuredOrigins = (Deno.env.get("WORKSHOP_ALLOWED_ORIGINS") ?? "")
  .split(",").map((value) => value.trim()).filter(Boolean);
const allowedOrigins = new Set([
  ...configuredOrigins,
  "http://localhost:4200",
  "http://127.0.0.1:4200",
]);
const rates = new Map<string, { count: number; resetAt: number }>();
const encoder = new TextEncoder();
const genericRecovery = {
  state: "accepted",
  message:
    "If the details match an eligible booking, a new access link will be sent.",
};

const headers = (origin: string) => {
  const result = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
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
const withinLimit = (key: string, limit: number) => {
  const now = Date.now();
  const current = rates.get(key);
  if (!current || current.resetAt <= now) {
    rates.set(key, { count: 1, resetAt: now + 300_000 });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
};
const digest = async (value: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_")
    .replaceAll("=", "");
const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
const isEmail = (value: unknown) =>
  typeof value === "string" && value.length <= 320 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isStripeCheckoutSessionId = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 255 &&
  /^cs_(?:test|live)_[A-Za-z0-9]+$/.test(value);

async function issueStatus(
  db: ReturnType<typeof createClient<any>>,
  origin: string,
  statusTokenDigest: string,
  verifiedCheckoutReference?: string,
) {
  const status = await db.rpc("get_workshop_booking_status", {
    p_status_token_digest: statusTokenDigest,
  });
  if (status.error || !status.data) {
    return respond(origin, 200, { state: "unavailable" });
  }
  if (status.data.state === "unavailable" && verifiedCheckoutReference) {
    return respond(origin, 200, {
      state: "processing",
      supportReference: verifiedCheckoutReference,
    });
  }
  if (status.data.state === "confirmed") {
    const rawGrant = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const registration = await db.rpc("manage_workshop_analytics_outcome", {
      p_action: "register_confirmation",
      p_payload: {
        statusTokenDigest,
        grantDigest: await digest(rawGrant),
      },
    });
    if (!registration.error && registration.data?.state === "issued") {
      return respond(origin, 200, {
        ...status.data,
        analyticsOutcomeGrant: rawGrant,
      });
    }
  }
  return respond(origin, 200, status.data);
}

serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") return respond(origin, 204, {});
  if (request.method !== "POST" || !allowedOrigins.has(origin)) {
    return respond(origin, 404, { state: "unavailable" });
  }
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]
    ?.trim() ?? "unknown";

  try {
    const body = await request.json() as Record<string, unknown>;
    const command = String(body["command"] ?? "");
    const db = createClient<any>(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    if (command === "status") {
      if (!withinLimit(`status:${address}`, 30)) {
        return respond(origin, 429, { state: "unavailable" });
      }
      const bookingToken = String(body["bookingToken"] ?? "");
      if (bookingToken.length < 32 || bookingToken.length > 256) {
        return respond(origin, 200, { state: "unavailable" });
      }
      return issueStatus(db, origin, await digest(bookingToken));
    }

    if (command === "stripe_checkout_status") {
      if (!withinLimit(`checkout-status:${address}`, 20)) {
        return respond(origin, 429, { state: "unavailable" });
      }
      const checkoutSessionId = body["checkoutSessionId"];
      if (!isStripeCheckoutSessionId(checkoutSessionId)) {
        return respond(origin, 200, { state: "unavailable" });
      }
      const stripeResponse = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(checkoutSessionId)}`,
        {
          headers: {
            Authorization:
              `Bearer ${Deno.env.get("STRIPE_RESTRICTED_KEY") ?? ""}`,
          },
        },
      );
      if (!stripeResponse.ok) {
        return respond(origin, 200, { state: "unavailable" });
      }
      const stripeSession = await stripeResponse.json() as Record<string, unknown>;
      const metadata = stripeSession["metadata"] as Record<string, unknown> | undefined;
      const attemptId = metadata?.["workshop_payment_attempt_id"];
      if (metadata?.["payment_context"] !== "workshop" || !isUuid(attemptId)) {
        return respond(origin, 200, { state: "unavailable" });
      }
      const attempt = await db.from("workshop_payment_attempts")
        .select("workshop_payment_attempt_id,workshop_bookings!inner(status_token_digest,booking_reference)")
        .eq("provider", "stripe")
        .eq("provider_checkout_id", checkoutSessionId)
        .eq("workshop_payment_attempt_id", attemptId)
        .maybeSingle();
      const booking = attempt.data?.workshop_bookings as
        | { status_token_digest?: string; booking_reference?: string }
        | Array<{ status_token_digest?: string; booking_reference?: string }>
        | undefined;
      const statusTokenDigest = Array.isArray(booking)
        ? booking[0]?.status_token_digest
        : booking?.status_token_digest;
      const bookingReference = Array.isArray(booking)
        ? booking[0]?.booking_reference
        : booking?.booking_reference;
      if (attempt.error || typeof statusTokenDigest !== "string") {
        return respond(origin, 200, { state: "unavailable" });
      }
      return issueStatus(db, origin, statusTokenDigest, bookingReference);
    }

    if (command === "request_status_access") {
      if (!withinLimit(`recovery:${address}`, 5)) {
        return respond(origin, 202, genericRecovery);
      }
      const email = body["email"];
      const supportReference = String(body["supportReference"] ?? "");
      if (
        !isEmail(email) || supportReference.length < 8 ||
        supportReference.length > 80
      ) {
        return respond(origin, 202, genericRecovery);
      }
      const commandKey = crypto.randomUUID();
      const queued = await db.rpc("queue_workshop_status_recovery", {
        p_contact_email: String(email).trim().toLowerCase(),
        p_support_reference: supportReference.trim().toUpperCase(),
        p_command_key: commandKey,
      });
      if (queued.error) {
        console.error(JSON.stringify({
          function: "manage-workshop-booking-access",
          code: "recovery_queue_failed",
        }));
      }
      return respond(origin, 202, genericRecovery);
    }

    if (command === "cancel_booking") {
      if (!withinLimit(`cancel:${address}`, 10)) {
        return respond(origin, 429, { state: "unavailable" });
      }
      const bookingToken = body["bookingToken"];
      const quantity = Number(body["quantity"]);
      const commandKey = body["commandKey"];
      if (
        typeof bookingToken !== "string" || bookingToken.length < 32 ||
        bookingToken.length > 256 || !Number.isSafeInteger(quantity) ||
        quantity < 1 || quantity > 20 || !isUuid(commandKey)
      ) {
        return respond(origin, 400, { state: "unavailable" });
      }
      const result = await db.rpc("manage_workshop_customer_booking", {
        p_action: "cancel_seats",
        p_payload: {
          statusTokenDigest: await digest(bookingToken),
          quantity,
        },
        p_command_key: commandKey,
      });
      if (result.error || !result.data) {
        return respond(origin, 200, { state: "unavailable" });
      }
      return respond(origin, 200, {
        state: result.data.state,
        activeQuantity: result.data.activeQuantity,
        refundProcessingState: result.data.refundProcessingState,
      });
    }

    if (command === "respond_to_waitlist") {
      if (!withinLimit(`waitlist:${address}`, 10)) {
        return respond(origin, 429, { state: "unavailable" });
      }
      const offerToken = body["bookingToken"];
      const response = body["response"];
      const termsVersion = Number(body["termsVersion"]);
      const commandKey = body["commandKey"];
      if (
        typeof offerToken !== "string" || offerToken.length < 32 ||
        offerToken.length > 256 || !["accept", "decline"].includes(String(response)) ||
        !isUuid(commandKey) ||
        (response === "accept" &&
          (!Number.isSafeInteger(termsVersion) || termsVersion < 1))
      ) {
        return respond(origin, 400, { state: "unavailable" });
      }
      const bookingToken = response === "accept"
        ? b64url(crypto.getRandomValues(new Uint8Array(32)))
        : null;
      const result = await db.rpc("manage_workshop_waitlist", {
        p_action: response === "accept" ? "accept_offer" : "decline_offer",
        p_payload: {
          offerTokenDigest: await digest(offerToken),
          ...(response === "accept"
            ? {
              termsVersion,
              statusTokenDigest: await digest(bookingToken!),
            }
            : {}),
        },
        p_command_key: commandKey,
      });
      if (result.error || !result.data) {
        return respond(origin, 200, { state: "unavailable" });
      }
      return respond(origin, 200, {
        state: result.data.state,
        quantity: result.data.quantity,
        effectiveExpiresAt: result.data.effectiveExpiresAt,
        ...(result.data.state === "accepted" && bookingToken
          ? { bookingToken }
          : {}),
      });
    }

    if (command === "respond_to_reschedule") {
      if (!withinLimit(`reschedule:${address}`, 10)) {
        return respond(origin, 429, { state: "unavailable" });
      }
      const responseToken = body["bookingToken"];
      const response = body["response"];
      const commandKey = body["commandKey"];
      if (
        typeof responseToken !== "string" || responseToken.length < 32 ||
        responseToken.length > 256 ||
        !["accept", "decline"].includes(String(response)) ||
        !isUuid(commandKey)
      ) {
        return respond(origin, 400, { state: "unavailable" });
      }
      const result = await db.rpc("manage_workshop_reschedule", {
        p_action: "respond",
        p_payload: {
          responseTokenDigest: await digest(responseToken),
          response,
        },
        p_command_key: commandKey,
      });
      if (result.error || !result.data) {
        return respond(origin, 200, { state: "unavailable" });
      }
      return respond(origin, 200, {
        state: result.data.state,
        replayed: result.data.replayed,
        responseId: result.data.responseId,
      });
    }

    return respond(origin, 400, { state: "unavailable" });
  } catch {
    return respond(origin, 200, { state: "unavailable" });
  }
});
