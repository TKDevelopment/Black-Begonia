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

const responseHeaders = (origin: string) => {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
  if (allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
};
const respond = (origin: string, status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });
const withinLimit = (userId: string) => {
  const now = Date.now();
  const current = rates.get(userId);
  if (!current || current.resetAt <= now) {
    rates.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  current.count += 1;
  return current.count <= 10;
};
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
const safeProviderError = (value: unknown) =>
  typeof value === "string" && value.length <= 80 ? value : null;

serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") return respond(origin, 204, {});
  if (request.method !== "POST" || !allowedOrigins.has(origin)) {
    return respond(origin, 404, { error: "Request unavailable" });
  }

  let service: ReturnType<typeof createClient<any>> | null = null;
  let requestId = "";
  let commandKey = "";
  let providerAccepted = false;
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const caller = createClient<any>(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: userData } = await caller.auth.getUser();
    if (!userData.user) {
      return respond(origin, 401, { error: "Request unavailable" });
    }
    const internal = await caller.rpc("is_internal_crm_user");
    if (internal.error || internal.data !== true) {
      return respond(origin, 403, { error: "Request unavailable" });
    }
    if (!withinLimit(userData.user.id)) {
      return respond(origin, 429, {
        error: "Refund requests are temporarily unavailable",
      });
    }
    const stripeKey = Deno.env.get("STRIPE_RESTRICTED_KEY") ?? "";
    if (!stripeKey) {
      console.error(JSON.stringify({
        function: "refund-workshop-payment",
        stage: "configuration",
        safe_failure: "stripe_key_missing",
      }));
      return respond(origin, 503, {
        error: "Stripe refunds are not configured",
        supportCode: "stripe_key_missing",
      });
    }

    const body = await request.json() as Record<string, unknown>;
    const transactionId = String(
      body["workshopPaymentTransactionId"] ?? "",
    );
    const amountMinor = Number(body["amountMinor"]);
    const seatQuantity = body["seatQuantity"] === undefined
      ? null
      : Number(body["seatQuantity"]);
    const reason = String(body["reason"] ?? "");
    commandKey = String(body["commandKey"] ?? "");
    if (
      !isUuid(transactionId) || !isUuid(commandKey) ||
      !Number.isSafeInteger(amountMinor) || amountMinor <= 0 ||
      amountMinor > 100_000_000 ||
      (seatQuantity !== null && (
        !Number.isSafeInteger(seatQuantity) || seatQuantity <= 0 ||
        seatQuantity > 1000
      )) ||
      ![
        "customer_requested",
        "duplicate",
        "fraudulent",
        "event_cancelled",
        "other",
      ].includes(reason)
    ) {
      return respond(origin, 400, { error: "Invalid refund request" });
    }

    const eligibility = await caller.rpc(
      seatQuantity === null
        ? "manage_workshop_financials"
        : "manage_workshop_refund_order",
      {
      p_action: seatQuantity === null ? "refund_eligibility" : "eligibility",
      p_payload: { transactionId },
      p_command_key: commandKey,
    });
    if (
      eligibility.error || eligibility.data?.eligible !== true ||
      amountMinor > Number(eligibility.data.remainingRefundableMinor)
    ) {
      return respond(origin, 409, {
        state: "ineligible",
        error: "The requested refund is not currently eligible",
      });
    }
    const providerPaymentId = String(
      eligibility.data.providerChargeId ?? "",
    );
    const providerPaymentParameter = providerPaymentId.startsWith("pi_")
      ? "payment_intent"
      : providerPaymentId.startsWith("ch_")
      ? "charge"
      : null;
    if (!providerPaymentParameter) {
      console.error(JSON.stringify({
        function: "refund-workshop-payment",
        stage: "provider_reference",
        safe_failure: "unsupported_stripe_payment_reference",
        reference_prefix: providerPaymentId.slice(0, 3),
      }));
      return respond(origin, 409, {
        error: "The Stripe payment reference cannot be refunded",
        supportCode: "unsupported_stripe_payment_reference",
      });
    }
    const requested = await caller.rpc(
      seatQuantity === null
        ? "manage_workshop_financials"
        : "manage_workshop_refund_order",
      {
      p_action: seatQuantity === null ? "request_refund" : "request_stripe",
      p_payload: {
        transactionId,
        amountMinor,
        ...(seatQuantity === null ? {} : { seatQuantity }),
        currency: String(eligibility.data.currency),
        reason,
      },
      p_command_key: commandKey,
    });
    if (requested.error || !requested.data?.requestId) {
      return respond(origin, 409, {
        state: "ineligible",
        error: "The requested refund is not currently eligible",
      });
    }
    requestId = String(requested.data.requestId);
    if (["provider_accepted", "reconciled"].includes(requested.data.state)) {
      return respond(origin, 200, {
        state: requested.data.state,
        replayed: true,
        requestId,
      });
    }
    if (requested.data.state === "provider_failed") {
      return respond(origin, 409, {
        state: "provider_failed",
        replayed: true,
        requestId,
      });
    }

    const stripeReason = reason === "duplicate" || reason === "fraudulent"
      ? reason
      : "requested_by_customer";
    const form = new URLSearchParams({
      [providerPaymentParameter]: providerPaymentId,
      amount: String(amountMinor),
      reason: stripeReason,
      "metadata[payment_context]": "workshop",
      "metadata[workshop_refund_request_id]": requestId,
      "metadata[workshop_payment_transaction_id]": transactionId,
      "metadata[workshop_payment_attempt_id]": String(
        requested.data.paymentAttemptId ?? "",
      ),
    });
    const providerResponse = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": commandKey,
      },
      body: form,
    });
    service = createClient<any>(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    if (!providerResponse.ok) {
      let providerError: Record<string, unknown> = {};
      try {
        const body = await providerResponse.json() as {
          error?: Record<string, unknown>;
        };
        providerError = body.error ?? {};
      } catch {
        // Stripe can return a non-JSON gateway body; status and request ID are sufficient.
      }
      console.error(JSON.stringify({
        function: "refund-workshop-payment",
        stage: "stripe_refund_create",
        provider_status: providerResponse.status,
        provider_request_id: safeProviderError(
          providerResponse.headers.get("request-id"),
        ),
        provider_error_type: safeProviderError(providerError["type"]),
        provider_error_code: safeProviderError(providerError["code"]),
        provider_error_param: safeProviderError(providerError["param"]),
        refund_request_id: requestId,
      }));
      await service.rpc("manage_workshop_financials", {
        p_action: "refund_provider_failed",
        p_payload: {
          requestId,
          safeFailure: `provider_status_${providerResponse.status}`,
        },
        p_command_key: commandKey,
      });
      return respond(origin, 502, {
        state: "provider_failed",
        requestId,
        error: "Stripe did not accept the refund request",
        supportCode: safeProviderError(providerError["code"]) ??
          `stripe_http_${providerResponse.status}`,
      });
    }
    providerAccepted = true;
    const providerRefund = await providerResponse.json() as
      Record<string, unknown>;
    const providerRefundId = String(providerRefund["id"] ?? "");
    if (!providerRefundId) throw new Error("Stripe refund response incomplete");
    const accepted = await service.rpc("manage_workshop_financials", {
      p_action: "refund_provider_accepted",
      p_payload: { requestId, providerRefundId },
      p_command_key: commandKey,
    });
    if (accepted.error) throw accepted.error;
    return respond(origin, 202, {
      state: "provider_accepted",
      replayed: requested.data.replayed === true,
      requestId,
      amountMinor,
      currency: requested.data.currency,
      remainingRefundableMinor: requested.data.remainingRefundableMinor,
    });
  } catch (error) {
    if (service && requestId && !providerAccepted) {
      await service.rpc("manage_workshop_financials", {
        p_action: "refund_provider_failed",
        p_payload: { requestId, safeFailure: "provider_processing_failed" },
        p_command_key: commandKey || crypto.randomUUID(),
      });
    }
    console.error(JSON.stringify({
      function: "refund-workshop-payment",
      message: error instanceof Error ? error.message : "refund failed",
    }));
    return respond(origin, 500, {
      state: "provider_failed",
      error: "The refund request could not be completed",
    });
  }
});
